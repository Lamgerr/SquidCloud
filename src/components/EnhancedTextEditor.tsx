import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import * as P from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import EnhancedMarkdownPreview from './EnhancedMarkdownPreview';
import InkCanvas from './editor/InkCanvas';
import ObjectLayer from './editor/ObjectLayer';
import { backgroundCss } from './editor/backgrounds';
import { shapePath, SHAPE_TYPES } from './editor/shapes';
import {
  isSqdName, serializeDoc, parseDoc, defaultBackground,
  type SqdDoc, type EditorMode, type BackgroundConfig, type SqdObject, type InkStroke,
} from './editor/sqd';

// Monaco web workers (bundled same-origin so the browser accepts them)
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

/* ------------------------------------------------------------------ *
 *  SquidEditor — a complete, industry-standard text editor.
 *  Inspired by VS Code (coding), Xcode (polish/UX), Obsidian & Notion
 *  (markdown + LaTeX), combining a word-processor + code IDE.
 *  Built on Monaco (coding perfection) + EnhancedMarkdownPreview (KaTeX).
 * ------------------------------------------------------------------ */

// ---- Monaco web-worker setup (bundled, same-origin) ----------
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

// ---- Language detection (100+ extensions) ----------------------------
const EXT_LANG: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  json: 'json', jsonc: 'json', json5: 'json',
  html: 'html', htm: 'html', xhtml: 'html',
  css: 'css', scss: 'scss', sass: 'sass', less: 'less',
  xml: 'xml', svg: 'xml', xsl: 'xml', xsd: 'xml', rss: 'xml', atom: 'xml',
  md: 'markdown', markdown: 'markdown', mdx: 'markdown', rmd: 'markdown',
  py: 'python', pyw: 'python', pyi: 'python',
  rb: 'ruby', gemspec: 'ruby',
  java: 'java', kt: 'kotlin', kts: 'kotlin', scala: 'scala', groovy: 'groovy',
  c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', hxx: 'cpp', hh: 'cpp',
  cs: 'csharp', csx: 'csharp',
  go: 'go', rs: 'rust', swift: 'swift', m: 'objective-c', mm: 'objective-cpp',
  php: 'php', phtml: 'php', php3: 'php', php4: 'php', php5: 'php',
  pl: 'perl', pm: 'perl',
  lua: 'lua',
  sh: 'shell', bash: 'shell', zsh: 'shell', ksh: 'shell', fish: 'shell', bats: 'shell',
  ps1: 'powershell', psm1: 'powershell', psd1: 'powershell',
  sql: 'sql',
  r: 'r', R: 'r',
  dart: 'dart',
  ex: 'elixir', exs: 'elixir',
  erl: 'erlang', hrl: 'erlang',
  clj: 'clojure', cljs: 'clojure', cljc: 'clojure', edn: 'clojure',
  hs: 'haskell', lhs: 'haskell',
  ml: 'ocaml', mli: 'ocaml',
  fs: 'fsharp', fsi: 'fsharp', fsx: 'fsharp',
  vb: 'vb',
  coffee: 'coffeescript',
  yaml: 'yaml', yml: 'yaml', toml: 'ini', ini: 'ini', cfg: 'ini', conf: 'ini',
  csv: 'csv', tsv: 'csv',
  log: 'plaintext', txt: 'plaintext', text: 'plaintext',
  tex: 'latex', sty: 'latex', bib: 'bibtex',
  diff: 'diff', patch: 'diff',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  cmake: 'cmake',
  graphql: 'graphql', gql: 'graphql',
  proto: 'protobuf',
  vue: 'html', svelte: 'html',
  asm: 'assembly',
  nim: 'nim', zig: 'rust', v: 'go',
};
function detectLang(name?: string): string {
  if (!name) return 'plaintext';
  const lower = name.toLowerCase();
  if (lower === 'dockerfile') return 'dockerfile';
  if (lower === 'makefile') return 'makefile';
  const ext = lower.includes('.') ? lower.split('.').pop()! : '';
  return EXT_LANG[ext] || 'plaintext';
}

// ---- Markdown detection -------------------------------------------------
const MD_EXTS = new Set(['md', 'markdown', 'mdx', 'rmd', 'mkd', 'mkdn']);
function isMarkdown(name?: string) {
  const ext = name?.toLowerCase().split('.').pop();
  return !!ext && MD_EXTS.has(ext);
}
function isCsv(name?: string) {
  const ext = name?.toLowerCase().split('.').pop();
  return ext === 'csv' || ext === 'tsv';
}

// ---- Themes (Xcode / VS Code / GitHub / Monokai / Dracula / Solarized) -
interface ThemeDef { id: string; label: string; base: 'vs' | 'vs-dark'; rules: any[]; colors: Record<string, string>; }
const THEMES: ThemeDef[] = [
  {
    id: 'squid-xcode-dark', label: 'Xcode Dark', base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '7C8495', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'FF7AB2' },
      { token: 'string', foreground: '9FE600' },
      { token: 'number', foreground: 'FDBB40' },
      { token: 'type', foreground: '5AC8FA' },
      { token: 'function', foreground: '41A1F0' },
    ],
    colors: {
      'editor.background': '#1E1E1E', 'editor.foreground': '#FFFFFF',
      'editorLineNumber.foreground': '#6C6C6C', 'editor.selectionBackground': '#264F78',
      'editor.lineHighlightBackground': '#2A2A2A', 'editorCursor.foreground': '#FFFFFF',
      'editorWidget.background': '#252526', 'editorGutter.background': '#1E1E1E',
      'scrollbarSlider.background': '#4B556380',
    },
  },
  {
    id: 'squid-xcode-light', label: 'Xcode Light', base: 'vs',
    rules: [
      { token: 'comment', foreground: '6C7986', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'AD3DA4' },
      { token: 'string', foreground: '272AD8' },
      { token: 'number', foreground: '1C00CF' },
      { token: 'type', foreground: '0B6E99' },
      { token: 'function', foreground: '326DCF' },
    ],
    colors: {
      'editor.background': '#FFFFFF', 'editor.foreground': '#1A1A1A',
      'editorLineNumber.foreground': '#A0A0A0', 'editor.selectionBackground': '#B4D7FE',
      'editor.lineHighlightBackground': '#F2F2F7', 'editorCursor.foreground': '#1A1A1A',
    },
  },
  {
    id: 'squid-vscode-dark', label: 'VS Code Dark+', base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: '569CD6' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'function', foreground: 'DCDCAA' },
    ],
    colors: {
      'editor.background': '#1E1E1E', 'editor.foreground': '#D4D4D4',
      'editorLineNumber.foreground': '#858585', 'editor.selectionBackground': '#264F78',
      'editor.lineHighlightBackground': '#2D2D2D', 'editorCursor.foreground': '#AEAFAD',
      'scrollbarSlider.background': '#5A5A5A80',
    },
  },
  {
    id: 'squid-github-dark', label: 'GitHub Dark', base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '8B949E', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'FF7B72' },
      { token: 'string', foreground: 'A5D6FF' },
      { token: 'number', foreground: '79C0FF' },
      { token: 'type', foreground: 'FFA657' },
      { token: 'function', foreground: 'D2A8FF' },
    ],
    colors: {
      'editor.background': '#0D1117', 'editor.foreground': '#C9D1D9',
      'editorLineNumber.foreground': '#484F58', 'editor.selectionBackground': '#264F78',
      'editor.lineHighlightBackground': '#161B22', 'editorCursor.foreground': '#C9D1D9',
    },
  },
  {
    id: 'squid-github-light', label: 'GitHub Light', base: 'vs',
    rules: [
      { token: 'comment', foreground: '6E7781', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'CF222E' },
      { token: 'string', foreground: '0A3069' },
      { token: 'number', foreground: '0550AE' },
      { token: 'type', foreground: '953800' },
      { token: 'function', foreground: '8250DF' },
    ],
    colors: {
      'editor.background': '#FFFFFF', 'editor.foreground': '#24292F',
      'editorLineNumber.foreground': '#8C959F', 'editor.selectionBackground': '#B6E3FF',
      'editor.lineHighlightBackground': '#F6F8FA', 'editorCursor.foreground': '#24292F',
    },
  },
  {
    id: 'squid-monokai', label: 'Monokai', base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '88846F', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'F92672' },
      { token: 'string', foreground: 'E6DB74' },
      { token: 'number', foreground: 'AE81FF' },
      { token: 'type', foreground: '66D9EF' },
      { token: 'function', foreground: 'A6E22E' },
    ],
    colors: {
      'editor.background': '#272822', 'editor.foreground': '#F8F8F2',
      'editorLineNumber.foreground': '#75715E', 'editor.selectionBackground': '#49483E',
      'editor.lineHighlightBackground': '#3E3D32', 'editorCursor.foreground': '#F8F8F2',
    },
  },
  {
    id: 'squid-dracula', label: 'Dracula', base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '6272A4', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'FF79C6' },
      { token: 'string', foreground: 'F1FA8C' },
      { token: 'number', foreground: 'BD93F9' },
      { token: 'type', foreground: '8BE9FD' },
      { token: 'function', foreground: '50FA7B' },
    ],
    colors: {
      'editor.background': '#282A36', 'editor.foreground': '#F8F8F2',
      'editorLineNumber.foreground': '#6272A4', 'editor.selectionBackground': '#44475A',
      'editor.lineHighlightBackground': '#343746', 'editorCursor.foreground': '#F8F8F2',
    },
  },
  {
    id: 'squid-solarized-dark', label: 'Solarized Dark', base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '586E75', fontStyle: 'italic' },
      { token: 'keyword', foreground: '859900' },
      { token: 'string', foreground: '2AA198' },
      { token: 'number', foreground: 'D33682' },
      { token: 'type', foreground: 'B58900' },
      { token: 'function', foreground: '268BD2' },
    ],
    colors: {
      'editor.background': '#002B36', 'editor.foreground': '#93A1A1',
      'editorLineNumber.foreground': '#586E75', 'editor.selectionBackground': '#073642',
      'editor.lineHighlightBackground': '#073642', 'editorCursor.foreground': '#93A1A1',
    },
  },
  {
    id: 'squid-solarized-light', label: 'Solarized Light', base: 'vs',
    rules: [
      { token: 'comment', foreground: '93A1A1', fontStyle: 'italic' },
      { token: 'keyword', foreground: '859900' },
      { token: 'string', foreground: '2AA198' },
      { token: 'number', foreground: 'D33682' },
      { token: 'type', foreground: 'B58900' },
      { token: 'function', foreground: '268BD2' },
    ],
    colors: {
      'editor.background': '#FDF6E3', 'editor.foreground': '#657B83',
      'editorLineNumber.foreground': '#93A1A1', 'editor.selectionBackground': '#EEE8D5',
      'editor.lineHighlightBackground': '#EEE8D5', 'editorCursor.foreground': '#657B83',
    },
  },
];
const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));

// ---- Font presets ------------------------------------------------------
const FONT_PRESETS = [
  '"JetBrains Mono","Fira Code",Menlo,Consolas,monospace',
  '"Fira Code",Menlo,Consolas,monospace',
  '"SF Mono","SFMono-Regular",Menlo,Consolas,monospace',
  '"Cascadia Code","Cascadia Mono",Consolas,monospace',
  '"Source Code Pro",Menlo,Consolas,monospace',
  'Menlo,Monaco,Consolas,"Courier New",monospace',
  '"IBM Plex Mono",Menlo,Consolas,monospace',
];

const MONO_FONTS = '"JetBrains Mono","Fira Code","SF Mono",Menlo,Consolas,monospace';

interface EnhancedTextEditorProps {
  file: { name?: string; id?: string; size?: number };
  decodedBlob: Blob | null;
  onSave?: (content: Blob, name?: string) => Promise<void> | void;
  onDownload?: () => void;
  onShare?: () => void;
  readonly?: boolean;
  fullscreen?: boolean;
  onFullscreenChange?: (fs: boolean) => void;
}

