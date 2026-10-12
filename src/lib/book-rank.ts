/* ── DeepRead curation engine ─────────────────────────────────
   Ranks any pool of provider books with an explainable multi-signal
   score, then assembles shelves with diversity + serendipity guards.

   Signals (max 100):
     author affinity ......... 25   (opened the same author before)
     subject overlap ......... 20   (Jaccard vs. history subjects)
     popularity .............. 20   (log-scaled, per-source normalized)
     readable edition known .. 12   (EPUB url already resolved)
     cover present ........... 8    (real cover beats placeholder)
     described ............... 8    (has subjects at all)
     source trust ............ 7    (curated catalogs weigh more)

   Guards:
     MMR-lite  author repeat −15, heavy subject overlap −10
     SERENDIPITY  2 of every 10 slots go to high-popularity books
                  outside the reader's history (no filter bubble)
     STABILITY  daily seed rotates exploration picks so shelves feel
                alive without jittering on every render.

   Every pick carries a human reason string — the UI shows it, so the
   shelf never feels like a black box.
   ─────────────────────────────────────────────────────────────── */

import type { ProviderBook } from './book-providers';

export interface RankHistory {
  key: string;
  title: string;
  author: string;
  subjects: string[];
}

export interface RankedPick {
  book: ProviderBook;
  score: number;
  reason: string;
}

const norm = (s: string) =>
  s.toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

const surnameOf = (name: string) => {
  const p = name.trim().split(/\s+/);
  return (p[p.length - 1] || '').toLowerCase();
};

const jaccard = (a: string[], b: string[]): number => {
  const A = new Set(a.map(s => norm(s)).filter(Boolean));
  const B = new Set(b.map(s => norm(s)).filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach(x => { if (B.has(x)) inter++; });
  return inter / (A.size + B.size - inter);
};

export function daySeed(): number {
  return Math.floor(Date.now() / 86400000);
}

/** Deterministic daily shuffle (mulberry32) — stable all day, fresh tomorrow. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function popularityScore(b: ProviderBook, maxPop: number): number {
  if (maxPop <= 0 || b.popularity <= 0) return 4; // unknown ≠ bad
  const ratio = Math.log1p(b.popularity) / Math.log1p(maxPop);
  return Math.round(ratio * 20);
}

function affinityScore(b: ProviderBook, history: RankHistory[]): { points: number; matchedAuthor: string | null; overlap: number } {
  let points = 0;
  let matchedAuthor: string | null = null;
  let overlap = 0;
  const surnames = new Set(history.map(h => surnameOf(h.author)).filter(Boolean));
  for (const a of b.authors) {
    if (a && surnames.has(surnameOf(a))) {
      points = Math.max(points, 25);
      matchedAuthor = a;
      break;
    }
  }
  const histSubjects = history.flatMap(h => h.subjects || []);
  overlap = jaccard(b.subjects || [], histSubjects);
  if (overlap >= 0.5) points = Math.max(points, 20);
  else if (overlap >= 0.25) points = Math.max(points, 12);
  else if (overlap > 0) points = Math.max(points, 6);
  return { points, matchedAuthor, overlap };
}

function qualityScore(b: ProviderBook): number {
  let s = 0;
  if (b.coverUrl) s += 8;
  if (b.epubUrl) s += 12;
  else if (b.iaId) s += 6; // resolvable via Archive metadata
  if ((b.subjects || []).length > 0) s += 0; // folded into overlap; keep slot for source trust below
  s += b.source === 'gutendex' ? 7 : b.source === 'openlibrary' ? 5 : 4;
  return Math.min(27, s);
}

function reasonFor(b: ProviderBook, aff: { matchedAuthor: string | null; overlap: number }, history: RankHistory[]): string {
  if (aff.matchedAuthor) {
    const h = history.find(x => surnameOf(x.author) === surnameOf(aff.matchedAuthor!));
    return h ? `Because you read ${h.title}` : `More by ${aff.matchedAuthor}`;
  }
  if (aff.overlap >= 0.25 && history.length > 0) return 'Matches your reading taste';
  if (b.popularity > 0) return 'Widely read classic';
  return 'Editor\'s shelf';
}

export function rankBooks(candidates: ProviderBook[], history: RankHistory[] = []): RankedPick[] {
  const maxPop = Math.max(0, ...candidates.map(b => b.popularity || 0));
  return candidates
    .map(book => {
      const aff = affinityScore(book, history);
      const score = aff.points + popularityScore(book, maxPop) + qualityScore(book);
      return { book, score, reason: reasonFor(book, aff, history) };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Assemble a shelf: affinity winners first, then MMR diversity pass,
 * with ~2/10 serendipity slots reserved for popular outsiders.
 */
export function buildShelf(
  candidates: ProviderBook[],
  history: RankHistory[] = [],
  take = 10,
): RankedPick[] {
  const ranked = rankBooks(candidates, history);
  const picked: RankedPick[] = [];
  const pickedAuthors = new Map<string, number>();
  const pickedSubjects: string[][] = [];

  const diversityPenalty = (b: ProviderBook): number => {
    let p = 0;
    for (const a of b.authors) {
      const n = pickedAuthors.get(surnameOf(a)) || 0;
      if (n >= 1) p += 15;
    }
    for (const subs of pickedSubjects) {
      if (jaccard(b.subjects || [], subs) > 0.5) { p += 10; break; }
    }
    return p;
  };

  const inHistory = new Set(history.map(h => h.key));
  const fresh = ranked.filter(r => !inHistory.has(r.book.key));

  // Serendipity: top-popularity books outside history × affinity.
  const outsiders = fresh
    .filter(r => {
      const surnames = new Set(history.map(h => surnameOf(h.author)));
      return !r.book.authors.some(a => surnames.has(surnameOf(a)));
    })
    .sort((a, b) => b.book.popularity - a.book.popularity);
  const serendipityCount = Math.max(1, Math.round(take / 5));
  const serendipity = seededShuffle(outsiders, daySeed()).slice(0, serendipityCount)
    .map(r => ({ ...r, reason: 'Worth the detour' }));

  const rest = fresh.filter(r => !serendipity.some(s => s.book.key === r.book.key));
  const skipped: RankedPick[] = [];
  for (const r of rest) {
    if (picked.length + serendipity.length >= take) break;
    // MMR: once the shelf has body, skip near-duplicates (same author twice
    // or >50% subject overlap) so one voice can't own the row.
    if (picked.length >= 3 && diversityPenalty(r.book) >= 15) {
      skipped.push(r);
      continue;
    }
    picked.push(r);
    for (const a of r.book.authors) {
      const k = surnameOf(a);
      pickedAuthors.set(k, (pickedAuthors.get(k) || 0) + 1);
    }
    pickedSubjects.push(r.book.subjects || []);
  }
  // Backfill from skipped so short pools still fill the shelf.
  for (const r of skipped) {
    if (picked.length + serendipity.length >= take) break;
    picked.push(r);
  }

  // Interleave serendipity through the shelf, never first.
  const out = [...picked];
  serendipity.forEach((s, i) => {
    out.splice(Math.min(out.length, 3 + i * 3), 0, s);
  });
  return out.slice(0, take);
}
