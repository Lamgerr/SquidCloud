import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Loader2, Play, Plus, Trash2, Pencil, History, Clock, Workflow, ChevronRight } from '@/lib/icon-map';
import { listScripts, deleteScript, triggerRun, type SquidScript } from '@/lib/automation-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center h-7 w-7 rounded-md bg-foreground shrink-0">
              <Workflow className="h-4 w-4 text-background" />
            </div>
            <h1 className="text-[15px] font-semibold tracking-tight text-foreground truncate">SquidActions</h1>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {scripts.length} pipelines · {totalRuns} runs
            </span>
          </div>
          <button
            onClick={() => navigate('/scripts/new')}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <Plus className="h-4 w-4" />
            New pipeline
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="space-y-px p-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 rounded-md bg-muted/20 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && scripts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 px-6">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl border border-border/60 bg-muted/20 mb-4">
              <Zap className="h-5 w-5 text-neutral-500" />
            </div>
            <p className="text-[15px] font-medium text-foreground mb-1">No pipelines yet</p>
            <p className="text-[13px] text-muted-foreground text-center max-w-sm mb-6 leading-relaxed">
              Automate your storage — move files, send notifications, and run workflows when events happen.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/scripts/new')}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-[13px] font-medium text-background hover:bg-foreground/90 transition-colors"
              >
                <Plus className="h-4 w-4" /> New pipeline
              </button>
              <button
                onClick={() => window.open('/docs/squidactions-ai-skill.md', '_blank')}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                Documentation
              </button>
            </div>
          </div>
        )}

        {!loading && scripts.length > 0 && (
          <div className="p-4">
            <div className="rounded-lg border border-border/50 overflow-hidden divide-y divide-border/40">
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
                    className="group flex items-center gap-3 px-4 h-14 hover:bg-accent/40 cursor-pointer outline-none focus-visible:bg-accent/40 transition-colors"
                  >
                    {/* status dot */}
                    <span className="relative flex h-2 w-2 shrink-0">
                      {isRunning && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-40" />
                      )}
                      <span className={cn(
                        'relative inline-flex rounded-full h-2 w-2',
                        isRunning ? 'bg-foreground'
                          : isFailed ? 'bg-red-500'
                          : script.last_run_status === 'success' ? 'bg-neutral-300'
                          : 'bg-neutral-600'
                      )} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-foreground truncate">{script.name}</p>
                        {!script.is_active && (
                          <span className="text-[10px] px-1.5 py-px rounded bg-muted text-muted-foreground">paused</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                        {script.description && <span className="truncate max-w-[320px]">{script.description}</span>}
                        {script.description && <span className="text-neutral-700">·</span>}
                        <span className="tabular-nums shrink-0">{script.total_runs || 0} runs</span>
                        <span className="text-neutral-700">·</span>
                        <span className="shrink-0">{relTime(script.last_run_at)}</span>
                      </div>
                    </div>

                    {/* actions */}
                    <div
                      className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleTrigger(script)}
                        disabled={runningId === script.id}
                        title="Run now"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 transition-colors"
                      >
                        {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => navigate(`/scripts/${script.id}/edit`)}
                        title="Edit"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(script)}
                        title="Delete"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <History
                      className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-end">
              <button
                onClick={() => navigate('/run-history')}
                className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="h-3.5 w-3.5" />
                Full run history
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Scripts;
