const DB_NAME = 'squidcloud-video-stream';
const DB_VERSION = 1;
const META_STORE = 'file-meta';
const URL_STORE = 'download-urls';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
      if (!db.objectStoreNames.contains(URL_STORE)) db.createObjectStore(URL_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface CachedFileMeta {
  fileId: string;
  fileSize: number;
  fileType: string;
  encryptionKey: string;
  chunks: Array<{ index: number; repo: string; path: string; accountId?: number }>;
  chunkSize: number;
  ts: number;
}

export async function cacheFileMeta(meta: CachedFileMeta): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(META_STORE, 'readwrite');
  tx.objectStore(META_STORE).put(meta, meta.fileId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getCachedFileMeta(fileId: string): Promise<CachedFileMeta | null> {
  const db = await openDB();
  const tx = db.transaction(META_STORE, 'readonly');
  const req = tx.objectStore(META_STORE).get(fileId);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function cacheDownloadUrls(fileId: string, urls: Map<number, string>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(URL_STORE, 'readwrite');
  const obj: Record<number, string> = {};
  urls.forEach((v, k) => { obj[k] = v; });
  tx.objectStore(URL_STORE).put(obj, fileId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getCachedDownloadUrls(fileId: string): Promise<Record<number, string> | null> {
  const db = await openDB();
  const tx = db.transaction(URL_STORE, 'readonly');
  const req = tx.objectStore(URL_STORE).get(fileId);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
