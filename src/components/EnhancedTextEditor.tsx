import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Save, Download, Code, FileText, Check, Loader2, Bold, Italic, Underline,
  Search, ZoomIn, ZoomOut, Clock, Edit3, Eye, Columns, Heading1, Heading2,
  List, ListOrdered, Quote, Table, Link2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import EnhancedMarkdownPreview from './EnhancedMarkdownPreview';

interface EnhancedTextEditorProps {
  file: { name?: string };
  decodedBlob: Blob | null;
  onSave?: (content: string) => Promise<void>;
  onDownload?: () => void;
  onShare?: () => void;
  readonly?: boolean;
}

export default function EnhancedTextEditor({
  file, decodedBlob, onSave, onDownload, readonly = false
}: EnhancedTextEditorProps) {
  const isMobile = useIsMobile();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [fontSize, setFontSize] = useState(isMobile ? 15 : 14);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('edit');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fileLang = useMemo(() => {
    const ext = file?.name?.split('.').pop()?.toLowerCase();
    if (ext === 'md' || ext === 'markdown') return 'markdown';
    if (ext === 'json') return 'json';
    if (ext === 'js' || ext === 'ts' || ext === 'tsx') return 'code';
    return 'text';
  }, [file?.name]);

  useEffect(() => {
    if (fileLang === 'markdown' && !isMobile) setViewMode('split');
  }, [fileLang, isMobile]);

  useEffect(() => {
    let active = true;
    if (!decodedBlob) { setLoading(false); return; }

    decodedBlob.text().then(text => {
      if (active) {
        setContent(text || '');
        setLoading(false);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [decodedBlob]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (!isDirty) setIsDirty(true);
    updateCursorStats(e.target);
  };

  const updateCursorStats = (element: HTMLTextAreaElement) => {
    const val = element.value.substring(0, element.selectionStart);
    const lines = val.split('\n');
    setCursorPos({ line: lines.length, col: lines[lines.length - 1].length + 1 });
  };

  const triggerSave = async () => {
    if (!onSave || !isDirty || saving || readonly) return;
    setSaving(true);
    try {
      await onSave(content);
      setIsDirty(false);
      setLastSaved(new Date());
    } catch (e) {
      console.error('Document save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  // Comprehensive formatting injections for rich text & markdown
  const injectFormatting = (before: string, after: string = '') => {
    const el = textareaRef.current;
    if (!el || readonly) return;
    
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.substring(start, end);
    const updated = content.substring(0, start) + before + selected + after + content.substring(end);
    
    setContent(updated);
    setIsDirty(true);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const lineCount = useMemo(() => content.split('\n').length, [content]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-muted-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-foreground" />
        <span className="text-sm font-mono">Opening workspace editor...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-muted text-foreground font-sans overflow-hidden select-none">
      {/* Top Application Bar */}
      <header className="flex items-center justify-between px-4 h-13 bg-card border-b border-border/80 shrink-0 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileText className="w-4 h-4 text-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{file?.name || 'Untitled Document'}</span>
          {isDirty && <span className="w-2 h-2 rounded-full bg-amber-400/70 shrink-0 animate-pulse" title="Unsaved changes" />}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-muted border border-border/80 rounded-lg p-0.5">
          <Button
            variant={viewMode === 'edit' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('edit')}
            className="h-7 px-2.5 text-xs font-medium rounded-md"
          >
            <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
          {fileLang === 'markdown' && !isMobile && (
            <Button
              variant={viewMode === 'split' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('split')}
              className="h-7 px-2.5 text-xs font-medium rounded-md"
            >
              <Columns className="w-3.5 h-3.5 mr-1" /> Split
            </Button>
          )}
          <Button
            variant={viewMode === 'preview' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('preview')}
            className="h-7 px-2.5 text-xs font-medium rounded-md"
          >
            <Eye className="w-3.5 h-3.5 mr-1" /> Preview
          </Button>
        </div>

        {/* Toolbar Quick Actions */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 bg-muted border border-border/80 rounded-lg p-0.5 hidden sm:flex">
            <Button variant="ghost" size="icon" onClick={() => setFontSize(s => Math.max(11, s - 1))} className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs font-mono px-1.5 text-muted-foreground">{fontSize}px</span>
            <Button variant="ghost" size="icon" onClick={() => setFontSize(s => Math.min(24, s + 1))} className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
          </div>

          {!readonly && onSave && (
            <Button 
              size="sm" 
              onClick={triggerSave} 
              disabled={!isDirty || saving}
              className={cn(
                "h-8 px-3.5 text-xs font-medium rounded-lg transition-all",
                isDirty ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground border border-border/50"
              )}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Save
            </Button>
          )}

          {onDownload && (
            <Button variant="ghost" size="icon" onClick={onDownload} className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Download className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Rich Formatting Toolbar (Active when editing) */}
      {!readonly && viewMode !== 'preview' && (
        <div className="flex items-center gap-1 px-4 h-10 bg-accent border-b border-border/60 overflow-x-auto shrink-0 no-scrollbar">
          <Button variant="ghost" size="icon" onClick={() => injectFormatting('# ', '')} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Heading 1">
            <Heading1 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => injectFormatting('## ', '')} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Heading 2">
            <Heading2 className="w-4 h-4" />
          </Button>
          <div className="h-4 w-px bg-border mx-1 shrink-0" />
          <Button variant="ghost" size="icon" onClick={() => injectFormatting('**', '**')} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Bold">
            <Bold className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => injectFormatting('*', '*')} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Italic">
            <Italic className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => injectFormatting('~~', '~~')} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Strikethrough">
            <Underline className="w-4 h-4" />
          </Button>
          <div className="h-4 w-px bg-border mx-1 shrink-0" />
          <Button variant="ghost" size="icon" onClick={() => injectFormatting('- ', '')} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Bullet List">
            <List className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => injectFormatting('1. ', '')} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Numbered List">
            <ListOrdered className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => injectFormatting('> ', '')} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Quote">
            <Quote className="w-4 h-4" />
          </Button>
          <div className="h-4 w-px bg-border mx-1 shrink-0" />
          <Button variant="ghost" size="icon" onClick={() => injectFormatting('`', '`')} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Inline Code">
            <Code className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => injectFormatting('[Title](', ')')} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Insert Link">
            <Link2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => injectFormatting('\n| Col 1 | Col 2 |\n|---|---|\n| Data | Data |\n')} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Insert Table">
            <Table className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Workspace Split / Editor Body */}
      <div className="flex flex-1 relative overflow-hidden bg-background">
        {/* Editor Pane */}
        {viewMode !== 'preview' && (
          <div className={cn("flex flex-1 h-full overflow-hidden", viewMode === 'split' && "border-r border-border/80")}>
            {/* Line Gutter */}
            <div 
              className="w-12 bg-accent border-r border-border/50 text-muted-foreground/60 font-mono text-right pr-3 py-4 select-none shrink-0 overflow-hidden hidden sm:block"
              style={{ fontSize: `${fontSize}px`, lineHeight: '1.625rem' }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleInput}
              onKeyUp={e => updateCursorStats(e.currentTarget)}
              onClick={e => updateCursorStats(e.currentTarget)}
              readOnly={readonly}
              placeholder="Start typing..."
              spellCheck={false}
              className={cn(
                "flex-1 w-full h-full bg-transparent p-4 sm:px-6 sm:py-4 border-0 focus:outline-none resize-none font-mono text-foreground placeholder:text-muted-foreground/40 leading-relaxed overflow-y-auto selection:bg-foreground/20",
                readonly && "cursor-default"
              )}
              style={{ fontSize: `${fontSize}px`, lineHeight: '1.625rem' }}
            />
          </div>
        )}

        {/* Live Markdown Preview Pane */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="flex-1 h-full overflow-y-auto p-6 bg-background">
            <EnhancedMarkdownPreview content={content} />
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <footer className="flex items-center justify-between px-4 h-8 bg-card border-t border-border/80 text-[11px] font-mono text-muted-foreground shrink-0">
        <div className="flex items-center gap-4">
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span className="hidden sm:inline">Lines: {lineCount}</span>
        </div>
        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="flex items-center gap-1 text-emerald-400 hidden sm:flex">
              <Clock className="w-3 h-3" />
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <span>UTF-8</span>
        </div>
      </footer>
    </div>
  );
}
