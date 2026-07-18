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
        'fixed inset-6 md:inset-10 z-[70] flex flex-col rounded-[2.5rem] border border-zinc-800 bg-[#121212] text-white shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] overflow-hidden',
        'animate-in fade-in zoom-in-95 duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus:outline-none',
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
        <header className="flex items-center justify-between px-8 h-20 bg-[#121212] border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center shadow-sm">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
                Transfer Center
                {stats.active.length > 0 && (
                  <Badge className="bg-zinc-800 text-white font-mono text-xs uppercase border-0 px-2.5 py-0.5 rounded-full">
                    {stats.active.length} ACTIVE
                  </Badge>
                )}
              </h2>
              <p className="text-sm text-zinc-500 font-medium mt-0.5">
                Encrypted Client-Side Pipeline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={onClose} className="h-10 rounded-xl px-4 bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 font-semibold gap-2 transition-all">
              <Minimize2 className="w-4 h-4" />
              Minimize
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-all">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden bg-[#0A0A0A]">
          {/* SIDEBAR */}
          <aside className="w-72 border-r border-zinc-800/80 p-6 flex flex-col justify-between shrink-0">
            <div className="space-y-2">
              <p className="text-xs font-bold text-zinc-600 uppercase tracking-wider mb-4 pl-2">Queues</p>
              
              {[
                { id: 'active', label: 'Active', icon: Upload, count: stats.active.length },
                { id: 'completed', label: 'Completed', icon: CheckCircle2, count: stats.completed.length },
                { id: 'failed', label: 'Failed', icon: XCircle, count: stats.failed.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all",
                    activeTab === tab.id ? "bg-white text-black shadow-[0_10px_20px_-10px_rgba(255,255,255,0.2)]" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <tab.icon className="w-5 h-5" strokeWidth={2.5} />
                    <span>{tab.label}</span>
                  </div>
                  <Badge variant="secondary" className={cn("font-mono text-xs rounded-full px-2", activeTab === tab.id ? "bg-black/10 text-black" : "bg-zinc-800 text-zinc-400")}>
                    {tab.count}
                  </Badge>
                </button>
              ))}

              <div className="pt-6 pb-2">
                <p className="text-xs font-bold text-zinc-600 uppercase tracking-wider mb-4 pl-2">Telemetry</p>
                <button
                  onClick={() => setActiveTab('stats')}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all",
                    activeTab === 'stats' ? "bg-white text-black shadow-[0_10px_20px_-10px_rgba(255,255,255,0.2)]" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <BarChart2 className="w-5 h-5" strokeWidth={2.5} />
                    <span>Metrics</span>
                  </div>
                  <Zap className={cn("w-4 h-4", activeTab === 'stats' ? "text-black" : "text-zinc-600")} />
                </button>
              </div>
            </div>

            {/* Live Throughput Pill */}
            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
              <div className="flex items-center justify-between text-xs text-zinc-400 font-medium mb-3">
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <Wifi className="w-4 h-4" />
                  Live Speed
                </span>
                <span className="font-bold text-white text-sm font-mono">{currentSpeedMBps} MB/s</span>
              </div>
              <Progress value={Math.min(100, (currentSpeedMBps / 20) * 100)} className="h-2 bg-zinc-950 [&>div]:bg-white" />
            </div>
          </aside>

          {/* MAIN WORKSPACE */}
          <main className="flex-1 flex flex-col overflow-hidden relative">
            {activeTab === 'stats' ? (
              <div className="flex-1 overflow-y-auto p-10 space-y-8">
                <div>
                  <h3 className="text-3xl font-bold text-white tracking-tight">Live Metrics</h3>
                  <p className="text-zinc-400 mt-2">Streaming throughput and pipeline analysis</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Bandwidth', val: currentSpeedMBps, unit: 'MB/s' },
                    { label: 'Pipeline Load', val: stats.overallProgress, unit: '%' },
                    { label: 'ETA', val: formatExactEta(stats.maxEtaMs), unit: '' },
                    { label: 'Total Tasks', val: stats.allTasks.length, unit: 'items' },
                  ].map((stat, i) => (
                    <div key={i} className="p-6 rounded-[2rem] bg-[#121212] border border-zinc-800 shadow-xl flex flex-col justify-center">
                      <span className="text-sm font-semibold text-zinc-500 mb-2">{stat.label}</span>
                      <p className="text-3xl font-bold font-mono text-white">
                        {stat.val} <span className="text-sm text-zinc-600 font-sans">{stat.unit}</span>
                      </p>
                    </div>
                  ))}
                </div>

                <div className="p-8 rounded-[2.5rem] bg-[#121212] border border-zinc-800 shadow-xl">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h4 className="text-lg font-bold text-white">Throughput Waveform</h4>
                      <p className="text-sm text-zinc-500 mt-1">10-second historical snapshot</p>
                    </div>
                    <Badge className="bg-white text-black font-bold uppercase tracking-wider px-3 py-1 rounded-full border-0">LIVE</Badge>
                  </div>
                  <div className="h-48 w-full flex items-end gap-3 pt-4 px-4 bg-[#0A0A0A] rounded-[1.5rem] border border-zinc-800/60">
                    {speedHistory.map((val, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                        <div 
                          className="w-full bg-white rounded-t-lg transition-all duration-300" 
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
                <div className="p-6 border-b border-zinc-800/80 bg-[#121212] flex items-center justify-between gap-6 shrink-0">
                  <div className="relative max-w-lg w-full">
                    <Search className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      placeholder={`Search ${activeTab} queue…`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-12 h-12 bg-zinc-900 border-zinc-800 text-white rounded-2xl placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-white transition-all shadow-inner"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    {activeTab === 'failed' && stats.failed.length > 0 && (
                      <Button size="lg" onClick={() => backgroundUploadService.retryFailed()} className="bg-white text-black hover:bg-zinc-200 font-bold rounded-xl gap-2 shadow-lg">
                        <RotateCcw className="w-4 h-4" /> Retry All
                      </Button>
                    )}
                    {activeTab === 'completed' && stats.completed.length > 0 && (
                      <Button size="lg" variant="outline" onClick={() => { backgroundUploadService.clearCompleted(); backgroundDownloadService.clearCompleted(); }} className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl gap-2 shadow-lg">
                        <Trash2 className="w-4 h-4" /> Clear All
                      </Button>
                    )}
                  </div>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                  {filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-zinc-600">
                      <div className="w-20 h-20 bg-zinc-900 rounded-[2rem] flex items-center justify-center mb-6">
                        <Activity className="w-10 h-10 text-zinc-700" />
                      </div>
                      <p className="text-lg font-bold text-zinc-500">Queue is empty</p>
                    </div>
                  ) : (
                    filteredTasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-4 rounded-2xl bg-[#121212] border border-zinc-800 hover:border-zinc-700 transition-colors shadow-sm gap-6 group">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
                            task.status === 'uploading' || task.status === 'downloading' ? "bg-white text-black border-transparent" :
                            task.status === 'completed' ? "bg-zinc-800 border-zinc-700 text-zinc-400" :
                            task.status === 'failed' ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                          )}>
                            {task.type === 'upload' ? <Upload className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-base font-bold text-white truncate">{task.name}</span>
                              <Badge className="bg-zinc-800 text-zinc-400 border-0 rounded-md text-[10px] uppercase font-bold px-2 py-0.5 pointer-events-none">
                                {task.type}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-zinc-500 font-medium">
                              <span>{formatBytes(task.size)}</span>
                              <span>•</span>
                              <span className="text-white font-bold">{Math.round(task.progress)}%</span>
                              {task.eta !== undefined && task.status === 'uploading' && (
                                <><span>•</span><span className="text-zinc-400">{formatExactEta(task.eta)}</span></>
                              )}
                              {task.status === 'failed' && task.error && (
                                <><span>•</span><span className="text-red-400 truncate">{task.error}</span></>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="w-64 hidden lg:block shrink-0 px-4">
                          <Progress value={task.progress} className="h-2.5 bg-zinc-900 [&>div]:bg-white" />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {task.type === 'upload' && (
                            <Button variant="ghost" size="icon" onClick={() => backgroundUploadService.removeTask(task.id)} className="h-10 w-10 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors">
                              <X className="w-5 h-5" />
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
