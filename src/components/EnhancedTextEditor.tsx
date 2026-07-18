import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import EnhancedMarkdownPreview from './EnhancedMarkdownPreview';
import InkCanvas from './editor/InkCanvas';
import ObjectLayer from './editor/ObjectLayer';
import { backgroundCss } from './editor/backgrounds';
import {
  isSqdName, serializeDoc, defaultBackground,
  type EditorMode, type BackgroundConfig, type SqdObject, type InkStroke, type BrushType,
} from './editor/sqd';
import { defineMonoThemes, MONO_DARK_ID } from './editor/monacoTheme';
import './editor/monaco-mono.css';

import {
  FileText, Settings, Save, Maximize, Minimize,
  Command, Code, PenTool, Eraser, Hand, Layers,
  Square, Circle, Minus, ArrowRight, Type, Trash2,
  Copy, ArrowUp, ArrowDown, Bold, Italic, Strikethrough,
  List, ListOrdered, CheckSquare, Link as LinkIcon, Loader2, MousePointer2,
  Brush, Pencil, Highlighter, X, SlidersHorizontal, WrapText,
  CaseSensitive, Eye, Palette
} from 'lucide-react';

import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

let monacoEnvSet = false;
function ensureMonacoEnv() {
  if (monacoEnvSet || typeof window === 'undefined') return;
  (window as any).MonacoEnvironment = {
    getWorker(_: unknown, label: string) {
      if (label === 'json') return new JsonWorker();
      if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker();
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker();
      if (label === 'typescript' || label === 'javascript') return new TsWorker();
      return new EditorWorker();
    },
  };
  monacoEnvSet = true;
}

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

interface EnhancedTextEditorProps {
  file: { name?: string; id?: string; size?: number };
  decodedBlob: Blob | null;
  onSave?: (content: Blob, name?: string) => Promise<void> | void;
  readonly?: boolean;
  fullscreen?: boolean;
  onFullscreenChange?: (fs: boolean) => void;
}

