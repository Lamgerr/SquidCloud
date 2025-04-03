
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const Onboarding = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/auth');
          return;
        }

        setUserId(session.user.id);

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error("Error fetching profile:", error);
          setLoading(false);
          return;
        }

        if (profile?.onboarding_complete) {
          navigate('/dashboard');
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error in onboarding check:", error);
        setLoading(false);
      }
    };

    checkOnboarding();
  }, [navigate]);

  const completeOnboarding = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_complete: true })
        .eq('id', userId);

      if (error) {
        console.error("Error updating onboarding status:", error);
        setLoading(false);
        return;
      }

      navigate('/dashboard');
    } catch (error) {
      console.error("Error completing onboarding:", error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to CloudBliss</h1>
      
      <div className="space-y-6">
        <div className="bg-card p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Create Your First Storage Vault</h2>
          <p className="text-muted-foreground mb-4">
            To get started with CloudBliss, you'll need to:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Create a secure storage vault (max 2 vaults per user)</li>
            <li>Your files will be protected with end-to-end encryption</li>
            <li>Access dashboard features after vault creation</li>
          </ul>
        </div>

        <Button 
          onClick={completeOnboarding}
          className="w-full"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Continue to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
