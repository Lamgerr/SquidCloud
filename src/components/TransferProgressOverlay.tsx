import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Download, X, Pause, Play, CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  RefreshCw, Wifi, WifiOff, Shield, Trash2, Minimize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { smartTransferQueue, TransferItem, TransferQueueStats } from '@/services/SmartTransferQueue';

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatTime = (seconds: number): string => {
  if (seconds <= 0 || !isFinite(seconds)) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

const TransferItemCard: React.FC<{ transfer: TransferItem; onPause: () => void; onResume: () => void; onCancel: () => void; onRetry: () => void; }> = ({ transfer, onPause, onResume, onCancel, onRetry }) => {
  const isActive = transfer.status === 'transferring' || transfer.status === 'verifying';
  const isPaused = transfer.status === 'paused';
  const isFailed = transfer.status === 'failed';
  const isCompleted = transfer.status === 'completed';
  const isVerifying = transfer.status === 'verifying';

  return (
    <div className={cn("p-4 rounded-2xl border transition-all duration-300 animate-in fade-in bg-[#121212]", isFailed ? "border-red-900/30" : "border-zinc-800/80")}>
      <div className="flex items-start gap-4">
        <div className={cn("p-2.5 rounded-xl border flex items-center justify-center shrink-0", 
            isCompleted ? "bg-white border-transparent text-black" : 
            isFailed ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-zinc-800 border-zinc-700 text-white"
        )}>
          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : isFailed ? <AlertCircle className="h-4 w-4" /> : isVerifying ? <Shield className="h-4 w-4" /> : transfer.type === 'upload' ? <Upload className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="font-bold text-sm text-white truncate" title={transfer.fileName}>{transfer.fileName}</span>
            <span className={cn("text-xs font-bold uppercase", isCompleted ? "text-zinc-500" : isFailed ? "text-red-400" : "text-white")}>
              {transfer.status}
            </span>
          </div>
          {!isCompleted && (
            <div className="mt-2.5 mb-1.5">
              <Progress value={transfer.progress.percentage} className="h-1.5 bg-zinc-900 [&>div]:bg-white" />
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium font-mono">
            <span>{formatBytes(transfer.progress.bytesTransferred)} / {formatBytes(transfer.fileSize)}</span>
            {isActive && <><span>•</span><span className="text-zinc-300">{formatBytes(transfer.progress.speed)}/s</span><span>•</span><span className="text-zinc-400">ETA: {formatTime(transfer.progress.estimatedTimeRemaining)}</span></>}
            {isFailed && transfer.error && <><span>•</span><span className="text-red-400 truncate">{transfer.error}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {isActive && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-zinc-800 text-white hover:bg-zinc-700" onClick={onPause}><Pause className="h-4 w-4" /></Button>}
          {isPaused && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white text-black hover:bg-zinc-200" onClick={onResume}><Play className="h-4 w-4" /></Button>}
          {isFailed && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-zinc-800 text-white hover:bg-zinc-700" onClick={onRetry}><RefreshCw className="h-4 w-4" /></Button>}
          {!isCompleted && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800" onClick={onCancel}><X className="h-4 w-4" /></Button>}
        </div>
      </div>
    </div>
  );
};

export const TransferProgressOverlay: React.FC<{ className?: string; }> = ({ className }) => {
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [stats, setStats] = useState<TransferQueueStats | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const unsubscribe = smartTransferQueue.subscribe((t, s) => { setTransfers(t); setStats(s); });
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { unsubscribe(); window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  if (transfers.length === 0) return null;

  const activeTransfers = transfers.filter(t => t.status === 'queued' || t.status === 'transferring' || t.status === 'verifying' || t.status === 'paused');
  const completedTransfers = transfers.filter(t => t.status === 'completed' || t.status === 'cancelled');
  const failedTransfers = transfers.filter(t => t.status === 'failed');

  if (isMinimized) {
    return (
      <div className={cn("fixed bottom-6 right-6 z-50 animate-in fade-in zoom-in-95 duration-300", className)}>
        <Button onClick={() => setIsMinimized(false)} className="rounded-[1.5rem] h-16 w-16 shadow-[0_10px_30px_rgba(0,0,0,0.5)] bg-white text-black hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-all relative">
          {stats?.activeTransfers ? <Upload className="h-6 w-6 animate-pulse" /> : <CheckCircle2 className="h-6 w-6" />}
          {transfers.length > 0 && <span className="absolute -top-2 -right-2 bg-zinc-900 border-2 border-white text-white text-xs font-bold rounded-full h-7 w-7 flex items-center justify-center shadow-md">{transfers.length}</span>}
          {stats && stats.overallProgress > 0 && stats.overallProgress < 100 && (
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none" className="opacity-20" />
              <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray={`${2 * Math.PI * 28}`} strokeDashoffset={`${2 * Math.PI * 28 * (1 - stats.overallProgress / 100)}`} className="transition-all duration-300" />
            </svg>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-3rem)] bg-[#121212]/95 backdrop-blur-2xl border border-zinc-800 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] rounded-[2rem] animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-hidden", className)}>
      <div className="flex items-center justify-between p-5 border-b border-zinc-800/80 cursor-pointer bg-zinc-900/30" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-white text-black">
            {stats?.activeTransfers ? <Upload className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-bold text-base text-white">
              {stats?.activeTransfers ? `${stats.activeTransfers} Active Transfer${stats.activeTransfers > 1 ? 's' : ''}` : 'Transfers Complete'}
            </h3>
            {stats && stats.overallProgress > 0 && stats.overallProgress < 100 && (
              <p className="text-xs text-zinc-400 font-medium mt-0.5 font-mono">
                {Math.round(stats.overallProgress)}% • {formatBytes(stats.averageSpeed)}/s
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <div className={cn("p-2 rounded-lg", isOnline ? "text-zinc-500" : "text-red-500 bg-red-500/10")} title={isOnline ? "Online" : "Offline"}>
            {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800" onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}>
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {stats && stats.overallProgress > 0 && stats.overallProgress < 100 && (
        <div className="px-5 py-3 border-b border-zinc-800/80 bg-zinc-950">
          <Progress value={stats.overallProgress} className="h-1.5 bg-zinc-900 [&>div]:bg-white" />
          <div className="flex justify-between mt-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
            <span>{formatBytes(stats.totalBytesTransferred)} done</span>
            <span>{stats.queuedTransfers} queued</span>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="overflow-hidden bg-transparent">
          <div className="p-4 space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar">
            {activeTransfers.map(transfer => <TransferItemCard key={transfer.id} transfer={transfer} onPause={() => smartTransferQueue.pause(transfer.id)} onResume={() => smartTransferQueue.resume(transfer.id)} onCancel={() => smartTransferQueue.cancel(transfer.id)} onRetry={() => smartTransferQueue.retry(transfer.id)} />)}
            {failedTransfers.map(transfer => <TransferItemCard key={transfer.id} transfer={transfer} onPause={() => {}} onResume={() => {}} onCancel={() => smartTransferQueue.cancel(transfer.id)} onRetry={() => smartTransferQueue.retry(transfer.id)} />)}
            {completedTransfers.length > 0 && (
              <div className="pt-3 border-t border-zinc-800/80">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">{completedTransfers.length} completed</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs font-bold rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-white" onClick={() => smartTransferQueue.clearCompleted()}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear
                  </Button>
                </div>
                <div className="space-y-3">
                  {completedTransfers.slice(0, 3).map(transfer => <TransferItemCard key={transfer.id} transfer={transfer} onPause={() => {}} onResume={() => {}} onCancel={() => smartTransferQueue.cancel(transfer.id)} onRetry={() => {}} />)}
                </div>
                {completedTransfers.length > 3 && <p className="text-xs font-bold text-zinc-500 text-center mt-3 p-2 bg-zinc-900/50 rounded-xl cursor-default">+{completedTransfers.length - 3} more finished</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferProgressOverlay;
