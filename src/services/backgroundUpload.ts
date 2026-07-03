
import { uploadFile } from '@/lib/api';
import { FileItem } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';

export interface UploadTask {
  id: string;
  file: File;
  folder: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
  result?: FileItem;
  fileHash?: string;
  startTime?: number;
  estimatedTimeRemaining?: number;
  createdAt: number;
  queuePosition: number;
  onComplete?: (result?: FileItem) => void;
}

class BackgroundUploadService {
  private tasks: Map<string, UploadTask> = new Map();
  private isProcessing = false;
  private maxConcurrentUploads = 1;
  private currentUploads = 0;
  private listeners: Array<(tasks: UploadTask[]) => void> = [];
  private planLimitsFetched = false;

  constructor() {
    this.fetchPlanLimits();
    this.startProcessing();
  }

  private async fetchPlanLimits(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.rpc('get_user_plan_limits', { user_id: user.id });
      if (data) {
        const limits = data as any;
        if (limits.concurrent_uploads && limits.concurrent_uploads > 0) {
          this.maxConcurrentUploads = limits.concurrent_uploads;
        } else if (limits.concurrent_uploads === -1) {
          this.maxConcurrentUploads = 10; // unlimited => sensible cap
        }
        this.planLimitsFetched = true;
      }
    } catch (e) {
      console.warn('Failed to fetch plan limits, using defaults');
    }
  }

  // Generate a simple hash for file content to detect duplicates
  private async generateFileHash(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async addTask(file: File, folder: string = "", onComplete?: (result?: FileItem) => void): Promise<string> {
    const fileHash = await this.generateFileHash(file);
    
    // Check for duplicate files
    const existingTask = Array.from(this.tasks.values()).find(
      task => task.fileHash === fileHash && task.folder === folder && task.status !== 'failed'
    );
    
    if (existingTask) {
      console.log('Duplicate file detected, skipping:', file.name);
      return existingTask.id;
    }

    const id = crypto.randomUUID();
    const task: UploadTask = {
      id,
      file,
      folder,
      progress: 0,
      status: 'pending',
      fileHash,
      createdAt: Date.now(),
      queuePosition: 0,
      onComplete
    };

    this.tasks.set(id, task);
    this.notifyListeners();
    this.processQueue();
    
    return id;
  }

  async addMultipleTasks(files: File[], folder: string = ""): Promise<string[]> {
    const ids: string[] = [];
    
    for (const file of files) {
      const id = await this.addTask(file, folder);
      ids.push(id);
    }
    
    return ids;
  }

  removeTask(id: string): void {
    this.tasks.delete(id);
    this.notifyListeners();
  }

  getTasks(): UploadTask[] {
    const sorted = Array.from(this.tasks.values())
      .sort((a, b) => a.createdAt - b.createdAt);
    let position = 0;
    for (const task of sorted) {
      if (task.status === 'pending' || task.status === 'uploading') {
        position++;
        task.queuePosition = position;
      } else {
        task.queuePosition = 0;
      }
    }
    return sorted;
  }

  getTaskById(id: string): UploadTask | undefined {
    return this.tasks.get(id);
  }

  subscribe(listener: (tasks: UploadTask[]) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const tasks = this.getTasks();
    this.listeners.forEach(listener => listener(tasks));
  }

  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.isProcessing) {
      await this.processQueue();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Check every second
    }
  }

  private async processQueue(): Promise<void> {
    const pendingTasks = Array.from(this.tasks.values())
      .filter(task => task.status === 'pending')
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, this.maxConcurrentUploads - this.currentUploads);

    const uploadPromises = pendingTasks.map(task => this.processTask(task));
    
    if (uploadPromises.length > 0) {
      await Promise.allSettled(uploadPromises);
    }
  }

  private async processTask(task: UploadTask): Promise<void> {
    if (this.currentUploads >= this.maxConcurrentUploads) {
      return;
    }

    this.currentUploads++;
    task.status = 'uploading';
    task.startTime = Date.now();
    this.notifyListeners();

    try {
      const result = await uploadFile(
        task.file,
        task.folder,
        (progress: number) => {
          task.progress = progress;
          
          // Calculate estimated time remaining
          if (task.startTime && progress > 0) {
            const elapsed = Date.now() - task.startTime;
            const progressPerMs = progress / elapsed;
            const remainingProgress = 100 - progress;
            task.estimatedTimeRemaining = Math.ceil(remainingProgress / progressPerMs);
          }
          
          this.notifyListeners();
        }
      );

      task.status = 'completed';
      task.progress = 100;
      task.result = result;
      task.estimatedTimeRemaining = 0;
      
      task.onComplete?.(result);
      
      // Auto-remove completed tasks after 5 seconds
      setTimeout(() => {
        this.removeTask(task.id);
      }, 5000);
      
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message || 'Upload failed';
    } finally {
      this.currentUploads--;
      this.notifyListeners();
    }
  }

  pauseAll(): void {
    this.isProcessing = false;
  }

  resumeAll(): void {
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  clearCompleted(): void {
    const completedTasks = Array.from(this.tasks.values())
      .filter(task => task.status === 'completed');
    
    completedTasks.forEach(task => {
      this.tasks.delete(task.id);
    });
    
    this.notifyListeners();
  }

  clearFailed(): void {
    const failedTasks = Array.from(this.tasks.values())
      .filter(task => task.status === 'failed');
    
    failedTasks.forEach(task => {
      this.tasks.delete(task.id);
    });
    
    this.notifyListeners();
  }

  retryFailed(): void {
    const failedTasks = Array.from(this.tasks.values())
      .filter(task => task.status === 'failed');
    
    failedTasks.forEach(task => {
      task.status = 'pending';
      task.progress = 0;
      task.error = undefined;
    });
    
    this.notifyListeners();
    this.processQueue();
  }
}

// Export singleton instance
export const backgroundUploadService = new BackgroundUploadService();
