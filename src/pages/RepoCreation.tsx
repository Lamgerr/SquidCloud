import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { initializeRepos } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const RepoCreation = () => {
  const [repoName, setRepoName] = useState('');
  const [password, setPassword] = useState('');
  const [repos, setRepos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { count } = useParams<{ count: string }>();
  const repoCount = parseInt(count || '1', 10);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!repoName) {
      toast({
        title: "Missing Repository Name",
        description: "Please enter a repository name.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newRepos = await initializeRepos(repoCount, password);
      setRepos(newRepos);
      toast({
        title: "Repositories Initialized",
        description: `Successfully initialized ${repoCount} secure repositories.`,
      });

      await updateProfile(repoName);

      navigate('/dashboard');
    } catch (err: any) {
      console.error("Error initializing repos:", err);
      setError(err.message || "Failed to initialize repositories");
      toast({
        title: "Initialization Failed",
        description: err.message || "Failed to initialize secure repositories.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (repoName: string) => {
    try {
      // Get current repo count
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileData) {
        const currentRepoCount = (profileData as any).repo_count || 0;
        
        // Update profile with incremented repo count and mark onboarding as complete
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            repo_count: currentRepoCount + 1,
            onboarding_complete: true
          } as any)
          .eq('id', user.id);

        if (profileError) {
          console.error("Error updating profile:", profileError);
          throw profileError;
        }
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Create Secure Repository</CardTitle>
          <CardDescription>
            Initialize a new end-to-end encrypted repository for your secure file storage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="repoName">Repository Name</Label>
              <Input
                type="text"
                id="repoName"
                placeholder="Enter repository name"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Encryption Password (Optional)</Label>
              <Input
                type="password"
                id="password"
                placeholder="Set encryption password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Initialize Repository"
              )}
            </Button>
            {error && <p className="text-red-500">{error}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RepoCreation;
