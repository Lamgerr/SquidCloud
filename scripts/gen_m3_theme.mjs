#!/usr/bin/env node
/**
 * MATERIAL 3 COLOR ENGINE
 * ------------------------------------------------------------------
 * Seeds in, a complete Material You scheme out: tonal palettes are
 * generated in OKLCH, snapped to CIE L* (the tone scale Material uses),
 * gamut-mapped into sRGB, then assigned to the standard M3 role map for
 * both light and dark. Writes src/styles/m3/theme.css and prints the
 * measured WCAG contrast of every pair the UI depends on.
 *
 * Usage:
 *   node scripts/gen_m3_theme.mjs            # write theme + print report
 *   node scripts/gen_m3_theme.mjs --check    # write + fail on a bad pair
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const OUT = resolve(ROOT, 'src/styles/m3/theme.css');
const CHECK = process.argv.includes('--check');

/* ── Source of truth: tokens/m3.json ──────────────────────────────
   Seeds, chroma, tone assignments and file hues all live there. Edit
   that file, re-run this script, and every role is regenerated.        */
const SOURCE = JSON.parse(readFileSync(resolve(ROOT, 'tokens/m3.json'), 'utf8')).m3;

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

const SEEDS = Object.fromEntries(
  Object.entries(SOURCE.seed).map(([name, s]) => [name, {
    label: s.label.$value,
    primary: s['primary-hue'].$value,
    tertiary: s['tertiary-hue'].$value,
    neutral: s['neutral-hue'].$value,
  }]),
);
const DEFAULT_SEED = SOURCE['default-seed'].$value;

/* Chroma per palette, OKLCH units. Material's HCT chroma 36 is ~0.10 here. */
const CHROMA = {
  primary: SOURCE.chroma.primary.$value,
  secondary: SOURCE.chroma.secondary.$value,
  tertiary: SOURCE.chroma.tertiary.$value,
  neutral: SOURCE.chroma.neutral.$value,
  neutralVariant: SOURCE.chroma['neutral-variant'].$value,
  error: SOURCE.chroma.error.$value,
};

/* Standard M3 tone assignments. tone: [light, dark] */
const TONES = Object.fromEntries(
  Object.entries(SOURCE.tone)
    .filter(([role]) => !role.startsWith('$'))
    .map(([role, t]) => [camel(role), t.$value]),
);

/* File families replace the old raw hex rainbow. Container/on-container only. */
const FILES = Object.fromEntries(
  Object.entries(SOURCE['file-family'])
    .filter(([k]) => !k.startsWith('$'))
    .map(([name, v]) => [name, v.$value]),
);


/* ── Color math ─────────────────────────────────────────────────── */

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const cbrt = (v) => Math.sign(v) * Math.cbrt(Math.abs(v));

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function linearToSrgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('');
}

function linearSrgbToOklab([r, g, b]) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = cbrt(l), m_ = cbrt(m), s_ = cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

function oklabToLinearSrgb([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** CIE L* from linear sRGB. */
function lstar(lin) {
  const y = luminance(lin);
  return y > 0.008856451679035631 ? 116 * Math.cbrt(y) - 16 : 903.2962962962963 * y;
}

function inGamut(lin, eps = 1e-4) {
  return lin.every((v) => v >= -eps && v <= 1 + eps);
}

/** Reduce chroma until the color fits sRGB, keeping L and hue. */
function gamutMap(L, C, h) {
  if (C <= 0) return oklabToLinearSrgb([L, 0, 0]);
  const at = (c) => {
    const rad = (h * Math.PI) / 180;
    return oklabToLinearSrgb([L, c * Math.cos(rad), c * Math.sin(rad)]);
  };
  let lo = 0, hi = C;
  if (inGamut(at(hi))) return at(hi);
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(at(mid))) lo = mid;
    else hi = mid;
  }
  return at(lo);
}

/** Color at a given CIE tone (L*) for a hue and max chroma. */
function tone(hue, chroma, target) {
  let lo = 0, hi = 1;
  let best = gamutMap(0.5, chroma, hue);
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    const lin = gamutMap(mid, chroma, hue);
    best = lin;
    if (lstar(lin) < target) lo = mid;
    else hi = mid;
  }
  return rgbToHex(best.map(linearToSrgb));
}

