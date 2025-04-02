import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const Onboarding = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkOnboarding = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', session.user.id)
        .single();

      if (profile?.onboarding_complete) {
        navigate('/dashboard');
      }
    };

    checkOnboarding();
  }, [navigate]);

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to CloudBliss</h1>
      
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Create Your First Storage Vault</h2>
          <p className="text-gray-600 mb-4">
            To get started with CloudBliss, you'll need to:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Create a secure storage vault (max 2 vaults per user)</li>
            <li>Your files will be protected with end-to-end encryption</li>
            <li>Access dashboard features after vault creation</li>
          </ul>
        </div>

        <Button 
          onClick={() => navigate('/dashboard')}
          className="w-full"
        >
          Continue to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
