
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { initializeStorageNodes } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseProfileType } from '@/types/file-manager';

const RepoCreation = () => {
  const [nodeName, setNodeName] = useState('');
  const [password, setPassword] = useState('');
  const [nodes, setNodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { count } = useParams<{ count: string }>();
  const location = useLocation();
  const nodeCount = parseInt(count || '1', 10);
  
  // Extract password from URL query params if present
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const passParam = queryParams.get('password');
    if (passParam) {
      setPassword(passParam);
    }
  }, [location]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const updateProfile = async (nodeName: string) => {
    try {
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      // Get current node count
      const { data: profileData, error: profileFetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileFetchError) {
        throw profileFetchError;
      }
      
      if (profileData) {
        // Cast to SupabaseProfileType to access storage_node_count
        const profile = profileData as SupabaseProfileType;
        const currentNodeCount = profile.storage_node_count || 0;
        
        // Update profile with the correct type
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            storage_node_count: currentNodeCount + 1,
            onboarding_complete: true
          })
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!nodeName) {
      toast({
        title: "Missing Storage Node Name",
        description: "Please enter a storage node name.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newNodes = await initializeStorageNodes(nodeCount, password);
      setNodes(newNodes);
      toast({
        title: "Storage Nodes Initialized",
        description: `Successfully initialized ${nodeCount} secure storage nodes.`,
      });

      await updateProfile(nodeName);

      navigate('/dashboard');
    } catch (err: any) {
      console.error("Error initializing storage nodes:", err);
      setError(err.message || "Failed to initialize storage nodes");
      toast({
        title: "Initialization Failed",
        description: err.message || "Failed to initialize secure storage nodes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Create Secure Storage Node</CardTitle>
          <CardDescription>
            Initialize a new end-to-end encrypted storage node for your secure file storage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="nodeName">Storage Node Name</Label>
              <Input
                type="text"
                id="nodeName"
                placeholder="Enter storage node name"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
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
                "Initialize Storage Node"
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
