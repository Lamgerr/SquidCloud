import { supabase } from '@/integrations/supabase/client';

export interface Suggestion {
  title: string;
  author: string;
  coverUrl: string;
  source: 'open-library' | 'gutendex';
  url?: string;
  reason?: string;
}

function extractKeywords(titles: string[]): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'of', 'in', 'to', 'and', 'or', 'for', 'with',
    'on', 'at', 'by', 'from', 'is', 'it', 'as', 'be', 'this', 'that',
    'vol', 'volume', 'book', 'part', 'edition',
  ]);
  const words = new Map<string, number>();
  for (const title of titles) {
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
      .forEach(w => words.set(w, (words.get(w) || 0) + 1));
  }
  return [...words.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);
}

let keywordCache: string[] | null = null;

async function getUserKeywords(): Promise<string[]> {
  if (keywordCache) return keywordCache;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: books } = await supabase
    .from('book_metadata')
    .select('extracted_title')
    .eq('user_id', user.id);

  const { data: progress } = await supabase
    .from('reading_progress')
    .select('file_id')
    .eq('user_id', user.id)
    .gt('progress', 10);

  const readFileIds = new Set((progress || []).map(p => p.file_id));

  const { data: files } = await supabase
    .from('files')
    .select('name')
    .in('id', [...readFileIds]);

  const titles: string[] = [];
  if (books) {
    for (const b of books) {
      if (b.extracted_title) titles.push(b.extracted_title);
    }
  }
  if (files) {
    for (const f of files) {
      const name = f.name.replace(/\.(epub|pdf|mobi)$/i, '').replace(/[_-]/g, ' ');
      if (name) titles.push(name);
    }
  }

  keywordCache = extractKeywords(titles);
  return keywordCache;
}

export function clearSuggestionCache() {
  keywordCache = null;
}

export async function getSuggestions(): Promise<Suggestion[]> {
  const keywords = await getUserKeywords();
  if (keywords.length === 0) {
    return getDefaultSuggestions();
  }

  const [openLib, gutendex] = await Promise.all([
    searchOpenLibrary(keywords.join(' ')),
    searchGutendex(keywords[0]),
  ]);

  const seen = new Set<string>();
  const all: Suggestion[] = [];
  for (const s of [...openLib, ...gutendex]) {
    const key = s.title.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      all.push(s);
    }
  }
  return all.slice(0, 12);
}

async function searchOpenLibrary(query: string): Promise<Suggestion[]> {
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10&sort=new`
    );
    const data = await res.json();
    return (data.docs || []).slice(0, 8).map((d: any) => ({
      title: d.title || 'Unknown',
      author: d.author_name?.[0] || 'Unknown Author',
      coverUrl: d.cover_i
        ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`
        : `https://placehold.co/200x300/121212/666?text=${encodeURIComponent((d.title || '?').slice(0, 2))}`,
      source: 'open-library' as const,
      url: d.key ? `https://openlibrary.org${d.key}` : undefined,
      reason: 'Recommended for you',
    }));
  } catch {
    return [];
  }
}

async function searchGutendex(query: string): Promise<Suggestion[]> {
  try {
    const res = await fetch(
      `https://gutendex.com/books/?search=${encodeURIComponent(query)}&sort=popular`
    );
    const data = await res.json();
    return (data.results || []).slice(0, 6).map((d: any) => ({
      title: d.title || 'Unknown',
      author: d.authors?.[0]?.name || 'Unknown Author',
      coverUrl: d.formats?.['image/jpeg'] || `https://placehold.co/200x300/121212/666?text=${encodeURIComponent((d.title || '?').slice(0, 2))}`,
      source: 'gutendex' as const,
      url: d.formats?.['text/html'] || d.formats?.['application/epub+zip'],
      reason: 'Popular in your interests',
    }));
  } catch {
    return [];
  }
}

async function getDefaultSuggestions(): Promise<Suggestion[]> {
  try {
    const res = await fetch('https://gutendex.com/books/?sort=popular&limit=12');
    const data = await res.json();
    return (data.results || []).slice(0, 12).map((d: any) => ({
      title: d.title || 'Unknown',
      author: d.authors?.[0]?.name || 'Unknown Author',
      coverUrl: d.formats?.['image/jpeg'] || `https://placehold.co/200x300/121212/666?text=${encodeURIComponent((d.title || '?').slice(0, 2))}`,
      source: 'gutendex' as const,
      url: d.formats?.['text/html'],
      reason: 'Trending',
    }));
  } catch {
    return [];
  }
}
