import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Upload, CheckCircle, XCircle, Clock, X, Pause, Play,
  RotateCcw, Trash2, ChevronUp, ChevronDown, Maximize2
} from '@/lib/icon-map';
import { backgroundUploadService, UploadTask } from '@/services/backgroundUpload';
import { formatBytes } from '@/lib/api';
import { FullScreenTransferModal } from './FullScreenTransferModal';

const formatExactEta = (ms?: number) => {
  if (!ms || ms <= 0) return 'Calculating\u2026';
  const totalSeconds = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins > 0) return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  return `${secs}s`;
};

const BackgroundUploadPanel = () => {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);

  // Smooth interpolated display progress map (prevents bar jumping/stuttering)
  const [displayProgress, setDisplayProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsubscribe = backgroundUploadService.subscribe((newTasks) => {
      setTasks(newTasks);
      if (newTasks.some(task => task.status === 'uploading' || task.status === 'pending')) {
        setIsExpanded(true);
      }
    });
    return unsubscribe;
  }, []);

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

  const activeTasks = tasks.filter(task => task.status === 'uploading' || task.status === 'pending');
  const completedTasks = tasks.filter(task => task.status === 'completed');
  const failedTasks = tasks.filter(task => task.status === 'failed');

  return (
    <>
      <FullScreenTransferModal
        isOpen={isFullScreenOpen}
        onClose={() => setIsFullScreenOpen(false)}
      />

      <div className="fixed bottom-4 right-4 w-96 z-50 select-none">
        <Card className="shadow-2xl border border-neutral-800 bg-[#13131a]/95 backdrop-blur-xl">
          <CardHeader className="pb-2.5 pt-3.5 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 font-semibold text-white">
                <Upload className="h-4 w-4 text-neutral-400" />
                Transfers
                {activeTasks.length > 0 && (
                  <Badge className="bg-white/10 text-white font-mono text-xs ml-1 border-0">
                    {activeTasks.length} active
                  </Badge>
                )}
              </CardTitle>
              
              <div className="flex items-center gap-1">
                {activeTasks.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={handlePauseResume} className="h-7 w-7 p-0 text-neutral-400 hover:text-white">
                    {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullScreenOpen(true)}
                  className="h-7 w-7 p-0 text-neutral-400 hover:text-white transition-colors"
                  title="Expand to Full Screen"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-7 w-7 p-0 text-neutral-400 hover:text-white">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          
          {isExpanded && (
            <CardContent className="pt-0 px-4 pb-3">
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {tasks.slice(0, 5).map((task) => {
                  const smoothValue = displayProgress[task.id] ?? task.progress;
                  return (
                    <div key={task.id} className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium truncate max-w-[210px] text-white/90" title={task.file.name}>
                          {task.file.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => backgroundUploadService.removeTask(task.id)}
                          className="h-5 w-5 p-0 text-neutral-600 hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                        <span>{formatBytes(task.file.size)}</span>
                        {task.status === 'uploading' ? (
                          <span className="text-white/70 font-medium">{formatExactEta(task.estimatedTimeRemaining)}</span>
                        ) : (
                          <span className={cn(
                            task.status === 'completed' ? "text-white/60" :
                            task.status === 'failed' ? "text-white/40" : "text-white/50"
                          )}>
                            {task.status === 'completed' ? 'Done' :
                             task.status === 'failed' ? 'Failed' : 'Queued'}
                          </span>
                        )}
                      </div>

                      {task.status === 'uploading' && (
                        <div className="pt-0.5">
                          <Progress value={smoothValue} className="h-1.5 bg-neutral-950 transition-all duration-150" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {tasks.length > 5 && (
                  <div 
                    onClick={() => setIsFullScreenOpen(true)}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-center text-xs text-white/50 font-medium cursor-pointer hover:bg-white/10 transition-colors"
                  >
                    + {tasks.length - 5} more tasks \u2022 Click to view all
                  </div>
                )}
              </div>
              
              {(completedTasks.length > 0 || failedTasks.length > 0) && (
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-neutral-800 text-xs">
                  {failedTasks.length > 0 ? (
                    <Button variant="outline" size="sm" onClick={() => backgroundUploadService.retryFailed()} className="h-7 text-xs bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700">
                      <RotateCcw className="h-3 w-3 mr-1" /> Retry
                    </Button>
                  ) : <div />}
                  
                  {completedTasks.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => backgroundUploadService.clearCompleted()} className="h-7 text-xs text-neutral-500 hover:text-white">
                      <Trash2 className="h-3 w-3 mr-1" /> Clear Done
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
