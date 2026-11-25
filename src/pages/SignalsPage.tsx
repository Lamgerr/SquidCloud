import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSignals } from '@/hooks/useSignals';
import { GlassNav, type GlassNavItem } from '@/components/layout/GlassNav';
import { PageFrame } from '@/components/layout/PageFrame';
import { AlertTriangle, Bell, Check, Inbox, Trash2 } from '@/lib/icon-map';
import { cn } from '@/lib/utils';

const SEVERITY_DOT: Record<string, string> = {
  info: 'sg-dot-info',
  warning: 'sg-dot-warning',
  urgent: 'sg-dot-urgent',
};

const SG_CSS = `
.sg-actions{display:flex;justify-content:center;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.sg-act{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;
  border:1px solid var(--sa-line,#1f2221);border-radius:8px;background:transparent;
  color:var(--sa-mute,#8d8f89);font:400 12px/1 var(--sa-f,-apple-system,sans-serif);cursor:pointer}
.sg-act:hover{color:var(--sa-text,#e8e7e1);background:var(--sa-bg-2,#0e1110)}
.sg-act svg{width:14px;height:14px}
.sg-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
  padding:72px 0;text-align:center;border:1px solid var(--sa-line,#1f2221);border-radius:16px}
.sg-empty>svg{width:40px;height:40px;color:var(--sa-dim,#62655f)}
.sg-empty-t{margin:0;font-size:13px;color:var(--sa-mute,#8d8f89)}
.sg-empty-s{margin:4px 0 0;font-size:11px;color:var(--sa-dim,#62655f)}
.sg-list{border:1px solid var(--sa-line,#1f2221);border-radius:16px;overflow:hidden}
.sg-row{position:relative;display:flex;align-items:flex-start;gap:12px;padding:16px;
  cursor:pointer;border-bottom:1px solid var(--sa-line,#1f2221)}
.sg-row:last-child{border-bottom:0}
.sg-row:hover{background:var(--sa-bg-2,#0e1110)}
.sg-row-unread{background:var(--sa-bg-2,#0e1110)}
.sg-dot{width:7px;height:7px;border-radius:50%;flex:none;margin-top:6px}
.sg-dot-info{background:var(--sa-dim,#62655f)}
.sg-dot-warning{background:var(--sa-mute,#8d8f89)}
.sg-dot-urgent{background:var(--sa-text,#e8e7e1)}
.sg-main{min-width:0;flex:1}
.sg-line{display:flex;align-items:center;justify-content:space-between;gap:12px}
.sg-title{margin:0;font-size:13px;font-weight:400;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;color:var(--sa-text,#e8e7e1)}
.sg-title-read{color:var(--sa-mute,#8d8f89)}
.sg-time{font-size:11px;color:var(--sa-dim,#62655f);flex:none}
.sg-body{margin:4px 0 0;font-size:11px;line-height:1.5;color:var(--sa-mute,#8d8f89);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sg-tags{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap}
.sg-tag{padding:2px 6px;border-radius:5px;background:var(--sa-bg-3,#141816);
  color:var(--sa-mute,#8d8f89);font:400 10px/1.3 var(--sa-f,-apple-system,sans-serif);
  text-transform:uppercase;letter-spacing:.04em}
.sg-tag-urgent{color:var(--sa-text,#e8e7e1)}
.sg-clear{opacity:0;align-self:center;padding:6px;border:0;border-radius:8px;
  background:transparent;color:var(--sa-mute,#8d8f89);cursor:pointer;transition:opacity .18s}
.sg-row:hover .sg-clear,.sg-clear:focus-visible{opacity:1}
.sg-clear:hover{color:var(--sa-text,#e8e7e1);background:var(--sa-bg-3,#141816)}
.sg-clear svg{width:15px;height:15px}
`;

type Tab = 'all' | 'unread' | 'urgent';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <Inbox /> },
  { id: 'unread', label: 'Unread', icon: <Bell /> },
  { id: 'urgent', label: 'Urgent', icon: <AlertTriangle /> },
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

  const navItems: GlassNavItem[] = TABS.map((t) => ({
    key: t.id,
    label: t.label,
    icon: t.icon,
    active: tab === t.id,
    onClick: () => setTab(t.id),
  }));

  return (
    <PageFrame
      title="Signals"
      subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'You\'re all caught up'}
      items={navItems}
      layoutId="signals-tabs"
    >
      <style>{SG_CSS}</style>
      <div className="sg-actions">
        {unreadCount > 0 && (
          <button
            onClick={() => void markAllRead()}
            className="sg-act"
          >
            <Check />
            Mark all read
          </button>
        )}
        {signals.length > 0 && (
          <button
            onClick={() => void clearAll()}
            className="sg-act"
          >
            <Trash2 />
            Clear all
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="sg-empty">
          <Inbox />
          <div>
            <p className="sg-empty-t">No signals here</p>
            <p className="sg-empty-s">
              {tab === 'all' ? 'Signals from CloudBliss and SquidVeil will appear here.' : 'Nothing matches this filter.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="sg-list">
          {filtered.map((s) => (
            <div
              key={s.id}
              className={cn('sg-row', !s.read_at && 'sg-row-unread')}
              onClick={() => void handleItemClick(s)}
            >
              <span className={cn('sg-dot', SEVERITY_DOT[s.severity])} />
              <div className="sg-main">
                <div className="sg-line">
                  <p className={cn('sg-title', !s.read_at ? '' : 'sg-title-read')}>
                    {s.title}
                  </p>
                  <span className="sg-time">{timeAgo(s.created_at)}</span>
                </div>
                {s.body && <p className="sg-body">{s.body}</p>}
                <div className="sg-tags">
                  <span className="sg-tag">{s.service_id}</span>
                  <span className="sg-tag">{s.type.replace(/_/g, ' ')}</span>
                  {s.severity === 'urgent' && (
                    <span className="sg-tag sg-tag-urgent">urgent</span>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void clear(s.id);
                }}
                className="sg-clear"
                aria-label="Clear signal"
              >
                <Trash2 />
              </button>
            </div>
          ))}
        </div>
      )}
    </PageFrame>
  );
}
