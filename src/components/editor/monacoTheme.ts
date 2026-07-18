import type { editor } from 'monaco-editor';

/**
 * Monochrome ramp — one neutral family, darkest → lightest.
 * Syntax is expressed through a SMALL, LOW-CHROMA accent set
 * (sage / sand / slate / rose) that is harmonized with the neutral
 * surface, plus luminance + weight + italics. The accent hue is
 * reserved ONLY for the caret/selection glow.
 */
export const monoRamp = {
  bg: '#0a0a0c', // editor background (neutral near-black)
  bgElevated: '#121214', // gutter / widgets
  bgLine: '#151517', // current line tint
  border: '#1a1a1d', // ui hairlines / indent guides
  dim: '#565b69', // comments (dim gray, italic)
  mid: '#8b919e', // operators / delimiters (mid gray)
  base: '#c7ccd6', // default foreground (light gray)
  bright: '#eef1f6', // keywords / brightest (near-white, bold)
  // Low-chroma syntax accents — tuned to feel premium against the
  // neutral surface without introducing loud, clashing hues.
  string: '#a3b8a0', // muted sage — strings
  number: '#c9b48a', // muted sand — numbers / constants
  type: '#aeb8cc', // muted slate — types / classes
  property: '#b9c0cf', // soft periwinkle-gray — properties / params
  tag: '#a8b0c0', // muted teal-gray — markup tags
  invalid: '#cf9a9a', // muted rose — errors / invalid
  accent: '#a1a1aa', // NEUTRAL zinc — caret + selection only
} as const;

/** Token-scope → ramp step + style. Cohesive, low-chroma, premium. */
export const monoTokenRules: editor.ITokenThemeRule[] = [
  { token: '', foreground: 'c7ccd6' },
  { token: 'comment', foreground: '565b69', fontStyle: 'italic' },
  { token: 'comment.*', foreground: '565b69', fontStyle: 'italic' },
  { token: 'keyword', foreground: 'eef1f6', fontStyle: 'bold' },
  { token: 'keyword.control', foreground: 'eef1f6', fontStyle: 'bold' },
  { token: 'keyword.operator', foreground: '8b919e' },
  { token: 'storage', foreground: 'eef1f6', fontStyle: 'bold' },
  { token: 'storage.type', foreground: 'aeb8cc', fontStyle: 'bold' },
  { token: 'string', foreground: 'a3b8a0' },
  { token: 'string.*', foreground: 'a3b8a0' },
  { token: 'regexp', foreground: 'a3b8a0' },
  { token: 'number', foreground: 'c9b48a' },
  { token: 'constant', foreground: 'c9b48a' },
  { token: 'constant.numeric', foreground: 'c9b48a' },
  { token: 'type', foreground: 'aeb8cc', fontStyle: 'bold' },
  { token: 'type.identifier', foreground: 'aeb8cc' },
  { token: 'class', foreground: 'aeb8cc', fontStyle: 'bold' },
  { token: 'identifier', foreground: 'c7ccd6' },
  { token: 'function', foreground: 'c7ccd6' },
  { token: 'variable', foreground: 'c7ccd6' },
  { token: 'variable.predefined', foreground: 'c9b48a' },
  { token: 'parameter', foreground: 'b9c0cf' },
  { token: 'property', foreground: 'b9c0cf' },
  { token: 'delimiter', foreground: '8b919e' },
  { token: 'delimiter.curly', foreground: '8b919e' },
  { token: 'delimiter.parenthesis', foreground: '8b919e' },
  { token: 'delimiter.angle', foreground: '8b919e' },
  { token: 'delimiter.square', foreground: '8b919e' },
  { token: 'operator', foreground: '8b919e' },
  { token: 'tag', foreground: 'a8b0c0' },
  { token: 'attribute.name', foreground: 'a8b0c0' },
  { token: 'attribute.value', foreground: 'a3b8a0' },
  { token: 'meta', foreground: '8b919e' },
  { token: 'invalid', foreground: 'cf9a9a' },
  { token: 'metatag', foreground: '8b919e' },
  { token: 'key', foreground: 'b9c0cf' },
];

