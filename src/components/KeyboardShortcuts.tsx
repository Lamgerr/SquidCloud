/**
 * Keyboard Shortcuts System — v12.5
 * Global keyboard navigation for SquidCloud
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Upload, FolderPlus, Search, Download, Trash2, Edit3,
  Share2, Globe, X, Keyboard, ArrowUp, ArrowDown,
  CornerDownLeft, Command,
} from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';

// ── Shortcut Definition ────────────────────────────────────────

interface ShortcutDef {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'actions' | 'navigation' | 'general';
  keys: string[];
}

const SHORTCUTS: ShortcutDef[] = [
  { key: 'upload', label: 'Upload File', description: 'Open file upload dialog', icon: <Upload className="w-4 h-4" />, category: 'actions', keys: ['U'] },
  { key: 'new-folder', label: 'New Folder', description: 'Create a new folder', icon: <FolderPlus className="w-4 h-4" />, category: 'actions', keys: ['N'] },
  { key: 'search', label: 'Focus Search', description: 'Open Spotlight Search', icon: <Search className="w-4 h-4" />, category: 'actions', keys: ['/'] },
  { key: 'download', label: 'Download Selected', description: 'Download selected files', icon: <Download className="w-4 h-4" />, category: 'actions', keys: ['D'] },
  { key: 'delete', label: 'Move to Trash', description: 'Move selected to trash', icon: <Trash2 className="w-4 h-4" />, category: 'actions', keys: ['Delete'] },
  { key: 'rename', label: 'Rename Selected', description: 'Rename selected file', icon: <Edit3 className="w-4 h-4" />, category: 'actions', keys: ['R'] },
  { key: 'share', label: 'Share Selected', description: 'Share selected file', icon: <Share2 className="w-4 h-4" />, category: 'actions', keys: ['S'] },
  { key: 'publish', label: 'Publish Selected', description: 'Publish file as website', icon: <Globe className="w-4 h-4" />, category: 'actions', keys: ['P'] },
  { key: 'select-all', label: 'Select All', description: 'Select all files', icon: <Command className="w-4 h-4" />, category: 'general', keys: ['Ctrl', 'A'] },
  { key: 'command-palette', label: 'Command Palette', description: 'Open command palette', icon: <Command className="w-4 h-4" />, category: 'navigation', keys: ['Ctrl', 'K'] },
  { key: 'escape', label: 'Close Modal', description: 'Close active modal or panel', icon: <X className="w-4 h-4" />, category: 'general', keys: ['Esc'] },
  { key: 'shortcuts', label: 'Show Shortcuts', description: 'Open keyboard shortcut reference', icon: <Keyboard className="w-4 h-4" />, category: 'general', keys: ['?'] },
];

// ── Context ────────────────────────────────────────────────────

interface KeyboardShortcutsContextType {
  overlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
  triggerAction: (key: string) => void;
  on: (key: string, handler: () => void) => () => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType>({
  overlayOpen: false,
  setOverlayOpen: () => {},
  triggerAction: () => {},
  on: () => () => {},
});

export function useKeyboardShortcutsContext() {
  return useContext(KeyboardShortcutsContext);
}

// ── Provider ───────────────────────────────────────────────────

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [handlers, setHandlers] = useState<Map<string, Set<() => void>>>(new Map());

  const on = useCallback((key: string, handler: () => void) => {
    setHandlers(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(key) || []);
      set.add(handler);
      next.set(key, set);
      return next;
    });
    return () => {
      setHandlers(prev => {
        const next = new Map(prev);
        const set = next.get(key);
        if (set) set.delete(handler);
        return next;
      });
    };
  }, []);

  const triggerAction = useCallback((key: string) => {
    const set = handlers.get(key);
    if (set) {
      for (const handler of set) {
        try { handler(); } catch { /* ignore */ }
      }
    }
  }, [handlers]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // ? key to open shortcuts
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setOverlayOpen(true);
        return;
      }

      // Escape to close overlays
      if (e.key === 'Escape') {
        setOverlayOpen(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <KeyboardShortcutsContext.Provider value={{ overlayOpen, setOverlayOpen, triggerAction, on }}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

// ── Overlay Component ──────────────────────────────────────────

export function KeyboardShortcutsOverlay() {
  const { overlayOpen, setOverlayOpen } = useKeyboardShortcutsContext();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={overlayOpen} onOpenChange={setOverlayOpen}>
        <SheetContent side="bottom" className="h-[75vh] rounded-t-2xl p-0">
          <ShortcutsContent onClose={() => setOverlayOpen(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={overlayOpen} onOpenChange={setOverlayOpen}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <ShortcutsContent onClose={() => setOverlayOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ShortcutsContent({ onClose }: { onClose: () => void }) {
  const categories = [
    { id: 'actions', label: 'Actions', items: SHORTCUTS.filter(s => s.category === 'actions') },
    { id: 'navigation', label: 'Navigation', items: SHORTCUTS.filter(s => s.category === 'navigation') },
    { id: 'general', label: 'General', items: SHORTCUTS.filter(s => s.category === 'general') },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <Keyboard className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
        </div>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-5 py-4 space-y-5 overflow-y-auto max-h-[50vh]">
        {categories.map(cat => (
          <div key={cat.id}>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat.label}</h3>
            <div className="space-y-1">
              {cat.items.map(shortcut => (
                <div key={shortcut.key} className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground/60">{shortcut.icon}</span>
                    <div>
                      <span className="text-sm font-medium">{shortcut.label}</span>
                      <p className="text-[11px] text-muted-foreground/60">{shortcut.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((k, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="text-muted-foreground/30 text-[10px]">+</span>}
                        <kbd className="px-2 py-0.5 bg-muted/60 rounded text-[11px] font-mono text-muted-foreground min-w-[24px] text-center">
                          {k}
                        </kbd>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-border/40 bg-muted/20">
        <p className="text-[11px] text-muted-foreground/50 text-center">
          Press <kbd className="px-1.5 py-0.5 bg-muted/60 rounded text-[10px] font-mono">?</kbd> anytime to open this reference
        </p>
      </div>
    </div>
  );
}
