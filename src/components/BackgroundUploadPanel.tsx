import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Upload, Download, X, Pause, Play,
  RotateCcw, Trash2, ChevronUp, Maximize2, Check,
} from 'lucide-react';
import { backgroundUploadService, UploadTask } from '@/services/backgroundUpload';
import { backgroundDownloadService, DownloadTask } from '@/services/backgroundDownload';
import { formatBytes } from '@/lib/api';
import { FullScreenTransferModal } from './FullScreenTransferModal';

/* ═══════════════════════════════════════════════════════════════
   Transfer panel — speaks the house editorial language shared with
   the index / pricing pages and account settings:
   ink surface, bone text, hairline rules, small radii, Geist Mono
   micro-kickers, and the signature ease. Motion stays springy.
   ═══════════════════════════════════════════════════════════════ */

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)' as const;
const SPRING_ENTER = { type: 'spring', stiffness: 300, damping: 26 } as const;
const SPRING_BOUNCY = { type: 'spring', stiffness: 380, damping: 17 } as const;
const SPRING_GLIDE = { type: 'spring', stiffness: 110, damping: 22 } as const;

const KICKER = 'font-mono text-[10px] uppercase tracking-[0.14em] text-[#8d8f89]';

const formatExactEta = (ms?: number) => {
  if (!ms || ms <= 0) return 'Calculating…';
  const totalSeconds = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins > 0) return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  return `${secs}s`;
};

type UnifiedTask = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: string;
  type: 'upload' | 'download';
  eta?: number;
  error?: string;
};

function HairlineBar({ value, tone = 'bone' }: { value: number; tone?: 'bone' | 'ok' | 'bad' }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-[2px] w-full overflow-hidden rounded-full bg-[rgba(232,231,225,0.12)]" aria-hidden="true">
      <motion.div
        className={cn(
          'h-full w-full origin-left rounded-full',
          tone === 'ok' ? 'bg-emerald-400' : tone === 'bad' ? 'bg-red-400/80' : 'bg-[#e8e7e1]'
        )}
        initial={false}
        animate={{ scaleX: clamped / 100 }}
        transition={SPRING_GLIDE}
      />
    </div>
  );
}

