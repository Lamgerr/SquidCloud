
import { clearV4Master } from '@/lib/e2e-v4-session';
import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { securityService } from '@/services/security-service';
import { squidguard } from '@/services/squidguard-shield';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { MasterKeySetupModal } from '@/components/MasterKeySetupModal';
import { buildPublicUrl, getOAuthRedirectUrl } from '@/lib/appLinks';
import { mfaService, AalLevel } from '@/services/mfa-service';
import MfaChallengeScreen from '@/components/MfaChallengeScreen';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  loading: boolean;
  isNewUser: boolean;
  aalLevel: AalLevel | null;
  mfaRequired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  githubSignIn: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshAalLevel: () => Promise<void>;
  completeMfaChallenge: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [showMasterKeySetup, setShowMasterKeySetup] = useState(false);
  const [masterKeyPassword, setMasterKeyPassword] = useState<string>('');
  const [aalLevel, setAalLevel] = useState<AalLevel | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);

  let toast: any;
  try {
    const toastHook = useToast();
    toast = toastHook.toast;
  } catch (error) {
    console.error('Toast hook error:', error);
    toast = () => {};
  }

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return null;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (error) {
          console.error('Profile fetch error:', error);
          return null;
        }
        
        return data;
      } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
    };

    if (user) {
      fetchProfile().then(setProfile);
    } else {
      setProfile(null);
    }
  }, [user]);

  useEffect(() => {
    // Only get initial session, don't refresh on every mount
    let isInitialRestore = true;

    const initializeAuth = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);

        // Check AAL level on session restore
        if (session?.user) {
          const aal = await mfaService.getAalLevel();
          setAalLevel(aal);
          if (aal && aal.nextLevel === 'aal2' && aal.currentLevel === 'aal1') {
            setMfaRequired(true);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
        isInitialRestore = false;
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_IN') {
          if (isInitialRestore) {
            return;
          }

          const isRecentUser = session?.user &&
            new Date(session.user.created_at).getTime() > Date.now() - 120000;

          if (isRecentUser && session?.user?.app_metadata?.provider === 'email') {
            console.log('New user detected');
            setIsNewUser(true);
          }

          // Check MFA AAL for all sign-in methods (OAuth, passkey, etc.)
          mfaService.getAalLevel().then(aal => {
            setAalLevel(aal);
            if (aal && aal.nextLevel === 'aal2' && aal.currentLevel === 'aal1') {
              setMfaRequired(true);
            }
          });

          // Track session start asynchronously without blocking
          setTimeout(async () => {
            try {
              await securityService.logSecurityEvent({
                event_type: 'login_attempt',
                ip_address: 'unknown',
                user_agent: navigator.userAgent,
                metadata: {
                  provider: session?.user?.app_metadata?.provider || 'unknown',
                  timestamp: new Date().toISOString()
                },
                risk_level: 'low',
                status: 'success'
              });
            } catch (trackingError) {
              console.error('Error tracking session start:', trackingError);
            }
          }, 100);

          if (toast) {
            const WELCOME_BACK_KEY = 'squidcloud_welcome_back_ts';
            const lastWelcome = localStorage.getItem(WELCOME_BACK_KEY);
            const fiveHours = 5 * 60 * 60 * 1000;
            if (!lastWelcome || Date.now() - parseInt(lastWelcome, 10) > fiveHours) {
              toast({
                title: "Welcome back!",
                description: "You have successfully signed in"
              });
              localStorage.setItem(WELCOME_BACK_KEY, String(Date.now()));
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setIsNewUser(false);
          setMfaRequired(false);
          setAalLevel(null);
          if (toast) {
            toast({
              title: "Signed out",
              description: "You have successfully been signed out"
            });
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []); // Empty dependency array - only run once on mount

  const refreshSession = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.refreshSession();
      setSession(session);
      setUser(session?.user ?? null);
    } catch (error) {
      console.error('Error refreshing session:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password');
        }
        throw signInError;
      }

      // Store password temporarily for master key operations
      setMasterKeyPassword(password);

      // Check if user has master key initialized
      if (authData.user) {
        const { data: masterKeyData } = await supabase
          .from('master_keys')
          .select('id')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (!masterKeyData) {
          // No master key - prompt setup
          setShowMasterKeySetup(true);
        }

        // Track login session
        const userAgent = navigator.userAgent;
        const deviceName = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) 
          ? 'Mobile Device' 
          : 'Desktop';

        await supabase.from('login_sessions').insert({
          user_id: authData.user.id,
          user_agent: userAgent,
          device_name: deviceName,
          last_active: new Date().toISOString()
        });

        // Check MFA AAL level after login
        const aal = await mfaService.getAalLevel();
        setAalLevel(aal);
        if (aal && aal.nextLevel === 'aal2' && aal.currentLevel === 'aal1') {
          setMfaRequired(true);
        }
      }

    } catch (error: any) {
      console.error('Sign in error:', error);
      if (toast) {
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive"
        });
      }
      throw error;
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            full_name: fullName
          },
          emailRedirectTo: buildPublicUrl('/dashboard')
        }
      });
      if (error) throw error;
      
      setIsNewUser(true);
      setShowVerificationDialog(true);
      
      if (toast) {
        toast({
          title: "Account created",
          description: "Please check your email to confirm your account"
        });
      }
    } catch (error: any) {
      if (toast) {
        toast({
          title: "Registration failed",
          description: error.message,
          variant: "destructive"
        });
      }
      throw error;
    }
  };

  const signOut = async () => {
    try {
      try {
        await squidguard.requireActionToken('auth:signout', 'session');
      } catch {
        // Guard check failed — proceed with sign out anyway
      }
      clearV4Master();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Track logout asynchronously after signout
      setTimeout(async () => {
        try {
          await securityService.logSecurityEvent({
            event_type: 'login_attempt',
            ip_address: 'unknown',
            user_agent: navigator.userAgent,
            metadata: { 
              action: 'logout',
              timestamp: new Date().toISOString() 
            },
            risk_level: 'low',
            status: 'success'
          });
        } catch (trackingError) {
          console.error('Error tracking logout:', trackingError);
        }
      }, 100);
    } catch (error: any) {
      if (toast) {
        toast({
          title: "Sign out failed",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (!error && data) setProfile(data);
    } catch (err) {
      console.error('Error refreshing profile:', err);
    }
  };

  const refreshAalLevel = useCallback(async () => {
    const level = await mfaService.getAalLevel();
    setAalLevel(level);
    if (level && level.nextLevel === 'aal2' && level.currentLevel === 'aal1') {
      setMfaRequired(true);
    } else {
      setMfaRequired(false);
    }
  }, []);

  const completeMfaChallenge = useCallback(() => {
    setMfaRequired(false);
    refreshAalLevel();
  }, [refreshAalLevel]);

  const githubSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: getOAuthRedirectUrl()
        }
      });
      if (error) throw error;
    } catch (error: any) {
      if (toast) {
        toast({
          title: "GitHub sign in failed",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const contextValue = useMemo(() => ({
    session,
    user,
    profile,
    loading,
    isNewUser,
    aalLevel,
    mfaRequired,
    signIn,
    signUp,
    signOut,
    githubSignIn,
    refreshSession,
    refreshProfile,
    refreshAalLevel,
    completeMfaChallenge
  }), [session, user, profile, loading, isNewUser, aalLevel, mfaRequired, signIn, signUp, signOut, githubSignIn, refreshSession, refreshProfile, refreshAalLevel, completeMfaChallenge]);

  return (
    <AuthContext.Provider value={contextValue}>
      {mfaRequired ? (
        <MfaChallengeScreen
          onVerified={completeMfaChallenge}
          onCancel={signOut}
        />
      ) : (
        children
      )}

      {!mfaRequired && (
        <MasterKeySetupModal 
          open={showMasterKeySetup} 
          onComplete={() => {
            setShowMasterKeySetup(false);
            setMasterKeyPassword('');
          }} 
        />
      )}

      {!mfaRequired && (
        <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Email Verification Required
              </DialogTitle>
              <DialogDescription>
                We've sent a verification link to your email address. Please check your inbox and verify your email to continue.
              </DialogDescription>
            </DialogHeader>
            <div className="border rounded-md p-4 mt-4 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800 dark:text-amber-400">Important</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">
                    If you don't see the verification email, please check your spam folder. The verification link will expire after 24 hours.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => setShowVerificationDialog(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
