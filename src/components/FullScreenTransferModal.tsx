import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/api';
import { 
  Upload, Download, CheckCircle2, XCircle, X, RotateCcw, Trash2, 
  Search, Activity, BarChart2, Zap, Wifi, Minimize2
} from 'lucide-react';
import { backgroundUploadService, UploadTask } from '@/services/backgroundUpload';
import { backgroundDownloadService, DownloadTask } from '@/services/backgroundDownload';

const CustomDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Popup>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Popup>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className="z-[70] bg-[#0A0A0A]/90 backdrop-blur-2xl animate-in fade-in duration-300" />
    <DialogPrimitive.Popup
      ref={ref}
      className={cn(
        'fixed inset-4 sm:inset-6 md:inset-10 z-[70] flex flex-col rounded-2xl border border-[rgba(232,231,225,0.14)] bg-[#0b0d0c] text-[#e8e7e1] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] overflow-hidden',
        'animate-in fade-in zoom-in-95 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none',
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Popup>
  </DialogPortal>
));
CustomDialogContent.displayName = 'CustomDialogContent';

interface FullScreenTransferModalProps { isOpen: boolean; onClose: () => void; }
type TabType = 'active' | 'completed' | 'failed' | 'stats';

const formatExactEta = (ms?: number) => {
  if (!ms || ms <= 0) return 'Calculating…';
  const totalSeconds = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins > 0) return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  return `${secs}s`;
};

