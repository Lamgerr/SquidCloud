import { supabase } from '@/integrations/supabase/client';
import logger from '@/lib/secureLogger';

export type SecurityOperation =
  | 'open_vault'
  | 'create_share'
  | 'revoke_share'
  | 'view_security_settings'
  | 'app_startup'
  | 'delete_files'
  | 'export_data';

export interface BiometricSettings {
  biometricEnabled: boolean;
  requireOnStartup: boolean;
  requireForShares: boolean;
  requireForSettings: boolean;
  requireForVault: boolean;
  timeoutMinutes: number;
  lastAuth: string | null;
  lockedUntil: string | null;
  attempts: number;
}

class BiometricAuthService {
  private settingsCache: Map<string, { settings: BiometricSettings | null; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5000;

  async getSettings(userId: string): Promise<BiometricSettings | null> {
    try {
      const cached = this.settingsCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.settings;
      }

      const { data, error } = await supabase
        .from('user_security_settings' as any)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        this.settingsCache.set(userId, { settings: null, timestamp: Date.now() });
        return null;
      }

      const d = data as any;
      const settings: BiometricSettings = {
        biometricEnabled: d.biometric_enabled ?? false,
        requireOnStartup: d.require_pin_on_startup ?? false,
        requireForShares: d.require_pin_for_shares ?? true,
        requireForSettings: d.require_pin_for_settings ?? true,
        requireForVault: d.require_pin_for_vault ?? true,
        timeoutMinutes: d.pin_timeout ?? 5,
        lastAuth: d.last_pin_auth,
        lockedUntil: d.pin_locked_until,
        attempts: d.pin_attempts ?? 0,
      };

      this.settingsCache.set(userId, { settings, timestamp: Date.now() });
      return settings;
    } catch (error) {
      logger.errorWithContext('getSettings', error);
      return null;
    }
  }

  async hasBiometric(userId: string): Promise<boolean> {
    try {
      const settings = await this.getSettings(userId);
      return settings?.biometricEnabled ?? false;
    } catch (error) {
      logger.errorWithContext('hasBiometric', error);
      return false;
    }
  }

  async requiresAuth(userId: string, operation: SecurityOperation): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('requires_pin_auth' as any, {
          user_id_param: userId,
          operation_type: operation
        });

      if (error) {
        logger.errorWithContext('requiresAuth', error);
        return true;
      }

      return data as boolean;
    } catch (error) {
      logger.errorWithContext('requiresAuth', error);
      return true;
    }
  }

  async enableBiometric(userId: string, options?: Partial<BiometricSettings>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_security_settings' as any)
        .upsert({
          user_id: userId,
          pin_enabled: true,
          biometric_enabled: true,
          require_pin_on_startup: options?.requireOnStartup ?? false,
          require_pin_for_shares: options?.requireForShares ?? true,
          require_pin_for_settings: options?.requireForSettings ?? true,
          require_pin_for_vault: options?.requireForVault ?? true,
          pin_timeout: options?.timeoutMinutes ?? 5,
          pin_attempts: 0,
          pin_locked_until: null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        logger.errorWithContext('enableBiometric', error);
        return false;
      }

      this.settingsCache.delete(userId);
      return true;
    } catch (error) {
      logger.errorWithContext('enableBiometric', error);
      return false;
    }
  }

  async disableBiometric(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_security_settings' as any)
        .update({ pin_enabled: false, biometric_enabled: false })
        .eq('user_id', userId);

      if (error) {
        logger.errorWithContext('disableBiometric', error);
        return false;
      }

      this.settingsCache.delete(userId);
      return true;
    } catch (error) {
      logger.errorWithContext('disableBiometric', error);
      return false;
    }
  }

  async updateSettings(userId: string, settings: Partial<BiometricSettings>): Promise<boolean> {
    try {
      const updates: any = {};
      if (settings.requireOnStartup !== undefined) updates.require_pin_on_startup = settings.requireOnStartup;
      if (settings.requireForShares !== undefined) updates.require_pin_for_shares = settings.requireForShares;
      if (settings.requireForSettings !== undefined) updates.require_pin_for_settings = settings.requireForSettings;
      if (settings.requireForVault !== undefined) updates.require_pin_for_vault = settings.requireForVault;
      if (settings.timeoutMinutes !== undefined) updates.pin_timeout = settings.timeoutMinutes;

      const { error } = await supabase
        .from('user_security_settings' as any)
        .update(updates)
        .eq('user_id', userId);

      if (error) {
        logger.errorWithContext('updateSettings', error);
        return false;
      }

      this.settingsCache.delete(userId);
      return true;
    } catch (error) {
      logger.errorWithContext('updateSettings', error);
      return false;
    }
  }

  async markStartupAuth(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('mark_app_startup_auth' as any, {
        user_id_param: userId,
      });

      if (error) {
        logger.errorWithContext('markStartupAuth', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.errorWithContext('markStartupAuth', error);
      return false;
    }
  }

  private clearCache(userId: string): void {
    this.settingsCache.delete(userId);
  }
}

export const biometricAuthService = new BiometricAuthService();
export default biometricAuthService;
