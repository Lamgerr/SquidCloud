import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getScript, getRun, getRunLogs, listRuns, triggerRun, type SquidScriptRun, type SquidRunJob } from '@/lib/automation-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { X, Zap, Play, Loader2, Clock, Check, Circle, CheckCircle2, XCircle, ChevronRight, RefreshCw, Terminal, History, ArrowLeft, Maximize, Minimize, Download } from '@/lib/icon-map';

const RHI_CSS = `
.rhi-root{display:flex;flex-direction:column;background:var(--sa-bg,#090b0a);color:var(--sa-text,#e8e7e1)}
.rhi-fs{position:fixed;inset:0;z-index:50}
.rhi-inline{height:100%}
.rhi-head{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:12px 20px;border-bottom:1px solid var(--sa-line,#1f2221)}
.rhi-head-left{display:flex;align-items:center;gap:12px;min-width:0;flex:1}
.rhi-back,.rhi-icon-btn{display:grid;place-items:center;width:30px;height:30px;flex:none;
  border:0;border-radius:8px;background:transparent;color:var(--sa-mute,#8d8f89);cursor:pointer}
.rhi-back:hover,.rhi-icon-btn:hover{color:var(--sa-text,#e8e7e1);background:var(--sa-bg-2,#0e1110)}
.rhi-back svg,.rhi-icon-btn svg{width:15px;height:15px}
.rhi-mark{display:grid;place-items:center;width:32px;height:32px;flex:none;
  border:1px solid var(--sa-line,#1f2221);border-radius:8px;
  background:var(--sa-bg-2,#0e1110);color:var(--sa-text,#e8e7e1)}
.rhi-mark svg{width:15px;height:15px}
.rhi-title-wrap{min-width:0;flex:1}
.rhi-title-row{display:flex;align-items:center;gap:8px}
.rhi-title{margin:0;font-size:13px;font-weight:400;color:var(--sa-text,#e8e7e1);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rhi-pill{padding:2px 8px;border-radius:999px;background:var(--sa-bg-3,#141816);
  color:var(--sa-mute,#8d8f89);font:400 10px/1.4 var(--sa-f,-apple-system,sans-serif)}
.rhi-runs{margin:2px 0 0;font-size:11px;color:var(--sa-dim,#62655f)}
.rhi-actions{display:flex;align-items:center;gap:6px;flex:none}
.rhi-act{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;
  border:1px solid var(--sa-line,#1f2221);border-radius:8px;background:transparent;
  color:var(--sa-mute,#8d8f89);font:400 11px/1 var(--sa-f,-apple-system,sans-serif);cursor:pointer}
.rhi-act:hover{color:var(--sa-text,#e8e7e1);background:var(--sa-bg-2,#0e1110)}
.rhi-act-on{color:var(--sa-text,#e8e7e1);background:var(--sa-bg-3,#141816)}
.rhi-act-run{background:var(--sa-bg-3,#141816);color:var(--sa-text,#e8e7e1);padding:0 14px}
.rhi-act:disabled{opacity:.5}
.rhi-act svg{width:14px;height:14px}
.rhi-spin{animation:rhi-rotate 1s linear infinite}
@keyframes rhi-rotate{to{transform:rotate(360deg)}}
.rhi-body{display:flex;flex:1;min-height:0}
.rhi-side{width:264px;flex:none;display:flex;flex-direction:column;
  border-right:1px solid var(--sa-line,#1f2221)}
.rhi-side-head{display:flex;align-items:center;justify-content:space-between;
  padding:10px 16px;border-bottom:1px solid var(--sa-line,#1f2221);
  font-size:11px;color:var(--sa-text,#e8e7e1)}
.rhi-side-head span{display:flex;align-items:center;gap:6px}
.rhi-side-head svg{width:14px;height:14px}
.rhi-side-count{font-size:10px;color:var(--sa-dim,#62655f)}
.rhi-side-list{flex:1;overflow-y:auto}
.rhi-run-row{display:flex;align-items:center;gap:10px;width:100%;padding:10px 16px;
  text-align:left;border:0;border-bottom:1px solid var(--sa-line,#1f2221);
  background:transparent;color:var(--sa-text,#e8e7e1);cursor:pointer}
.rhi-run-row:hover{background:var(--sa-bg-2,#0e1110)}
.rhi-run-row-active{background:var(--sa-bg-3,#141816);box-shadow:inset 2px 0 0 var(--sa-text,#e8e7e1)}
.rhi-run-row>svg:first-child{width:14px;height:14px;flex:none}
.rhi-run-main{flex:1;min-width:0}
.rhi-run-line{display:flex;align-items:center;gap:6px}
.rhi-run-label{font-size:11px;font-weight:400;color:var(--sa-text,#e8e7e1)}
.rhi-run-id{font:400 10px/1 var(--sa-mono,monospace);color:var(--sa-dim,#62655f)}
.rhi-run-meta{display:flex;gap:8px;font-size:10px;color:var(--sa-dim,#62655f);margin-top:2px}
.rhi-chev{width:12px;height:12px;color:var(--sa-dim,#62655f);flex:none}
.rhi-none{padding:48px 12px;text-align:center;font-size:11px;color:var(--sa-dim,#62655f)}
.rhi-main{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0}
.rhi-det-head{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:10px 20px;border-bottom:1px solid var(--sa-line,#1f2221);background:var(--sa-bg-2,#0e1110)}
.rhi-det-left{display:flex;align-items:center;gap:12px;min-width:0;flex-wrap:wrap}
.rhi-det-left>svg{width:14px;height:14px;flex:none}
.rhi-det-status{font-size:11px;font-weight:400;color:var(--sa-text,#e8e7e1)}
.rhi-det-time{font-size:11px;color:var(--sa-dim,#62655f)}
.rhi-error{padding:2px 8px;border-radius:999px;background:var(--sa-bg-3,#141816);
  color:var(--sa-mute,#8d8f89);font-size:11px}
.rhi-det-right{display:flex;align-items:center;gap:10px;flex:none}
.rhi-det-right button{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 8px;
  border:0;border-radius:6px;background:transparent;color:var(--sa-mute,#8d8f89);
  font:400 11px/1 var(--sa-f,-apple-system,sans-serif);cursor:pointer}
.rhi-det-right button:hover{color:var(--sa-text,#e8e7e1);background:var(--sa-bg-3,#141816)}
.rhi-det-right button svg{width:12px;height:12px}
.rhi-det-id{font:400 10px/1 var(--sa-mono,monospace);color:var(--sa-dim,#62655f)}
.rhi-split{display:flex;flex:1;min-height:0}
.rhi-logs{flex:1;min-width:0;overflow:auto;padding:16px;background:var(--sa-bg,#090b0a);
  font:400 12px/1.7 var(--sa-mono,monospace);color:var(--sa-mute,#8d8f89)}
.rhi-logs pre{margin:0;white-space:pre-wrap;color:var(--sa-mute,#8d8f89)}
.rhi-jobs{width:224px;flex:none;display:flex;flex-direction:column;
  border-left:1px solid var(--sa-line,#1f2221)}
.rhi-jobs-head{display:flex;align-items:center;gap:6px;padding:8px 12px;
  border-bottom:1px solid var(--sa-line,#1f2221);font-size:11px;color:var(--sa-text,#e8e7e1)}
.rhi-jobs-head svg{width:12px;height:12px}
.rhi-jobs-list{flex:1;overflow-y:auto;padding:8px;display:grid;gap:6px;align-content:start}
.rhi-job{padding:8px;border:1px solid var(--sa-line,#1f2221);border-radius:8px;background:var(--sa-bg-2,#0e1110)}
.rhi-job-head{display:flex;align-items:center;gap:6px;font-size:11px}
.rhi-job-head svg{width:12px;height:12px;flex:none}
.rhi-job-name{font-weight:400;color:var(--sa-text,#e8e7e1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rhi-job-steps{margin-left:auto;font-size:10px;color:var(--sa-dim,#62655f)}
.rhi-steps{margin-top:6px;padding-left:20px;display:grid;gap:2px}
.rhi-step{display:flex;align-items:center;gap:4px;font-size:10px}
.rhi-step svg{width:11px;height:11px;flex:none}
.rhi-step-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--sa-mute,#8d8f89)}
.rhi-empty{flex:1;display:grid;place-items:center;text-align:center}
.rhi-empty svg{width:44px;height:44px;color:var(--sa-dim,#62655f);margin:0 auto 12px}
.rhi-empty p{margin:0;font-size:13px;color:var(--sa-mute,#8d8f89)}
.rhi-empty small{display:block;margin-top:4px;font-size:11px;color:var(--sa-dim,#62655f)}
.rhi-ok,.rhi-run{color:var(--sa-text,#e8e7e1)}
.rhi-bad{color:var(--sa-mute,#8d8f89)}
.rhi-idle{color:var(--sa-dim,#62655f)}
.rhi-step-ok,.rhi-step-run{color:var(--sa-text,#e8e7e1)}
.rhi-step-bad{color:var(--sa-mute,#8d8f89)}
.rhi-step-idle{color:var(--sa-dim,#62655f)}
@media(max-width:900px){.rhi-side{width:200px}.rhi-jobs{width:180px}}
@media(prefers-reduced-motion:reduce){.rhi-spin{animation:none}}
`;

