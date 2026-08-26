import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Smartphone, Loader2, Trash2, Plus, Server, Activity, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/* Standalone CLI-devices panel. Isolated hooks + fetching so switching
   categories can never trip hook-order errors (#301) in the parent page. */

interface CliDevice {
  id: string;
  name?: string;
  user_agent?: string;
  platform?: string;
  created_at: string;
  is_banned?: boolean;
}

interface HostKeyRow {
  id: string;
  name: string;
  key_prefix?: string;
  last_used_at?: string | null;
  created_at?: string;
  is_active?: boolean;
}

interface ParsedHost {
  id: string;
  hostId: string;
  hostname: string;
  port: string;
  profile: string;
  mode: string;
  isDecryptor: boolean;
  rawName: string;
  lastUsedAt: string | null;
  createdAt: string | null;
  isActive: boolean;
  markedOffline: boolean;
  online: boolean;
}

function parseHostKey(row: HostKeyRow): ParsedHost {
  // HOST|<hostId>|<hostname>|<port>|<profile>|<mode>[:OFFLINE]
  const parts = row.name.split('|');
  const modePart = parts[5] ?? '';
  const markedOffline = modePart.endsWith(':OFFLINE') || modePart === 'OFFLINE';
  const freshMs = 3 * 60 * 1000;
  const lastUsed = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
  const online = !markedOffline && row.is_active !== false && Date.now() - lastUsed < freshMs;
  const isDecryptor = parts[4] === 'decryptor' || modePart.replace(':OFFLINE', '') === 'DECRYPTOR';
  return {
    id: row.id,
    hostId: parts[1] ?? '',
    hostname: parts[2] ?? 'unknown',
    port: parts[3] ?? '8065',
    profile: parts[4] ?? 'standard',
    mode: modePart.replace(':OFFLINE', ''),
    isDecryptor,
    rawName: row.name,
    lastUsedAt: row.last_used_at ?? null,
    createdAt: row.created_at ?? null,
    isActive: row.is_active !== false,
    markedOffline,
    online,
  };
}

