import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getScript, getRun, getRunLogs, listRuns, triggerRun, type SquidScriptRun, type SquidRunJob } from '@/lib/automation-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { X, Zap, Play, Loader2, Clock, CheckCircle2, XCircle, ChevronRight, RefreshCw, Terminal, ExternalLink, History, ArrowLeft, Maximize, Minimize, Download } from '@/lib/icon-map';

const STATUS_ICONS: Record<string, { icon: React.FC<{ className?: string }>; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pending' },
  running: { icon: Loader2, color: 'text-blue-500', label: 'Running' },
  success: { icon: CheckCircle2, color: 'text-green-500', label: 'Success' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
  cancelled: { icon: XCircle, color: 'text-muted-foreground', label: 'Cancelled' },
};

const RunHistory: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [script, setScript] = useState<any>(null);
  const [runs, setRuns] = useState<SquidScriptRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<SquidScriptRun | null>(null);
  const [jobs, setJobs] = useState<SquidRunJob[]>([]);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const loadScript = useCallback(async () => {
    if (!id) return;
    try {
      const { script } = await getScript(id);
      setScript(script);
    } catch (e: any) {
      toast({ title: 'Failed to load pipeline', description: e.message, variant: 'destructive' });
      navigate('/scripts');
    }
  }, [id, navigate, toast]);

  const loadRuns = useCallback(async () => {
    if (!id) return;
    try {
      const { runs } = await listRuns(id, 50);
      setRuns(runs);
    } catch { }
  }, [id]);

  const selectRun = useCallback(async (run: SquidScriptRun) => {
    setSelectedRun(run);
    try {
      const [runData, logsData] = await Promise.all([
        getRun(run.id),
        getRunLogs(run.id),
      ]);
      setJobs(runData.jobs);
      setLogs(logsData.logs);
    } catch (e: any) {
      toast({ title: 'Failed to load run details', description: e.message, variant: 'destructive' });
    }
  }, [toast]);

  const handleTrigger = useCallback(async () => {
    if (!id) return;
    setTriggering(true);
    try {
      const { run } = await triggerRun(id);
      toast({ title: 'Pipeline triggered', description: `Run #${run.id.slice(0, 8)}` });
      await loadRuns();
      selectRun(run);
    } catch (e: any) {
      toast({ title: 'Failed to trigger', description: e.message, variant: 'destructive' });
    } finally {
      setTriggering(false);
    }
  }, [id, loadRuns, selectRun, toast]);

  const handleDownloadLogs = useCallback(() => {
    if (!logs) return;
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `run-${selectedRun?.id?.slice(0, 8) || 'logs'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs, selectedRun]);

  useEffect(() => { loadScript(); loadRuns(); }, [loadScript, loadRuns]);

  useEffect(() => {
    if (!autoRefresh || !id) return;
    const interval = setInterval(loadRuns, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, id, loadRuns]);

  useEffect(() => {
    if (!autoRefresh || !selectedRun || selectedRun.status !== 'running') return;
    const interval = setInterval(() => selectRun(selectedRun), 2000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedRun, selectRun]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const runStatus = selectedRun ? STATUS_ICONS[selectedRun.status] || STATUS_ICONS.pending : null;
  const StatusIcon = runStatus?.icon || Clock;
  const hasRunning = runs.some(r => r.status === 'running');

  return (
    <div className={cn('flex flex-col', fullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-full')}>
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border/30 bg-card shadow-sm">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={() => navigate('/scripts')} className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-card border border-primary/20 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-foreground truncate">{script?.name || 'Pipeline'}</h1>
              {script?.last_run_status && (
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', (STATUS_ICONS[script.last_run_status]?.color || 'text-muted-foreground'))}>
                  {STATUS_ICONS[script.last_run_status]?.label || script.last_run_status}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground/60 truncate">{runs.length} runs</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setAutoRefresh(!autoRefresh)}
                  className={cn('flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors',
                    autoRefresh ? 'bg-white/[0.08] text-foreground border border-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/20')}>
            <RefreshCw className={cn('w-3.5 h-3.5', autoRefresh && hasRunning && 'animate-spin')} />
            Auto
          </button>
          <button onClick={handleTrigger} disabled={triggering}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 shadow-sm disabled:opacity-50">
            {triggering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run
          </button>
          <button onClick={() => setFullscreen(!fullscreen)}
                  className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20">
            {fullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 shrink-0 border-r border-border/20 bg-card/30 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-foreground" /> Run History
            </span>
            <span className="text-[10px] text-muted-foreground/50">{runs.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {runs.map(run => {
              const st = STATUS_ICONS[run.status] || STATUS_ICONS.pending;
              const Icon = st.icon;
              return (
                <button key={run.id} onClick={() => selectRun(run)}
                        className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/20 transition-colors border-b border-border/10',
                           selectedRun?.id === run.id && 'bg-primary/5 border-l-2 border-l-primary')}>
                  <Icon className={cn('w-4 h-4 shrink-0', st.color, run.status === 'running' && 'animate-spin')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground">{st.label}</span>
                      <span className="text-[10px] text-muted-foreground/50 font-mono">#{run.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                      <span>{run.trigger_type}</span>
                      {run.started_at && <span>{new Date(run.started_at).toLocaleTimeString()}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                </button>
              );
            })}
            {runs.length === 0 && (
              <div className="text-xs text-muted-foreground/50 text-center py-12">
                No runs yet. Click Run to start.
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {selectedRun ? (
            <>
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-border/20 bg-muted/10">
                <div className="flex items-center gap-3">
                  {runStatus && <StatusIcon className={cn('w-4 h-4', runStatus.color, selectedRun.status === 'running' && 'animate-spin')} />}
                  <span className="text-xs font-medium text-foreground">{runStatus?.label || selectedRun.status}</span>
                  {selectedRun.started_at && (
                    <span className="text-[11px] text-muted-foreground/60">
                      Started {new Date(selectedRun.started_at).toLocaleTimeString()}
                      {selectedRun.completed_at && ` · ${((new Date(selectedRun.completed_at).getTime() - new Date(selectedRun.started_at).getTime()) / 1000).toFixed(2)}s`}
                    </span>
                  )}
                  {selectedRun.error_message && (
                    <span className="text-[11px] text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">{selectedRun.error_message}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={handleDownloadLogs}
                          className="flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/20">
                    <Download className="w-3 h-3" /> Logs
                  </button>
                  <span className="text-[10px] text-muted-foreground/40 font-mono">{selectedRun.id.slice(0, 8)}</span>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex">
                <div className="flex-1 overflow-y-auto p-4 bg-[#0d1117] font-mono text-[12px] leading-relaxed">
                  {logs ? (
                    <pre className="text-green-400/90 whitespace-pre-wrap m-0">{logs}</pre>
                  ) : (
                    <span className="text-muted-foreground/40">No logs available</span>
                  )}
                  <div ref={logEndRef} />
                </div>

                <div className="w-56 shrink-0 border-l border-border/20 bg-card/20 flex flex-col">
                  <div className="px-3 py-2 border-b border-border/20 text-[11px] font-medium text-foreground flex items-center gap-1.5">
                    <Terminal className="w-3 h-3 text-foreground" /> Jobs
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {jobs.map(job => {
                      const steps = job.squid_run_steps || [];
                      const jobDone = job.status === 'success' || job.status === 'failed';
                      return (
                        <div key={job.id} className="p-2 rounded-lg bg-card/60 border border-border/20">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {job.status === 'success' ? <CheckCircle2 className="w-3 h-3 text-green-500" /> :
                             job.status === 'running' ? <Loader2 className="w-3 h-3 text-blue-500 animate-spin" /> :
                             job.status === 'failed' ? <XCircle className="w-3 h-3 text-red-500" /> :
                             <Clock className="w-3 h-3 text-muted-foreground" />}
                            <span className="font-medium text-foreground truncate">{job.job_name}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground/50">{steps.length} steps</span>
                          </div>
                          {steps.length > 0 && (
                            <div className="mt-1.5 space-y-0.5 pl-5">
                              {steps.map(step => (
                                <div key={step.id} className="flex items-center gap-1 text-[10px]">
                                  {step.status === 'success' ? <span className="text-green-500">✓</span> :
                                   step.status === 'running' ? <Loader2 className="w-2.5 h-2.5 text-blue-500 animate-spin" /> :
                                   step.status === 'failed' ? <span className="text-red-500">✗</span> :
                                   <span className="text-muted-foreground/40">○</span>}
                                  <span className={cn('truncate',
                                    step.status === 'success' ? 'text-green-400/80' :
                                    step.status === 'failed' ? 'text-red-400/80' :
                                    'text-muted-foreground/70')}>{step.step_name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {jobs.length === 0 && (
                      <div className="text-[11px] text-muted-foreground/50 text-center py-8">No jobs</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Terminal className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground/60">Select a run to view logs</p>
                <p className="text-xs text-muted-foreground/40 mt-1">Or click Run to trigger a new execution</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RunHistory;
