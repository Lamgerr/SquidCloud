import { supabase } from '@/integrations/supabase/client';

export interface SdeLocator {
  chunkIndex: number;
  substrateId: string;
  locatorB64: string;
}

/** Persist confirmed chunk placements (opaque locators only — no keys). */
export async function saveSdeLocators(fileId: string, userId: string, recs: SdeLocator[]): Promise<void> {
  if (!recs.length) return;
  const rows = recs.map(r => ({
    file_id: fileId,
    user_id: userId,
    chunk_index: r.chunkIndex,
    substrate: r.substrateId,
    locator: r.locatorB64,
  }));
  const { error } = await supabase.from('sde_chunk_locators').insert(rows as any);
  if (error) console.warn('[sde] locator persist failed:', error.message);
}

/** Load placements grouped for the brain's resolveLocator hook. */
export async function loadSdeLocators(fileId: string): Promise<Map<number, Array<{ substrateId: string; locatorB64: string }>>> {
  const out = new Map<number, Array<{ substrateId: string; locatorB64: string }>>();
  try {
    const { data, error } = await supabase
      .from('sde_chunk_locators')
      .select('chunk_index, substrate, locator')
      .eq('file_id', fileId)
      .order('chunk_index', { ascending: true });
    if (error || !data) return out;
    for (const r of data as any[]) {
      const list = out.get(r.chunk_index) || [];
      list.push({ substrateId: r.substrate, locatorB64: r.locator || '' });
      out.set(r.chunk_index, list);
    }
  } catch { /* reads fall back to deterministic routing */ }
  return out;
}
