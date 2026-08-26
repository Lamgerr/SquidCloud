import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [onboardingCheck, setOnboardingCheck] = useState<'loading' | 'redirect' | 'ok'>('loading');

  useEffect(() => {
    if (!user) return;

    const checkOnboarding = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', user.id)
          .single();

        let complete = data?.onboarding_complete ?? false;

        if (error && error.code !== 'PGRST116') {
          complete = false;
        }

        if (!complete && location.pathname !== '/onboarding') {
          setOnboardingCheck('redirect');
        } else {
          setOnboardingCheck('ok');
        }
      } catch {
        setOnboardingCheck('ok');
      }
    };

    checkOnboarding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (onboardingCheck === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (onboardingCheck === 'redirect') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
