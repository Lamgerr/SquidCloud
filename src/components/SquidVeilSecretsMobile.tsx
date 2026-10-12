import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Lock, Plus, Trash2, KeyRound, RefreshCw, Activity, BarChart3,
  Fingerprint, Copy, Eye, EyeOff, History, CheckCircle2, AlertTriangle,
  ShieldAlert, Info, X, Loader2, ExternalLink, Ban, MoreVertical, Pencil,
  ChevronDown, AlertCircle,
} from '@/lib/icon-map';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';
import {
  squidveilFetch, squidveilBootstrap, getSquidVeilToken, setSquidVeilToken, clearSquidVeilToken,
  getActiveTokenPrefix, setActiveTokenPrefix, clearActiveTokenPrefix,
  type SquidVeilSecret, type SquidVeilToken, type StatsResponse, type MonitorResponse,
} from '@/lib/squidveilClient';
import { supabase } from '@/integrations/supabase/client';

type Tab = 'secrets' | 'tokens' | 'monitor';

const MAX_TOKENS = 3;

const SquidVeilSecretsMobile = () => {
  const { toast } = useToast();
  const [connected, setConnected] = useState(() => !!getSquidVeilToken());
  const [tab, setTab] = useState<Tab>('secrets');

  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapName, setBootstrapName] = useState('');

  const [secrets, setSecrets] = useState<SquidVeilSecret[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tokens, setTokens] = useState<SquidVeilToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [activePrefix, setActivePrefixState] = useState(() => getActiveTokenPrefix());

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [monitor, setMonitor] = useState<MonitorResponse | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createValue, setCreateValue] = useState('');

  const [tokenCreateOpen, setTokenCreateOpen] = useState(false);
  const [creatingToken, setCreatingToken] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenTtl, setTokenTtl] = useState('');
  const [rawToken, setRawToken] = useState<string | null>(null);

  const [actionSecret, setActionSecret] = useState<SquidVeilSecret | null>(null);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [secretVersions, setSecretVersions] = useState<any[]>([]);

  const [rotatingToken, setRotatingToken] = useState<string | null>(null);
  const [rotatedRaw, setRotatedRaw] = useState<string | null>(null);

  const [deleteTokenId, setDeleteTokenId] = useState<{ id: string; name: string } | null>(null);
  const [deleteTokenConfirmName, setDeleteTokenConfirmName] = useState('');
  const [deletingToken, setDeletingToken] = useState(false);

  const fetchSecrets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await squidveilFetch<{ secrets: SquidVeilSecret[] }>('/v1/secrets');
      setSecrets(data.secrets || []);
    } catch (e: any) {
      if (e.code === 'INVALID_TOKEN' || e.code === 'REVOKED' || e.status === 401) {
        setConnected(false);
        clearSquidVeilToken();
        clearActiveTokenPrefix();
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTokens = useCallback(async () => {
    setLoadingTokens(true);
    try {
      const data = await squidveilFetch<{ tokens: SquidVeilToken[] }>('/v1/tokens');
      setTokens(data.tokens || []);
    } catch (e: any) {
      if (e.status !== 403) toast({ title: 'Failed to load tokens', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingTokens(false);
    }
  }, [toast]);

  const fetchMonitor = useCallback(async () => {
    try {
      const [statsData, monitorData] = await Promise.all([
        squidveilFetch<StatsResponse>('/v1/stats?days=30&top=5'),
        squidveilFetch<MonitorResponse>('/v1/monitor'),
      ]);
      setStats(statsData);
      setMonitor(monitorData);
    } catch (e: any) {
      if (e.status !== 403) toast({ title: 'Failed to load monitor', description: e.message, variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    if (connected) {
      fetchSecrets();
      fetchTokens();
    }
  }, [connected, fetchSecrets, fetchTokens]);

  useEffect(() => {
    if (connected && tab === 'monitor') fetchMonitor();
  }, [connected, tab, fetchMonitor]);

  const handleBootstrap = async () => {
    setBootstrapping(true);
    setBootstrapError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionJwt = sessionData?.session?.access_token;
      if (!sessionJwt) throw new Error('You must be signed in to create a token');
      const result = await squidveilBootstrap(sessionJwt, bootstrapName);
      if (!result.success || !result.raw_token) {
        throw new Error('Token was created but the raw value was not returned');
      }
      setSquidVeilToken(result.raw_token);
      setActiveTokenPrefix(result.token.token_prefix);
      setActivePrefixState(result.token.token_prefix);
      setConnected(true);
      setRawToken(result.raw_token);
      setBootstrapName('');
      toast({ title: 'Token created', description: 'You can now manage secrets from this dashboard.' });
      fetchSecrets();
      fetchTokens();
    } catch (e: any) {
      if (e.code === 'ALREADY_BOOTSTRAPPED') {
        setBootstrapError('An active token already exists. Reconnect with its saved value — or, if none of your tokens work anymore, tap Create again to be issued a fresh one.');
      } else if (e.message && e.message.toLowerCase().includes('unauthenticated')) {
        setBootstrapError('Your session has expired. Sign out and back in, then try again.');
      } else {
        setBootstrapError(e.message || 'Could not create the token. Please try again.');
      }
    } finally {
      setBootstrapping(false);
    }
  };

  const handleDisconnect = () => {
    clearSquidVeilToken();
    clearActiveTokenPrefix();
    setActivePrefixState(null);
    setConnected(false);
    setSecrets([]);
    setTokens([]);
    setStats(null);
    setMonitor(null);
  };

  const handleCreate = async () => {
    if (!createName.trim() || !createValue.trim()) return;
    setCreating(true);
    try {
      const data = await squidveilFetch('/v1/secrets', {
        method: 'POST',
        body: JSON.stringify({ name: createName.trim(), value: createValue.trim(), recovery_window_days: 7 }),
      });
      setSecrets(prev => [data.secret, ...prev]);
      setCreateOpen(false);
      setCreateName('');
      setCreateValue('');
      toast({ title: 'Secret created', description: data.secret.name });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateToken = async () => {
    if (!tokenName.trim()) return;
    if (tokens.length >= MAX_TOKENS) {
      toast({ title: 'Token limit reached', description: `You can have up to ${MAX_TOKENS} tokens. Revoke or delete one to create another.`, variant: 'destructive' });
      return;
    }
    setCreatingToken(true);
    try {
      const body: Record<string, unknown> = { name: tokenName.trim(), policies: ['default'] };
      if (tokenTtl.trim()) {
        const ttl = Number(tokenTtl.trim());
        if (Number.isFinite(ttl) && ttl > 0) body.expires_in_seconds = Math.floor(ttl * 86400);
      }
      const data = await squidveilFetch<{ token: SquidVeilToken; raw_token: string }>('/v1/tokens', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setRawToken(data.raw_token);
      setSquidVeilToken(data.raw_token);
      setActiveTokenPrefix(data.token.token_prefix);
      setActivePrefixState(data.token.token_prefix);
      setTokens(prev => [data.token, ...prev]);
      setTokenName('');
      setTokenTtl('');
      setTokenCreateOpen(false);
      toast({ title: 'Token created', description: 'The new token is now the active token for this dashboard.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setCreatingToken(false);
    }
  };

  const openSecretActions = async (secret: SquidVeilSecret) => {
    setActionSecret(secret);
    setRevealedValue(null);
    setSecretVersions([]);
  };

  const handleRead = async () => {
    if (!actionSecret) return;
    if (revealedValue) { setRevealedValue(null); return; }
    setReading(true);
    try {
      const data = await squidveilFetch<{ value: string }>(`/v1/secrets/${encodeURIComponent(actionSecret.name)}`);
      setRevealedValue(data.value);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setReading(false);
    }
  };

  const handleRotate = async (secret: SquidVeilSecret) => {
    try {
      await squidveilFetch(`/v1/secrets/${encodeURIComponent(secret.name)}/rotate`, { method: 'POST', body: JSON.stringify({}) });
      setActionSecret(null);
      toast({ title: 'Secret rotated', description: `${secret.name} — new value generated` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const loadVersions = async (secret: SquidVeilSecret) => {
    try {
      const data = await squidveilFetch<{ versions: any[] }>(`/v1/secrets/${encodeURIComponent(secret.name)}/versions`);
      setSecretVersions(data.versions || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteSecret = async (secret: SquidVeilSecret) => {
    try {
      await squidveilFetch(`/v1/secrets/${encodeURIComponent(secret.name)}`, { method: 'DELETE' });
      setActionSecret(null);
      fetchSecrets();
      toast({ title: 'Secret deleted', description: 'Restorable within the recovery window' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleUndelete = async (name: string) => {
    try {
      await squidveilFetch(`/v1/secrets/${encodeURIComponent(name)}/undelete`, { method: 'POST', body: JSON.stringify({}) });
      fetchSecrets();
      toast({ title: 'Secret restored', description: name });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleRotateToken = async (token: SquidVeilToken) => {
    setRotatingToken(token.id);
    try {
      const data = await squidveilFetch<{ token: SquidVeilToken; raw_token: string }>(`/v1/tokens/${token.id}/rotate`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setRotatedRaw(data.raw_token);
      const wasActive = token.token_prefix === getActiveTokenPrefix();
      if (wasActive) {
        setSquidVeilToken(data.raw_token);
        setActiveTokenPrefix(data.token.token_prefix);
        setActivePrefixState(data.token.token_prefix);
      }
      setTokens(prev => prev.map(t => t.id === token.id ? { ...t, token_prefix: data.token.token_prefix } : t));
      toast({ title: 'Token rotated', description: wasActive ? 'Active token updated with the new value' : 'Previous value invalidated' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRotatingToken(null);
    }
  };

  const handleRevokeToken = async (token: SquidVeilToken) => {
    try {
      await squidveilFetch(`/v1/tokens/${token.id}/revoke`, { method: 'POST', body: JSON.stringify({}) });
      const wasActive = token.token_prefix === getActiveTokenPrefix();
      if (wasActive) {
        clearSquidVeilToken();
        clearActiveTokenPrefix();
        setActivePrefixState(null);
        setConnected(false);
      }
      setTokens(prev => prev.map(t => t.id === token.id ? { ...t, revoked_at: new Date().toISOString() } : t));
      toast({ title: 'Token revoked', description: wasActive ? 'The active token was revoked — dashboard disconnected' : token.name });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteToken = async () => {
    if (!deleteTokenId || deleteTokenConfirmName !== deleteTokenId.name) return;
    setDeletingToken(true);
    try {
      await squidveilFetch(`/v1/tokens/${deleteTokenId.id}`, { method: 'DELETE' });
      const wasActive = deleteTokenId.name === getActiveTokenPrefix();
      if (wasActive) {
        clearSquidVeilToken();
        clearActiveTokenPrefix();
        setActivePrefixState(null);
        setConnected(false);
      }
      setTokens(prev => prev.filter(t => t.id !== deleteTokenId.id));
      setDeleteTokenId(null);
      setDeleteTokenConfirmName('');
      toast({ title: 'Token deleted permanently' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setDeletingToken(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied to clipboard' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  const activeSecrets = secrets.filter(s => !s.deleted_at);
  const deletedSecrets = secrets.filter(s => s.deleted_at);

  if (!connected) {
    return (
      <div className="p-4 space-y-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent border border-violet-500/20 p-4">
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">SquidVeil Secrets</h1>
              <p className="text-xs text-white/50">Encrypted secrets, tokens & monitoring</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5">
          <div className="flex flex-col items-center text-center py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 mb-3">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold text-white">Create your first token</h2>
            <p className="text-xs text-white/50 mt-1 mb-4 max-w-xs">
              SquidVeil issues an <span className="text-violet-400">sv_</span> access token for your account.
              It is shown only once — store it somewhere safe. The token is then used automatically by this
              dashboard. You can hold up to 3 tokens.
            </p>
            <input
              type="text"
              value={bootstrapName}
              onChange={e => setBootstrapName(e.target.value)}
              placeholder="Token name (e.g. dashboard-admin)"
              maxLength={100}
              className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50 transition-colors"
              onKeyDown={e => e.key === 'Enter' && !bootstrapping && handleBootstrap()}
            />
            <button
              onClick={handleBootstrap}
              disabled={bootstrapping || !bootstrapName.trim()}
              className="mt-3 w-full h-10 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-40 flex items-center justify-center gap-1.5 text-sm font-medium transition-all"
            >
              {bootstrapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {bootstrapping ? 'Creating token...' : 'Create my first token'}
            </button>
            {bootstrapError && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 mt-3 text-left w-full">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300/80 leading-relaxed">{bootstrapError}</p>
              </div>
            )}
            <a
              href="/help/squidveil"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 mt-3"
            >
              <ExternalLink className="w-3 h-3" />
              Read the SquidVeil documentation
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent border border-violet-500/20 p-4">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">SquidVeil Secrets</h1>
              <p className="text-xs text-white/50">{activeSecrets.length} active secrets</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href="/help/squidveil"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/40"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={handleDisconnect}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/40"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] border border-white/10 p-1">
        {([
          { id: 'secrets', label: 'Secrets', icon: Lock },
          { id: 'tokens', label: 'Tokens', icon: KeyRound },
          { id: 'monitor', label: 'Monitor', icon: Activity },
        ] as { id: Tab; label: string; icon: any }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-medium transition-all',
              tab === t.id
                ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30'
                : 'text-white/40',
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'secrets' && (
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-10 text-center px-6">
              <AlertTriangle className="h-6 w-6 text-red-400 mb-2" />
              <p className="text-xs text-red-400">{error}</p>
              <button onClick={fetchSecrets} className="mt-2 text-xs text-violet-400 underline underline-offset-2">Retry</button>
            </div>
          ) : activeSecrets.length === 0 && deletedSecrets.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Lock className="h-6 w-6 text-white/20 mb-2" />
              <p className="text-sm text-white/40">No secrets yet</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {activeSecrets.map(secret => (
                <button
                  key={secret.id}
                  onClick={() => openSecretActions(secret)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 flex-shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/90 truncate">{secret.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">Created {formatDate(secret.created_at)}</p>
                  </div>
                  <MoreVertical className="w-4 h-4 text-white/20" />
                </button>
              ))}
              {deletedSecrets.map(secret => (
                <div key={secret.id} className="flex items-center gap-3 px-4 py-3 bg-amber-500/[0.03]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 flex-shrink-0">
                    <Ban className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/60 truncate">{secret.name}</p>
                    <p className="text-xs text-amber-300/50">Pending purge · {formatDate(secret.delete_after)}</p>
                  </div>
                  <button
                    onClick={() => handleUndelete(secret.name)}
                    className="flex h-7 px-2.5 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setCreateOpen(true)}
            className="w-full flex items-center justify-center gap-2 h-11 border-t border-white/5 text-violet-300 hover:bg-violet-500/5 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Secret
          </button>
        </div>
      )}

      {tab === 'tokens' && (
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
          {loadingTokens ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <KeyRound className="h-6 w-6 text-white/20 mb-2" />
              <p className="text-sm text-white/40">No tokens yet</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {tokens.map(token => {
                const expired = !token.revoked_at && token.expires_at && new Date(token.expires_at) <= new Date();
                return (
                  <div key={token.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0',
                        token.revoked_at ? 'bg-red-500/10 text-red-400' : expired ? 'bg-amber-500/10 text-amber-400' : 'bg-violet-500/10 text-violet-400',
                      )}>
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white/90 truncate">{token.name}</p>
                          {token.token_prefix === activePrefix && !token.revoked_at && !expired && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide text-violet-200/90 bg-violet-500/15 border border-violet-500/25">Active</span>
                          )}
                          {token.revoked_at && <span className="px-1.5 py-0.5 rounded text-[9px] uppercase text-red-300/80 bg-red-500/10">Revoked</span>}
                          {expired && <span className="px-1.5 py-0.5 rounded text-[9px] uppercase text-amber-300/80 bg-amber-500/10">Expired</span>}
                        </div>
                        <p className="text-xs text-white/40 mt-0.5">
                          <code className="text-violet-300/80">{token.token_prefix}...</code>
                          {' · '}{formatDate(token.created_at)}
                        </p>
                        {rotatedRaw && rotatingToken === null && (
                          <code className="block mt-2 text-[10px] text-emerald-300/90 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 break-all">
                            {rotatedRaw}
                          </code>
                        )}
                      </div>
                      {!token.revoked_at && !expired && (
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleRotateToken(token)}
                            disabled={rotatingToken === token.id}
                            className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/20 text-xs disabled:opacity-40"
                          >
                            {rotatingToken === token.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Rotate
                          </button>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleRevokeToken(token)}
                              className="flex h-7 px-2 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs"
                            >
                              <Ban className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setDeleteTokenId({ id: token.id, name: token.name })}
                              className="flex h-7 px-2 rounded-lg bg-red-500/10 text-red-300 border border-red-500/20 text-xs"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {rotatedRaw && rotatingToken === null && (
                      <div className="flex items-center gap-2 mt-1 ml-11">
                        <button
                          onClick={() => handleCopy(rotatedRaw)}
                          className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-white/5 text-white/50 border border-white/10 text-xs"
                        >
                          <Copy className="w-3 h-3" />
                          Copy
                        </button>
                        <button onClick={() => setRotatedRaw(null)} className="flex h-7 px-2.5 rounded-lg bg-white/5 text-white/40 border border-white/10 text-xs">
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <button
            onClick={() => setTokenCreateOpen(true)}
            disabled={tokens.length >= MAX_TOKENS}
            className="w-full flex items-center justify-center gap-2 h-11 border-t border-white/5 text-violet-300 hover:bg-violet-500/5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            New Token
            {tokens.length > 0 && <span className="text-[10px] text-white/30">({tokens.length} / {MAX_TOKENS})</span>}
          </button>
        </div>
      )}

      {tab === 'monitor' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: 'Reads 24h', value: monitor?.activity_24h.reads ?? 0, icon: Eye },
              { label: 'Failed auth 24h', value: monitor?.activity_24h.failed_auth ?? 0, icon: ShieldAlert },
              { label: 'Active tokens', value: monitor?.tokens.active ?? 0, icon: KeyRound },
              { label: 'Secrets', value: monitor?.secrets.total ?? 0, icon: Lock },
            ] as { label: string; value: number; icon: any }[]).map(card => (
              <div key={card.label} className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5">
                <card.icon className={cn('w-4 h-4 mb-2', card.label.includes('Failed') && card.value > 0 ? 'text-red-400' : 'text-violet-400')} />
                <p className="text-xl font-bold text-white">{card.value}</p>
                <p className="text-[10px] uppercase tracking-wide text-white/30">{card.label}</p>
              </div>
            ))}
          </div>

          {stats && stats.activity.length > 0 && (
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-white">Activity — 30 days</h3>
              </div>
              <div className="flex items-end gap-0.5 h-20">
                {stats.activity.map((day, i) => {
                  const total = Math.max(day.reads, day.writes, day.veilrefs, day.rotations);
                  const maxTotal = Math.max(1, ...stats.activity.map(a => Math.max(a.reads, a.writes, a.veilrefs, a.rotations)));
                  const isToday = i === stats.activity.length - 1;
                  return (
                    <div
                      key={day.day}
                      className={cn('flex-1 rounded-t', isToday ? 'bg-violet-400' : 'bg-violet-500/30')}
                      style={{ height: `${(total / maxTotal) * 100}%`, minHeight: total > 0 ? '2px' : '1px' }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {monitor?.audit && (
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 flex items-center gap-3">
              {monitor.audit.valid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              )}
              <div>
                <p className={cn('text-sm font-medium', monitor.audit.valid ? 'text-emerald-300' : 'text-red-300')}>
                  {monitor.audit.valid ? 'Audit chain intact' : 'Audit chain broken'}
                </p>
                <p className="text-xs text-white/30">{monitor.audit.checked} entries verified</p>
              </div>
            </div>
          )}

          {monitor && monitor.recent_failed_auth.length > 0 && (
            <div className="rounded-2xl bg-red-500/[0.04] border border-red-500/15 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-semibold text-white">Failed attempts</h3>
              </div>
              {monitor.recent_failed_auth.slice(0, 4).map(f => (
                <div key={f.seq} className="flex items-center gap-2 py-1 text-xs">
                  <span className="text-red-300/80 font-medium w-20 flex-shrink-0">{f.detail}</span>
                  <span className="text-white/30 truncate flex-1">{f.ip || '—'}</span>
                  <span className="text-white/30">{formatDate(f.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <BottomSheet open={createOpen} onOpenChange={setCreateOpen}>
        <BottomSheetContent hideClose className="rounded-t-[28px] bg-[#0a0a0f]">
          <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold text-white">New Secret</h2>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Secret Name</label>
              <input
                type="text"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="e.g. STRIPE_API_KEY"
                className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Secret Value</label>
              <textarea
                value={createValue}
                onChange={e => setCreateValue(e.target.value)}
                placeholder="Paste the secret value..."
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50 resize-none"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !createName.trim() || !createValue.trim()}
              className="w-full h-11 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-40 flex items-center justify-center gap-2 text-sm font-medium"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Secret
            </button>
          </div>
        </BottomSheetContent>
      </BottomSheet>

      <BottomSheet open={tokenCreateOpen} onOpenChange={o => { if (!o) setRawToken(null); setTokenCreateOpen(o); }}>
        <BottomSheetContent hideClose className="rounded-t-[28px] bg-[#0a0a0f]">
          <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold text-white">New Access Token</h2>
            {tokens.length >= MAX_TOKENS && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300/80">
                  Limit reached ({MAX_TOKENS} tokens). Revoke or delete one to create another.
                </p>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-xl bg-violet-500/10 border border-violet-500/20 px-4 py-3">
              <Info className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <p className="text-xs text-violet-300/80">
                The new token becomes the active token for this dashboard. Store the raw token securely — it is shown only once.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Token Name</label>
              <input
                type="text"
                value={tokenName}
                onChange={e => setTokenName(e.target.value)}
                placeholder="e.g. production-ci"
                className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Expiry (days, optional)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={tokenTtl}
                onChange={e => setTokenTtl(e.target.value)}
                placeholder="Never expires"
                className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50"
              />
            </div>
            <button
              onClick={handleCreateToken}
              disabled={creatingToken || !tokenName.trim()}
              className="w-full h-11 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-40 flex items-center justify-center gap-2 text-sm font-medium"
            >
              {creatingToken && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Token
            </button>
          </div>
        </BottomSheetContent>
      </BottomSheet>

      <BottomSheet open={!!rawToken} onOpenChange={o => !o && setRawToken(null)}>
        <BottomSheetContent hideClose className="rounded-t-[28px] bg-[#0a0a0f] border-violet-500/20">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Token created</h2>
            </div>
            <p className="text-xs text-white/50">Shown once — copy it now.</p>
            {rawToken && (
              <code className="block w-full text-xs text-emerald-300/90 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-2.5 break-all">
                {rawToken}
              </code>
            )}
            <button
              onClick={() => rawToken && handleCopy(rawToken)}
              className="w-full h-10 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center justify-center gap-1.5 text-sm font-medium"
            >
              <Copy className="w-4 h-4" />
              Copy token
            </button>
            <button
              onClick={() => setRawToken(null)}
              className="w-full h-9 rounded-xl text-white/50 text-sm"
            >
              Done
            </button>
          </div>
        </BottomSheetContent>
      </BottomSheet>

      <BottomSheet open={!!actionSecret} onOpenChange={o => !o && setActionSecret(null)}>
        <BottomSheetContent hideClose className="rounded-t-[28px] bg-[#0a0a0f]">
          <div className="p-4 space-y-4">
            {actionSecret && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-white truncate">{actionSecret.name}</h2>
                    <p className="text-xs text-white/40">Created {formatDate(actionSecret.created_at)}</p>
                  </div>
                </div>

                {revealedValue ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 text-xs text-emerald-300/90 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-2.5 break-all max-h-24 overflow-y-auto">
                      {revealedValue}
                    </code>
                    <button
                      onClick={() => handleCopy(revealedValue)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/40 flex-shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleRead}
                    disabled={reading}
                    className="w-full h-10 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center justify-center gap-1.5 text-sm font-medium disabled:opacity-40"
                  >
                    {reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    {reading ? 'Reading...' : 'Read value'}
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleRotate(actionSecret)}
                    className="h-10 rounded-xl bg-white/5 border border-white/10 text-white/60 flex items-center justify-center gap-1.5 text-xs font-medium"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Rotate
                  </button>
                  <button
                    onClick={() => loadVersions(actionSecret)}
                    className="h-10 rounded-xl bg-white/5 border border-white/10 text-white/60 flex items-center justify-center gap-1.5 text-xs font-medium"
                  >
                    <History className="w-3.5 h-3.5" />
                    Versions
                  </button>
                </div>

                {secretVersions.length > 0 && (
                  <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 space-y-1.5">
                    {secretVersions.map(v => (
                      <div key={v.version_number} className="flex items-center gap-2 text-xs">
                        <span className="text-white/60 font-medium w-6">v{v.version_number}</span>
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[9px] uppercase',
                          v.state === 'ENABLED' && 'text-emerald-300/80 bg-emerald-500/10',
                          v.state === 'DISABLED' && 'text-amber-300/80 bg-amber-500/10',
                          v.state === 'DESTROYED' && 'text-red-300/80 bg-red-500/10',
                        )}>
                          {v.state}
                        </span>
                        <span className="text-white/30 truncate flex-1">by {v.created_by || 'system'} · {formatDate(v.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => handleDeleteSecret(actionSecret)}
                  className="w-full h-10 rounded-xl bg-red-500/10 text-red-300 border border-red-500/20 flex items-center justify-center gap-1.5 text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete secret
                </button>
              </>
            )}
          </div>
        </BottomSheetContent>
      </BottomSheet>

      <BottomSheet open={!!deleteTokenId} onOpenChange={o => { if (!o) { setDeleteTokenId(null); setDeleteTokenConfirmName(''); } }}>
        <BottomSheetContent hideClose className="rounded-t-[28px] bg-[#0a0a0f]">
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-semibold text-white">Delete Token</h2>
            </div>
            <p className="text-xs text-white/50">Permanent — the token can never be used again.</p>
            {deleteTokenId && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-300/80 leading-relaxed">
                  {deleteTokenId.name === activePrefix
                    ? 'This is the token the dashboard is using. Deleting it will disconnect SquidVeil from this dashboard.'
                    : 'All applications using this token will lose access immediately.'}
                </p>
              </div>
            )}
            {deleteTokenId && (
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Type <span className="font-mono text-white font-semibold">{deleteTokenId.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteTokenConfirmName}
                  onChange={e => setDeleteTokenConfirmName(e.target.value)}
                  placeholder={deleteTokenId.name}
                  className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/25 outline-none focus:border-red-500/40 font-mono"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteTokenId(null); setDeleteTokenConfirmName(''); }}
                className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteToken}
                disabled={deletingToken || !deleteTokenId || deleteTokenConfirmName !== deleteTokenId.name}
                className="flex-1 h-10 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 flex items-center justify-center gap-1.5 text-sm font-medium disabled:opacity-40"
              >
                {deletingToken && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete Token
              </button>
            </div>
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
};

export default SquidVeilSecretsMobile;