/** Hex → "h s% l%" for the shadcn HSL variable bridge. */
function hslTriplet(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${Math.round(h * 10) / 10} ${Math.round(s * 1000) / 10}% ${Math.round(l * 1000) / 10}%`;
}

function contrast(a, b) {
  const lum = (hex) => {
    const lin = hexToRgb(hex).map((v) => srgbToLinear(v / 255));
    return luminance(lin);
  };
  const l1 = lum(a), l2 = lum(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* ── Scheme assembly ────────────────────────────────────────────── */

function scheme(seed, mode) {
  const s = SEEDS[seed];
  const idx = mode === 'dark' ? 1 : 0;
  const h = {
    primary: s.primary,
    secondary: s.primary,
    tertiary: s.tertiary,
    neutral: s.neutral,
    neutralVariant: s.primary,
    error: 25,
  };
  const palette = (name) =>
    Object.fromEntries(Object.entries(TONES).map(([role, t]) => [role, tone(h[name], CHROMA[name], t[idx])]));

  const roles = {};
  const put = (role, name) => { roles[role] = palette(name)[role]; };

  put('primary', 'primary');
  put('onPrimary', 'primary');
  put('primaryContainer', 'primary');
  put('onPrimaryContainer', 'primary');
  put('inversePrimary', 'primary');
  put('secondary', 'secondary');
  put('onSecondary', 'secondary');
  put('secondaryContainer', 'secondary');
  put('onSecondaryContainer', 'secondary');
  put('tertiary', 'tertiary');
  put('onTertiary', 'tertiary');
  put('tertiaryContainer', 'tertiary');
  put('onTertiaryContainer', 'tertiary');
  put('error', 'error');
  put('onError', 'error');
  put('errorContainer', 'error');
  put('onErrorContainer', 'error');

  for (const role of [
    'background', 'onBackground', 'surface', 'onSurface', 'surfaceDim', 'surfaceBright',
    'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh',
    'surfaceContainerHighest', 'surfaceVariant', 'onSurfaceVariant', 'outline', 'outlineVariant',
    'inverseSurface', 'inverseOnSurface', 'scrim', 'shadow',
  ]) put(role, 'neutral');

  /* Success/warning are fixed hues, not seed-derived: green means success everywhere. */
  roles.success = tone(152, 0.10, idx ? 80 : 40);
  roles.onSuccess = tone(152, 0.10, idx ? 20 : 100);
  roles.successContainer = tone(152, 0.10, idx ? 30 : 90);
  roles.onSuccessContainer = tone(152, 0.10, idx ? 90 : 10);
  roles.warning = tone(70, 0.115, idx ? 82 : 38);
  roles.onWarning = tone(70, 0.115, idx ? 22 : 100);
  roles.warningContainer = tone(70, 0.115, idx ? 30 : 90);
  roles.onWarningContainer = tone(70, 0.115, idx ? 90 : 10);

  roles.surfaceTint = roles.primary;

  for (const [name, hue] of Object.entries(FILES)) {
    roles[`file${cap(name)}Container`] = tone(hue, 0.055, idx ? 28 : 92);
    roles[`onFile${cap(name)}Container`] = tone(hue, 0.075, idx ? 90 : 18);
  }

  return roles;
}

/* Pairs the interface actually renders. [fg, bg, min, label] */
const REQUIRED = [
  ['onSurface', 'surface', 4.5, 'body on surface'],
  ['onSurface', 'surfaceContainer', 4.5, 'body on card'],
  ['onSurface', 'surfaceContainerHigh', 4.5, 'body on raised container'],
  ['onSurfaceVariant', 'surface', 4.5, 'supporting text on surface'],
  ['onSurfaceVariant', 'surfaceContainer', 4.5, 'supporting text on card'],
  ['onSurfaceVariant', 'surfaceContainerHigh', 4.5, 'supporting text on raised card'],
  ['onPrimary', 'primary', 4.5, 'label on filled button'],
  ['onPrimaryContainer', 'primaryContainer', 4.5, 'text on primary container'],
  ['onSecondaryContainer', 'secondaryContainer', 4.5, 'text on secondary container'],
  ['onTertiaryContainer', 'tertiaryContainer', 4.5, 'text on tertiary container'],
  ['onError', 'error', 4.5, 'text on error'],
  ['onErrorContainer', 'errorContainer', 4.5, 'text on error container'],
  ['primary', 'surface', 4.5, 'primary text on surface'],
  ['primary', 'surfaceContainer', 4.5, 'primary text on card'],
  ['tertiary', 'surface', 4.5, 'tertiary text on surface'],
  ['onSuccessContainer', 'successContainer', 4.5, 'success text on container'],
  ['onWarningContainer', 'warningContainer', 4.5, 'warning text on container'],
  ['inverseOnSurface', 'inverseSurface', 4.5, 'snackbar text'],
  ['onFileImageContainer', 'fileImageContainer', 4.5, 'image file tile'],
  ['onFileVideoContainer', 'fileVideoContainer', 4.5, 'video file tile'],
  ['onFileAudioContainer', 'fileAudioContainer', 4.5, 'audio file tile'],
  ['onFileDocContainer', 'fileDocContainer', 4.5, 'doc file tile'],
  ['onFileArchiveContainer', 'fileArchiveContainer', 4.5, 'archive file tile'],
  ['onFileCodeContainer', 'fileCodeContainer', 4.5, 'code file tile'],
  ['onSurface', 'surfaceContainerHighest', 4.5, 'dialogs and menus'],
];

const ADVISORY = [
  ['outline', 'surface', 3.0, 'control outline (WCAG 1.4.11)'],
  ['outline', 'surfaceContainer', 3.0, 'outline on card'],
  ['outlineVariant', 'surface', 1.4, 'decorative divider'],
  ['primary', 'primaryContainer', 3.0, 'icon on primary container'],
  ['onSurfaceVariant', 'surfaceContainerHighest', 4.5, 'menu supporting text'],
];

/* ── Emit ───────────────────────────────────────────────────────── */

function block(roles) {
  const lines = [];
  for (const [role, hex] of Object.entries(roles)) {
    lines.push(`  --md-sys-color-${kebab(role)}: ${hex};`);
  }
  lines.push('');
  for (const [role, hex] of Object.entries(roles)) {
    lines.push(`  --m3-${kebab(role)}-hsl: ${hslTriplet(hex)};`);
  }
  return lines.join('\n');
}

const schemes = {};
for (const seed of Object.keys(SEEDS)) {
  schemes[seed] = { light: scheme(seed, 'light'), dark: scheme(seed, 'dark') };
}

let css = `/* ═══════════════════════════════════════════════════════════════════
   MATERIAL 3 COLOR ROLES — GENERATED, DO NOT EDIT
   Source: tokens/m3.json · generator: scripts/gen_m3_theme.mjs
   Seeds: ${Object.keys(SEEDS).join(', ')} · default: ${DEFAULT_SEED}
   ═══════════════════════════════════════════════════════════════════ */

html {
  color-scheme: light;
${block(schemes[DEFAULT_SEED].light)}
}

html.dark {
  color-scheme: dark;
${block(schemes[DEFAULT_SEED].dark)}
}
`;

for (const seed of Object.keys(SEEDS)) {
  if (seed === DEFAULT_SEED) continue;
  css += `
html:not(.dark)[data-m3-seed="${seed}"] {
  color-scheme: light;
${block(schemes[seed].light)}
}

html.dark[data-m3-seed="${seed}"] {
  color-scheme: dark;
${block(schemes[seed].dark)}
}
`;
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, css);

/* ── Report ─────────────────────────────────────────────────────── */

let failures = 0;
let advisories = 0;
console.log(`\nMaterial 3 scheme → ${OUT.replace(ROOT + '/', '')}\n`);

for (const seed of Object.keys(SEEDS)) {
  for (const mode of ['light', 'dark']) {
    const roles = schemes[seed][mode];
    console.log(`${SEEDS[seed].label} · ${mode}`);
    for (const [fg, bg, min, label] of REQUIRED) {
      const r = contrast(roles[fg], roles[bg]);
      const pass = r >= min;
      if (!pass) failures++;
      console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  ${label}`);
    }
    for (const [fg, bg, min, label] of ADVISORY) {
      const r = contrast(roles[fg], roles[bg]);
      const pass = r >= min;
      if (!pass) advisories++;
      console.log(`  ${pass ? 'pass' : 'WARN'}  ${r.toFixed(2).padStart(5)}:1  ${label} (advisory)`);
    }
    console.log('');
  }
}

console.log(failures === 0
  ? `All required pairs pass in all seeds and both themes.${advisories ? ` ${advisories} advisory warning(s).` : ''}`
  : `${failures} required pair(s) FAILED.`);

if (CHECK && failures > 0) process.exit(1);