function ShapeGlyph({ shape }: { shape: string }) {
  const d = shapePath(shape, { cx: 12, cy: 12, w: 18, h: 18 });
  const stroke = 'currentColor';
  const fill = 'none';
  if (shape === 'line') return <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ stroke, strokeWidth: 2, fill }}><line x1="4" y1="20" x2="20" y2="4" /></svg>;
  if (shape === 'arrow') return <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ stroke, strokeWidth: 2, fill }}><line x1="4" y1="20" x2="20" y2="4" /><polyline points="12,4 20,4 20,12" /></svg>;
  if (shape === 'doubleArrow') return <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ stroke, strokeWidth: 2, fill }}><line x1="4" y1="12" x2="20" y2="12" /><polyline points="10,6 4,12 10,18" /><polyline points="14,6 20,12 14,18" /></svg>;
  if (shape === 'textbox') return <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ stroke, strokeWidth: 2, fill }}><rect x="3" y="6" width="18" height="12" rx="1" /><line x1="7" y1="11" x2="17" y2="11" /><line x1="7" y1="14" x2="14" y2="14" /></svg>;
  if (shape === 'polygon') return <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ stroke, strokeWidth: 2, fill }}><polygon points="12,3 21,9 18,20 6,20 3,9" /></svg>;
  return <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ stroke, strokeWidth: 2, fill }}>{d && <path d={d} />}</svg>;
}