export default function EnhancedTextEditor({
  file, decodedBlob, onSave, readonly = false, fullscreen: fullscreenProp, onFullscreenChange,
}: EnhancedTextEditorProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  
  const contentRef = useRef<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  const [view, setView] = useState<'edit' | 'split' | 'preview'>('edit');
  const [fullscreen, setFullscreen] = useState(fullscreenProp || false);
  const [lang, setLang] = useState('plaintext');
  
  // ---- Editor preferences (persisted) ----
  interface EditorPrefs {
    fontSize: number;
    lineHeight: number; // multiplier of fontSize
    wordWrap: boolean;
    minimap: boolean;
    lineNumbers: boolean;
    fontFamily: string;
  }
  const DEFAULT_PREFS: EditorPrefs = {
    fontSize: isMobile ? 14 : 13,
    lineHeight: 1.6,
    wordWrap: true,
    minimap: !isMobile,
    lineNumbers: true,
    fontFamily: "'Geist Mono', 'JetBrains Mono', Menlo, monospace",
  };
  const loadPrefs = (): EditorPrefs => {
    try {
      const raw = localStorage.getItem('ete-prefs');
      if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULT_PREFS;
  };
  const [prefs, setPrefs] = useState<EditorPrefs>(loadPrefs);
  const { fontSize, lineHeight, wordWrap, minimap, lineNumbers, fontFamily } = prefs;
  const updatePref = (p: Partial<EditorPrefs>) =>
    setPrefs((prev) => {
      const next = { ...prev, ...p };
      try { localStorage.setItem('ete-prefs', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  
  // Hybrid Workspace State
  const [mode, setMode] = useState<EditorMode>('text'); // 'text', 'write' (hybrid), 'draw'
  const [tool, setTool] = useState<'off' | 'pen' | 'brush' | 'pencil' | 'marker' | 'eraser' | 'select' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'textbox'>('off');
  const [brushType, setBrushType] = useState<BrushType>('pen');
  const [inkColor, setInkColor] = useState('#e0e0e0');
  const [penSize, setPenSize] = useState(3);
  const [penOnly, setPenOnly] = useState(true); // Palm Rejection
  
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [objects, setObjects] = useState<SqdObject[]>([]);
  const [background] = useState<BackgroundConfig>(defaultBackground());
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const [previewContent, setPreviewContent] = useState('');
  const fileName = file?.name || 'Untitled';
  const markdown = isMarkdown(fileName);

  // Derived Canvas Activity
  const overlayShown = mode !== 'text';
  const inkActive = overlayShown && (tool === 'pen' || tool === 'brush' || tool === 'pencil' || tool === 'marker' || tool === 'eraser');
  const objActive = overlayShown && !inkActive && tool !== 'off';

  const saveTimer = useRef<number | null>(null);
  const previewTimer = useRef<number | null>(null);

  // Initialize Monaco
  useEffect(() => {
    let disposed = false;
    const init = async () => {
      if (!containerRef.current) return;
      try {
        ensureMonacoEnv();
        const monaco = (await import('monaco-editor')).default ?? (await import('monaco-editor'));
        if (disposed) return;
        monacoRef.current = monaco;

        defineMonoThemes(monaco);
        const detected = detectLang(fileName);
        setLang(detected);

        // Load actual file content from the decoded blob
        let initialVal = '';
        if (decodedBlob) {
          try { initialVal = await decodedBlob.text(); } catch { /* ignore */ }
        }
        contentRef.current = initialVal;

        const ed = monaco.editor.create(containerRef.current, {
          value: initialVal, language: detected, theme: MONO_DARK_ID,
          fontSize, fontFamily: fontFamily,
          fontLigatures: true, lineHeight: Math.round(fontSize * lineHeight), minimap: { enabled: minimap },
          automaticLayout: true, wordWrap: wordWrap ? 'on' : 'off',
          lineNumbers: lineNumbers ? 'on' : 'off',
          padding: { top: 24, bottom: 24 }, scrollbar: { useShadows: false },
          readOnly: readonly,
        });
        
        editorRef.current = ed;
        
        ed.onDidChangeModelContent(() => {
          const v = ed.getValue();
          contentRef.current = v;
          if (!readonly) { setIsDirty(true); scheduleAutosave(); }
          if (previewTimer.current) window.clearTimeout(previewTimer.current);
          previewTimer.current = window.setTimeout(() => setPreviewContent(v), 250);
        });

        if (markdown && !isMobile) setView('split');
        if (!disposed) setLoading(false);
      } catch (err) {
        console.error('Monaco init failed:', err);
        if (!disposed) setLoading(false);
      }
    };
    init();
    return () => { disposed = true; editorRef.current?.dispose(); };
  }, [isMobile, fileName, readonly]);

  // Apply editor preferences live (no editor re-create)
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.updateOptions({
      fontSize,
      lineHeight: Math.round(fontSize * lineHeight),
      wordWrap: wordWrap ? 'on' : 'off',
      minimap: { enabled: minimap },
      lineNumbers: lineNumbers ? 'on' : 'off',
      fontFamily,
    });
  }, [fontSize, lineHeight, wordWrap, minimap, lineNumbers, fontFamily]);

  const scheduleAutosave = useCallback(() => {
    if (!onSave || readonly) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => doSave(), 1000);
  }, [onSave, readonly]);

  const doSave = useCallback(async () => {
    if (!onSave || readonly || saving) return;
    setSaving(true);
    try {
      const isSqd = isSqdName(fileName) || strokes.length > 0 || objects.length > 0 || mode !== 'text';
      let blob: Blob;
      let name = fileName;
      
      if (isSqd) {
        blob = serializeDoc({
          kind: 'sqd', version: 1, text: contentRef.current, language: lang,
          background, strokes, objects, meta: { mode }
        });
        if (!isSqdName(fileName)) name = (fileName.replace(/\.[^.]+$/, '') || fileName) + '.sqd';
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
  }, [onSave, readonly, saving, fileName, strokes, objects, mode, lang, background]);

  const markDirtyNotes = useCallback(() => { if (!readonly) { setIsDirty(true); scheduleAutosave(); } }, [readonly, scheduleAutosave]);

  return (
    <div className={cn("flex flex-col w-full h-full bg-[#0A0A0A] text-white font-sans overflow-hidden relative", fullscreen && "fixed inset-0 z-[9999]")}>
      
      {/* LOADING OVERLAY */}
      {loading && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-[#0A0A0A] gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          <span className="text-sm font-medium text-zinc-400">Loading IDE…</span>
        </div>
      )}

      {/* HEADER: File Info & Core Settings */}
      <header className="flex items-center justify-between px-5 h-16 bg-[#121212] border-b border-zinc-800/80 shrink-0 z-30 select-none">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shadow-sm">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight">{fileName}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">{lang}</span>
              {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Unsaved changes" />}
            </div>
          </div>
        </div>

        {/* WORKSPACE MODE SWITCHER */}
        <div className="hidden md:flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-inner">
          {[
            { id: 'text', label: 'Code', icon: Code },
            { id: 'write', label: 'Hybrid', icon: Layers },
            { id: 'draw', label: 'Canvas', icon: PenTool }
          ].map(m => {
            const isActive = m.id === mode || (m.id === 'write' && mode !== 'text' && mode !== 'draw');
            return (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id as EditorMode);
                  if (m.id === 'text') setTool('off');
                  if (m.id === 'write') setTool('select');
                  if (m.id === 'draw') setTool('pen');
                }}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all", isActive ? "bg-white text-black shadow-md" : "text-zinc-500 hover:text-white")}
              >
                <m.icon className="w-4 h-4" /> {m.label}
              </button>
            )
          })}
        </div>

        {/* ACTIONS & VIEW SWITCHER */}
        <div className="flex items-center gap-2">
          {markdown && (
            <div className="flex items-center mr-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
              <button onClick={() => setView('edit')} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold", view === 'edit' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white")}>Edit</button>
              <button onClick={() => setView('split')} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold", view === 'split' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white")}>Split</button>
              <button onClick={() => setView('preview')} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold", view === 'preview' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white")}>View</button>
            </div>
          )}
          
          <button onClick={() => { setCommandOpen(o => !o); setSettingsOpen(false); }} className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-colors", commandOpen ? "bg-white text-black" : "text-zinc-400 hover:bg-zinc-900 hover:text-white")} title="Commands"><Command className="w-4 h-4" /></button>
          <button onClick={() => { setSettingsOpen(o => !o); setCommandOpen(false); }} className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-colors", settingsOpen ? "bg-white text-black" : "text-zinc-400 hover:bg-zinc-900 hover:text-white")} title="Editor settings"><Settings className="w-4 h-4" /></button>
          
          {!readonly && onSave && (
            <button onClick={doSave} disabled={!isDirty || saving} className={cn("ml-2 flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm", isDirty ? "bg-white text-black hover:bg-zinc-200 hover:scale-105 active:scale-95" : "bg-zinc-900 text-zinc-600 border border-zinc-800")}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          )}
          <button onClick={() => { setFullscreen(!fullscreen); onFullscreenChange?.(!fullscreen); }} className="ml-1 w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors">
            {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* MARKDOWN CONTEXTUAL TOOLBAR */}
      {markdown && view !== 'preview' && mode === 'text' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 bg-[#121212]/95 backdrop-blur-2xl border border-zinc-800 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          <FormatBtn icon={Bold} />
          <FormatBtn icon={Italic} />
          <FormatBtn icon={Strikethrough} />
          <div className="w-px h-6 bg-zinc-800 mx-1" />
          <FormatBtn icon={List} />
          <FormatBtn icon={ListOrdered} />
          <FormatBtn icon={CheckSquare} />
          <div className="w-px h-6 bg-zinc-800 mx-1" />
          <FormatBtn icon={Code} />
          <FormatBtn icon={LinkIcon} />
        </div>
      )}

      {/* MAIN WORKSPACE GRID */}
      <div className="flex flex-1 relative overflow-hidden">
        
        {/* Monaco / Canvas Layer */}
        {view !== 'preview' && (
          <div className={cn("relative flex flex-1 h-full overflow-hidden bg-[#0A0A0A]", view === 'split' && "border-r border-zinc-800/80")}>
            
            {/* Editor stays at z-0, handles text input when canvas is transparent/off */}
            <div ref={containerRef} className="absolute inset-0 z-0" style={{ pointerEvents: inkActive || objActive ? 'none' : 'auto' }} />
            
            {/* InkCanvas & ObjectLayer overlay */}
            {overlayShown && (
              <div className="absolute inset-0 z-10" style={{ pointerEvents: 'none', ...backgroundCss(background) }}>
                {/* 🚨 Uses the NEW ultra-smooth perfect-freehand InkCanvas 🚨 */}
                <InkCanvas
                  active={inkActive} tool={tool as any} brush={brushType} color={inkColor} size={penSize}
                  penOnly={penOnly} strokes={strokes} onStrokesChange={(u) => { setStrokes(u); markDirtyNotes(); }} readOnly={readonly}
                />
                
                {/* Object/Shape Layer */}
                <ObjectLayer
                  active={objActive} tool={tool} color={inkColor} objects={objects}
                  onObjectsChange={(u) => { setObjects(u); markDirtyNotes(); }} selectedId={selectedObjectId}
                  onSelect={setSelectedObjectId} readOnly={readonly} snap={true}
                />
              </div>
            )}
          </div>
        )}

        {/* Live Preview Pane */}
        {(view === 'preview' || view === 'split') && (
          <div className="flex-1 h-full overflow-y-auto p-10 bg-[#0A0A0A] custom-scrollbar">
            <EnhancedMarkdownPreview content={previewContent} />
          </div>
        )}
      </div>

      {/* ═══ EXCALIDRAW-STYLE FLOATING CANVAS TOOLBAR ═══ */}
      {overlayShown && !readonly && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center p-2.5 bg-[#121214]/95 backdrop-blur-2xl border border-zinc-800/80 rounded-[2rem] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.6)] gap-1">

          <ToolBtn icon={MousePointer2} active={tool === 'select'} onClick={() => setTool('select')} title="Select / Move" />
          <div className="w-px h-8 bg-zinc-800 mx-2" />

          {/* Pens: Pen / Brush / Pencil / Marker — each maps to its brush physics */}
          {[
            { id: 'pen', label: 'Pen', icon: PenTool, brush: 'pen' as BrushType },
            { id: 'brush', label: 'Brush', icon: Brush, brush: 'brush' as BrushType },
            { id: 'pencil', label: 'Pencil', icon: Pencil, brush: 'pencil' as BrushType },
            { id: 'marker', label: 'Marker', icon: Highlighter, brush: 'marker' as BrushType },
          ].map(t => (
            <ToolBtn
              key={t.id}
              icon={t.icon}
              active={tool === t.id}
              onClick={() => { setMode('draw'); setTool(t.id); setBrushType(t.brush); }}
              title={t.label}
            />
          ))}

          <ToolBtn icon={Eraser} active={tool === 'eraser'} onClick={() => setTool('eraser')} title="Eraser" />

          {/* Palm Rejection Toggle */}
          <button onClick={() => setPenOnly(!penOnly)} className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all ml-1", penOnly ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20" : "text-zinc-500 hover:text-white hover:bg-zinc-800")} title="Palm Rejection">
            <Hand className="w-4 h-4" />
          </button>

          <div className="w-px h-8 bg-zinc-800 mx-2" />

          {/* Shapes */}
          <ToolBtn icon={Square} active={tool === 'rect'} onClick={() => setTool('rect')} title="Rectangle" />
          <ToolBtn icon={Circle} active={tool === 'ellipse'} onClick={() => setTool('ellipse')} title="Ellipse" />
          <ToolBtn icon={Minus} active={tool === 'line'} onClick={() => setTool('line')} title="Line" />
          <ToolBtn icon={ArrowRight} active={tool === 'arrow'} onClick={() => setTool('arrow')} title="Arrow" />
          <ToolBtn icon={Type} active={tool === 'textbox'} onClick={() => setTool('textbox')} title="Text" />

          <div className="w-px h-8 bg-zinc-800 mx-2" />

          {/* Color: picker + quick presets */}
          <div className="flex items-center gap-2 px-2">
            <label
              className="relative w-8 h-8 rounded-full border-2 border-white/30 overflow-hidden cursor-pointer flex items-center justify-center shadow-[0_0_12px_rgba(0,0,0,0.4)]"
              style={{ backgroundColor: inkColor }}
              title="Pick color"
            >
              <Palette className="w-3.5 h-3.5 text-white/80 mix-blend-overlay" />
              <input
                type="color"
                value={inkColor}
                onChange={(e) => setInkColor(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
            {['#e0e0e0', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7'].map(c => (
              <button
                key={c}
                onClick={() => setInkColor(c)}
                className={cn("w-5 h-5 rounded-full border-2 transition-all", inkColor === c ? "border-white scale-110 shadow-[0_0_12px_rgba(255,255,255,0.4)]" : "border-transparent hover:scale-110")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}

      {/* FLOATING ACTION MENU FOR SELECTED OBJECTS */}
      {selectedObjectId && overlayShown && (
        <div className="absolute top-24 right-8 z-30 flex flex-col gap-2 p-2.5 bg-[#121214]/95 backdrop-blur-2xl border border-zinc-800 rounded-[1.5rem] shadow-2xl">
          <ToolBtn icon={Copy} active={false} onClick={() => {
            const obj = objects.find(o => o.id === selectedObjectId);
            if (!obj) return;
            const copy = { ...obj, id: uid('o') } as SqdObject;
            setObjects(prev => [...prev, copy]);
            setSelectedObjectId(copy.id);
            markDirtyNotes();
          }} title="Duplicate" />
          <ToolBtn icon={ArrowUp} active={false} onClick={() => {
            setObjects(prev => {
              const i = prev.findIndex(o => o.id === selectedObjectId);
              if (i < 0 || i === prev.length - 1) return prev;
              const next = [...prev];
              [next[i], next[i + 1]] = [next[i + 1], next[i]];
              return next;
            });
          }} title="Bring Forward" />
          <ToolBtn icon={ArrowDown} active={false} onClick={() => {
            setObjects(prev => {
              const i = prev.findIndex(o => o.id === selectedObjectId);
              if (i <= 0) return prev;
              const next = [...prev];
              [next[i], next[i - 1]] = [next[i - 1], next[i]];
              return next;
            });
          }} title="Send Backward" />
          <div className="h-px w-full bg-zinc-800 my-1" />
          <button onClick={() => { setObjects(o => o.filter(x => x.id !== selectedObjectId)); setSelectedObjectId(null); }} className="w-10 h-10 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-400/10 transition-colors">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* SETTINGS POPOVER (persisted preferences) */}
      {settingsOpen && (
        <div className="absolute top-20 right-4 z-50 w-72 p-4 bg-[#121214]/95 backdrop-blur-2xl border border-zinc-800 rounded-2xl shadow-2xl text-zinc-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" /> Editor Settings</span>
            <button onClick={() => setSettingsOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1"><span>Font size</span><span className="text-zinc-400">{fontSize}px</span></div>
            <input type="range" min={10} max={22} value={fontSize} onChange={e => updatePref({ fontSize: Number(e.target.value) })} className="w-full accent-white" />
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1"><span>Line height</span><span className="text-zinc-400">{lineHeight.toFixed(2)}×</span></div>
            <input type="range" min={1.2} max={2.4} step={0.05} value={lineHeight} onChange={e => updatePref({ lineHeight: Number(e.target.value) })} className="w-full accent-white" />
          </div>

          <div className="mb-3">
            <div className="text-xs mb-1">Font</div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'geist', label: 'Geist', fam: "'Geist Mono', 'JetBrains Mono', Menlo, monospace" },
                { id: 'jb', label: 'JetBrains', fam: "'JetBrains Mono', Menlo, monospace" },
                { id: 'sys', label: 'System', fam: "ui-monospace, Menlo, monospace" },
              ].map(f => (
                <button key={f.id} onClick={() => updatePref({ fontFamily: f.fam })} className={cn("px-2 py-1.5 rounded-lg text-xs font-bold transition-all", fontFamily === f.fam ? "bg-white text-black" : "bg-zinc-900 text-zinc-400 hover:text-white")}>{f.label}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {[
              { label: 'Word wrap', on: wordWrap, set: (v: boolean) => updatePref({ wordWrap: v }) },
              { label: 'Minimap', on: minimap, set: (v: boolean) => updatePref({ minimap: v }) },
              { label: 'Line numbers', on: lineNumbers, set: (v: boolean) => updatePref({ lineNumbers: v }) },
            ].map(t => (
              <button key={t.label} onClick={() => t.set(!t.on)} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-zinc-800/60">
                <span>{t.label}</span>
                <span className={cn("w-8 h-4 rounded-full relative transition-colors", t.on ? "bg-white" : "bg-zinc-700")}>
                  <span className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-black transition-all", t.on ? "right-0.5" : "left-0.5")} />
                </span>
              </button>
            ))}
          </div>

          <button onClick={() => { try { localStorage.removeItem('ete-prefs'); } catch {} setPrefs(DEFAULT_PREFS); }} className="mt-3 w-full py-2 rounded-lg text-xs font-bold bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">Reset to defaults</button>
        </div>
      )}

      {/* COMMAND MENU */}
      {commandOpen && (
        <div className="absolute top-20 right-4 z-50 w-64 p-2 bg-[#121214]/95 backdrop-blur-2xl border border-zinc-800 rounded-2xl shadow-2xl text-zinc-200">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <span className="text-xs font-bold flex items-center gap-2"><Command className="w-3.5 h-3.5" /> Commands</span>
            <button onClick={() => setCommandOpen(false)} className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
          {[
            { label: 'Save', icon: Save, run: () => doSave() },
            { label: 'Toggle preview', icon: Eye, run: () => setView(view === 'preview' ? 'edit' : 'preview') },
            { label: 'Toggle word wrap', icon: WrapText, run: () => updatePref({ wordWrap: !wordWrap }) },
            { label: 'Toggle minimap', icon: CaseSensitive, run: () => updatePref({ minimap: !minimap }) },
            { label: 'Toggle line numbers', icon: CaseSensitive, run: () => updatePref({ lineNumbers: !lineNumbers }) },
            { label: 'Zoom in', icon: ArrowUp, run: () => updatePref({ fontSize: Math.min(22, fontSize + 1) }) },
            { label: 'Zoom out', icon: ArrowDown, run: () => updatePref({ fontSize: Math.max(10, fontSize - 1) }) },
          ].map(c => (
            <button key={c.label} onClick={() => { c.run(); }} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs hover:bg-zinc-800/60 transition-colors">
              <c.icon className="w-4 h-4 text-zinc-400" /> {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FormatBtn({ icon: Icon }: { icon: any }) {
  return (
    <button className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
      <Icon className="w-4 h-4" />
    </button>
  );
}

function ToolBtn({ icon: Icon, active, onClick, title }: any) {
  return (
    <button onClick={onClick} title={title} className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", active ? "bg-white text-black shadow-md scale-105" : "text-zinc-400 hover:text-white hover:bg-zinc-800")}>
      <Icon className="w-5 h-5" />
    </button>
  );
}
