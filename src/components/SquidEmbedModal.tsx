/**
 * SquidEmbed Modal — v12.5
 * Three-panel embed interface: Live Preview | Customization | Code
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { buildPublicUrl } from '@/lib/appLinks';
import {
  X, Copy, Check, Eye, Code, SlidersHorizontal, Monitor, Smartphone,
  Palette, Maximize2, ExternalLink, FileText, Folder,
} from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';
import { Tabs, TabsContent } from '@/components/ui/tabs';

interface EmbedModalProps {
  open: boolean;
  onClose: () => void;
  entityId: string;
  entityType: 'file' | 'folder';
  entityName: string;
}

interface EmbedConfig {
  theme: 'dark' | 'light' | 'auto';
  width: string;
  height: string;
  layout: 'grid' | 'list' | 'gallery';
  showBranding: boolean;
  borderRadius: number;
}

const DEFAULT_CONFIG: EmbedConfig = {
  theme: 'dark',
  width: '100%',
  height: '400',
  layout: 'grid',
  showBranding: true,
  borderRadius: 12,
};

export function SquidEmbedModal({ open, onClose, entityId, entityType, entityName }: EmbedModalProps) {
  const [embedToken, setEmbedToken] = useState<string | null>(null);
  const [config, setConfig] = useState<EmbedConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'preview' | 'customize' | 'code'>('code');
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const fetchOrCreateToken = useCallback(async () => {
    if (!open || !entityId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_or_create_embed_token' as any, {
        p_entity_id: entityId,
        p_entity_type: entityType,
      });
      if (error) throw error;
      setEmbedToken(data?.id || null);
      if (data?.embed_config) {
        setConfig({ ...DEFAULT_CONFIG, ...data.embed_config });
      }
    } catch (e: any) {
      console.error('Failed to get embed token:', e);
    } finally {
      setLoading(false);
    }
  }, [open, entityId, entityType]);

  useEffect(() => { fetchOrCreateToken(); }, [fetchOrCreateToken]);

  const updateConfig = async (updates: Partial<EmbedConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    if (embedToken) {
      await supabase.rpc('update_embed_config' as any, {
        p_token_id: embedToken,
        p_config: newConfig,
      });
    }
  };

  const embedUrl = embedToken
    ? buildPublicUrl(`/embed/${embedToken}`)
    : '';

  const embedCode = entityType === 'folder'
    ? `<iframe\n  src="${embedUrl}?theme=${config.theme}&layout=${config.layout}"\n  width="${config.width}"\n  height="${config.height}"\n  frameborder="0"\n  style="border-radius: ${config.borderRadius}px; overflow: hidden;"\n  allow="fullscreen"\n></iframe>`
    : `<iframe\n  src="${embedUrl}?theme=${config.theme}"\n  width="${config.width}"\n  height="${config.height}"\n  frameborder="0"\n  style="border-radius: ${config.borderRadius}px; overflow: hidden;"\n  allow="fullscreen"\n></iframe>`;

  const runtimeScript = `<script src="${window.location.origin}/embed.js"></script>\n<squidcloud-embed\n  token="${embedToken || 'YOUR_TOKEN'}"\n  theme="${config.theme}"\n  width="${config.width}"\n  height="${config.height}"\n></squidcloud-embed>`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: 'Copied!', description: `${label} copied to clipboard` });
    setTimeout(() => setCopied(null), 2000);
  };

  const EntityIcon = entityType === 'file' ? FileText : Folder;

  const content = (
    <div className={cn(
      'flex flex-col',
      isMobile ? 'h-[85vh]' : 'max-h-[75vh]',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <EntityIcon className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">SquidEmbed</h3>
            <p className="text-[11px] text-muted-foreground/50 truncate">{entityName}</p>
          </div>
        </div>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile tabs */}
      {isMobile ? (
        <div className="flex border-b border-border/40">
          {[
            { id: 'preview', label: 'Preview', icon: Eye },
            { id: 'customize', label: 'Settings', icon: SlidersHorizontal },
            { id: 'code', label: 'Code', icon: Code },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id as any)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors border-b-2',
                activePanel === tab.id
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground/60 border-transparent',
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto">
        {isMobile ? (
          <div className="p-4">
            {activePanel === 'preview' && <PreviewPanel config={config} embedUrl={embedUrl} entityType={entityType} />}
            {activePanel === 'customize' && <CustomizePanel config={config} updateConfig={updateConfig} entityType={entityType} />}
            {activePanel === 'code' && <CodePanel embedCode={embedCode} runtimeScript={runtimeScript} copyToClipboard={copyToClipboard} copied={copied} />}
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_280px_280px] h-full">
            {/* Live Preview */}
            <PreviewPanel config={config} embedUrl={embedUrl} entityType={entityType} />
            {/* Customization */}
            <div className="border-l border-border/40">
              <CustomizePanel config={config} updateConfig={updateConfig} entityType={entityType} />
            </div>
            {/* Code */}
            <div className="border-l border-border/40">
              <CodePanel embedCode={embedCode} runtimeScript={runtimeScript} copyToClipboard={copyToClipboard} copied={copied} />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={onClose}>
        <BottomSheetContent hideClose className="max-w-full h-[90vh] p-0 gap-0 rounded-t-[28px] rounded-b-none overflow-hidden bg-[hsl(var(--card)/0.92)]">
          {content}
        </BottomSheetContent>
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[75vh] p-0 gap-0 overflow-hidden">
        {content}
      </DialogContent>
    </Dialog>
  );
}

// ── Preview Panel ──────────────────────────────────────────────

function PreviewPanel({ config, embedUrl, entityType }: {
  config: EmbedConfig;
  embedUrl: string;
  entityType: string;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Live Preview</span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 bg-muted/20">
        {embedUrl ? (
          <div className={cn(
            'w-full rounded-xl overflow-hidden border border-border/30 transition-all',
            config.theme === 'dark' ? 'bg-[#0d1117]' : 'bg-white',
          )} style={{ height: `${Math.min(parseInt(config.height) || 400, 500)}px`, borderRadius: config.borderRadius }}>
            <iframe
              src={`${embedUrl}?theme=${config.theme}&layout=${config.layout}`}
              className="w-full h-full border-0"
              title="Embed preview"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/40">
            <Monitor className="w-8 h-8 mb-2" />
            <p className="text-xs">Generating preview...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Customize Panel ────────────────────────────────────────────

function CustomizePanel({ config, updateConfig, entityType }: {
  config: EmbedConfig;
  updateConfig: (updates: Partial<EmbedConfig>) => void;
  entityType: string;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Customize</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Theme */}
        <div>
          <Label className="text-[11px] font-semibold text-muted-foreground/70">Theme</Label>
          <div className="flex gap-1.5 mt-1.5">
            {(['dark', 'light', 'auto'] as const).map(theme => (
              <button
                key={theme}
                onClick={() => updateConfig({ theme })}
                className={cn(
                  'flex-1 py-2 rounded-lg text-[11px] font-medium border transition-colors capitalize',
                  config.theme === theme
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'bg-muted/30 text-muted-foreground/70 border-border/40 hover:border-border/60',
                )}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] font-semibold text-muted-foreground/70">Width</Label>
            <Input
              value={config.width}
              onChange={e => updateConfig({ width: e.target.value })}
              className="mt-1 h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] font-semibold text-muted-foreground/70">Height</Label>
            <Input
              value={config.height}
              onChange={e => updateConfig({ height: e.target.value })}
              className="mt-1 h-8 text-xs"
            />
          </div>
        </div>

        {/* Layout (folder only) */}
        {entityType === 'folder' && (
          <div>
            <Label className="text-[11px] font-semibold text-muted-foreground/70">Layout</Label>
            <div className="flex gap-1.5 mt-1.5">
              {(['grid', 'list', 'gallery'] as const).map(layout => (
                <button
                  key={layout}
                  onClick={() => updateConfig({ layout })}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-[11px] font-medium border transition-colors capitalize',
                    config.layout === layout
                      ? 'bg-primary/15 text-primary border-primary/30'
                      : 'bg-muted/30 text-muted-foreground/70 border-border/40 hover:border-border/60',
                  )}
                >
                  {layout}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Border Radius */}
        <div>
          <Label className="text-[11px] font-semibold text-muted-foreground/70">
            Border Radius: {config.borderRadius}px
          </Label>
          <input
            type="range"
            min={0}
            max={24}
            value={config.borderRadius}
            onChange={e => updateConfig({ borderRadius: parseInt(e.target.value) })}
            className="w-full mt-2"
          />
        </div>

        {/* Branding */}
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold text-muted-foreground/70">Show Branding</Label>
          <button
            onClick={() => updateConfig({ showBranding: !config.showBranding })}
            className={cn(
              'w-10 h-5 rounded-full transition-colors relative',
              config.showBranding ? 'bg-primary' : 'bg-muted/50',
            )}
          >
            <div className={cn(
              'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
              config.showBranding ? 'translate-x-5' : 'translate-x-0.5',
            )} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Code Panel ─────────────────────────────────────────────────

function CodePanel({ embedCode, runtimeScript, copyToClipboard, copied }: {
  embedCode: string;
  runtimeScript: string;
  copyToClipboard: (text: string, label: string) => void;
  copied: string | null;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Code className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Embed Code</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Iframe embed */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground/70">Iframe Component</span>
            <button
              onClick={() => copyToClipboard(embedCode, 'Iframe')}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              {copied === 'Iframe' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied === 'Iframe' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="p-3 rounded-xl bg-muted/30 border border-border/30 text-[11px] font-mono text-foreground/70 overflow-x-auto whitespace-pre-wrap break-all">
            {embedCode}
          </pre>
        </div>

        {/* Web Component */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground/70">Web Component</span>
            <button
              onClick={() => copyToClipboard(runtimeScript, 'Web Component')}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              {copied === 'Web Component' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied === 'Web Component' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="p-3 rounded-xl bg-muted/30 border border-border/30 text-[11px] font-mono text-foreground/70 overflow-x-auto whitespace-pre-wrap break-all">
            {runtimeScript}
          </pre>
        </div>

        {/* Copy All */}
        <button
          onClick={() => copyToClipboard(`${runtimeScript}\n\n<!-- Or use iframe: -->\n${embedCode}`, 'All Code')}
          className="w-full py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
        >
          {copied === 'All Code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied === 'All Code' ? 'Copied!' : 'Copy All'}
        </button>
      </div>
    </div>
  );
}