export default function EnhancedTextEditor({
  file, decodedBlob, onSave, onDownload, readonly = false, fullscreen: fullscreenProp, onFullscreenChange,
}: EnhancedTextEditorProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const contentRef = useRef<string>('');
  const saveTimer = useRef<number | null>(null);
  const previewTimer = useRef<number | null>(null);
  const statsTimer = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [editorReady, setEditorReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');

  const [view, setView] = useState<'edit' | 'split' | 'preview'>('edit');
  const [fullscreen, setFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(isMobile ? 14 : 13);
  const [zoom, setZoom] = useState(1);
  const [lang, setLang] = useState('plaintext');
  const [themeId, setThemeId] = useState('squid-xcode-dark');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [csvMode, setCsvMode] = useState(false);
  const [statusBar, setStatusBar] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [minimap, setMinimap] = useState(!isMobile);
  const [lineNumbers, setLineNumbers] = useState(true);
  const [bracketColor, setBracketColor] = useState(true);
  const [guides, setGuides] = useState(true);
  const [whitespace, setWhitespace] = useState(false);
  const [controlChars, setControlChars] = useState(false);
  const [smoothScroll, setSmoothScroll] = useState(true);
  const [cursorAnim, setCursorAnim] = useState(true);
  const [ligatures, setLigatures] = useState(true);
  const [stickyScroll, setStickyScroll] = useState(true);
  const [folding, setFolding] = useState(true);
  const [glyphMargin, setGlyphMargin] = useState(false);
  const [insertSpaces, setInsertSpaces] = useState(true);
  const [tabSize, setTabSize] = useState(2);
  const [fontPreset, setFontPreset] = useState(0);

  // ---- Notes / Apple Pencil / objects / .sqd state ----------------------
  const [mode, setMode] = useState<EditorMode>('text');
  const [tool, setTool] = useState<'off' | 'pen' | 'eraser' | 'select' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'textbox'>('pen');
  const [inkColor, setInkColor] = useState('#1f2430');
  const [penSize, setPenSize] = useState(3);
  const [penOnly, setPenOnly] = useState(true);
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [objects, setObjects] = useState<SqdObject[]>([]);
  const [background, setBackground] = useState<BackgroundConfig>(defaultBackground());
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [openFilesOpen, setOpenFilesOpen] = useState(false);
  const [snap, setSnap] = useState(true);
  const [modeOpen, setModeOpen] = useState(false);
  const [shapesOpen, setShapesOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // ---- Multi-file tabs --------------------------------------------------
  const [tabs, setTabs] = useState<{ id: string; name: string }[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const buffers = useRef<Record<string, any>>({});
  const lastBlob = useRef<any>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const currentTabId = tabs[activeTab]?.id;

  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [selectionLen, setSelectionLen] = useState(0);
  const [stats, setStats] = useState({ words: 0, chars: 0, lines: 1, nonWs: 0, readMins: 0 });
  const [previewContent, setPreviewContent] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [eol, setEol] = useState<'LF' | 'CRLF'>('LF');
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);

  const fileName = file?.name || 'Untitled';
  const markdown = isMarkdown(fileName);
  const csv = isCsv(fileName);

  const overlayShown = mode !== 'text' && mode !== 'reading';
  const inkActive = overlayShown && (mode === 'draw' || mode === 'whiteboard' || tool === 'pen' || tool === 'eraser');
  const objActive = overlayShown && tool !== 'pen' && tool !== 'eraser';
  const effectiveView = mode === 'reading' ? 'preview' : view;
  const drawTool: 'pen' | 'eraser' | 'off' = tool === 'pen' ? 'pen' : tool === 'eraser' ? 'eraser' : 'off';
  const objTool = tool === 'select' || tool === 'rect' || tool === 'ellipse' || tool === 'line' || tool === 'arrow' || tool === 'textbox' || tool === 'polygon' || (typeof tool === 'string' && tool !== 'off' && tool !== 'image') ? (tool as any) : 'off';

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  // ---- Monaco init ------------------------------------------------------
  useEffect(() => {
    let disposed = false;
    const init = async () => {
      if (!containerRef.current) return;
      try {
        ensureMonacoEnv();
        const monaco = (await import('monaco-editor')).default ?? (await import('monaco-editor'));
        if (disposed) return;
        monacoRef.current = monaco;

      THEMES.forEach((t) => {
        monaco.editor.defineTheme(t.id, { base: t.base, inherit: true, rules: t.rules, colors: t.colors });
      });

      const detected = detectLang(fileName);
      setLang(detected);

      const ed = monaco.editor.create(containerRef.current, {
        value: '',
        language: detected,
        theme: themeId,
        fontSize,
        fontFamily: FONT_PRESETS[fontPreset],
        fontLigatures: ligatures,
        lineHeight: 1.6,
        minimap: { enabled: minimap },
        lineNumbers: lineNumbers ? 'on' : 'off',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize,
        insertSpaces,
        renderWhitespace: whitespace ? 'all' : 'none',
        renderControlCharacters: controlChars,
        smoothScrolling: smoothScroll,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: cursorAnim ? 'on' : 'off',
        bracketPairColorization: { enabled: bracketColor },
        guides: { bracketPairs: guides, indentation: guides, highlightActiveIndentation: guides },
        wordWrap: wordWrap ? 'on' : 'off',
        stickyScroll: { enabled: stickyScroll },
        folding,
        glyphMargin,
        padding: { top: 14, bottom: 14 },
        roundedSelection: true,
        cursorBlinking: 'smooth',
        'semanticHighlighting.enabled': true,
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
        overviewRulerLanes: 0,
        contextmenu: true,
        matchBrackets: 'always',
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        autoSurround: 'languageDefined',
        dragAndDrop: true,
        links: true,
        colorDecorators: true,
        occurrencesHighlight: 'singleFile',
        selectionHighlight: true,
        codeLens: false,
        lightbulb: { enabled: true },
        fixedOverflowWidgets: true,
        readOnly: readonly,
      });
      editorRef.current = ed;
      contentRef.current = '';

      ed.onDidChangeModelContent(() => {
        const v = ed.getValue();
        contentRef.current = v;
        if (!readonly) {
          setIsDirty(true);
          setSaveState('dirty');
          scheduleAutosave();
        }
        // live preview (debounced)
        if (previewTimer.current) window.clearTimeout(previewTimer.current);
        previewTimer.current = window.setTimeout(() => setPreviewContent(v), 220);
        if (statsTimer.current) window.clearTimeout(statsTimer.current);
        statsTimer.current = window.setTimeout(() => computeStats(v), 280);
      });

      ed.onDidChangeCursorPosition((e: any) => setCursor({ line: e.position.lineNumber, col: e.position.column }));
      ed.onDidChangeCursorSelection((e: any) => {
        const len = e.selection.isEmpty()
          ? 0
          : ed.getModel().getValueInRange(e.selection).length;
        setSelectionLen(len);
      });

      // Default view mode
      if (markdown && !isMobile) setView('split');
      else setView('edit');

      // Signal that the editor is ready so the reload / default-tab effects run.
      if (!disposed) setEditorReady(true);
      } catch (err) {
        console.error('Monaco init failed:', err);
        if (!disposed) { setEditorReady(true); setLoading(false); }
      }
    };

    init();
    return () => {
      disposed = true;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (previewTimer.current) window.clearTimeout(previewTimer.current);
      if (statsTimer.current) window.clearTimeout(statsTimer.current);
      if (editorRef.current) editorRef.current.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computeStats = useCallback((text: string) => {
    const chars = text.length;
    const nonWs = text.replace(/\s/g, '').length;
    const lines = text ? text.split('\n').length : 0;
    const words = (text.match(/[A-Za-z0-9_\u00C0-\uFFFF]+(?:['’-][A-Za-z0-9_]+)*/g) || []).length;
    const readMins = Math.max(1, Math.round(words / 200));
    setStats({ words, chars, lines, nonWs, readMins });
  }, []);

  // ---- Autosave ---------------------------------------------------------
  const scheduleAutosave = useCallback(() => {
    if (!onSave || readonly) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => doSave(), 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSave, readonly]);

  const buildDoc = useCallback((): SqdDoc => {
    return {
      kind: 'sqd',
      version: 1,
      text: contentRef.current,
      language: lang,
      background,
      strokes,
      objects,
      meta: { updatedAt: new Date().toISOString(), theme: themeId, mode },
    };
  }, [lang, background, strokes, objects, themeId, mode]);

  const doSave = useCallback(async () => {
    if (!onSave || readonly || saving) return;
    setSaving(true);
    setSaveState('saving');
    try {
      const isSqd = isSqdName(fileName);
      const hasInk = strokes.length > 0 || objects.length > 0 || mode !== 'text';
      const aid = tabs[activeTab]?.id;
      if (aid) buffers.current[aid] = { text: contentRef.current, lang, background, strokes, objects, mode, tool, dirty: false };
      let blob: Blob;
      let name = fileName;
      if (isSqd || hasInk) {
        blob = serializeDoc(buildDoc());
        if (!isSqd) name = (fileName.replace(/\.[^.]+$/, '') || fileName) + '.sqd';
      } else {
        blob = new Blob([contentRef.current], { type: 'text/plain' });
      }
      await onSave(blob, name);
      setIsDirty(false);
      setLastSaved(new Date());
      setSaveState('saved');
      notify(isSqd || hasInk ? 'Saved .sqd' : 'Saved');
    } catch (e) {
      setSaveState('error');
      notify('Save failed');
      console.error('Save failed', e);
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSave, readonly, saving, fileName, strokes, objects, mode, buildDoc]);

  // ---- Mark dirty when notes layer changes ------------------------------
  const markDirtyNotes = useCallback(() => {
    if (readonly) return;
    setIsDirty(true);
    setSaveState('dirty');
    scheduleAutosave();
  }, [readonly, scheduleAutosave]);
  const history = useRef<{ undo: any[]; redo: any[] }>({ undo: [], redo: [] });
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const objectsRef = useRef(objects);
  objectsRef.current = objects;
  const pushHistory = (objsBefore: SqdObject[]) => {
    history.current.undo.push({ strokes: strokesRef.current, objects: objsBefore });
    if (history.current.undo.length > 60) history.current.undo.shift();
    history.current.redo = [];
  };
  const onStrokesChange = useCallback((u: (s: InkStroke[]) => InkStroke[]) => {
    setStrokes((prev) => {
      const next = typeof u === 'function' ? u(prev) : u;
      if (next.length !== prev.length) pushHistory(prev);
      return next;
    });
    markDirtyNotes();
  }, [markDirtyNotes]);
  const onObjectsChange = useCallback((u: (o: SqdObject[]) => SqdObject[]) => {
    setObjects((prev) => {
      const next = typeof u === 'function' ? u(prev) : u;
      if (next.length !== prev.length) pushHistory(prev);
      return next;
    });
    markDirtyNotes();
  }, [markDirtyNotes]);
  const commitObjects = useCallback((u: (o: SqdObject[]) => SqdObject[]) => { pushHistory(objectsRef.current); setObjects(u); markDirtyNotes(); }, [markDirtyNotes]);
  const undo = useCallback(() => {
    const h = history.current.undo.pop();
    if (!h) return;
    history.current.redo.push({ strokes: strokesRef.current, objects: objectsRef.current });
    setStrokes(h.strokes); setObjects(h.objects); markDirtyNotes();
  }, [markDirtyNotes]);
  const redo = useCallback(() => {
    const h = history.current.redo.pop();
    if (!h) return;
    history.current.undo.push({ strokes: strokesRef.current, objects: objectsRef.current });
    setStrokes(h.strokes); setObjects(h.objects); markDirtyNotes();
  }, [markDirtyNotes]);
  const duplicateSelected = () => {
    if (!selectedObjectId) return;
    commitObjects((prev) => {
      const o = prev.find((x) => x.id === selectedObjectId);
      if (!o) return prev;
      const c = { ...o, id: uid('o'), x: o.x + 24, y: o.y + 24 } as SqdObject;
      return [...prev, c];
    });
    setSelectedObjectId(null);
  };
  const zOrder = (dir: 'front' | 'back' | 'forward' | 'backward') => {
    if (!selectedObjectId) return;
    commitObjects((prev) => {
      const i = prev.findIndex((x) => x.id === selectedObjectId);
      if (i < 0) return prev;
      const arr = [...prev];
      const [item] = arr.splice(i, 1);
      if (dir === 'front') arr.push(item);
      else if (dir === 'back') arr.unshift(item);
      else if (dir === 'forward') arr.splice(Math.min(i + 1, arr.length), 0, item);
      else arr.splice(Math.max(i - 1, 0), 0, item);
      return arr;
    });
  };
  const onBackgroundChange = useCallback((u: (b: BackgroundConfig) => BackgroundConfig) => { setBackground(u); markDirtyNotes(); }, [markDirtyNotes]);

  // ---- Multi-file tab helpers ------------------------------------------
  const openFile = useCallback(async (f: any, blob: Blob | null) => {
    const id = f?.id || 'tab_' + (f?.name || 'untitled');
    const existing = tabsRef.current.findIndex((t) => t.id === id);
    if (existing >= 0) { setActiveTab(existing); return; }
    let snap: any;
    if (blob) {
      const raw = await blob.text();
      const doc = parseDoc(raw);
      if (doc) {
        snap = { text: doc.text || '', lang: doc.language || detectLang(f?.name), background: doc.background || defaultBackground(), strokes: doc.strokes || [], objects: doc.objects || [], mode: 'write', tool: 'off', dirty: false };
      } else {
        snap = { text: raw || '', lang: detectLang(f?.name), background: defaultBackground(), strokes: [], objects: [], mode: 'text', tool: 'off', dirty: false };
      }
    } else {
      snap = { text: '', lang: detectLang(f?.name), background: defaultBackground(), strokes: [], objects: [], mode: 'text', tool: 'off', dirty: false };
    }
    buffers.current[id] = snap;
    setTabs((prev) => [...prev, { id, name: f?.name || 'Untitled' }]);
    setActiveTab((prev) => (existing >= 0 ? prev : tabsRef.current.length));
  }, []);

  const switchTab = (i: number) => {
    const id = tabs[activeTab]?.id;
    if (id) buffers.current[id] = { text: contentRef.current, lang, background, strokes, objects, mode, tool, dirty: isDirty };
    setActiveTab(i);
  };

  const closeTab = (i: number) => {
    const id = tabs[i]?.id;
    if (id) {
      buffers.current[id] = { text: contentRef.current, lang, background, strokes, objects, mode, tool, dirty: isDirty };
      delete buffers.current[id];
    }
    const next = tabs.filter((_, j) => j !== i);
    setTabs(next);
    if (next.length === 0) {
      const nid = 'tab_' + Math.random().toString(36).slice(2, 8);
      buffers.current[nid] = { text: '', lang: 'plaintext', background: defaultBackground(), strokes: [], objects: [], mode: 'text', tool: 'off', dirty: false };
      setTabs([{ id: nid, name: 'Untitled' }]);
      setActiveTab(0);
    } else {
      setActiveTab(i >= next.length ? next.length - 1 : i);
    }
  };

  // ---- Default empty tab when there is no file to open ----------------
  useEffect(() => {
    if (!editorReady) return;
    if (!decodedBlob && tabs.length === 0) {
      const id = file?.id || 'tab_' + Math.random().toString(36).slice(2, 8);
      buffers.current[id] = { text: '', lang: detectLang(fileName), background: defaultBackground(), strokes: [], objects: [], mode: 'text', tool: 'off', dirty: false };
      setTabs([{ id, name: fileName }]);
      setActiveTab(0);
      setLoading(false);
    }
  }, [editorReady, decodedBlob]);

  // ---- Reload when blob changes ----------------------------------------
  useEffect(() => {
    if (!editorReady) return;
    if (decodedBlob !== lastBlob.current) {
      lastBlob.current = decodedBlob;
      setLoading(true);
      openFile(file, decodedBlob).finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decodedBlob, openFile, editorReady]);

  // Load active tab buffer into the editor + overlay
  useEffect(() => {
    const id = tabs[activeTab]?.id;
    if (!id) return;
    const b = buffers.current[id];
    if (!b) return;
    setLang(b.lang || 'plaintext');
    setBackground(b.background || defaultBackground());
    setStrokes(b.strokes || []);
    setObjects(b.objects || []);
    setMode(b.mode || 'text');
    setTool(b.tool || 'off');
    setIsDirty(!!b.dirty);
    const ed = editorRef.current;
    if (ed) {
      ed.setValue(b.text || '');
      contentRef.current = b.text || '';
      computeStats(b.text || '');
      setPreviewContent(b.text || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, tabs]);

  // Keep Monaco model language in sync with the active tab
  useEffect(() => {
    const ed = editorRef.current;
    const m = monacoRef.current;
    if (ed && m) {
      const model = ed.getModel();
      if (model) m.editor.setModelLanguage(model, lang);
    }
  }, [lang]);

  // ---- Apply settings live --------------------------------------------
  useEffect(() => {
    const ed = editorRef.current; const m = monacoRef.current;
    if (!ed || !m) return;
    ed.updateOptions({
      fontSize,
      fontFamily: FONT_PRESETS[fontPreset],
      fontLigatures: ligatures,
      minimap: { enabled: minimap },
      lineNumbers: lineNumbers ? 'on' : 'off',
      renderWhitespace: whitespace ? 'all' : 'none',
      renderControlCharacters: controlChars,
      smoothScrolling: smoothScroll,
      cursorSmoothCaretAnimation: cursorAnim ? 'on' : 'off',
      bracketPairColorization: { enabled: bracketColor },
      guides: { bracketPairs: guides, indentation: guides, highlightActiveIndentation: guides },
      wordWrap: wordWrap ? 'on' : 'off',
      stickyScroll: { enabled: stickyScroll },
      folding, glyphMargin, tabSize, insertSpaces,
    });
  }, [fontSize, fontPreset, ligatures, minimap, lineNumbers, whitespace, controlChars, smoothScroll, cursorAnim, bracketColor, guides, wordWrap, stickyScroll, folding, glyphMargin, tabSize, insertSpaces]);

  useEffect(() => {
    if (monacoRef.current && editorRef.current) monacoRef.current.editor.setTheme(themeId);
  }, [themeId]);

  // ---- Fullscreen -------------------------------------------------------
  useEffect(() => {
    setFullscreen(!!fullscreenProp);
  }, [fullscreenProp]);
  const toggleFullscreen = useCallback(() => {
    const next = !fullscreen;
    setFullscreen(next);
    onFullscreenChange?.(next);
  }, [fullscreen, onFullscreenChange]);

  // ---- Keyboard shortcuts ---------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); doSave(); return; }
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o); setPaletteQuery(''); setPaletteIndex(0); return; }
      if (mod && e.shiftKey && e.key === 'P') { e.preventDefault(); setPaletteOpen(true); setPaletteQuery(''); setPaletteIndex(0); return; }
      if (e.key === 'Escape' && paletteOpen) { setPaletteOpen(false); }
      if (mode !== 'text') {
        if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
        if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggleFullscreen, doSave, paletteOpen, mode, undo, redo]);

  // ---- Editor edit helpers --------------------------------------------
  const getEd = () => editorRef.current;
  const replaceSelection = (text: string) => {
    const ed = getEd(); if (!ed) return;
    ed.executeEdits('squid', [{ range: ed.getSelection(), text, forceMoveMarkers: true }]);
    ed.focus();
  };
  const replaceAllRange = (text: string) => {
    const ed = getEd(); const m = monacoRef.current; if (!ed || !m) return;
    const model = ed.getModel();
    ed.executeEdits('squid', [{ range: model.getFullModelRange(), text }]);
    ed.focus();
  };
  const getSelectedLinesRange = () => {
    const ed = getEd(); const m = monacoRef.current; if (!ed || !m) return null;
    const sel = ed.getSelection();
    const model = ed.getModel();
    return new m.Range(sel.startLineNumber, 1, sel.endLineNumber, model.getLineMaxColumn(sel.endLineNumber));
  };

  // Markdown text ops (operate on selection or current line)
  const mdWrap = (before: string, after = before) => {
    const ed = getEd(); if (!ed) return;
    const sel = ed.getSelection();
    const selected = ed.getModel().getValueInRange(sel);
    const text = before + selected + after;
    ed.executeEdits('squid', [{ range: sel, text, forceMoveMarkers: true }]);
    ed.focus();
  };
  const mdLinePrefix = (prefix: string) => {
    const ed = getEd(); const m = monacoRef.current; if (!ed || !m) return;
    const rng = getSelectedLinesRange()!;
    const text = ed.getModel().getValueInRange(rng);
    const out = text.split('\n').map((l) => (l.startsWith(prefix) ? l : prefix + l)).join('\n');
    ed.executeEdits('squid', [{ range: rng, text: out, forceMoveMarkers: true }]);
    ed.focus();
  };
  const mdLineToggle = (prefix: string) => {
    const ed = getEd(); const m = monacoRef.current; if (!ed || !m) return;
    const rng = getSelectedLinesRange()!;
    const text = ed.getModel().getValueInRange(rng);
    const has = text.split('\n').every((l) => l.startsWith(prefix));
    const out = text.split('\n').map((l) => (has ? l.slice(prefix.length) : prefix + l)).join('\n');
    ed.executeEdits('squid', [{ range: rng, text: out, forceMoveMarkers: true }]);
    ed.focus();
  };

  // Text transforms
  const transformCase = (mode: 'upper' | 'lower' | 'title' | 'sentence' | 'inverse' | 'capitalize') => {
    const ed = getEd(); if (!ed) return;
    const sel = ed.getSelection();
    const target = sel.isEmpty() ? ed.getModel().getFullModelRange() : sel;
    const text = ed.getModel().getValueInRange(target);
    let out = text;
    if (mode === 'upper') out = text.toUpperCase();
    else if (mode === 'lower') out = text.toLowerCase();
    else if (mode === 'capitalize') out = text.replace(/\b\w/g, (c) => c.toUpperCase());
    else if (mode === 'title') out = text.replace(/\b\w/g, (c) => c.toUpperCase());
    else if (mode === 'sentence') out = text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
    else if (mode === 'inverse') out = text.replace(/[a-z]/g, (c) => c.toUpperCase()).replace(/[A-Z]/g, (c) => c.toLowerCase()) === text ? text : text.split('').map((c) => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');
    ed.executeEdits('squid', [{ range: target, text: out, forceMoveMarkers: true }]);
    ed.focus();
  };
  const lineOp = (op: 'sortAsc' | 'sortDesc' | 'shuffle' | 'reverse' | 'trim' | 'blank' | 'dedupe' | 'join') => {
    const ed = getEd(); if (!ed) return;
    const sel = ed.getSelection();
    const rng = sel.isEmpty() ? ed.getModel().getFullModelRange() : getSelectedLinesRange()!;
    let lines = ed.getModel().getValueInRange(rng).split('\n');
    if (op === 'sortAsc') lines = [...lines].sort((a, b) => a.localeCompare(b));
    else if (op === 'sortDesc') lines = [...lines].sort((a, b) => b.localeCompare(a));
    else if (op === 'shuffle') { for (let i = lines.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[lines[i], lines[j]] = [lines[j], lines[i]]; } }
    else if (op === 'reverse') lines = [...lines].reverse();
    else if (op === 'trim') lines = lines.map((l) => l.replace(/\s+$/, ''));
    else if (op === 'blank') lines = lines.filter((l) => l.trim().length > 0);
    else if (op === 'dedupe') lines = [...new Set(lines)];
    else if (op === 'join') lines = [lines.join(' ')];
    ed.executeEdits('squid', [{ range: rng, text: lines.join('\n'), forceMoveMarkers: true }]);
    ed.focus();
  };
  const toggleComment = () => {
    const ed = getEd(); if (!ed) return;
    ed.getAction('editor.action.commentLine')?.run();
  };
  const indentSelection = (dir: 1 | -1) => {
    const ed = getEd(); if (!ed) return;
    if (dir === 1) ed.getAction('editor.action.indentLines')?.run();
    else ed.getAction('editor.action.outdentLines')?.run();
  };
  const duplicateLine = () => {
    const ed = getEd(); if (!ed) return;
    const sel = ed.getSelection();
    const rng = getSelectedLinesRange()!;
    const text = ed.getModel().getValueInRange(rng);
    ed.executeEdits('squid', [{ range: new monacoRef.current.Range(rng.endLineNumber, 1, rng.endLineNumber, 1), text: '\n' + text, forceMoveMarkers: true }]);
    ed.focus();
  };
  const moveLine = (dir: -1 | 1) => {
    const ed = getEd(); if (!ed) return;
    if (dir === -1) ed.getAction('editor.action.moveLinesUpAction')?.run();
    else ed.getAction('editor.action.moveLinesDownAction')?.run();
  };
  const formatDoc = () => {
    const ed = getEd(); if (!ed) return;
    ed.getAction('editor.action.formatDocument')?.run();
  };
  const insertText = (text: string, selectInserted = false) => {
    const ed = getEd(); if (!ed) return;
    const sel = ed.getSelection();
    ed.executeEdits('squid', [{ range: sel, text, forceMoveMarkers: true }]);
    ed.focus();
  };

  // JSON helpers
  const formatJson = () => {
    try {
      const obj = JSON.parse(contentRef.current);
      replaceAllRange(JSON.stringify(obj, null, 2));
      notify('JSON formatted');
    } catch (e) { notify('Invalid JSON'); }
  };
  const minifyJson = () => {
    try {
      const obj = JSON.parse(contentRef.current);
      replaceAllRange(JSON.stringify(obj));
      notify('JSON minified');
    } catch (e) { notify('Invalid JSON'); }
  };

  // Export / copy
  const copyAll = async () => {
    try { await navigator.clipboard.writeText(contentRef.current); notify('Copied all'); }
    catch { notify('Copy failed'); }
  };
  const exportHtml = () => {
    if (!markdown) { notify('HTML export works for Markdown'); return; }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${fileName}</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"></head><body>${document.querySelector('.squid-md-preview')?.innerHTML || ''}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileName.replace(/\.md$/i, '.html'); a.click();
    URL.revokeObjectURL(url); notify('Exported HTML');
  };
  const printDoc = () => { window.print(); };

  // ---- Image / object insertion (from device, URL, or SquidCloud) -------
  const addImageObject = useCallback((src: string) => {
    const id = 'o' + Math.random().toString(36).slice(2, 9);
    const obj: SqdObject = { id, type: 'image', x: 80, y: 80, w: 260, h: 180, src, radius: 12 };
    setObjects((prev) => [...prev, obj]);
    if (mode === 'text') setMode('write');
    setTool('select');
    setSelectedObjectId(id);
  }, [mode]);

  const [squidFiles, setSquidFiles] = useState<any[]>([]);
  const [squidLoading, setSquidLoading] = useState(false);

  useEffect(() => {
    if (!importOpen) return;
    let alive = true;
    setSquidLoading(true);
    supabase
      .from('files')
      .select('id, name, type, storage_path, storage_provider_id, external_object_key')
      .order('created_at', { ascending: false })
      .limit(80)
      .then(({ data }: any) => { if (alive) { setSquidFiles(data || []); setSquidLoading(false); } });
    return () => { alive = false; };
  }, [importOpen]);

  const getSquidFileUrl = async (file: any): Promise<string | null> => {
    try {
      const { data } = await supabase.functions.invoke('storage-backend', {
        body: { action: 'download', path: file.storage_path, id: file.id },
      });
      if (data && (data.url || data.downloadUrl || data.link)) return data.url || data.downloadUrl || data.link;
    } catch { /* best effort */ }
    return null;
  };

  const insertFromSquid = async (file: any) => {
    if (!file.type || !file.type.startsWith('image/')) { notify('Only images can be placed'); return; }
    const url = await getSquidFileUrl(file);
    if (url) { addImageObject(url); setImportOpen(false); notify('Inserted from SquidCloud'); }
    else notify('Could not fetch a direct link — use "From URL" with a share link');
  };

  const fetchFileBlob = async (file: any): Promise<Blob | null> => {
    try {
      const { data } = await supabase.functions.invoke('storage-backend', { body: { action: 'download', path: file.storage_path, id: file.id } });
      const url = data?.url || data?.downloadUrl || data?.link;
      if (url) { const r = await fetch(url); if (r.ok) return await r.blob(); }
    } catch { /* best effort */ }
    return null;
  };

  const exportCanvas = (format: 'png' | 'svg') => {
    const el = overlayRef.current;
    const W = el?.clientWidth || 1000;
    const H = el?.clientHeight || 1000;
    const objSvg = (o: SqdObject) => {
      if (o.type === 'image') return `<image href="${o.src}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" preserveAspectRatio="none"/>`;
      if (o.type === 'line' || o.type === 'arrow') return `<line x1="${o.x}" y1="${o.y}" x2="${o.x + o.w}" y2="${o.y + o.h}" stroke="${o.stroke}" stroke-width="${o.strokeWidth}" ${o.type === 'arrow' ? 'marker-end="url(#exp-ah)"' : ''}/>`;
      if (o.type === 'textbox') { const t = o as any; return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="8" fill="${t.fill === 'transparent' ? 'none' : t.fill}" stroke="${t.stroke === 'transparent' ? 'none' : t.stroke}"/><text x="${o.x + 8}" y="${o.y + t.fontSize}" font-size="${t.fontSize}" fill="${t.color}">${t.text}</text>`; }
      const so = o as SqdShapeObj;
      const shapeId = so.type === 'shape' ? so.shape : so.type;
      return `<path d="${shapePath(shapeId, o.w, o.h, so.type === 'shape' ? so.points : undefined)}" transform="translate(${o.x},${o.y}) rotate(${o.rotation || 0} ${o.w / 2} ${o.h / 2})" fill="${so.fill || 'rgba(99,102,241,0.12)'}" stroke="${so.stroke || inkColor}" stroke-width="${so.strokeWidth || 2}" stroke-linejoin="round"/>`;
    };
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><marker id="exp-ah" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" fill="#1f2430"/></marker></defs><rect width="100%" height="100%" fill="${background.paper}"/><g>${strokes.map((s) => `<polyline points="${s.points.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="${Math.max(1, s.size * 1.4)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</g><g>${objects.map(objSvg).join('')}</g></svg>`;
    if (format === 'svg') {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = (fileName.replace(/\.[^.]+$/, '') || 'canvas') + '.svg'; a.click();
      URL.revokeObjectURL(url); notify('Exported SVG');
      return;
    }
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0);
      c.toBlob((b) => { if (!b) return; const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = (fileName.replace(/\.[^.]+$/, '') || 'canvas') + '.png'; a.click(); URL.revokeObjectURL(url); notify('Exported PNG'); });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  // EOL
  const convertEol = (target: 'LF' | 'CRLF') => {
    const ed = getEd(); const m = monacoRef.current; if (!ed || !m) return;
    const model = ed.getModel();
    const full = model.getFullModelRange();
    const text = model.getValue();
    const out = target === 'CRLF' ? text.replace(/\r?\n/g, '\r\n') : text.replace(/\r\n/g, '\n');
    model.pushEditOperations([], [{ range: full, text: out }], () => null);
    setEol(target); notify(`EOL → ${target}`);
  };

  // ---- Command palette --------------------------------------------------
  const commands = useMemo(() => {
    const list: Array<{ id: string; label: string; group: string; icon: any; run: () => void; kw: string }> = [
      { id: 'save', label: 'Save', group: 'File', icon: P.FloppyDisk, run: doSave, kw: 'save write persist' },
      { id: 'download', label: 'Download', group: 'File', icon: P.DownloadSimple, run: () => onDownload?.(), kw: 'download export' },
      { id: 'copyall', label: 'Copy All', group: 'File', icon: P.Copy, run: copyAll, kw: 'copy clipboard' },
      { id: 'printhtml', label: 'Print', group: 'File', icon: P.Printer, run: printDoc, kw: 'print' },
      { id: 'exporthtml', label: 'Export to HTML', group: 'File', icon: P.Export, run: exportHtml, kw: 'export html markdown' },
      { id: 'fs', label: 'Toggle Fullscreen', group: 'View', icon: P.ArrowsOut, run: toggleFullscreen, kw: 'fullscreen zen' },
      { id: 'editmode', label: 'View: Edit', group: 'View', icon: P.PencilSimple, run: () => setView('edit'), kw: 'edit code' },
      { id: 'splitmode', label: 'View: Split (Editor + Preview)', group: 'View', icon: P.Columns, run: () => setView('split'), kw: 'split preview' },
      { id: 'previewmode', label: 'View: Preview', group: 'View', icon: P.Eye, run: () => setView('preview'), kw: 'preview read' },
      { id: 'theme', label: 'Open Theme Picker', group: 'View', icon: P.Palette, run: () => setSettingsOpen(true), kw: 'theme color dark light' },
      { id: 'zoomIn', label: 'Zoom In', group: 'View', icon: P.MagnifyingGlassPlus, run: () => setFontSize((s) => Math.min(32, s + 1)), kw: 'zoom bigger' },
      { id: 'zoomOut', label: 'Zoom Out', group: 'View', icon: P.MagnifyingGlassMinus, run: () => setFontSize((s) => Math.max(10, s - 1)), kw: 'zoom smaller' },
      { id: 'statusbar', label: 'Toggle Status Bar', group: 'View', icon: P.AlignLeft, run: () => setStatusBar((s) => !s), kw: 'status bar' },
      { id: 'outline', label: 'Toggle Outline', group: 'View', icon: P.List, run: () => setOutlineOpen((o) => !o), kw: 'outline symbols headings' },
      { id: 'settings', label: 'Editor Settings', group: 'View', icon: P.Gear, run: () => setSettingsOpen(true), kw: 'settings preferences' },
      { id: 'shortcuts', label: 'Keyboard Shortcuts', group: 'Help', icon: P.Keyboard, run: () => setShortcutsOpen(true), kw: 'shortcuts help keys' },
      { id: 'undo', label: 'Undo', group: 'Edit', icon: P.ArrowCounterClockwise, run: () => getEd()?.getAction('undo')?.run(), kw: 'undo' },
      { id: 'redo', label: 'Redo', group: 'Edit', icon: P.ArrowsClockwise, run: () => getEd()?.getAction('redo')?.run(), kw: 'redo' },
      { id: 'selectall', label: 'Select All', group: 'Edit', icon: P.CursorClick, run: () => getEd()?.getAction('editor.action.selectAll')?.run(), kw: 'select all' },
      { id: 'find', label: 'Find', group: 'Edit', icon: P.MagnifyingGlass, run: () => getEd()?.getAction('actions.find')?.run(), kw: 'find search' },
      { id: 'replace', label: 'Replace', group: 'Edit', icon: P.MagnifyingGlass, run: () => getEd()?.getAction('editor.action.startFindReplaceAction')?.run(), kw: 'replace' },
      { id: 'gotoline', label: 'Go to Line', group: 'Edit', icon: P.ArrowLineDown, run: () => getEd()?.getAction('editor.action.gotoLine')?.run(), kw: 'goto line' },
      { id: 'symbol', label: 'Go to Symbol', group: 'Edit', icon: P.BracketsCurly, run: () => getEd()?.getAction('editor.action.goToDeclaration')?.run(), kw: 'symbol' },
      { id: 'format', label: 'Format Document', group: 'Edit', icon: P.Sparkle, run: formatDoc, kw: 'format pretty' },
      { id: 'comment', label: 'Toggle Comment', group: 'Edit', icon: P.Quotes, run: toggleComment, kw: 'comment' },
      { id: 'dup', label: 'Duplicate Line/Selection', group: 'Edit', icon: P.Copy, run: duplicateLine, kw: 'duplicate' },
      { id: 'movelineup', label: 'Move Line Up', group: 'Edit', icon: P.ArrowLineUp, run: () => moveLine(-1), kw: 'move up' },
      { id: 'movelinedown', label: 'Move Line Down', group: 'Edit', icon: P.ArrowLineDown, run: () => moveLine(1), kw: 'move down' },
      { id: 'indent', label: 'Indent Selection', group: 'Edit', icon: P.ArrowLineRight, run: () => indentSelection(1), kw: 'indent' },
      { id: 'outdent', label: 'Outdent Selection', group: 'Edit', icon: P.ArrowLineLeft, run: () => indentSelection(-1), kw: 'outdent' },
      { id: 'upper', label: 'Transform: UPPERCASE', group: 'Transform', icon: P.TextAa, run: () => transformCase('upper'), kw: 'uppercase' },
      { id: 'lower', label: 'Transform: lowercase', group: 'Transform', icon: P.TextAa, run: () => transformCase('lower'), kw: 'lowercase' },
      { id: 'title', label: 'Transform: Title Case', group: 'Transform', icon: P.TextAa, run: () => transformCase('title'), kw: 'title case' },
      { id: 'sentence', label: 'Transform: Sentence case', group: 'Transform', icon: P.TextAa, run: () => transformCase('sentence'), kw: 'sentence case' },
      { id: 'capitalize', label: 'Transform: Capitalize', group: 'Transform', icon: P.TextAa, run: () => transformCase('capitalize'), kw: 'capitalize' },
      { id: 'inverse', label: 'Transform: iNVERSE', group: 'Transform', icon: P.TextAa, run: () => transformCase('inverse'), kw: 'inverse swap case' },
      { id: 'sortasc', label: 'Sort Lines (A→Z)', group: 'Transform', icon: P.SortAscending, run: () => lineOp('sortAsc'), kw: 'sort ascending' },
      { id: 'sortdesc', label: 'Sort Lines (Z→A)', group: 'Transform', icon: P.SortDescending, run: () => lineOp('sortDesc'), kw: 'sort descending' },
      { id: 'shuffle', label: 'Shuffle Lines', group: 'Transform', icon: P.Shuffle, run: () => lineOp('shuffle'), kw: 'shuffle random' },
      { id: 'reverselines', label: 'Reverse Lines', group: 'Transform', icon: P.ArrowsClockwise, run: () => lineOp('reverse'), kw: 'reverse lines' },
      { id: 'trim', label: 'Trim Trailing Whitespace', group: 'Transform', icon: P.Eraser, run: () => lineOp('trim'), kw: 'trim whitespace' },
      { id: 'blank', label: 'Remove Blank Lines', group: 'Transform', icon: P.Trash, run: () => lineOp('blank'), kw: 'blank remove empty' },
      { id: 'dedupe', label: 'Remove Duplicate Lines', group: 'Transform', icon: P.Trash, run: () => lineOp('dedupe'), kw: 'dedupe unique' },
      { id: 'join', label: 'Join Lines', group: 'Transform', icon: P.Rows, run: () => lineOp('join'), kw: 'join merge lines' },
      { id: 'tabs2spaces', label: 'Convert Tabs → Spaces', group: 'Transform', icon: P.ArrowLineRight, run: () => { setInsertSpaces(true); notify('Insert spaces on'); }, kw: 'tabs spaces' },
      { id: 'spaces2tabs', label: 'Convert Spaces → Tabs', group: 'Transform', icon: P.ArrowLineLeft, run: () => { setInsertSpaces(false); notify('Insert tabs on'); }, kw: 'spaces tabs' },
      { id: 'wrap', label: 'Toggle Word Wrap', group: 'View', icon: P.TextColumns, run: () => setWordWrap((w) => !w), kw: 'wrap word' },
      { id: 'minimap', label: 'Toggle Minimap', group: 'View', icon: P.SquaresFour, run: () => setMinimap((m) => !m), kw: 'minimap map' },
      { id: 'linenumbers', label: 'Toggle Line Numbers', group: 'View', icon: P.ListNumbers, run: () => setLineNumbers((l) => !l), kw: 'line numbers' },
      { id: 'bracket', label: 'Toggle Bracket Colors', group: 'View', icon: P.BracketsCurly, run: () => setBracketColor((b) => !b), kw: 'brackets color rainbow' },
      { id: 'guides', label: 'Toggle Indent Guides', group: 'View', icon: P.Rows, run: () => setGuides((g) => !g), kw: 'guides indent' },
      { id: 'whitespace', label: 'Toggle Render Whitespace', group: 'View', icon: P.Eye, run: () => setWhitespace((w) => !w), kw: 'whitespace dots' },
      { id: 'controlchars', label: 'Toggle Control Characters', group: 'View', icon: P.Binary, run: () => setControlChars((c) => !c), kw: 'control chars' },
      { id: 'ligatures', label: 'Toggle Font Ligatures', group: 'View', icon: P.TextAa, run: () => setLigatures((l) => !l), kw: 'ligatures font' },
      { id: 'smooth', label: 'Toggle Smooth Scrolling', group: 'View', icon: P.ArrowsClockwise, run: () => setSmoothScroll((s) => !s), kw: 'smooth scroll' },
      { id: 'sticky', label: 'Toggle Sticky Scroll', group: 'View', icon: P.ArrowLineUp, run: () => setStickyScroll((s) => !s), kw: 'sticky scroll' },
      // Markdown
      { id: 'mdh1', label: 'Markdown: Heading 1', group: 'Markdown', icon: P.TextAa, run: () => mdLinePrefix('# '), kw: 'h1 heading' },
      { id: 'mdh2', label: 'Markdown: Heading 2', group: 'Markdown', icon: P.TextAa, run: () => mdLinePrefix('## '), kw: 'h2 heading' },
      { id: 'mdh3', label: 'Markdown: Heading 3', group: 'Markdown', icon: P.TextAa, run: () => mdLinePrefix('### '), kw: 'h3 heading' },
      { id: 'mdbold', label: 'Markdown: Bold', group: 'Markdown', icon: P.TextB, run: () => mdWrap('**', '**'), kw: 'bold' },
      { id: 'mditalic', label: 'Markdown: Italic', group: 'Markdown', icon: P.TextItalic, run: () => mdWrap('*', '*'), kw: 'italic' },
      { id: 'mdstrike', label: 'Markdown: Strikethrough', group: 'Markdown', icon: P.TextStrikethrough, run: () => mdWrap('~~', '~~'), kw: 'strike' },
      { id: 'mdunderline', label: 'Markdown: Underline', group: 'Markdown', icon: P.TextUnderline, run: () => mdWrap('<u>', '</u>'), kw: 'underline' },
      { id: 'mdbullet', label: 'Markdown: Bullet List', group: 'Markdown', icon: P.ListBullets, run: () => mdLinePrefix('- '), kw: 'bullet list' },
      { id: 'mdnum', label: 'Markdown: Numbered List', group: 'Markdown', icon: P.ListNumbers, run: () => mdLinePrefix('1. '), kw: 'number list' },
      { id: 'mdtask', label: 'Markdown: Task List', group: 'Markdown', icon: P.ListChecks, run: () => mdLinePrefix('- [ ] '), kw: 'task todo' },
      { id: 'mdquote', label: 'Markdown: Blockquote', group: 'Markdown', icon: P.Quotes, run: () => mdLinePrefix('> '), kw: 'quote' },
      { id: 'mdcode', label: 'Markdown: Inline Code', group: 'Markdown', icon: P.Code, run: () => mdWrap('`', '`'), kw: 'code inline' },
      { id: 'mdcodeblock', label: 'Markdown: Code Block', group: 'Markdown', icon: P.Code, run: () => mdWrap('\n```\n', '\n```\n'), kw: 'code block fenced' },
      { id: 'mdlink', label: 'Markdown: Link', group: 'Markdown', icon: P.Link, run: () => mdWrap('[', '](https://)'), kw: 'link' },
      { id: 'mdimage', label: 'Markdown: Image', group: 'Markdown', icon: P.Image, run: () => mdWrap('![', '](https://)'), kw: 'image' },
      { id: 'mdtable', label: 'Markdown: Table', group: 'Markdown', icon: P.Table, run: () => insertText('\n| Column A | Column B |\n|----------|----------|\n| Cell 1   | Cell 2   |\n'), kw: 'table' },
      { id: 'mdmath', label: 'Markdown: Math Block', group: 'Markdown', icon: P.MathOperations, run: () => mdWrap('\n$$\n', '\n$$\n'), kw: 'latex math' },
      { id: 'mdinline', label: 'Markdown: Inline Math', group: 'Markdown', icon: P.Sigma, run: () => mdWrap('$', '$'), kw: 'latex inline math' },
      { id: 'mdhr', label: 'Markdown: Horizontal Rule', group: 'Markdown', icon: P.Minus, run: () => insertText('\n\n---\n\n'), kw: 'hr rule divider' },
      { id: 'mdfoot', label: 'Markdown: Footnote', group: 'Markdown', icon: P.Asterisk ? P.Asterisk : P.Hash, run: () => insertText('[^1]: Footnote text'), kw: 'footnote' },
      { id: 'mdtoc', label: 'Markdown: Insert Table of Contents', group: 'Markdown', icon: P.List, run: insertToc, kw: 'toc contents' },
      { id: 'mddate', label: 'Insert Date/Time', group: 'Insert', icon: P.Calendar, run: () => insertText(new Date().toLocaleString()), kw: 'date time' },
      { id: 'mdlorem', label: 'Insert Lorem Ipsum', group: 'Insert', icon: P.TextColumns, run: () => insertText('Lorem ipsum dolor sit amet, consectetur adipiscing elit. '), kw: 'lorem ipsum' },
      { id: 'mdsnippet', label: 'Insert Code Snippet', group: 'Insert', icon: P.Code, run: insertSnippet, kw: 'snippet template boilerplate' },
      { id: 'csvtable', label: 'Toggle CSV Table View', group: 'View', icon: P.Table, run: () => setCsvMode((c) => !c), kw: 'csv table grid' },
      { id: 'jsonfmt', label: 'Format JSON', group: 'Transform', icon: P.BracketsCurly, run: formatJson, kw: 'json format' },
      { id: 'jsonmin', label: 'Minify JSON', group: 'Transform', icon: P.BracketsCurly, run: minifyJson, kw: 'json minify' },
      { id: 'eollf', label: 'Set Line Endings: LF', group: 'File', icon: P.AlignLeft, run: () => convertEol('LF'), kw: 'lf eol' },
      { id: 'eolcrlf', label: 'Set Line Endings: CRLF', group: 'File', icon: P.AlignLeft, run: () => convertEol('CRLF'), kw: 'crlf eol windows' },
      // Notes / Apple Pencil / objects / .sqd
      { id: 'modeText', label: 'Mode: Text (Code)', group: 'Notes', icon: P.TextColumns, run: () => setMode('text'), kw: 'text code editor mode' },
      { id: 'modeDraw', label: 'Mode: Apple Pencil (Draw)', group: 'Notes', icon: P.Pen, run: () => { setMode('draw'); setTool('pen'); }, kw: 'apple pencil draw ink handwriting notes' },
      { id: 'modeHybrid', label: 'Mode: Hybrid (Text + Ink)', group: 'Notes', icon: P.Columns, run: () => { setMode('write'); setTool('off'); }, kw: 'write notes ink text' },
      { id: 'toolPen', label: 'Pen', group: 'Notes', icon: P.Pen, run: () => { if (mode === 'text') setMode('write'); setTool('pen'); }, kw: 'pen draw ink' },
      { id: 'toolEraser', label: 'Eraser', group: 'Notes', icon: P.Eraser, run: () => { if (mode === 'text') setMode('write'); setTool('eraser'); }, kw: 'eraser remove ink' },
      { id: 'penOnly', label: 'Toggle Apple Pencil Palm Rejection', group: 'Notes', icon: P.Hand, run: () => setPenOnly((p) => !p), kw: 'palm rejection apple pencil touch' },
      { id: 'objRect', label: 'Insert Rectangle', group: 'Objects', icon: P.Square, run: () => { setMode('write'); setTool('rect'); }, kw: 'rectangle shape object' },
      { id: 'objEllipse', label: 'Insert Ellipse', group: 'Objects', icon: P.Circle, run: () => { setMode('write'); setTool('ellipse'); }, kw: 'ellipse circle shape' },
      { id: 'objLine', label: 'Insert Line', group: 'Objects', icon: P.LineSegment, run: () => { setMode('write'); setTool('line'); }, kw: 'line connector' },
      { id: 'objArrow', label: 'Insert Arrow (Flowchart)', group: 'Objects', icon: P.ArrowRight, run: () => { setMode('write'); setTool('arrow'); }, kw: 'arrow flowchart connector' },
      { id: 'objText', label: 'Insert Text Box', group: 'Objects', icon: P.TextT, run: () => { setMode('write'); setTool('textbox'); }, kw: 'text box label note' },
      { id: 'objImage', label: 'Insert Image', group: 'Objects', icon: P.Image, run: () => setImportOpen(true), kw: 'image picture squidcloud import' },
      { id: 'bgPlain', label: 'Background: Plain', group: 'Notes', icon: P.Square, run: () => onBackgroundChange((b) => ({ ...b, type: 'plain' })), kw: 'background plain' },
      { id: 'bgRuled', label: 'Background: Ruled', group: 'Notes', icon: P.Rows, run: () => onBackgroundChange((b) => ({ ...b, type: 'ruled' })), kw: 'background ruled lines notebook' },
      { id: 'bgDotted', label: 'Background: Dotted', group: 'Notes', icon: P.DotsThree, run: () => onBackgroundChange((b) => ({ ...b, type: 'dotted' })), kw: 'background dotted' },
      { id: 'bgGrid', label: 'Background: Grid', group: 'Notes', icon: P.GridFour, run: () => onBackgroundChange((b) => ({ ...b, type: 'grid' })), kw: 'background grid' },
      { id: 'clearInk', label: 'Clear Ink (Handwriting)', group: 'Notes', icon: P.Eraser, run: () => setStrokes([]), kw: 'clear ink drawing' },
      { id: 'clearObjects', label: 'Clear Objects', group: 'Objects', icon: P.Trash, run: () => setObjects([]), kw: 'clear objects shapes' },
    ];
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function insertToc() {
    const ed = getEd(); if (!ed) return;
    const text = contentRef.current;
    const heads = text.match(/^#{1,6}\s+(.+)$/gm) || [];
    const toc = heads.map((h) => {
      const level = h.match(/^#+/)![0].length;
      const title = h.replace(/^#+\s+/, '');
      const slug = title.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
      return `${'  '.repeat(level - 1)}- [${title}](#${slug})`;
    }).join('\n');
    insertText(`\n## Table of Contents\n${toc}\n`);
  }
  function insertSnippet() {
    const snippets: Record<string, string> = {
      javascript: 'function main() {\n  // TODO\n}\nmain();',
      typescript: 'export function main(): void {\n  // TODO\n}\nmain();',
      python: 'def main():\n    pass\n\nif __name__ == "__main__":\n    main()',
      json: '{\n  "key": "value"\n}',
      html: '<!doctype html>\n<html>\n  <body>\n  </body>\n</html>',
      css: '.container {\n  display: flex;\n}',
      markdown: '# Title\n\n## Section\n\n- Item\n',
    };
    insertText(snippets[lang] || '// TODO');
  }

  const filteredCommands = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.kw.includes(q) || c.group.toLowerCase().includes(q));
  }, [paletteQuery, commands]);

  // ---- CSV table parse --------------------------------------------------
  const csvRows = useMemo(() => {
    if (!csvMode || !csv) return null;
    const text = contentRef.current;
    const delim = fileName.toLowerCase().endsWith('.tsv') ? '\t' : ',';
    const lines = text.split('\n').filter((l) => l.trim().length);
    return lines.map((l) => l.split(delim).map((c) => c.replace(/^"|"$/g, '')));
  }, [csvMode, csv, previewContent, fileName]);

  // ---- Render -----------------------------------------------------------
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#1E1E1E] text-foreground gap-3 select-none">
        <P.Spinner className="w-6 h-6 animate-spin text-foreground" />
        <span className="text-sm font-mono">Opening editor…</span>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex flex-col w-full h-full bg-[#1E1E1E] text-foreground font-sans overflow-hidden select-none transition-all duration-200',
      fullscreen && 'fixed inset-0 z-[9999]'
    )}>
      {/* Title bar */}
      <header className="flex items-center justify-between px-3 h-11 bg-[#252526] border-b border-black/40 shrink-0 gap-2 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <P.FileText className="w-4 h-4 text-[#4EC9B0] shrink-0" />
          <span className="text-sm font-medium truncate max-w-[40vw]">{fileName}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground hidden sm:inline">{lang}</span>
          {isDirty
            ? <span className="w-2 h-2 rounded-full bg-amber-400/80 shrink-0 animate-pulse" title="Unsaved changes" />
            : <P.Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" title="Saved" />}
        </div>

        {/* Mode popover */}
        <div className="relative">
          <button onClick={() => setModeOpen((o) => !o)} className={cn('h-7 px-2.5 text-xs font-medium rounded-md flex items-center gap-1 transition-colors', overlayShown || mode === 'text' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')} title="Switch mode">
            {mode === 'text' ? <P.TextColumns className="w-3.5 h-3.5" /> : mode === 'draw' ? <P.Pen className="w-3.5 h-3.5" /> : mode === 'write' ? <P.PencilSimple className="w-3.5 h-3.5" /> : mode === 'whiteboard' ? <P.SquaresFour className="w-3.5 h-3.5" /> : mode === 'flowchart' ? <P.ArrowRight className="w-3.5 h-3.5" /> : mode === 'mindmap' ? <P.ShareNetwork className="w-3.5 h-3.5" /> : <P.BookOpen className="w-3.5 h-3.5" />}
            <span className="capitalize">{mode}</span>
          </button>
          {modeOpen && (
            <div className="absolute left-0 top-9 z-40 w-56 bg-[#252526] border border-white/10 rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95">
              {[
                { id: 'text', label: 'Text / Code', icon: P.TextColumns, d: 'Plain code editor' },
                { id: 'write', label: 'Write', icon: P.PencilSimple, d: 'Text + handwriting' },
                { id: 'draw', label: 'Apple Pencil', icon: P.Pen, d: 'Ink & notes' },
                { id: 'whiteboard', label: 'Whiteboard', icon: P.SquaresFour, d: 'Open canvas' },
                { id: 'flowchart', label: 'Flowchart', icon: P.ArrowRight, d: 'Diagrams' },
                { id: 'mindmap', label: 'Mind Map', icon: P.ShareNetwork, d: 'Branch ideas' },
                { id: 'reading', label: 'Reading', icon: P.BookOpen, d: 'Preview only' },
              ].map((m) => (
                <button key={m.id} onClick={() => { setMode(m.id as any); setTool(m.id === 'draw' || m.id === 'whiteboard' ? 'pen' : 'off'); setModeOpen(false); }} className={cn('w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left text-sm transition-colors', mode === m.id ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-white/5')}>
                  <m.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{m.label}</span>
                  <span className="text-[10px] opacity-60 hidden sm:block">{m.d}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 bg-black/25 border border-white/5 rounded-lg p-0.5">
          <button onClick={() => setView('edit')} className={cn('h-7 px-2.5 text-xs font-medium rounded-md flex items-center gap-1 transition-colors', view === 'edit' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}><P.PencilSimple className="w-3.5 h-3.5" /> Edit</button>
          {(markdown || csv) && <button onClick={() => setView('split')} className={cn('h-7 px-2.5 text-xs font-medium rounded-md flex items-center gap-1 transition-colors', view === 'split' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}><P.Columns className="w-3.5 h-3.5" /> Split</button>}
          {(markdown || csv) && <button onClick={() => setView('preview')} className={cn('h-7 px-2.5 text-xs font-medium rounded-md flex items-center gap-1 transition-colors', view === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}><P.Eye className="w-3.5 h-3.5" /> Preview</button>}
        </div>

        <div className="flex items-center gap-0.5">
          <button onClick={() => setFontSize((s) => Math.max(10, s - 1))} className="h-7 w-7 grid place-items-center text-muted-foreground hover:text-foreground rounded" title="Zoom out"><P.MagnifyingGlassMinus className="w-3.5 h-3.5" /></button>
          <span className="text-xs font-mono px-1 text-muted-foreground w-8 text-center">{fontSize}</span>
          <button onClick={() => setFontSize((s) => Math.min(32, s + 1))} className="h-7 w-7 grid place-items-center text-muted-foreground hover:text-foreground rounded" title="Zoom in"><P.MagnifyingGlassPlus className="w-3.5 h-3.5" /></button>
          <div className="h-5 w-px bg-white/10 mx-0.5" />
          <button onClick={() => setPaletteOpen(true)} className="h-7 px-1.5 grid place-items-center text-muted-foreground hover:text-foreground rounded" title="Command Palette (Ctrl+K)"><P.Command className="w-4 h-4" /></button>
          <button onClick={() => setOutlineOpen((o) => !o)} className={cn('h-7 w-7 grid place-items-center rounded', outlineOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground')} title="Outline"><P.List className="w-4 h-4" /></button>
          <button onClick={() => setSettingsOpen((o) => !o)} className={cn('h-7 w-7 grid place-items-center rounded', settingsOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground')} title="Settings"><P.Gear className="w-4 h-4" /></button>
          <button onClick={() => setShortcutsOpen(true)} className="h-7 w-7 grid place-items-center text-muted-foreground hover:text-foreground rounded" title="Shortcuts"><P.Keyboard className="w-4 h-4" /></button>
          {!readonly && onSave && (
            <button onClick={doSave} disabled={!isDirty || saving} className={cn('h-8 px-3 ml-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5', isDirty ? 'bg-primary text-primary-foreground shadow' : 'bg-white/5 text-muted-foreground')}>
              {saving ? <P.Spinner className="w-3.5 h-3.5 animate-spin" /> : <P.FloppyDisk className="w-3.5 h-3.5" />} Save
            </button>
          )}
          {onDownload && <button onClick={onDownload} className="h-8 w-8 grid place-items-center text-muted-foreground hover:text-foreground rounded" title="Download"><P.DownloadSimple className="w-4 h-4" /></button>}
          <button onClick={toggleFullscreen} className="h-8 w-8 grid place-items-center text-muted-foreground hover:text-foreground rounded" title="Fullscreen (F11)">{fullscreen ? <P.ArrowsIn className="w-4 h-4" /> : <P.ArrowsOut className="w-4 h-4" />}</button>
        </div>
      </header>

      {/* Tab bar (multi-file) */}
      {tabs.length > 0 && (
        <div className="flex items-center gap-1 px-2 h-9 bg-[#1b1b1b] border-b border-black/40 overflow-x-auto no-scrollbar shrink-0">
          {tabs.map((t, i) => (
            <div key={t.id} onClick={() => switchTab(i)} className={cn('group flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-t-md text-xs cursor-pointer border border-b-0 transition-colors shrink-0', i === activeTab ? 'bg-[#252526] text-foreground border-white/10' : 'text-muted-foreground hover:bg-white/5 border-transparent')}>
              <span className="max-w-[150px] truncate">{t.name}</span>
              {i === activeTab && isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
              <button onClick={(e) => { e.stopPropagation(); closeTab(i); }} className="w-4 h-4 grid place-items-center rounded hover:bg-white/15 opacity-0 group-hover:opacity-100 transition-opacity" title="Close"><P.X className="w-3 h-3" /></button>
            </div>
          ))}
          <button onClick={() => setOpenFilesOpen(true)} className="h-7 w-7 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-white/5 shrink-0" title="Open file"><P.FolderOpen className="w-4 h-4" /></button>
        </div>
      )}

      {/* Markdown formatting toolbar */}
      {markdown && !readonly && view !== 'preview' && (
        <div className="flex items-center gap-0.5 px-2 h-9 bg-[#2D2D30] border-b border-black/30 overflow-x-auto no-scrollbar shrink-0">
          {[['# ', 'H1'], ['## ', 'H2'], ['### ', 'H3']].map(([p, l]) => (
            <button key={l} onClick={() => mdLinePrefix(p)} className="h-7 px-2 text-xs font-semibold rounded text-muted-foreground hover:text-foreground hover:bg-white/5" title={`Heading ${l}`}>{l}</button>
          ))}
          <div className="h-4 w-px bg-white/10 mx-1" />
          <IconBtn onClick={() => mdWrap('**', '**')} title="Bold"><P.TextB className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={() => mdWrap('*', '*')} title="Italic"><P.TextItalic className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={() => mdWrap('~~', '~~')} title="Strikethrough"><P.TextStrikethrough className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={() => mdWrap('<u>', '</u>')} title="Underline"><P.TextUnderline className="w-4 h-4" /></IconBtn>
          <div className="h-4 w-px bg-white/10 mx-1" />
          <IconBtn onClick={() => mdLinePrefix('- ')} title="Bullet list"><P.ListBullets className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={() => mdLinePrefix('1. ')} title="Numbered list"><P.ListNumbers className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={() => mdLinePrefix('- [ ] ')} title="Task list"><P.ListChecks className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={() => mdLinePrefix('> ')} title="Quote"><P.Quotes className="w-4 h-4" /></IconBtn>
          <div className="h-4 w-px bg-white/10 mx-1" />
          <IconBtn onClick={() => mdWrap('`', '`')} title="Inline code"><P.Code className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={() => mdWrap('\n```\n', '\n```\n')} title="Code block"><P.Code className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={() => mdWrap('[', '](https://)')} title="Link"><P.Link className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={() => mdWrap('![', '](https://)')} title="Image"><P.Image className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={() => insertText('\n| Col A | Col B |\n|-------|-------|\n| x | y |\n')} title="Table"><P.Table className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={() => mdWrap('\n$$\n', '\n$$\n')} title="Math block"><P.MathOperations className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={() => mdWrap('$', '$')} title="Inline math"><P.Sigma className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={() => insertText('\n\n---\n\n')} title="Divider"><P.Minus className="w-4 h-4" /></IconBtn>
         </div>
      )}

      {/* Notes / Apple Pencil / objects toolbar */}
      {mode !== 'text' && mode !== 'reading' && !readonly && (
        <div className="flex items-center gap-1 px-2 h-10 bg-[#2D2D30] border-b border-black/30 overflow-x-auto no-scrollbar shrink-0 text-muted-foreground">
          <button onClick={() => setTool('pen')} className={cn('h-7 px-2 rounded flex items-center gap-1 text-xs', tool === 'pen' ? 'bg-primary text-primary-foreground' : 'hover:bg-white/5 hover:text-foreground')} title="Pen (Apple Pencil)"><P.Pen className="w-4 h-4" /> Pen</button>
          <button onClick={() => setTool('eraser')} className={cn('h-7 px-2 rounded flex items-center gap-1 text-xs', tool === 'eraser' ? 'bg-primary text-primary-foreground' : 'hover:bg-white/5 hover:text-foreground')} title="Eraser"><P.Eraser className="w-4 h-4" /> Erase</button>
          <button onClick={() => setPenOnly((p) => !p)} className={cn('h-7 w-7 grid place-items-center rounded', penOnly ? 'text-emerald-400' : 'hover:bg-white/5 hover:text-foreground')} title={penOnly ? 'Palm rejection ON (Apple Pencil only)' : 'Palm rejection OFF (finger draws)'}><P.Hand className="w-4 h-4" /></button>
          <div className="flex items-center gap-1 px-1">
            {['#1f2430', '#e03131', '#1971c2', '#2f9e44', '#f08c00', '#9c36b5', '#ffffff'].map((c) => (
              <button key={c} onClick={() => setInkColor(c)} className={cn('w-4 h-4 rounded-full border', inkColor === c ? 'ring-2 ring-offset-1 ring-offset-[#2D2D30] ring-white' : 'border-white/20')} style={{ background: c }} title={c} />
            ))}
            <input type="color" value={inkColor} onChange={(e) => setInkColor(e.target.value)} className="w-5 h-5 rounded bg-transparent border-0 cursor-pointer p-0" title="Custom ink color" />
          </div>
          <input type="range" min={1} max={14} value={penSize} onChange={(e) => setPenSize(Number(e.target.value))} className="w-20 accent-primary" title="Pen thickness" />
          <div className="h-5 w-px bg-white/10 mx-1" />
          <button onClick={() => setTool('off')} className={cn('h-7 px-2 rounded flex items-center gap-1 text-xs', tool === 'off' ? 'bg-primary text-primary-foreground' : 'hover:bg-white/5 hover:text-foreground')} title="Type / Edit text"><P.TextColumns className="w-4 h-4" /> Type</button>
          <button onClick={() => { setMode(mode === 'text' ? 'write' : mode); setTool('select'); }} className={cn('h-7 px-2 rounded flex items-center gap-1 text-xs', tool === 'select' ? 'bg-primary text-primary-foreground' : 'hover:bg-white/5 hover:text-foreground')} title="Select / Move objects"><P.CursorClick className="w-4 h-4" /> Select</button>

          {/* Shapes popover */}
          <div className="relative">
            <button onClick={() => setShapesOpen((o) => !o)} className={cn('h-7 px-2 rounded flex items-center gap-1 text-xs', ['rect', 'ellipse', 'triangle', 'diamond', 'parallelogram', 'trapezoid', 'pentagon', 'hexagon', 'star', 'arrow', 'doubleArrow', 'cylinder', 'cloud', 'callout', 'heart', 'sticky', 'polygon', 'line', 'textbox'].includes(tool) ? 'bg-primary text-primary-foreground' : 'hover:bg-white/5 hover:text-foreground')} title="Shapes">&#9632; Shapes</button>
            {shapesOpen && (
              <div className="absolute left-0 top-9 z-40 w-64 bg-[#252526] border border-white/10 rounded-xl shadow-2xl p-2 animate-in fade-in zoom-in-95">
                <div className="grid grid-cols-6 gap-1">
                  {SHAPE_TYPES.map((s) => (
                    <button key={s.id} onClick={() => { setMode(mode === 'text' ? 'write' : mode); setTool(s.id); setShapesOpen(false); }} title={s.label} className={cn('h-9 grid place-items-center rounded hover:bg-white/10', tool === s.id ? 'bg-primary/20 text-foreground' : 'text-muted-foreground')}>
                      <ShapeGlyph shape={s.id} />
                    </button>
                  ))}
                  <button onClick={() => { setMode(mode === 'text' ? 'write' : mode); setTool('polygon'); setShapesOpen(false); }} title="Draw your own shape (click points, double-click to finish)" className="h-9 grid place-items-center rounded hover:bg-white/10 text-muted-foreground" style={{ gridColumn: 'span 2' }}>&#9986; Draw</button>
                  <button onClick={() => { setMode(mode === 'text' ? 'write' : mode); setTool('textbox'); setShapesOpen(false); }} title="Text box" className="h-9 grid place-items-center rounded hover:bg-white/10 text-muted-foreground" style={{ gridColumn: 'span 2' }}>T</button>
                  <button onClick={() => { setMode(mode === 'text' ? 'write' : mode); setTool('line'); setShapesOpen(false); }} title="Line" className="h-9 grid place-items-center rounded hover:bg-white/10 text-muted-foreground">&#8212;</button>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => setImportOpen(true)} className="h-7 w-7 grid place-items-center rounded hover:bg-white/5 hover:text-foreground" title="Insert image (device / URL / SquidCloud)"><P.Image className="w-4 h-4" /></button>
          <div className="h-5 w-px bg-white/10 mx-1" />

          {selectedObjectId && (
            <>
              <button onClick={duplicateSelected} className="h-7 w-7 grid place-items-center rounded hover:bg-white/5 hover:text-foreground" title="Duplicate"><P.Copy className="w-4 h-4" /></button>
              <button onClick={() => zOrder('front')} className="h-7 w-7 grid place-items-center rounded hover:bg-white/5 hover:text-foreground" title="Bring to front"><P.ArrowLineUp className="w-4 h-4" /></button>
              <button onClick={() => zOrder('back')} className="h-7 w-7 grid place-items-center rounded hover:bg-white/5 hover:text-foreground" title="Send to back"><P.ArrowLineDown className="w-4 h-4" /></button>
              <button onClick={() => { setObjects((prev) => prev.filter((o) => o.id !== selectedObjectId)); setSelectedObjectId(null); }} className="h-7 w-7 grid place-items-center rounded hover:bg-white/5 hover:text-foreground" title="Delete selected"><P.Trash className="w-4 h-4" /></button>
            </>
          )}

          <button onClick={() => setSnap((s) => !s)} className={cn('h-7 w-7 grid place-items-center rounded', snap ? 'text-emerald-400' : 'hover:bg-white/5 hover:text-foreground')} title={snap ? 'Snap to grid ON' : 'Snap to grid OFF'}><P.Magnet className="w-4 h-4" /></button>
          <button onClick={() => exportCanvas('png')} className="h-7 w-7 grid place-items-center rounded hover:bg-white/5 hover:text-foreground" title="Export as PNG"><P.Export className="w-4 h-4" /></button>
          <button onClick={() => exportCanvas('svg')} className="h-7 w-7 grid place-items-center rounded hover:bg-white/5 hover:text-foreground" title="Export as SVG"><P.Export className="w-4 h-4" /></button>
          <div className="h-5 w-px bg-white/10 mx-1" />
          <span className="text-[10px] uppercase tracking-wide opacity-60 px-1">Bg</span>
          <button onClick={() => onBackgroundChange((b) => ({ ...b, type: 'plain' }))} className={cn('h-7 w-7 grid place-items-center rounded', background.type === 'plain' ? 'bg-primary text-primary-foreground' : 'hover:bg-white/5 hover:text-foreground')} title="Plain"><P.Square className="w-4 h-4" /></button>
          <button onClick={() => onBackgroundChange((b) => ({ ...b, type: 'ruled' }))} className={cn('h-7 w-7 grid place-items-center rounded', background.type === 'ruled' ? 'bg-primary text-primary-foreground' : 'hover:bg-white/5 hover:text-foreground')} title="Ruled"><P.Rows className="w-4 h-4" /></button>
          <button onClick={() => onBackgroundChange((b) => ({ ...b, type: 'dotted' }))} className={cn('h-7 w-7 grid place-items-center rounded', background.type === 'dotted' ? 'bg-primary text-primary-foreground' : 'hover:bg-white/5 hover:text-foreground')} title="Dotted"><P.DotsThree className="w-4 h-4" /></button>
          <button onClick={() => onBackgroundChange((b) => ({ ...b, type: 'grid' }))} className={cn('h-7 w-7 grid place-items-center rounded', background.type === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-white/5 hover:text-foreground')} title="Grid"><P.GridFour className="w-4 h-4" /></button>
          <input type="color" value={background.paper} onChange={(e) => onBackgroundChange((b) => ({ ...b, paper: e.target.value }))} className="w-5 h-5 rounded bg-transparent border-0 cursor-pointer p-0" title="Paper color" />
          <div className="h-5 w-px bg-white/10 mx-1" />
          <button onClick={() => setStrokes([])} className="h-7 w-7 grid place-items-center rounded hover:bg-white/5 hover:text-foreground" title="Clear ink"><P.Eraser className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex flex-1 relative overflow-hidden">
        {/* Outline panel */}
        {outlineOpen && (
          <aside className="w-56 bg-[#252526] border-r border-black/40 overflow-y-auto shrink-0 p-2 text-xs animate-in slide-in-left duration-200">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Outline</div>
            {(contentRef.current.match(/^#{1,6}\s+(.+)$/gm) || []).map((h, i) => {
              const level = h.match(/^#+/)![0].length;
              return <button key={i} onClick={() => { const ed = getEd(); ed?.revealLineInCenter(level); }} className="block w-full text-left truncate rounded px-2 py-1 hover:bg-white/5 text-muted-foreground" style={{ paddingLeft: 8 + level * 10 }}>{h.replace(/^#+\s+/, '')}</button>;
            })}
            {!contentRef.current.includes('#') && <div className="px-2 py-2 text-muted-foreground/60">No headings</div>}
          </aside>
        )}

        {/* Editor pane */}
        {effectiveView !== 'preview' && (
          <div className={cn('relative flex flex-1 h-full overflow-hidden', effectiveView === 'split' && 'border-r border-black/40')}>
            <div ref={containerRef} className="absolute inset-0" style={{ fontSize: `${fontSize}px`, transform: `scale(${zoom})`, transformOrigin: 'top left', width: zoom !== 1 ? `${100 / zoom}%` : undefined, height: zoom !== 1 ? `${100 / zoom}%` : undefined, pointerEvents: inkActive || objActive ? 'none' : 'auto' }} />
            {overlayShown && (
              <div ref={overlayRef} className="absolute inset-0" style={{ pointerEvents: 'none', ...backgroundCss(background) }}>
                <InkCanvas
                  active={inkActive}
                  tool={drawTool}
                  color={inkColor}
                  size={penSize}
                  penOnly={penOnly}
                  strokes={strokes}
                  onStrokesChange={onStrokesChange}
                  readOnly={readonly}
                />
                <ObjectLayer
                  active={objActive}
                  tool={objTool}
                  color={inkColor}
                  objects={objects}
                  onObjectsChange={onObjectsChange}
                  selectedId={selectedObjectId}
                  onSelect={setSelectedObjectId}
                  readOnly={readonly}
                  snap={snap}
                />
              </div>
            )}
          </div>
        )}

        {/* Preview pane */}
        {(effectiveView === 'preview' || effectiveView === 'split') && (
          <div className="flex-1 h-full overflow-y-auto p-6 bg-background squid-md-preview animate-in fade-in duration-200">
            {csv && csvMode && csvRows ? (
              <div className="overflow-auto">
                <table className="border-collapse text-sm w-full">
                  <thead><tr>{csvRows[0]?.map((c, i) => <th key={i} className="border border-border bg-muted px-3 py-2 text-left font-semibold">{c}</th>)}</tr></thead>
                  <tbody>{csvRows.slice(1).map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} className="border border-border px-3 py-1.5">{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
            ) : (
              <EnhancedMarkdownPreview content={previewContent} />
            )}
          </div>
        )}
      </div>

      {/* Settings popover */}
      {settingsOpen && (
        <Popover onClose={() => setSettingsOpen(false)} title="Editor Settings">
          <div className="grid grid-cols-1 gap-2">
            <Section label="Theme">
              <div className="grid grid-cols-2 gap-1.5">
                {THEMES.map((t) => (
                  <button key={t.id} onClick={() => setThemeId(t.id)} className={cn('px-2 py-1.5 text-xs rounded border text-left transition-colors', themeId === t.id ? 'border-primary bg-primary/10 text-foreground' : 'border-white/10 text-muted-foreground hover:border-white/20')}>{t.label}</button>
                ))}
              </div>
            </Section>
            <Section label="Font">
              <select value={fontPreset} onChange={(e) => setFontPreset(Number(e.target.value))} className="w-full bg-[#1E1E1E] border border-white/10 rounded px-2 py-1.5 text-xs text-foreground">
                {FONT_PRESETS.map((f, i) => <option key={i} value={i}>{f.split(',')[0].replace(/"/g, '')}</option>)}
              </select>
            </Section>
            <Section label="Tab Size">
              <div className="flex gap-1">
                {[2, 4, 8].map((s) => <button key={s} onClick={() => setTabSize(s)} className={cn('flex-1 py-1 text-xs rounded border', tabSize === s ? 'border-primary bg-primary/10' : 'border-white/10')}>{s}</button>)}
              </div>
            </Section>
            <ToggleRow label="Insert Spaces" value={insertSpaces} onChange={setInsertSpaces} />
            <ToggleRow label="Word Wrap" value={wordWrap} onChange={setWordWrap} />
            <ToggleRow label="Minimap" value={minimap} onChange={setMinimap} />
            <ToggleRow label="Line Numbers" value={lineNumbers} onChange={setLineNumbers} />
            <ToggleRow label="Bracket Colors" value={bracketColor} onChange={setBracketColor} />
            <ToggleRow label="Indent Guides" value={guides} onChange={setGuides} />
            <ToggleRow label="Render Whitespace" value={whitespace} onChange={setWhitespace} />
            <ToggleRow label="Control Chars" value={controlChars} onChange={setControlChars} />
            <ToggleRow label="Font Ligatures" value={ligatures} onChange={setLigatures} />
            <ToggleRow label="Smooth Scroll" value={smoothScroll} onChange={setSmoothScroll} />
            <ToggleRow label="Sticky Scroll" value={stickyScroll} onChange={setStickyScroll} />
            <ToggleRow label="Code Folding" value={folding} onChange={setFolding} />
            <ToggleRow label="Glyph Margin" value={glyphMargin} onChange={setGlyphMargin} />
            <ToggleRow label="Cursor Animation" value={cursorAnim} onChange={setCursorAnim} />
          </div>
        </Popover>
      )}

      {/* Command palette */}
      {paletteOpen && (
        <div className="absolute inset-0 z-40 flex items-start justify-center pt-[12vh] bg-black/40 animate-in fade-in duration-150" onClick={() => setPaletteOpen(false)}>
          <div className="w-[min(640px,92vw)] bg-[#252526] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-3 border-b border-white/10">
              <P.Command className="w-4 h-4 text-muted-foreground" />
              <input autoFocus value={paletteQuery} onChange={(e) => { setPaletteQuery(e.target.value); setPaletteIndex(0); }} onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteIndex((i) => Math.min(filteredCommands.length - 1, i + 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteIndex((i) => Math.max(0, i - 1)); }
                else if (e.key === 'Enter') { e.preventDefault(); const c = filteredCommands[paletteIndex]; if (c) { c.run(); setPaletteOpen(false); } }
              }} placeholder="Type a command…" className="flex-1 bg-transparent py-3 text-sm outline-none text-foreground placeholder:text-muted-foreground" />
              <P.X className="w-4 h-4 text-muted-foreground cursor-pointer" onClick={() => setPaletteOpen(false)} />
            </div>
            <div className="max-h-[50vh] overflow-y-auto py-1">
              {filteredCommands.length === 0 && <div className="px-4 py-6 text-center text-xs text-muted-foreground">No commands</div>}
              {filteredCommands.map((c, i) => {
                const Icon = c.icon;
                return (
                  <button key={c.id} onMouseEnter={() => setPaletteIndex(i)} onClick={() => { c.run(); setPaletteOpen(false); }} className={cn('w-full flex items-center gap-3 px-4 py-2 text-left text-sm', i === paletteIndex ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-white/5')}>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{c.label}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">{c.group}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts modal */}
      {shortcutsOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 animate-in fade-in" onClick={() => setShortcutsOpen(false)}>
          <div className="w-[min(560px,92vw)] max-h-[80vh] overflow-y-auto bg-[#252526] border border-white/10 rounded-xl p-5 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">Keyboard Shortcuts</h3><P.X className="w-4 h-4 cursor-pointer text-muted-foreground" onClick={() => setShortcutsOpen(false)} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              {[
                ['Ctrl/Cmd + S', 'Save'], ['Ctrl/Cmd + K', 'Command palette'], ['Ctrl/Cmd + Shift + P', 'Command palette'],
                ['F11', 'Fullscreen'], ['Ctrl/Cmd + F', 'Find'], ['Ctrl/Cmd + H', 'Replace'], ['Ctrl/Cmd + G', 'Go to line'],
                ['Ctrl/Cmd + Z', 'Undo'], ['Ctrl/Cmd + Y', 'Redo'], ['Ctrl/Cmd + /', 'Toggle comment'],
                ['Alt + ↑ / ↓', 'Move line'], ['Shift + Alt + F', 'Format'], ['Ctrl/Cmd + D', 'Select word'],
                ['Alt + Click', 'Multi-cursor'], ['Ctrl/Cmd + A', 'Select all'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2"><kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[10px]">{k}</kbd><span className="text-muted-foreground">{v}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Image import modal (device / URL / SquidCloud) */}
      {importOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 animate-in fade-in" onClick={() => setImportOpen(false)}>
          <div className="w-[min(560px,92vw)] max-h-[80vh] overflow-y-auto bg-[#252526] border border-white/10 rounded-xl p-5 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Insert Image</h3>
              <P.X className="w-4 h-4 cursor-pointer text-muted-foreground" onClick={() => setImportOpen(false)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => fileInputRef.current?.click()} className="h-20 rounded-lg border border-white/10 hover:border-primary flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground">
                <P.DownloadSimple className="w-5 h-5" /> From device
              </button>
              <button onClick={() => { const u = window.prompt('Paste image URL'); if (u) { addImageObject(u); setImportOpen(false); } }} className="h-20 rounded-lg border border-white/10 hover:border-primary flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground">
                <P.Link className="w-5 h-5" /> From URL
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { addImageObject(URL.createObjectURL(f)); setImportOpen(false); } e.target.value = ''; }} />
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">From SquidCloud</div>
              {squidLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-3"><P.Spinner className="w-4 h-4 animate-spin" /> Loading your files…</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto">
                  {squidFiles.filter((f) => f.type && f.type.startsWith('image/')).map((f) => (
                    <button key={f.id} onClick={() => insertFromSquid(f)} className="h-20 rounded-lg overflow-hidden border border-white/10 hover:border-primary bg-black/30 grid place-items-center text-[10px] text-muted-foreground px-1 text-center" title={f.name}>
                      {f.name}
                    </button>
                  ))}
                  {squidFiles.filter((f) => f.type && f.type.startsWith('image/')).length === 0 && <div className="col-span-full text-xs text-muted-foreground py-3">No images in your SquidCloud yet.</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Open-files modal */}
      {openFilesOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 animate-in fade-in" onClick={() => setOpenFilesOpen(false)}>
          <div className="w-[min(560px,92vw)] max-h-[80vh] overflow-y-auto bg-[#252526] border border-white/10 rounded-xl p-5 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Open File</h3>
              <P.X className="w-4 h-4 cursor-pointer text-muted-foreground" onClick={() => setOpenFilesOpen(false)} />
            </div>
            {squidLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3"><P.Spinner className="w-4 h-4 animate-spin" /> Loading your SquidCloud files…</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {squidFiles.map((f) => (
                  <button key={f.id} onClick={() => { openFile(f.name, fetchFileBlob(f)); setOpenFilesOpen(false); }} className="flex items-center gap-2 h-10 px-3 rounded-lg border border-white/10 hover:border-primary text-left text-xs text-foreground">
                    {f.type && f.type.startsWith('image/') ? <P.Image className="w-4 h-4 text-muted-foreground shrink-0" /> : <P.FileText className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <span className="truncate">{f.name}</span>
                  </button>
                ))}
                {squidFiles.length === 0 && <div className="col-span-full text-xs text-muted-foreground py-3">No files in your SquidCloud yet.</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-lg bg-black/80 text-xs text-white shadow-lg animate-in fade-in slide-in-from-bottom-2">{toast}</div>}

      {/* Status bar */}
      {statusBar && (
        <footer className="flex items-center justify-between px-3 h-7 bg-[#007ACC] text-white text-[11px] font-mono shrink-0 select-text">
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
            <span>Ln {cursor.line}, Col {cursor.col}</span>
            {selectionLen > 0 && <span>Sel {selectionLen}</span>}
            <span>Lines {stats.lines}</span>
            <span>Words {stats.words}</span>
            <span>Chars {stats.chars}</span>
            <span>~{stats.readMins} min read</span>
          </div>
          <div className="flex items-center gap-3">
            {saveState === 'saving' && <span className="flex items-center gap-1"><P.Spinner className="w-3 h-3 animate-spin" /> Saving…</span>}
            {saveState === 'saved' && lastSaved && <span>Saved {lastSaved.toLocaleTimeString()}</span>}
            {saveState === 'dirty' && <span>● Unsaved</span>}
            {saveState === 'error' && <span className="text-amber-200">Save error</span>}
            <span className="opacity-80">{lang}</span>
            <span className="opacity-80">{eol}</span>
            <span className="opacity-80">UTF-8</span>
            <span className="opacity-80">{insertSpaces ? `${tabSize} sp` : 'tab'}</span>
            <span className="opacity-80">{wordWrap ? 'WRAP' : 'NOWRAP'}</span>
          </div>
        </footer>
      )}
    </div>
  );
}

// ---- Small UI helpers ----------------------------------------------------
function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return <button onClick={onClick} title={title} className="h-7 w-7 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">{children}</button>;
}
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>{children}</div>;
}
function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/5">
      <span className="text-xs text-foreground">{label}</span>
      <span className={cn('w-9 h-5 rounded-full p-0.5 transition-colors', value ? 'bg-primary' : 'bg-white/15')}>
        <span className={cn('block w-4 h-4 rounded-full bg-white transition-transform', value ? 'translate-x-4' : 'translate-x-0')} />
      </span>
    </button>
  );
}
function Popover({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute right-3 top-12 z-40 w-72 bg-[#252526] border border-white/10 rounded-xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold">{title}</span><P.X className="w-4 h-4 text-muted-foreground cursor-pointer" onClick={onClose} /></div>
      {children}
    </div>
  );
}
