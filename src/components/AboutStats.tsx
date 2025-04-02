
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatBytes } from '@/lib/api';
import { Loader2, HardDrive, FileText, FolderTree, Share2 } from 'lucide-react';
import { getStorageStats } from '@/lib/file-manager';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseProfileType } from '@/types/file-manager';

interface StorageQuota {
  used: number;
  total: number;
  percentage: number;
}

const DEFAULT_QUOTA_GB = Infinity; // Set to Infinity for unlimited storage

const AboutStats: React.FC = () => {
  const [stats, setStats] = useState({
    fileCount: 0,
    folderCount: 0,
    sharedCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState<StorageQuota>({
    used: 0,
    total: DEFAULT_QUOTA_GB,
    percentage: 0
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        
        // Get storage stats
        const storageStats = await getStorageStats();
        
        // Get shared file count
        const { data: sharedFiles, error: sharedError } = await supabase
          .from('files')
          .select('id')
          .eq('shared', true);
          
        if (sharedError) throw sharedError;
        
        // Get any user-specific quota from profiles
        const { data: { user } } = await supabase.auth.getUser();
        let userQuota = DEFAULT_QUOTA_GB;
        
        if (user) {
          try {
            const { data: profileData, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
              
            if (profileData && !error) {
              // Use our extended type to access the property
              const profile = profileData as unknown as SupabaseProfileType;
              if (profile.storage_quota_gb) {
                userQuota = Number(profile.storage_quota_gb) || DEFAULT_QUOTA_GB;
              }
            }
          } catch (err) {
            console.error("Error getting user quota:", err);
            // Continue with default quota
          }
        }
        
        // Calculate percentage used - manage infinite quota case
        const totalBytes = storageStats.totalSize;
        const totalQuota = userQuota === Infinity ? Infinity : userQuota * 1024 * 1024 * 1024;
        const percentageUsed = totalQuota === Infinity ? 0 : Math.min(100, (totalBytes / totalQuota) * 100);
        
        setQuota({
          used: totalBytes,
          total: totalQuota,
          percentage: percentageUsed
        });
        
        setStats({
          fileCount: storageStats.fileCount,
          folderCount: storageStats.folderCount,
          sharedCount: sharedFiles?.length || 0
        });
        
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-4">Loading statistics...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Storage Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used: {formatBytes(quota.used)}</span>
                <span>Total: {quota.total === Infinity ? "Unlimited" : formatBytes(quota.total)}</span>
              </div>
              {quota.total !== Infinity && (
                <Progress value={quota.percentage} className="h-2" />
              )}
              <p className="text-xs text-muted-foreground">
                {quota.total === Infinity 
                  ? "Unlimited storage available" 
                  : `${quota.percentage.toFixed(1)}% of your storage used`
                }
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center p-3 bg-secondary/50 rounded-lg">
                <FileText className="h-8 w-8 text-blue-500 mb-1" />
                <span className="text-xl font-bold">{stats.fileCount}</span>
                <span className="text-xs text-muted-foreground">Files</span>
              </div>
              
              <div className="flex flex-col items-center p-3 bg-secondary/50 rounded-lg">
                <FolderTree className="h-8 w-8 text-amber-500 mb-1" />
                <span className="text-xl font-bold">{stats.folderCount}</span>
                <span className="text-xs text-muted-foreground">Folders</span>
              </div>
              
              <div className="flex flex-col items-center p-3 bg-secondary/50 rounded-lg">
                <Share2 className="h-8 w-8 text-green-500 mb-1" />
                <span className="text-xl font-bold">{stats.sharedCount}</span>
                <span className="text-xs text-muted-foreground">Shared</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
                <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Document uploaded</p>
                  <p className="text-xs text-muted-foreground">{new Date(Date.now() - i * 86400000).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AboutStats;