export const monoColorsDark: Record<string, string> = {
  'editor.background': monoRamp.bg,
  'editor.foreground': monoRamp.base,
  'editorLineNumber.foreground': '#3a3d47',
  'editorLineNumber.activeForeground': monoRamp.base,
  'editorCursor.foreground': monoRamp.accent,
  'editor.selectionBackground': 'rgba(161,161,170,0.20)',
  'editor.inactiveSelectionBackground': 'rgba(199,204,214,0.10)',
  'editor.lineHighlightBackground': 'rgba(199,204,214,0.045)',
  'editor.lineHighlightBorder': '#00000000',
  'editor.wordHighlightBackground': 'rgba(199,204,214,0.10)',
  'editor.wordHighlightStrongBackground': 'rgba(161,161,170,0.18)',
  'editor.findMatchBackground': 'rgba(161,161,170,0.28)',
  'editor.findMatchHighlightBackground': 'rgba(199,204,214,0.14)',
  'editor.selectionHighlightBackground': 'rgba(199,204,214,0.10)',
  'editorIndentGuide.background1': 'rgba(199,204,214,0.06)',
  'editorIndentGuide.background2': 'rgba(199,204,214,0.10)',
  'editorIndentGuide.activeBackground1': 'rgba(199,204,214,0.18)',
  'editorIndentGuide.activeBackground2': 'rgba(199,204,214,0.22)',
  'editorBracketMatch.background': 'rgba(199,204,214,0.12)',
  'editorBracketMatch.border': '#00000000',
  // Bracket pair colorization kept monochrome (weight/opacity, no rainbow)
  'editorBracketHighlight.foreground1': 'rgba(199,204,214,0.95)',
  'editorBracketHighlight.foreground2': 'rgba(199,204,214,0.70)',
  'editorBracketHighlight.foreground3': 'rgba(199,204,214,0.45)',
  'editorBracketHighlight.foreground4': 'rgba(199,204,214,0.30)',
  'editorBracketHighlight.unexpectedBracket.foreground': 'rgba(199,204,214,0.30)',
  'editorOverviewRuler.background': '#00000000',
  'editorOverviewRuler.border': '#00000000',
  'editorGutter.background': monoRamp.bgElevated,
  'editorWidget.background': monoRamp.bgElevated,
  'editorWidget.border': monoRamp.border,
  'editorHoverWidget.background': monoRamp.bgElevated,
  'editorHoverWidget.border': monoRamp.border,
  'editorSuggestWidget.background': monoRamp.bgElevated,
  'editorSuggestWidget.border': monoRamp.border,
  'editorSuggestWidget.selectedBackground': 'rgba(199,204,214,0.08)',
  'editorSuggestWidget.foreground': monoRamp.base,
  'editorParameterHint.background': monoRamp.bgElevated,
  'editorParameterHint.border': monoRamp.border,
  'editorMarkerNavigation.background': monoRamp.bgElevated,
  'scrollbar.shadow': '#00000000',
  'scrollbarSlider.background': 'rgba(199,204,214,0.10)',
  'scrollbarSlider.hoverBackground': 'rgba(199,204,214,0.18)',
  'scrollbarSlider.activeBackground': 'rgba(199,204,214,0.26)',
  'minimap.background': monoRamp.bg,
  'minimap.foregroundOpacity': '#00000000',
  'focusBorder': 'rgba(161,161,170,0.40)',
  'widget.shadow': 'rgba(0,0,0,0.45)',
};

export const monoColorsLight: Record<string, string> = {
  'editor.background': '#fbfbfc',
  'editor.foreground': '#2a2c33',
  'editorLineNumber.foreground': '#b6b9c2',
  'editorLineNumber.activeForeground': '#2a2c33',
  'editorCursor.foreground': '#4b5d80',
  'editor.selectionBackground': 'rgba(75,93,128,0.18)',
  'editor.inactiveSelectionBackground': 'rgba(42,44,51,0.10)',
  'editor.lineHighlightBackground': 'rgba(42,44,51,0.04)',
  'editor.wordHighlightBackground': 'rgba(42,44,51,0.09)',
  'editor.findMatchBackground': 'rgba(75,93,128,0.24)',
  'editorIndentGuide.background1': 'rgba(42,44,51,0.06)',
  'editorIndentGuide.activeBackground1': 'rgba(42,44,51,0.18)',
  'editorBracketHighlight.foreground1': 'rgba(42,44,51,0.95)',
  'editorBracketHighlight.foreground2': 'rgba(42,44,51,0.70)',
  'editorBracketHighlight.foreground3': 'rgba(42,44,51,0.45)',
  'editorWidget.background': '#ffffff',
  'editorWidget.border': '#e3e5ea',
  'editorSuggestWidget.selectedBackground': 'rgba(42,44,51,0.07)',
  'scrollbarSlider.background': 'rgba(42,44,51,0.12)',
  'scrollbarSlider.hoverBackground': 'rgba(42,44,51,0.20)',
  'minimap.background': '#fbfbfc',
  'focusBorder': 'rgba(91,91,102,0.40)',
};

export const monoThemeDark: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: monoTokenRules,
  colors: monoColorsDark,
};

export const monoThemeLight: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: monoTokenRules.map((r) => ({
    ...r,
    // light variant: invert luminance ordering so accents stay readable
    foreground:
      r.foreground === 'eef1f6' ? '2a2c33' :
      r.foreground === 'c7ccd6' ? '2a2c33' :
      r.foreground === '8b919e' ? '5b606e' :
      r.foreground === '565b69' ? '8b919e' :
      r.foreground === '5b606e' ? '8b919e' :
      r.foreground === 'a3b8a0' ? '3f6b46' :
      r.foreground === 'c9b48a' ? '8a6a2a' :
      r.foreground === 'aeb8cc' ? '3a4a63' :
      r.foreground === 'b9c0cf' ? '3a4252' :
      r.foreground === 'a8b0c0' ? '3f4a58' :
      r.foreground === 'cf9a9a' ? '9a3f3f' :
      r.foreground,
  })) as editor.ITokenThemeRule[],
  colors: monoColorsLight,
};

export const MONO_DARK_ID = 'squid-mono-dark';
export const MONO_LIGHT_ID = 'squid-mono-light';

/** Register both themes on a Monaco instance. Call once after `import('monaco-editor')`. */
export function defineMonoThemes(monaco: typeof import('monaco-editor')) {
  monaco.editor.defineTheme(MONO_DARK_ID, monoThemeDark);
  monaco.editor.defineTheme(MONO_LIGHT_ID, monoThemeLight);
}
