import React, { useState, useEffect } from 'react';
import { Cloud, HardDrive, CheckCircle, Plus, RefreshCw } from '@/lib/icon-map';
import { supabase } from '@/integrations/supabase/client';

interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  jobId: string | null;
  storage: { used: number; total: number } | null;
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function GoogleDriveLogo() {
  return (
    <svg viewBox="0 0 87.3 78" className="w-7 h-7">
      <path d="M43.65 0L0 75h17.46l43.65-75H43.65z" fill="#4285F4"/>
      <path d="M43.65 0l17.46 30.27L78.6 0H43.65z" fill="#34A853"/>
      <path d="M61.11 30.27L43.65 0 17.46 45h52.38l-8.73-14.73z" fill="#EA4335"/>
      <path d="M78.6 0L43.65 75H61.1l26.2-75H78.6z" fill="#FBBC04"/>
      <path d="M43.65 75H61.1l8.74-15H43.65z" fill="#4285F4"/>
      <path d="M0 75l8.74 15H61.1l8.74-15H0z" fill="#34A853"/>
    </svg>
  );
}

function DropboxLogo() {
  return (
    <svg viewBox="0 0 48 48" className="w-7 h-7">
      <path d="M12 3l12 8.5L12 20 0 11.5 12 3zm24 0l12 8.5L36 20 24 11.5 36 3zM0 29l12-8.5 12 8.5-12 8.5L0 29zm24 0l12-8.5 12 8.5-12 8.5-12-8.5zM12 37.5l12-8.5 12 8.5-12 8.5-12-8.5z" fill="#0061FF"/>
    </svg>
  );
}

function OneDriveLogo() {
  return (
    <svg viewBox="0 0 48 48" className="w-7 h-7">
      <rect width="48" height="48" rx="4" fill="#0078D4" />
      <path d="M15.2 36.5L3 25.2c-.8-.8-.8-2 0-2.8l.1-.1c.8-.8 2.2-.8 3 0l8.9 7.9V14.8c0-1.1.9-1.9 2.1-1.9s2.1.9 2.1 1.9v12.8l5.7-5.3c.8-.8 2.2-.8 3 0l.1.1c.8.8.8 2 0 2.8L18.2 36.5c-.8.8-2.2.8-3 0z" fill="#fff" />
      <path d="M32.8 36.5L45 25.2c.8-.8.8-2 0-2.8l-.1-.1c-.8-.8-2.2-.8-3 0l-8.9 7.9V14.8c0-1.1-.9-1.9-2.1-1.9s-2.1.9-2.1 1.9v12.8l-5.7-5.3c-.8-.8-2.2-.8-3 0l-.1.1c-.8.8-.8 2 0 2.8L30 36.5c.8.8 2.2.8 3 0z" fill="#fff" />
      <path d="M24 38.7c-1.2 0-2.1.9-2.1 2v9c0 1.1.9 2 2.1 2s2.1-.9 2.1-2v-9c0-1.1-.9-2-2.1-2z" fill="#fff" />
    </svg>
  );
}

function ProviderLogo({ id }: { id: string }) {
  switch (id) {
    case 'google-drive': return <GoogleDriveLogo />;
    case 'dropbox': return <DropboxLogo />;
    case 'onedrive': return <OneDriveLogo />;
    default: return <Cloud className="w-7 h-7 text-muted-foreground" />;
  }
}

const PROVIDERS_CONFIG = [
  { id: 'google-drive', name: 'Google Drive', description: 'Import files from Google Drive' },
  { id: 'dropbox', name: 'Dropbox', description: 'Import files from Dropbox' },
  { id: 'onedrive', name: 'OneDrive', description: 'Import files from Microsoft OneDrive' },
];

interface CloudProviderImportProps {
  onConnect: (provider: string) => void;
}

export default function CloudProviderImport({ onConnect }: CloudProviderImportProps) {
  const [providers, setProviders] = useState<ProviderInfo[]>(() =>
    PROVIDERS_CONFIG.map(p => ({ ...p, connected: false, jobId: null, storage: null }))
  );
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id;
      if (!userId) { setLoading(false); return; }

      Promise.all(
        PROVIDERS_CONFIG.map(async (p) => {
          const { data } = await supabase
            .from('migration_jobs')
            .select('id, settings')
            .eq('source_platform', p.id)
            .eq('user_id', userId)
            .not('settings->oauth_tokens', 'is', null)
            .in('status', ['authenticated', 'completed'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!data) return { id: p.id, connected: false, jobId: null, storage: null };

          let storage: { used: number; total: number } | null = null;
          try {
            const { data: storageData } = await supabase.functions.invoke('cloud-file-browser', {
              body: { jobId: data.id, action: 'storage-info' }
            });
            if (storageData?.storage) storage = storageData.storage;
          } catch { /* provider API may be unreachable */ }

          return { id: p.id, connected: true, jobId: data.id, storage };
        })
      ).then(results => {
        setProviders(prev => prev.map(p => {
          const r = results.find(x => x.id === p.id);
          return r ? { ...p, ...r } : p;
        }));
        setLoading(false);
      });
    });
  }, []);

  const handleDisconnect = async (e: React.MouseEvent, provider: ProviderInfo) => {
    e.stopPropagation();
    if (!provider.jobId) return;
    setDisconnecting(provider.id);
    try {
      await supabase
        .from('migration_jobs')
        .update({ settings: { ...provider, oauth_tokens: null } })
        .eq('id', provider.jobId);
      setProviders(prev => prev.map(p => p.id === provider.id ? { ...p, connected: false, jobId: null, storage: null } : p));
    } catch { /* ignore */ }
    finally { setDisconnecting(null); }
  };

  return (
    <div className="space-y-3">
      {providers.map((provider) => (
        <div
          key={provider.id}
          className="rounded-xl border border-border/30 bg-muted/20 p-4 hover:bg-accent/30 transition-all cursor-pointer group"
          onClick={() => !provider.connected && onConnect(provider.id)}
        >
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-white dark:bg-muted/30 flex items-center justify-center shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
              <ProviderLogo id={provider.id} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-semibold text-foreground">{provider.name}</h4>
                <div className="flex items-center gap-2">
                  {provider.connected ? (
                    <>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Connected
                      </span>
                      <button
                        onClick={(e) => handleDisconnect(e, provider)}
                        disabled={disconnecting === provider.id}
                        className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      >
                        {disconnecting === provider.id ? 'Disconnecting\u2026' : 'Disconnect'}
                      </button>
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <Plus className="w-3 h-3" /> Connect
                    </span>
                  )}
                </div>
              </div>
              {provider.connected && provider.storage && (
                <div className="mt-2">
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                    <span>{formatBytes(provider.storage.used)} used</span>
                    <span>{provider.storage.total ? formatBytes(provider.storage.total) : 'N/A'} total</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${Math.min(100, (provider.storage.used / provider.storage.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
