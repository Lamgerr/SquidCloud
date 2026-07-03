import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, CheckCircle, XCircle, Clock, X, Pause, Play,
  RotateCcw, Trash2, ChevronUp, ChevronDown, Maximize2
} from '@/lib/icon-map';
import { backgroundUploadService, UploadTask } from '@/services/backgroundUpload';
import { formatBytes } from '@/lib/api';
import { FullScreenTransferModal } from './FullScreenTransferModal';

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
            // Glide smoothly toward real target progress
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

  const formatExactEta = (ms?: number) => {
    if (!ms || ms <= 0) return 'Calculating ETA...';
    const totalSeconds = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins > 0) return `ETA: ${mins}m ${secs.toString().padStart(2, '0')}s`;
    return `ETA: ${secs}s`;
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
        <Card className="shadow-2xl border border-neutral-800 bg-[#13131a]/95 backdrop-blur-xl text-white">
          <CardHeader className="pb-2.5 pt-3.5 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 font-bold">
                <Upload className="h-4 w-4 text-blue-400" />
                Background Transfers
                {activeTasks.length > 0 && (
                  <Badge className="bg-blue-600 text-white font-mono text-xs ml-1">
                    {activeTasks.length} active
                  </Badge>
                )}
              </CardTitle>
              
              <div className="flex items-center gap-1">
                {activeTasks.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={handlePauseResume} className="h-7 w-7 p-0 text-neutral-300 hover:text-white">
                    {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  </Button>
                )}
                {/* EXPAND TO FULL SCREEN SUITE BUTTON */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullScreenOpen(true)}
                  className="h-7 w-7 p-0 text-neutral-300 hover:text-blue-400 transition-colors"
                  title="Expand to Full Screen Command Suite"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-7 w-7 p-0 text-neutral-300 hover:text-white">
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
                    <div key={task.id} className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold truncate max-w-[210px] text-white" title={task.file.name}>
                          {task.file.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => backgroundUploadService.removeTask(task.id)}
                          className="h-5 w-5 p-0 text-neutral-500 hover:text-red-400"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                        <span>{formatBytes(task.file.size)}</span>
                        {task.status === 'uploading' ? (
                          <span className="text-blue-400 font-medium">{formatExactEta(task.estimatedTimeRemaining)}</span>
                        ) : (
                          <span className={cn(
                            task.status === 'completed' ? "text-emerald-400" :
                            task.status === 'failed' ? "text-red-400" : "text-amber-400"
                          )}>
                            {task.status.toUpperCase()}
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
                    className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center text-xs text-blue-400 font-medium cursor-pointer hover:bg-blue-500/20 transition-colors"
                  >
                    + {tasks.length - 5} more tasks • Click Expand to view all
                  </div>
                )}
              </div>
              
              {(completedTasks.length > 0 || failedTasks.length > 0) && (
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-neutral-800 text-xs">
                  {failedTasks.length > 0 ? (
                    <Button variant="outline" size="sm" onClick={() => backgroundUploadService.retryFailed()} className="h-7 text-xs bg-neutral-900 border-neutral-800 text-neutral-300">
                      <RotateCcw className="h-3 w-3 mr-1" /> Retry
                    </Button>
                  ) : <div />}
                  
                  {completedTasks.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => backgroundUploadService.clearCompleted()} className="h-7 text-xs text-neutral-400 hover:text-white">
                      <Trash2 className="h-3 w-3 mr-1" /> Clear Completed
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
