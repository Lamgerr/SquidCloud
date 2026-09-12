import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Mail, Lock, User, Eye, EyeOff, Github, Fingerprint
} from '@/lib/icon-map';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { securityService } from '@/services/security-service';
import MainHeader from '@/components/MainHeader';
import { INKModal } from '@/components/INKModal';
import { useINK } from '@/hooks/useINK';
import { isPasskeyAvailable, authenticateWithPasskey } from '@/lib/webauthn';
import { getOAuthRedirectUrl, getPasswordRecoveryRedirectUrl } from '@/lib/appLinks';
import { getClientIp } from '@/lib/clientIp';
import { emitSignal } from '@/lib/api';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp, user } = useAuth();
  const [searchParams] = useSearchParams();
  const { isOpen: isINKOpen, openINK, closeINK } = useINK();

  const getRedirectTarget = useCallback(() => {
    const nextParam = searchParams.get('next') || localStorage.getItem('squid_auth_next');
    if (nextParam && nextParam.startsWith('/')) return nextParam;
    return '/dashboard';
  }, [searchParams]);

  useEffect(() => {
    const nextParam = searchParams.get('next');
    if (nextParam) localStorage.setItem('squid_auth_next', nextParam);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('tab') === 'signup') {
      setIsLogin(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      const target = getRedirectTarget();
      localStorage.removeItem('squid_auth_next');
      navigate(target);
    }
  }, [getRedirectTarget, navigate, user]);

  useEffect(() => {
    isPasskeyAvailable().then(setPasskeyAvailable);
  }, []);

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const type = searchParams.get('type');

    if (type === 'recovery' && accessToken && refreshToken) {
      setIsPasswordReset(true);
      setIsLogin(true);
      setShowForgotPassword(false);
    }
  }, [searchParams]);

  const checkPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return Math.min(score, 5);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast({ title: "Missing information", description: "Please fill in both password fields", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords are identical", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters long", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      void emitSignal({
        type: 'password_changed',
        severity: 'warning',
        title: 'Password changed',
        body: 'Your account password was changed. If this wasn\'t you, contact support immediately.',
        link: '/settings/account',
      });
      toast({ title: "Password updated", description: "Your password has been successfully updated." });
      navigate('/auth', { replace: true });
      setIsPasswordReset(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Email required", description: "Please enter your email address", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordRecoveryRedirectUrl(),
      });
      if (error) throw error;
      setResetEmailSent(true);
      toast({ title: "Reset email sent", description: "Check your email for a password reset link" });
    } catch (error: any) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !name)) {
      toast({ title: "Missing information", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        const target = getRedirectTarget();
        localStorage.removeItem('squid_auth_next');
        navigate(target);
        setTimeout(async () => {
          try { await securityService.trackLogin(true, await getCurrentIP()); } catch {}
        }, 100);
      } else {
        await signUp(email, password, name);
        toast({ title: "Account created", description: "Welcome to SquidCloud!" });
      }
    } catch (error: any) {
      toast({ title: "Authentication Failed", description: error?.message || "Please check your credentials and try again.", variant: "destructive" });
      if (isLogin) {
        setTimeout(async () => {
          try { await securityService.trackLogin(false, await getCurrentIP()); } catch {}
        }, 100);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    try {
      const promise = authenticateWithPasskey(email || undefined);
      setPasskeyLoading(true);
      const result = await promise;
      if (!result.success) {
        toast({ title: "Authentication failed", description: "Please try again or use password", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Passkey login failed", description: error.message || "Please try again", variant: "destructive" });
    } finally {
      setPasskeyLoading(false);
    }
  };

  const getCurrentIP = async (): Promise<string> => {
    return getClientIp();
  };

  const handleOAuthSignIn = async (provider: 'github' | 'google' | 'discord') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: getOAuthRedirectUrl() }
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: `${provider} sign in failed`, description: error.message, variant: "destructive" });
    }
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setResetEmailSent(false);
    setEmail('');
  };

  const strength = checkPasswordStrength(password);

  if (isPasswordReset) {
    return (
      <div className="min-h-screen flex flex-col">
        <MainHeader />
        <INKModal isOpen={isINKOpen} onClose={closeINK} />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-sm w-full mx-auto animate-fade-up">
            <div className="space-y-1 mb-8">
              <h1 className="text-2xl font-bold tracking-tight">Set new password</h1>
              <p className="text-sm text-muted-foreground">Enter your new password below</p>
            </div>
            <form onSubmit={handlePasswordReset} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-xs font-medium text-muted-foreground">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    className="pl-10 pr-12 h-11 rounded-xl bg-muted/30 border-border/50 focus-visible:border-squid-blue-500/50 focus-visible:ring-2 focus-visible:ring-squid-blue-500/10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-xs font-medium text-muted-foreground">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm new password"
                    className="pl-10 h-11 rounded-xl bg-muted/30 border-border/50 focus-visible:border-squid-blue-500/50 focus-visible:ring-2 focus-visible:ring-squid-blue-500/10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl" disabled={isLoading} loading={isLoading}>
                Update password
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-hidden">
      <MainHeader />
      <INKModal isOpen={isINKOpen} onClose={closeINK} />

      <div className="flex flex-1 items-center justify-center p-6 md:p-8">
        <div className="w-full max-w-sm mx-auto stagger-children">
          {!showForgotPassword && (
            <div className="mb-6">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors press-effect"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
                </svg>
                Back to home
              </Link>
            </div>
          )}

          {showForgotPassword ? (
            <>
              <div className="mb-6">
                <button
                  onClick={handleBackToLogin}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors press-effect"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
                  </svg>
                  Back to sign in
                </button>
              </div>

              <div className="space-y-1 mb-8">
                <h1 className="text-2xl font-bold tracking-tight">
                  {resetEmailSent ? 'Check your email' : 'Reset your password'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {resetEmailSent
                    ? 'We sent a password reset link to your email'
                    : "Enter your email and we'll send you a reset link"}
                </p>
              </div>

              {!resetEmailSent && (
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-xs font-medium text-muted-foreground">Email</Label>
                    <div className="relative">
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="you@example.com"
                        className="pl-10 h-11 rounded-xl bg-muted/30 border-border/50 focus-visible:border-squid-blue-500/50 focus-visible:ring-2 focus-visible:ring-squid-blue-500/10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11 rounded-xl" disabled={isLoading} loading={isLoading}>
                    Send reset link
                  </Button>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="space-y-1 mb-8">
                <h1 className="text-2xl font-bold tracking-tight">
                  {isLogin ? 'Sign in' : 'Create account'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isLogin ? 'Welcome back to SquidCloud' : 'Start your secure storage journey'}
                </p>
              </div>

              {isLogin && passkeyAvailable && (
                <div className="mb-6 space-y-4">
                  <Button
                    type="button"
                    onClick={handlePasskeyLogin}
                    disabled={passkeyLoading}
                    size="lg"
                    className="w-full rounded-xl"
                  >
                    {passkeyLoading ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2.5" className="opacity-15" />
                        <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin-join" />
                      </svg>
                    ) : (
                      <Fingerprint className="h-5 w-5" />
                    )}
                    {passkeyLoading ? 'Authenticating...' : email ? 'Sign in with passkey' : 'Sign in with passkey'}
                  </Button>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">or</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">Full name</Label>
                    <div className="relative">
                      <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        className="pl-10 h-11 rounded-xl bg-muted/30 border-border/50 focus-visible:border-squid-blue-500/50 focus-visible:ring-2 focus-visible:ring-squid-blue-500/10"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10 h-11 rounded-xl bg-muted/30 border-border/50 focus-visible:border-squid-blue-500/50 focus-visible:ring-2 focus-visible:ring-squid-blue-500/10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      className="pl-10 pr-12 h-11 rounded-xl bg-muted/30 border-border/50 focus-visible:border-squid-blue-500/50 focus-visible:ring-2 focus-visible:ring-squid-blue-500/10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {!isLogin && password && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`h-1 w-6 rounded-full transition-all duration-300 ${
                              i <= (strength || 0)
                                ? (strength || 0) < 2 ? 'bg-red-400' : (strength || 0) < 4 ? 'bg-amber-400' : 'bg-green-400'
                                : 'bg-muted/50'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {(strength || 0) < 2 ? 'Weak' : (strength || 0) < 4 ? 'Good' : 'Strong'}
                      </span>
                    </div>
                  )}

                  {isLogin && (
                    <div className="flex justify-end mt-1">
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowForgotPassword(true)}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full h-11 rounded-xl" disabled={isLoading} loading={isLoading}>
                  {isLogin ? 'Sign in' : 'Create account'}
                </Button>
              </form>

              <div className="mt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-border/50" />
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Continue with</span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleOAuthSignIn('github')}
                    className="flex items-center justify-center h-10 rounded-lg border border-border/50 bg-transparent hover:bg-accent/50 transition-all press-effect"
                  >
                    <Github className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOAuthSignIn('google')}
                    className="flex items-center justify-center h-10 rounded-lg border border-border/50 bg-transparent hover:bg-accent/50 transition-all press-effect"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOAuthSignIn('discord')}
                    className="flex items-center justify-center h-10 rounded-lg border border-border/50 bg-transparent hover:bg-accent/50 transition-all press-effect"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#5865F2">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="mt-8 text-center space-y-4">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  By continuing, you agree to our{' '}
                  <Link to="/terms" className="text-primary hover:text-primary/80 transition-colors">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-primary hover:text-primary/80 transition-colors">Privacy Policy</Link>
                </p>

                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setPassword('');
                    setShowPassword(false);
                  }}
                >
                  {isLogin
                    ? <>Don't have an account? <span className="text-primary font-medium">Sign up</span></>
                    : <>Already have an account? <span className="text-primary font-medium">Sign in</span></>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