export const FullScreenTransferModal: React.FC<FullScreenTransferModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  
  const [speedHistory, setSpeedHistory] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [currentSpeedMBps, setCurrentSpeedMBps] = useState(0);
  const [lastBytesSnapshot, setLastBytesSnapshot] = useState({ time: Date.now(), bytes: 0 });

  useEffect(() => {
    const unsubUpload = backgroundUploadService.subscribe(setUploadTasks);
    const unsubDownload = backgroundDownloadService.subscribe(setDownloadTasks);
    return () => { unsubUpload(); unsubDownload(); };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const activeUploads = uploadTasks.filter(t => t.status === 'uploading');
      const activeDownloads = downloadTasks.filter(t => t.status === 'downloading');
      
      const totalTransferred = [
        ...activeUploads.map(t => (t.file.size * (t.progress / 100))),
        ...activeDownloads.map(t => (t.fileSize * (t.progress / 100)))
      ].reduce((acc, val) => acc + val, 0);

      const timeDiffSeconds = (now - lastBytesSnapshot.time) / 1000;
      if (timeDiffSeconds >= 0.8) {
        const bytesDiff = Math.max(0, totalTransferred - lastBytesSnapshot.bytes);
        const speedMBps = Number((bytesDiff / timeDiffSeconds / (1024 * 1024)).toFixed(2));
        
        setCurrentSpeedMBps(speedMBps);
        setSpeedHistory(prev => [...prev.slice(1), speedMBps]);
        setLastBytesSnapshot({ time: now, bytes: totalTransferred });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, uploadTasks, downloadTasks, lastBytesSnapshot]);

  const stats = useMemo(() => {
    const allTasks = [
      ...uploadTasks.map(t => ({ id: t.id, name: t.file.name, size: t.file.size, progress: t.progress, status: t.status, type: 'upload' as const, error: t.error, eta: t.estimatedTimeRemaining })),
      ...downloadTasks.map(t => ({ id: t.id, name: t.fileName, size: t.fileSize, progress: t.progress, status: t.status, type: 'download' as const, error: t.error, eta: undefined }))
    ];

    const active = allTasks.filter(t => t.status === 'uploading' || t.status === 'pending' || t.status === 'downloading');
    const completed = allTasks.filter(t => t.status === 'completed');
    const failed = allTasks.filter(t => t.status === 'failed');

    const totalActiveBytes = active.reduce((acc, t) => acc + t.size, 0);
    const transferredActiveBytes = active.reduce((acc, t) => acc + (t.size * (t.progress / 100)), 0);
    const overallProgress = totalActiveBytes > 0 ? Math.round((transferredActiveBytes / totalActiveBytes) * 100) : 0;
    const maxEtaMs = uploadTasks.reduce((max, t) => Math.max(max, t.estimatedTimeRemaining || 0), 0);

    return { allTasks, active, completed, failed, overallProgress, maxEtaMs };
  }, [uploadTasks, downloadTasks]);

  const filteredTasks = useMemo(() => {
    const list = activeTab === 'active' ? stats.active :
                 activeTab === 'completed' ? stats.completed :
                 activeTab === 'failed' ? stats.failed : [];
    if (!searchTerm.trim()) return list;
    return list.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [activeTab, searchTerm, stats]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <CustomDialogContent>
        {/* HEADER */}
        <header className="flex items-center justify-between px-5 sm:px-8 h-20 bg-[#0b0d0c] border-b border-[rgba(232,231,225,0.09)] shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-[6px] bg-[#e8e7e1] text-[#0b0d0c] flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.01em] text-[#e8e7e1] flex items-center gap-3">
                Transfer Center
                {stats.active.length > 0 && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8d8f89]">
                    {stats.active.length} active
                  </span>
                )}
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8d8f89] mt-1">
                Encrypted client-side pipeline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-9 rounded-[4px] px-3.5 bg-transparent border-[rgba(232,231,225,0.16)] text-[#e8e7e1] hover:bg-[rgba(232,231,225,0.06)] hover:text-[#e8e7e1] font-mono text-[10.5px] uppercase tracking-[0.1em] gap-2 transition-all">
              <Minimize2 className="w-3.5 h-3.5" />
              Minimize
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="h-9 w-9 text-[#8d8f89] hover:text-[#e8e7e1] hover:bg-[rgba(232,231,225,0.07)] rounded-[4px] transition-all">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden bg-[#080908]">
          {/* SIDEBAR */}
          <aside className="w-48 sm:w-64 border-r border-[rgba(232,231,225,0.09)] p-4 sm:p-5 flex flex-col justify-between shrink-0">
            <div className="space-y-1.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8d8f89] mb-3 pl-2">Queues</p>
              
              {[
                { id: 'active', label: 'Active', icon: Upload, count: stats.active.length },
                { id: 'completed', label: 'Completed', icon: CheckCircle2, count: stats.completed.length },
                { id: 'failed', label: 'Failed', icon: XCircle, count: stats.failed.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={cn(
                    "w-full flex items-center justify-between px-3.5 py-3 rounded-[6px] text-[13px] font-medium transition-all",
                    activeTab === tab.id ? "bg-[#e8e7e1] text-[#0b0d0c]" : "text-[#8d8f89] hover:bg-[rgba(232,231,225,0.05)] hover:text-[#e8e7e1]"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <tab.icon className="w-4 h-4" strokeWidth={2.5} />
                    <span>{tab.label}</span>
                  </div>
                  <span className={cn("font-mono text-[11px] tabular-nums", activeTab === tab.id ? "text-[#0b0d0c]/70" : "text-[#8d8f89]")}>
                    {tab.count}
                  </span>
                </button>
              ))}

              <div className="pt-5 pb-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8d8f89] mb-3 pl-2">Telemetry</p>
                <button
                  onClick={() => setActiveTab('stats')}
                  className={cn(
                    "w-full flex items-center justify-between px-3.5 py-3 rounded-[6px] text-[13px] font-medium transition-all",
                    activeTab === 'stats' ? "bg-[#e8e7e1] text-[#0b0d0c]" : "text-[#8d8f89] hover:bg-[rgba(232,231,225,0.05)] hover:text-[#e8e7e1]"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <BarChart2 className="w-4 h-4" strokeWidth={2.5} />
                    <span>Metrics</span>
                  </div>
                  <Zap className={cn("w-3.5 h-3.5", activeTab === 'stats' ? "text-[#0b0d0c]" : "text-[#8d8f89]")} />
                </button>
              </div>
            </div>

            {/* Live Throughput Pill */}
            <div className="p-4 rounded-[6px] bg-[rgba(232,231,225,0.03)] border border-[rgba(232,231,225,0.1)]">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-[#8d8f89] mb-2.5">
                <span className="flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5" />
                  Live speed
                </span>
                <span className="font-medium text-[13px] text-[#e8e7e1] tabular-nums normal-case tracking-normal">{currentSpeedMBps} MB/s</span>
              </div>
              <Progress value={Math.min(100, (currentSpeedMBps / 20) * 100)} className="h-[2px] bg-[rgba(232,231,225,0.12)] [&>div]:bg-[#e8e7e1]" />
            </div>
          </aside>

          {/* MAIN WORKSPACE */}
          <main className="flex-1 flex flex-col overflow-hidden relative">
            {activeTab === 'stats' ? (
              <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-6">
                <div>
                  <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#e8e7e1]">Live metrics</h3>
                  <p className="text-[#8d8f89] mt-1.5 text-[13px]">Streaming throughput and pipeline analysis</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Bandwidth', val: currentSpeedMBps, unit: 'MB/s' },
                    { label: 'Pipeline load', val: stats.overallProgress, unit: '%' },
                    { label: 'ETA', val: formatExactEta(stats.maxEtaMs), unit: '' },
                    { label: 'Total tasks', val: stats.allTasks.length, unit: 'items' },
                  ].map((stat, i) => (
                    <div key={i} className="p-5 rounded-[6px] bg-[rgba(232,231,225,0.03)] border border-[rgba(232,231,225,0.1)] flex flex-col justify-center">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8d8f89] mb-2">{stat.label}</span>
                      <p className="text-2xl font-semibold font-mono tabular-nums text-[#e8e7e1]">
                        {stat.val} <span className="text-[11px] text-[#8d8f89] font-sans">{stat.unit}</span>
                      </p>
                    </div>
                  ))}
                </div>

                <div className="p-6 sm:p-8 rounded-[6px] bg-[rgba(232,231,225,0.02)] border border-[rgba(232,231,225,0.1)]">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="text-[15px] font-semibold text-[#e8e7e1]">Throughput waveform</h4>
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8d8f89] mt-1">10-second snapshot</p>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-400">● Live</span>
                  </div>
                  <div className="h-44 w-full flex items-end gap-2 pt-4 px-4 bg-[#080908] rounded-[4px] border border-[rgba(232,231,225,0.07)]">
                    {speedHistory.map((val, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                        <div 
                          className="w-full bg-[#e8e7e1]/80 rounded-t-[2px] transition-all duration-300" 
                          style={{ height: `${Math.max(4, Math.min(100, (val / 15) * 100))}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Search Bar & Actions */}
                <div className="p-4 sm:p-6 border-b border-[rgba(232,231,225,0.09)] bg-[#0b0d0c] flex items-center justify-between gap-4 shrink-0">
                  <div className="relative max-w-lg w-full">
                    <Search className="w-4 h-4 text-[#8d8f89] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      placeholder={`Search ${activeTab} queue…`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-10 bg-[rgba(232,231,225,0.04)] border-[rgba(232,231,225,0.12)] text-[#e8e7e1] rounded-[4px] placeholder:text-[#8d8f89]/70 focus-visible:ring-1 focus-visible:ring-[#e8e7e1]/40 transition-all text-[13px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {activeTab === 'failed' && stats.failed.length > 0 && (
                      <Button size="sm" onClick={() => backgroundUploadService.retryFailed()} className="bg-[#e8e7e1] text-[#0b0d0c] hover:bg-white font-mono text-[10.5px] uppercase tracking-[0.1em] rounded-[4px] gap-2 h-9 px-3.5">
                        <RotateCcw className="w-3.5 h-3.5" /> Retry all
                      </Button>
                    )}
                    {activeTab === 'completed' && stats.completed.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => { backgroundUploadService.clearCompleted(); backgroundDownloadService.clearCompleted(); }} className="border-[rgba(232,231,225,0.16)] bg-transparent text-[#8d8f89] hover:text-[#e8e7e1] hover:bg-[rgba(232,231,225,0.06)] font-mono text-[10.5px] uppercase tracking-[0.1em] rounded-[4px] gap-2 h-9 px-3.5">
                        <Trash2 className="w-3.5 h-3.5" /> Clear all
                      </Button>
                    )}
                  </div>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                  {filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8d8f89]">Queue is empty</p>
                    </div>
                  ) : (
                    filteredTasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between py-3.5 border-t border-[rgba(232,231,225,0.09)] first:border-t-0 gap-4 group">
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div className={cn("w-9 h-9 rounded-[6px] flex items-center justify-center shrink-0 border",
                            task.status === 'uploading' || task.status === 'downloading' ? "bg-[#e8e7e1] text-[#0b0d0c] border-transparent" :
                            task.status === 'completed' ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-400" :
                            task.status === 'failed' ? "bg-red-400/10 border-red-400/20 text-red-400" : "bg-[rgba(232,231,225,0.04)] border-[rgba(232,231,225,0.12)] text-[#8d8f89]"
                          )}>
                            {task.type === 'upload' ? <Upload className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2.5 mb-1">
                              <span className="text-[13.5px] font-medium tracking-[-0.005em] text-[#e8e7e1] truncate">{task.name}</span>
                              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#8d8f89] pointer-events-none shrink-0">
                                {task.type}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 font-mono text-[10.5px] tabular-nums tracking-wide text-[#8d8f89]">
                              <span>{formatBytes(task.size)}</span>
                              <span className="text-[#8d8f89]/50">·</span>
                              <span className="text-[#e8e7e1] font-medium">{Math.round(task.progress)}%</span>
                              {task.eta !== undefined && task.status === 'uploading' && (
                                <><span className="text-[#8d8f89]/50">·</span><span>{formatExactEta(task.eta)}</span></>
                              )}
                              {task.status === 'failed' && task.error && (
                                <><span className="text-[#8d8f89]/50">·</span><span className="text-red-400/90 truncate">{task.error}</span></>
                              )}
                            </div>
                            {(task.status === 'uploading' || task.status === 'downloading') && (
                              <div className="mt-2 h-[2px] overflow-hidden rounded-full bg-[rgba(232,231,225,0.12)]">
                                <div className="h-full rounded-full bg-[#e8e7e1] transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, task.progress))}%` }} />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {task.type === 'upload' && (
                            <Button variant="ghost" size="icon" onClick={() => backgroundUploadService.removeTask(task.id)} aria-label={`Remove ${task.name}`} className="h-8 w-8 text-[#8d8f89] hover:text-[#e8e7e1] hover:bg-[rgba(232,231,225,0.07)] rounded-[4px] transition-colors">
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </CustomDialogContent>
    </Dialog>
  );
};
