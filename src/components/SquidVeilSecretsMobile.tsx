import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Lock, Plus, Pencil, Trash2, Key,
  ChevronRight, ChevronDown, X, Loader2, AlertCircle, ExternalLink,
} from '@/lib/icon-map';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { SUPABASE_URL } from '@/lib/supabaseEnv';

interface Secret {
  id: string;
  name: string;
  scope: any;
  created_at: string;
  updated_at: string;
}

const BASE_URL = `${SUPABASE_URL}/functions/v1/cloudbliss-api`;

const SquidVeilSecretsMobile = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('squidveil_api_key') || '');
  const [selectedKeyId, setSelectedKeyId] = useState(() => localStorage.getItem('squidveil_api_key_id') || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(!apiKey);

  const [userApiKeys, setUserApiKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [keyPasteValue, setKeyPasteValue] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createValue, setCreateValue] = useState('');
  const [creating, setCreating] = useState(false);

  const [actionSecret, setActionSecret] = useState<Secret | null>(null);
  const [actionOpen, setActionOpen] = useState(false);

  const [renameMode, setRenameMode] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchSecrets = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/secrets`, {
        headers: { 'X-SquidCloud-Key': apiKey, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch secrets');
      setSecrets(data.secrets || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (apiKey) fetchSecrets();
  }, [apiKey, fetchSecrets]);

  const fetchUserApiKeys = useCallback(async () => {
    if (!user) return;
    setLoadingKeys(true);
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, key_prefix, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUserApiKeys(data || []);
    } catch (e: any) {
      console.error('Failed to fetch API keys:', e);
    } finally {
      setLoadingKeys(false);
    }
  }, [user]);

  useEffect(() => {
    if (showApiKeyInput && user) fetchUserApiKeys();
  }, [showApiKeyInput, user, fetchUserApiKeys]);

  const handleSaveApiKey = (rawKey: string) => {
    const trimmed = rawKey.trim();
    if (!trimmed) { toast({ title: 'API key required', variant: 'destructive' }); return; }
    localStorage.setItem('squidveil_api_key', trimmed);
    if (selectedKeyId) {
      localStorage.setItem('squidveil_api_key_id', selectedKeyId);
      localStorage.setItem('squidveil_api_key_' + selectedKeyId, trimmed);
    }
    setApiKey(trimmed);
    setKeyPasteValue('');
    setShowApiKeyInput(false);
    fetchSecrets();
  };

  const handleSelectKey = (keyId: string) => {
    setSelectedKeyId(keyId);
    const storedRaw = localStorage.getItem('squidveil_api_key_' + keyId);
    if (storedRaw) {
      localStorage.setItem('squidveil_api_key', storedRaw);
      localStorage.setItem('squidveil_api_key_id', keyId);
      setApiKey(storedRaw);
      setShowApiKeyInput(false);
      fetchSecrets();
    } else {
      setKeyPasteValue('');
    }
  };

  const handleClearApiKey = () => {
    setApiKey('');
    setSelectedKeyId('');
    localStorage.removeItem('squidveil_api_key');
    localStorage.removeItem('squidveil_api_key_id');
    setSecrets([]);
    setShowApiKeyInput(true);
    fetchUserApiKeys();
  };

  const secretsFetch = async (path: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SquidCloud-Key': apiKey,
      ...(options.headers as Record<string, string>),
    };
    return fetch(`${BASE_URL}${path}`, { ...options, headers });
  };

  const handleCreate = async () => {
    if (!createName.trim() || !createValue.trim()) return;
    setCreating(true);
    try {
      const res = await secretsFetch('/secrets', {
        method: 'POST',
        body: JSON.stringify({ name: createName.trim(), value: createValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create secret');
      setSecrets(prev => [data.secret, ...prev]);
      setCreateOpen(false);
      setCreateName('');
      setCreateValue('');
      toast({ title: 'Secret created' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async () => {
    if (!actionSecret || !renameName.trim()) return;
    setRenaming(true);
    try {
      const res = await secretsFetch(`/secrets/${actionSecret.id}/rename`, {
        method: 'PATCH',
        body: JSON.stringify({ name: renameName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename secret');
      setSecrets(prev => prev.map(s => s.id === actionSecret.id ? data.secret : s));
      setActionOpen(false);
      setActionSecret(null);
      setRenameMode(false);
      toast({ title: 'Secret renamed' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!actionSecret) return;
    setDeleting(true);
    try {
      const res = await secretsFetch(`/secrets/${actionSecret.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete secret');
      }
      setSecrets(prev => prev.filter(s => s.id !== actionSecret.id));
      setActionOpen(false);
      setActionSecret(null);
      setDeleteConfirm(false);
      toast({ title: 'Secret deleted' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return dateStr; }
  };

  const openActions = (secret: Secret) => {
    setActionSecret(secret);
    setRenameMode(false);
    setDeleteConfirm(false);
    setRenameName(secret.name);
    setActionOpen(true);
  };

  if (showApiKeyInput) {
    return (
      <div className="px-3 pt-4">
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400">
              <Key className="h-7 w-7" />
            </div>
          </div>
          <h2 className="text-base font-semibold text-white mb-1">Select API Key</h2>
          <p className="text-xs text-white/50 mb-5">
            Choose an API key to encrypt secrets.
          </p>

          {loadingKeys ? (
            <Loader2 className="h-5 w-5 animate-spin text-violet-400 mx-auto" />
          ) : userApiKeys.length === 0 ? (
            <div className="text-center">
              <p className="text-sm text-white/40 mb-3">No API keys found.</p>
              <a
                href="/developer-api"
                className="inline-flex items-center justify-center gap-1.5 w-full h-11 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 font-medium text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Create in Developer API
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <select
                  value={selectedKeyId}
                  onChange={e => handleSelectKey(e.target.value)}
                  className="w-full h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white appearance-none outline-none focus:border-violet-500/50 transition-colors cursor-pointer"
                >
                  <option value="" disabled className="bg-[#0a0a0f]">Select an API key...</option>
                  {userApiKeys.map(k => (
                    <option key={k.id} value={k.id} className="bg-[#0a0a0f]">{k.name} ({k.key_prefix}...)</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              </div>

              {selectedKeyId && !localStorage.getItem('squidveil_api_key_' + selectedKeyId) && (
                <div className="space-y-2">
                  <p className="text-xs text-white/40 text-left">
                    Paste the raw key (<span className="text-violet-400">shown once on creation</span>):
                  </p>
                  <input
                    type="password"
                    value={keyPasteValue}
                    onChange={e => setKeyPasteValue(e.target.value)}
                    placeholder="Paste raw API key..."
                    className="w-full h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50 transition-colors"
                    onKeyDown={e => e.key === 'Enter' && handleSaveApiKey(keyPasteValue)}
                  />
                  <button
                    onClick={() => handleSaveApiKey(keyPasteValue)}
                    disabled={!keyPasteValue.trim()}
                    className="w-full h-11 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    <Key className="w-4 h-4" />
                    Connect
                  </button>
                </div>
              )}

              {selectedKeyId && localStorage.getItem('squidveil_api_key_' + selectedKeyId) && (
                <p className="text-xs text-emerald-400/80">Key already connected — unlocking secrets...</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pt-4 pb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Secrets</h2>
          <p className="text-xs text-white/40">
            {loading ? 'Loading...' : `${secrets.length} ${secrets.length === 1 ? 'secret' : 'secrets'} stored`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearApiKey}
            className="h-8 px-3 rounded-xl bg-white/5 text-white/40 border border-white/10 text-xs hover:bg-white/10"
          >
            <X className="w-3 h-3" />
          </button>
          <a
            href="/help/squidveil"
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-3 rounded-xl bg-white/5 text-white/40 border border-white/10 text-xs flex items-center gap-1 hover:bg-white/10"
          >
            <ExternalLink className="w-3 h-3" />
            Docs
          </a>
          <button
            onClick={() => setCreateOpen(true)}
            className="h-9 px-4 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 text-sm font-medium flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400 font-medium">{error}</p>
          <button onClick={fetchSecrets} className="mt-3 text-xs text-violet-400 underline underline-offset-2">
            Try again
          </button>
        </div>
      ) : secrets.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/20">
              <Lock className="h-6 w-6" />
            </div>
          </div>
          <p className="text-sm text-white/40 font-medium">No secrets yet</p>
          <p className="text-xs text-white/30 mt-1">Create your first encrypted secret.</p>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-4 h-9 px-4 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 text-sm font-medium inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Secret
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {secrets.map(secret => (
            <button
              key={secret.id}
              onClick={() => openActions(secret)}
              className="w-full flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 text-left active:scale-[0.99] transition-all duration-150"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 flex-shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">{secret.name}</p>
                <p className="text-xs text-white/40 mt-0.5">{formatDate(secret.created_at)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-t border-white/10 bg-[#0a0a0f] px-5 pt-5 pb-8">
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
          <h3 className="text-base font-semibold text-white mb-5">New Secret</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Name</label>
              <input
                type="text"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="e.g. STRIPE_API_KEY"
                className="w-full h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Value</label>
              <textarea
                value={createValue}
                onChange={e => setCreateValue(e.target.value)}
                placeholder="Paste the secret value..."
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50 resize-none"
              />
            </div>
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/80">
                Encrypted with your API key. Value cannot be viewed after creation.
              </p>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !createName.trim() || !createValue.trim()}
              className="w-full h-11 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Secret
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={actionOpen} onOpenChange={v => { setActionOpen(v); if (!v) { setActionSecret(null); setRenameMode(false); setDeleteConfirm(false); }}}>
        <SheetContent side="bottom" className="rounded-t-3xl border-t border-white/10 bg-[#0a0a0f] px-5 pt-5 pb-8">
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />

          {deleteConfirm ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-400 flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Delete Secret</h3>
                  <p className="text-xs text-white/50">This cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm text-white/70 mb-6">
                Delete <span className="font-medium text-white">{actionSecret?.name}</span>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 h-11 rounded-xl border border-white/10 text-white/50 text-sm font-medium hover:text-white/70"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 h-11 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 font-medium text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Delete
                </button>
              </div>
            </>
          ) : renameMode ? (
            <>
              <h3 className="text-base font-semibold text-white mb-5">Rename Secret</h3>
              <input
                type="text"
                value={renameName}
                onChange={e => setRenameName(e.target.value)}
                className="w-full h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-violet-500/50 mb-5"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleRename()}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setRenameMode(false)}
                  className="flex-1 h-11 rounded-xl border border-white/10 text-white/50 text-sm font-medium hover:text-white/70"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRename}
                  disabled={renaming || !renameName.trim()}
                  className="flex-1 h-11 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 font-medium text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {renaming && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 flex-shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-white truncate">{actionSecret?.name}</h3>
                  <p className="text-xs text-white/50">Created {actionSecret && formatDate(actionSecret.created_at)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setRenameMode(true)}
                  className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3.5 text-sm font-medium text-white/80 active:scale-[0.99] transition-all"
                >
                  <Pencil className="w-4 h-4 text-violet-400" />
                  Rename
                </button>
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="w-full flex items-center gap-3 rounded-xl border border-red-500/15 bg-red-500/[0.04] px-4 py-3.5 text-sm font-medium text-red-400 active:scale-[0.99] transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default SquidVeilSecretsMobile;