const STATUS_ICONS: Record<string, { icon: React.FC<{ className?: string }>; color: string; label: string }> = {
  pending: { icon: Clock, color: 'rhi-idle', label: 'Pending' },
  running: { icon: Loader2, color: 'rhi-run', label: 'Running' },
  success: { icon: CheckCircle2, color: 'rhi-ok', label: 'Success' },
  failed: { icon: XCircle, color: 'rhi-bad', label: 'Failed' },
  cancelled: { icon: XCircle, color: 'rhi-idle', label: 'Cancelled' },
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
    <div className={cn('rhi-root', fullscreen ? 'rhi-fs' : 'rhi-inline')}>
      <style>{RHI_CSS}</style>
      <div className="rhi-head">
        <div className="rhi-head-left">
          <button onClick={() => navigate('/scripts')} className="rhi-back" aria-label="Back to pipelines">
            <ArrowLeft />
          </button>
          <div className="rhi-mark"><Zap /></div>
          <div className="rhi-title-wrap">
            <div className="rhi-title-row">
              <h1 className="rhi-title">{script?.name || 'Pipeline'}</h1>
              {script?.last_run_status && (
                <span className={cn('rhi-pill', STATUS_ICONS[script.last_run_status]?.color || 'rhi-idle')}>
                  {STATUS_ICONS[script.last_run_status]?.label || script.last_run_status}
                </span>
              )}
            </div>
            <p className="rhi-runs">{runs.length} runs</p>
          </div>
        </div>
        <div className="rhi-actions">
          <button onClick={() => setAutoRefresh(!autoRefresh)}
                  className={cn('rhi-act', autoRefresh && 'rhi-act-on')}>
            <RefreshCw className={cn(autoRefresh && hasRunning && 'rhi-spin')} />
            Auto
          </button>
          <button onClick={handleTrigger} disabled={triggering}
                  className="rhi-act rhi-act-run">
            {triggering ? <Loader2 className="rhi-spin" /> : <Play />}
            Run
          </button>
          <button onClick={() => setFullscreen(!fullscreen)}
                  className="rhi-icon-btn" aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {fullscreen ? <Minimize /> : <Maximize />}
          </button>
        </div>
      </div>

      <div className="rhi-body">
        <div className="rhi-side">
          <div className="rhi-side-head">
            <span><History /> Run History</span>
            <span className="rhi-side-count">{runs.length}</span>
          </div>
          <div className="rhi-side-list">
            {runs.map(run => {
              const st = STATUS_ICONS[run.status] || STATUS_ICONS.pending;
              const Icon = st.icon;
              return (
                <button key={run.id} onClick={() => selectRun(run)}
                        className={cn('rhi-run-row', selectedRun?.id === run.id && 'rhi-run-row-active')}>
                  <Icon className={cn(st.color, run.status === 'running' && 'rhi-spin')} />
                  <div className="rhi-run-main">
                    <div className="rhi-run-line">
                      <span className="rhi-run-label">{st.label}</span>
                      <span className="rhi-run-id">#{run.id.slice(0, 8)}</span>
                    </div>
                    <div className="rhi-run-meta">
                      <span>{run.trigger_type}</span>
                      {run.started_at && <span>{new Date(run.started_at).toLocaleTimeString()}</span>}
                    </div>
                  </div>
                  <ChevronRight className="rhi-chev" />
                </button>
              );
            })}
            {runs.length === 0 && (
              <div className="rhi-none">No runs yet. Click Run to start.</div>
            )}
          </div>
        </div>

        <div className="rhi-main">
          {selectedRun ? (
            <>
              <div className="rhi-det-head">
                <div className="rhi-det-left">
                  {runStatus && <StatusIcon className={cn(runStatus.color, selectedRun.status === 'running' && 'rhi-spin')} />}
                  <span className="rhi-det-status">{runStatus?.label || selectedRun.status}</span>
                  {selectedRun.started_at && (
                    <span className="rhi-det-time">
                      Started {new Date(selectedRun.started_at).toLocaleTimeString()}
                      {selectedRun.completed_at && ` · ${((new Date(selectedRun.completed_at).getTime() - new Date(selectedRun.started_at).getTime()) / 1000).toFixed(2)}s`}
                    </span>
                  )}
                  {selectedRun.error_message && (
                    <span className="rhi-error">{selectedRun.error_message}</span>
                  )}
                </div>
                <div className="rhi-det-right">
                  <button onClick={handleDownloadLogs}>
                    <Download /> Logs
                  </button>
                  <span className="rhi-det-id">{selectedRun.id.slice(0, 8)}</span>
                </div>
              </div>

              <div className="rhi-split">
                <div className="rhi-logs">
                  {logs ? (
                    <pre>{logs}</pre>
                  ) : (
                    <span>No logs available</span>
                  )}
                  <div ref={logEndRef} />
                </div>

                <div className="rhi-jobs">
                  <div className="rhi-jobs-head"><Terminal /> Jobs</div>
                  <div className="rhi-jobs-list">
                    {jobs.map(job => {
                      const steps = job.squid_run_steps || [];
                      const jobDone = job.status === 'success' || job.status === 'failed';
                      return (
                        <div key={job.id} className="rhi-job">
                          <div className="rhi-job-head">
                            {job.status === 'success' ? <Check className="rhi-step-ok" /> :
                             job.status === 'running' ? <Loader2 className="rhi-step-run rhi-spin" /> :
                             job.status === 'failed' ? <X className="rhi-step-bad" /> :
                             <Clock className="rhi-step-idle" />}
                            <span className="rhi-job-name">{job.job_name}</span>
                            <span className="rhi-job-steps">{steps.length} steps</span>
                          </div>
                          {steps.length > 0 && (
                            <div className="rhi-steps">
                              {steps.map(step => (
                                <div key={step.id} className="rhi-step">
                                  {step.status === 'success' ? <Check className="rhi-step-ok" /> :
                                   step.status === 'running' ? <Loader2 className="rhi-step-run rhi-spin" /> :
                                   step.status === 'failed' ? <X className="rhi-step-bad" /> :
                                   <Circle className="rhi-step-idle" />}
                                  <span className={cn('rhi-step-name',
                                    step.status === 'success' ? 'rhi-step-ok' :
                                    step.status === 'failed' ? 'rhi-step-bad' :
                                    'rhi-step-idle')}>{step.step_name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {jobs.length === 0 && (
                      <div className="rhi-none">No jobs</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rhi-empty">
              <div>
                <Terminal />
                <p>Select a run to view logs</p>
                <small>Or click Run to trigger a new execution</small>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RunHistory;
