export type Point = { x: number; y: number; p?: number };

export interface InkStroke {
  id: string;
  color: string;
  size: number;
  points: Point[];
}

export type SqdObjectType = 'rect' | 'ellipse' | 'line' | 'arrow' | 'textbox' | 'image';

export interface SqdObjectBase {
  id: string;
  type: SqdObjectType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
}

export interface SqdShape extends SqdObjectBase {
  type: 'rect' | 'ellipse' | 'line' | 'arrow';
  fill: string;
  stroke: string;
  strokeWidth: number;
  text?: string;
  fontSize?: number;
}

export interface SqdShapeObj extends SqdObjectBase {
  type: 'shape';
  shape: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text?: string;
  fontSize?: number;
  points?: { x: number; y: number }[];
}

export interface SqdTextbox extends SqdObjectBase {
  type: 'textbox';
  fill: string;
  stroke: string;
  text: string;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
}

export interface SqdImage extends SqdObjectBase {
  type: 'image';
  src: string;
  radius: number;
  caption?: string;
}

export type SqdObject = SqdShape | SqdShapeObj | SqdTextbox | SqdImage;

export type BackgroundType = 'plain' | 'ruled' | 'dotted' | 'grid';

export interface BackgroundConfig {
  type: BackgroundType;
  paper: string;
  ink: string;
  line: string;
}

export interface SqdDoc {
  kind: 'sqd';
  version: 1;
  text: string;
  language: string;
  background: BackgroundConfig;
  strokes: InkStroke[];
  objects: SqdObject[];
  meta: { createdAt?: string; updatedAt?: string; theme?: string; mode?: EditorMode };
}

export type EditorMode = 'text' | 'write' | 'draw' | 'whiteboard' | 'flowchart' | 'mindmap' | 'reading';

export function uid(prefix = 'o'): string {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export const SQD_MIME = 'application/x-squidcloud-sqd';

export function isSqdName(name?: string | null): boolean {
  return !!name && name.toLowerCase().endsWith('.sqd');
}

export function defaultBackground(paper = '#fbfaf5', ink = '#1f2430', line = '#cdd6e6'): BackgroundConfig {
  return { type: 'ruled', paper, ink, line };
}

export function emptyDoc(text = '', language = 'markdown'): SqdDoc {
  return {
    kind: 'sqd',
    version: 1,
    text,
    language,
    background: defaultBackground(),
    strokes: [],
    objects: [],
    meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  };
}

export function serializeDoc(doc: SqdDoc): Blob {
  const out: SqdDoc = { ...doc, meta: { ...doc.meta, updatedAt: new Date().toISOString() } };
  return new Blob([JSON.stringify(out, null, 2)], { type: SQD_MIME });
}

export function parseDoc(raw: string): SqdDoc | null {
  try {
    const data = JSON.parse(raw);
    if (data && data.kind === 'sqd' && Array.isArray(data.strokes) && Array.isArray(data.objects)) {
      return data as SqdDoc;
    }
    return null;
  } catch {
    return null;
  }
}

export function docToText(doc: SqdDoc): Blob {
  return new Blob([doc.text ?? ''], { type: 'text/plain' });
}
