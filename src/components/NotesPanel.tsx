import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  X, Maximize2, Minimize2, Plus, Trash2, MessageSquare,
  Clock, FileText, Folder, Pencil, Check,
} from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';
import { formatDistanceToNow } from 'date-fns';

interface Note {
  id: string;
  entity_id: string;
  entity_type: 'file' | 'folder';
  content: string;
  created_at: string;
  updated_at: string;
}

interface NotesPanelProps {
  open: boolean;
  onClose: () => void;
  entityId: string;
  entityType: 'file' | 'folder';
  entityName: string;
  onNoteCountChange?: (count: number) => void;
}

export function NotesPanel({
  open, onClose, entityId, entityType, entityName, onNoteCountChange,
}: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const fetchNotes = useCallback(async () => {
    if (!open || !entityId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_entity_notes' as any, {
        p_entity_id: entityId,
        p_entity_type: entityType,
      });
      if (error) throw error;
      const list = (data || []) as Note[];
      setNotes(list);
      onNoteCountChange?.(list.length);
    } catch (e: any) {
      console.error('Failed to fetch notes:', e);
    } finally {
      setLoading(false);
    }
  }, [open, entityId, entityType, onNoteCountChange]);

  useEffect(() => {
    fetchNotes();
  }, [open, entityId, entityType]);

  const handleCreate = async () => {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('create_entity_note' as any, {
        p_entity_id: entityId,
        p_entity_type: entityType,
        p_content: newContent.trim(),
      });
      if (error) throw error;
      setNewContent('');
      await fetchNotes();
      toast({ title: 'Note added' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (noteId: string) => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_entity_note' as any, {
        p_note_id: noteId,
        p_content: editContent.trim(),
      });
      if (error) throw error;
      setEditingId(null);
      await fetchNotes();
      toast({ title: 'Note updated' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    setDeletingId(noteId);
    try {
      const { error } = await supabase.rpc('delete_entity_note' as any, {
        p_note_id: noteId,
      });
      if (error) throw error;
      await fetchNotes();
      toast({ title: 'Note deleted' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const EntityIcon = entityType === 'file' ? FileText : Folder;

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-foreground truncate">Notes</h3>
            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
              <EntityIcon className="w-3 h-3" />
              {entityName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isMobile && (
            <button
              onClick={() => setFullscreen(!fullscreen)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="h-px bg-border/30" />

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading && notes.length === 0 ? (
          <div className="flex items-center justify-center py-16">                <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up-soft">
            <div className="w-16 h-16 rounded-2xl bg-muted/20 border border-border/30 flex items-center justify-center mb-4">
              <MessageSquare className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-foreground/80">No notes yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1.5 max-w-[220px]">
              Add private notes to this {entityType}. Only you can see them.
            </p>
          </div>
        ) : (
          <div className="stagger-fade">
            {notes.map(note => (
              <div
                key={note.id}
                className={cn(
                  'group rounded-xl border p-4 transition-all duration-200',
                  editingId === note.id
                    ? 'bg-primary/[0.04] border-primary/20'
                    : 'bg-muted/10 border-border/20 hover:bg-muted/20 hover:border-border/40',
                  deletingId === note.id && 'opacity-50 scale-95'
                )}
              >
                {editingId === note.id ? (
                  <div className="space-y-3 animate-fade-up-soft">                      <Textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="min-h-[80px] text-sm resize-none bg-muted/20 border-border/30 text-foreground/80 placeholder:text-muted-foreground/40 focus:border-primary/30 focus:ring-primary/10"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">                        <Button
                        size="sm"
                        onClick={() => handleUpdate(note.id)}
                        disabled={saving || !editContent.trim()}
                        className="h-8 text-xs gap-1.5 bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25 transition-all duration-200"
                      >
                        {saving ? (
                          <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        Save
                      </Button>                        <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(note.id)}
                          disabled={deletingId === note.id}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Note Input */}
      <div className="p-5 border-t border-border/30 bg-muted/5">
        <div className="space-y-3">
          <div className="relative">
            <Textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder={`Add a note to this ${entityType}...`}
              className="min-h-[64px] text-sm resize-none bg-muted/20 border-border/30 text-foreground/80 placeholder:text-muted-foreground/40 focus:border-primary/30 focus:ring-primary/10 pr-16"
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/50">
              {newContent.length > 0 ? `${newContent.length} characters` : isMobile ? 'Tap to save' : '⌘+Enter to save'}
            </span>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!newContent.trim() || saving}
              className="h-8 text-xs gap-1.5 bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25 transition-all duration-200 disabled:opacity-40"
            >
              {saving ? (
                <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              Add Note
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!open) return null;

  if (isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={(open) => { if (!open) onClose() }}>
        <BottomSheetContent hideHandle hideClose className="border-none bg-transparent p-0">
          <div className="relative overflow-hidden rounded-t-[28px] bg-card min-h-[85vh] flex flex-col animate-fade-up-soft">
            {content}
          </div>
        </BottomSheetContent>
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className={cn(
          '!p-0 shadow-2xl animate-card-enter',
          fullscreen ? 'max-w-[90vw] h-[90vh]' : 'max-w-md h-[80vh]',
        )}
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}

export function NoteCountIndicator({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-medium text-primary/60',
      className,
    )}>
      <MessageSquare className="w-2.5 h-2.5" />
      {count}
    </span>
  );
}
