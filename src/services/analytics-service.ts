import { supabase } from '@/integrations/supabase/client';

export interface StorageMetrics {
  totalStorage: number;
  usedStorage: number;
  availableStorage: number;
  storageGrowth: number;
  fileCount: number;
  fileTypes: { [key: string]: number };
  storageByType: { [key: string]: number };
}

export interface ActivityMetrics {
  uploads: number;
  downloads: number;
  shares: number;
  views: number;
  filesGrowth: number;
  dailyActivity: { date: string; uploads: number; downloads: number; views: number }[];
  popularFiles: { name: string; views: number; downloads: number }[];
  accessPatterns: { hour: number; activity: number }[];
}

export interface PerformanceMetrics {
  apiResponseMs: number;
  uploadBytes30d: number;
  shareDownloads: number;
  activeShares: number;
  systemHealth: 'excellent' | 'good' | 'fair' | 'poor';
  bandwidthUsage: { date: string; uploadMB: number }[];
}

class AnalyticsService {
  private userId: string | null = null;
  private initializeUserPromise: Promise<void> | null = null;
  private hasInitializedUser = false;

  constructor() {}

  private async initializeUser() {
    const { data: { session } } = await supabase.auth.getSession();
    this.userId = session?.user?.id || null;
    this.hasInitializedUser = true;
  }

  private async ensureUserInitialized() {
    if (this.hasInitializedUser) return;

    if (this.initializeUserPromise) {
      await this.initializeUserPromise;
      return;
    }

    this.initializeUserPromise = this.initializeUser().finally(() => {
      this.initializeUserPromise = null;
    });

    await this.initializeUserPromise;
  }

  async logEvent(eventType: string, metadata?: any): Promise<void> {
    await this.ensureUserInitialized();

    try {
      // Use existing tables to log events - we'll use the files table for tracking
      const eventData = {
        user_id: this.userId,
        event_type: eventType,
        metadata: JSON.stringify(metadata || {}),
        created_at: new Date().toISOString()
      };
      
      // Store in browser localStorage as a simple event log
      const existingEvents = JSON.parse(localStorage.getItem('analytics_events') || '[]');
      existingEvents.push(eventData);
      localStorage.setItem('analytics_events', JSON.stringify(existingEvents));
    } catch (error) {
      console.error('Error logging analytics event:', error);
    }
  }

  async getStorageMetrics(): Promise<StorageMetrics> {
    try {
      // Ensure we have the current user ID
      if (!this.userId) {
        await this.ensureUserInitialized();
      }

      // Get real storage data from existing files table
      const { data: files } = await supabase
        .from('files')
        .select('size, type, created_at')
        .eq('user_id', this.userId)
        .eq('is_deleted', false);

      if (!files || !this.userId) return {
        totalStorage: -1, // -1 indicates unlimited
        usedStorage: 0,
        availableStorage: -1, // -1 indicates unlimited
        storageGrowth: 0,
        fileCount: 0,
        fileTypes: {},
        storageByType: {}
      };

      const usedStorage = files.reduce((acc, file) => acc + (file.size || 0), 0);
      const fileCount = files.length;
      const totalStorage = -1; // Unlimited storage
      const availableStorage = -1; // Unlimited available

      // Calculate type breakdown
      const fileTypes: { [key: string]: number } = {};
      const storageByType: { [key: string]: number } = {};
      
      files.forEach(file => {
        const type = file.type || 'unknown';
        const category = this.getFileTypeCategory(type);
        fileTypes[category] = (fileTypes[category] || 0) + 1;
        storageByType[category] = (storageByType[category] || 0) + (file.size || 0);
      });

      // Real 7-day growth: bytes added in the last 7 days vs the 7 before
      const now = Date.now();
      const d7 = 7 * 24 * 60 * 60 * 1000;
      const recentBytes = files
        .filter(f => f.created_at && now - new Date(f.created_at).getTime() < d7)
        .reduce((acc, f) => acc + (f.size || 0), 0);
      const priorBytes = files
        .filter(f => {
          if (!f.created_at) return false;
          const age = now - new Date(f.created_at).getTime();
          return age >= d7 && age < 2 * d7;
        })
        .reduce((acc, f) => acc + (f.size || 0), 0);
      const storageGrowth =
        priorBytes > 0 ? Math.round(((recentBytes - priorBytes) / priorBytes) * 100)
        : recentBytes > 0 ? 100 : 0;

      return {
        totalStorage,
        usedStorage,
        availableStorage,
        storageGrowth,
        fileCount,
        fileTypes,
        storageByType
      };
    } catch (error) {
      console.error('Error getting storage metrics:', error);
      return {
        totalStorage: -1, // Unlimited
        usedStorage: 0,
        availableStorage: -1, // Unlimited
        storageGrowth: 0,
        fileCount: 0,
        fileTypes: {},
        storageByType: {}
      };
    }
  }

