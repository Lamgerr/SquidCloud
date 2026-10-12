import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Key, Copy, Trash2, Plus, Eye, EyeOff, CheckCircle2, AlertCircle, Globe, Settings2, Loader2 } from '@/lib/icon-map';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast as sonnerToast } from 'sonner';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at?: string;
  scopes: string[];
  is_active: boolean;
}

interface ApiKeyUsage {
  total_requests: number;
  storage_used: number;
  bandwidth_used: number;
}

const ApiKeyManagement = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<ApiKeyUsage>({ total_requests: 0, storage_used: 0, bandwidth_used: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [showGeneratedKey, setShowGeneratedKey] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [configEditKey, setConfigEditKey] = useState<any>(null);
  const [configEditOpen, setConfigEditOpen] = useState(false);
  const [configForm, setConfigForm] = useState<Record<string, any>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch API keys",
        variant: "destructive",
      });
    }
  };

  const fetchUsage = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: keys } = await supabase
        .from('api_keys')
        .select('id')
        .eq('user_id', user.id);

      const { data: logs } = await supabase
        .from('api_request_logs')
        .select('id, file_size, status_code')
        .eq('user_id', user.id);

      const total = logs?.length || 0;
      const storage = keys?.reduce((acc: number, _, i) => acc + (keys[i]?.id?.length || 0), 0) || 0;
      const bandwidth = logs?.reduce((acc: number, log: any) => acc + (log.file_size || 0), 0) || 0;

      setUsage({
        total_requests: total,
        storage_used: storage,
        bandwidth_used: bandwidth,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast({ title: "Error", description: "Please enter a name for the key", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('api-key-management', {
        body: { action: 'generate', name: newKeyName.trim(), user_id: user?.id },
      });

      if (error) {
        const msg = data?.error || data?.message || error.message || 'Failed to create API key';
        const isLimit = msg.toLowerCase().includes('maximum') || msg.toLowerCase().includes('limit');
        toast({
          title: isLimit ? 'API Key Limit Reached' : 'Error',
          description: isLimit ? 'You can have a maximum of 10 active API keys. Delete an existing key to create a new one.' : msg,
          variant: 'destructive',
        });
        return;
      }

      // Success — show the generated key in the dialog
      setGeneratedKey(data.apiKey);
      setShowGeneratedKey(true);
      setNewKeyName('');
      fetchApiKeys();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;

      setApiKeys(prev => prev.filter(k => k.id !== keyId));
      setDeleteConfirm(null);
      setDeleteConfirmName('');
      toast({ title: "Key deleted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSaveConfig = async () => {
    if (!configEditKey) return;
    setSavingConfig(true);
    try {
      const body: Record<string, any> = {};
      if (configForm.custom_daily_limit) body.custom_daily_limit = parseInt(configForm.custom_daily_limit) || 0;
      if (configForm.custom_rate_limit_rps) body.custom_rate_limit_rps = parseInt(configForm.custom_rate_limit_rps) || 0;
      body.allow_hmac = !!configForm.allow_hmac;
      body.is_disabled = !!configForm.is_disabled;

      await supabase
        .from('api_key_limits')
        .upsert({
          api_key_id: configEditKey.id,
          custom_daily_limit: body.custom_daily_limit || null,
          custom_rate_limit_rps: body.custom_rate_limit_rps || null,
          is_disabled: body.is_disabled,
        });

      if (configEditKey.allow_hmac !== body.allow_hmac) {
        await supabase
          .from('api_keys')
          .update({ allow_hmac: body.allow_hmac })
          .eq('id', configEditKey.id);
      }

      setConfigEditOpen(false);
      sonnerToast.success('Key configuration saved');
      fetchApiKeys();
    } catch {
      sonnerToast.error('Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copied", description: "API key copied to clipboard" });
  };

  useEffect(() => {
    if (user) {
      fetchApiKeys();
      fetchUsage();
    }
  }, [user]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">API Keys</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Programmatic access to SquidCloud services</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          className="h-7 text-xs gap-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
        >
          <Plus className="w-3 h-3" />
          New Key
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-muted/20 border border-border/30 p-3.5">
          <p className="text-[11px] text-muted-foreground mb-1">Total Requests</p>
          <p className="text-lg font-semibold text-foreground/90">{loading ? '—' : usage.total_requests.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-muted/20 border border-border/30 p-3.5">
          <p className="text-[11px] text-muted-foreground mb-1">Storage</p>
          <p className="text-lg font-semibold text-foreground/90">{loading ? '—' : `${((usage.storage_used / 1024) * 4).toFixed(1)} KB`}</p>
        </div>
        <div className="rounded-xl bg-muted/20 border border-border/30 p-3.5 col-span-2">
          <p className="text-[11px] text-muted-foreground mb-1">Active Keys</p>
          <p className="text-lg font-semibold text-foreground/90">{apiKeys.length}</p>
        </div>
      </div>

      <div className="space-y-2">
        {apiKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-center mb-3">
              <Key className="w-5 h-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-foreground/70 mb-1">No API keys yet</p>
            <p className="text-xs text-muted-foreground/60 max-w-[240px]">
              Create an API key to integrate SquidCloud with your applications.
            </p>
          </div>
        ) : (
          apiKeys.map(key => (
            <div key={key.id} className="rounded-xl bg-muted/20 border border-border/30 p-3.5 hover:bg-muted/30 transition-all">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Key className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="text-sm text-foreground/90 font-medium truncate max-w-[180px]" title={key.name}>{key.name}</span>
                  </div>
                  <div className="flex items-center gap-x-2 gap-y-1 flex-wrap min-w-0 text-xs text-muted-foreground/70">
                    <code className="bg-muted/30 px-1.5 py-0.5 rounded font-mono border border-border/30">
                      {key.key_prefix}****
                    </code>
                    <span>•</span>
                    <span>{formatDate(key.created_at)}</span>
                    {key.last_used_at && (
                      <>
                        <span>•</span>
                        <span>Used {formatDate(key.last_used_at)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setConfigEditKey(key); setConfigForm({ custom_daily_limit: String(key.custom_daily_limit ?? ''), custom_rate_limit_rps: String(key.custom_rate_limit_rps ?? ''), allow_hmac: key.allow_hmac ?? false, is_disabled: key.is_disabled ?? false }); setConfigEditOpen(true); }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-accent/50 transition-colors"
                    title="Configure key"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ id: key.id, name: key.name || key.key_prefix || '' })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) { setDeleteConfirm(null); setDeleteConfirmName(''); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              Delete API Key
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-start gap-3 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-400/90">This action cannot be undone</p>
                <p className="text-xs text-red-400/60 mt-0.5">All applications using this key will lose access immediately.</p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Type <span className="font-mono text-foreground font-semibold">{deleteConfirm?.name}</span> to confirm
              </Label>
              <Input
                value={deleteConfirmName}
                onChange={e => setDeleteConfirmName(e.target.value)}
                placeholder={deleteConfirm?.name || ''}
                className="mt-1.5 bg-muted/20 border-border/40 text-foreground placeholder:text-muted-foreground/40 font-mono text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setDeleteConfirm(null); setDeleteConfirmName(''); }} className="text-muted-foreground hover:text-foreground">Cancel</Button>
              <Button
                onClick={() => handleDeleteKey(deleteConfirm!.id)}
                disabled={deleteConfirmName !== deleteConfirm?.name}
                variant="destructive"
                className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete Key
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={configEditOpen} onOpenChange={setConfigEditOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Key Configuration</DialogTitle>
            <DialogDescription>
              Configure limits and security for <code className="text-xs">{configEditKey?.name || configEditKey?.key_prefix}</code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground/70">Daily Credit Limit</Label>
                <Input
                  className="h-8 text-xs"
                  type="number" min="0"
                  placeholder="Default"
                  value={configForm.custom_daily_limit}
                  onChange={(e) => setConfigForm(p => ({ ...p, custom_daily_limit: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground/70">Rate Limit (req/s)</Label>
                <Input
                  className="h-8 text-xs"
                  type="number" min="0"
                  placeholder="Default"
                  value={configForm.custom_rate_limit_rps}
                  onChange={(e) => setConfigForm(p => ({ ...p, custom_rate_limit_rps: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between h-8 px-2.5 rounded-lg border border-border/40 bg-muted/20">
              <Label className="text-sm text-muted-foreground/80">Require HMAC Request Signing</Label>
              <Switch
                checked={configForm.allow_hmac}
                onCheckedChange={(v) => setConfigForm(p => ({ ...p, allow_hmac: v }))}
              />
            </div>
            <div className="flex items-center justify-between h-8 px-2.5 rounded-lg border border-border/40 bg-muted/20">
              <Label className="text-sm text-foreground/80">Disable This Key</Label>
              <Switch
                checked={configForm.is_disabled}
                onCheckedChange={(v) => setConfigForm(p => ({ ...p, is_disabled: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfigEditOpen(false)} className="text-muted-foreground hover:text-foreground">Cancel</Button>
            <Button
              disabled={savingConfig}
              onClick={handleSaveConfig}
              className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
            >
              {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setShowGeneratedKey(false); setGeneratedKey(''); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          {showGeneratedKey && generatedKey ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  API Key Created
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-400/90">Copy this key now</p>
                    <p className="text-xs text-amber-400/60 mt-0.5">This key will only be shown once. You won't be able to see it again.</p>
                  </div>
                </div>
                <div className="relative">
                  <code className="block w-full text-xs font-mono text-foreground bg-muted/20 border border-border/40 rounded-xl p-3 pr-10 break-all leading-relaxed select-all">
                    {generatedKey}
                  </code>
                  <button
                    onClick={() => copyKey(generatedKey)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-accent/50 transition-colors"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    onClick={() => { navigator.clipboard.writeText(generatedKey); toast({ title: 'Copied!', description: 'API key copied to clipboard' }); }}
                    className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy Key
                  </Button>
                  <Button variant="ghost" onClick={() => { setShowCreateDialog(false); setShowGeneratedKey(false); setGeneratedKey(''); }} className="text-muted-foreground hover:text-foreground">
                    Done
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" />
                  Create API Key
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Key Name</Label>
                  <Input
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production API, CLI Tool"
                    className="mt-1.5 bg-muted/20 border-border/40 text-foreground placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="text-xs text-muted-foreground/70 bg-muted/20 border border-border/30 rounded-lg p-3">
                  <p className="font-medium text-foreground/70 mb-1">Scopes:</p>
                  <ul className="space-y-1">
                    <li>• read: View files and folders</li>
                    <li>• write: Upload and modify files</li>
                    <li>• delete: Delete files and folders</li>
                  </ul>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setShowCreateDialog(false)} className="text-muted-foreground hover:text-foreground">Cancel</Button>
                  <Button onClick={handleCreateKey} disabled={creating || !newKeyName.trim()} className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20">
                    {creating ? 'Creating...' : 'Create Key'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApiKeyManagement;