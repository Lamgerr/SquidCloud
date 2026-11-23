/**
 * Preview tab manager — one place that owns the user's open preview viewers.
 * Tabs can be active (full-screen), minimized (floating stack), or hidden.
 */
export type PreviewKind =
  | 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'epub'
  | 'spreadsheet' | 'font' | 'archive' | 'model' | 'markdown' | 'other';

export interface PreviewTab {
  id: string;
  file: any;
  kind: PreviewKind;
  label: string;
  minimized: boolean;
  createdAt: number;
}

type Listener = (tabs: PreviewTab[]) => void;

class PreviewTabs {
  private tabs: PreviewTab[] = [];
  private activeId: string | null = null;
  private hidden = false;
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }
  private emit() { const s = this.snapshot(); this.listeners.forEach(fn => fn(s)); }

  snapshot(): PreviewTab[] { return [...this.tabs]; }
  get active(): PreviewTab | null { return this.tabs.find(t => t.id === this.activeId) || null; }
  get activeTabId() { return this.activeId; }
  get isHidden() { return this.hidden; }
  get minimizedTabs() { return this.tabs.filter(t => t.minimized && !this.hidden); }

  /** Open (or focus) a file. Returns the tab id. */
  open(file: any, kind: PreviewKind, label: string): string {
    const id = String(file?.id || file?.url || `${label}_${Date.now()}`);
    const existing = this.tabs.find(t => t.id === id);
    if (existing) {
      existing.minimized = false;
      this.activeId = id;
      this.hidden = false;
    } else {
      this.tabs.unshift({ id, file, kind, label, minimized: false, createdAt: Date.now() });
      this.activeId = id;
      this.hidden = false;
    }
    this.emit();
    return id;
  }
  /** Minimize the active tab (viewer becomes a floating card). */
  minimize(id?: string) {
    const t = this.tabs.find(x => x.id === (id || this.activeId));
    if (t) t.minimized = true;
    if (this.activeId === (id || this.activeId)) this.activeId = null;
    this.emit();
  }
  restore(id: string) {
    const t = this.tabs.find(x => x.id === id);
    if (t) t.minimized = false;
    this.activeId = id;
    this.hidden = false;
    this.emit();
  }
  close(id: string) {
    this.tabs = this.tabs.filter(t => t.id !== id);
    if (this.activeId === id) this.activeId = null;
    this.emit();
  }
  closeAll() { this.tabs = []; this.activeId = null; this.hidden = false; this.emit(); }
  hideAll() { this.hidden = true; this.activeId = null; this.emit(); }
  showAll() { this.hidden = false; this.emit(); }
  setActive(id: string) { this.activeId = id; const t = this.tabs.find(x => x.id === id); if (t) t.minimized = false; this.emit(); }
}

export const previewTabs = new PreviewTabs();

export function detectKind(file: any): PreviewKind {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.epub') || type === 'application/epub+zip') return 'epub';
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|heic|tiff?|bmp|avif)$/.test(name)) return 'image';
  if (type.startsWith('video/') || /\.(mp4|mkv|mov|webm|avi|m4v)$/.test(name)) return 'video';
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac)$/.test(name)) return 'audio';
  if (/\.(xlsx?|csv|ods)$/.test(name) || type.includes('spreadsheet')) return 'spreadsheet';
  if (/\.(ttf|otf|woff2?)$/.test(name)) return 'font';
  if (/\.(zip|rar|7z|tar|gz|tgz)$/.test(name)) return 'archive';
  if (/\.(glb|gltf|stl|obj|usdz?)$/.test(name)) return 'model';
  if (/\.(md|markdown)$/.test(name)) return 'markdown';
  if (type.startsWith('text/') || /\.(txt|json|js|ts|tsx|jsx|py|html|css|scss|yml|yaml|xml|sql|log|sh)$/.test(name)) return 'text';
  return 'other';
}
