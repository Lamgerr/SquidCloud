import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { HardDrive, Plus, RefreshCcw, Loader2, Power, Trash2, Globe, CheckCircle2, AlertTriangle } from '@/lib/icon-map';
import { cn } from '@/lib/utils';

interface B2Bucket {
  id: string;
  bucket_name: string;
  bucket_region: string;
  bucket_endpoint: string;
  is_enabled: boolean;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  created_at: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function B2ClusterManager() {
  const [buckets, setBuckets] = useState<B2Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingUsage, setCheckingUsage] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingBucket, setEditingBucket] = useState<B2Bucket | null>(null);

  const loadBuckets = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('squidcloud_b2_buckets')
        .select('*')
        .order('created_at', { ascending: false });

      setBuckets(data || []);
    } catch (err: any) {
      console.error('Failed to load B2 buckets:', err);
      toast.error('Failed to load B2 cluster');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBuckets(); }, [loadBuckets]);

  const checkUsage = useCallback(async () => {
    setCheckingUsage(true);
    try {
      const { data } = await supabase.functions.invoke('s3-usage-tracker', {
        body: { action: 'check-cluster' },
      });

      if (data?.buckets) {
        setBuckets(prev => prev.map(b => {
          const updated = data.buckets.find((r: any) => r.id === b.id);
          if (updated) {
            return { ...b, storage_used_bytes: updated.storageUsedBytes ?? b.storage_used_bytes };
          }
          return b;
        }));
        toast.success('Cluster usage refreshed');
      }
    } catch (err: any) {
      toast.error('Failed to check cluster');
    } finally {
      setCheckingUsage(false);
    }
  }, []);

  const toggleEnabled = useCallback(async (bucket: B2Bucket) => {
    try {
      const newState = !bucket.is_enabled;
      const { error } = await supabase
        .from('squidcloud_b2_buckets')
        .update({ is_enabled: newState })
        .eq('id', bucket.id);

      if (error) throw error;
      setBuckets(prev => prev.map(b => b.id === bucket.id ? { ...b, is_enabled: newState } : b));
      toast.success(`Bucket ${newState ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      toast.error('Failed to update');
    }
  }, []);

  const removeBucket = useCallback(async (bucketId: string) => {
    try {
      const { error } = await supabase
        .from('squidcloud_b2_buckets')
        .delete()
        .eq('id', bucketId);

      if (error) throw error;
      setBuckets(prev => prev.filter(b => b.id !== bucketId));
      toast.success('Bucket removed from cluster');
    } catch (err: any) {
      toast.error('Failed to remove bucket');
    }
  }, []);

  const totalStorage = buckets.reduce((acc, b) => acc + (b.storage_limit_bytes || 0), 0);
  const totalUsed = buckets.reduce((acc, b) => acc + b.storage_used_bytes, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4 text-primary" />
            SquidCloud B2 Cluster
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {buckets.length} bucket{buckets.length !== 1 ? 's' : ''} · {formatBytes(totalUsed)} / {formatBytes(totalStorage)} used
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={checkUsage} disabled={checkingUsage}>
            <RefreshCcw className={cn('h-3.5 w-3.5 mr-1', checkingUsage && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Bucket
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : buckets.length === 0 ? (
          <div className="text-center py-8">
            <HardDrive className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No B2 buckets configured</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Add Backblaze B2 buckets to form the SquidCloud storage cluster</p>
          </div>
        ) : (
          <div className="space-y-2">
            {buckets.map(bucket => {
              const usagePercent = Math.min(100, Math.round((bucket.storage_used_bytes / Math.max(bucket.storage_limit_bytes, 1)) * 100));
              return (
                <div key={bucket.id} className={cn(
                  'rounded-lg border p-3 transition-all',
                  bucket.is_enabled ? 'border-border/50 bg-card' : 'border-border/30 bg-muted/20 opacity-60'
                )}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500 shrink-0">
                        <HardDrive className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{bucket.bucket_name}</p>
                          {!bucket.is_enabled && <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Disabled</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {bucket.bucket_endpoint} · {bucket.bucket_region}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleEnabled(bucket)} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all">
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => removeBucket(bucket.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                      <span>{formatBytes(bucket.storage_used_bytes)} / {formatBytes(bucket.storage_limit_bytes)}</span>
                      <span>{usagePercent}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div className={cn(
                        'h-full rounded-full transition-all',
                        usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-primary'
                      )} style={{ width: `${usagePercent}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AddB2BucketDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={(newBucket) => {
          setBuckets(prev => [newBucket, ...prev]);
          setAddDialogOpen(false);
        }}
      />
    </Card>
  );
}

function AddB2BucketDialog({ open, onClose, onSuccess }: {
  open: boolean;
  onClose: () => void;
  onSuccess: (bucket: B2Bucket) => void;
}) {
  const [form, setForm] = useState({
    bucket_name: '',
    bucket_region: 'us-east-0',
    bucket_endpoint: '',
    access_key_id: '',
    secret_access_key: '',
    storage_limit_bytes: '10737418240',
  });
  const [saving, setSaving] = useState(false);

  const normalizeEndpoint = (ep: string) => {
    ep = ep.trim();
    if (!ep.startsWith('http://') && !ep.startsWith('https://')) {
      return 'https://' + ep;
    }
    return ep;
  };

  const handleSave = async () => {
    if (!form.bucket_name || !form.bucket_endpoint || !form.access_key_id || !form.secret_access_key) {
      toast.error('Required fields missing');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('squidcloud_b2_buckets')
        .insert({
          bucket_name: form.bucket_name,
          bucket_region: form.bucket_region,
          bucket_endpoint: normalizeEndpoint(form.bucket_endpoint),
          access_key_id: form.access_key_id,
          secret_access_key: form.secret_access_key,
          is_enabled: true,
          storage_limit_bytes: parseInt(form.storage_limit_bytes) || 10737418240,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('B2 bucket added to cluster');
      onSuccess(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add bucket');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            Add B2 Bucket
          </DialogTitle>
          <DialogDescription>Add a Backblaze B2 bucket to the SquidCloud cluster</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {(Object.keys(form) as Array<keyof typeof form>).map(key => (
            <div className="grid gap-1.5" key={key}>
              <Label className="text-xs capitalize">{key.replace(/_/g, ' ')}</Label>
              <Input
                value={form[key]}
                onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={
                  key === 'bucket_endpoint' ? 'https://s3.us-east-0.backblazeb2.com' :
                  key === 'access_key_id' ? 'Enter B2 Key ID' :
                  key === 'secret_access_key' ? 'Enter B2 Application Key' :
                  key === 'storage_limit_bytes' ? '10 GB default' : ''
                }
                type={key === 'secret_access_key' ? 'password' : 'text'}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><CheckCircle2 className="mr-2 h-4 w-4" /> Add Bucket</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
