import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSignals } from '@/hooks/useSignals';
import { Bell, Check, Inbox, Trash2 } from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const SEVERITY_DOT: Record<string, string> = {
  info: 'bg-sky-400',
  warning: 'bg-amber-400',
  urgent: 'bg-red-500',
};

export function SignalsBell({ className }: { className?: string }) {
  const { user } = useAuth();
  const { signals, unreadCount, timeAgo, markRead, markAllRead, clear } = useSignals(user?.id);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const recent = useMemo(() => signals.slice(0, 20), [signals]);

  const handleItemClick = async (s: (typeof signals)[number]) => {
    if (!s.read_at) {
      void markRead(s.id);
    }
    setOpen(false);
    if (s.link) {
      navigate(s.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={
        <button
          className={cn(
            'relative flex items-center justify-center w-9 h-9 rounded-lg',
            'transition-all duration-150',
            'hover:bg-accent/70',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
            'active:scale-[0.96]',
            'text-muted-foreground hover:text-foreground',
            className
          )}
          aria-label="Signals"
        >
          <Bell className="w-[18px] h-[18px]" />
          {unreadCount > 0 && (
            <span className={cn(
              'absolute -top-0.5 -right-0.5',
              'min-w-[17px] h-[17px] px-1 rounded-full',
              'flex items-center justify-center',
              'bg-red-500 text-white text-[10px] font-bold leading-none',
              unreadCount > 0 && 'animate-in zoom-in-95'
            )}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      } />
      <PopoverContent align="end" sideOffset={8} className="w-[380px] max-w-[calc(100vw-16px)] p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Signals</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => void markAllRead()}
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <Check className="w-3 h-3" />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto divide-y divide-border/40">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Inbox className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No signals yet</p>
            </div>
          ) : (
            recent.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-accent/40',
                  !s.read_at && 'bg-primary/[0.03]'
                )}
                onClick={() => void handleItemClick(s)}
              >
                <span className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', SEVERITY_DOT[s.severity])} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('text-[13px] font-medium truncate', !s.read_at && 'text-foreground')}>
                      {s.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(s.created_at)}</span>
                  </div>
                  {s.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.body}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide">
                    {s.service_id}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void clear(s.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                  aria-label="Clear signal"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border/50 p-2">
          <button
            onClick={() => {
              setOpen(false);
              navigate('/signals');
            }}
            className="w-full py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-primary hover:bg-accent/50 transition-colors"
          >
            View all signals
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
