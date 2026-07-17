import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/api';
import { 
  Upload, Download, CheckCircle, XCircle, Clock, X, Pause, Play, 
  RotateCcw, Trash2, Search, Activity, BarChart2, Zap, Wifi, Minimize2
} from '@/lib/icon-map';
import { backgroundUploadService, UploadTask } from '@/services/backgroundUpload';
import { backgroundDownloadService, DownloadTask } from '@/services/backgroundDownload';

const CustomDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Popup>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Popup>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className="z-[70] bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200" />
    <DialogPrimitive.Popup
      ref={ref}
      className={cn(
        'fixed inset-0 z-[70] flex flex-col w-screen h-screen max-w-none rounded-none border-0 bg-[#0a0a0f] text-foreground shadow-2xl overflow-hidden',
        'animate-in fade-in zoom-in-98 duration-200 ease-out focus:outline-none',
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Popup>
  </DialogPortal>
));
CustomDialogContent.displayName = 'CustomDialogContent';

interface FullScreenTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'active' | 'completed' | 'failed' | 'stats';

const formatExactEta = (ms?: number) => {
  if (!ms || ms <= 0) return 'Calculating\u2026';
  const totalSeconds = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins > 0) return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  return `${secs}s`;
};

export const FullScreenTransferModal: React.FC<FullScreenTransferModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  
  // Real-time Network Bandwidth Telemetry (in Megabytes per second)
  const [speedHistory, setSpeedHistory] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [currentSpeedMBps, setCurrentSpeedMBps] = useState(0);
  const [lastBytesSnapshot, setLastBytesSnapshot] = useState<{ time: number; bytes: number }>({ time: Date.now(), bytes: 0 });

  // Subscribe to both background engines
  useEffect(() => {
    const unsubUpload = backgroundUploadService.subscribe((tasks) => setUploadTasks(tasks));
    const unsubDownload = backgroundDownloadService.subscribe((tasks) => setDownloadTasks(tasks));
    return () => {
      unsubUpload();
      unsubDownload();
    };
  }, []);

  // Calculate real-time throughput velocity in MB/s
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const activeUploads = uploadTasks.filter(t => t.status === 'uploading');
      const activeDownloads = downloadTasks.filter(t => t.status === 'downloading');
      
      const totalTransferredBytes = [
        ...activeUploads.map(t => (t.file.size * (t.progress / 100))),
        ...activeDownloads.map(t => (t.fileSize * (t.progress / 100)))
      ].reduce((acc, val) => acc + val, 0);

      const timeDiffSeconds = (now - lastBytesSnapshot.time) / 1000;
      if (timeDiffSeconds >= 0.8) {
        const bytesDiff = Math.max(0, totalTransferredBytes - lastBytesSnapshot.bytes);
        const speedMBps = Number((bytesDiff / timeDiffSeconds / (1024 * 1024)).toFixed(2));
        
        setCurrentSpeedMBps(speedMBps);
        setSpeedHistory(prev => [...prev.slice(1), speedMBps]);
        setLastBytesSnapshot({ time: now, bytes: totalTransferredBytes });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, uploadTasks, downloadTasks, lastBytesSnapshot]);

  // Aggregate telemetry
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
    
    // Calculate aggregate ETA
    const maxEtaMs = uploadTasks.reduce((max, t) => Math.max(max, t.estimatedTimeRemaining || 0), 0);

    return { allTasks, active, completed, failed, overallProgress, maxEtaMs };
  }, [uploadTasks, downloadTasks]);

  // Filter tasks based on active tab and search input
  const filteredTasks = useMemo(() => {
    const list = activeTab === 'active' ? stats.active :
                 activeTab === 'completed' ? stats.completed :
                 activeTab === 'failed' ? stats.failed : [];

    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(t => t.name.toLowerCase().includes(term));
  }, [activeTab, searchTerm, stats]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <CustomDialogContent className="select-none">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between px-6 h-16 bg-[#13131a] border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                Transfer Center
                {stats.active.length > 0 && (
                  <Badge className="bg-white/10 text-white font-mono text-xs border-0">
                    {stats.active.length} ACTIVE
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-neutral-500 font-mono">
                Encrypted Client-Side Zero-Knowledge Stream
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-9 px-3.5 bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white gap-2 font-medium"
            >
              <Minimize2 className="w-4 h-4" />
              Minimize
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-xl"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Workspace Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar Categories */}
          <aside className="w-64 bg-[#101017] border-r border-neutral-800/80 p-4 flex flex-col justify-between shrink-0">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider px-3 mb-2">
                Queues
              </p>
              
              <button
                onClick={() => setActiveTab('active')}
                className={cn(
                  "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all",
                  activeTab === 'active' ? "bg-white text-black shadow-lg" : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Upload className="w-4 h-4" />
                  <span>Active</span>
                </div>
                <Badge variant="secondary" className={cn(
                  "font-mono text-[11px]",
                  activeTab === 'active' ? "bg-black/10 text-black" : "bg-black/30 text-neutral-400"
                )}>
                  {stats.active.length}
                </Badge>
              </button>

              <button
                onClick={() => setActiveTab('completed')}
                className={cn(
                  "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all",
                  activeTab === 'completed' ? "bg-white text-black shadow-lg" : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>Completed</span>
                </div>
                <Badge variant="secondary" className={cn(
                  "font-mono text-[11px]",
                  activeTab === 'completed' ? "bg-black/10 text-black" : "bg-black/30 text-neutral-400"
                )}>
                  {stats.completed.length}
                </Badge>
              </button>

              <button
                onClick={() => setActiveTab('failed')}
                className={cn(
                  "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all",
                  activeTab === 'failed' ? "bg-white text-black shadow-lg" : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <XCircle className="w-4 h-4" />
                  <span>Failed</span>
                </div>
                <Badge variant="secondary" className={cn(
                  "font-mono text-[11px]",
                  activeTab === 'failed' ? "bg-black/10 text-black" : "bg-black/30 text-neutral-400"
                )}>
                  {stats.failed.length}
                </Badge>
              </button>

              <div className="pt-4 pb-1">
                <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider px-3 mb-2">
                  Telemetry
                </p>
                <button
                  onClick={() => setActiveTab('stats')}
                  className={cn(
                    "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all",
                    activeTab === 'stats' ? "bg-white text-black shadow-lg" : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <BarChart2 className="w-4 h-4" />
                    <span>Metrics</span>
                  </div>
                  <Zap className="w-3.5 h-3.5 text-neutral-500" />
                </button>
              </div>
            </div>

            {/* Live Throughput Pill */}
            <div className="p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-500 font-mono">
                <span className="flex items-center gap-1.5 text-white/70 font-medium">
                  <Wifi className="w-3.5 h-3.5" />
                  Speed
                </span>
                <span className="font-bold text-white">{currentSpeedMBps} MB/s</span>
              </div>
              <Progress value={Math.min(100, (currentSpeedMBps / 20) * 100)} className="h-1.5 bg-neutral-950" />
            </div>
          </aside>

          {/* Main Workspace Frame */}
          <main className="flex-1 bg-[#0a0a0f] flex flex-col overflow-hidden">
            {activeTab === 'stats' ? (
              /* REALTIME STATS DASHBOARD */
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white">Live Metrics</h3>
                  <p className="text-xs text-neutral-500 font-mono">Streaming throughput metrics in MB/s</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-5 rounded-2xl bg-[#13131a] border border-neutral-800 space-y-1">
                    <span className="text-xs text-neutral-500 font-medium">Bandwidth</span>
                    <p className="text-2xl font-bold font-mono text-white">{currentSpeedMBps} <span className="text-xs text-neutral-600">MB/s</span></p>
                  </div>
                  <div className="p-5 rounded-2xl bg-[#13131a] border border-neutral-800 space-y-1">
                    <span className="text-xs text-neutral-500 font-medium">Pipeline Load</span>
                    <p className="text-2xl font-bold font-mono text-white">{stats.overallProgress}%</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-[#13131a] border border-neutral-800 space-y-1">
                    <span className="text-xs text-neutral-500 font-medium">ETA</span>
                    <p className="text-lg font-bold font-mono text-white/80 truncate">{formatExactEta(stats.maxEtaMs)}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-[#13131a] border border-neutral-800 space-y-1">
                    <span className="text-xs text-neutral-500 font-medium">Total Tasks</span>
                    <p className="text-2xl font-bold font-mono text-white">{stats.allTasks.length} <span className="text-xs text-neutral-600">items</span></p>
                  </div>
                </div>

                {/* Bandwidth Velocity Sparkline */}
                <div className="p-6 rounded-2xl bg-[#13131a] border border-neutral-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Throughput Waveform</h4>
                      <p className="text-xs text-neutral-500 font-mono">10-second streaming snapshots</p>
                    </div>
                    <Badge variant="outline" className="border-white/20 text-white/60 bg-white/5 font-mono text-xs">
                      LIVE
                    </Badge>
                  </div>

                  <div className="h-36 w-full flex items-end gap-2 pt-4 px-2 bg-black/40 rounded-xl border border-neutral-800/60">
                    {speedHistory.map((val, idx) => {
                      const heightPct = Math.max(8, Math.min(100, (val / 15) * 100));
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group">
                          <div 
                            className="w-full bg-gradient-to-t from-neutral-600 to-white/70 rounded-t transition-all duration-300 group-hover:brightness-125" 
                            style={{ height: `${heightPct}%` }}
                          />
                          <span className="text-[10px] font-mono text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            {val}MB
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* FILE LIST QUEUE VIEW */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Search Bar & Global Actions Header */}
                <div className="p-4 border-b border-neutral-800 bg-[#13131a]/50 flex items-center justify-between gap-4">
                  <div className="relative max-w-md w-full">
                    <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      placeholder={`Search ${activeTab} transfers\u2026`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-10 bg-neutral-950 border-neutral-800 text-sm rounded-xl placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {activeTab === 'failed' && stats.failed.length > 0 && (
                      <Button
                        size="sm"
                        onClick={() => backgroundUploadService.retryFailed()}
                        className="bg-white text-black hover:bg-white/90 font-medium gap-1.5 h-9"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Retry All
                      </Button>
                    )}
                    {activeTab === 'completed' && stats.completed.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          backgroundUploadService.clearCompleted();
                          backgroundDownloadService.clearCompleted();
                        }}
                        className="border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white gap-1.5 h-9"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear All
                      </Button>
                    )}
                  </div>
                </div>

                {/* Virtualized / Scrollable File Table */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center text-neutral-600">
                      <Activity className="w-10 h-10 stroke-1 mb-2 opacity-40" />
                      <p className="text-sm font-medium">No transfers found</p>
                    </div>
                  ) : (
                    filteredTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-[#13131a] border border-neutral-800/80 hover:border-neutral-700 transition-colors gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                            task.status === 'uploading' || task.status === 'downloading' ? "bg-white/5 border-white/10 text-white" :
                            task.status === 'completed' ? "bg-white/5 border-white/10 text-white/60" :
                            task.status === 'failed' ? "bg-white/5 border-white/10 text-white/40" : "bg-neutral-800 border-neutral-700 text-neutral-400"
                          )}>
                            {task.type === 'upload' ? <Upload className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-white/90 truncate">{task.name}</span>
                              <Badge variant="secondary" className="bg-neutral-900 border border-neutral-800 text-[10px] font-mono uppercase text-neutral-500">
                                {task.type}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-neutral-500 font-mono">
                              <span>{formatBytes(task.size)}</span>
                              <span>\u2022</span>
                              <span className="text-white/70 font-medium">{Math.round(task.progress)}%</span>
                              {task.eta !== undefined && task.status === 'uploading' && (
                                <>
                                  <span>\u2022</span>
                                  <span className="text-white/60">{formatExactEta(task.eta)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Smooth Track Bar */}
                        <div className="w-48 hidden sm:block shrink-0">
                          <Progress value={task.progress} className="h-2 bg-neutral-950" />
                        </div>

                        {/* Task Actions */}
                        <div className="flex items-center gap-1">
                          {task.type === 'upload' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => backgroundUploadService.removeTask(task.id)}
                              className="h-8 w-8 text-neutral-600 hover:text-white hover:bg-neutral-800 rounded-lg"
                            >
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
