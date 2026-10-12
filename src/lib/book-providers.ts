/* ── Open book providers (all keyless) ──────────────────────────
   Gutendex      — Project Gutenberg catalog API, incl. EPUB URLs.
   Open Library  — search.json + covers; `ia` field links editions to
                   Internet Archive scans (ebook_access = readable).
   Internet Archive — advancedsearch (metadata) + metadata API for files.
   Every book normalizes to ProviderBook so ranking, shelves, progress,
   history and save-to-storage work identically across sources.
   ─────────────────────────────────────────────────────────────── */

export type BookSource = 'gutendex' | 'openlibrary' | 'archive';

export interface ProviderBook {
  /** stable cross-session key, e.g. 'gutendex:123', 'ol:/works/OL..W', 'ia:ident' */
  key: string;
  source: BookSource;
  /** source-native id (gutendex number / OL work key / IA identifier) */
  sourceId: string;
  title: string;
  authors: string[];
  subjects: string[];
  coverUrl: string | null;
  /** popularity signal in source units (downloads / ratings / loans) */
  popularity: number;
  year: number | null;
  /** direct EPUB url when known without extra lookups (may be null) */
  epubUrl: string | null;
  /** Internet Archive identifier backing this record, if any */
  iaId: string | null;
  /** Open Library work key, if any */
  olKey: string | null;
}

export interface ProviderSearchOpts {
  query?: string;
  topic?: string;
  author?: string;
  sort?: 'popular' | 'newest';
  page?: number;
  limit?: number;
}

const UA = { 'User-Agent': 'SquidCloud-DeepRead/1.0 (book discovery)' };

async function getJson(url: string, timeoutMs = 12000): Promise<any> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: UA, signal: c.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const normTitle = (t: string) =>
  t.toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

/* ── Gutendex ─────────────────────────────────────────────── */

const GUT_SORT: Record<string, string> = { popular: 'popular', newest: 'descending' };

