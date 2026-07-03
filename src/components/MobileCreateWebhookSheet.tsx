import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Network, Plus, Check, X,
} from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

const AVAILABLE_EVENTS = [
  { group: 'File Events', events: [
    { id: 'file.uploaded', label: 'file.uploaded' },
    { id: 'file.shared', label: 'file.shared' },
    { id: 'file.name', label: 'file.name' },
    { id: 'file.ext', label: 'file.ext' },
    { id: 'file.moved', label: 'file.moved' },
    { id: 'file.deleted', label: 'file.deleted' },
  ]},
  { group: 'Website Events', events: [
    { id: 'site.published', label: 'site.published' },
    { id: 'site.unpublished', label: 'site.unpublished' },
    { id: 'site.redeployed', label: 'site.redeployed' },
    { id: 'site.archived', label: 'site.archived' },
    { id: 'site.unarchived', label: 'site.unarchived' },
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

interface MobileCreateWebhookSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function MobileCreateWebhookSheet({ open, onClose, onCreated }: MobileCreateWebhookSheetProps) {
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

  const clearAll = () => setSelectedEvents(new Set());

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
      setUrl('');
      setSelectedEvents(new Set());
      onCreated();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setUrl('');
    setSelectedEvents(new Set());
    onClose();
  };

  return (
    <Drawer open={open} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DrawerContent className="border-none bg-transparent p-0 [&>div:first-child]:hidden">
        <div className="relative overflow-hidden rounded-t-[28px] bg-[#0A0E1A] max-h-[90vh] flex flex-col animate-fade-up-soft">
          {/* Header */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#4FC3F7]/10 flex items-center justify-center">
                  <Network className="w-5 h-5 text-[#4FC3F7]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-white/90">Create Webhook</h3>
                  <p className="text-[11px] text-[#768390]">Get POST notifications for events</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#768390] hover:text-white/70 hover:bg-white/[0.06] transition-all duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="h-px bg-[#2D333B]" />

          {/* Form */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* URL Input */}
            <div className="space-y-2 animate-fade-up-soft" style={{ animationDelay: '0.05s' }}>
              <Label className="text-[12px] text-[#768390] font-medium">Endpoint URL</Label>
              <Input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
                className="h-11 rounded-xl bg-white/[0.04] border-white/[0.08] text-white/80 text-sm font-mono placeholder:text-[#768390]/40 focus:border-[#4FC3F7]/30 focus:ring-[#4FC3F7]/10"
              />
            </div>

            {/* Events */}
            <div className="space-y-3 animate-fade-up-soft" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center justify-between">
                <Label className="text-[12px] text-[#768390] font-medium">Events</Label>
                <div className="flex items-center gap-3">
                  {selectedEvents.size > 0 && (
                    <button onClick={clearAll} className="text-[11px] text-[#768390] hover:text-white/60 transition-colors">
                      Clear
                    </button>
                  )}
                  <button onClick={selectAll} className="text-[11px] text-[#4FC3F7] hover:text-[#4FC3F7]/80 transition-colors">
                    Select all
                  </button>
                </div>
              </div>

              {selectedEvents.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#4FC3F7]/[0.06] border border-[#4FC3F7]/15 animate-scale-in-soft">
                  <Check className="w-3.5 h-3.5 text-[#4FC3F7]" />
                  <span className="text-[11px] text-[#4FC3F7]/80 font-medium">
                    {selectedEvents.size} event{selectedEvents.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
              )}

              <div className="space-y-4">
                {AVAILABLE_EVENTS.map((group, gi) => (
                  <div key={group.group} className="animate-fade-up-soft" style={{ animationDelay: `${0.1 + gi * 0.03}s` }}>
                    <p className="text-[10px] font-semibold text-[#768390]/60 uppercase tracking-wider mb-2">
                      {group.group}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.events.map(evt => {
                        const isSelected = selectedEvents.has(evt.id);
                        return (
                          <button
                            key={evt.id}
                            onClick={() => toggleEvent(evt.id)}
                            className={cn(
                              'text-[11px] px-2.5 py-1.5 rounded-lg border font-mono transition-all duration-200',
                              isSelected
                                ? 'bg-[#4FC3F7]/15 text-[#4FC3F7] border-[#4FC3F7]/25'
                                : 'bg-white/[0.03] text-[#768390]/70 border-white/[0.08] hover:border-white/[0.15] hover:text-white/60',
                            )}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 inline mr-1 -mt-0.5" />}
                            {evt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-[#2D333B]">
            <Button
              onClick={handleCreate}
              disabled={saving || !url.trim() || selectedEvents.size === 0}
              className="w-full h-12 rounded-xl bg-[#4FC3F7] text-[#0A0E1A] font-semibold hover:bg-[#4FC3F7]/90 transition-all duration-200 disabled:opacity-40"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#0A0E1A]/30 border-t-[#0A0E1A] rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Create Webhook
                </span>
              )}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default MobileCreateWebhookSheet;
