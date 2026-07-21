import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import EnhancedMarkdownPreview from './EnhancedMarkdownPreview';
import CodeEditor from './editor/CodeEditor';
import InkCanvas from './editor/InkCanvas';
import ObjectLayer from './editor/ObjectLayer';
import { backgroundCss } from './editor/backgrounds';
import {
  isSqdName, serializeDoc, defaultBackground,
  type EditorMode, type BackgroundConfig, type SqdObject, type InkStroke, type BrushType,
} from './editor/sqd';
import {
  FileText, Save, Maximize, Minimize,
  Code, PenTool, Eraser, Hand,
  Square, Circle, Minus, ArrowRight, Type,
  Bold, Italic, Strikethrough,
  List, ListOrdered, CheckSquare, Link as LinkIcon,
  Loader2, MousePointer2, X, Settings2,
  Palette, Command, Eye, WrapText,
  Undo2, Redo2, Download,
} from 'lucide-react';

const EXT_LANG: Record<string, string> = {
  js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
  json: 'json', html: 'html', css: 'css', md: 'markdown', py: 'python',
  java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp', go: 'go', rs: 'rust',
  sh: 'shell', sql: 'sql', yaml: 'yaml', txt: 'plaintext',
};

function detectLang(name?: string): string {
  if (!name) return 'plaintext';
  const ext = name.toLowerCase().split('.').pop()!;
  return EXT_LANG[ext] || 'plaintext';
}

const MD_EXTS = new Set(['md', 'markdown', 'mdx']);
const isMarkdown = (name?: string) => !!name && MD_EXTS.has(name.toLowerCase().split('.').pop()!);
const isSqdExt = (name?: string) => !!name && name.toLowerCase().endsWith('.sqd');

interface EnhancedTextEditorProps {
  file: { name?: string; id?: string; size?: number };
  decodedBlob: Blob | null;
  onSave?: (content: Blob, name?: string) => Promise<void> | void;
  readonly?: boolean;
  fullscreen?: boolean;
  onFullscreenChange?: (fs: boolean) => void;
  onDownload?: () => void;
  onShare?: () => void;
}

type CanvasTool = 'select' | BrushType | 'eraser'
  | 'rect' | 'ellipse' | 'line' | 'arrow' | 'textbox';