export async function searchGutendex(opts: ProviderSearchOpts): Promise<{ books: ProviderBook[]; hasMore: boolean }> {
  const p = new URLSearchParams();
  if (opts.query) p.set('search', opts.query);
  if (opts.topic) p.set('topic', opts.topic);
  if (opts.author) p.set('search', opts.author);
  p.set('sort', GUT_SORT[opts.sort || 'popular']);
  p.set('page', String(opts.page || 1));
  /* Gutendex is called through a same-origin proxy: browsers block the
     cross-origin request outright (status 0), which is why the catalog
     rendered empty. The proxy is an allowlisted edge function. */
  const data = await getJson(`/api/gutendex-proxy?url=${encodeURIComponent(`https://gutendex.com/books/?${p.toString()}`)}`);
  const books: ProviderBook[] = (data.results || []).map((b: any) => ({
    key: `gutendex:${b.id}`,
    source: 'gutendex' as BookSource,
    sourceId: String(b.id),
    title: b.title || 'Untitled',
    authors: (b.authors || []).map((a: any) => a.name).filter(Boolean),
    subjects: (b.subjects || []).slice(0, 8),
    coverUrl: b.formats?.['image/jpeg'] || null,
    popularity: b.download_count || 0,
    year: null,
    epubUrl: b.formats?.['application/epub+zip'] || null,
    iaId: null,
    olKey: null,
  }));
  return { books, hasMore: !!data.next };
}

/* ── Open Library ─────────────────────────────────────────── */

const OL_FIELDS = 'key,title,author_name,cover_i,first_publish_year,subject,ebook_access,ia,ratings_average,ratings_count';

export async function searchOpenLibrary(opts: ProviderSearchOpts): Promise<{ books: ProviderBook[]; hasMore: boolean }> {
  const p = new URLSearchParams();
  if (opts.query) p.set('q', opts.query);
  else if (opts.author) p.set('author', opts.author);
  else if (opts.topic) p.set('subject', opts.topic);
  else p.set('q', '*');
  if (opts.sort === 'newest') p.set('sort', 'new');
  else p.set('sort', 'rating desc');
  p.set('fields', OL_FIELDS);
  p.set('limit', String(opts.limit || 12));
  p.set('page', String(opts.page || 1));
  const data = await getJson(`/api/gutendex-proxy?url=${encodeURIComponent(`https://openlibrary.org/search.json?${p.toString()}`)}`);
  const docs = data.docs || [];
  const books: ProviderBook[] = docs.map((d: any) => {
    const key: string = d.key || '';
    return {
      key: `ol:${key}`,
      source: 'openlibrary' as BookSource,
      sourceId: key,
      title: d.title || 'Untitled',
      authors: (d.author_name || []).slice(0, 3),
      subjects: (d.subject || []).slice(0, 8),
      coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
      popularity: (d.ratings_count || 0) * 10 + (d.ebook_access === true ? 500 : 0),
      year: d.first_publish_year || null,
      epubUrl: null, // resolved on open via IA metadata
      iaId: Array.isArray(d.ia) ? d.ia[0] : (typeof d.ia === 'string' ? d.ia : null),
      olKey: key,
    };
  });
  const total = data.numFound || 0;
  const got = (opts.page || 1) * (opts.limit || 12);
  return { books, hasMore: total > got };
}

/* ── Internet Archive ─────────────────────────────────────── */

export async function searchArchive(opts: ProviderSearchOpts): Promise<{ books: ProviderBook[]; hasMore: boolean }> {
  const terms: string[] = ['mediatype:texts'];
  if (opts.query) terms.push(`(${opts.query.split(/\s+/).map(w => `"${w}"`).join(' AND ')})`);
  if (opts.topic) terms.push(`subject:"${opts.topic}"`);
  if (opts.author) terms.push(`creator:"${opts.author}"`);
  // Keep to english-language texts with files actually present.
  const p = new URLSearchParams({
    q: terms.join(' AND '),
    'fl[]': 'identifier,title,creator,downloads,year,subject',
    rows: String(opts.limit || 12),
    page: String(opts.page || 1),
    output: 'json',
  });
  if (opts.sort === 'newest') p.set('sort[]', 'addeddate desc');
  else p.set('sort[]', 'downloads desc');
  const data = await getJson(`/api/gutendex-proxy?url=${encodeURIComponent(`https://archive.org/advancedsearch.php?${p.toString()}`)}`);
  const docs = data?.response?.docs || [];
  const books: ProviderBook[] = docs.map((d: any) => {
    const creators = Array.isArray(d.creator) ? d.creator : d.creator ? [d.creator] : [];
    const subjects = Array.isArray(d.subject) ? d.subject : d.subject ? [d.subject] : [];
    return {
      key: `ia:${d.identifier}`,
      source: 'archive' as BookSource,
      sourceId: d.identifier,
      title: Array.isArray(d.title) ? d.title[0] : d.title || d.identifier,
      authors: creators.slice(0, 3).map(String),
      subjects: subjects.slice(0, 8).map(String),
      coverUrl: `https://archive.org/services/img/${d.identifier}`,
      popularity: Number(d.downloads) || 0,
      year: d.year ? Number(d.year) : null,
      epubUrl: null, // resolved on open via metadata API
      iaId: d.identifier,
      olKey: null,
    };
  });
  const found = data?.response?.numFound || 0;
  const got = (opts.page || 1) * (opts.limit || 12);
  return { books, hasMore: found > got };
}

/* ── Unified multi-provider search: parallel, deduped ─────── */

export interface UnifiedSearchResult {
  books: ProviderBook[];
  /** per-provider hit info for UI transparency */
  sources: Record<BookSource, { ok: boolean; count: number }>;
}

export async function searchAllProviders(opts: ProviderSearchOpts): Promise<UnifiedSearchResult> {
  const settled = await Promise.allSettled([
    searchGutendex(opts),
    searchOpenLibrary(opts),
    searchArchive(opts),
  ]);
  const out: ProviderBook[] = [];
  const seen = new Set<string>();
  const sources: UnifiedSearchResult['sources'] = {
    gutendex: { ok: false, count: 0 },
    openlibrary: { ok: false, count: 0 },
    archive: { ok: false, count: 0 },
  };
  const keys: BookSource[] = ['gutendex', 'openlibrary', 'archive'];
  settled.forEach((r, i) => {
    const k = keys[i];
    if (r.status !== 'fulfilled') return;
    sources[k] = { ok: true, count: r.value.books.length };
    for (const b of r.value.books) {
      const sig = `${normTitle(b.title)}|${(b.authors[0] || '').toLowerCase()}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(b);
    }
  });
  return { books: out, sources };
}

/* ── Resolve a readable EPUB url for any provider book ────── */

export async function resolveEpubUrl(book: ProviderBook): Promise<string> {
  if (book.epubUrl) return book.epubUrl;
  if (book.iaId) {
    const meta: any = await getJson(`/api/gutendex-proxy?url=${encodeURIComponent(`https://archive.org/metadata/${encodeURIComponent(book.iaId)}`)}`);
    const files: any[] = meta?.files || [];
    const epub = files.find(f => /\.epub$/i.test(f.name || '') && !/(_djvu|_text|_jp2|_pdf|_abbyy|_scandata)/i.test(f.name || ''));
    if (epub) return `https://archive.org/download/${book.iaId}/${encodeURIComponent(epub.name)}`;
    // Fallback: IA's conventional derivative name.
    return `https://archive.org/download/${book.iaId}/${book.iaId}_epub.epub`;
  }
  throw new Error('No readable EPUB edition found for this title.');
}

/* ── Download EPUB bytes (direct, then same-origin proxy) ─── */

export async function fetchEpubBytes(url: string): Promise<{ bytes: Uint8Array; fileName: string }> {
  const tryFetch = async (u: string): Promise<Uint8Array> => {
    const res = await fetch(u);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 5000) throw new Error('File too small to be a book');
    const head = new Uint8Array(buf.slice(0, 4));
    const isZip = head[0] === 0x50 && head[1] === 0x4b;
    if (!isZip) throw new Error('Not a valid EPUB file');
    return new Uint8Array(buf);
  };
  try {
    return { bytes: await tryFetch(url), fileName: '' };
  } catch {
    const proxied = `/api/epub-proxy?url=${encodeURIComponent(url)}`;
    return { bytes: await tryFetch(proxied), fileName: '' };
  }
}
