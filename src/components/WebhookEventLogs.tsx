import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, AlertCircle, Search } from '@/lib/icon-map';
import { formatDistanceToNow } from 'date-fns';

interface WebhookEvent {
  id: string;
  webhook_id: string;
  event_name: string;
  payload: any;
  status: 'pending' | 'success' | 'failed';
  response_status: number | null;
  error_message: string | null;
  created_at: string;
}

export function WebhookEventLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (!user) return;
    loadLogs();
  }, [user, page, statusFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('webhook_events_log')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data || []) as WebhookEvent[]);
    } catch (e) {
      console.error('Failed to load webhook logs:', e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = logs.filter(l =>
    !search || l.event_name.toLowerCase().includes(search.toLowerCase()) ||
    l.error_message?.toLowerCase().includes(search.toLowerCase())
  );

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'failed': return <XCircle className="w-3.5 h-3.5 text-red-400" />;
      default: return <Clock className="w-3.5 h-3.5 text-yellow-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 placeholder:text-white/30 outline-none focus:border-[#4FC3F7]/40 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 outline-none focus:border-[#4FC3F7]/40 transition-colors"
        >
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#4FC3F7]/20 border-t-[#4FC3F7] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-8 h-8 text-white/20 mb-2" />
          <p className="text-sm text-white/50">No webhook events found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => (
            <div key={log.id} className="flex items-start gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5">
              <div className="shrink-0 mt-0.5">{statusIcon(log.status)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="text-[10px] font-mono bg-[#4FC3F7]/10 text-[#4FC3F7] border-[#4FC3F7]/20">{log.event_name}</Badge>
                  <Badge className={cn(
                    'text-[10px]',
                    log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    log.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
                  )}>
                    {log.status}
                  </Badge>
                  {log.response_status && (
                    <span className="text-[10px] text-white/30 font-mono">{log.response_status}</span>
                  )}
                </div>
                {log.error_message && (
                  <p className="text-xs text-red-400/70 mb-1">{log.error_message}</p>
                )}
                <p className="text-[10px] text-white/30">
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/50 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="text-xs text-white/30">Page {page + 1}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={filtered.length < PAGE_SIZE}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/50 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
