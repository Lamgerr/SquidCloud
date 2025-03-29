
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { initializeRepos } from '@/lib/api';
import { Loader2, Check, AlertCircle, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useIsMobile } from '@/hooks/use-mobile';

const RepoCreation = () => {
  const { count } = useParams<{ count: string }>();
  const location = useLocation();
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [vaults, setVaults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Extract password from query string
  const queryParams = new URLSearchParams(location.search);
  const password = queryParams.get('password');

  useEffect(() => {
    const createVaults = async () => {
      setCreating(true);
      setProgress(10);
      
      try {
        // Parse the count parameter, default to 5 if not provided or invalid
        const vaultCount = count ? parseInt(count, 10) : 5;
        const validCount = isNaN(vaultCount) ? 5 : Math.min(Math.max(1, vaultCount), 5);
        
        setProgress(30);
        
        // Create the secure vaults with password if provided
        const createdVaults = await initializeRepos(validCount, password || undefined);
        
        setProgress(90);
        setVaults(createdVaults);
        
        toast({
          title: "Setup complete",
          description: `Successfully created ${createdVaults.length} secure vaults for your encrypted data`,
        });
        
        // Redirect back to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
        
      } catch (err: any) {
        console.error("Vault creation error:", err);
        setError(err.message || "Failed to create secure vaults");
        
        toast({
          title: "Setup failed",
          description: err.message || "There was a problem creating your secure vaults",
          variant: "destructive",
        });
      } finally {
        setProgress(100);
        setCreating(false);
      }
    };

    createVaults();
  }, [count, navigate, toast, password]);

  return (
    <div className="h-full flex items-center justify-center p-4">
      <Card className={`w-full ${isMobile ? 'max-w-[90%]' : 'max-w-md'} shadow-lg`}>
        <CardHeader className={isMobile ? 'px-4 py-4' : ''}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl">Secure Vault Setup</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Creating distributed secure vaults for your encrypted files
          </CardDescription>
        </CardHeader>
        
        <CardContent className={isMobile ? 'px-4 pb-4' : ''}>
          <div className="space-y-5">
            <Progress value={progress} className="w-full h-2" />
            
            {creating ? (
              <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <p className="text-lg font-medium mb-2">Creating secure vaults</p>
                <p className="text-muted-foreground text-sm">
                  Setting up your encrypted storage system...
                </p>
              </div>
            ) : error ? (
              <div className="bg-destructive/10 p-5 rounded-lg text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <p className="text-lg font-medium mb-2 text-destructive">Setup Failed</p>
                <p className="text-sm mb-4 text-muted-foreground">{error}</p>
                <Button 
                  variant="outline" 
                  size={isMobile ? "sm" : "default"}
                  className="mt-2" 
                  onClick={() => navigate('/dashboard')}
                >
                  Back to Dashboard
                </Button>
              </div>
            ) : vaults.length > 0 ? (
              <div className="bg-green-50 dark:bg-green-900/20 p-5 rounded-lg text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-green-500" />
                </div>
                <p className="text-lg font-medium mb-2">Setup Complete!</p>
                <p className="text-muted-foreground text-sm mb-4">
                  Your secure vaults are ready to store encrypted files
                </p>
                
                <div className="grid grid-cols-1 gap-3 mb-4">
                  <div className="flex items-center justify-center gap-2 py-2 px-4 bg-white dark:bg-slate-800 rounded-md">
                    <Lock className="h-4 w-4 text-primary" />
                    <span className="text-sm">End-to-End Encryption Active</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 py-2 px-4 bg-white dark:bg-slate-800 rounded-md">
                    <KeyRound className="h-4 w-4 text-primary" />
                    <span className="text-sm">{vaults.length} Secure Vault Keys Generated</span>
                  </div>
                </div>
                
                <Button 
                  variant="default" 
                  size={isMobile ? "sm" : "default"}
                  className="mt-2 w-full" 
                  onClick={() => navigate('/dashboard')}
                >
                  Continue to Dashboard
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RepoCreation;
