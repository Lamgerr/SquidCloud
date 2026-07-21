export const EBOOK_EXTENSIONS = [
  '.epub', '.pdf', '.mobi', '.azw3', '.azw', '.fb2', '.fb2.zip',
  '.cbz', '.cbr', '.cb7', '.cbt', '.djvu', '.oxps', '.xps',
];

export const EBOOK_MIMES = [
  'application/epub+zip',
  'application/pdf',
  'application/x-mobipocket-ebook',
  'application/vnd.amazon.mobi8-ebook',
  'application/x-fictionbook+xml',
  'application/x-cbz',
  'application/x-cbr',
  'application/x-cb7',
  'application/x-cbt',
  'image/vnd.djvu',
  'application/oxps',
  'application/vnd.ms-xpsdocument',
];

export const READER_SUPPORTED = [
  '.epub', '.pdf',
];

export function isEbookFile(name: string, type: string): boolean {
  const ext = '.' + name.split('.').pop()?.toLowerCase();
  if (EBOOK_EXTENSIONS.includes(ext)) return true;
  if (EBOOK_MIMES.includes(type)) return true;
  return false;
}

export function isReaderSupported(name: string, type: string): boolean {
  const ext = '.' + name.split('.').pop()?.toLowerCase();
  if (READER_SUPPORTED.includes(ext)) return true;
  if (type === 'application/epub+zip' || type === 'application/pdf') return true;
  return false;
}

export function getEbookFormatLabel(name: string): string {
  const ext = name.split('.').pop()?.toUpperCase() || 'BOOK';
  const map: Record<string, string> = {
    EPUB: 'EPUB',
    PDF: 'PDF',
    MOBI: 'MOBI',
    AZW3: 'AZW3',
    AZW: 'AZW',
    FB2: 'FB2',
    CBZ: 'CBZ',
    CBR: 'CBR',
    DJVU: 'DJVU',
    OXPS: 'OXPS',
    XPS: 'XPS',
  };
  return map[ext] || 'BOOK';
}

export function guessBookTitle(name: string): string {
  return name
    .replace(/\.(epub|pdf|mobi|azw3|azw|fb2|cbz|cbr|djvu)$/i, '')
    .replace(/[_-]/g, ' ')
    .trim();
}

export function getFileSizeLabel(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export async function fetchBookBlob(fileId: string): Promise<Blob> {
  const { downloadFileWithRes54 } = await import('@/lib/res54');
  return downloadFileWithRes54(fileId, { reason: 'read', fileName: '' });
}

export function createBookCoverUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function guessBookAuthor(_name: string): string | null {
  return null;
}

export const EBOOK_UPLOAD_ACCEPT = '.epub,.pdf,.mobi,.azw3,.azw,.fb2,.cbz,.cbr,.djvu';

export function isValidBookFormat(name: string): boolean {
  return isEbookFile(name, '');
}
