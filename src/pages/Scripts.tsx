import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Loader2, Play, Plus, Trash2, FileCode, Terminal, Pause, History, Settings, Clock, Sparkles, MoreHorizontal, ChevronRight, GitBranch, Copy, Download, Eye, Hash, CheckCircle2, XCircle } from '@/lib/icon-map';
import { listScripts, deleteScript, triggerRun, type SquidScript } from '@/lib/automation-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  running: { icon: Loader2, bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'Running', pulse: true },
  success: { icon: CheckCircle2, bg: 'bg-green-500/10', text: 'text-green-500', label: 'Success' },
  failed: { icon: XCircle, bg: 'bg-red-500/10', text: 'text-red-500', label: 'Failed' },
  idle: { icon: Clock, bg: 'bg-muted/20', text: 'text-muted-foreground/50', label: 'Idle' },
};

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
      setScripts(scripts);
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
      const { run } = await triggerRun(script.id);
      toast({ title: 'Pipeline triggered', description: `Run #${run.id.slice(0, 8)}` });
      await loadScripts();
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
      toast({ title: `"${script.name}" deleted` });
    } catch (e: any) {
      toast({ title: 'Failed to delete', description: e.message, variant: 'destructive' });
    }
  };

  const totalRuns = scripts.reduce((s, sc) => s + (sc.total_runs || 0), 0);
  const runningNow = scripts.filter(s => s.last_run_status === 'running').length;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-border/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-purple-500/10 border border-primary/20 flex items-center justify-center shadow-sm">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">SquidActions</h1>
                <p className="text-sm text-muted-foreground">Automation pipelines for your SquidCloud storage</p>
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/scripts/new')}
            className="flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-purple-600 text-primary-foreground text-sm font-medium hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
            <Plus className="w-4 h-4" />
            New Pipeline
          </button>
        </div>

        {/* ── Stats Bar ── */}
        <div className="flex items-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-lg border border-border/20">
            <FileCode className="w-3.5 h-3.5" />
            <span className="font-medium text-foreground">{scripts.length}</span>
            <span>{scripts.length === 1 ? 'pipeline' : 'pipelines'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-lg border border-border/20">
            <History className="w-3.5 h-3.5" />
            <span className="font-medium text-foreground">{totalRuns}</span>
            <span>total {totalRuns === 1 ? 'run' : 'runs'}</span>
          </div>
          {runningNow > 0 && (
            <div className="flex items-center gap-1.5 text-blue-500 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="font-medium">{runningNow}</span>
              <span>running</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
              <span className="text-sm text-muted-foreground">Loading pipelines...</span>
            </div>
          </div>
        )}

        {!loading && scripts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-10 h-10 text-primary/40" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-1">No pipelines yet</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md text-center">
              Create your first automation pipeline to handle file operations, send notifications, or integrate with external services.
            </p>
            <div className="flex gap-3">
              <button onClick={() => navigate('/scripts/new')}
                className="flex items-center gap-2 h-11 px-6 rounded-xl bg-gradient-to-r from-primary to-purple-600 text-primary-foreground text-sm font-medium hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/20 transition-all">
                <Plus className="w-4 h-4" /> Create Pipeline
              </button>
              <button onClick={() => window.open('/docs/squidactions-ai-skill.md', '_blank')}
                className="flex items-center gap-2 h-11 px-6 rounded-xl bg-card border border-border/30 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                <Sparkles className="w-4 h-4" /> AI Skill Docs
              </button>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4 text-xs text-muted-foreground">
              <div className="text-center p-3 rounded-xl bg-muted/20 border border-border/20">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-1.5">
                  <Play className="w-4 h-4 text-primary" />
                </div>
                Drag & drop components
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/20 border border-border/20">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center mx-auto mb-1.5">
                  <GitBranch className="w-4 h-4 text-green-500" />
                </div>
                Connect with edges
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/20 border border-border/20">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center mx-auto mb-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
                Auto-YAML export
              </div>
            </div>
          </div>
        )}

        {!loading && scripts.length > 0 && (
          <div className="grid gap-3">
            {scripts.map(script => {
              const status = STATUS_CONFIG[script.last_run_status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.idle;
              const StatusIcon = status.icon;
              return (
                <div key={script.id}
                  className="group relative flex items-center gap-4 p-4 rounded-2xl border border-border/20 bg-card/60 hover:bg-card hover:border-border/40 hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => navigate(`/scripts/${script.id}/runs`)}
                >
                  {/* Status indicator bar */}
                  <div className={cn(
                    'absolute left-0 top-2 bottom-2 w-1 rounded-full',
                    script.last_run_status === 'running' ? 'bg-blue-500' :
                    script.last_run_status === 'success' ? 'bg-green-500' :
                    script.last_run_status === 'failed' ? 'bg-red-500' :
                    'bg-border/30'
                  )} />

                  <div className={cn(
                    'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm',
                    status.bg, 'border-' + status.text.replace('text-', '') + '/20'
                  )}>
                    <StatusIcon className={cn('w-6 h-6', status.text, status.pulse && 'animate-spin')} />
                  </div>

                  <div className="flex-1 min-w-0 pl-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{script.name}</p>
                      {script.last_run_status && (
                        <span className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0',
                          status.bg, status.text
                        )}>
                          {status.pulse && <Loader2 className="w-2.5 h-2.5 animate-spin inline mr-1 align-text-bottom" />}
                          {status.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {script.description && (
                        <span className="text-xs text-muted-foreground/70 truncate max-w-[300px]">{script.description}</span>
                      )}
                      {script.total_runs > 0 && (
                        <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1 shrink-0">
                          <Hash className="w-2.5 h-2.5" /> {script.total_runs} {script.total_runs === 1 ? 'run' : 'runs'}
                        </span>
                      )}
                      {script.created_at && (
                        <span className="text-[11px] text-muted-foreground/40 flex items-center gap-1 shrink-0">
                          <Clock className="w-2.5 h-2.5" /> {new Date(script.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Actions ── */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <button onClick={(e) => { e.stopPropagation(); handleTrigger(script); }}
                      disabled={runningId === script.id}
                      className="p-2.5 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                      title="Run pipeline">
                      {runningId === script.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/scripts/${script.id}/edit`); }}
                      className="p-2.5 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit pipeline">
                      <Settings className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(script); }}
                      className="p-2.5 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete pipeline">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 ml-1" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Scripts;
