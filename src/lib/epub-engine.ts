import JSZip from 'jszip';

export interface EpubTocItem {
  label: string;
  href: string;
  subitems?: EpubTocItem[];
}

export interface EpubTheme {
  bg: string;
  fg: string;
  accent: string;
}

export interface EpubPageInfo {
  pageIndex: number;
  totalPages: number;
  percentage: number;
  sectionIndex: number;
  sectionHref: string;
}

export interface SearchResult {
  sectionIndex: number;
  text: string;
  offset: number;
  snippet: string;
}

interface SpineItem {
  id: string;
  href: string;
  mediaType: string;
  linear: boolean;
}

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
}

export class EpubEngine {
  private zip: JSZip | null = null;
  private opfDir = '';
  private metadata: Record<string, string> = {};
  private manifest: Map<string, ManifestItem> = new Map();
  private spine: SpineItem[] = [];
  private toc: EpubTocItem[] = [];
  private sectionHtmls: Map<number, string> = new Map();
  private containerEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private currentPageIndex = 0;
  private totalPages = 0;
  private currentTheme: EpubTheme = { bg: '#0A0A0A', fg: '#D4D4D4', accent: '#8AB4C4' };
  private _fontSize = 18;
  private _fontFamily: 'serif' | 'sans' = 'serif';
  private _lineHeight = 1.6;
  private _ready = false;
  private resizeObserver: ResizeObserver | null = null;
  private _onPageChange: ((info: EpubPageInfo) => void) | null = null;
  private scrollHandler: (() => void) | null = null;
  private _sectionOffsets: number[] = [];

  get ready() { return this._ready; }
  get sectionCount() { return this.spine.length; }

  set onPageChange(fn: (info: EpubPageInfo) => void) { this._onPageChange = fn; }

  async load(arrayBuffer: ArrayBuffer): Promise<void> {
    this.zip = await JSZip.loadAsync(arrayBuffer);
    await this.parseContainer();
    await this.parseOpf();
    await this.parseToc();
    this._ready = true;
  }

  private async parseContainer(): Promise<void> {
    if (!this.zip) throw new Error('No ZIP loaded');
    const containerXml = await this.zip.file('META-INF/container.xml')?.async('text');
    if (!containerXml) throw new Error('Invalid EPUB: missing container.xml');
    const parser = new DOMParser();
    const doc = parser.parseFromString(containerXml, 'application/xml');
    const rootfile = doc.querySelector('rootfile');
    if (!rootfile) throw new Error('Invalid EPUB: no rootfile');
    const fullPath = rootfile.getAttribute('full-path');
    if (!fullPath) throw new Error('Invalid EPUB: no full-path');
    this.opfDir = fullPath.includes('/') ? fullPath.substring(0, fullPath.lastIndexOf('/') + 1) : '';
  }

