
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Shield, 
  ShieldCheck, 
  ShieldAlert
} from 'lucide-react';
import { login, register } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Password strength checker
  const checkPasswordStrength = (pass: string) => {
    let score = 0;
    
    if (!pass) {
      setPasswordStrength(0);
      return;
    }
    
    // Length check
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    
    // Complexity checks
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    
    setPasswordStrength(Math.min(score, 5));
  };
  
  const getPasswordStrengthIcon = () => {
    if (passwordStrength === 0) return null;
    if (passwordStrength < 3) return <ShieldAlert className="h-4 w-4 text-red-500" />;
    if (passwordStrength < 5) return <Shield className="h-4 w-4 text-amber-500" />;
    return <ShieldCheck className="h-4 w-4 text-green-500" />;
  };
  
  const getPasswordStrengthText = () => {
    if (passwordStrength === 0) return '';
    if (passwordStrength < 3) return 'Weak';
    if (passwordStrength < 5) return 'Good';
    return 'Strong';
  };
  
  const getPasswordStrengthClass = () => {
    if (passwordStrength === 0) return '';
    if (passwordStrength < 3) return 'text-red-500';
    if (passwordStrength < 5) return 'text-amber-500';
    return 'text-green-500';
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || (!isLogin && !name)) {
      toast({
        title: "Missing information",
        description: "Please fill in all the required fields",
        variant: "destructive",
      });
      return;
    }
    
    // Check password strength for register
    if (!isLogin && passwordStrength < 3) {
      toast({
        title: "Weak password",
        description: "Please use a stronger password for better security",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (isLogin) {
        await login(email, password);
        toast({
          title: "Login successful",
          description: "Welcome back to InflateStorage",
        });
      } else {
        await register(email, password, name);
        toast({
          title: "Registration successful",
          description: "Your secure storage has been created",
        });
      }
      
      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Authentication error:', error);
      toast({
        title: isLogin ? "Login failed" : "Registration failed",
        description: "Please check your credentials and try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        {/* Left side - form */}
        <div className="w-full lg:w-1/2 xl:w-2/5 p-8 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            <div className="mb-6">
              <Link 
                to="/" 
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to home
              </Link>
            </div>
            
            <div className="space-y-2 mb-8">
              <h1 className="text-3xl font-bold">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
              <p className="text-muted-foreground">
                {isLogin ? 'Sign in to access your secure storage' : 'Start your secure storage journey'}
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      className="pl-10"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    className="pl-10"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      checkPasswordStrength(e.target.value);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                
                {!isLogin && passwordStrength > 0 && (
                  <div className="flex items-center space-x-2 mt-2">
                    <div className="flex space-x-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 w-5 rounded-full ${
                            i < passwordStrength 
                              ? i < 2 
                                ? 'bg-red-500' 
                                : i < 4 
                                  ? 'bg-amber-500' 
                                  : 'bg-green-500'
                              : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center text-xs">
                      {getPasswordStrengthIcon()}
                      <span className={`ml-1 ${getPasswordStrengthClass()}`}>
                        {getPasswordStrengthText()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      {isLogin ? 'Signing in...' : 'Creating account...'}
                    </div>
                  ) : (
                    isLogin ? 'Sign in' : 'Create account'
                  )}
                </Button>
              </div>
            </form>
            
            <div className="mt-6 text-center">
              <button
                type="button"
                className="text-sm text-primary hover:text-primary/80 transition-colors"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin 
                  ? "Don't have an account? Sign up" 
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        </div>
        
        {/* Right side - image/info */}
        <div className="hidden lg:block lg:w-1/2 xl:w-3/5 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/30 relative">
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <div className="max-w-xl space-y-6">
              <div className="flex space-x-2">
                <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center">
                  <Lock className="h-6 w-6 text-white" />
                </div>
              </div>
              
              <h2 className="text-3xl font-bold">Secure Cloud Storage with Zero Compromises</h2>
              
              <p className="text-lg text-slate-700 dark:text-slate-300">
                InflateStorage offers end-to-end encrypted cloud storage. Your files are encrypted before they leave your device, ensuring only you can access them.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                  <div className="flex items-center space-x-2 mb-1">
                    <Shield className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">End-to-End Encryption</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your files are encrypted before upload and decrypted after download.
                  </p>
                </div>
                
                <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                  <div className="flex items-center space-x-2 mb-1">
                    <Lock className="h-4 w-4 text-green-500" />
                    <span className="font-medium">Zero-Knowledge Privacy</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Even we can't see what's inside your files.
                  </p>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                By creating an account, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>
          
          {/* Background decoration */}
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-blue-500/10 to-purple-500/10 blur-3xl" />
          <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-green-500/10 to-blue-500/10 blur-3xl" />
        </div>
      </div>
    </div>
  );
};

export default Auth;