const BRUSH_CONFIG: Record<BrushType, { icon: React.FC<any>; label: string; category: string }> = {
  pen:         { icon: PenTool,     label: 'Pen',         category: 'Drawing' },
  pencil:      { icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="m17 3-4 14-3-5-5-3 14-4z"/><path d="m7.5 13.5 5 5"/></svg>, label: 'Pencil',      category: 'Drawing' },
  brush:       { icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M18.37 2.63a2.12 2.12 0 0 1 3 3L14 13l-4 1 1-4Z"/><path d="M9 15c-3 1-5 3-5 6 3 0 5-2 6-5l-1-1Z"/></svg>, label: 'Brush',       category: 'Drawing' },
  marker:      { icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 2v8"/><rect x="8" y="10" width="8" height="12" rx="1"/><path d="M8 10h8"/></svg>, label: 'Marker',      category: 'Drawing' },
  'felt-tip':  { icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="m18 2 4 4-8 8-4-4Z"/><path d="m10 10-2 6 6-2 8-8-4-4Z"/></svg>, label: 'Felt-tip',    category: 'Drawing' },
  calligraphy:{ icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="m15 4 6 6-9 9-6-6Z"/><path d="M4 20c2-4 6-4 8-2"/><path d="M15.5 6.5 18 4"/></svg>, label: 'Calligraphy', category: 'Drawing' },
  spray:       { icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><circle cx="7" cy="5" r="1"/><circle cx="12" cy="3" r="1"/><circle cx="17" cy="5" r="1"/><circle cx="5" cy="9" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="15" cy="8" r="1"/><circle cx="19" cy="9" r="1"/><rect x="8" y="11" width="8" height="11" rx="2"/></svg>, label: 'Spray',       category: 'Effects' },
  neon:        { icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2v1"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h1"/><path d="m19.07 10.93-1.41 1.41"/><path d="M21 18h1"/><path d="m15 6-4 8"/><path d="m9 6 4 8"/></svg>, label: 'Neon',        category: 'Effects' },
  charcoal:    { icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M4 20h16"/><path d="M8 16V8a4 4 0 0 1 8 0v8"/><path d="M12 4v4"/></svg>, label: 'Charcoal',    category: 'Texture' },
  highlighter: { icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>, label: 'Highlighter', category: 'Texture' },
  gel:         { icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/></svg>, label: 'Gel',         category: 'Ink' },
  fountain:    { icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="m18 2 4 4-8 8-4-4Z"/><path d="M4 20c2-4 6-4 8-2"/><path d="M15.5 6.5 18 4"/></svg>, label: 'Fountain',    category: 'Ink' },
  technical:   { icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 12h6"/><path d="M22 12h-6"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>, label: 'Technical',   category: 'Ink' },
};

export default function EnhancedTextEditor({
  file, decodedBlob, onSave, readonly = false, fullscreen: fullscreenProp, onFullscreenChange,
  onDownload, onShare,
}: EnhancedTextEditorProps) {
  const isMobile = useIsMobile();

  const contentRef = useRef<string>('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [view, setView] = useState<'edit' | 'split' | 'preview'>('edit');
  const [fullscreen, setFullscreen] = useState(fullscreenProp || false);
  const [lang, setLang] = useState('plaintext');
  const [previewContent, setPreviewContent] = useState('');

  interface EditorPrefs {
    fontSize: number;
    lineHeight: number;
    wordWrap: boolean;
    fontFamily: string;
    tabSize: number;
  }
  const DEFAULT_PREFS: EditorPrefs = {
    fontSize: isMobile ? 14 : 13,
    lineHeight: 1.6,
    wordWrap: true,
    fontFamily: "'Geist Mono', 'JetBrains Mono', Menlo, monospace",
    tabSize: 2,
  };
  const loadPrefs = (): EditorPrefs => {
    try { const r = localStorage.getItem('ete-prefs'); if (r) return { ...DEFAULT_PREFS, ...JSON.parse(r) }; } catch {}
    return DEFAULT_PREFS;
  };
  const [prefs, setPrefs] = useState<EditorPrefs>(loadPrefs);
  const { fontSize, lineHeight, wordWrap, fontFamily } = prefs;
  const updatePref = (p: Partial<EditorPrefs>) =>
    setPrefs(prev => {
      const next = { ...prev, ...p };
      try { localStorage.setItem('ete-prefs', JSON.stringify(next)); } catch {}
      return next;
    });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useState<EditorMode>('text');
  const [tool, setTool] = useState<CanvasTool>('pen');
  const [brushType, setBrushType] = useState<BrushType>('pen');
  const [inkColor, setInkColor] = useState('#e0e0e0');
  const [penSize, setPenSize] = useState(3);
  const [penOnly, setPenOnly] = useState(true);

  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [objects, setObjects] = useState<SqdObject[]>([]);
  const [background] = useState<BackgroundConfig>(defaultBackground());
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const [brushDropdownOpen, setBrushDropdownOpen] = useState(false);
  const brushDropdownRef = useRef<HTMLDivElement>(null);

  const fileName = file?.name || 'Untitled';
  const markdown = isMarkdown(fileName);
  const isSqd = isSqdExt(fileName);

  const overlayShown = mode !== 'text';
  const isInkTool = overlayShown && (
    tool === 'pen' || tool === 'pencil' || tool === 'brush' || tool === 'marker' ||
    tool === 'felt-tip' || tool === 'calligraphy' || tool === 'spray' || tool === 'neon' ||
    tool === 'charcoal' || tool === 'highlighter' || tool === 'gel' || tool === 'fountain' ||
    tool === 'technical' || tool === 'eraser'
  );
  const objActive = overlayShown && !isInkTool && tool !== 'select';

  const saveTimer = useRef<number | null>(null);
  const previewTimer = useRef<number | null>(null);

  const ALL_BRUSH_TYPES: BrushType[] = [
    'pen', 'pencil', 'brush', 'marker', 'felt-tip', 'calligraphy',
    'spray', 'neon', 'charcoal', 'highlighter', 'gel', 'fountain', 'technical',
  ];

  useEffect(() => {
    const detected = detectLang(fileName);
    setLang(detected);
    if (markdown && !isMobile) setView('split');
  }, [isMobile, fileName, markdown]);

  useEffect(() => {
    let cancelled = false;
    if (decodedBlob) {
      decodedBlob.text().then(t => {
        if (cancelled) return;
        contentRef.current = t;
        setPreviewContent(t);
        setReady(true);
        setLoading(false);
      }).catch(() => {
        if (cancelled) return;
        setReady(true);
        setLoading(false);
      });
    } else {
      contentRef.current = '';
      setReady(true);
      setLoading(false);
    }
    return () => { cancelled = true; };
  }, [decodedBlob, fileName]);

  const scheduleAutosave = useCallback(() => {
    if (!onSave || readonly) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => doSave(), 1000);
  }, [onSave, readonly]);

  const doSave = useCallback(async () => {
    if (!onSave || readonly || saving) return;
    setSaving(true);
    try {
      const shouldSqd = isSqd || strokes.length > 0 || objects.length > 0 || mode !== 'text';
      let blob: Blob;
      let name = fileName;
      if (shouldSqd) {
        blob = serializeDoc({
          kind: 'sqd', version: 1, text: contentRef.current, language: lang,
          background, strokes, objects, meta: { mode },
        });
        if (!isSqd) name = (fileName.replace(/\.[^.]+$/, '') || fileName) + '.sqd';
      } else {
        blob = new Blob([contentRef.current], { type: 'text/plain' });
      }
      await onSave(blob, name);
      setIsDirty(false);
    } catch (e) {
      console.error('Save failed', e);
    } finally {
      setSaving(false);
    }
  }, [onSave, readonly, saving, fileName, strokes, objects, mode, lang, background, isSqd]);

  const markDirty = useCallback(() => {
    if (!readonly) { setIsDirty(true); scheduleAutosave(); }
  }, [readonly, scheduleAutosave]);

  const handleCodeChange = useCallback((val: string) => {
    contentRef.current = val;
    if (!readonly) setIsDirty(true);
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => setPreviewContent(val), 250);
  }, [readonly]);

  const handleBrushSelect = useCallback((b: BrushType) => {
    setBrushType(b);
    setTool(b);
    setMode('draw');
    setBrushDropdownOpen(false);
  }, []);

  const handleToolSelect = useCallback((t: CanvasTool) => {
    if (ALL_BRUSH_TYPES.includes(t as BrushType)) {
      setBrushType(t as BrushType);
      setTool(t);
      setMode('draw');
    } else if (t === 'eraser' || t === 'select') {
      setTool(t);
      if (t === 'select') setMode('write');
    } else {
      setTool(t);
      setMode('write');
    }
  }, []);

  const colorPresets = [
    '#e0e0e0', '#ef4444', '#3b82f6', '#10b981',
    '#f59e0b', '#a855f7', '#ec4899', '#06b6d4',
  ];

  const currentBrushConfig = BRUSH_CONFIG[brushType];
  const CurrentBrushIcon = currentBrushConfig?.icon || PenTool;

  const brushCategories = useMemo(() => {
    const cats: Record<string, BrushType[]> = {};
    for (const b of ALL_BRUSH_TYPES) {
      const cat = BRUSH_CONFIG[b].category;
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(b);
    }
    return cats;
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (brushDropdownRef.current && !brushDropdownRef.current.contains(e.target as Node)) {
        setBrushDropdownOpen(false);
      }
    };
    if (brushDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [brushDropdownOpen]);

  if (loading) {
    return (
      <div className="flex flex-col w-full h-full bg-[#09090b] text-white items-center justify-center gap-4">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        <span className="text-xs text-zinc-500 tracking-wide">Loading...</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col w-full h-full bg-[#09090b] text-white font-sans overflow-hidden select-none",
      fullscreen && "fixed inset-0 z-[9999]"
    )}>

      <header className="flex items-center justify-between px-4 h-12 bg-[#0f0f11] border-b border-white/[0.06] shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-[13px] font-semibold truncate">{fileName}</span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono shrink-0">{lang}</span>
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80 shrink-0" />}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="flex items-center p-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg mr-2">
            {([
              { id: 'text' as const, label: 'Code', icon: Code },
              { id: 'write' as const, label: 'Hybrid', icon: Layers },
              { id: 'draw' as const, label: 'Canvas', icon: PenTool },
            ]).map(m => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id);
                  if (m.id === 'text') setTool('select');
                  if (m.id === 'write') setTool('select');
                  if (m.id === 'draw') { setTool(brushType); }
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-150",
                  (m.id === mode || (m.id === 'write' && mode !== 'text' && mode !== 'draw'))
                    ? "bg-white text-black shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <m.icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            ))}
          </div>

          {markdown && (
            <div className="flex items-center mr-1 p-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
              {(['edit', 'split', 'preview'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                    view === v ? "bg-white/10 text-white" : "text-zinc-600 hover:text-zinc-400"
                  )}
                >
                  {v === 'edit' ? 'Edit' : v === 'split' ? 'Split' : 'View'}
                </button>
              ))}
            </div>
          )}

          <button onClick={() => setSettingsOpen(o => !o)} className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", settingsOpen ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]")}>
            <Settings2 className="w-4 h-4" />
          </button>

          {!readonly && onSave && (
            <button onClick={doSave} disabled={!isDirty || saving} className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
              isDirty ? "bg-white text-black hover:bg-zinc-200" : "text-zinc-600 bg-white/[0.03] border border-white/[0.06]"
            )}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
          )}

          <button onClick={() => { setFullscreen(!fullscreen); onFullscreenChange?.(!fullscreen); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors">
            {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {markdown && view !== 'preview' && mode === 'text' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 p-1 bg-[#18181b]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl">
          {[
            { icon: Bold, action: () => {} },
            { icon: Italic, action: () => {} },
            { icon: Strikethrough, action: () => {} },
            null,
            { icon: List, action: () => {} },
            { icon: ListOrdered, action: () => {} },
            { icon: CheckSquare, action: () => {} },
            null,
            { icon: Code, action: () => {} },
            { icon: LinkIcon, action: () => {} },
          ].map((item, i) => item === null ? (
            <div key={i} className="w-px h-5 bg-white/[0.08] mx-0.5" />
          ) : (
            <button key={i} onClick={item.action} className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-colors">
              <item.icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 relative overflow-hidden">
        {view !== 'preview' && (
          <div className={cn("relative flex flex-1 h-full overflow-hidden", view === 'split' && "border-r border-white/[0.06]")}>
            <div className="absolute inset-0 z-0" style={{ pointerEvents: isInkTool || objActive ? 'none' : 'auto' }}>
              {ready ? (
                <CodeEditor
                  key={`${file?.id}-${lang}`}
                  value={contentRef.current}
                  language={lang}
                  onChange={handleCodeChange}
                  options={{
                    fontSize,
                    fontFamily,
                    lineHeight,
                    wordWrap,
                    readOnly: readonly,
                    placeholder: 'Start typing...',
                  }}
                  className="w-full h-full"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-xs">Loading editor...</div>
              )}
            </div>

            {overlayShown && (
              <div className="absolute inset-0 z-10" style={{ pointerEvents: 'none', ...backgroundCss(background) }}>
                <InkCanvas
                  active={isInkTool}
                  tool={tool as any}
                  brush={brushType}
                  color={inkColor}
                  size={penSize}
                  penOnly={penOnly}
                  strokes={strokes}
                  onStrokesChange={(u) => { setStrokes(u); markDirty(); }}
                  readOnly={readonly}
                />
                <ObjectLayer
                  active={objActive}
                  tool={tool}
                  color={inkColor}
                  objects={objects}
                  onObjectsChange={(u) => { setObjects(u); markDirty(); }}
                  selectedId={selectedObjectId}
                  onSelect={setSelectedObjectId}
                  readOnly={readonly}
                  snap={true}
                />
              </div>
            )}
          </div>
        )}

        {(view === 'preview' || view === 'split') && (
          <div className="flex-1 h-full overflow-y-auto p-10 bg-[#09090b] custom-scrollbar">
            <EnhancedMarkdownPreview content={previewContent} />
          </div>
        )}
      </div>

      {overlayShown && !readonly && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 p-1.5 bg-[#18181b]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-[0_16px_48px_-8px_rgba(0,0,0,0.5)]">

          <ToolBtn icon={MousePointer2} active={tool === 'select'} onClick={() => handleToolSelect('select')} title="Select" />

          <div className="w-px h-6 bg-white/[0.08] mx-1" />

          <div ref={brushDropdownRef} className="relative">
            <button
              onClick={() => setBrushDropdownOpen(o => !o)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 h-9 rounded-xl text-xs font-medium transition-all",
                isInkTool && tool !== 'eraser'
                  ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
              )}
              title={currentBrushConfig?.label || 'Brush'}
            >
              <CurrentBrushIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{currentBrushConfig?.label}</span>
              <svg className={cn("w-3 h-3 transition-transform", brushDropdownOpen && "rotate-180")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {brushDropdownOpen && (
              <div className="absolute bottom-full mb-2 left-0 w-56 p-1.5 bg-[#18181b] border border-white/[0.08] rounded-xl shadow-2xl max-h-[360px] overflow-y-auto custom-scrollbar">
                {Object.entries(brushCategories).map(([cat, brushes]) => (
                  <div key={cat} className="mb-1.5 last:mb-0">
                    <div className="px-2 py-1 text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">{cat}</div>
                    {brushes.map(b => {
                      const cfg = BRUSH_CONFIG[b];
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={b}
                          onClick={() => handleBrushSelect(b)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all",
                            brushType === b
                              ? "bg-white text-black" : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <ToolBtn icon={Eraser} active={tool === 'eraser'} onClick={() => handleToolSelect('eraser')} title="Eraser" />

          <button
            onClick={() => setPenOnly(p => !p)}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
              penOnly ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20" : "text-zinc-500 hover:text-white hover:bg-white/[0.06]"
            )}
            title="Palm Rejection"
          >
            <Hand className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-white/[0.08] mx-1" />

          {([
            { id: 'rect' as const, icon: Square, label: 'Rectangle' },
            { id: 'ellipse' as const, icon: Circle, label: 'Ellipse' },
            { id: 'line' as const, icon: Minus, label: 'Line' },
            { id: 'arrow' as const, icon: ArrowRight, label: 'Arrow' },
            { id: 'textbox' as const, icon: Type, label: 'Text' },
          ]).map(s => (
            <ToolBtn key={s.id} icon={s.icon} active={tool === s.id} onClick={() => handleToolSelect(s.id)} title={s.label} />
          ))}

          <div className="w-px h-6 bg-white/[0.08] mx-1" />

          <div className="flex items-center gap-1.5 px-1.5">
            <label className="relative w-7 h-7 rounded-full border-2 border-white/20 overflow-hidden cursor-pointer flex items-center justify-center shrink-0" style={{ backgroundColor: inkColor }}>
              <Palette className="w-3 h-3 text-white/60 mix-blend-overlay" />
              <input type="color" value={inkColor} onChange={e => setInkColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </label>
            {colorPresets.map(c => (
              <button
                key={c}
                onClick={() => setInkColor(c)}
                className={cn(
                  "w-5 h-5 rounded-full border-2 transition-all shrink-0",
                  inkColor === c ? "border-white scale-110" : "border-transparent hover:scale-110"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-white/[0.08] mx-1" />

          <div className="flex items-center gap-1 px-1">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 5, 8].map(s => (
                <button
                  key={s}
                  onClick={() => setPenSize(s)}
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-lg transition-all",
                    penSize === s ? "bg-white/10 text-white" : "text-zinc-600 hover:text-zinc-400"
                  )}
                  title={`${s}px`}
                >
                  <div className="rounded-full bg-current" style={{ width: Math.min(s * 2 + 2, 14), height: Math.min(s * 2 + 2, 14) }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedObjectId && overlayShown && (
        <div className="absolute top-16 right-4 z-30 flex flex-col gap-1 p-1.5 bg-[#18181b]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl">
          {[
            { title: 'Duplicate', action: () => {
              const obj = objects.find(o => o.id === selectedObjectId);
              if (!obj) return;
              const copy = { ...obj, id: 'o' + Math.random().toString(36).slice(2, 9) } as SqdObject;
              setObjects(p => [...p, copy]); setSelectedObjectId(copy.id); markDirty();
            }, icon: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> },
            { title: 'Bring Forward', action: () => setObjects(p => { const i = p.findIndex(o => o.id === selectedObjectId); if (i < 0 || i === p.length - 1) return p; const n = [...p]; [n[i], n[i+1]] = [n[i+1], n[i]]; return n; }), icon: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 9-6 6-6-6"/></svg> },
            { title: 'Send Backward', action: () => setObjects(p => { const i = p.findIndex(o => o.id === selectedObjectId); if (i <= 0) return p; const n = [...p]; [n[i], n[i-1]] = [n[i-1], n[i]]; return n; }), icon: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 15 6-6 6 6"/></svg> },
            null,
            { title: 'Delete', action: () => { setObjects(o => o.filter(x => x.id !== selectedObjectId)); setSelectedObjectId(null); }, icon: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>, danger: true },
          ].map((item, i) => item === null ? (
            <div key={i} className="h-px bg-white/[0.08] my-0.5" />
          ) : (
            <button key={i} onClick={item.action} className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
              item.danger ? "text-red-400 hover:bg-red-400/10" : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
            )} title={item.title}>
              <item.icon />
            </button>
          ))}
        </div>
      )}

      {settingsOpen && (
        <div className="absolute top-14 right-4 z-50 w-64 p-3 bg-[#18181b]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5" /> Editor</span>
            <button onClick={() => setSettingsOpen(false)} className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-zinc-400">Size</span>
                <span className="text-zinc-600 font-mono">{fontSize}px</span>
              </div>
              <input type="range" min={10} max={22} value={fontSize} onChange={e => updatePref({ fontSize: +e.target.value })} className="w-full accent-white h-1" />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-zinc-400">Line height</span>
                <span className="text-zinc-600 font-mono">{lineHeight.toFixed(2)}</span>
              </div>
              <input type="range" min={1.2} max={2.4} step={0.05} value={lineHeight} onChange={e => updatePref({ lineHeight: +e.target.value })} className="w-full accent-white h-1" />
            </div>

            <div>
              <span className="text-[11px] text-zinc-400 mb-1.5 block">Font</span>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'geist', label: 'Geist', fam: "'Geist Mono','JetBrains Mono',Menlo,monospace" },
                  { id: 'jb', label: 'JetBrains', fam: "'JetBrains Mono',Menlo,monospace" },
                  { id: 'sys', label: 'System', fam: "ui-monospace,Menlo,monospace" },
                ].map(f => (
                  <button key={f.id} onClick={() => updatePref({ fontFamily: f.fam })}
                    className={cn("px-2 py-1.5 rounded-md text-[11px] font-semibold transition-all",
                      fontFamily === f.fam ? "bg-white text-black" : "bg-white/[0.04] text-zinc-500 hover:text-white"
                    )}>{f.label}</button>
                ))}
              </div>
            </div>

            <button onClick={() => { try { localStorage.removeItem('ete-prefs'); } catch {} setPrefs(DEFAULT_PREFS); }}
              className="w-full py-1.5 rounded-lg text-[11px] font-semibold bg-white/[0.04] text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-colors">
              Reset defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Layers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  );
}

function ToolBtn({ icon: Icon, active, onClick, title }: { icon: any; active?: boolean; onClick?: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} className={cn(
      "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150",
      active ? "bg-white text-black shadow-sm" : "text-zinc-500 hover:text-white hover:bg-white/[0.06]"
    )}>
      <Icon className="w-4 h-4" />
    </button>
  );
}
