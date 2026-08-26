import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { downloadFile } from '@/lib/api';
import { emitWebhookEvent } from '@/lib/webhook-events';
import {
  checkPublishStatus,
  createPublication,
  listMyPublications,
  unpublishSite,
  toggleSiteVisibility,
  updatePublication,
  type SitePublication,
} from '@/lib/api';

const SITES_BUCKET = 'squid-sites';

const PUBLISH_STEP_TIMEOUT_MS = 120_000;

const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)),
      ms,
    );
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });

const MIME_MAP: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  mjs: 'application/javascript',
  json: 'application/json',
  xml: 'application/xml',
  txt: 'text/plain',
  md: 'text/markdown',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  pdf: 'application/pdf',
  wasm: 'application/wasm',
};

function getMimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return MIME_MAP[ext] || 'application/octet-stream';
}

export interface PublishProgress {
  current: number;
  total: number;
  stage: string;
  percent: number;
}

interface PublishFile {
  name: string;
  path: string;
  data: Blob;
}

export function usePublishState(resourceId: string | null) {
  const [publication, setPublication] = useState<SitePublication | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!resourceId) return;
    setLoading(true);
    setError(null);
    try {
      const pub = await checkPublishStatus(resourceId);
      setPublication(pub);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [resourceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { publication, loading, error, refresh, setPublication };
}

export function usePublish() {
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const uploadFileToSite = useCallback(async (
    slug: string,
    filePath: string,
    blob: Blob,
  ) => {
    const fileName = filePath.split('/').pop() || filePath;
    const contentType = getMimeFromName(fileName);
    const { error: uploadError } = await supabase.storage
      .from(SITES_BUCKET)
      .upload(`${slug}/${filePath}`, blob, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw new Error(uploadError.message);
  }, []);

  const removeOldFiles = useCallback(async (slug: string, keepPaths: string[]) => {
    const { data: existing } = await supabase.storage
      .from(SITES_BUCKET)
      .list(slug, { limit: 1000 });

    if (existing && existing.length > 0) {
      const toRemove = existing
        .map(f => `${slug}/${f.name}`)
        .filter(p => !keepPaths.includes(p));

      if (toRemove.length > 0) {
        await supabase.storage.from(SITES_BUCKET).remove(toRemove);
      }
    }
  }, []);

  const publishSingleFile = useCallback(async (
    fileId: string,
    slug: string,
    onProgress?: (p: PublishProgress) => void,
  ): Promise<{ fileCount: number; totalBytes: number }> => {
    onProgress?.({ current: 0, total: 1, stage: 'Downloading file', percent: 10 });

    const blob = await withTimeout(
      downloadFile(fileId, (progress, stage) => {
        onProgress?.({ current: 0, total: 1, stage: stage || 'Downloading', percent: Math.round(progress / 2) });
      }),
      PUBLISH_STEP_TIMEOUT_MS,
      'Downloading file',
    );

    onProgress?.({ current: 0, total: 1, stage: 'Uploading to site', percent: 60 });

    await withTimeout(
      uploadFileToSite(slug, 'index.html', blob),
      PUBLISH_STEP_TIMEOUT_MS,
      'Uploading to site',
    );

    onProgress?.({ current: 1, total: 1, stage: 'Complete', percent: 100 });
    return { fileCount: 1, totalBytes: blob.size };
  }, [uploadFileToSite]);

  const publishFolder = useCallback(async (
    folderId: string,
    slug: string,
    onProgress?: (p: PublishProgress) => void,
  ): Promise<{ fileCount: number; totalBytes: number }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: files } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', user.id);

    const { data: allFolders } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', user.id);

    // Build folder hierarchy: find all descendant folders of folderId
    const folderMap = new Map<string, { id: string; name: string; parent_folder: string | null }>();
    (allFolders || []).forEach((f: any) => folderMap.set(f.id, f));

    const descendantFolders: { id: string; relativePath: string }[] = [];
    const folderPathMap = new Map<string, string>();

    // Compute relative path for each folder from root folderId
    function computePath(fId: string, rootId: string): string | null {
      if (fId === rootId) return '';
      const cached = folderPathMap.get(fId);
      if (cached !== undefined) return cached;

      const f = folderMap.get(fId);
      if (!f) return null;
      if (!f.parent_folder) return null;

      const parentPath = computePath(f.parent_folder, rootId);
      if (parentPath === null) return null;

      const fullPath = parentPath ? `${parentPath}/${f.name}` : f.name;
      folderPathMap.set(fId, fullPath);
      return fullPath;
    }

    // Collect all descendant folders (including the root)
    const scanFolders = (parentId: string, rootId: string) => {
      (allFolders || []).forEach((f: any) => {
        if (f.parent_folder === parentId) {
          const relPath = computePath(f.id, rootId);
          if (relPath !== null) {
            descendantFolders.push({ id: f.id, relativePath: relPath });
            scanFolders(f.id, rootId);
          }
        }
      });
    };

    // Start scanning from folderId to find subfolders
    scanFolders(folderId, folderId);

    // Collect all relevant folder IDs (root + descendants)
    const relevantFolderIds = new Set([folderId, ...descendantFolders.map(f => f.id)]);

    // Build path lookup for each folder ID
    descendantFolders.forEach(f => folderPathMap.set(f.id, f.relativePath));

    // Filter files in root folder or any descendant folder
    const folderFiles = (files || []).filter((f: any) =>
      relevantFolderIds.has(f.parent_folder)
    );

    if (folderFiles.length === 0) throw new Error('No files found in folder');

    let totalBytes = 0;
    let completed = 0;

    for (const file of folderFiles) {
      onProgress?.({
        current: completed,
        total: folderFiles.length,
        stage: `Downloading ${file.name}`,
        percent: Math.round((completed / folderFiles.length) * 50),
      });

      const blob = await withTimeout(
        downloadFile(file.id),
        PUBLISH_STEP_TIMEOUT_MS,
        `Downloading ${file.name}`,
      );

      const folderRelPath = folderPathMap.get(file.parent_folder) || '';
      const uploadPath = folderRelPath ? `${folderRelPath}/${file.name}` : file.name;

      onProgress?.({
        current: completed,
        total: folderFiles.length,
        stage: `Uploading ${file.name}`,
        percent: 50 + Math.round((completed / folderFiles.length) * 50),
      });

      await withTimeout(
        uploadFileToSite(slug, uploadPath, blob),
        PUBLISH_STEP_TIMEOUT_MS,
        `Uploading ${file.name}`,
      );
      totalBytes += blob.size;
      completed++;
    }

    onProgress?.({ current: completed, total: folderFiles.length, stage: 'Complete', percent: 100 });
    return { fileCount: folderFiles.length, totalBytes };
  }, [uploadFileToSite]);

  const doPublish = useCallback(async (params: {
    resourceId: string;
    resourceType: 'file' | 'folder';
    siteName?: string;
    visibility?: 'public' | 'private';
    onProgress?: (p: PublishProgress) => void;
  }): Promise<{ publication: SitePublication; slug: string; url: string }> => {
    setError(null);
    setLoading(true);
    setProgress({ current: 0, total: 1, stage: 'Creating publication', percent: 0 });

    try {
      const { siteSlug, siteUrl } = await createPublication({
        resourceId: params.resourceId,
        resourceType: params.resourceType,
        siteName: params.siteName,
        visibility: params.visibility,
        fileCount: 0,
        totalSizeBytes: 0,
      });

      let stats: { fileCount: number; totalBytes: number };

      const forwardProgress = (p: PublishProgress) => {
        setProgress(p);
        params.onProgress?.(p);
      };

      if (params.resourceType === 'file') {
        stats = await publishSingleFile(params.resourceId, siteSlug, forwardProgress);
      } else {
        stats = await publishFolder(params.resourceId, siteSlug, forwardProgress);
      }

      const publication = await updatePublication(siteSlug, {
        fileCount: stats.fileCount,
        totalSizeBytes: stats.totalBytes,
      });

      void emitWebhookEvent('site.published', {
        site_id: publication.id,
        site_name: siteSlug,
        url: siteUrl,
        file_count: stats.fileCount,
        published_at: new Date().toISOString(),
      });

      setProgress(null);
      setLoading(false);
      return { publication, slug: siteSlug, url: siteUrl };
    } catch (e: any) {
      setError(e.message);
      setProgress(null);
      setLoading(false);
      throw e;
    }
  }, [publishSingleFile, publishFolder]);

  const doRepublish = useCallback(async (slug: string, params: {
    resourceId: string;
    resourceType: 'file' | 'folder';
    onProgress?: (p: PublishProgress) => void;
  }): Promise<SitePublication> => {
    setError(null);
    setLoading(true);
    setProgress({ current: 0, total: 1, stage: 'Re-publishing', percent: 0 });

    try {
      let stats: { fileCount: number; totalBytes: number };

      const forwardProgress = (p: PublishProgress) => {
        setProgress(p);
        params.onProgress?.(p);
      };

      if (params.resourceType === 'file') {
        stats = await publishSingleFile(params.resourceId, slug, forwardProgress);
      } else {
        stats = await publishFolder(params.resourceId, slug, forwardProgress);
      }

      const publication = await updatePublication(slug, {
        fileCount: stats.fileCount,
        totalSizeBytes: stats.totalBytes,
      });

      void emitWebhookEvent('site.redeployed', {
        site_id: publication.id,
        site_name: slug,
        file_count: stats.fileCount,
        redeployed_at: new Date().toISOString(),
      });

      setProgress(null);
      setLoading(false);
      return publication;
    } catch (e: any) {
      setError(e.message);
      setProgress(null);
      setLoading(false);
      throw e;
    }
  }, [publishSingleFile, publishFolder]);

  const doUnpublish = useCallback(async (slug: string) => {
    setError(null);
    setLoading(true);
    try {
      await unpublishSite(slug);
      setLoading(false);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
      throw e;
    }
  }, []);

  const doToggleVisibility = useCallback(async (slug: string, visibility: 'public' | 'private') => {
    setLoading(true);
    setError(null);
    try {
      const pub = await toggleSiteVisibility(slug, visibility);
      setLoading(false);
      return pub;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
      throw e;
    }
  }, []);

  const fetchAll = useCallback(async (): Promise<SitePublication[]> => {
    return listMyPublications();
  }, []);

  return {
    progress,
    error,
    loading,
    doPublish,
    doRepublish,
    doUnpublish,
    doToggleVisibility,
    fetchAll,
  };
}
