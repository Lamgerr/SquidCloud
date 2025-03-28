
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { initializeRepos } from '@/lib/api';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const RepoCreation = () => {
  const { count } = useParams<{ count: string }>();
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [vaults, setVaults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const createVaults = async () => {
      setCreating(true);
      setProgress(10);
      
      try {
        // Parse the count parameter, default to 5 if not provided or invalid
        const vaultCount = count ? parseInt(count, 10) : 5;
        const validCount = isNaN(vaultCount) ? 5 : Math.min(Math.max(1, vaultCount), 5);
        
        setProgress(30);
        
        // Create the repositories
        const createdVaults = await initializeRepos(validCount);
        
        setProgress(90);
        setVaults(createdVaults);
        
        toast({
          title: "Setup complete",
          description: `Successfully created ${createdVaults.length} secure vaults for your files`,
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
  }, [count, navigate, toast]);

  return (
    <div className="container max-w-md py-12">
      <Card>
        <CardHeader>
          <CardTitle>Secure Vault Setup</CardTitle>
          <CardDescription>
            Creating secure vaults for your encrypted files
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
                <p className="text-sm text-muted-foreground mt-1">
                  Created {vaults.length} secure vaults
                </p>
                <Button 
                  variant="default" 
                  className="mt-4" 
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
