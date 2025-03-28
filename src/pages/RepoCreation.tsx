
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { initializeRepos } from '@/lib/api';
import { Loader2, Check, AlertCircle, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const RepoCreation = () => {
  const { count } = useParams<{ count: string }>();
  const location = useLocation();
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [vaults, setVaults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

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
    <div className="container max-w-md py-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Secure Vault Setup
          </CardTitle>
          <CardDescription>
            Creating distributed secure vaults for your encrypted files
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-6">
            <Progress value={progress} className="w-full" />
            
            {creating ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <p>Creating secure vaults...</p>
              </div>
            ) : error ? (
              <div className="bg-destructive/10 p-4 rounded-md text-center">
                <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
                <p className="text-sm font-medium text-destructive">{error}</p>
                <Button 
                  variant="outline" 
                  className="mt-4" 
                  onClick={() => navigate('/dashboard')}
                >
                  Back to Dashboard
                </Button>
              </div>
            ) : vaults.length > 0 ? (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md text-center">
                <Check className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="font-medium">Setup completed successfully!</p>
                <div className="mt-2 mb-4 grid grid-cols-1 gap-2">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    <span>End-to-End Encryption Setup Complete</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <KeyRound className="h-4 w-4" />
                    <span>Generated {vaults.length} Secure Vault Keys</span>
                  </div>
                </div>
                <Button 
                  variant="default" 
                  className="mt-2" 
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
