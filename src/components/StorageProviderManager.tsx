import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Cloud, HardDrive, Plus, RefreshCcw, Server, Database, Globe, Power, Check, XCircle, AlertTriangle, Sliders, Settings2, Trash2, ToggleLeft, ToggleRight, Network, Wifi, Loader2, Book } from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import StorageProviderAddDialog from './StorageProviderAddDialog';
import StorageSettingsPanel from './StorageSettingsPanel';
import StorageProviderHelp from './StorageProviderHelp';

export interface StorageProviderRecord {
  id: string;
  provider_type: string;
  label: string | null;
  bucket_name: string | null;
  is_enabled: boolean;
  read_enabled: boolean;
  write_enabled: boolean;
  is_public: boolean;
  is_default: boolean;
  storage_used_bytes: number;
  storage_limit_bytes: number | null;
  health_status: string;
  last_health_check: string | null;
  last_error: string | null;
  bucket_region: string | null;
  created_at: string;
}

interface StorageProviderManagerProps {
  isOpen: boolean;
  onClose: () => void;
  activeProviderType: string;
  activeProviderId: string | null;
  onProviderSelect: (providerType: string, providerId: string | null) => void;
  isAdmin?: boolean;
}

const PROVIDER_BRANDING: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  squidcloud: { label: 'SquidCloud', color: 'text-primary', icon: null },
  tebi: { label: 'Tebi.io', color: 'text-emerald-500', icon: null },
  r2: { label: 'Cloudflare R2', color: 'text-orange-500', icon: null },
  backblaze: { label: 'Backblaze B2', color: 'text-red-500', icon: null },
  b2: { label: 'Backblaze B2', color: 'text-red-500', icon: null },
  s3: { label: 'AWS S3', color: 'text-amber-500', icon: null },
  gcp: { label: 'Google Cloud', color: 'text-blue-500', icon: null },
  wasabi: { label: 'Wasabi', color: 'text-green-500', icon: null },
  azure: { label: 'Azure Blob', color: 'text-sky-500', icon: null },
  custom: { label: 'S3 Compatible', color: 'text-purple-500', icon: null },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatBytesShort(bytes: number): string {
  if (bytes === 0) return '0';
  const k = 1024;
  const sizes = ['', 'K', 'M', 'G', 'T'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
}

function getIconForProvider(type: string): React.ReactNode {
  const brand = PROVIDER_BRANDING[type];
  if (brand?.icon) return brand.icon;
  switch (type) {
    case 'tebi': return <Database className="h-4 w-4" />;
    case 'r2': return <Cloud className="h-4 w-4" />;
    case 'backblaze': case 'b2': return <HardDrive className="h-4 w-4" />;
    case 's3': return <Server className="h-4 w-4" />;
    case 'gcp': return <Globe className="h-4 w-4" />;
    default: return <HardDrive className="h-4 w-4" />;
  }
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function StorageProviderManager({
  isOpen, onClose, activeProviderType, activeProviderId, onProviderSelect, isAdmin
}: StorageProviderManagerProps) {
  const [providers, setProviders] = useState<StorageProviderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [checkingUsage, setCheckingUsage] = useState(false);
  const [disablingId, setDisablingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [permToggleTarget, setPermToggleTarget] = useState<{ provider: StorageProviderRecord; permission: 'read' | 'write'; currentValue: boolean } | null>(null);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('storage_providers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setProviders(data || []);
    } catch (err: any) {
      console.error('Failed to load providers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadProviders();
  }, [isOpen, loadProviders]);

  const checkUsage = useCallback(async () => {
    setCheckingUsage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: result } = await supabase.functions.invoke('s3-usage-tracker', {
        body: { action: 'check-all' }
      });

      if (result?.providers) {
        setProviders(prev => prev.map(p => {
          const updated = result.providers.find((r: any) => r.id === p.id);
          if (updated) {
            return {
              ...p,
              health_status: updated.health || p.health_status,
              storage_used_bytes: updated.storageUsedBytes ?? p.storage_used_bytes,
            };
          }
          return p;
        }));
        toast.success('Storage usage refreshed');
      }
    } catch (err: any) {
      toast.error('Failed to check usage');
    } finally {
      setCheckingUsage(false);
    }
  }, []);

  const togglePermission = useCallback(async (provider: StorageProviderRecord, permission: 'read' | 'write', enabled: boolean) => {
    try {
      const { error } = await supabase.rpc('toggle_storage_provider_permission', {
        p_provider_id: provider.id,
        p_permission: permission,
        p_enabled: enabled,
      });
      if (error) throw error;

      setProviders(prev => prev.map(p =>
        p.id === provider.id
          ? { ...p, [permission === 'read' ? 'read_enabled' : 'write_enabled']: enabled, updated_at: new Date().toISOString() }
          : p
      ));

      const label = permission === 'read' ? 'Read' : 'Write';
      toast.success(`${label} access ${enabled ? 'enabled' : 'disabled'} for ${provider.label || provider.provider_type}`);
    } catch (err: any) {
      toast.error('Failed to update permission');
    }
  }, []);

  const toggleEnabled = useCallback(async (provider: StorageProviderRecord) => {
    setDisablingId(provider.id);
    try {
      const newState = !provider.is_enabled;
      const { error } = await supabase
        .from('storage_providers')
        .update({ is_enabled: newState, updated_at: new Date().toISOString() })
        .eq('id', provider.id);

      if (error) throw error;

      setProviders(prev => prev.map(p =>
        p.id === provider.id ? { ...p, is_enabled: newState } : p
      ));

      // If disabling the active provider, switch to SquidCloud
      if (!newState && activeProviderId === provider.id) {
        onProviderSelect('squidcloud', null);
      }

      toast.success(`${provider.label || provider.provider_type} ${newState ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      toast.error('Failed to update provider');
    } finally {
      setDisablingId(null);
    }
  }, [activeProviderId, onProviderSelect]);

  const removeProvider = useCallback(async (provider: StorageProviderRecord) => {
    setDeletingId(provider.id);
    try {
      const { error } = await supabase
        .from('storage_providers')
        .delete()
        .eq('id', provider.id);

      if (error) throw error;

      setProviders(prev => prev.filter(p => p.id !== provider.id));

      if (activeProviderId === provider.id) {
        onProviderSelect('squidcloud', null);
      }

      toast.success(`${provider.label || provider.provider_type} removed`);
    } catch (err: any) {
      toast.error('Failed to remove provider');
    } finally {
      setDeletingId(null);
    }
  }, [activeProviderId, onProviderSelect]);

  const handleAddSuccess = useCallback((newProvider: StorageProviderRecord) => {
    setProviders(prev => [newProvider, ...prev]);
    onProviderSelect(newProvider.provider_type, newProvider.id);
    setAddDialogOpen(false);
  }, [onProviderSelect]);

  const providerCount = useMemo(() =>
    providers.filter(p => p.is_enabled).length, [providers]);

  const SquidCloudCard = () => {
    const isActive = activeProviderType === 'squidcloud';
    return (
      <button
        onClick={() => onProviderSelect('squidcloud', null)}
        className={cn(
          'w-full rounded-xl border-2 p-3 sm:p-4 text-left transition-all duration-150',
          isActive
            ? 'border-primary/40 bg-primary/5'
            : 'border-border/50 bg-card hover:border-border hover:bg-accent/30'
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Cloud className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">SquidCloud</p>
                {isActive && <Badge variant="default" className="h-5 px-1.5 text-[10px]">Active</Badge>}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">Built-in default storage</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn('text-xs', isActive ? 'text-primary' : 'text-muted-foreground')}>
              Always Available
            </span>
            {isActive && <Check className="h-4 w-4 text-primary" />}
          </div>
        </div>
      </button>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="left-0 right-0 top-0 bottom-0 translate-x-0 translate-y-0 max-w-none w-screen h-[100dvh] max-h-[100dvh] rounded-none border-0 p-0 sm:left-[50%] sm:top-[50%] sm:bottom-auto sm:right-auto sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-[calc(100vw-1.5rem)] sm:h-auto sm:max-h-[92vh] sm:max-w-[880px] sm:rounded-[20px] sm:border [&>button]:right-3 [&>button]:top-3 sm:[&>button]:right-4 sm:[&>button]:top-4">
          <div className="flex h-full max-h-[100dvh] sm:max-h-[92vh] flex-col">
            <DialogHeader className="border-b border-border/50 px-4 pb-3 pt-4 pr-12 sm:px-6 sm:pr-14">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <HardDrive className="h-5 w-5 text-primary" />
                    Storage Providers
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Manage your storage buckets — up to {20 - providerCount} more available
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={checkUsage} disabled={checkingUsage}>
                    <RefreshCcw className={cn('h-3.5 w-3.5 mr-1', checkingUsage && 'animate-spin')} />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSettingsOpen(true)}>
                    <Sliders className="h-3.5 w-3.5 mr-1" />
                    Settings
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setHelpOpen(true)}>
                    <Book className="h-3.5 w-3.5 mr-1" />
                    Help
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <SquidCloudCard />

                  {providers.map(provider => {
                    const isActive = activeProviderId === provider.id;
                    const usagePercent = provider.storage_limit_bytes
                      ? Math.min(100, Math.round((provider.storage_used_bytes / provider.storage_limit_bytes) * 100))
                      : 0;
                    const isHealthy = provider.health_status === 'healthy';

                    return (
                      <div
                        key={provider.id}
                        className={cn(
                          'rounded-xl border-2 p-3 sm:p-4 transition-all duration-150',
                          isActive
                            ? 'border-primary/40 bg-primary/5'
                            : provider.is_enabled
                              ? 'border-border/50 bg-card hover:border-border hover:bg-accent/30'
                              : 'border-border/30 bg-muted/20 opacity-60'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
                              provider.is_enabled ? 'bg-primary/10' : 'bg-muted/30'
                            )}>
                              <div className={cn(provider.is_enabled ? 'text-primary' : 'text-muted-foreground')}>
                                {getIconForProvider(provider.provider_type)}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium truncate">
                                  {provider.label || provider.bucket_name || provider.provider_type}
                                </p>
                                {isActive && <Badge variant="default" className="h-5 px-1.5 text-[10px]">Active</Badge>}
                                {!provider.is_enabled && <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">Disabled</Badge>}
                                {provider.is_public && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]"><Globe className="h-2.5 w-2.5 mr-0.5" />Public</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {PROVIDER_BRANDING[provider.provider_type]?.label || provider.provider_type}
                                {provider.bucket_name && ` · ${provider.bucket_name}`}
                                {provider.bucket_region && ` · ${provider.bucket_region}`}
                              </p>
                              {provider.last_error && (
                                <p className="text-[11px] text-red-500 mt-0.5 truncate">{provider.last_error}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => onProviderSelect(provider.provider_type, provider.id)}
                              disabled={!provider.is_enabled}
                              className={cn(
                                'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                                isActive
                                  ? 'bg-primary text-primary-foreground'
                                  : provider.is_enabled
                                    ? 'bg-accent/50 text-foreground hover:bg-accent'
                                    : 'bg-muted/30 text-muted-foreground cursor-not-allowed'
                              )}
                            >
                              {isActive ? 'Active' : 'Activate'}
                            </button>
                          </div>
                        </div>

                        {/* Storage usage bar */}
                        {provider.storage_limit_bytes && (
                          <div className="mt-2.5">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>{formatBytes(provider.storage_used_bytes)} / {formatBytes(provider.storage_limit_bytes)}</span>
                              <span>{usagePercent}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all duration-500',
                                  usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-primary'
                                )}
                                style={{ width: `${usagePercent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Permission toggles */}
                        <div className="flex items-center gap-4 mt-2.5 pt-2 border-t border-border/30">
                          <button
                            onClick={() => setPermToggleTarget({ provider, permission: 'read', currentValue: provider.read_enabled })}
                            disabled={!provider.is_enabled}
                            className={cn(
                              'flex items-center gap-1.5 text-[11px] transition-all rounded-md px-1.5 py-1',
                              !provider.is_enabled ? 'text-muted-foreground/30 cursor-not-allowed' :
                                provider.read_enabled ? 'text-green-600 hover:bg-green-500/10' : 'text-muted-foreground hover:bg-accent/30'
                            )}
                            title={provider.read_enabled ? 'Read access: ON (click to disable)' : 'Read access: OFF (click to enable)'}
                          >
                            <span className={cn('h-2 w-2 rounded-full', provider.read_enabled ? 'bg-green-500' : 'bg-muted-foreground/30')} />
                            Read: {provider.read_enabled ? 'ON' : 'OFF'}
                          </button>
                          <button
                            onClick={() => setPermToggleTarget({ provider, permission: 'write', currentValue: provider.write_enabled })}
                            disabled={!provider.is_enabled}
                            className={cn(
                              'flex items-center gap-1.5 text-[11px] transition-all rounded-md px-1.5 py-1',
                              !provider.is_enabled ? 'text-muted-foreground/30 cursor-not-allowed' :
                                provider.write_enabled ? 'text-blue-600 hover:bg-blue-500/10' : 'text-muted-foreground hover:bg-accent/30'
                            )}
                            title={provider.write_enabled ? 'Write access: ON (click to disable)' : 'Write access: OFF (click to enable)'}
                          >
                            <span className={cn('h-2 w-2 rounded-full', provider.write_enabled ? 'bg-blue-500' : 'bg-muted-foreground/30')} />
                            Write: {provider.write_enabled ? 'ON' : 'OFF'}
                          </button>
                        </div>

                        {/* Status + Controls row */}
                        <div className="flex items-center justify-between mt-1.5">
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <span className={cn('h-2 w-2 rounded-full', isHealthy ? 'bg-green-500' : provider.is_enabled ? 'bg-amber-500' : 'bg-muted-foreground/30')} />
                              {isHealthy ? 'Healthy' : provider.is_enabled ? 'Unknown' : 'Disabled'}
                            </span>
                            {provider.last_health_check && (
                              <span>Checked {formatRelativeTime(provider.last_health_check)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => toggleEnabled(provider)}
                              disabled={disablingId === provider.id}
                              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
                              title={provider.is_enabled ? 'Disable' : 'Enable'}
                            >
                              {disablingId === provider.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : provider.is_enabled
                                  ? <Power className="h-3.5 w-3.5" />
                                  : <Power className="h-3.5 w-3.5 opacity-50" />
                              }
                            </button>
                            <button
                              onClick={() => removeProvider(provider)}
                              disabled={deletingId === provider.id}
                              className="rounded-lg p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
                              title="Remove provider"
                            >
                              {deletingId === provider.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />
                              }
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Add provider button */}
              <button
                onClick={() => setAddDialogOpen(true)}
                disabled={providerCount >= 20}
                className={cn(
                  'w-full rounded-xl border-2 border-dashed p-4 text-center transition-all duration-150',
                  providerCount < 20
                    ? 'border-border/50 text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/5'
                    : 'border-border/30 text-muted-foreground/50 cursor-not-allowed'
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {providerCount >= 20 ? 'Maximum 20 buckets reached' : 'Add Storage Bucket'}
                  </span>
                </div>
                <p className="text-xs mt-0.5">
                  Connect AWS S3, Backblaze B2, Cloudflare R2, Tebi, Wasabi, GCP, or any S3-compatible provider
                </p>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <StorageProviderAddDialog
        isOpen={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={handleAddSuccess}
      />

      <StorageSettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <StorageProviderHelp
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
      />

      {/* Permission toggle warning dialog */}
      <AlertDialog open={!!permToggleTarget} onOpenChange={(open) => { if (!open) setPermToggleTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {permToggleTarget?.currentValue
                ? (permToggleTarget.permission === 'read' ? 'Disable Read Access?' : 'Disable Write Access?')
                : (permToggleTarget?.permission === 'read' ? 'Enable Read Access?' : 'Enable Write Access?')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 pt-2">
              {permToggleTarget?.currentValue ? (
                <>
                  {permToggleTarget.permission === 'read' ? (
                    <>
                      <p>You are about to <strong>disable read access</strong> for <strong>{permToggleTarget.provider.label || permToggleTarget.provider.provider_type}</strong>.</p>
                      <p className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                        Files stored on this bucket will not be downloadable until read access is re-enabled.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Existing shares and direct links to files on this bucket will stop working.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>You are about to <strong>disable write access</strong> for <strong>{permToggleTarget.provider.label || permToggleTarget.provider.provider_type}</strong>.</p>
                      <p className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                        New uploads to this bucket will be blocked until write access is re-enabled.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Existing files can still be read, downloaded, and deleted.
                      </p>
                    </>
                  )}
                </>
              ) : (
                <>
                  {permToggleTarget?.permission === 'read' ? (
                    <>
                      <p>You are about to <strong>enable read access</strong> for <strong>{permToggleTarget?.provider.label || permToggleTarget?.provider.provider_type}</strong>.</p>
                      <p className="text-xs text-muted-foreground">
                        Files on this bucket will become downloadable again.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>You are about to <strong>enable write access</strong> for <strong>{permToggleTarget?.provider.label || permToggleTarget?.provider.provider_type}</strong>.</p>
                      <p className="text-xs text-muted-foreground">
                        The bucket will accept new uploads again.
                      </p>
                    </>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={permToggleTarget?.currentValue ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => {
                if (permToggleTarget) {
                  togglePermission(permToggleTarget.provider, permToggleTarget.permission, !permToggleTarget.currentValue);
                }
                setPermToggleTarget(null);
              }}
            >
              {permToggleTarget?.currentValue ? 'Disable' : 'Enable'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