  private async parseOpf(): Promise<void> {
    if (!this.zip) throw new Error('No ZIP loaded');
    const opfPath = this.opfDir ? `${this.opfDir}content.opf` : 'content.opf';
    let opfXml = await this.zip.file(opfPath)?.async('text');
    if (!opfXml) {
      const alt = this.opfDir ? `${this.opfDir}OEBPS/content.opf` : 'OEBPS/content.opf';
      opfXml = await this.zip.file(alt)?.async('text');
      if (!opfXml) throw new Error('Invalid EPUB: no content.opf found');
      this.opfDir = alt.replace('content.opf', '');
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(opfXml, 'application/xml');

    const metadataEl = doc.querySelector('metadata');
    if (metadataEl) {
      const titleEl = metadataEl.querySelector('title') || metadataEl.querySelector('dc\\:title');
      if (titleEl) this.metadata['title'] = titleEl.textContent || '';
      const creatorEl = metadataEl.querySelector('creator') || metadataEl.querySelector('dc\\:creator');
      if (creatorEl) this.metadata['creator'] = creatorEl.textContent || '';
    }

    const manifestEl = doc.querySelector('manifest');
    if (manifestEl) {
      manifestEl.querySelectorAll('item').forEach(item => {
        const id = item.getAttribute('id');
        const href = item.getAttribute('href');
        const mediaType = item.getAttribute('media-type') || '';
        const properties = item.getAttribute('properties') || undefined;
        if (id && href) this.manifest.set(id, { id, href, mediaType, properties });
      });
    }

    const spineEl = doc.querySelector('spine');
    if (spineEl) {
      spineEl.querySelectorAll('itemref').forEach(ref => {
        const idref = ref.getAttribute('idref');
        const linear = ref.getAttribute('linear') !== 'no';
        if (idref) {
          const item = this.manifest.get(idref);
          if (item) this.spine.push({ id: idref, href: item.href, mediaType: item.mediaType, linear });
        }
      });
    }
  }

  private async parseToc(): Promise<void> {
    if (!this.zip) return;
    let navHref = '';
    for (const item of this.manifest.values()) {
      if (item.properties === 'nav' || item.properties?.includes('nav')) {
        navHref = item.href;
        break;
      }
    }
    if (navHref) {
      await this.parseNav(navHref);
    } else {
      const ncxItem = Array.from(this.manifest.values()).find(m => m.mediaType === 'application/x-dtbncx+xml');
      if (ncxItem) await this.parseNcx(ncxItem.href);
    }
  }

  private async parseNav(href: string): Promise<void> {
    if (!this.zip) return;
    const fullPath = this.resolveHref(href);
    const content = await this.zip.file(fullPath)?.async('text');
    if (!content) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xhtml+xml');
    const navEl = doc.querySelector('nav[epub\\:type="toc"], nav.toc, nav');
    if (!navEl) return;
    this.toc = this.parseNavOl(navEl.querySelector('ol'));
  }

  private parseNavOl(ol: Element | null): EpubTocItem[] {
    if (!ol) return [];
    const items: EpubTocItem[] = [];
    ol.querySelectorAll(':scope > li').forEach(li => {
      const a = li.querySelector('a');
      if (a) {
        const href = a.getAttribute('href') || '';
        const label = a.textContent?.trim() || '';
        const subOl = li.querySelector('ol');
        const subitems = subOl ? this.parseNavOl(subOl) : undefined;
        items.push({ label, href, subitems: subitems?.length ? subitems : undefined });
      }
    });
    return items;
  }

  private async parseNcx(href: string): Promise<void> {
    if (!this.zip) return;
    const fullPath = this.resolveHref(href);
    const content = await this.zip.file(fullPath)?.async('text');
    if (!content) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');
    const navMap = doc.querySelector('navMap');
    if (!navMap) return;
    this.toc = this.parseNcxNavPoints(navMap);
  }

  private parseNcxNavPoints(parent: Element): EpubTocItem[] {
    const items: EpubTocItem[] = [];
    parent.querySelectorAll(':scope > navPoint').forEach(np => {
      const label = np.querySelector('navLabel text')?.textContent?.trim() || '';
      const src = np.querySelector('content')?.getAttribute('src') || '';
      const subitems = this.parseNcxNavPoints(np);
      items.push({ label, href: src, subitems: subitems.length ? subitems : undefined });
    });
    return items;
  }

  private resolveHref(href: string): string {
    const hashIdx = href.indexOf('#');
    const baseHref = hashIdx >= 0 ? href.substring(0, hashIdx) : href;
    if (!baseHref) return this.opfDir;
    if (baseHref.startsWith('/')) return baseHref.substring(1);
    return this.opfDir + baseHref;
  }

  private getRelativeBase(sectionHref: string): string {
    const dir = sectionHref.includes('/') ? sectionHref.substring(0, sectionHref.lastIndexOf('/') + 1) : '';
    return this.opfDir + dir;
  }

  private resolvePath(base: string, relative: string): string {
    if (relative.startsWith('/')) return relative.substring(1);
    if (relative.startsWith('../') || relative.startsWith('./')) {
      const parts = (base + relative).split('/');
      const resolved: string[] = [];
      for (const part of parts) {
        if (part === '..') resolved.pop();
        else if (part !== '.') resolved.push(part);
      }
      return resolved.join('/');
    }
    return base + relative;
  }

  async render(container: HTMLElement, sectionIndex = 0): Promise<void> {
    this.containerEl = container;
    container.innerHTML = '';

    this.contentEl = document.createElement('div');
    this.contentEl.style.width = '100%';
    this.contentEl.style.height = '100%';
    this.contentEl.style.overflow = 'auto';
    this.contentEl.style.WebkitOverflowScrolling = 'touch';
    this.contentEl.style.scrollbarWidth = 'none';
    (this.contentEl.style as any).msOverflowStyle = 'none';
    container.appendChild(this.contentEl);

    const style = document.createElement('style');
    style.textContent = `#epub-scroll-container::-webkit-scrollbar { display: none; }`;
    style.id = 'epub-scroll-style';
    container.appendChild(style);

    this.scrollHandler = () => this.handleScroll();
    this.contentEl.addEventListener('scroll', this.scrollHandler, { passive: true });
    this.contentEl.id = 'epub-scroll-container';

    this.resizeObserver = new ResizeObserver(() => this.recalculateLayout());
    this.resizeObserver.observe(this.contentEl);

    for (let i = 0; i < this.spine.length; i++) {
      await this.loadSection(i);
    }

    this.recalculateLayout();

    if (sectionIndex > 0) {
      const target = this._sectionOffsets[sectionIndex] || 0;
      this.contentEl.scrollTop = target;
    }
  }

  private async loadSection(index: number): Promise<void> {
    if (!this.contentEl || index < 0 || index >= this.spine.length) return;
    const spineItem = this.spine[index];
    if (!spineItem) return;

    let html = this.sectionHtmls.get(index);
    if (!html) {
      html = await this.loadSectionHtml(index);
      if (html !== null) this.sectionHtmls.set(index, html);
      else return;
    }

    const sectionEl = document.createElement('div');
    sectionEl.className = 'epub-section';
    sectionEl.dataset.sectionIndex = String(index);
    sectionEl.innerHTML = html;
    this.applyThemeToElement(sectionEl);

    this.contentEl.appendChild(sectionEl);

    await this.resolveImages(sectionEl, spineItem.href);
    await this.resolveStylesheets(sectionEl, spineItem.href);
  }

  private async loadSectionHtml(index: number): Promise<string | null> {
    if (!this.zip) return null;
    const spineItem = this.spine[index];
    if (!spineItem) return null;
    const fullPath = this.resolveHref(spineItem.href);
    const content = await this.zip.file(fullPath)?.async('text');
    if (!content) return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const body = doc.querySelector('body');
    return body ? body.innerHTML : content;
  }

  private async resolveImages(containerEl: HTMLElement, sectionHref: string): Promise<void> {
    if (!this.zip) return;
    const base = this.getRelativeBase(sectionHref);

    const imgs = containerEl.querySelectorAll('img');
    await Promise.allSettled(Array.from(imgs).map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;
      try {
        const resolvedPath = this.resolvePath(base, src);
        const file = this.zip!.file(resolvedPath);
        if (file) {
          const blob = await file.async('blob');
          img.setAttribute('src', URL.createObjectURL(blob));
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
        }
      } catch {}
    }));

