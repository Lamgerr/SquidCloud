import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MaintenanceMode {
  enabled: boolean;
  message: string;
}

export const useMaintenanceMode = () => {
  const [maintenanceMode, setMaintenanceMode] = useState<MaintenanceMode>({
    enabled: false,
    message: 'System is under maintenance. Please check back later.'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { void fetchMaintenanceMode(); }, []);

  const fetchMaintenanceMode = async () => {
    try {
      const resp = await fetch('/api/internal/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'maintenance-mode' }),
      });
      if (!resp.ok) throw new Error(`Maintenance status failed (${resp.status})`);
      const { setting_value } = await resp.json();
      const value = setting_value as unknown;
      if (typeof value === 'object' && value !== null && 'enabled' in value && 'message' in value) {
        setMaintenanceMode(value as MaintenanceMode);
      }
    } catch (error) {
      console.error('Error fetching maintenance mode:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMaintenanceMode = async (enabled: boolean, message?: string) => {
    try {
      const newValue = {
        enabled,
        message: message || maintenanceMode.message
      };

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return false;
      const resp = await fetch('/api/internal/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ op: 'maintenance-mode', value: newValue }),
      });
      if (!resp.ok) throw new Error(`Maintenance update failed (${resp.status})`);

      setMaintenanceMode(newValue);
      return true;
    } catch (error) {
      console.error('Error updating maintenance mode:', error);
      return false;
    }
  };

  return {
    maintenanceMode,
    loading,
    updateMaintenanceMode,
    isMaintenanceMode: maintenanceMode.enabled
  };
};