function TaskRow({
  task, onRemove,
}: {
  task: UnifiedTask;
  onRemove: () => void;
}) {
  const reduce = useReducedMotion();
  const active = task.status === 'uploading' || task.status === 'downloading';
  const done = task.status === 'completed';
  const failed = task.status === 'failed';

  return (
    <motion.div
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.15 } }}
      transition={SPRING_BOUNCY}
      className="border-t border-[rgba(232,231,225,0.09)] px-4 py-3 transition-colors first:border-t-0 hover:bg-[rgba(232,231,225,0.03)] sm:px-5"
    >
      {failed && !reduce && (
        <motion.span
          className="pointer-events-none absolute inset-0"
          initial={{ x: 0 }}
          animate={{ x: [0, -6, 6, -3, 3, 0] }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />
      )}

      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border',
            done ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-400'
              : failed ? 'border-red-400/25 bg-red-400/10 text-red-400'
              : 'border-[rgba(232,231,225,0.14)] bg-[rgba(232,231,225,0.04)] text-[#e8e7e1]'
          )}
        >
          {done ? (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING_BOUNCY} className="flex">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </motion.span>
          ) : task.type === 'upload' ? (
            <Upload className="h-3.5 w-3.5" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium tracking-[-0.005em] text-[#e8e7e1]" title={task.name}>
            {task.name}
          </p>
          <p className="mt-1 font-mono text-[10.5px] tabular-nums tracking-wide text-[#8d8f89]">
            {formatBytes(task.size)}
            {active && task.eta ? <span> · {formatExactEta(task.eta)}</span> : null}
            {failed && task.error ? <span className="text-red-400/90"> · {task.error}</span> : null}
          </p>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={active ? 'pct' : task.status}
            initial={reduce ? {} : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? {} : { opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'shrink-0 font-mono text-[11px] font-medium tabular-nums',
              done ? 'text-emerald-400' : failed ? 'text-red-400' : 'text-[#e8e7e1]'
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
            whileTap={{ scale: 0.85 }}
            onClick={onRemove}
            aria-label={`Remove ${task.name}`}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] text-[#8d8f89] transition-colors hover:bg-[rgba(232,231,225,0.07)] hover:text-[#e8e7e1]"
          >
            <X className="h-3 w-3" />
          </motion.button>
        )}
      </div>

      {(active || done) && (
        <div className="mt-2.5 pl-11">
          <HairlineBar value={done ? 100 : task.progress} tone={done ? 'ok' : 'bone'} />
        </div>
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
      ...uploadTasks.map(t => ({ id: t.id, name: t.file.name, size: t.file.size, progress: t.progress, status: t.status, type: 'upload' as const, eta: t.estimatedTimeRemaining, error: (t as any).error })),
      ...downloadTasks.map(t => ({ id: t.id, name: t.fileName, size: t.fileSize, progress: t.progress, status: t.status, type: 'download' as const, eta: undefined, error: (t as any).error })),
    ];
    const rank = (s: string) => (s === 'uploading' || s === 'downloading' ? 0 : s === 'pending' ? 1 : s === 'failed' ? 2 : 3);
    return unified.sort((a, b) => rank(a.status) - rank(b.status));
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
        className="fixed bottom-4 right-4 left-4 z-50 select-none sm:left-auto sm:bottom-6 sm:right-6 sm:w-[380px]"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
        transition={SPRING_ENTER}
        layout
      >
        <div className="overflow-hidden rounded-2xl border border-[rgba(232,231,225,0.14)] bg-[#0b0d0c]/95 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          {/* Header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            className="block w-full px-4 pt-4 text-left sm:px-5"
          >
            <span className="flex items-center justify-between gap-3">
              <span className={KICKER}>
                Transfers{activeTasks.length > 0 ? ` · ${activeTasks.length} active` : failedTasks.length > 0 ? ` · ${failedTasks.length} failed` : ' · done'}
              </span>
              <span className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}>
                {activeTasks.some(t => t.type === 'upload') && (
                  <motion.span whileTap={{ scale: 0.85 }}>
                    <span
                      role="button" tabIndex={0}
                      onClick={handlePauseResume}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePauseResume(); } }}
                      aria-label={isPaused ? 'Resume all' : 'Pause all'}
                      className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#8d8f89] transition-colors hover:bg-[rgba(232,231,225,0.07)] hover:text-[#e8e7e1]"
                    >
                      {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    </span>
                  </motion.span>
                )}
                <motion.span whileTap={{ scale: 0.85 }}>
                  <span
                    role="button" tabIndex={0}
                    onClick={() => setIsFullScreenOpen(true)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsFullScreenOpen(true); } }}
                    aria-label="Open transfer center" title="Expand"
                    className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#8d8f89] transition-colors hover:bg-[rgba(232,231,225,0.07)] hover:text-[#e8e7e1]"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </span>
                </motion.span>
                <motion.span
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={SPRING_BOUNCY}
                  className="flex h-7 w-7 items-center justify-center text-[#8d8f89]"
                >
                  <ChevronUp className="h-4 w-4" />
                </motion.span>
              </span>
            </span>
            <span className="mt-2 flex items-baseline justify-between gap-3">
              <span className="truncate text-[17px] font-semibold tracking-[-0.01em] text-[#e8e7e1]">
                {activeTasks.length > 0 ? activeTasks[0].name : failedTasks.length > 0 ? 'Attention needed' : 'All transfers complete'}
              </span>
              <span className="shrink-0 font-mono text-[12px] font-medium tabular-nums text-[#e8e7e1]" aria-live="polite">
                {Math.round(overall)}%
              </span>
            </span>
            <span className="mt-2.5 block">
              <HairlineBar value={overall} tone={failedTasks.length > 0 && activeTasks.length === 0 ? 'bad' : 'bone'} />
            </span>
            <span className="mt-2 block font-mono text-[10.5px] tabular-nums tracking-wide text-[#8d8f89]">
              {activeTasks.length > 0
                ? `${activeTasks[0] ? formatBytes(activeTasks[0].size) : ''}${activeTasks[0]?.eta ? ` · ${formatExactEta(activeTasks[0].eta)} left` : ''}${activeTasks.length > 1 ? ` · +${activeTasks.length - 1} more` : ''}`
                : failedTasks.length > 0
                  ? `${failedTasks.length} failed — retry below`
                  : `${completedTasks.length} completed`}
            </span>
            <span className="block pb-3" />
          </button>

          {/* Task list */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="list"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={reduce ? { duration: 0.15 } : { duration: 0.45, ease: EASE }}
                className="overflow-hidden border-t border-[rgba(232,231,225,0.09)]"
              >
                <div className="px-1 py-1">
                  <motion.div layout className="max-h-72 overflow-y-auto custom-scrollbar">
                    <AnimatePresence initial={false}>
                      {tasks.slice(0, 5).map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          onRemove={() => backgroundUploadService.removeTask(task.id)}
                        />
                      ))}
                    </AnimatePresence>

                    {tasks.length > 5 && (
                      <motion.button
                        layout
                        onClick={() => setIsFullScreenOpen(true)}
                        whileTap={{ scale: 0.98 }}
                        className="w-full px-5 py-3 text-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#8d8f89] transition-colors hover:text-[#e8e7e1]"
                      >
                        + {tasks.length - 5} more — open transfer center
                      </motion.button>
                    )}
                  </motion.div>

                  {(completedTasks.length > 0 || failedTasks.length > 0) && (
                    <div className="flex items-center justify-between border-t border-[rgba(232,231,225,0.09)] px-4 py-2.5 sm:px-5">
                      {failedTasks.length > 0 ? (
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={() => backgroundUploadService.retryFailed()}
                          className="rounded-[4px] border border-[rgba(232,231,225,0.16)] px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#e8e7e1] transition-colors hover:bg-[rgba(232,231,225,0.06)]"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <RotateCcw className="h-3 w-3" /> Retry failed
                          </span>
                        </motion.button>
                      ) : <div />}
                      {completedTasks.length > 0 && (
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={() => { backgroundUploadService.clearCompleted(); backgroundDownloadService.clearCompleted(); }}
                          className="rounded-[4px] px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#8d8f89] transition-colors hover:text-[#e8e7e1]"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Trash2 className="h-3 w-3" /> Clear done
                          </span>
                        </motion.button>
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
