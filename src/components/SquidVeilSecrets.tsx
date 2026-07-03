import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Lock, Plus, Pencil, Trash2, Key, Upload,
  MoreVertical, X, Loader2, AlertCircle, ChevronDown, ExternalLink, FileText,
} from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Secret {
  id: string;
  name: string;
  scope: any;
  created_at: string;
  updated_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BASE_URL = `${SUPABASE_URL}/functions/v1/cloudbliss-api`;

async function secretsFetch(path: string, options: RequestInit & { apiKey?: string }) {
  const { apiKey, ...fetchOpts } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOpts.headers as Record<string, string>),
  };
  if (apiKey) headers['X-SquidCloud-Key'] = apiKey;
  return fetch(`${BASE_URL}${path}`, { ...fetchOpts, headers });
}

const SquidVeilSecrets = () => {
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
  const [showConfigImport, setShowConfigImport] = useState(false);
  const [configImportResult, setConfigImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createValue, setCreateValue] = useState('');
  const [creating, setCreating] = useState(false);

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSecrets = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await secretsFetch('/secrets', { apiKey });
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

  const handleImportConfig = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (file.name === '.squidveil' || file.name.endsWith('.squidveil')) {
        const nameMatch = text.match(/name\s*=\s*"([^"]+)"/);
        const envMatch = text.match(/environment\s*=\s*"([^"]+)"/);
        setConfigImportResult(
          `Config loaded: ${nameMatch?.[1] || 'unknown'} (${envMatch?.[1] || 'production'})`
        );
      } else if (file.name === '.squidproxy' || file.name.endsWith('.squidproxy')) {
        const secretNames: string[] = [];
        const regex = /name\s*=\s*"([^"]+)"/g;
        let m;
        while ((m = regex.exec(text)) !== null) secretNames.push(m[1]);
        setConfigImportResult(
          `.squidproxy loaded: ${secretNames.length} secret(s) configured`
        );
      } else {
        setConfigImportResult('Unrecognized config file. Expected .squidveil or .squidproxy');
      }
      setTimeout(() => setConfigImportResult(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
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

  const handleCreate = async () => {
    if (!createName.trim() || !createValue.trim()) return;
    setCreating(true);
    try {
      const res = await secretsFetch('/secrets', {
        method: 'POST',
        apiKey,
        body: JSON.stringify({ name: createName.trim(), value: createValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create secret');
      setSecrets(prev => [data.secret, ...prev]);
      setShowCreate(false);
      setCreateName('');
      setCreateValue('');
      toast({ title: 'Secret created', description: data.secret.name });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async () => {
    if (!renameId || !renameName.trim()) return;
    setRenaming(true);
    try {
      const res = await secretsFetch(`/secrets/${renameId}/rename`, {
        method: 'PATCH',
        apiKey,
        body: JSON.stringify({ name: renameName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename secret');
      setSecrets(prev => prev.map(s => s.id === renameId ? data.secret : s));
      setRenameId(null);
      setRenameName('');
      toast({ title: 'Secret renamed' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await secretsFetch(`/secrets/${deleteId}`, {
        method: 'DELETE',
        apiKey,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete secret');
      }
      setSecrets(prev => prev.filter(s => s.id !== deleteId));
      setDeleteId(null);
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

  if (showApiKeyInput) {
    return (
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent border border-violet-500/20 p-5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 shadow-sm">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">SquidVeil Secrets</h1>
              <p className="mt-0.5 text-sm text-white/50">Manage encrypted secrets for your pipelines.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden backdrop-blur-sm p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 mb-4">
              <Key className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">Select API Key</h2>
            <p className="text-sm text-white/50 mb-6 max-w-md">
              Choose a SquidCloud API key to encrypt and access secrets.
            </p>

            {loadingKeys ? (
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            ) : userApiKeys.length === 0 ? (
              <div className="text-center">
                <p className="text-sm text-white/40 mb-3">No API keys found.</p>
                <a
                  href="/developer-api"
                  className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 hover:text-violet-200 px-4 text-sm font-medium transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Create one in Developer API
                </a>
              </div>
            ) : (
              <div className="w-full max-w-sm space-y-3">
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
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={keyPasteValue}
                        onChange={e => setKeyPasteValue(e.target.value)}
                        placeholder="Paste raw API key..."
                        className="flex-1 h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50 transition-colors"
                        onKeyDown={e => e.key === 'Enter' && handleSaveApiKey(keyPasteValue)}
                      />
                      <Button
                        onClick={() => handleSaveApiKey(keyPasteValue)}
                        disabled={!keyPasteValue.trim()}
                        className="h-10 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 hover:text-violet-200 px-4 gap-1.5 disabled:opacity-40"
                      >
                        <Key className="w-3.5 h-3.5" />
                        Connect
                      </Button>
                    </div>
                  </div>
                )}

                {selectedKeyId && localStorage.getItem('squidveil_api_key_' + selectedKeyId) && (
                  <p className="text-xs text-emerald-400/80">Key already connected — unlocking secrets...</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent border border-violet-500/20 p-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 shadow-sm">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">SquidVeil Secrets</h1>
              <p className="mt-0.5 text-sm text-white/50">
                {secrets.length} {secrets.length === 1 ? 'secret' : 'secrets'} stored
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 hover:text-violet-200 transition-all text-sm font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              New Secret
            </button>
            <a
              href="/help/squidveil"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/60 transition-all text-xs"
              title="SquidVeil Documentation"
            >
              <ExternalLink className="w-3 h-3" />
              Docs
            </a>
            <button
              onClick={handleImportConfig}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/60 transition-all text-xs"
              title="Import .squidveil or .squidproxy config"
            >
              <Upload className="w-3 h-3" />
              Config
            </button>
            <button
              onClick={handleClearApiKey}
              className="flex items-center gap-2 h-9 px-3 rounded-xl bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/60 transition-all text-xs"
              title="Disconnect API key"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".squidveil,.squidproxy"
            className="hidden"
            onChange={handleFileChange}
          />
          {configImportResult && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5">
              <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <p className="text-xs text-emerald-300/80">{configImportResult}</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mb-3" />
            <p className="text-sm text-red-400 font-medium">{error}</p>
            <button onClick={fetchSecrets} className="mt-3 text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2">
              Try again
            </button>
          </div>
        ) : secrets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-white/20 mb-4">
              <Lock className="h-7 w-7" />
            </div>
            <p className="text-sm text-white/40 font-medium">No secrets yet</p>
            <p className="text-xs text-white/30 mt-1">Create your first secret to get started.</p>
            <Button
              onClick={() => setShowCreate(true)}
              className="mt-4 h-9 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 hover:text-violet-200 px-4 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Secret
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {secrets.map(secret => {
              const isRenaming = renameId === secret.id;
              return (
                <div key={secret.id} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 flex-shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  {isRenaming ? (
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <input
                        type="text"
                        value={renameName}
                        onChange={e => setRenameName(e.target.value)}
                        className="flex-1 h-8 rounded-lg border border-violet-500/30 bg-white/5 px-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50"
                        placeholder="New name"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename();
                          if (e.key === 'Escape') { setRenameId(null); setRenameName(''); }
                        }}
                      />
                      <button
                        onClick={handleRename}
                        disabled={renaming || !renameName.trim()}
                        className="h-7 px-3 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {renaming ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                      </button>
                      <button
                        onClick={() => { setRenameId(null); setRenameName(''); }}
                        className="h-7 px-2 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/5 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/90 truncate">{secret.name}</p>
                        <p className="text-xs text-white/40 mt-0.5">Created {formatDate(secret.created_at)}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            className="gap-2.5 text-sm cursor-pointer"
                            onClick={() => { setRenameId(secret.id); setRenameName(secret.name); }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2.5 text-sm text-red-400 cursor-pointer"
                            onClick={() => setDeleteId(secret.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">New Secret</h2>
              <button onClick={() => setShowCreate(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white/60 hover:bg-white/5 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Secret Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  placeholder="e.g. STRIPE_API_KEY"
                  className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Secret Value</label>
                <textarea
                  value={createValue}
                  onChange={e => setCreateValue(e.target.value)}
                  placeholder="Paste the secret value..."
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50 transition-colors resize-none"
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300/80">
                  Secret values are encrypted with your API key and cannot be viewed after creation.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <Button
                onClick={() => setShowCreate(false)}
                variant="ghost"
                className="flex-1 h-10 rounded-xl text-white/50 hover:text-white/70"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !createName.trim() || !createValue.trim()}
                className="flex-1 h-10 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 hover:text-violet-200 disabled:opacity-40 disabled:cursor-not-allowed gap-1.5"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Secret
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteId(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Delete Secret</h2>
                <p className="text-sm text-white/50">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-white/70 mb-6">
              Are you sure you want to delete <span className="font-medium text-white">{secrets.find(s => s.id === deleteId)?.name}</span>?
            </p>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setDeleteId(null)}
                variant="ghost"
                className="flex-1 h-10 rounded-xl text-white/50 hover:text-white/70"
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
    </div>
  );
};

export default SquidVeilSecrets;
