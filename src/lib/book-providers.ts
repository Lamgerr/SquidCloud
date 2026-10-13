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

/* Direct-first fetch: the same-origin edge proxy runs on datacenter IPs
   that archive.org and gutendex throttle/block (edge 400s and timeouts),
   while all three providers send `Access-Control-Allow-Origin: *` to real
   browsers. So try the upstream URL straight from the browser first and
   only fall back to the edge proxy when direct fails. */
async function fetchUpstream(url: string, timeoutMs: number): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: UA, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

function proxyUrl(url: string): string {
  return `/api/gutendex-proxy?url=${encodeURIComponent(url)}`;
}

export async function getJson(url: string, timeoutMs = 12000): Promise<any> {
  let directErr: any = null;
  try {
    const res = await fetchUpstream(url, timeoutMs);
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from provider (HTTP ${res.status})`);
    }
  } catch (e: any) {
    directErr = e;
    // CORS / network / abort errors have no status — retry via edge proxy.
    // HTTP errors from the provider itself are still worth one proxy retry
    // (the proxy normalises them to JSON { error }).
  }
  try {
    const res = await fetchUpstream(proxyUrl(url), timeoutMs);
    const text = await res.text();
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const json = JSON.parse(text);
        if (json?.error) msg = json.error;
      } catch { /* not JSON */ }
      throw new Error(msg);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from provider (HTTP ${res.status})`);
    }
  } catch (e: any) {
    // Prefer the proxy's message when it actually reached a provider
    // (it normalises upstream failures to JSON { error }); otherwise
    // surface the direct failure.
    const proxyNetworkFail = e instanceof TypeError || e?.name === 'AbortError';
    if (proxyNetworkFail && directErr) throw directErr;
    throw e;
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
  /* getJson tries the upstream URL straight from the browser first
     (providers allow CORS) and falls back to the same-origin proxy. */
  const data = await getJson(`https://gutendex.com/books/?${p.toString()}`);
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
  const data = await getJson(`https://openlibrary.org/search.json?${p.toString()}`);
  const docs = data.docs || [];
  /* Free-only: Open Library marks scans as public / borrowable / no_ebook /
     printdisabled. Borrow-only and rental scans are dropped here so the
     catalog never lists books SquidCloud cannot hand you as a download. */
  const books: ProviderBook[] = [];
  for (const d of docs) {
    const access = d.ebook_access;
    if (access === 'borrowable' || access === 'printdisabled' || access === 'no_ebook') continue;
    const key: string = d.key || '';
    const iaId: string | null = Array.isArray(d.ia) ? d.ia[0] : (typeof d.ia === 'string' ? d.ia : null);
    books.push({
      key: `ol:${key}`,
      source: 'openlibrary' as BookSource,
      sourceId: key,
      title: d.title || 'Untitled',
      authors: (d.author_name || []).slice(0, 3),
      subjects: (d.subject || []).slice(0, 8),
      coverUrl: d.cover_i
        ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`
        : iaId
          ? `https://archive.org/services/img/${iaId}`
          : null,
      popularity: (d.ratings_count || 0) * 10 + (access === 'public' ? 500 : 0),
      year: d.first_publish_year || null,
      epubUrl: null, // resolved on open via IA metadata
      iaId,
      olKey: key,
    });
  }
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
  const data = await getJson(`https://archive.org/advancedsearch.php?${p.toString()}`);
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

/* ── Free-only verification for Archive.org hits ──────────
   advancedsearch cannot tell borrow-only scans from free ones, so books
   from the archive provider are verified against the metadata API before
   they are shown: restricted/dark items and items with no free EPUB file
   are dropped. Verified books come back with their EPUB url attached, so
   opening and saving them needs no second lookup. Items that fail the
   check on network errors are kept (fail-open); the open-time resolve is
   the backstop. ─────────────────────────────────────────────────────── */

export async function verifyIaBooks(books: ProviderBook[], timeoutMs = 9000): Promise<ProviderBook[]> {
  const pending: number[] = [];
  books.forEach((b, i) => { if (b.source === 'archive' && b.iaId && !b.epubUrl) pending.push(i); });
  if (pending.length === 0) return books;
  const out = [...books];
  const drop = new Set<number>();
  const check = async (i: number) => {
    const b = books[i];
    try {
      const meta: any = await getJson(`https://archive.org/metadata/${encodeURIComponent(b.iaId!)}`, timeoutMs);
      if (meta?.access_restricted_item === true || meta?.is_dark === true) { drop.add(i); return; }
      const files: any[] = meta?.files || [];
      const epub = files.find(f => /\.epub$/i.test(f.name || '') && !/(_djvu|_text|_jp2|_pdf|_abbyy|_scandata|_lcp)/i.test(f.name || ''));
      if (epub) out[i] = { ...b, epubUrl: `https://archive.org/download/${b.iaId}/${encodeURIComponent(epub.name)}` };
      else drop.add(i);
    } catch {
      /* fail-open: keep the book, open-time resolve verdicts it */
    }
  };
  const CONC = 6;
  for (let k = 0; k < pending.length; k += CONC) {
    await Promise.all(pending.slice(k, k + CONC).map(check));
  }
  return out.filter((_, i) => !drop.has(i));
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

/* Open Library works often carry no `ia` id on the search doc. The work's
   editions listing does (`ocaid`) — one lookup rescues those books. */
async function resolveOlIaId(olKey: string): Promise<string | null> {
  const data: any = await getJson(`https://openlibrary.org${olKey}/editions.json?limit=25`);
  const entries: any[] = data?.entries || [];
  const withScan = entries.find(e => typeof e?.ocaid === 'string' && e.ocaid);
  return withScan ? withScan.ocaid : null;
}

export async function resolveEpubUrl(book: ProviderBook): Promise<string> {
  if (book.epubUrl) return book.epubUrl;
  let iaId = book.iaId;
  if (!iaId && book.olKey) {
    try {
      iaId = await resolveOlIaId(book.olKey);
    } catch {
      iaId = null;
    }
  }
  if (iaId) {
    let meta: any;
    try {
      meta = await getJson(`https://archive.org/metadata/${encodeURIComponent(iaId)}`);
    } catch (e: any) {
      throw new Error(`Could not reach Archive.org: ${e?.message || 'network error'}`);
    }
    if (meta?.access_restricted_item === true || meta?.is_dark === true) {
      throw new Error('This scan is borrow-only on Archive.org — no free download exists.');
    }
    const files: any[] = meta?.files || [];
    const epub = files.find(f => /\.epub$/i.test(f.name || '') && !/(_djvu|_text|_jp2|_pdf|_abbyy|_scandata|_lcp)/i.test(f.name || ''));
    if (epub) return `https://archive.org/download/${iaId}/${encodeURIComponent(epub.name)}`;
    throw new Error('Archive.org has no free EPUB for this edition. Try another search result.');
  }
  if (book.olKey) {
    throw new Error('This edition is not freely downloadable. Try another search result.');
  }
  throw new Error('No downloadable edition found for this title.');
}

/* ── Download EPUB bytes (direct, then same-origin proxy) ─── */

export async function fetchEpubBytes(url: string): Promise<{ bytes: Uint8Array; fileName: string }> {
  const tryFetch = async (u: string): Promise<Uint8Array> => {
    const res = await fetch(u);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 5000) throw new Error('Downloaded file is too small to be a book.');
    const head = new Uint8Array(buf.slice(0, 4));
    const isZip = head[0] === 0x50 && head[1] === 0x4b; // PK magic
    if (!isZip) {
      // Might be an HTML error page — detect and give a clear message
      const text = new TextDecoder().decode(buf.slice(0, 200));
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error('Could not download this book — the source returned a web page instead. Try another edition.');
      }
      throw new Error('Downloaded file is not a valid EPUB (unexpected format).');
    }
    return new Uint8Array(buf);
  };
  try {
    return { bytes: await tryFetch(url), fileName: '' };
  } catch (e: any) {
    // Retry via same-origin proxy
    try {
      const proxied = `/api/epub-proxy?url=${encodeURIComponent(url)}`;
      return { bytes: await tryFetch(proxied), fileName: '' };
    } catch {
      // Surface the original error, not the proxy error
      throw new Error(e?.message || 'Could not download this book. Check your connection and try again.');
    }
  }
}
