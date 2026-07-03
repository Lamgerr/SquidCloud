import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertCircle, Activity, Clock, Zap } from '@/lib/icon-map';

interface WebhookUsageData {
  total: number;
  success: number;
  failed: number;
  pending: number;
  today: number;
  thisWeek: number;
  topEvents: { event_name: string; count: number }[];
  recentErrors: { id: string; event_name: string; error_message: string; created_at: string }[];
  hourlyBuckets: { hour: string; count: number }[];
}

export function WebhookUsageChart() {
  const { user } = useAuth();
  const [data, setData] = useState<WebhookUsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadUsage();
  }, [user]);

  const loadUsage = async () => {
    setLoading(true);
    try {
      const { data: logs, error } = await supabase
        .from('webhook_events_log')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const list = logs || [];
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());

      const today = list.filter(l => new Date(l.created_at) >= todayStart).length;
      const thisWeek = list.filter(l => new Date(l.created_at) >= weekStart).length;

      const eventCounts: Record<string, number> = {};
      list.forEach(l => {
        eventCounts[l.event_name] = (eventCounts[l.event_name] || 0) + 1;
      });
      const topEvents = Object.entries(eventCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([event_name, count]) => ({ event_name, count }));

      const recentErrors = list
        .filter(l => l.status === 'failed' && l.error_message)
        .slice(0, 5)
        .map(l => ({
          id: l.id,
          event_name: l.event_name,
          error_message: l.error_message,
          created_at: l.created_at,
        }));

      const hourlyBuckets: Record<string, number> = {};
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      list
        .filter(l => new Date(l.created_at) >= last24h)
        .forEach(l => {
          const h = new Date(l.created_at).getHours().toString().padStart(2, '0') + ':00';
          hourlyBuckets[h] = (hourlyBuckets[h] || 0) + 1;
        });

      setData({
        total: list.length,
        success: list.filter(l => l.status === 'success').length,
        failed: list.filter(l => l.status === 'failed').length,
        pending: list.filter(l => l.status === 'pending').length,
        today,
        thisWeek,
        topEvents,
        recentErrors,
        hourlyBuckets: Object.entries(hourlyBuckets).map(([hour, count]) => ({ hour, count })),
      });
    } catch (e) {
      console.error('Failed to load webhook usage:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#4FC3F7]/20 border-t-[#4FC3F7] rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const maxHourly = Math.max(...data.hourlyBuckets.map(b => b.count), 1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Activity className="w-4 h-4" />} label="Total Dispatches" value={data.total.toLocaleString()} color="text-[#4FC3F7]" />
        <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Successful" value={data.success.toLocaleString()} color="text-emerald-400" />
        <StatCard icon={<XCircle className="w-4 h-4" />} label="Failed" value={data.failed.toLocaleString()} color="text-red-400" />
        <StatCard icon={<Clock className="w-4 h-4" />} label="Today" value={data.today.toLocaleString()} color="text-white/70" />
      </div>

      <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
        <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">24h Activity</h4>
        <div className="flex items-end gap-1 h-20">
          {data.hourlyBuckets.map(b => (
            <div key={b.hour} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-[#4FC3F7]/30 hover:bg-[#4FC3F7]/50 transition-colors"
                style={{ height: `${(b.count / maxHourly) * 100}%`, minHeight: b.count > 0 ? '4px' : '0' }}
              />
              <span className="text-[8px] text-white/30">{b.hour}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
          <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Top Events</h4>
          <div className="space-y-2">
            {data.topEvents.map(e => (
              <div key={e.event_name} className="flex items-center justify-between">
                <span className="text-sm text-white/70 font-mono text-xs">{e.event_name}</span>
                <span className="text-sm text-white/50">{e.count}</span>
              </div>
            ))}
            {data.topEvents.length === 0 && (
              <p className="text-sm text-white/30">No events yet</p>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
          <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Recent Errors</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {data.recentErrors.map(e => (
              <div key={e.id} className="text-xs">
                <span className="text-red-400 font-mono">{e.event_name}</span>
                <p className="text-white/40 truncate">{e.error_message}</p>
              </div>
            ))}
            {data.recentErrors.length === 0 && (
              <p className="text-sm text-white/30">No errors</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={color}>{icon}</span>
        <span className="text-[11px] text-white/50">{label}</span>
      </div>
      <p className={cn('text-lg font-semibold', color)}>{value}</p>
    </div>
  );
}