  private getFileTypeCategory(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'Images';
    if (mimeType.startsWith('video/')) return 'Videos';
    if (mimeType.startsWith('audio/')) return 'Audio';
    if (mimeType.includes('pdf')) return 'Documents';
    if (mimeType.includes('document') || mimeType.includes('text')) return 'Documents';
    if (mimeType.includes('spreadsheet') || mimeType.includes('csv')) return 'Spreadsheets';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'Archives';
    return 'Other';
  }

  async getActivityMetrics(): Promise<ActivityMetrics> {
    try {
      await this.ensureUserInitialized();
      if (!this.userId) throw new Error('No user');

      // Real uploads: every non-deleted file, with creation timestamps
      const { data: files } = await supabase
        .from('files')
        .select('id, name, size, created_at')
        .eq('user_id', this.userId)
        .eq('is_deleted', false);

      // Real shares + engagement: the shares table counts every view/download
      const { data: shares } = await supabase
        .from('shares')
        .select('file_id, share_views, download_count, created_at')
        .eq('user_id', this.userId);

      const fileList = files || [];
      const shareList = (shares || []) as any[];
      const uploads = fileList.length;
      const shareCount = shareList.length;
      const views = shareList.reduce((a, s) => a + (s.share_views || 0), 0);
      const downloads = shareList.reduce((a, s) => a + (s.download_count || 0), 0);

      // Real file-count momentum: this week vs last week
      const nowMs = Date.now();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const thisWeek = fileList.filter(f => f.created_at && nowMs - new Date(f.created_at).getTime() < weekMs).length;
      const lastWeek = fileList.filter(f => {
        if (!f.created_at) return false;
        const age = nowMs - new Date(f.created_at).getTime();
        return age >= weekMs && age < 2 * weekMs;
      }).length;
      const filesGrowth = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : thisWeek > 0 ? 100 : 0;

      // Daily activity for the last 14 days, from real creation timestamps
      const dailyActivity = [];
      for (let i = 13; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateString = date.toISOString().split('T')[0];
        const dayFiles = fileList.filter(f => f.created_at && f.created_at.startsWith(dateString));
        const dayShares = shareList.filter(s => s.created_at && String(s.created_at).startsWith(dateString));
        dailyActivity.push({
          date: dateString,
          uploads: dayFiles.length,
          downloads: 0,
          views: dayShares.reduce((a, s) => a + (s.share_views || 0), 0),
        });
      }

      // Popular files: most-viewed shared files, resolved to real names
      const topShares = [...shareList]
        .sort((a, b) => ((b.share_views || 0) + (b.download_count || 0)) - ((a.share_views || 0) + (a.download_count || 0)))
        .slice(0, 5);
      const topIds = topShares.map(s => s.file_id).filter(Boolean);
      let nameById: Record<string, string> = {};
      if (topIds.length > 0) {
        const { data: named } = await supabase.from('files').select('id, name').in('id', topIds);
        (named || []).forEach((f: any) => { nameById[f.id] = f.name; });
      }
      const popularFiles = topShares
        .filter(s => (s.share_views || 0) + (s.download_count || 0) > 0)
        .map(s => ({
          name: nameById[s.file_id] || 'Shared file',
          views: s.share_views || 0,
          downloads: s.download_count || 0,
        }));

      // Access patterns: the hours this account actually adds files
      const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({ hour, activity: 0 }));
      fileList.forEach(f => {
        if (!f.created_at) return;
        hourBuckets[new Date(f.created_at).getHours()].activity++;
      });
      const accessPatterns = hourBuckets.filter(p => p.activity > 0);

      return { uploads, downloads, shares: shareCount, views, filesGrowth, dailyActivity, popularFiles, accessPatterns };
    } catch (error) {
      console.error('Error getting activity metrics:', error);
      return {
        uploads: 0,
        downloads: 0,
        shares: 0,
        views: 0,
        filesGrowth: 0,
        dailyActivity: [],
        popularFiles: [],
        accessPatterns: []
      };
    }
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      await this.ensureUserInitialized();

