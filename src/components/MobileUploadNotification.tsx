import React, { useState, useEffect, useMemo } from 'react';
import { backgroundUploadService, UploadTask } from '@/services/backgroundUpload';
import { formatBytes } from '@/lib/api';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { 
  Upload, CheckCircle2, XCircle, ChevronUp, ChevronDown, X,
  FileIcon, Image, Video, Music, FileText, Archive, Pause, Play, RotateCcw
} from '@/lib/icon-map'; // or lucide-react

const MobileUploadNotification: React.FC = () => {
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isScrolledDown, setIsScrolledDown] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastY + 2) {
        setIsScrolledDown(true);
        setIsExpanded(false); // Auto-collapse so it resets nicely
      } else if (currentY < lastY - 2 || currentY < 10) {
        setIsScrolledDown(false);
      }
      lastY = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const unsubscribe = backgroundUploadService.subscribe((newTasks) => {
      setTasks(newTasks);
      if (newTasks.some(task => task.status === 'uploading' || task.status === 'pending')) {
        setIsDismissed(false);
      }
    });
    return unsubscribe;
  }, []);

  const stats = useMemo(() => {
    const active = tasks.filter(t => t.status === 'uploading' || t.status === 'pending');
    const completed = tasks.filter(t => t.status === 'completed');
    const failed = tasks.filter(t => t.status === 'failed');
    
    let totalProgress = 0;
    active.forEach(task => { totalProgress += task.progress; });
    
    return {
      active, completed, failed, total: tasks.length,
      averageProgress: active.length > 0 ? totalProgress / active.length : 0,
      totalSize: active.reduce((acc, task) => acc + task.file.size, 0),
      uploadedSize: active.reduce((acc, task) => acc + (task.file.size * task.progress / 100), 0),
      isUploading: active.length > 0,
      allCompleted: tasks.length > 0 && active.length === 0 && failed.length === 0,
      hasFailed: failed.length > 0
    };
  }, [tasks]);

  useEffect(() => {
    if (stats.allCompleted && tasks.length > 0) {
      const timer = setTimeout(() => {
        backgroundUploadService.clearCompleted();
        setIsDismissed(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [stats.allCompleted, tasks.length]);

  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type.startsWith('video/')) return <Video className="w-4 h-4" />;
    if (type.startsWith('audio/')) return <Music className="w-4 h-4" />;
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) return <FileText className="w-4 h-4" />;
    if (type.includes('zip') || type.includes('archive') || type.includes('compressed')) return <Archive className="w-4 h-4" />;
    return <FileIcon className="w-4 h-4" />;
  };

  if (!isMobile || tasks.length === 0 || isDismissed) return null;

  return (
    <div 
      className={cn(
        "fixed left-4 right-4 z-[55] transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
        isScrolledDown ? "translate-y-12 opacity-0 pointer-events-none scale-95" : "translate-y-0 opacity-100 scale-100",
        isExpanded ? "bottom-[calc(5rem+env(safe-area-inset-bottom))]" : "bottom-[calc(6.5rem+env(safe-area-inset-bottom))]"
      )}
    >
      {/* MONOCHROMATIC BENTO CONTAINER */}
      <div className="bg-[#121212]/95 backdrop-blur-2xl rounded-[2rem] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] border border-zinc-800/80 overflow-hidden">
        
        <div 
          className="flex items-center gap-3 p-4 cursor-pointer active:bg-white/5 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Progress Ring */}
          <div className="relative flex-shrink-0 w-10 h-10 flex items-center justify-center">
            {stats.isUploading ? (
              <>
                <svg className="w-10 h-10 -rotate-90 absolute inset-0" viewBox="0 0 36 36">
                  <circle className="text-zinc-800" strokeWidth="3" stroke="currentColor" fill="none" r="15.5" cx="18" cy="18" />
                  <circle className="text-white transition-all duration-300" strokeWidth="3" strokeDasharray={`${stats.averageProgress}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" r="15.5" cx="18" cy="18" />
                </svg>
                <Upload className="w-4 h-4 text-white" />
              </>
            ) : stats.allCompleted ? (
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-black" />
              </div>
            ) : stats.hasFailed ? (
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
            ) : null}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">
              {stats.isUploading ? `Uploading ${stats.active.length} file${stats.active.length > 1 ? 's' : ''}` : stats.allCompleted ? "Upload complete" : `${stats.failed.length} failed`}
            </p>
            <p className="text-zinc-400 text-xs font-medium truncate mt-0.5">
              {stats.isUploading ? `${Math.round(stats.averageProgress)}% • ${formatBytes(stats.uploadedSize)} of ${formatBytes(stats.totalSize)}` : stats.allCompleted ? `${stats.completed.length} files saved` : "Tap to retry"}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {stats.isUploading && (
              <button onClick={(e) => { e.stopPropagation(); isPaused ? backgroundUploadService.resumeAll() : backgroundUploadService.pauseAll(); setIsPaused(!isPaused); }} className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center active:scale-90 transition-transform">
                {isPaused ? <Play className="w-4 h-4 text-white" /> : <Pause className="w-4 h-4 text-white" />}
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); backgroundUploadService.clearCompleted(); setIsDismissed(true); }} className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center active:scale-90 transition-transform">
              <X className="w-4 h-4 text-zinc-300" />
            </button>
            <div className="w-8 h-8 flex items-center justify-center">
              {isExpanded ? <ChevronDown className="w-5 h-5 text-zinc-500" /> : <ChevronUp className="w-5 h-5 text-zinc-500" />}
            </div>
          </div>
        </div>

        {/* EXPANDED FILE LIST */}
        {isExpanded && (
           <div className="border-t border-zinc-800/60 max-h-64 overflow-y-auto overscroll-contain bg-zinc-950/30">
             {tasks.map((task, index) => (
                <div key={task.id} className={cn("flex items-center gap-3 px-4 py-3.5", index !== tasks.length - 1 && "border-b border-zinc-800/40")}>
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", 
                    task.status === 'completed' ? "bg-white text-black" :
                    task.status === 'failed' ? "bg-red-500/10 text-red-400" : "bg-zinc-800 text-white"
                  )}>
                    {getFileIcon(task.file)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{task.file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-zinc-500 text-xs font-medium">{formatBytes(task.file.size)}</span>
                      {task.status === 'uploading' && <><span className="text-zinc-700">•</span><span className="text-white text-xs font-bold">{task.progress}%</span></>}
                      {task.status === 'failed' && task.error && <><span className="text-zinc-700">•</span><span className="text-red-400 text-xs font-medium truncate">{task.error}</span></>}
                    </div>
                    {task.status === 'uploading' && (
                      <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${task.progress}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 ml-2">
                    {task.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-zinc-400" />}
                    {task.status === 'failed' && <button onClick={() => backgroundUploadService.retryFailed()} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center"><RotateCcw className="w-4 h-4 text-white" /></button>}
                    {task.status === 'uploading' && <div className="w-4 h-4 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />}
                  </div>
                </div>
              ))}
           </div>
        )}
      </div>
    </div>
  );
};

export default MobileUploadNotification;
