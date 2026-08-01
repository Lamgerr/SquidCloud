import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSignals } from '@/hooks/useSignals';
import { Bell, Check, Inbox, Trash2 } from '@/lib/icon-map';
import { cn } from '@/lib/utils';

const SEVERITY_DOT: Record<string, string> = {
  info: 'bg-sky-400',
  warning: 'bg-amber-400',
  urgent: 'bg-red-500',
};

type Tab = 'all' | 'unread' | 'urgent';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'urgent', label: 'Urgent' },
];

export default function SignalsPage() {
  const { user } = useAuth();
  const { signals, unreadCount, timeAgo, markRead, markAllRead, clear, clearAll } = useSignals(user?.id);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('all');

  const filtered = useMemo(() => {
    if (tab === 'unread') return signals.filter((s) => !s.read_at);
    if (tab === 'urgent') return signals.filter((s) => s.severity === 'urgent');
    return signals;
  }, [signals, tab]);

  const handleItemClick = async (s: (typeof signals)[number]) => {
    if (!s.read_at) void markRead(s.id);
    if (s.link) navigate(s.link);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 md:py-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Signals</h1>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : 'You\'re all caught up'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-primary hover:bg-accent/50 border border-border/50 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            {signals.length > 0 && (
              <button
                onClick={() => void clearAll()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 border border-red-500/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear all
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/40 mb-4 w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-medium transition-all',
                tab === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground/80'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center border border-dashed border-border/50 rounded-2xl">
            <Inbox className="w-10 h-10 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">No signals here</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {tab === 'all' ? 'Signals from CloudBliss and SquidVeil will appear here.' : 'Nothing matches this filter.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="border border-border/50 rounded-2xl overflow-hidden divide-y divide-border/40 bg-card/30">
            {filtered.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'group relative flex items-start gap-3 px-4 py-4 cursor-pointer transition-colors hover:bg-accent/40',
                  !s.read_at && 'bg-primary/[0.03]'
                )}
                onClick={() => void handleItemClick(s)}
              >
                <span className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', SEVERITY_DOT[s.severity])} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className={cn('text-sm font-medium truncate', !s.read_at ? 'text-foreground' : 'text-muted-foreground')}>
                      {s.title}
                    </p>
                    <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(s.created_at)}</span>
                  </div>
                  {s.body && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.body}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {s.service_id}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {s.type.replace(/_/g, ' ')}
                    </span>
                    {s.severity === 'urgent' && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-500">
                        urgent
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void clear(s.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 self-center"
                  aria-label="Clear signal"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
