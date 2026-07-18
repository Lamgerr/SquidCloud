import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Upload, Download, CheckCircle2, XCircle, X, Pause, Play,
  RotateCcw, Trash2, ChevronUp, ChevronDown, Maximize2, Activity
} from 'lucide-react';
import { backgroundUploadService, UploadTask } from '@/services/backgroundUpload';
import { backgroundDownloadService, DownloadTask } from '@/services/backgroundDownload';
import { formatBytes } from '@/lib/api';
import { FullScreenTransferModal } from './FullScreenTransferModal';

const formatExactEta = (ms?: number) => {
  if (!ms || ms <= 0) return 'Calculating…';
  const totalSeconds = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins > 0) return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  return `${secs}s`;
};

const BackgroundUploadPanel = () => {
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);

  // Smooth interpolated display progress map
  const [displayProgress, setDisplayProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsubUpload = backgroundUploadService.subscribe((tasks) => {
      setUploadTasks(tasks);
      if (tasks.some(t => t.status === 'uploading' || t.status === 'pending')) setIsExpanded(true);
    });
    const unsubDownload = backgroundDownloadService.subscribe((tasks) => {
      setDownloadTasks(tasks);
      if (tasks.some(t => t.status === 'downloading')) setIsExpanded(true);
    });
    return () => { unsubUpload(); unsubDownload(); };
  }, []);

  // Unify tasks
  const tasks = useMemo(() => {
    const unified = [
      ...uploadTasks.map(t => ({ id: t.id, name: t.file.name, size: t.file.size, progress: t.progress, status: t.status, type: 'upload' as const, eta: t.estimatedTimeRemaining })),
      ...downloadTasks.map(t => ({ id: t.id, name: t.fileName, size: t.fileSize, progress: t.progress, status: t.status, type: 'download' as const, eta: undefined }))
    ];
    // Sort active first, then completed/failed
    return unified.sort((a, b) => {
      const aActive = a.status === 'uploading' || a.status === 'downloading' || a.status === 'pending';
      const bActive = b.status === 'uploading' || b.status === 'downloading' || b.status === 'pending';
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return 0;
    });
  }, [uploadTasks, downloadTasks]);

  // Smooth continuous progress interpolator
  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayProgress(prev => {
        const next = { ...prev };
        tasks.forEach(t => {
          const current = next[t.id] ?? 0;
          const target = t.progress;
          if (current < target) {
            next[t.id] = Number((current + (target - current) * 0.25).toFixed(1));
          } else {
            next[t.id] = target;
          }
        });
        return next;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [tasks]);

  const handlePauseResume = () => {
    if (isPaused) {
      backgroundUploadService.resumeAll();
      setIsPaused(false);
    } else {
      backgroundUploadService.pauseAll();
      setIsPaused(true);
    }
  };

  if (tasks.length === 0) return null;

  const activeTasks = tasks.filter(t => t.status === 'uploading' || t.status === 'downloading' || t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const failedTasks = tasks.filter(t => t.status === 'failed');

  return (
    <>
      <FullScreenTransferModal isOpen={isFullScreenOpen} onClose={() => setIsFullScreenOpen(false)} />

      <div className="fixed bottom-6 right-6 w-[400px] z-50 select-none">
        <Card className="shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] border-zinc-800/80 bg-[#121212]/95 backdrop-blur-2xl rounded-3xl overflow-hidden transition-all duration-300">
          <CardHeader className="pb-3 pt-4 px-5 bg-zinc-900/30 border-b border-zinc-800/50 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2.5 font-semibold text-white tracking-tight">
                <div className="p-1.5 bg-white text-black rounded-lg">
                  <Activity className="h-3.5 w-3.5" />
                </div>
                Transfers
                {activeTasks.length > 0 && (
                  <Badge className="bg-zinc-800 text-white font-mono text-[10px] uppercase ml-1 border-0">
                    {activeTasks.length} active
                  </Badge>
                )}
              </CardTitle>
              
              <div className="flex items-center gap-1.5">
                {activeTasks.some(t => t.type === 'upload') && (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handlePauseResume(); }} className="h-8 w-8 p-0 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800">
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setIsFullScreenOpen(true); }} className="h-8 w-8 p-0 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800" title="Expand to Full Screen">
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <div className="h-8 w-8 flex items-center justify-center text-zinc-500">
                  {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                </div>
              </div>
            </div>
          </CardHeader>
          
          {isExpanded && (
            <CardContent className="pt-3 px-5 pb-4 bg-transparent">
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {tasks.slice(0, 5).map((task) => {
                  const smoothValue = displayProgress[task.id] ?? task.progress;
                  return (
                    <div key={task.id} className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800/80 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                           {task.type === 'upload' ? <Upload className="h-3.5 w-3.5 text-zinc-400 shrink-0" /> : <Download className="h-3.5 w-3.5 text-zinc-400 shrink-0" />}
                           <span className="text-xs font-semibold truncate text-white" title={task.name}>{task.name}</span>
                        </div>
                        {task.type === 'upload' && (
                          <Button variant="ghost" size="sm" onClick={() => backgroundUploadService.removeTask(task.id)} className="h-6 w-6 p-0 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 shrink-0">
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                        <span>{formatBytes(task.size)}</span>
                        {task.status === 'uploading' || task.status === 'downloading' ? (
                          <span className="text-white font-medium">{task.eta ? formatExactEta(task.eta) : `${Math.round(smoothValue)}%`}</span>
                        ) : (
                          <span className={cn("font-medium", task.status === 'completed' ? "text-white" : task.status === 'failed' ? "text-red-400" : "text-zinc-400")}>
                            {task.status === 'completed' ? 'Done' : task.status === 'failed' ? 'Failed' : 'Queued'}
                          </span>
                        )}
                      </div>

                      {(task.status === 'uploading' || task.status === 'downloading') && (
                        <div className="pt-1">
                          <Progress value={smoothValue} className="h-1.5 bg-zinc-950 [&>div]:bg-white transition-all duration-150" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {tasks.length > 5 && (
                  <div 
                    onClick={() => setIsFullScreenOpen(true)}
                    className="p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 text-center text-xs text-zinc-400 font-medium cursor-pointer hover:bg-zinc-800 transition-colors"
                  >
                    + {tasks.length - 5} more tasks • Click to view all
                  </div>
                )}
              </div>
              
              {(completedTasks.length > 0 || failedTasks.length > 0) && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800 text-xs">
                  {failedTasks.length > 0 ? (
                    <Button variant="outline" size="sm" onClick={() => backgroundUploadService.retryFailed()} className="h-8 rounded-lg text-xs bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800">
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Retry Failed
                    </Button>
                  ) : <div />}
                  
                  {completedTasks.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => { backgroundUploadService.clearCompleted(); backgroundDownloadService.clearCompleted(); }} className="h-8 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear Done
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </>
  );
};

export default BackgroundUploadPanel;
