import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const Onboarding = () => {
  const navigate = useNavigate();

  const completeOnboarding = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Update onboarding status
    await supabase
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', session.user.id);

    // Navigate to vault creation
    navigate('/r/c/1');
  };

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to CloudBliss</h1>
      
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Secure Storage Vaults</h2>
          <p className="text-gray-600 mb-4">
            Create up to 2 secure storage vaults for your encrypted files.
            Each vault provides:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>End-to-end encryption</li>
            <li>Distributed storage</li>
            <li>Secure file sharing</li>
          </ul>
        </div>

        <Button 
          onClick={completeOnboarding}
          className="w-full"
        >
          Get Started
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
