import { supabase } from '@/integrations/supabase/client';
import type { FileItem as FileItemType } from '@/lib/api';

const COVERS_BUCKET = 'book-covers';

function getCoverPath(userId: string, fileId: string): string {
  return `${userId}/${fileId}.webp`;
}

export function getCoverPublicUrl(userId: string, fileId: string): string {
  const { data } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(getCoverPath(userId, fileId));
  return data.publicUrl;
}

export async function saveReadingProgress(
  fileId: string,
  progress: number,
  currentPage: number,
  totalPages: number
): Promise<void> {
  await supabase.rpc('save_reading_progress', {
    p_file_id: fileId,
    p_progress: Math.round(progress),
    p_current_page: currentPage,
    p_total_pages: totalPages,
  });
}

export interface ReadingProgress {
  progress: number;
  current_page: number;
  total_pages: number;
  last_read_at: string;
}

export async function loadReadingProgress(
  fileId: string
): Promise<ReadingProgress | null> {
  const { data } = await supabase.rpc('get_reading_progress', {
    p_file_id: fileId,
  });
  if (data && data.length > 0) return data[0] as ReadingProgress;
  return null;
}

export interface RemoteProgress {
  progress: number;
  current_page: number;
  total_pages: number;
  last_read_at: string;
}

export async function saveRemoteProgress(
  bookKey: string,
  progress: number,
  currentPage: number,
  totalPages: number,
  meta?: { title?: string; author?: string; coverUrl?: string | null; subjects?: string[] },
): Promise<void> {
  await supabase.rpc('save_remote_progress', {
    p_book_key: bookKey,
    p_progress: Math.max(0, Math.min(100, Math.round(progress))),
    p_current_page: currentPage,
    p_total_pages: totalPages,
    p_title: meta?.title ?? null,
    p_author: meta?.author ?? null,
    p_cover_url: meta?.coverUrl ?? null,
    p_subjects: meta?.subjects ?? null,
  });
}

export async function loadRemoteProgress(bookKey: string): Promise<RemoteProgress | null> {
  const { data } = await supabase.rpc('get_remote_progress', { p_book_key: bookKey });
  if (data && data.length > 0) return data[0] as RemoteProgress;
  return null;
}

export interface BookMetadata {
  id: string;
  file_id: string;
  cover_storage_path: string | null;
  extracted_title: string | null;
  extracted_author: string | null;
  created_at: string;
  updated_at: string;
}

export async function saveBookMetadata(
  fileId: string,
  coverStoragePath?: string | null,
  title?: string | null,
  author?: string | null
): Promise<void> {
  await supabase.rpc('save_book_metadata', {
    p_file_id: fileId,
    p_cover_storage_path: coverStoragePath ?? null,
    p_extracted_title: title ?? null,
    p_extracted_author: author ?? null,
  });
}

export async function getBookMetadata(fileId: string): Promise<BookMetadata | null> {
  const { data } = await supabase.rpc('get_book_metadata', {
    p_file_id: fileId,
  });
  if (data && data.length > 0) return data[0] as BookMetadata;
  return null;
}

export async function uploadCover(
  userId: string,
  fileId: string,
  coverBlob: Blob
): Promise<string> {
  const path = getCoverPath(userId, fileId);
  await supabase.storage.from(COVERS_BUCKET).upload(path, coverBlob, {
    contentType: 'image/webp',
    upsert: true,
  });
  return path;
}

export async function extractCoverFromEpub(blob: Blob): Promise<Blob | null> {
  try {
    const buffer = await blob.arrayBuffer();
    const EpubJS = (await import('epubjs')).default;
    const book = EpubJS(buffer);
    await book.ready;
    const coverUrl = await book.coverUrl();
    book.destroy();
    if (!coverUrl) return null;
    const resp = await fetch(coverUrl);
    const coverBlob = await resp.blob();
    return coverBlob;
  } catch {
    return null;
  }
}

export async function extractCoverFromPdf(blob: Blob): Promise<Blob | null> {
  try {
    const buffer = await blob.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 500 / page.getViewport({ scale: 1 }).width });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width;
    canvas.height = vp.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { pdf.destroy(); return null; }
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    pdf.destroy();
    return new Promise<Blob | null>(resolve => canvas.toBlob(b => resolve(b), 'image/webp', 0.85));
  } catch {
    return null;
  }
}

export async function extractCover(
  file: FileItemType,
  blob: Blob,
  userId: string,
): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  let coverBlob: Blob | null = null;

  if (ext === 'pdf') {
    coverBlob = await extractCoverFromPdf(blob);
  } else if (ext === 'epub') {
    coverBlob = await extractCoverFromEpub(blob);
  }

  if (!coverBlob) return null;

  const coverPath = await uploadCover(userId, file.id, coverBlob);
  await saveBookMetadata(file.id, coverPath, null, null);
  return coverPath;
}
