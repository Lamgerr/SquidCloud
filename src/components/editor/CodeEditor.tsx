import React, { useEffect, useRef } from 'react';
import type { editor as MonacoEditorNS } from 'monaco-editor';
import { defineMonoThemes, MONO_DARK_ID, MONO_LIGHT_ID } from './monacoTheme';
import './monaco-mono.css';

interface CodeEditorProps {
  value: string;
  language: string;
  theme?: 'dark' | 'light';
  onChange?: (value: string) => void;
  options?: MonacoEditorNS.IStandaloneEditorConstructionOptions;
  className?: string;
}

/**
 * Polished, monochrome Monaco wrapper.
 * - Theme is the typed `monoTheme` (one cool-grayscale ramp; syntax via
 *   luminance + weight + italics, never hue).
 * - CSS overrides (selection, scrollbars, context menu, widgets) live in
 *   ./monaco-mono.css and are injected once via the import above.
 * - Custom context menu is Monaco's menu, RESTYLED via CSS — see note in
 *   the design summary (a true from-scratch menu is out of scope).
 */
const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  language,
  theme = 'dark',
  onChange,
  options = {},
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);

  // ---- full, commented editor configuration ----
  const baseOptions: MonacoEditorNS.IStandaloneEditorConstructionOptions = {
    fontSize: 13,
    // Monospace pairing: Berkeley Mono* > JetBrains Mono > SF Mono > Monaco/Consolas.
    // * requires a license (see summary). Falls back gracefully.
    fontFamily:
      '"JetBrains Mono","SF Mono","Berkeley Mono","Monaco","Inconsolata","Roboto Mono","Consolas",monospace',
    fontLigatures: true, // enables liga + calt (e.g. =>, !=, ==)
    fontWeight: '400',
    lineHeight: 22, // generous, Xcode-like breathing room
    letterSpacing: 0.2,
    cursorBlinking: 'smooth', // smooth (not instant) blink
    cursorSmoothCaretAnimation: 'on', // animated caret glide
    cursorWidth: 1.4, // thin, restrained cursor
    cursorSurroundingLines: 8,
    cursorSurroundingLinesStyle: 'all',
    scrollPredominantAxis: true, // trackpad-friendly, no diagonal j:ump
    renderLineHighlight: 'all', // subtle FULL-WIDTH tint, not a border box
    renderLineHighlightOnlyWhenFocus: true,
    roundedSelection: false,
    smoothScrolling: true,
    mouseWheelScrollSensitivity: 1.1,
    fastScrollSensitivity: 6,
    scrollBeyondLastLine: false,
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      useShadows: false,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
      arrowSize: 0,
      handleMouseWheel: true,
    },
    minimap: { enabled: false }, // removed — barely-there is still clutter
    padding: { top: 18, bottom: 18 }, // generous Xcode-style margins
    guides: {
      indentation: true, // single subtle shade
      bracketPairs: true, // subtle horizontal guide
      bracketPairsHorizontal: true,
      highlightActiveIndentation: true,
    },
    bracketPairColorization: { enabled: true }, // kept monochrome via theme
    renderWhitespace: 'none',
    wordWrap: 'off',
    wrappingStrategy: 'advanced',
    tabSize: 2,
    insertSpaces: true,
    automaticLayout: true,
    stickyScroll: { enabled: false }, // disable sticky-scroll clutter
    folding: true,
    showFoldingControls: 'mouseover', // minimal folding gutter
    suggestFontSize: 12,
    suggestLineHeight: 18,
    mouseWheelZoom: false,
    overviewRulerLanes: 0, // keep the overview ruler minimal
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    colorDecorators: false,
    glyphMargin: false,
    lineDecorationsWidth: 8,
    lineNumbersMinChars: 3,
    occurrencesHighlight: 'singleFile',
    selectionHighlight: true,
    matchBrackets: 'always',
    contextmenu: true,
    fixedOverflowWidgets: true,
    ...options,
  };

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!containerRef.current) return;
      const monaco = await import('monaco-editor');
      if (disposed) return;
      monacoRef.current = monaco;
      defineMonoThemes(monaco);

      const ed = monaco.editor.create(containerRef.current, {
        value,
        language,
        theme: theme === 'dark' ? MONO_DARK_ID : MONO_LIGHT_ID,
        ...baseOptions,
      });
      editorRef.current = ed;

      ed.onDidChangeModelContent(() => onChange?.(ed.getValue()));

      // focus ring on the shell is handled by CSS (`.mono-editor-shell:focus-within`)
    })();

    return () => {
      disposed = true;
      editorRef.current?.dispose();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      monacoRef.current.editor.setTheme(theme === 'dark' ? MONO_DARK_ID : MONO_LIGHT_ID);
    }
  }, [theme]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) monacoRef.current.editor.setModelLanguage(model, language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  return (
    <div
      ref={containerRef}
      className={`mono-editor-shell ${className ?? ''}`}
      style={{ minHeight: 200, width: '100%', height: '100%' }}
    />
  );
};

export default CodeEditor;
