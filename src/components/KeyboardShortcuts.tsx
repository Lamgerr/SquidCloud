/**
 * Keyboard Shortcuts System — v12.5
 * Global keyboard navigation for SquidCloud
 */

import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Upload, FolderPlus, Search, Download, Trash2, Edit3,
  Share2, Globe, X, Keyboard, ArrowUp, ArrowDown,
  CornerDownLeft, Command, Maximize, Gamepad2,
} from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';
import { GameSuggestionModal } from '@/components/games/GameSuggestionModal';

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
  { key: 'fullscreen', label: 'Toggle Fullscreen', description: 'Enter or exit native fullscreen', icon: <Maximize className="w-4 h-4" />, category: 'general', keys: ['Ctrl', 'Alt', 'Shift', 'J'] },
  { key: 'game-modal', label: 'Arcade Lounge', description: 'Open the game suggestions modal', icon: <Gamepad2 className="w-4 h-4" />, category: 'general', keys: ['Ctrl', 'Shift', 'B'] },
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
  const [gameModalOpen, setGameModalOpen] = useState(false);
  const handlersRef = useRef<Map<string, Set<() => void>>>(new Map());

  const on = useCallback((key: string, handler: () => void) => {
    const map = handlersRef.current;
    const set = map.get(key) || new Set();
    set.add(handler);
    map.set(key, set);
    return () => {
      set.delete(handler);
      if (set.size === 0) map.delete(key);
    };
  }, []);

  const triggerAction = useCallback((key: string) => {
    const set = handlersRef.current.get(key);
    if (set) {
      for (const fn of set) {
        try { fn(); } catch { /* ignore */ }
      }
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        e.stopPropagation();
        triggerAction('game-modal');
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.altKey && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        e.stopPropagation();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        e.stopPropagation();
        setOverlayOpen(true);
        return;
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        setOverlayOpen(true);
        return;
      }

      if (e.key === 'Escape') {
        setOverlayOpen(false);
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [triggerAction]);

  useEffect(() => on('game-modal', () => setGameModalOpen(true)), [on]);

  return (
    <KeyboardShortcutsContext.Provider value={{ overlayOpen, setOverlayOpen, triggerAction, on }}>
      {children}
      <GameSuggestionModal
        isOpen={gameModalOpen}
        onClose={() => setGameModalOpen(false)}
        onPlayNow={() => {
          setGameModalOpen(false);
          window.open('/games', '_blank')?.focus();
        }}
      />
    </KeyboardShortcutsContext.Provider>
  );
}

// ── Overlay Component ──────────────────────────────────────────

export function KeyboardShortcutsOverlay() {
  const { overlayOpen, setOverlayOpen } = useKeyboardShortcutsContext();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <BottomSheet open={overlayOpen} onOpenChange={setOverlayOpen}>
        <BottomSheetContent hideClose className="h-[75vh] rounded-t-[28px] p-0 bg-[hsl(var(--card)/0.92)]">
          <ShortcutsContent onClose={() => setOverlayOpen(false)} />
        </BottomSheetContent>
      </BottomSheet>
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