    const svgImages = containerEl.querySelectorAll('image');
    await Promise.allSettled(Array.from(svgImages).map(async (el) => {
      const href = el.getAttribute('xlink:href') || el.getAttribute('href');
      if (!href || href.startsWith('data:')) return;
      try {
        const resolvedPath = this.resolvePath(base, href);
        const file = this.zip!.file(resolvedPath);
        if (file) {
          const blob = await file.async('blob');
          const url = URL.createObjectURL(blob);
          el.setAttribute('href', url);
          el.setAttribute('xlink:href', url);
        }
      } catch {}
    }));
  }

  private async resolveStylesheets(containerEl: HTMLElement, sectionHref: string): Promise<void> {
    if (!this.zip) return;
    const base = this.getRelativeBase(sectionHref);
    const links = containerEl.querySelectorAll('link[rel="stylesheet"]');
    await Promise.allSettled(Array.from(links).map(async (link) => {
      const href = link.getAttribute('href');
      if (!href) return;
      try {
        const resolvedPath = this.resolvePath(base, href);
        const file = this.zip!.file(resolvedPath);
        if (file) {
          let css = await file.async('text');
          css = await this.resolveCssUrls(css, resolvedPath);
          const style = document.createElement('style');
          style.setAttribute('data-epub-css', 'true');
          style.textContent = css;
          link.parentNode?.replaceChild(style, link);
        }
      } catch {}
    }));
  }

  private async resolveCssUrls(css: string, cssPath: string): Promise<string> {
    if (!this.zip) return css;
    const cssDir = cssPath.includes('/') ? cssPath.substring(0, cssPath.lastIndexOf('/') + 1) : '';
    const urlRegex = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/g;
    for (const match of [...css.matchAll(urlRegex)]) {
      const url = match[1];
      if (!url || url.startsWith('data:') || url.startsWith('http') || url.startsWith('blob:')) continue;
      try {
        const file = this.zip!.file(cssDir + url);
        if (file) {
          const blob = await file.async('blob');
          css = css.replace(match[0], `url("${URL.createObjectURL(blob)}")`);
        }
      } catch {}
    }
    return css;
  }

  private applyThemeToElement(el: HTMLElement): void {
    const ff = this._fontFamily === 'serif'
      ? 'Georgia, "Literata", "EB Garamond", serif'
      : '"Inter", -apple-system, "Segoe UI", sans-serif';

    el.style.fontFamily = ff;
    el.style.fontSize = `${this._fontSize}px`;
    el.style.lineHeight = `${this._lineHeight}`;
    el.style.color = this.currentTheme.fg;
    el.style.background = 'transparent';
    el.style.padding = this.containerEl
      ? `${Math.min(40, this.containerEl.clientHeight * 0.06)}px ${isMobile() ? '16px' : '10%'}`
      : '40px 10%';
    el.style.wordBreak = 'break-word';
    el.style.overflowWrap = 'break-word';
    el.style.textRendering = 'optimizeLegibility';
    el.style.webkitFontSmoothing = 'antialiased';
    // Book typography: justified measure with hyphenation, capped line
    // length so wide screens still read like a page, not a webpage.
    el.style.textAlign = 'justify';
    (el.style as any).hyphens = 'auto';
    (el.style as any).webkitHyphens = 'auto';
    el.style.maxWidth = '68ch';
    el.style.marginLeft = 'auto';
    el.style.marginRight = 'auto';

    const allEls = el.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, span, a, em, strong, i, b, div, section, article');
    allEls.forEach((child) => {
      const c = child as HTMLElement;
      c.style.color = this.currentTheme.fg;
      if (c.tagName === 'P') { c.style.marginBottom = '1.2em'; c.style.textIndent = '0'; }
      if (['H1','H2','H3','H4','H5','H6'].includes(c.tagName)) {
        c.style.color = this.currentTheme.fg;
        c.style.fontWeight = '700';
        c.style.marginTop = '1.5em';
        c.style.marginBottom = '0.5em';
      }
      if (c.tagName === 'A') { c.style.color = this.currentTheme.accent; }
      if (c.tagName === 'BLOCKQUOTE') {
        c.style.borderLeft = `3px solid ${this.currentTheme.accent}66`;
        c.style.paddingLeft = '1em';
        c.style.marginLeft = '0';
      }
      if (c.tagName === 'IMG') { c.style.maxWidth = '100%'; c.style.height = 'auto'; c.style.borderRadius = '4px'; c.style.margin = '0.5em 0'; }
      if (['TABLE','TR','TD','TH'].includes(c.tagName)) { c.style.border = `1px solid ${this.currentTheme.fg}22`; c.style.padding = '6px'; }
    });

    el.querySelectorAll('img').forEach(img => {
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.margin = '0.5em 0';
    });
  }

  private handleScroll(): void {
    if (!this.contentEl || !this._ready) return;
    const scrollTop = this.contentEl.scrollTop;
    const viewH = this.contentEl.clientHeight;
    if (viewH <= 0) return;

    const page = Math.round(scrollTop / viewH);
    if (page !== this.currentPageIndex) {
      this.currentPageIndex = page;
      this.notifyPageChange();
    }
  }

  private recalculateLayout(): void {
    if (!this.contentEl) return;
    const sections = this.contentEl.querySelectorAll('.epub-section');
    const viewH = this.contentEl.clientHeight;
    if (viewH <= 0 || sections.length === 0) return;

    this._sectionOffsets = [];
    let accum = 0;
    sections.forEach((s) => {
      this._sectionOffsets.push(accum);
      accum += (s as HTMLElement).offsetHeight;
    });

    this.totalPages = Math.max(1, Math.ceil(this.contentEl.scrollHeight / viewH));
    this.currentPageIndex = Math.min(this.currentPageIndex, this.totalPages - 1);
    this.notifyPageChange();
  }

  private notifyPageChange(): void {
    if (!this._onPageChange) return;
    const viewH = this.contentEl?.clientHeight || 1;
    const scrollTop = this.contentEl?.scrollTop || 0;
    const pct = this.totalPages > 0 ? Math.round((this.currentPageIndex / this.totalPages) * 100) : 0;

    let sectionIdx = 0;
    for (let i = this._sectionOffsets.length - 1; i >= 0; i--) {
      if (scrollTop >= this._sectionOffsets[i] - viewH / 2) {
        sectionIdx = i;
        break;
      }
    }

    this._onPageChange({
      pageIndex: this.currentPageIndex,
      totalPages: this.totalPages,
      percentage: pct,
      sectionIndex: sectionIdx,
      sectionHref: this.spine[sectionIdx]?.href || '',
    });
  }

  nextPage(): boolean {
    if (!this.contentEl) return false;
    const viewH = this.contentEl.clientHeight;
    if (viewH <= 0) return false;
    if (this.currentPageIndex >= this.totalPages - 1) return false;
    this.currentPageIndex++;
    this.contentEl.scrollTo({ top: this.currentPageIndex * viewH, behavior: 'smooth' });
    return true;
  }

  prevPage(): boolean {
    if (!this.contentEl) return false;
    const viewH = this.contentEl.clientHeight;
    if (viewH <= 0) return false;
    if (this.currentPageIndex <= 0) return false;
    this.currentPageIndex--;
    this.contentEl.scrollTo({ top: this.currentPageIndex * viewH, behavior: 'smooth' });
    return true;
  }

  goToPercentage(pct: number): void {
    if (!this.contentEl || this.totalPages <= 0) return;
    const target = Math.round((pct / 100) * this.totalPages);
    this.currentPageIndex = Math.min(target, this.totalPages - 1);
    const viewH = this.contentEl.clientHeight;
    this.contentEl.scrollTo({ top: this.currentPageIndex * viewH, behavior: 'smooth' });
  }

  async goToHref(href: string): Promise<void> {
    if (!this.contentEl) return;

    if (href.startsWith('#')) {
      const num = parseInt(href.slice(1), 10);
      if (!isNaN(num) && num >= 0 && num < this._sectionOffsets.length) {
        const offset = this._sectionOffsets[num];
        this.contentEl.scrollTo({ top: offset, behavior: 'smooth' });
        return;
      }
    }

    const hashIdx = href.indexOf('#');
    const baseHref = hashIdx >= 0 ? href.substring(0, hashIdx) : href;

    let targetIdx = 0;
    for (let i = 0; i < this.spine.length; i++) {
      const clean = this.spine[i].href.split('#')[0];
      const target = baseHref.split('#')[0];
      if (clean === target || clean.endsWith('/' + target) || target.endsWith('/' + clean)) {
        targetIdx = i;
        break;
      }
    }

    const sections = this.contentEl.querySelectorAll('.epub-section');
    const section = sections[targetIdx] as HTMLElement;
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  applyTheme(theme: EpubTheme): void {
    this.currentTheme = theme;
    if (!this.containerEl) return;
    this.containerEl.style.background = theme.bg;
    const sections = this.contentEl?.querySelectorAll('.epub-section');
    sections?.forEach(s => this.applyThemeToElement(s as HTMLElement));
  }

  setFont(size: number): void {
    this._fontSize = size;
    const sections = this.contentEl?.querySelectorAll('.epub-section');
    sections?.forEach(s => (s as HTMLElement).style.fontSize = `${size}px`);
  }

  setFontFamily(family: 'serif' | 'sans'): void {
    this._fontFamily = family;
    const ff = family === 'serif'
      ? 'Georgia, "Literata", "EB Garamond", serif'
      : '"Inter", -apple-system, "Segoe UI", sans-serif';
    const sections = this.contentEl?.querySelectorAll('.epub-section');
    sections?.forEach(s => (s as HTMLElement).style.fontFamily = ff);
  }

  setLineHeight(lh: number): void {
    this._lineHeight = lh;
    const sections = this.contentEl?.querySelectorAll('.epub-section');
    sections?.forEach(s => (s as HTMLElement).style.lineHeight = `${lh}`);
  }

  getToc(): EpubTocItem[] { return this.toc; }
  getMetadata(): Record<string, string> { return { ...this.metadata }; }

  async search(query: string): Promise<SearchResult[]> {
    if (!this.zip || !query.trim()) return [];
    const results: SearchResult[] = [];
    const lower = query.toLowerCase();

    for (let i = 0; i < this.spine.length; i++) {
      if (results.length >= 50) break;
      try {
        let html = this.sectionHtmls.get(i);
        if (!html) { html = await this.loadSectionHtml(i); if (html) this.sectionHtmls.set(i, html); }
        if (!html) continue;
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const text = tmp.textContent || '';
        let start = 0;
        while (start < text.length) {
          const idx = text.toLowerCase().indexOf(lower, start);
          if (idx === -1) break;
          const snippet = text.substring(Math.max(0, idx - 50), Math.min(text.length, idx + query.length + 80));
          results.push({ sectionIndex: i, text: text.substring(idx, idx + query.length), offset: idx, snippet: `...${snippet.trim()}...` });
          start = idx + 1;
          if (results.length >= 50) break;
        }
      } catch {}
    }
    return results;
  }

  async destroy(): Promise<void> {
    this._ready = false;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.contentEl && this.scrollHandler) {
      this.contentEl.removeEventListener('scroll', this.scrollHandler);
    }
    this.scrollHandler = null;
    if (this.contentEl) {
      this.contentEl.querySelectorAll('img, image').forEach(el => {
        const src = el.getAttribute('src') || el.getAttribute('href');
        if (src?.startsWith('blob:')) { try { URL.revokeObjectURL(src); } catch {} }
      });
      this.contentEl.innerHTML = '';
    }
    this.sectionHtmls.clear();
    this.containerEl = null;
    this.contentEl = null;
    this.zip = null;
    this.spine = [];
    this.manifest.clear();
    this.toc = [];
    this.currentPageIndex = 0;
    this.totalPages = 0;
    this._onPageChange = null;
    this._sectionOffsets = [];
  }
}

function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 640;
}
