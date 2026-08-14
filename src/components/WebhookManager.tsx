/**
 * Webhook Manager — v12.6
 * Manage webhook subscriptions for account events
 * Redesigned with SquidCloud dark GitHub aesthetic
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Plus, Trash2, RotateCcw, ExternalLink, Network,
  CheckCircle2, XCircle, Clock, Copy, Eye, EyeOff,
  AlertCircle, Zap, Globe, MessageSquare, Share2, Send,
} from '@/lib/icon-map';
import { MobileCreateWebhookSheet } from '@/components/MobileCreateWebhookSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const AVAILABLE_EVENTS = [
  { group: 'File Events', events: [
    { id: 'file.uploaded', label: 'file.uploaded' },
    { id: 'file.shared', label: 'file.shared' },
    { id: 'file.renamed', label: 'file.renamed' },
    { id: 'file.moved', label: 'file.moved' },
    { id: 'file.deleted', label: 'file.deleted' },
  ]},
  { group: 'Website Events', events: [
    { id: 'site.published', label: 'site.published' },
    { id: 'site.unpublished', label: 'site.unpublished' },
    { id: 'site.redeployed', label: 'site.redeployed' },
    { id: 'site.archived', label: 'site.archived' },
  ]},
  { group: 'Share Events', events: [
    { id: 'share_link.accessed', label: 'share_link.accessed' },
    { id: 'share_link.revoked', label: 'share_link.revoked' },
  ]},
  { group: 'Pipeline Events', events: [
    { id: 'pipeline.completed', label: 'pipeline.completed' },
    { id: 'pipeline.failed', label: 'pipeline.failed' },
  ]},
  { group: 'API Events', events: [
    { id: 'api_tokens.quota_warning', label: 'api_tokens.quota_warning' },
  ]},
];

interface WebhookRecord {
  id: string;
  url: string;
  secret_key: string;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

interface WebhookManagerProps {
  open: boolean;
  onClose: () => void;
  standalone?: boolean;
}

export function WebhookManager({ open, onClose, standalone = false }: WebhookManagerProps) {
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WebhookRecord | null>(null);
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_user_webhooks' as any);
      if (error) throw error;
      setWebhooks((data || []) as WebhookRecord[]);
    } catch (e: any) {
      console.error('Failed to fetch webhooks:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open || standalone) fetchWebhooks(); }, [open, standalone, fetchWebhooks]);

  const handleDelete = async (webhook: WebhookRecord) => {
    try {
      const { error } = await supabase.rpc('delete_webhook' as any, {
        p_webhook_id: webhook.id,
      });
      if (error) throw error;
      setWebhooks(prev => prev.filter(w => w.id !== webhook.id));
      toast({ title: 'Webhook deleted' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setDeleteTarget(null);
  };

  const handleRotateSecret = async (webhook: WebhookRecord) => {
    try {
      const { data, error } = await supabase.rpc('rotate_webhook_secret' as any, {
        p_webhook_id: webhook.id,
      });
      if (error) throw error;
      setWebhooks(prev => prev.map(w =>
        w.id === webhook.id ? { ...w, secret_key: data as string } : w
      ));
      toast({ title: 'Secret rotated' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast({ title: 'Secret copied' });
  };

  const handlePing = async (webhook: WebhookRecord) => {
    try {
      const { data, error } = await supabase.functions.invoke('webhook-dispatch', {
        body: { action: 'ping', webhookId: webhook.id },
      });
      if (error) throw error;
      if (data?.ok) {
        toast({
          title: `Ping OK — ${data.statusCode} in ${data.durationMs}ms`,
          description: data.response?.slice(0, 120) || 'Delivery successful',
        });
        setWebhooks(prev => prev.map(w =>
          w.id === webhook.id ? { ...w, last_triggered_at: new Date().toISOString() } : w
        ));
      } else {
        toast({
          title: `Ping failed${data?.statusCode ? ` — ${data.statusCode}` : ''}`,
          description: data?.error || data?.response?.slice(0, 120) || 'Delivery failed',
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({ title: 'Ping error', description: e.message, variant: 'destructive' });
    }
  };

  const headerContent = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Network className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Webhooks</h3>
          <p className="text-[11px] text-muted-foreground">Event-driven notifications</p>
        </div>
      </div>
      <Badge variant="outline" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20">
        {webhooks.length} active
      </Badge>
    </div>
  );

  const webhookItem = (webhook: WebhookRecord) => (
    <div key={webhook.id} className="group rounded-xl bg-muted/20 border border-border/30 p-3.5 hover:bg-muted/30 hover:border-border/50 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {webhook.is_active ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
            )}
            <code className="text-xs text-foreground/80 font-mono truncate">{webhook.url}</code>
          </div>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {webhook.events.slice(0, 3).map(evt => (
              <Badge key={evt} className="text-[10px] bg-primary/10 text-primary border-primary/20 font-mono">
                {evt}
              </Badge>
            ))}
            {webhook.events.length > 3 && (
              <Badge className="text-[10px] bg-muted/50 text-muted-foreground border-border/30">
                +{webhook.events.length - 3}
              </Badge>
            )}
          </div>
          {webhook.last_triggered_at && (
            <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              Last: {new Date(webhook.last_triggered_at).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => {
              const next = new Set(showSecrets);
              if (next.has(webhook.id)) next.delete(webhook.id);
              else next.add(webhook.id);
              setShowSecrets(next);
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent/50 transition-colors"
            title={showSecrets.has(webhook.id) ? 'Hide secret' : 'Show secret'}
          >
            {showSecrets.has(webhook.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          <button
            onClick={() => copySecret(webhook.secret_key)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent/50 transition-colors"
            title="Copy secret"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={() => handleRotateSecret(webhook)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent/50 transition-colors"
            title="Rotate secret"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            onClick={() => handlePing(webhook)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors"
            title="Send test ping"
          >
            <Send className="w-3 h-3" />
          </button>
          <button
            onClick={() => setDeleteTarget(webhook)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete webhook"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {showSecrets.has(webhook.id) && (
        <div className="mt-2 p-2 rounded-lg bg-muted/10 border border-border/20">
          <span className="text-[10px] text-muted-foreground/60">Secret Key</span>
          <code className="block text-[11px] font-mono text-foreground/70 mt-0.5 break-all">
            {webhook.secret_key}
          </code>
        </div>
      )}
    </div>
  );

  const content = (
    <div className={cn('flex flex-col', isMobile ? 'h-[85vh]' : 'max-h-[70vh]')}>
      <div className="p-4 border-b border-border/30">
        {headerContent}
        <p className="text-[11px] text-muted-foreground/60 mt-1.5">
          Premium feature — get HTTP POST notifications for account events
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/30 border border-border/30 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-foreground/80">No webhooks configured</p>
            <p className="text-xs text-muted-foreground/60 mt-1.5 max-w-[240px]">
              Create a webhook to receive HTTP POST notifications when events occur in your account.
            </p>
            <Button size="sm" className="mt-4 gap-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20" onClick={() => setShowCreate(true)}>
              <Plus className="w-3 h-3" /> Create Webhook
            </Button>
          </div>
        ) : (
          webhooks.map(webhookItem)
        )}
      </div>

      {showCreate && (
        isMobile ? (
          <MobileCreateWebhookSheet
            open={showCreate}
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); fetchWebhooks(); }}
          />
        ) : (
          <CreateWebhookDialog
            open={showCreate}
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); fetchWebhooks(); }}
          />
        )
      )}

      {deleteTarget && (
        <AlertDialog open onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the webhook and stop all notifications.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(deleteTarget)} className="bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );

  if (standalone) {
    return content;
  }

  if (isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={onClose}>
        <BottomSheetContent hideClose className="max-w-full h-[90vh] p-0 gap-0 rounded-t-[28px] rounded-b-none bg-[hsl(var(--card)/0.92)]">
          {content}
        </BottomSheetContent>
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 gap-0 rounded-2xl">
          {content}
        </DialogContent>
    </Dialog>
  );
}

function CreateWebhookDialog({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const toggleEvent = (eventId: string) => {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set<string>();
    AVAILABLE_EVENTS.forEach(g => g.events.forEach(e => all.add(e.id)));
    setSelectedEvents(all);
  };

  const handleCreate = async () => {
    if (!url.trim() || !url.startsWith('http')) {
      toast({ title: 'Invalid URL', description: 'Enter a valid HTTP/HTTPS URL', variant: 'destructive' });
      return;
    }
    if (selectedEvents.size === 0) {
      toast({ title: 'Select events', description: 'Choose at least one event', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc('create_webhook' as any, {
        p_url: url.trim(),
        p_events: Array.from(selectedEvents),
      });
      if (error) throw error;
      toast({ title: 'Webhook created' });
      onCreated();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            Create Webhook
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Endpoint URL</label>
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              className="mt-1.5 bg-muted/20 border-border/40 text-foreground placeholder:text-muted-foreground/40 font-mono text-xs"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Events</label>
              <button onClick={selectAll} className="text-[11px] text-primary hover:underline">
                Select all
              </button>
            </div>
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {AVAILABLE_EVENTS.map(group => (
                <div key={group.group}>
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
                    {group.group}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {group.events.map(evt => (
                      <button
                        key={evt.id}
                        onClick={() => toggleEvent(evt.id)}
                        className={cn(
                          'text-[11px] px-2 py-1 rounded-md border transition-colors font-mono',
                          selectedEvents.has(evt.id)
                            ? 'bg-primary/15 text-primary border-primary/30'
                            : 'bg-muted/30 text-muted-foreground border-border/30 hover:border-border/50',
                        )}
                      >
                        {evt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground hover:text-foreground">Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={saving} className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20">
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}