export default function CliDevicesSection() {
  const [devices, setDevices] = useState<CliDevice[]>([]);
  const [hosts, setHosts] = useState<ParsedHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banDeviceId, setBanDeviceId] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [busy, setBusy] = useState(false);
  const fetchedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [{ data: dev }, { data: keys }] = await Promise.all([
        supabase.from('cli_devices').select('*').order('created_at', { ascending: false }),
        supabase.from('api_keys').select('id,name,key_prefix,last_used_at,created_at,is_active')
          .like('name', 'HOST|%').order('last_used_at', { ascending: false }),
      ]);
      setDevices(dev || []);
      setHosts((keys || []).map(parseHostKey));
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    load();
    // realtime-ish polling for host liveness
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const banDevice = async () => {
    if (!banDeviceId) return;
    setBusy(true);
    await supabase.from('cli_devices').update({ is_banned: true }).eq('id', banDeviceId);
    setBusy(false);
    setBanDialogOpen(false);
    load();
  };

  const addDevice = async () => {
    if (!newDeviceName.trim()) return;
    setBusy(true);
    await supabase.from('cli_devices').insert({
      name: newDeviceName.trim(),
      client_id: 'squidcloud-cli',
      status: 'active',
      authorized_at: new Date().toISOString(),
    });
    setNewDeviceName('');
    setBusy(false);
    setAddDialogOpen(false);
    load();
  };

  const revokeHost = async (host: ParsedHost) => {
    await supabase.from('api_keys').delete().eq('id', host.id);
    load();
  };

  const btnSize = 'sm';

  return (
    <div className="space-y-6">
      {/* ── Hosted API servers ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Server className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Hosted API servers</h3>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Activity className="h-3 w-3 animate-pulse text-green-500" />
            live · refreshes every 15s
          </span>
        </div>

        {hosts.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1 py-3 rounded-lg border border-dashed border-border/60">
            No local API hosts yet. Start one from your machine:{' '}
            <code className="font-mono">squidcloudctl host api --profile hardened --mode keyed</code>
          </p>
        ) : (
          <div className="space-y-3">
            {hosts.map((h) => (
              <div key={h.id} className={cn(
                'rounded-xl border p-4 transition-colors',
                h.isDecryptor
                  ? (h.online ? 'border-violet-500/40 bg-violet-500/[0.05]' : 'border-border/40 bg-muted/30')
                  : (h.online ? 'border-green-500/30 bg-green-500/[0.04]' : 'border-border/40 bg-muted/30'),
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('inline-block h-2 w-2 rounded-full',
                        h.online ? (h.isDecryptor ? 'bg-violet-500' : 'bg-green-500') : 'bg-zinc-400')} />
                      <p className="text-sm font-semibold truncate">
                        {h.isDecryptor ? (
                          <>Decryptor <span className="text-muted-foreground font-normal">· :{h.port}</span></>
                        ) : (
                          <>{h.hostname} <span className="text-muted-foreground font-normal">· :{h.port}</span></>
                        )}
                      </p>
                      {h.isDecryptor && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-violet-400">
                          <ShieldCheck className="h-3 w-3" />DECRYPTOR
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground truncate">
                      {h.isDecryptor ? `${h.hostname} · res54 v3/v2/legacy · local-only` : `host-${h.hostId.slice(0, 8)}`}
                    </p>
                  </div>
                  <Button variant="destructive" size={btnSize} className="rounded-lg shrink-0" onClick={() => revokeHost(h)}>
                    <Trash2 className="h-3 w-3 mr-1" />Revoke
                  </Button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-4">
                  {(h.isDecryptor ? [
                    ['state', h.markedOffline ? 'stopped' : h.online ? 'online' : 'offline'],
                    ['role', 'file decryption'],
                    ['crypto', 'res54 v3 · v2 · legacy'],
                    ['location', h.hostname],
                    ['port', ':6763'],
                    ['engine id', `${h.hostId.slice(0, 8)}…`],
                    ['first seen', h.createdAt ? new Date(h.createdAt).toLocaleDateString() : '—'],
                    ['last beat', h.lastUsedAt ? timeAgo(h.lastUsedAt) : 'never'],
                  ] : [
                    ['state', h.markedOffline ? 'stopped' : h.online ? 'online' : 'offline'],
                    ['profile', h.profile],
                    ['mode', h.mode],
                    ['location', h.hostname],
                    ['port', `:${h.port}`],
                    ['api key', `${(h.id.slice(0, 6))}…`],
                    ['first seen', h.createdAt ? new Date(h.createdAt).toLocaleDateString() : '—'],
                    ['last beat', h.lastUsedAt ? timeAgo(h.lastUsedAt) : 'never'],
                  ]).map(([k, v]) => (
                    <div key={k}>
                      <p className="uppercase tracking-wider text-[9px] text-muted-foreground/70">{k}</p>
                      <p className="font-mono mt-0.5 truncate">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Authorized devices ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Smartphone className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Authorized devices</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm">Loading devices...</span>
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border/60 rounded-lg">
            <Smartphone className="mx-auto h-9 w-9 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No CLI devices registered</p>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 bg-muted/30">
                <div className="flex items-center gap-3 min-w-0">
                  <Smartphone className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{device.name || 'Unknown device'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {device.platform || device.user_agent || 'Unknown'} • {new Date(device.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size={btnSize}
                    className="rounded-lg shrink-0"
                    onClick={() => { setBanDeviceId(device.id); setBanDialogOpen(true); }}
                  >
                    <Trash2 className="h-3 w-3 mr-1.5" />Revoke
                  </Button>
                  <span className={cn('text-xs', device.is_banned ? 'text-red-500' : 'text-green-500')}>
                    {device.is_banned ? 'Revoked' : 'Active'}
                  </span>
                </div>
              </div>
            ))}
            <Button variant="outline" size={btnSize} className="w-full rounded-xl mt-1" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-2" />Register device manually
            </Button>
          </div>
        )}
      </div>

      {/* ban dialog */}
      <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke device</AlertDialogTitle>
            <AlertDialogDescription>
              This device will lose access until re-authorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => { e.preventDefault(); banDevice(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Revoking...</> : 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* add dialog */}
      <AlertDialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Register device</AlertDialogTitle>
            <AlertDialogDescription>Give this device a recognizable name.</AlertDialogDescription>
          </AlertDialogHeader>
          <input
            value={newDeviceName}
            onChange={(e) => setNewDeviceName(e.target.value)}
            placeholder="e.g. workstation-ubuntu"
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy || !newDeviceName.trim()} onClick={(e) => { e.preventDefault(); addDevice(); }}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : 'Register'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
