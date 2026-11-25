import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageFrame } from '@/components/layout/PageFrame';
import { Zap, Loader2, Play, Plus, Trash2, Pencil, History, ChevronRight } from '@/lib/icon-map';
import { listScripts, deleteScript, triggerRun, type SquidScript } from '@/lib/automation-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const SC_CSS = `
.sc-actions{display:flex;justify-content:center;margin-bottom:20px}
.sc-new{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 14px;
  border:1px solid var(--sa-line,#1f2221);border-radius:8px;
  background:var(--sa-bg-2,#0e1110);color:var(--sa-text,#e8e7e1);
  font:400 12px/1 var(--sa-f,-apple-system,sans-serif);cursor:pointer}
.sc-new:hover{background:var(--sa-bg-3,#141816)}
.sc-new svg{width:15px;height:15px}
.sc-skeleton{padding:16px;display:grid;gap:1px}
.sc-skeleton>div{height:56px;border-radius:8px;background:var(--sa-bg-2,#0e1110);animation:sc-pulse 1.4s ease-in-out infinite}
@keyframes sc-pulse{0%,100%{opacity:1}50%{opacity:.45}}
.sc-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:88px 24px;text-align:center}
.sc-empty-mark{display:grid;place-items:center;width:48px;height:48px;margin-bottom:16px;
  border:1px solid var(--sa-line,#1f2221);border-radius:12px;color:var(--sa-mute,#8d8f89)}
.sc-empty-mark svg{width:20px;height:20px}
.sc-empty-t{margin:0 0 4px;font-size:14px;font-weight:400;color:var(--sa-text,#e8e7e1)}
.sc-empty-s{margin:0 0 24px;max-width:380px;font-size:12px;line-height:1.6;color:var(--sa-mute,#8d8f89)}
.sc-empty-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
.sc-docs{display:inline-flex;align-items:center;height:34px;padding:0 14px;
  border:1px solid var(--sa-line,#1f2221);border-radius:8px;background:transparent;
  color:var(--sa-mute,#8d8f89);font:400 12px/1 var(--sa-f,-apple-system,sans-serif);cursor:pointer}
.sc-docs:hover{color:var(--sa-text,#e8e7e1);background:var(--sa-bg-2,#0e1110)}
.sc-list{border:1px solid var(--sa-line,#1f2221);border-radius:14px;overflow:hidden}
.sc-row{display:flex;align-items:center;gap:12px;padding:0 16px;height:56px;
  border-bottom:1px solid var(--sa-line,#1f2221);cursor:pointer;outline:none}
.sc-row:last-child{border-bottom:0}
.sc-row:hover,.sc-row:focus-visible{background:var(--sa-bg-2,#0e1110)}
.sc-dot{position:relative;display:inline-flex;width:8px;height:8px;flex:none}
.sc-ping{position:absolute;inset:0;border-radius:50%;background:var(--sa-text,#e8e7e1);opacity:.35;animation:sc-ping 1.6s cubic-bezier(0,0,.2,1) infinite}
@keyframes sc-ping{0%{transform:scale(1);opacity:.35}75%,100%{transform:scale(2);opacity:0}}
.sc-dot-core{position:relative;display:inline-flex;width:8px;height:8px;border-radius:50%}
.sc-dot-running{background:var(--sa-text,#e8e7e1)}
.sc-dot-failed{background:var(--sa-mute,#8d8f89)}
.sc-dot-success{background:var(--sa-mute,#8d8f89)}
.sc-dot-idle{background:var(--sa-dim,#62655f)}
.sc-main{min-width:0;flex:1}
.sc-name{display:flex;align-items:center;gap:8px}
.sc-name p{margin:0;font-size:13px;font-weight:400;color:var(--sa-text,#e8e7e1);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-paused{padding:1px 5px;border-radius:5px;background:var(--sa-bg-3,#141816);
  color:var(--sa-dim,#62655f);font:400 10px/1.4 var(--sa-f,-apple-system,sans-serif)}
.sc-meta{display:flex;align-items:center;gap:6px;margin-top:3px;
  font-size:11px;color:var(--sa-mute,#8d8f89)}
.sc-desc{min-width:0;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-sep{color:var(--sa-dim,#62655f)}
.sc-actions-row{display:flex;align-items:center;gap:2px;opacity:0;transition:opacity .18s}
.sc-row:hover .sc-actions-row,.sc-actions-row:focus-within{opacity:1}
.sc-icon-btn{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:7px;
  background:transparent;color:var(--sa-mute,#8d8f89);cursor:pointer}
.sc-icon-btn:hover{color:var(--sa-text,#e8e7e1);background:var(--sa-bg-3,#141816)}
.sc-icon-btn:disabled{opacity:.4}
.sc-icon-btn svg{width:15px;height:15px}
.sc-spin{animation:sc-rotate 1s linear infinite}
@keyframes sc-rotate{to{transform:rotate(360deg)}}
.sc-history{width:14px;height:14px;color:var(--sa-dim,#62655f);opacity:0;
  transition:opacity .18s;flex:none}
.sc-row:hover .sc-history{opacity:1}
.sc-foot{display:flex;justify-content:flex-end;margin-top:12px}
.sc-foot button{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;
  color:var(--sa-mute,#8d8f89);font:400 12px/1 var(--sa-f,-apple-system,sans-serif);cursor:pointer}
.sc-foot button:hover{color:var(--sa-text,#e8e7e1)}
.sc-foot svg{width:14px;height:14px}
@media(prefers-reduced-motion:reduce){.sc-skeleton>div,.sc-ping,.sc-spin{animation:none}}
`;

function relTime(iso?: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const Scripts: React.FC = () => {
  const [scripts, setScripts] = useState<SquidScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const loadScripts = async () => {
    setLoading(true);
    try {
      const { scripts } = await listScripts();
      setScripts(scripts ?? []);
    } catch (e: any) {
      toast({ title: 'Failed to load pipelines', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadScripts(); }, []);

  const handleTrigger = async (script: SquidScript) => {
    setRunningId(script.id);
    try {
      await triggerRun(script.id);
      toast({ title: 'Pipeline triggered' });
      setTimeout(loadScripts, 600);
    } catch (e: any) {
      toast({ title: 'Failed to trigger', description: e.message, variant: 'destructive' });
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (script: SquidScript) => {
    try {
      await deleteScript(script.id);
      setScripts(prev => prev.filter(s => s.id !== script.id));
      toast({ title: 'Pipeline deleted' });
    } catch (e: any) {
      toast({ title: 'Failed to delete', description: e.message, variant: 'destructive' });
    }
  };

  const totalRuns = scripts.reduce((s, sc) => s + (sc.total_runs || 0), 0);

  return (
    <PageFrame
      title="SquidActions"
      subtitle={`${scripts.length} pipelines · ${totalRuns} runs`}
      wide
    >
      <style>{SC_CSS}</style>
      <div className="sc-actions">
        <button
          onClick={() => navigate('/scripts/new')}
          className="sc-new"
        >
          <Plus />
          New pipeline
        </button>
      </div>

      {loading && (
        <div className="sc-skeleton">
          {[...Array(4)].map((_, i) => (
            <div key={i} />
          ))}
        </div>
      )}

      {!loading && scripts.length === 0 && (
        <div className="sc-empty">
          <div className="sc-empty-mark"><Zap /></div>
          <p className="sc-empty-t">No pipelines yet</p>
          <p className="sc-empty-s">
            Automate your storage — move files, send notifications, and run workflows when events happen.
          </p>
          <div className="sc-empty-actions">
            <button
              onClick={() => navigate('/scripts/new')}
              className="sc-new"
            >
              <Plus /> New pipeline
            </button>
            <button
              onClick={() => window.open('/docs/squidactions-ai-skill.md', '_blank')}
              className="sc-docs"
            >
              Documentation
            </button>
          </div>
        </div>
      )}

      {!loading && scripts.length > 0 && (
        <>
          <div className="sc-list">
            {scripts.map((script) => {
              const isRunning = script.last_run_status === 'running' || runningId === script.id;
              const isFailed = script.last_run_status === 'failed';
              return (
                <div
                  key={script.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/scripts/${script.id}/runs`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/scripts/${script.id}/runs`)}
                  className="sc-row"
                >
                  <span className="sc-dot">
                    {isRunning && <span className="sc-ping" />}
                    <span className={cn(
                      'sc-dot-core',
                      isRunning ? 'sc-dot-running'
                        : isFailed ? 'sc-dot-failed'
                        : script.last_run_status === 'success' ? 'sc-dot-success'
                        : 'sc-dot-idle'
                    )} />
                  </span>

                  <div className="sc-main">
                    <div className="sc-name">
                      <p>{script.name}</p>
                      {!script.is_active && (
                        <span className="sc-paused">paused</span>
                      )}
                    </div>
                    <div className="sc-meta">
                      {script.description && <span className="sc-desc">{script.description}</span>}
                      {script.description && <span className="sc-sep">·</span>}
                      <span>{script.total_runs || 0} runs</span>
                      <span className="sc-sep">·</span>
                      <span>{relTime(script.last_run_at)}</span>
                    </div>
                  </div>

                  <div
                    className="sc-actions-row"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleTrigger(script)}
                      disabled={runningId === script.id}
                      title="Run now"
                      className="sc-icon-btn"
                    >
                      {isRunning ? <Loader2 className="sc-spin" /> : <Play />}
                    </button>
                    <button
                      onClick={() => navigate(`/scripts/${script.id}/edit`)}
                      title="Edit"
                      className="sc-icon-btn"
                    >
                      <Pencil />
                    </button>
                    <button
                      onClick={() => handleDelete(script)}
                      title="Delete"
                      className="sc-icon-btn"
                    >
                      <Trash2 />
                    </button>
                  </div>

                  <History className="sc-history" />
                </div>
              );
            })}
          </div>

          <div className="sc-foot">
            <button
              onClick={() => navigate('/run-history')}
            >
              <History />
              Full run history
              <ChevronRight />
            </button>
          </div>
        </>
      )}
    </PageFrame>
  );
};

export default Scripts;
