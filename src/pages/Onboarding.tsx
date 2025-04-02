
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseProfileType } from '@/types/file-manager';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

const Onboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkOnboarding = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (data) {
        // Explicit cast to SupabaseProfileType
        const profile = data as unknown as SupabaseProfileType;
        if (profile.onboarding_complete) {
          navigate('/dashboard');
        }
      }
    };

    checkOnboarding();
  }, [navigate]);

  const handleCreateVault = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase.rpc('initialize_file_system', {
        user_id: session.user.id
      });

      if (error) throw error;

      // Update the user's profile to mark onboarding as complete
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ onboarding_complete: true })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      toast({
        title: "Storage vault created!",
        description: "Your secure storage vault has been successfully created.",
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: "Error creating storage vault",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <Card className="shadow-lg">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-2xl font-bold">Welcome to CloudBliss</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6 pt-6">
          <div className="bg-accent/20 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Create Your Secure Storage Vault</h2>
            <p className="text-muted-foreground mb-4">
              To get started with CloudBliss, you'll need to create your secure storage space:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Files will be protected with end-to-end encryption</li>
              <li>Create folders to organize your content</li>
              <li>Share files securely with others</li>
              <li>Access dashboard features after vault creation</li>
            </ul>
          </div>
          
          <div className="flex items-center p-4 bg-primary/5 rounded-lg">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mr-4">
              <span className="text-xl font-bold">1</span>
            </div>
            <div>
              <h3 className="font-medium">Create Secure Storage</h3>
              <p className="text-sm text-muted-foreground">Your first step in using CloudBliss</p>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-end pt-4">
          <Button onClick={handleCreateVault} className="w-full md:w-auto">
            Create Storage Vault
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Onboarding;