      // Real API response: timed round-trip against the database
      const pingStart = performance.now();
      let apiResponseMs = -1;
      try {
        await supabase.from('files').select('id', { head: true, count: 'exact' }).limit(1);
        apiResponseMs = Math.max(1, Math.round(performance.now() - pingStart));
      } catch {
        apiResponseMs = -1;
      }

      // Real volumes from the files + shares tables
      const { data: files } = await supabase
        .from('files')
        .select('size, created_at')
        .eq('user_id', this.userId || '')
        .eq('is_deleted', false);
      const { data: shares } = await supabase
        .from('shares')
        .select('download_count')
        .eq('user_id', this.userId || '');

      const fileList = files || [];
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const uploadBytes30d = fileList
        .filter(f => f.created_at && new Date(f.created_at).getTime() >= cutoff)
        .reduce((a, f) => a + (f.size || 0), 0);
      const shareDownloads = ((shares || []) as any[]).reduce((a, s) => a + (s.download_count || 0), 0);
      const activeShares = (shares || []).length;

      // Daily upload volume (MB) for the last 14 days
      const bandwidthUsage = [];
      for (let i = 13; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateString = date.toISOString().split('T')[0];
        const dayBytes = fileList
          .filter(f => f.created_at && f.created_at.startsWith(dateString))
          .reduce((a, f) => a + (f.size || 0), 0);
        bandwidthUsage.push({ date: dateString, uploadMB: Math.round((dayBytes / (1024 * 1024)) * 10) / 10 });
      }

      const systemHealth: PerformanceMetrics['systemHealth'] =
        apiResponseMs < 0 ? 'poor' :
        apiResponseMs < 300 ? 'excellent' :
        apiResponseMs < 800 ? 'good' : 'fair';

      return { apiResponseMs, uploadBytes30d, shareDownloads, activeShares, systemHealth, bandwidthUsage };
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return {
        apiResponseMs: -1,
        uploadBytes30d: 0,
        shareDownloads: 0,
        activeShares: 0,
        systemHealth: 'poor',
        bandwidthUsage: []
      };
    }
  }

  // Event tracking methods
  async trackFileUpload(fileName: string, fileSize: number, fileType: string) {
    await this.logEvent('file_upload', { fileName, fileSize, fileType });
  }

  async trackFileDownload(fileName: string) {
    await this.logEvent('file_download', { fileName });
  }

  async trackFileView(fileName: string) {
    await this.logEvent('file_view', { fileName });
  }

  async trackFileShare(fileName: string, shareType: string) {
    await this.logEvent('file_share', { fileName, shareType });
  }

  async trackSearch(query: string, resultCount: number) {
    await this.logEvent('search', { query, resultCount });
  }

  async trackFeatureUsage(feature: string, action: string) {
    await this.logEvent('feature_usage', { feature, action });
  }
}

export const analyticsService = new AnalyticsService();
