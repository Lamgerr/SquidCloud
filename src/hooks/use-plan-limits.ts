import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlanLimitsData {
  tier: string;
  /** files/day; null = unlimited */
  dailyUploadLimit: number | null;
  uploadsUsedToday: number;
  /** bytes; null = unlimited */
  maxFileBytes: number | null;
  /** concurrent uploads; null = unlimited */
  concurrentUploads: number | null;
  /** api calls/day; null = unlimited */
  apiDaily: number | null;
  apiUsedToday: number;
}

const numOrNull = (v: unknown): number | null => {
  if (typeof v !== 'number' || Number.isNaN(v)) return null;
  if (v < 0) return null; // -1 means unlimited
  return v;
};

/** Live plan + daily usage for the "Today" strip. Null-safe: unknown renders as "—". */
export function usePlanLimits() {
  const [limits, setLimits] = useState<PlanLimitsData | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !alive) return;
        const [{ data: plan }, { data: credits }] = await Promise.all([
          supabase.rpc('get_user_plan_limits', { user_id: user.id }),
          supabase.from('api_credits').select('credits_used_today, daily_limit').eq('user_id', user.id).maybeSingle(),
        ]);
        if (!alive) return;
        const p: any = plan || {};
        const c: any = credits || {};
        setLimits({
          tier: p.tier || 'free',
          dailyUploadLimit: numOrNull(p.daily_upload_limit),
          uploadsUsedToday: typeof p.uploads_used_today === 'number' ? p.uploads_used_today : 0,
          maxFileBytes: numOrNull(p.max_file_size_bytes),
          concurrentUploads: numOrNull(p.concurrent_uploads),
          apiDaily: numOrNull(c.daily_limit),
          apiUsedToday: typeof c.credits_used_today === 'number' ? c.credits_used_today : 0,
        });
      } catch {
        if (alive) setLimits(null);
      }
    })();
    return () => { alive = false; };
  }, []);

  return limits;
}
