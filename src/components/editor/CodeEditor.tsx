import React, { useEffect, useRef, useCallback } from 'react'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'

interface CodeEditorProps {
  value: string
  language: string
  onChange?: (value: string) => void
  options?: {
    fontSize?: number
    fontFamily?: string
    lineHeight?: number
    wordWrap?: boolean
    lineNumbers?: boolean
    readOnly?: boolean
    placeholder?: string
  }
  className?: string
  onMount?: (view: EditorView) => void
  onLanguageLoad?: (lang: string) => Promise<import('@codemirror/language').LanguageSupport | null>
}

const themeCompartment = new Compartment()
const languageCompartment = new Compartment()
const optionsCompartment = new Compartment()

function squidTheme(dark: boolean) {
  const bg = dark ? '#0a0a0c' : '#fbfbfc'
  const fg = dark ? '#c7ccd6' : '#2a2c33'
  const gutterBg = dark ? '#121214' : '#f0f0f2'
  const gutterFg = dark ? '#3a3d47' : '#b6b9c2'
  const activeLineBg = dark ? 'rgba(199,204,214,0.045)' : 'rgba(42,44,51,0.04)'
  const selectionBg = dark ? 'rgba(161,161,170,0.20)' : 'rgba(75,93,128,0.18)'
  const cursorCol = dark ? '#a1a1aa' : '#4b5d80'
  const borderCol = dark ? '#1a1a1d' : '#e3e5ea'

  return EditorView.theme(
    {
      '&': { background: bg, color: fg, height: '100%', fontSize: '14px' },
      '.cm-scroller': { fontFamily: '"Geist Mono","JetBrains Mono",Menlo,monospace', lineHeight: '1.6' },
      '.cm-content': { caretColor: cursorCol, padding: '20px 0' },
      '.cm-cursor': { borderLeftColor: cursorCol, borderLeftWidth: '1.4px' },
      '.cm-selectionBackground': { background: selectionBg },
      '.cm-activeLine': { background: activeLineBg },
      '&.cm-focused .cm-selectionBackground': { background: selectionBg },
      '.cm-gutters': { background: gutterBg, border: 'none', borderRight: `1px solid ${borderCol}` },
      '.cm-lineNumbers .cm-gutterElement': { color: gutterFg, padding: '0 12px 0 4px', fontSize: '12px' },
      '.cm-activeLineGutter': { background: activeLineBg, color: fg },
      '.cm-matchingBracket': { background: dark ? 'rgba(199,204,214,0.12)' : 'rgba(42,44,51,0.09)', outline: 'none' },
      '.cm-selectionMatch': { background: dark ? 'rgba(199,204,214,0.10)' : 'rgba(42,44,51,0.09)' },
      '.cm-searchMatch': { background: dark ? 'rgba(161,161,170,0.28)' : 'rgba(75,93,128,0.24)' },
      '&.cm-focused': { outline: 'none' },
      '.cm-foldPlaceholder': { background: 'transparent', color: dark ? '#565b69' : '#8b919e' },
      '.cm-tooltip': { background: dark ? '#121214' : '#ffffff', border: `1px solid ${borderCol}`, borderRadius: '8px' },
      '.cm-scroller::-webkit-scrollbar': { width: '8px', height: '8px' },
      '.cm-scroller::-webkit-scrollbar-thumb': { background: dark ? 'rgba(199,204,214,0.10)' : 'rgba(42,44,51,0.12)', borderRadius: '4px' },
      '.cm-scroller::-webkit-scrollbar-track': { background: 'transparent' },
    },
    { dark }
  )
}

function getLanguageExtensions(lang: string) {
  switch (lang) {
    case 'javascript': case 'js': case 'jsx':
      return import('@codemirror/lang-javascript').then(m => m.javascript())
    case 'typescript': case 'ts': case 'tsx':
      return import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true }))
    case 'json':
      return import('@codemirror/lang-json').then(m => m.json())
    case 'css': case 'scss': case 'less':
      return import('@codemirror/lang-css').then(m => m.css())
    case 'html':
      return import('@codemirror/lang-html').then(m => m.html())
    case 'markdown': case 'md': case 'mdx':
      return import('@codemirror/lang-markdown').then(m => m.markdown())
    case 'python': case 'py':
      return import('@codemirror/lang-python').then(m => m.python())
    case 'sql':
      return import('@codemirror/lang-sql').then(m => m.sql())
    case 'rust': case 'rs':
      return import('@codemirror/lang-rust').then(m => m.rust())
    case 'java':
      return import('@codemirror/lang-java').then(m => m.java())
    case 'cpp': case 'c': case 'c++':
      return import('@codemirror/lang-cpp').then(m => m.cpp())
    case 'xml':
      return import('@codemirror/lang-xml').then(m => m.xml())
    case 'yaml': case 'yml':
      return import('@codemirror/lang-yaml').then(m => m.yaml())
    case 'php':
      return import('@codemirror/lang-php').then(m => m.php())
    case 'go':
      return import('@codemirror/lang-go').then(m => m.go())
    default:
      return Promise.resolve(null)
  }
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  language,
  onChange,
  options = {},
  className,
  onMount,
  onLanguageLoad,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const prevValueRef = useRef(value)

  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return
    if (viewRef.current) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current?.(update.state.doc.toString())
      }
    })

    const opts = options
    const state = EditorState.create({
      doc: value,
      extensions: [
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        updateListener,
        squidTheme(true),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        optionsCompartment.of(optionsExtensions(opts)),
        themeCompartment.of([]),
        languageCompartment.of([]),
        opts.readOnly ? EditorView.editable.of(false) : [],
        opts.placeholder ? placeholder(opts.placeholder) : [],
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view
    onMount?.(view)

    loadLanguage(language)

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!viewRef.current) return
    const current = viewRef.current.state.doc.toString()
    if (current !== value && onChangeRef.current == null) {
      viewRef.current.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
      prevValueRef.current = value
    }
  }, [value])

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({ effects: optionsCompartment.reconfigure(optionsExtensions(options)) })
    }
  }, [options.fontSize, options.fontFamily, options.lineHeight, options.wordWrap, options.lineNumbers, options.readOnly])

  const loadLanguage = useCallback(async (lang: string) => {
    if (!viewRef.current) return
    let ext
    if (onLanguageLoad) {
      ext = await onLanguageLoad(lang)
    }
    if (!ext) {
      try { ext = await getLanguageExtensions(lang) } catch { ext = null }
    }
    viewRef.current.dispatch({ effects: languageCompartment.reconfigure(ext ? [ext] : []) })
  }, [onLanguageLoad])

  useEffect(() => { loadLanguage(language) }, [language, loadLanguage])

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({ effects: themeCompartment.reconfigure(squidTheme(true)) })
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}
    />
  )
}

function optionsExtensions(opts: CodeEditorProps['options']) {
  if (!opts) return []
  const exts: import('@codemirror/state').Extension[] = []
  if (opts.wordWrap) exts.push(EditorView.lineWrapping)
  return exts
}

export default CodeEditor
