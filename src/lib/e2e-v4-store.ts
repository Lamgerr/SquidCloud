/** Persist only non-secret v4 metadata; keys stay in memory. */
import { supabase } from '@/integrations/supabase/client';

export async function saveV4Meta(fileId: string, userId: string, saltB64: string): Promise<void> {
  const { error } = await supabase.from('zk_files').insert({
    file_id: fileId,
    user_id: userId,
    file_salt: saltB64,
    iv: null,
    version: 4,
  });
  if (error) throw error;
}

export async function getV4Meta(fileId: string, userId: string): Promise<{ saltB64: string } | null> {
  const { data } = await supabase.from('zk_files')
    .select('file_salt').eq('file_id', fileId).eq('user_id', userId).eq('version', 4).maybeSingle();
  return data?.file_salt ? { saltB64: data.file_salt } : null;
}
