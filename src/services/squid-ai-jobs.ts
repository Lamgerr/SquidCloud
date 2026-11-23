/**
 * Squid AI background jobs — ported from dex's task/desk pattern.
 * AI operations run independently of the command palette; subscribers
 * (the top-nav spinner) see progress live. A job is: id, label, status,
 * progress 0..1, and an optional result string.
 */
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';
export interface AIJob {
  id: string;
  label: string;
  status: JobStatus;
  progress: number;
  result?: string;
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

type Listener = (jobs: AIJob[]) => void;

class SquidAIJobs {
  private jobs = new Map<string, AIJob>();
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  snapshot(): AIJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.startedAt - a.startedAt);
  }

  private emit() {
    const snap = this.snapshot();
    this.listeners.forEach(fn => fn(snap));
  }

  /** Start a tracked job around an async operation. */
  async run<T>(label: string, fn: (setProgress: (p: number) => void) => Promise<T>): Promise<T> {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const job: AIJob = { id, label, status: 'queued', progress: 0, startedAt: Date.now() };
    this.jobs.set(id, job);
    this.emit();
    try {
      job.status = 'running';
      this.emit();
      const result = await fn((p) => { job.progress = Math.max(0, Math.min(1, p)); this.emit(); });
      job.status = 'done';
      job.progress = 1;
      job.result = typeof result === 'string' ? result : 'Done';
      job.finishedAt = Date.now();
      this.emit();
      window.setTimeout(() => { this.jobs.delete(id); this.emit(); }, 6000);
      return result;
    } catch (e: any) {
      job.status = 'failed';
      job.error = e?.message || 'Failed';
      job.finishedAt = Date.now();
      this.emit();
      window.setTimeout(() => { this.jobs.delete(id); this.emit(); }, 8000);
      throw e;
    }
  }

  get active(): AIJob[] {
    return this.snapshot().filter(j => j.status === 'queued' || j.status === 'running');
  }
}

export const squidAIJobs = new SquidAIJobs();
