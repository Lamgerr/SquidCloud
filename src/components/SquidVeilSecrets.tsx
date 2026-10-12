import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Lock, Plus, Trash2, KeyRound, RefreshCw, Shield, ShieldCheck,
  Activity, BarChart3, Fingerprint, Copy, Eye, EyeOff, History,
  Settings2, CheckCircle2, AlertTriangle, ShieldAlert, Gauge,
  Database, Bell, Search, Info, X, Loader2, ExternalLink, ChevronDown,
  Ban, Clock, Redo, MoreVertical, Pencil, AlertCircle,
} from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  squidveilFetch, squidveilBootstrap, getSquidVeilToken, setSquidVeilToken, clearSquidVeilToken,
  getActiveTokenPrefix, setActiveTokenPrefix, clearActiveTokenPrefix,
  type SquidVeilSecret, type SquidVeilToken, type StatsResponse, type MonitorResponse,
} from '@/lib/squidveilClient';
import { supabase } from '@/integrations/supabase/client';

type Tab = 'secrets' | 'tokens' | 'monitor';

const MAX_TOKENS = 3;

const SquidVeilSecrets = () => {
  const { toast } = useToast();
  const [connected, setConnected] = useState(() => !!getSquidVeilToken());
  const [tab, setTab] = useState<Tab>('secrets');

  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapName, setBootstrapName] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importValue, setImportValue] = useState('');
  const [importing, setImporting] = useState(false);

  const [secrets, setSecrets] = useState<SquidVeilSecret[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tokens, setTokens] = useState<SquidVeilToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [activePrefix, setActivePrefixState] = useState(() => getActiveTokenPrefix());

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [monitor, setMonitor] = useState<MonitorResponse | null>(null);
  const [loadingMonitor, setLoadingMonitor] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createValue, setCreateValue] = useState('');
  const [createType, setCreateType] = useState('opaque');

  const [showTokenCreate, setShowTokenCreate] = useState(false);
  const [creatingToken, setCreatingToken] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenTtl, setTokenTtl] = useState('');
  const [rawToken, setRawToken] = useState<string | null>(null);

  const [rotatingToken, setRotatingToken] = useState<string | null>(null);
  const [rotatedRaw, setRotatedRaw] = useState<{ id: string; name: string; raw: string } | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [reading, setReading] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [versions, setVersions] = useState<Record<string, any[]>>({});
  const [loadingVersions, setLoadingVersions] = useState<string | null>(null);

  const [showTokenDelete, setShowTokenDelete] = useState<{ id: string; name: string } | null>(null);
  const [tokenDeleteConfirmName, setTokenDeleteConfirmName] = useState('');
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
      // token list requires token_admin — ignore for read-only tokens
      if (e.status !== 403) toast({ title: 'Failed to load tokens', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingTokens(false);
    }
  }, [toast]);

  const fetchMonitor = useCallback(async () => {
    setLoadingMonitor(true);
    try {
      const [statsData, monitorData] = await Promise.all([
        squidveilFetch<StatsResponse>('/v1/stats?days=30&top=6'),
        squidveilFetch<MonitorResponse>('/v1/monitor'),
      ]);
      setStats(statsData);
      setMonitor(monitorData);
    } catch (e: any) {
      if (e.status !== 403) toast({ title: 'Failed to load monitor', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingMonitor(false);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setBootstrapError('Sign in to your account first, then try again.');
        return;
      }
      const data = await squidveilBootstrap(session.access_token, bootstrapName);
      setSquidVeilToken(data.raw_token);
      setActiveTokenPrefix(data.token.token_prefix);
      setActivePrefixState(data.token.token_prefix);
      setConnected(true);
      setRawToken(data.raw_token);
      setBootstrapName('');
      toast({ title: 'Token created', description: `${data.token.name} — saved and ready to use` });
    } catch (e: any) {
      if (e.code === 'ALREADY_BOOTSTRAPPED') {
        setBootstrapError(
          'That account already has an active token. Paste its saved value below to reconnect — token values are shown only once, so a lost value can only be replaced by rotating from the Tokens tab once connected.',
        );
        setShowImport(true);
      } else {
        setBootstrapError(e.message || 'Failed to create token. Please try again.');
      }
    } finally {
      setBootstrapping(false);
    }
  };

  // Reconnect with a previously saved token value (e.g. after switching
  // browsers, clearing site data, or letting a TTL token lapse while a
  // sibling token stayed active). A 401 means the value is dead; anything
  // else (including 403 on the admin-only token list) proves it is live.
  const handleImportToken = async () => {
    const raw = importValue.trim();
    if (!raw) return;
    setImporting(true);
    try {
      setSquidVeilToken(raw);
      setActiveTokenPrefix(raw.slice(0, 8));
      setActivePrefixState(raw.slice(0, 8));
      try {
        await squidveilFetch('/v1/tokens');
      } catch (probe: any) {
        if (probe?.status === 401 || probe?.code === 'INVALID_TOKEN' || probe?.code === 'REVOKED') {
          throw new Error('That token value is no longer valid. Create a fresh one above instead.');
        }
      }
      setImportValue('');
      setShowImport(false);
      setBootstrapError(null);
      setConnected(true);
      toast({ title: 'Token connected', description: 'Dashboard unlocked with your saved token.' });
    } catch (e: any) {
      clearSquidVeilToken();
      clearActiveTokenPrefix();
      toast({ title: 'Could not connect', description: e.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleDisconnect = () => {
    clearSquidVeilToken();
    clearActiveTokenPrefix();
    setConnected(false);
    setSecrets([]);
    setTokens([]);
    setStats(null);
    setMonitor(null);
    setRawToken(null);
    setRotatedRaw(null);
  };

  const handleCreate = async () => {
    if (!createName.trim() || !createValue.trim()) return;
    setCreating(true);
    try {
      const data = await squidveilFetch('/v1/secrets', {
        method: 'POST',
        body: JSON.stringify({
          name: createName.trim(),
          value: createValue.trim(),
          secret_type: createType,
          recovery_window_days: 7,
        }),
      });
      setSecrets(prev => [data.secret, ...prev]);
      setShowCreate(false);
      setCreateName('');
      setCreateValue('');
      setCreateType('opaque');
      toast({ title: 'Secret created', description: data.secret.name });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleRead = async (secret: SquidVeilSecret) => {
    if (revealed[secret.name]) {
      setRevealed(prev => { const next = { ...prev }; delete next[secret.name]; return next; });
      return;
    }
    setReading(secret.name);
    try {
      const data = await squidveilFetch<{ value: string; version: number }>(`/v1/secrets/${encodeURIComponent(secret.name)}`);
      setRevealed(prev => ({ ...prev, [secret.name]: data.value }));
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setReading(null);
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

  const handleRotate = async (secret: SquidVeilSecret) => {
    try {
      await squidveilFetch(`/v1/secrets/${encodeURIComponent(secret.name)}/rotate`, { method: 'POST', body: JSON.stringify({}) });
      toast({ title: 'Secret rotated', description: `${secret.name} — new value generated` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await squidveilFetch(`/v1/secrets/${encodeURIComponent(deleteId)}`, { method: 'DELETE' });
      setSecrets(prev => prev.filter(s => s.name !== deleteId));
      setDeleteId(null);
      toast({ title: 'Secret deleted', description: 'Soft delete — restore within the recovery window' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
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

  const handleDestroy = async (name: string) => {
    try {
      await squidveilFetch(`/v1/secrets/${encodeURIComponent(name)}/destroy`, { method: 'POST', body: JSON.stringify({}) });
      fetchSecrets();
      toast({ title: 'Secret destroyed permanently', description: name });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const toggleVersions = async (secret: SquidVeilSecret) => {
    const name = secret.name;
    if (expanded[name]) {
      setExpanded(prev => { const next = { ...prev }; delete next[name]; return next; });
      return;
    }
    setLoadingVersions(name);
    try {
      const data = await squidveilFetch<{ versions: any[] }>(`/v1/secrets/${encodeURIComponent(name)}/versions`);
      setVersions(prev => ({ ...prev, [name]: data.versions || [] }));
      setExpanded(prev => ({ ...prev, [name]: true }));
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingVersions(null);
    }
  };

  const handleCreateToken = async () => {
    if (!tokenName.trim()) return;
    if (tokens.length >= MAX_TOKENS) {
      toast({
        title: 'Token limit reached',
        description: `You can have up to ${MAX_TOKENS} tokens. Revoke or delete one to create another.`,
        variant: 'destructive',
      });
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
      setShowTokenCreate(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setCreatingToken(false);
    }
  };

  const handleRotateToken = async (token: SquidVeilToken) => {
    setRotatingToken(token.id);
    try {
      const data = await squidveilFetch<{ token: SquidVeilToken; raw_token: string }>(`/v1/tokens/${token.id}/rotate`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setRotatedRaw({ id: token.id, name: token.name, raw: data.raw_token });
      setTokens(prev => prev.map(t => t.id === token.id ? { ...t, token_prefix: data.token.token_prefix } : t));
      if (getActiveTokenPrefix() === token.token_prefix) {
        setSquidVeilToken(data.raw_token);
        setActiveTokenPrefix(data.token.token_prefix);
        setActivePrefixState(data.token.token_prefix);
        toast({ title: 'Active token rotated', description: 'The dashboard is now using the new token value' });
      } else {
        toast({ title: 'Token rotated', description: `${token.name} — previous value invalidated` });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRotatingToken(null);
    }
  };

  const handleRevokeToken = async (token: SquidVeilToken) => {
    try {
      await squidveilFetch(`/v1/tokens/${token.id}/revoke`, { method: 'POST', body: JSON.stringify({}) });
      setTokens(prev => prev.map(t => t.id === token.id ? { ...t, revoked_at: new Date().toISOString() } : t));
      if (getActiveTokenPrefix() === token.token_prefix) {
        clearSquidVeilToken();
        clearActiveTokenPrefix();
        setConnected(false);
        setSecrets([]);
        setTokens([]);
        toast({ title: 'Active token revoked', description: 'You revoked the token the dashboard was using.', variant: 'destructive' });
      } else {
        toast({ title: 'Token revoked', description: token.name });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteToken = async () => {
    if (!showTokenDelete) return;
    setDeletingToken(true);
    try {
      await squidveilFetch(`/v1/tokens/${showTokenDelete.id}`, { method: 'DELETE' });
      const wasActive = getActiveTokenPrefix() === showTokenDelete.name || tokens.find(t => t.id === showTokenDelete.id)?.token_prefix === getActiveTokenPrefix();
      setTokens(prev => prev.filter(t => t.id !== showTokenDelete.id));
      setShowTokenDelete(null);
      setTokenDeleteConfirmName('');
      if (wasActive) {
        clearSquidVeilToken();
        clearActiveTokenPrefix();
        setConnected(false);
        setSecrets([]);
        setTokens([]);
        toast({ title: 'Active token deleted', description: 'The dashboard token was removed. Create a new token to continue.', variant: 'destructive' });
      } else {
        toast({ title: 'Token deleted permanently' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setDeletingToken(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  const maxActivity = stats?.activity.length
    ? Math.max(1, ...stats.activity.map(a => Math.max(a.reads, a.writes, a.veilrefs, a.rotations)))
    : 1;

  const activeSecrets = secrets.filter(s => !s.deleted_at);
  const deletedSecrets = secrets.filter(s => s.deleted_at);

  if (!connected) {
    return (
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-lg bg-card border border-primary/20 p-5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-sm">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">SquidVeil Secrets</h1>
              <p className="mt-0.5 text-sm text-muted-foreground/80">Manage encrypted secrets, tokens, and usage monitoring.</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-card/50 border border-border overflow-hidden p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
              <KeyRound className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Create your first token</h2>
            <p className="text-sm text-muted-foreground/80 mb-6 max-w-md">
              SquidVeil issues an <span className="text-primary">sv_</span> access token for your account.
              It is shown only once — store it somewhere safe. The token is then used automatically by this
              dashboard. You can hold up to 3 tokens.
            </p>
            <div className="w-full max-w-sm space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={bootstrapName}
                  onChange={e => setBootstrapName(e.target.value)}
                  placeholder="Token name (e.g. dashboard-admin)"
                  maxLength={100}
                  className="w-full h-11 rounded-xl border border-border bg-foreground/[0.05] px-4 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors"
                  onKeyDown={e => e.key === 'Enter' && !bootstrapping && handleBootstrap()}
                />
                <Fingerprint className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
              </div>
              <Button
                onClick={handleBootstrap}
                disabled={bootstrapping || !bootstrapName.trim()}
                className="w-full h-11 rounded-xl bg-primary/20 text-primary/80 border border-primary/30 hover:bg-primary/30 hover:text-primary/60 gap-1.5 disabled:opacity-40"
              >
                {bootstrapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {bootstrapping ? 'Creating token...' : 'Create my first token'}
              </Button>
              {bootstrapError && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-left">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300/80 leading-relaxed">{bootstrapError}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowImport(v => !v)}
                className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
                aria-expanded={showImport}
              >
                {showImport ? 'Hide saved-token connect' : 'Already have a token? Connect with it'}
              </button>
              {showImport && (
                <div className="rounded-xl border border-border bg-foreground/[0.03] p-3 space-y-2.5 animate-fade-in">
                  <input
                    type="password"
                    value={importValue}
                    onChange={e => setImportValue(e.target.value)}
                    placeholder="Paste sv_ token value"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full h-10 rounded-xl border border-border bg-background/60 px-4 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors"
                    onKeyDown={e => e.key === 'Enter' && !importing && handleImportToken()}
                  />
                  <Button
                    onClick={handleImportToken}
                    disabled={importing || !importValue.trim()}
                    className="w-full h-10 rounded-xl"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    {importing ? 'Verifying…' : 'Connect token'}
                  </Button>
                </div>
              )}
              <a
                href="/help/squidveil"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Read the SquidVeil documentation
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-lg bg-card border border-primary/20 p-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="relative z-10 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-sm">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">SquidVeil Secrets</h1>
              <p className="mt-0.5 text-sm text-muted-foreground/80">
                {activeSecrets.length} active · {tokens.filter(t => !t.revoked_at).length} tokens
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'secrets' && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary/20 text-primary/80 border border-primary/30 hover:bg-primary/30 hover:text-primary/60 transition-all text-sm font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                New Secret
              </button>
            )}
            {tab === 'tokens' && (
              <>
                {tokens.length > 0 && (
                  <span className="flex items-center h-9 px-3 rounded-xl bg-foreground/[0.05] text-muted-foreground/70 border border-border text-xs">
                    {tokens.length} / {MAX_TOKENS} tokens
                  </span>
                )}
                <button
                  onClick={() => setShowTokenCreate(true)}
                  disabled={tokens.length >= MAX_TOKENS}
                  title={tokens.length >= MAX_TOKENS ? `You can have up to ${MAX_TOKENS} tokens. Revoke or delete one to create another.` : undefined}
                  className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary/20 text-primary/80 border border-primary/30 hover:bg-primary/30 hover:text-primary/60 transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Token
                </button>
              </>
            )}
            {tab === 'monitor' && (
              <button
                onClick={fetchMonitor}
                className="flex items-center gap-2 h-9 px-3 rounded-xl bg-foreground/[0.05] text-muted-foreground/70 border border-border hover:bg-foreground/[0.08] hover:text-muted-foreground transition-all text-xs"
              >
                <RefreshCw className={cn('w-3 h-3', loadingMonitor && 'animate-spin')} />
                Refresh
              </button>
            )}
            <a
              href="/help/squidveil"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-foreground/[0.05] text-muted-foreground/70 border border-border hover:bg-foreground/[0.08] hover:text-muted-foreground transition-all text-xs"
              title="SquidVeil Documentation"
            >
              <ExternalLink className="w-3 h-3" />
              Docs
            </a>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 h-9 px-3 rounded-xl bg-foreground/[0.05] text-muted-foreground/70 border border-border hover:bg-foreground/[0.08] hover:text-muted-foreground transition-all text-xs"
              title="Disconnect token"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-xl bg-card/50 border border-border p-1 w-fit">
        {([
          { id: 'secrets', label: 'Secrets', icon: Lock },
          { id: 'tokens', label: 'Tokens', icon: KeyRound },
          { id: 'monitor', label: 'Monitor', icon: Activity },
        ] as { id: Tab; label: string; icon: any }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-all',
              tab === t.id
                ? 'bg-primary/20 text-primary/60 border border-primary/30'
                : 'text-muted-foreground/70 hover:text-foreground/70',
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'secrets' && (
        <div className="rounded-lg bg-card/50 border border-border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-8 w-8 text-red-400 mb-3" />
              <p className="text-sm text-red-400 font-medium">{error}</p>
              <button onClick={fetchSecrets} className="mt-3 text-xs text-primary hover:text-primary/80 underline underline-offset-2">
                Try again
              </button>
            </div>
          ) : activeSecrets.length === 0 && deletedSecrets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-foreground/[0.05] text-muted-foreground/50 mb-4">
                <Lock className="h-7 w-7" />
              </div>
              <p className="text-sm text-muted-foreground/70 font-medium">No secrets yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create your first secret to get started.</p>
              <Button
                onClick={() => setShowCreate(true)}
                className="mt-4 h-9 rounded-xl bg-primary/20 text-primary/80 border border-primary/30 hover:bg-primary/30 hover:text-primary/60 px-4 gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                New Secret
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activeSecrets.map(secret => (
                <div key={secret.id} className="px-5 py-3.5 hover:bg-card/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground/90 truncate">
                        {secret.name}
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground/60">{secret.secret_type}</span>
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        Created {formatDate(secret.created_at)}
                        {secret.description ? ` · ${secret.description}` : ''}
                      </p>
                      {revealed[secret.name] && (
                        <div className="mt-2 flex items-center gap-2">
                          <code className="flex-1 min-w-0 text-xs text-emerald-300/90 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2 break-all max-h-20 overflow-y-auto">
                            {revealed[secret.name]}
                          </code>
                          <button
                            onClick={() => handleCopy(revealed[secret.name])}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-foreground/[0.05] transition-all flex-shrink-0"
                            title="Copy value"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {expanded[secret.name] && (
                        <div className="mt-2 rounded-xl bg-card/50 border border-border p-3 space-y-1.5">
                          {loadingVersions === secret.name ? (
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          ) : (versions[secret.name] || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground/60">No versions</p>
                          ) : (
                            (versions[secret.name] || []).map((v: any) => (
                              <div key={v.version_number} className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground font-medium w-6">v{v.version_number}</span>
                                <span className={cn(
                                  'px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide',
                                  v.state === 'ENABLED' && 'text-emerald-300/80 bg-emerald-500/10',
                                  v.state === 'DISABLED' && 'text-amber-300/80 bg-amber-500/10',
                                  v.state === 'DESTROYED' && 'text-red-300/80 bg-red-500/10',
                                )}>
                                  {v.state}
                                </span>
                                <span className="text-muted-foreground/60">by {v.created_by || 'system'} · {formatDate(v.created_at)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-foreground/[0.05] transition-all">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem className="gap-2.5 text-sm cursor-pointer" onClick={() => handleRead(secret)}>
                          {reading === secret.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : revealed[secret.name] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          {revealed[secret.name] ? 'Hide value' : 'Read value'}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2.5 text-sm cursor-pointer" onClick={() => handleRotate(secret)}>
                          <RefreshCw className="w-3.5 h-3.5" />
                          Rotate value
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2.5 text-sm cursor-pointer" onClick={() => toggleVersions(secret)}>
                          <History className="w-3.5 h-3.5" />
                          Versions
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2.5 text-sm text-red-400 cursor-pointer"
                          onClick={() => setDeleteId(secret.name)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}

              {deletedSecrets.length > 0 && (
                <>
                  <div className="px-5 py-2.5 bg-amber-500/[0.04]">
                    <p className="text-[10px] uppercase tracking-wider text-amber-300/60 font-medium">Pending deletion</p>
                  </div>
                  {deletedSecrets.map(secret => (
                    <div key={secret.id} className="flex items-center gap-3 px-5 py-3.5 bg-amber-500/[0.02]">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 flex-shrink-0">
                        <Ban className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-muted-foreground truncate">{secret.name}</p>
                        <p className="text-xs text-amber-300/50 mt-0.5">
                          {secret.delete_after
                            ? `Purges ${formatDate(secret.delete_after)}`
                            : 'Purges immediately'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleUndelete(secret.name)}
                          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 text-xs font-medium transition-all"
                        >
                          <Redo className="w-3 h-3" />
                          Restore
                        </button>
                        <button
                          onClick={() => handleDestroy(secret.name)}
                          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 text-xs font-medium transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                          Destroy
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'tokens' && (
        <div className="rounded-lg bg-card/50 border border-border overflow-hidden">
          {loadingTokens ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-foreground/[0.05] text-muted-foreground/50 mb-4">
                <KeyRound className="h-7 w-7" />
              </div>
              <p className="text-sm text-muted-foreground/70 font-medium">No tokens yet</p>
              <Button
                onClick={() => setShowTokenCreate(true)}
                className="mt-4 h-9 rounded-xl bg-primary/20 text-primary/80 border border-primary/30 hover:bg-primary/30 hover:text-primary/60 px-4 gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                New Token
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tokens.map(token => {
                const expired = !token.revoked_at && token.expires_at && new Date(token.expires_at) <= new Date();
                return (
                  <div key={token.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-card/50 transition-colors">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0',
                      token.revoked_at ? 'bg-red-500/10 text-red-400' : expired ? 'bg-amber-500/10 text-amber-400' : 'bg-primary/10 text-primary',
                    )}>
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground/90 truncate">{token.name}</p>
                        {token.token_prefix === activePrefix && !token.revoked_at && !expired && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide text-primary/60/90 bg-primary/15 border border-primary/25">Active</span>
                        )}
                        {token.revoked_at ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide text-red-300/80 bg-red-500/10">Revoked</span>
                        ) : expired ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide text-amber-300/80 bg-amber-500/10">Expired</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide text-emerald-300/80 bg-emerald-500/10">Active</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        <code className="text-primary/80/80">{token.token_prefix}...</code>
                        {' · '}Created {formatDate(token.created_at)}
                        {token.expires_at && ` · Expires ${formatDate(token.expires_at)}`}
                        {token.last_used_at && ` · Last used ${formatDate(token.last_used_at)}`}
                        {' · '}{token.policies.join(', ')}
                      </p>
                      {rotatedRaw?.id === token.id && (
                        <div className="mt-2 flex items-center gap-2">
                          <code className="flex-1 min-w-0 text-xs text-emerald-300/90 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2 break-all">
                            {rotatedRaw.raw}
                          </code>
                          <button
                            onClick={() => handleCopy(rotatedRaw.raw)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-foreground/[0.05] transition-all flex-shrink-0"
                            title="Copy new token"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {!token.revoked_at && !expired && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-foreground/[0.05] transition-all">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            className="gap-2.5 text-sm cursor-pointer"
                            disabled={rotatingToken === token.id}
                            onClick={() => handleRotateToken(token)}
                          >
                            {rotatingToken === token.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            Rotate token
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2.5 text-sm text-amber-300 cursor-pointer"
                            onClick={() => handleRevokeToken(token)}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Revoke
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2.5 text-sm text-red-400 cursor-pointer"
                            onClick={() => setShowTokenDelete({ id: token.id, name: token.name })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'monitor' && (
        <div className="space-y-5">
          {loadingMonitor && !monitor ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !monitor ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg bg-card/50 border border-border">
              <Activity className="h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground/70">Monitor requires the <code className="text-primary/80/80">audit</code> capability.</p>
              <button onClick={fetchMonitor} className="mt-3 text-xs text-primary hover:text-primary/80 underline underline-offset-2">
                Try again
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {([
                  { label: 'Reads (24h)', value: monitor.activity_24h.reads, icon: Eye, color: 'violet' },
                  { label: 'Writes (24h)', value: monitor.activity_24h.writes, icon: Pencil, color: 'emerald' },
                  { label: 'VeilRefs (24h)', value: monitor.activity_24h.veilrefs, icon: Fingerprint, color: 'sky' },
                  { label: 'Failed auth (24h)', value: monitor.activity_24h.failed_auth, icon: ShieldAlert, color: monitor.activity_24h.failed_auth > 0 ? 'red' : 'white' },
                ] as { label: string; value: number; icon: any; color: string }[]).map(card => (
                  <div key={card.label} className="rounded-lg bg-card/50 border border-border p-4">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg mb-3',
                      card.color === 'red' ? 'bg-red-500/10 text-red-400' : card.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' : card.color === 'sky' ? 'bg-sky-500/10 text-sky-400' : 'bg-primary/10 text-primary',
                    )}>
                      <card.icon className="w-4 h-4" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">{card.value}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">{card.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2 rounded-lg bg-card/50 border border-border p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Activity — last 30 days</h3>
                  </div>
                  {stats && stats.activity.length > 0 ? (
                    <div className="flex items-end gap-1 h-32">
                      {stats.activity.map((day, i) => {
                        const total = Math.max(day.reads, day.writes, day.veilrefs, day.rotations);
                        const isToday = i === stats.activity.length - 1;
                        return (
                          <div
                            key={day.day}
                            className={cn('flex-1 rounded-t transition-all', isToday ? 'bg-primary' : 'bg-primary/30 hover:bg-primary/50')}
                            style={{ height: `${(total / maxActivity) * 100}%`, minHeight: total > 0 ? '3px' : '1px' }}
                            title={`${day.day}: ${day.reads} reads, ${day.writes} writes, ${day.veilrefs} veilrefs, ${day.rotations} rotations`}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60">No activity recorded yet.</p>
                  )}
                  {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                      {([
                        { label: 'Total reads', value: stats.totals.reads, icon: Eye },
                        { label: 'Total writes', value: stats.totals.writes, icon: Pencil },
                        { label: 'Rotations', value: stats.totals.rotations, icon: RefreshCw },
                        { label: 'VeilRefs issued', value: stats.totals.veilrefs_issued, icon: Fingerprint },
                      ] as { label: string; value: number; icon: any }[]).map(s => (
                        <div key={s.label} className="rounded-xl bg-card/50 border border-border p-3">
                          <s.icon className="w-3.5 h-3.5 text-muted-foreground/60 mb-1.5" />
                          <p className="text-lg font-semibold text-foreground">{s.value}</p>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg bg-card/50 border border-border p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-semibold text-foreground">Audit chain</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {monitor.audit.valid ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                      )}
                      <p className={cn('text-sm font-medium', monitor.audit.valid ? 'text-emerald-300' : 'text-red-300')}>
                        {monitor.audit.valid ? 'Tamper-evident chain intact' : 'Chain broken!'}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {monitor.audit.checked} entries verified · last seq {monitor.audit.last_seq}
                    </p>
                  </div>

                  <div className="rounded-lg bg-card/50 border border-border p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Gauge className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Posture</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-card/50 border border-border p-2.5">
                        <p className="text-lg font-semibold text-emerald-300">{monitor.tokens.active}</p>
                        <p className="text-muted-foreground/60">Active tokens</p>
                      </div>
                      <div className="rounded-xl bg-card/50 border border-border p-2.5">
                        <p className="text-lg font-semibold text-red-300">{monitor.tokens.revoked + monitor.tokens.expired}</p>
                        <p className="text-muted-foreground/60">Revoked / expired</p>
                      </div>
                      <div className="rounded-xl bg-card/50 border border-border p-2.5">
                        <p className="text-lg font-semibold text-foreground">{monitor.secrets.total}</p>
                        <p className="text-muted-foreground/60">Secrets</p>
                      </div>
                      <div className="rounded-xl bg-card/50 border border-border p-2.5">
                        <p className="text-lg font-semibold text-amber-300">{monitor.secrets.rotation_due.length}</p>
                        <p className="text-muted-foreground/60">Rotation due</p>
                      </div>
                    </div>
                    {monitor.secrets.pending_purge.length > 0 && (
                      <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-amber-300/70 font-medium mb-1">Pending purge</p>
                        {monitor.secrets.pending_purge.map(p => (
                          <p key={p.name} className="text-xs text-amber-200/70">
                            {p.name} — {formatDate(p.purge_at)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {monitor.recent_failed_auth.length > 0 && (
                <div className="rounded-lg bg-red-500/[0.04] border border-red-500/15 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    <h3 className="text-sm font-semibold text-foreground">Failed authentication attempts</h3>
                  </div>
                  <div className="space-y-1.5">
                    {monitor.recent_failed_auth.map(f => (
                      <div key={f.seq} className="flex items-center gap-2 text-xs">
                        <span className="text-red-300/80 font-medium w-24 flex-shrink-0">{f.detail}</span>
                        <span className="text-muted-foreground/60 truncate flex-1">{f.ip || '—'}</span>
                        <span className="text-muted-foreground/60 flex-shrink-0">{formatDate(f.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {monitor.recent_events.length > 0 && (
                <div className="rounded-lg bg-card/50 border border-border p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <History className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Recent events</h3>
                  </div>
                  <div className="space-y-1.5">
                    {monitor.recent_events.map(e => (
                      <div key={e.seq} className="flex items-center gap-2 text-xs">
                        <span className={cn('flex-shrink-0 w-2 h-2 rounded-full', e.success ? 'bg-emerald-400/70' : 'bg-red-400/70')} />
                        <code className="text-primary/80/70 w-40 flex-shrink-0 truncate">{e.action}</code>
                        <span className="text-muted-foreground/70 truncate flex-1">{e.path}</span>
                        <span className="text-muted-foreground/60 flex-shrink-0">{formatDate(e.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground/60 px-1">
                <Info className="w-3.5 h-3.5" />
                Generated {formatDate(monitor.generated_at)} · stats window 30d
              </div>
            </>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-lg border border-border bg-popover p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">New Secret</h2>
              <button onClick={() => setShowCreate(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/70 hover:text-muted-foreground hover:bg-foreground/[0.05] transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground/80 mb-1.5">Secret Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  placeholder="e.g. STRIPE_API_KEY or db/prod/creds"
                  className="w-full h-10 rounded-xl border border-border bg-foreground/[0.05] px-4 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground/80 mb-1.5">Secret Value</label>
                <textarea
                  value={createValue}
                  onChange={e => setCreateValue(e.target.value)}
                  placeholder="Paste the secret value..."
                  rows={3}
                  className="w-full rounded-xl border border-border bg-foreground/[0.05] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground/80 mb-1.5">Type</label>
                <div className="flex gap-2">
                  {['opaque', 'connection_string', 'hmac_sign'].map(t => (
                    <button
                      key={t}
                      onClick={() => setCreateType(t)}
                      className={cn(
                        'flex-1 h-9 rounded-xl border text-xs font-medium transition-all',
                        createType === t
                          ? 'border-primary/40 bg-primary/10 text-primary/60'
                          : 'border-border bg-foreground/[0.05] text-muted-foreground/70 hover:text-muted-foreground',
                      )}
                    >
                      {t.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300/80">
                  Encrypted at rest with per-secret keys. Values are versioned and can be rotated anytime.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <Button
                onClick={() => setShowCreate(false)}
                variant="ghost"
                className="flex-1 h-10 rounded-xl text-muted-foreground/80 hover:text-foreground/70"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !createName.trim() || !createValue.trim()}
                className="flex-1 h-10 rounded-xl bg-primary/20 text-primary/80 border border-primary/30 hover:bg-primary/30 hover:text-primary/60 disabled:opacity-40 disabled:cursor-not-allowed gap-1.5"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Secret
              </Button>
            </div>
          </div>
        </div>
      )}

      {showTokenCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowTokenCreate(false)}>
          <div className="w-full max-w-md rounded-lg border border-border bg-popover p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">New Access Token</h2>
              <button onClick={() => setShowTokenCreate(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/70 hover:text-muted-foreground hover:bg-foreground/[0.05] transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground/80 mb-1.5">Token Name</label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={e => setTokenName(e.target.value)}
                  placeholder="e.g. production-ci"
                  className="w-full h-10 rounded-xl border border-border bg-foreground/[0.05] px-4 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground/80 mb-1.5">Expiry (days, optional)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={tokenTtl}
                  onChange={e => setTokenTtl(e.target.value)}
                  placeholder="Never expires"
                  className="w-full h-10 rounded-xl border border-border bg-foreground/[0.05] px-4 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
                <Info className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-xs text-primary/80/80">
                  Up to {MAX_TOKENS} tokens per account. The new token becomes the active token for this
                  dashboard. Store the raw token securely — it is shown only once.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <Button
                onClick={() => setShowTokenCreate(false)}
                variant="ghost"
                className="flex-1 h-10 rounded-xl text-muted-foreground/80 hover:text-foreground/70"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateToken}
                disabled={creatingToken || !tokenName.trim()}
                className="flex-1 h-10 rounded-xl bg-primary/20 text-primary/80 border border-primary/30 hover:bg-primary/30 hover:text-primary/60 disabled:opacity-40 disabled:cursor-not-allowed gap-1.5"
              >
                {creatingToken && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Token
              </Button>
            </div>
          </div>
        </div>
      )}

      {rawToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setRawToken(null)}>
          <div className="w-full max-w-md rounded-lg border border-primary/20 bg-popover p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Token created</h2>
                <p className="text-sm text-muted-foreground/80">Shown once — copy it now.</p>
              </div>
            </div>
            <code className="block w-full text-xs text-emerald-300/90 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 break-all mb-2">
              {rawToken}
            </code>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => handleCopy(rawToken)}
                className="flex-1 h-10 rounded-xl bg-primary/20 text-primary/80 border border-primary/30 hover:bg-primary/30 hover:text-primary/60 gap-1.5"
              >
                <Copy className="w-4 h-4" />
                Copy token
              </Button>
              <Button
                onClick={() => setRawToken(null)}
                variant="ghost"
                className="h-10 rounded-xl text-muted-foreground/80 hover:text-foreground/70"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDeleteId(null)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-popover p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Delete Secret</h2>
                <p className="text-sm text-muted-foreground/80">Soft delete — restorable within the recovery window.</p>
              </div>
            </div>
            <p className="text-sm text-foreground/70 mb-6">
              Are you sure you want to delete <span className="font-medium text-foreground">{deleteId}</span>?
            </p>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setDeleteId(null)}
                variant="ghost"
                className="flex-1 h-10 rounded-xl text-muted-foreground/80 hover:text-foreground/70"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-10 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 hover:text-red-200 disabled:opacity-40 disabled:cursor-not-allowed gap-1.5"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {showTokenDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { setShowTokenDelete(null); setTokenDeleteConfirmName(''); }}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-popover p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Delete Token</h2>
                <p className="text-sm text-muted-foreground/80">Permanent — the token can never be used again.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl border border-red-500/20 bg-red-500/5 mb-4">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-400/90">This action cannot be undone</p>
                <p className="text-xs text-red-400/60 mt-0.5">
                  {showTokenDelete.name === getActiveTokenPrefix()
                    ? 'This is the token the dashboard is using. Deleting it will disconnect SquidVeil from this dashboard.'
                    : 'All applications using this token will lose access immediately.'}
                </p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-foreground/80 mb-1.5">
                Type <span className="font-mono text-foreground font-semibold">{showTokenDelete.name}</span> to confirm
              </label>
              <input
                type="text"
                value={tokenDeleteConfirmName}
                onChange={e => setTokenDeleteConfirmName(e.target.value)}
                placeholder={showTokenDelete.name}
                className="w-full h-10 rounded-xl border border-border bg-foreground/[0.05] px-4 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-red-500/40 font-mono transition-colors"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => { setShowTokenDelete(null); setTokenDeleteConfirmName(''); }}
                variant="ghost"
                className="flex-1 h-10 rounded-xl text-muted-foreground/80 hover:text-foreground/70"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteToken}
                disabled={deletingToken || tokenDeleteConfirmName !== showTokenDelete.name}
                className="flex-1 h-10 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 hover:text-red-200 disabled:opacity-40 disabled:cursor-not-allowed gap-1.5"
              >
                {deletingToken && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete Token
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SquidVeilSecrets;
