import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Upload, Download, XCircle, X, Pause, Play,
  RotateCcw, Trash2, ChevronUp, Maximize2, Check,
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

// Buttery spring presets — the whole panel lives on these.
const SPRING_ENTER = { type: 'spring', stiffness: 300, damping: 24 } as const;
const SPRING_BOUNCY = { type: 'spring', stiffness: 380, damping: 16 } as const;
const SPRING_GLIDE = { type: 'spring', stiffness: 110, damping: 22 } as const;

type UnifiedTask = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: string;
  type: 'upload' | 'download';
  eta?: number;
};

function OverallRing({ value, size = 40 }: { value: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3}
          className="stroke-zinc-800" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3}
          strokeLinecap="round" className="stroke-white"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c - (c * clamped) / 100 }}
          transition={SPRING_GLIDE}
          style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.45))' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-bold tabular-nums text-white">
        {Math.round(clamped)}
      </span>
    </span>
  );
}

function TaskRow({
  task, index, onRemove,
}: {
  task: UnifiedTask;
  index: number;
  onRemove: () => void;
}) {
  const reduce = useReducedMotion();
  const active = task.status === 'uploading' || task.status === 'downloading';
  const done = task.status === 'completed';
  const failed = task.status === 'failed';
  const p = Math.max(0, Math.min(100, task.progress)) / 100;

  return (
    <motion.div
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
      transition={SPRING_BOUNCY}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-3',
        failed
          ? 'border-red-500/25 bg-red-500/[0.06]'
          : done
            ? 'border-emerald-500/20 bg-emerald-500/[0.05]'
            : 'border-zinc-800/80 bg-zinc-900'
      )}
    >
      {/* failed shake */}
      {failed && !reduce && (
        <motion.span
          className="pointer-events-none absolute inset-0"
          initial={{ x: 0 }}
          animate={{ x: [0, -7, 7, -4, 4, 0] }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <motion.span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
              done ? 'bg-emerald-500/15 text-emerald-400'
                : failed ? 'bg-red-500/15 text-red-400'
                : 'bg-zinc-800 text-zinc-300'
            )}
            animate={active && !reduce ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={active && !reduce ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : undefined}
          >
            {done ? (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING_BOUNCY} className="flex">
                <Check className="h-4 w-4" strokeWidth={3} />
              </motion.span>
            ) : failed ? (
              <XCircle className="h-4 w-4" />
            ) : task.type === 'upload' ? (
              <Upload className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </motion.span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white" title={task.name}>{task.name}</p>
            <p className="mt-0.5 font-mono text-[10px] tabular-nums text-zinc-500">
              {formatBytes(task.size)}
              {active && task.eta ? <span className="text-zinc-400"> • {formatExactEta(task.eta)}</span> : null}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={active ? 'pct' : task.status}
              initial={reduce ? {} : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? {} : { opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'font-mono text-[11px] font-bold tabular-nums',
                done ? 'text-emerald-400' : failed ? 'text-red-400' : 'text-white'
              )}
              aria-live="polite"
            >
              {active ? `${Math.round(task.progress)}%`
                : done ? 'Done'
                : failed ? 'Failed' : 'Queued'}
            </motion.span>
          </AnimatePresence>
          {task.type === 'upload' && (
            <motion.button
              whileTap={{ scale: 0.8 }}
              onClick={onRemove}
              aria-label={`Remove ${task.name}`}
              className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              <X className="h-3 w-3" />
            </motion.button>
          )}
        </div>
      </div>

      {(active || done) && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-950">
          <motion.div
            className={cn(
              'h-full w-full origin-left rounded-full',
              done
                ? 'bg-gradient-to-r from-emerald-400 to-emerald-300'
                : 'bg-gradient-to-r from-zinc-200 via-white to-zinc-200'
            )}
            style={{ boxShadow: done ? '0 0 12px rgba(52,211,153,0.55)' : '0 0 10px rgba(255,255,255,0.35)' }}
            initial={false}
            animate={{ scaleX: done ? 1 : p }}
            transition={SPRING_GLIDE}
          />
        </div>
      )}

      {/* shimmer sweep while moving */}
      {active && !reduce && (
        <motion.div
          className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
          animate={{ x: ['-120%', '420%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.div>
  );
}

const BackgroundUploadPanel = () => {
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const reduce = useReducedMotion();

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

  const tasks = useMemo<UnifiedTask[]>(() => {
    const unified: UnifiedTask[] = [
      ...uploadTasks.map(t => ({ id: t.id, name: t.file.name, size: t.file.size, progress: t.progress, status: t.status, type: 'upload' as const, eta: t.estimatedTimeRemaining })),
      ...downloadTasks.map(t => ({ id: t.id, name: t.fileName, size: t.fileSize, progress: t.progress, status: t.status, type: 'download' as const, eta: undefined })),
    ];
    return unified.sort((a, b) => {
      const rank = (s: string) => (s === 'uploading' || s === 'downloading' ? 0 : s === 'pending' ? 1 : s === 'failed' ? 2 : 3);
      return rank(a.status) - rank(b.status);
    });
  }, [uploadTasks, downloadTasks]);

  // Byte-weighted overall progress across active work.
  const overall = useMemo(() => {
    const active = tasks.filter(t => t.status === 'uploading' || t.status === 'downloading' || t.status === 'pending');
    if (active.length === 0) return 100;
    const total = active.reduce((a, t) => a + (t.size || 0), 0);
    if (total <= 0) return 0;
    const doneBytes = active.reduce((a, t) => a + (t.size || 0) * (Math.max(0, Math.min(100, t.progress)) / 100), 0);
    return (doneBytes / total) * 100;
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

      <motion.div
        className="fixed bottom-4 right-4 left-4 z-50 select-none sm:left-auto sm:bottom-6 sm:right-6 sm:w-[400px]"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 32, scale: 0.95 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.95 }}
        transition={SPRING_ENTER}
        layout
      >
        <div className="overflow-hidden rounded-3xl border border-zinc-800/80 bg-[#121212]/95 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
          {/* Header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-zinc-900/40 sm:px-5"
          >
            <span className="flex min-w-0 items-center gap-3">
              <OverallRing value={overall} />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white">
                  Transfers
                  <AnimatePresence>
                    {activeTasks.length > 0 && (
                      <motion.span
                        key="count"
                        initial={reduce ? {} : { scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={SPRING_BOUNCY}
                        className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-[10px] uppercase text-white"
                      >
                        {activeTasks.length} active
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-zinc-500" aria-live="polite">
                  {activeTasks.length > 0
                    ? `${Math.round(overall)}% • ${activeTasks[0].name}${activeTasks.length > 1 ? ` +${activeTasks.length - 1} more` : ''}`
                    : failedTasks.length > 0
                      ? `${failedTasks.length} failed`
                      : 'All done'}
                </span>
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}>
              {activeTasks.some(t => t.type === 'upload') && (
                <motion.span whileTap={{ scale: 0.82 }}>
                  <Button variant="ghost" size="sm" onClick={handlePauseResume} aria-label={isPaused ? 'Resume all' : 'Pause all'} className="h-8 w-8 rounded-full p-0 text-zinc-400 hover:bg-zinc-800 hover:text-white">
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </Button>
                </motion.span>
              )}
              <motion.span whileTap={{ scale: 0.82 }}>
                <Button variant="ghost" size="sm" onClick={() => setIsFullScreenOpen(true)} aria-label="Open transfer center" title="Expand to Full Screen" className="h-8 w-8 rounded-full p-0 text-zinc-400 hover:bg-zinc-800 hover:text-white">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </motion.span>
              <motion.span
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={SPRING_BOUNCY}
                className="flex h-8 w-8 items-center justify-center text-zinc-500"
              >
                <ChevronUp className="h-5 w-5" />
              </motion.span>
            </span>
          </button>

          {/* Task list */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="list"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={reduce ? { duration: 0.15 } : SPRING_ENTER}
                className="overflow-hidden"
              >
                <div className="space-y-2.5 px-4 pb-4 sm:px-5">
                  <motion.div layout className="max-h-72 space-y-2.5 overflow-y-auto pr-1 custom-scrollbar">
                    <AnimatePresence initial={false}>
                      {tasks.slice(0, 5).map((task, i) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          index={i}
                          onRemove={() => backgroundUploadService.removeTask(task.id)}
                        />
                      ))}
                    </AnimatePresence>

                    {tasks.length > 5 && (
                      <motion.button
                        layout
                        onClick={() => setIsFullScreenOpen(true)}
                        whileTap={{ scale: 0.97 }}
                        className="w-full rounded-2xl border border-zinc-800/50 bg-zinc-900/50 p-3 text-center text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
                      >
                        + {tasks.length - 5} more tasks • Click to view all
                      </motion.button>
                    )}
                  </motion.div>

                  {(completedTasks.length > 0 || failedTasks.length > 0) && (
                    <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-xs">
                      {failedTasks.length > 0 ? (
                        <motion.span whileTap={{ scale: 0.95 }} className="inline-flex">
                          <Button variant="outline" size="sm" onClick={() => backgroundUploadService.retryFailed()} className="h-8 rounded-lg border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white">
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retry Failed
                          </Button>
                        </motion.span>
                      ) : <div />}
                      {completedTasks.length > 0 && (
                        <motion.span whileTap={{ scale: 0.95 }} className="inline-flex">
                          <Button variant="ghost" size="sm" onClick={() => { backgroundUploadService.clearCompleted(); backgroundDownloadService.clearCompleted(); }} className="h-8 rounded-lg text-xs text-zinc-400 hover:bg-zinc-900 hover:text-white">
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear Done
                          </Button>
                        </motion.span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
};

export default BackgroundUploadPanel;
