/** Opt-in per-file migration from legacy ciphertext to chunked E2E v4.
 *  The original file id is preserved; only its chunk pointers and key label
 *  are repointed at newly encrypted chunks. Nothing is deleted until the new
 *  ciphertext has been stored and the metadata update succeeds. */
import { supabase } from '@/integrations/supabase/client';
import { downloadFileWithRes54, uploadFileWithRes54 } from './res54';
import { prepareV4Upload } from './e2e-v4-upload';
import { saveV4Meta } from './e2e-v4-store';

export async function upgradeFileToV4(
  file: { id: string; name: string; type?: string },
  userId: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const plain = await downloadFileWithRes54(file.id, (pct) => onProgress?.(Math.round(pct * 0.45)));
  const prepared = await prepareV4Upload(
    new File([plain], file.name, { type: file.type || 'application/octet-stream' }),
    userId,
  );
  if (!prepared) throw new Error('Unlock your vault before upgrading files');
  onProgress?.(50);

  const created = await uploadFileWithRes54(
    prepared.file,
    (pct) => onProgress?.(50 + Math.round(pct * 0.4)),
    undefined,
    true,
    prepared.meta,
  );

  const { data: newRow, error: readError } = await supabase.from('files')
    .select('tags, encryption_key, storage_path, encrypted_size')
    .eq('id', created.id).single();
  if (readError || !newRow) throw new Error('Could not read the upgraded file metadata');

  const { error: updateError } = await supabase.from('files').update({
    tags: newRow.tags,
    encryption_key: newRow.encryption_key,
    storage_path: newRow.storage_path,
    encrypted_size: newRow.encrypted_size,
  }).eq('id', file.id);
  if (updateError) throw updateError;

  await saveV4Meta(file.id, userId, prepared.meta.saltB64);
  await supabase.from('files').delete().eq('id', created.id);
  onProgress?.(100);
}
