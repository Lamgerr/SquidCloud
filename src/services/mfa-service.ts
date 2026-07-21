import { supabase } from '@/integrations/supabase/client';

export interface MfaFactor {
  id: string;
  friendly_name: string;
  factor_type: 'totp' | 'phone';
  status: 'unverified' | 'verified';
  created_at: string;
}

export interface MfaEnrollment {
  id: string;
  type: string;
  totp: {
    qr_code: string;
    secret: string;
    uri: string;
  };
  friendly_name: string;
}

export interface AalLevel {
  currentLevel: 'aal1' | 'aal2';
  nextLevel: 'aal1' | 'aal2';
}

class MfaService {
  async getAalLevel(): Promise<AalLevel | null> {
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) {
        console.error('Error getting AAL level:', error);
        return null;
      }
      return {
        currentLevel: data.currentLevel as 'aal1' | 'aal2',
        nextLevel: data.nextLevel as 'aal1' | 'aal2',
      };
    } catch (error) {
      console.error('Error getting AAL level:', error);
      return null;
    }
  }

  async listFactors(): Promise<MfaFactor[]> {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        console.error('Error listing MFA factors:', error);
        return [];
      }
      return (data.totp || []).map((f: any) => ({
        id: f.id,
        friendly_name: f.friendly_name || '',
        factor_type: f.factor_type as 'totp',
        status: f.status as 'unverified' | 'verified',
        created_at: f.created_at,
      }));
    } catch (error) {
      console.error('Error listing MFA factors:', error);
      return [];
    }
  }

  async enroll(friendlyName?: string): Promise<MfaEnrollment | null> {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: friendlyName || 'CloudBliss TOTP',
      });
      if (error) {
        console.error('Error enrolling MFA:', error);
        return null;
      }
      return data as unknown as MfaEnrollment;
    } catch (error) {
      console.error('Error enrolling MFA:', error);
      return null;
    }
  }

  async challenge(factorId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.auth.mfa.challenge({ factorId });
      if (error) {
        console.error('Error creating MFA challenge:', error);
        return null;
      }
      return data.id;
    } catch (error) {
      console.error('Error creating MFA challenge:', error);
      return null;
    }
  }

  async verify(factorId: string, challengeId: string, code: string): Promise<boolean> {
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });
      if (error) {
        console.error('Error verifying MFA code:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error verifying MFA code:', error);
      return false;
    }
  }

  async unenroll(factorId: string): Promise<boolean> {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        console.error('Error unenrolling MFA:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error unenrolling MFA:', error);
      return false;
    }
  }

  async challengeAndVerify(factorId: string, code: string): Promise<boolean> {
    const challengeId = await this.challenge(factorId);
    if (!challengeId) return false;
    return this.verify(factorId, challengeId, code);
  }
}

export const mfaService = new MfaService();
