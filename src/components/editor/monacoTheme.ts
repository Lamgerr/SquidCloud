import type { editor } from 'monaco-editor';

/**
 * Monochrome ramp — one cool-grayscale family, darkest → lightest.
 * Syntax is expressed through LUMINANCE + WEIGHT + ITALICS, never hue.
 * A single desaturated accent is reserved ONLY for caret/selection glow.
 */
export const monoRamp = {
  bg: '#0d0e12', // editor background (near-black, faint cool tint)
  bgElevated: '#14151a', // gutter / widgets
  bgLine: '#171922', // current line tint
  border: '#1c1e26', // ui hairlines / indent guides
  dim: '#5b606e', // comments (dim gray, italic)
  mid: '#8b919e', // strings / numbers (mid gray)
  base: '#c7ccd6', // default foreground (light gray)
  bright: '#eef1f6', // keywords / brightest (near-white, bold)
  accent: '#8aa0c8', // DESATURATED slate — caret + selection only
} as const;

/** Token-scope → ramp step + style. Keep it strict: no hue, only luminance/weight. */
export const monoTokenRules: editor.ITokenThemeRule[] = [
  { token: '', foreground: 'c7ccd6' },
  { token: 'comment', foreground: '5b606e', fontStyle: 'italic' },
  { token: 'comment.*', foreground: '5b606e', fontStyle: 'italic' },
  { token: 'keyword', foreground: 'eef1f6', fontStyle: 'bold' },
  { token: 'keyword.control', foreground: 'eef1f6', fontStyle: 'bold' },
  { token: 'keyword.operator', foreground: '8b919e' },
  { token: 'storage', foreground: 'eef1f6', fontStyle: 'bold' },
  { token: 'storage.type', foreground: 'c7ccd6' },
  { token: 'string', foreground: '8b919e' },
  { token: 'string.*', foreground: '8b919e' },
  { token: 'number', foreground: '8b919e' },
  { token: 'regexp', foreground: '8b919e' },
  { token: 'constant', foreground: '8b919e' },
  { token: 'constant.numeric', foreground: '8b919e' },
  { token: 'type', foreground: 'c7ccd6', fontStyle: 'bold' },
  { token: 'type.identifier', foreground: 'c7ccd6' },
  { token: 'class', foreground: 'c7ccd6', fontStyle: 'bold' },
  { token: 'identifier', foreground: 'c7ccd6' },
  { token: 'function', foreground: 'c7ccd6' },
  { token: 'variable', foreground: 'c7ccd6' },
  { token: 'variable.predefined', foreground: '8b919e' },
  { token: 'parameter', foreground: 'c7ccd6' },
  { token: 'property', foreground: 'c7ccd6' },
  { token: 'delimiter', foreground: '8b919e' },
  { token: 'delimiter.curly', foreground: '8b919e' },
  { token: 'delimiter.parenthesis', foreground: '8b919e' },
  { token: 'delimiter.angle', foreground: '8b919e' },
  { token: 'delimiter.square', foreground: '8b919e' },
  { token: 'operator', foreground: '8b919e' },
  { token: 'tag', foreground: 'c7ccd6' },
  { token: 'attribute.name', foreground: 'c7ccd6' },
  { token: 'attribute.value', foreground: '8b919e' },
  { token: 'meta', foreground: '8b919e' },
  { token: 'invalid', foreground: '8b919e' },
  { token: 'metatag', foreground: '8b919e' },
  { token: 'key', foreground: 'c7ccd6' },
];

export const monoColorsDark: Record<string, string> = {
  'editor.background': monoRamp.bg,
  'editor.foreground': monoRamp.base,
  'editorLineNumber.foreground': '#3a3d47',
  'editorLineNumber.activeForeground': monoRamp.base,
  'editorCursor.foreground': monoRamp.accent,
  'editor.selectionBackground': 'rgba(138,160,200,0.20)',
  'editor.inactiveSelectionBackground': 'rgba(199,204,214,0.10)',
  'editor.lineHighlightBackground': 'rgba(199,204,214,0.045)',
  'editor.lineHighlightBorder': '#00000000',
  'editor.wordHighlightBackground': 'rgba(199,204,214,0.10)',
  'editor.wordHighlightStrongBackground': 'rgba(138,160,200,0.18)',
  'editor.findMatchBackground': 'rgba(138,160,200,0.28)',
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
  'focusBorder': 'rgba(138,160,200,0.40)',
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
  'focusBorder': 'rgba(75,93,128,0.40)',
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
    // light variant: invert luminance ordering slightly so comments stay dim
    foreground: r.foreground === 'eef1f6' ? '2a2c33' : r.foreground === 'c7ccd6' ? '2a2c33' : r.foreground === '8b919e' ? '5b606e' : r.foreground === '5b606e' ? '8b919e' : r.foreground,
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
