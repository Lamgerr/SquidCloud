import { V4_KEY_LABEL } from './e2e-upload-policy';
import { supabase } from "@/integrations/supabase/client";
import { uploadFileWithRes54, downloadFileWithRes54, isRawStorageRow, downloadRawStorageObject } from "./res54";
import { decryptData, encryptData, generateEncryptionKey } from "./encryption";
import { buildPublicUrl } from "@/lib/appLinks";
import { createSecureFileRecord, fetchFileEncryptionKey } from "@/lib/secure-file-metadata";
import { emitWebhookEvent } from "@/lib/webhook-events";
import { zkEncryptForUpload, zkSaveMeta } from "./zk-mode";

const ACTIVE_WORKSPACE_STORAGE_KEY = 'squid_active_workspace_id';
const ACTIVE_PROVIDER_TYPE_STORAGE_KEY = 'squid_active_provider_type';
const ACTIVE_PROVIDER_ID_STORAGE_KEY = 'squid_active_provider_id';
const isProductionBuild = import.meta.env.PROD;

type ActiveProviderType = 'squidcloud' | 'r2' | 'tebi';

const TEBI_PROXY_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const TEBI_ENCRYPTED_CHUNK_SIZE = 2 * 1024 * 1024;

interface TebiEncryptedChunkMetadata {
  index: number;
  path: string;
  size: number;
  offset: number;
}

interface TebiEncryptedFileMetadata {
  format: 'tebi_encrypted_v1';
  fileName: string;
  fileType: string;
  fileSize: number;
  chunkSize: number;
  chunks: TebiEncryptedChunkMetadata[];
  // Stored as 'managed_key' when the actual key is kept server-side. Legacy files may omit this field.
  encryptionKey?: string;
  created: string;
}

const devLog = (...args: unknown[]) => {
  if (!isProductionBuild) {
    console.log(...args);
  }
};

export function getActiveWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
}

export function getActiveProviderType(): string {
  if (typeof window === 'undefined') return 'squidcloud';
  const providerType = localStorage.getItem(ACTIVE_PROVIDER_TYPE_STORAGE_KEY);
  return providerType || 'squidcloud';
}

export function getActiveProviderId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_PROVIDER_ID_STORAGE_KEY);
}

function applyProviderScope(query: any, providerType: string, providerId: string | null) {
  if (providerType === 'squidcloud') {
    return query.is('storage_provider_id', null);
  }

  if (providerId) {
    return query.eq('storage_provider_id', providerId);
  }

  // No configured provider id for selected external provider: return no rows.
  return query.eq('storage_provider_id', '00000000-0000-0000-0000-000000000000');
}

function buildExternalObjectKey(
  userId: string,
  workspaceId: string | null,
  folderPath: string,
  fileName: string,
): string {
  const safeFolder = (folderPath || '').replace(/^\/+|\/+$/g, '');
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const basePrefix = `${userId}/${workspaceId || 'default-workspace'}`;

  if (safeFolder) {
    return `${basePrefix}/${safeFolder}/${ts}_${rand}_${safeName}`;
  }

  return `${basePrefix}/${ts}_${rand}_${safeName}`;
}

function textToBase64Data(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

export interface SwkPass {
  token: string;
  manifestHash: string;
  totalSize: number;
}

async function signTebiObjectUpload(
  providerId: string,
  fileName: string,
  path: string,
  fileType: string,
  swk?: SwkPass
): Promise<string> {
  const { data: presignData, error: presignError } = await supabase.functions.invoke('api-file-upload-tebi', {
    body: {
      action: 'upload',
      fileName,
      fileType,
      path,
      providerId,
      ...(swk ? { swkToken: swk.token, swkManifestHash: swk.manifestHash, totalSize: swk.totalSize } : {}),
    },
  });

  if (presignError || !presignData?.success || !presignData?.uploadUrl) {
    throw new Error(presignError?.message || presignData?.error || 'Failed to prepare Tebi upload');
  }

  return presignData.uploadUrl as string;
}

async function uploadTebiPayloadWithFallback(
  providerId: string,
  objectPath: string,
  fileName: string,
  fileType: string,
  payload: string,
  onProgress?: (progress: number, stage?: string, details?: any) => void,
  swk?: SwkPass
): Promise<void> {
  const uploadUrl = await signTebiObjectUpload(providerId, fileName, objectPath, fileType, swk);

  try {
    const putResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': fileType },
      body: payload,
    });

    if (!putResponse.ok) {
      throw new Error(`Tebi upload failed (${putResponse.status})`);
    }
  } catch (directUploadError: any) {
    const payloadBytes = new TextEncoder().encode(payload).byteLength;
    if (payloadBytes > TEBI_PROXY_UPLOAD_MAX_BYTES) {
      throw new Error(
        `Direct Tebi upload failed and proxy fallback supports up to ${formatBytes(TEBI_PROXY_UPLOAD_MAX_BYTES)}. ` +
        `Please enable bucket CORS for larger files. Original error: ${directUploadError?.message || 'unknown error'}`
      );
    }

    onProgress?.(45, 'uploading', { provider: 'tebi', mode: 'proxy-fallback' });
    const { data: proxyData, error: proxyError } = await supabase.functions.invoke('api-file-upload-tebi', {
      body: {
        action: 'upload-proxy',
        fileName,
        fileType,
        path: objectPath,
        fileBase64: textToBase64Data(payload),
        providerId,
        ...(swk ? { swkToken: swk.token, swkManifestHash: swk.manifestHash, totalSize: swk.totalSize } : {}),
      },
    });

    if (proxyError || !proxyData?.success) {
      throw new Error(
        proxyError?.message ||
        proxyData?.error ||
        `Tebi upload failed: ${directUploadError?.message || 'direct upload failed and proxy fallback failed'}`
      );
    }
  }
}

async function uploadFileToTebi(
  file: File,
  folderPath: string,
  workspaceId: string | null,
  providerId: string,
  onProgress?: (progress: number, stage?: string, details?: any) => void
): Promise<FileItem> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  // S-Hawk metadata screening (plaintext-side, before encryption).
  onProgress?.(2, 'screening', { provider: 'tebi' });
  const { buildSwkManifest, swkScanManifest } = await import('./swk-manifest');
  const swkManifest = await buildSwkManifest(file);
  const swkVerdict = await swkScanManifest(swkManifest);
  const swk: SwkPass = { token: swkVerdict.token as string, manifestHash: swkVerdict.manifestHash, totalSize: file.size };

  onProgress?.(5, 'preparing', { provider: 'tebi' });
  const objectKey = buildExternalObjectKey(user.id, workspaceId, folderPath, file.name);

  const encryptionKey = generateEncryptionKey();
  const totalChunks = Math.max(1, Math.ceil(file.size / TEBI_ENCRYPTED_CHUNK_SIZE));
  const chunkMetadata: TebiEncryptedChunkMetadata[] = [];

  for (let index = 0; index < totalChunks; index++) {
    const start = index * TEBI_ENCRYPTED_CHUNK_SIZE;
    const end = Math.min(start + TEBI_ENCRYPTED_CHUNK_SIZE, file.size);
    const chunkBuffer = await file.slice(start, end).arrayBuffer();
    const encryptedChunk = await encryptData(chunkBuffer, encryptionKey);
    const chunkPath = `${objectKey}.chunks/${String(index).padStart(6, '0')}.enc`;

    onProgress?.(10 + ((index / totalChunks) * 70), 'encrypting', {
      provider: 'tebi',
      current: index + 1,
      total: totalChunks,
    });

    await uploadTebiPayloadWithFallback(
      providerId,
      chunkPath,
      `${file.name}.chunk.${index}.enc`,
      'text/plain',
      encryptedChunk,
      onProgress,
      swk,
    );

    chunkMetadata.push({
      index,
      path: chunkPath,
      size: end - start,
      offset: start,
    });
  }

  const encryptedMetadata: TebiEncryptedFileMetadata = {
    format: 'tebi_encrypted_v1',
    fileName: file.name,
    fileType: file.type || 'application/octet-stream',
    fileSize: file.size,
    chunkSize: TEBI_ENCRYPTED_CHUNK_SIZE,
    chunks: chunkMetadata,
    encryptionKey: 'managed_key',
    created: new Date().toISOString(),
  };

  onProgress?.(85, 'saving-metadata');
  const inserted = await createSecureFileRecord({
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    storagePath: 'tebi_external_encrypted',
    encrypted: true,
    encryptionKeyLabel: 'managed_key',
    metadata: JSON.stringify(encryptedMetadata),
    parentFolder: folderPath || null,
    workspaceId,
    storageProviderId: providerId,
    externalObjectKey: objectKey,
    encryptionKey,
    swkManifestHash: swkVerdict.manifestHash,
    swkManifest: swkManifest as unknown as Record<string, unknown>,
    swkDecision: swkVerdict.decision,
  });

  onProgress?.(100, 'complete');
  return inserted as FileItem;
}

async function uploadFileToS3Storage(
  file: File,
  folderPath: string,
  workspaceId: string | null,
  providerId: string,
  onProgress?: (progress: number, stage?: string, details?: any) => void
): Promise<FileItem> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  onProgress?.(5, 'preparing', { provider: 's3' });

  const { id } = await uploadFileWithRes54(file, (p, stage, details) => {
    onProgress?.(p, stage, details);
  }, providerId);

  // Update parent folder and workspace
  if (folderPath || workspaceId) {
    const updatePayload: Record<string, unknown> = {};
    if (folderPath) updatePayload.parent_folder = folderPath;
    if (workspaceId) updatePayload.workspace_id = workspaceId;

    const { error: updateError } = await supabase
      .from('files')
      .update(updatePayload as any)
      .eq('id', id);

    if (updateError) {
      console.error("Error updating file metadata:", updateError);
    }
  }

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as FileItem;
}

function parseTebiEncryptedMetadata(tags: unknown): TebiEncryptedFileMetadata | null {
  if (!Array.isArray(tags) || tags.length === 0 || typeof tags[0] !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(tags[0]) as TebiEncryptedFileMetadata;
    if (parsed?.format !== 'tebi_encrypted_v1' || !Array.isArray(parsed.chunks)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  created_at: string;
  updated_at: string;
  encrypted: boolean;
  shared: boolean;
  user_id: string;
  storage_path: string;
  tags: string[];
  encryption_key?: string;
  github_repo?: string;
  preview_available?: boolean;
  preview_type?: string;
  processor?: string;
  path?: string;
  parent_folder?: string;
  workspace_id?: string;
  storage_provider_id?: string | null;
  external_object_key?: string | null;
  is_folder?: boolean;
  is_public?: boolean;
}

export interface ShareOptions {
  shareType: 'public' | 'user_specific';
  allowedUsers?: string[];
  expiresAt?: string | null;
  accessCode?: string;
  downloadLimit?: number;
  viewOnly?: boolean;
  requireEmail?: boolean;
  customMessage?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  path: string;
  created_at: string;
  is_folder: boolean;
  parent_folder?: string;
  user_id: string;
  workspace_id?: string;
}

// Utility function to format bytes to human-readable format
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Get all files including virtual folders for a user
export async function getAllFiles(parentFolder: string = ""): Promise<(FileItem | FolderItem)[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    const activeWorkspaceId = getActiveWorkspaceId();
    const activeProviderType = getActiveProviderType();
    const activeProviderId = getActiveProviderId();

    devLog('Getting all files for parent folder:', parentFolder);

    // Get files from database with proper folder filtering
    let query: any = supabase
      .from('files')
      .select('*')
      .order('created_at', { ascending: false });

    if (activeWorkspaceId) {
      query = query.eq('workspace_id', activeWorkspaceId);
    } else {
      query = query.eq('user_id', user.id);
    }

    query = applyProviderScope(query, activeProviderType, activeProviderId);

    // Filter by parent folder
    if (parentFolder === "") {
      query = query.or('parent_folder.is.null,parent_folder.eq.');
    } else {
      query = query.eq('parent_folder', parentFolder);
    }

    const { data: dbFiles, error: dbError } = await query;
    
    if (dbError) {
      console.error("Error fetching files:", dbError);
      throw dbError;
    }

    devLog('Database files fetched:', Array.isArray(dbFiles) ? dbFiles.length : 0);

    // Get folders from the folders table with direct query
    let foldersQuery: any = supabase
      .from('folders')
      .select('*')
      .order('created_at', { ascending: false });

    if (activeWorkspaceId) {
      foldersQuery = foldersQuery.eq('workspace_id', activeWorkspaceId);
    } else {
      foldersQuery = foldersQuery.eq('user_id', user.id);
    }

    foldersQuery = applyProviderScope(foldersQuery, activeProviderType, activeProviderId);

    const { data: dbFolders, error: folderError } = await foldersQuery;

    if (folderError) {
      console.error("Error fetching folders:", folderError);
      // Don't throw, just continue without folders
    }

    devLog('Database folders fetched:', Array.isArray(dbFolders) ? dbFolders.length : 0);

    const allItems: (FileItem | FolderItem)[] = [...(dbFiles as FileItem[] || [])];
    
    // Add folders from database with proper filtering
    if (dbFolders && Array.isArray(dbFolders)) {
      // Filter folders by parent folder client-side
      const filteredFolders = dbFolders.filter((folder: any) => {
        if (parentFolder === "") {
          return !folder.parent_folder || folder.parent_folder === '';
        } else {
          return folder.parent_folder === parentFolder;
        }
      });

      filteredFolders.forEach((folder: any) => {
        allItems.push({
          id: folder.id,
          name: folder.name,
          path: folder.path,
          created_at: folder.created_at,
          is_folder: true,
          parent_folder: folder.parent_folder,
          user_id: folder.user_id
        });
      });
    }
    
    devLog('Combined items:', allItems.length);
    return allItems;
  } catch (error) {
    console.error("Error getting files:", error);
    throw error;
  }
}

// Enhanced getFiles with connection pooling and pagination
export async function getFiles(parentFolder: string = ""): Promise<FileItem[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    const activeWorkspaceId = getActiveWorkspaceId();
    const activeProviderType = getActiveProviderType();
    const activeProviderId = getActiveProviderId();
    
    let query: any = supabase
      .from('files')
      .select('*')
      .order('created_at', { ascending: false });

    if (activeWorkspaceId) {
      query = query.eq('workspace_id', activeWorkspaceId);
    } else {
      query = query.eq('user_id', user.id);
    }

    query = applyProviderScope(query, activeProviderType, activeProviderId);

    // Filter by parent folder
    if (parentFolder === "") {
      query = query.or('parent_folder.is.null,parent_folder.eq.');
    } else {
      query = query.eq('parent_folder', parentFolder);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching files:", error);
      throw error;
    }
    
    return data as FileItem[];
  } catch (error) {
    console.error("Error getting files:", error);
    throw error;
  }
}

// Enhanced get folders function
export async function getFolders(parentFolder: string = ""): Promise<FolderItem[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    const activeWorkspaceId = getActiveWorkspaceId();
    const activeProviderType = getActiveProviderType();
    const activeProviderId = getActiveProviderId();

    // Use direct query to the folders table
    let query: any = supabase
      .from('folders')
      .select('*')
      .order('created_at', { ascending: false });

    if (activeWorkspaceId) {
      query = query.eq('workspace_id', activeWorkspaceId);
    } else {
      query = query.eq('user_id', user.id);
    }

    query = applyProviderScope(query, activeProviderType, activeProviderId);

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching folders:", error);
      return [];
    }

    // Filter by parent folder client-side
    const filteredFolders = (data || []).filter((folder: any) => {
      if (parentFolder === "") {
        return !folder.parent_folder || folder.parent_folder === '';
      } else {
        return folder.parent_folder === parentFolder;
      }
    });

    return filteredFolders.map((folder: any) => ({
      id: folder.id,
      name: folder.name,
      path: folder.path,
      created_at: folder.created_at,
      is_folder: true,
      parent_folder: folder.parent_folder,
      user_id: folder.user_id
    }));
  } catch (error) {
    console.error("Error getting folders:", error);
    return [];
  }
}

// Optimized getFileById with faster retrieval
export async function getFileById(id: string): Promise<FileItem | null> {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error("Error fetching file by ID:", error);
      return null;
    }

    return data as FileItem;
  } catch (error) {
    console.error("Error getting file by ID:", error);
    return null;
  }
}

// Create a new folder
export async function createFolder(folderName: string, parentFolder: string = ""): Promise<FolderItem> {
  if (!folderName) {
    throw new Error("Folder name is required");
  }
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    const activeWorkspaceId = getActiveWorkspaceId();
    const activeProviderType = getActiveProviderType();
    const activeProviderId = getActiveProviderId();

    devLog('Creating folder:', folderName, 'in parent:', parentFolder);

    if (activeProviderType !== 'squidcloud' && !activeProviderId) {
      throw new Error('Selected provider is not configured. Please complete provider setup first.');
    }

    // Insert into folders table via secure RPC
    const { data: folderData, error: insertError } = await supabase.rpc('create_folder_secure', {
      p_name: folderName,
      p_parent_folder: parentFolder || null,
      p_workspace_id: activeWorkspaceId || null,
      p_storage_provider_id: activeProviderType !== 'squidcloud' && activeProviderId ? activeProviderId : null,
    });

    if (insertError) {
      console.error("Error creating folder in database:", insertError);
      throw new Error(insertError.message || "Failed to create folder");
    }

    const folder = folderData as any || {};
    devLog('Created folder in database:', folder.id);

    // Only mirror folder creation to legacy GitHub storage for SquidCloud provider.
    if (activeProviderType === 'squidcloud') {
      try {
        const { data: repos } = await supabase
          .from('repositories')
          .select('repo_name')
          .eq('user_id', user.id);

        if (repos && repos.length > 0) {
          const repo = repos[0].repo_name;

          await supabase.functions.invoke('github-storage', {
            body: {
              action: 'create_folder',
              userId: user.id,
              folderName,
              path: parentFolder || "",
              repo
            }
          });
        }
      } catch (githubError) {
        console.error('Error creating folder in GitHub storage:', githubError);
        // Don't fail the whole operation if GitHub storage fails
      }
    }

    // Return the new folder item
    return {
      id: folder.id,
      name: folder.name,
      path: folder.path,
      created_at: folder.created_at,
      is_folder: true,
      parent_folder: folder.parent_folder,
      user_id: folder.user_id
    };
  } catch (error) {
    console.error("Error creating folder:", error);
    throw error;
  }
}

// Improved upload with folder support
export const uploadFile = async (
  file: File, 
  folderPath: string = "", 
  onProgress?: (progress: number, stage?: string, details?: any) => void
): Promise<FileItem> => {
  if (!file) {
    throw new Error("No file provided");
  }

  // SDE beta mode — check DB for user preference
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (authUser) {
    try {
      const { data: encSettings, error: encErr } = await supabase
        .from('user_encryption_settings')
        .select('settings')
        .eq('user_id', authUser.id)
        .maybeSingle();
      if (encErr) console.error('[SDE] settings query error:', encErr.message);
      const sdeEnabled = encSettings?.settings?.sde_enabled === true;
      console.log('[SDE] user:', authUser.id, 'sde_enabled:', sdeEnabled);

      if (sdeEnabled) {
        const { SDE } = await import('sde/sdk/SDE');
        const { SDEBrain } = await import('sde/brain/SDEBrain');
        const { DHTSubstrate } = await import('sde/substrates/deep/DHT');
        const { NostrSubstrate } = await import('sde/substrates/nostr/NostrSubstrate');
        const { PasteSubstrate } = await import('sde/substrates/paste/PasteSubstrate');
        const { saveSdeLocators } = await import('@/lib/sde-locators');
        console.log('[SDE] modules loaded, starting upload...');
        // Internet fleet: local cache + keyless Nostr relays + paste-host
        // replicas. Quorum (2 confirmations incl. 1 remote) keeps uploads
        // honest — a local-only copy never reports success as dispersal.
        const brain = new SDEBrain([new DHTSubstrate(), new NostrSubstrate(), new PasteSubstrate()]);
        const sde = new SDE(brain);
        onProgress?.(0, 'dispersing');
        const pendingLocators: Array<{ chunkIndex: number; substrateId: string; locatorB64: string }> = [];
        const { recallToken, fileHash } = await sde.upload(file, (i, total) => {
          onProgress?.(Math.round((i / total) * 100), 'dispersing');
        }, {
          minConfirmations: 2,
          requireRemote: true,
          onLocator: (rec) => {
            pendingLocators.push({ chunkIndex: rec.chunkIndex, substrateId: rec.substrateId, locatorB64: rec.locatorB64 });
          },
        });
        console.log('[SDE] upload done, inserting file record...');
        const activeWorkspaceId = getActiveWorkspaceId();
        const { data, error } = await supabase.from('files').insert({
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          storage_path: 'sde',
          processor: 'sde',
          user_id: authUser.id,
          parent_folder: folderPath || null,
          encrypted: true,
          shared: false,
          encryption_key: 'managed_key',
          ...(activeWorkspaceId ? { workspace_id: activeWorkspaceId } : {}),
        }).select('*').single();
        if (error) {
          console.error('[SDE] direct insert failed, trying RPC:', error.message);
          const { data: rpcData, error: rpcError } = await supabase.rpc('create_file_record', {
            p_name: file.name,
            p_type: file.type || 'application/octet-stream',
            p_size: file.size,
            p_storage_path: 'sde',
            p_user_id: authUser.id,
            p_encrypted: true,
            p_encryption_key: 'managed_key',
            p_metadata: JSON.stringify({ processor: 'sde' }),
          } as any);
          if (rpcError || !rpcData) {
            console.error('[SDE] RPC also failed:', rpcError?.message);
            throw rpcError || new Error('Failed to create file record');
          }
          await supabase.from('files').update({ processor: 'sde' }).eq('id', (rpcData as any).id);
          console.log('[SDE] file inserted via RPC, storing recall token + locators...');
          const { error: rtErr2 } = await supabase.from('sde_recall_tokens').insert({
            file_id: (rpcData as any).id,
            user_id: authUser.id,
            recall_token: recallToken,
            file_hash: fileHash,
          });
          if (rtErr2) console.error('[SDE] recall token insert error:', rtErr2.message);
          await saveSdeLocators((rpcData as any).id, authUser.id, pendingLocators);
          onProgress?.(100, 'complete');
          return rpcData as FileItem;
        }
        console.log('[SDE] file inserted, storing recall token + locators...');
        const { error: rtErr } = await supabase.from('sde_recall_tokens').insert({
          file_id: data.id,
          user_id: authUser.id,
          recall_token: recallToken,
          file_hash: fileHash,
        });
        if (rtErr) console.error('[SDE] recall token insert error:', rtErr.message);
        await saveSdeLocators(data.id, authUser.id, pendingLocators);
        onProgress?.(100, 'complete');
        return data as FileItem;
      }
    } catch (e: any) {
      console.error('[SDE] FAILED:', e?.message ?? e, e?.stack);
    }
  }
  
  try {
    const activeWorkspaceId = getActiveWorkspaceId();
    const activeProviderType = getActiveProviderType();
    const activeProviderId = getActiveProviderId();

    const activeProvider = activeProviderType as ActiveProviderType;

    // External provider routes via s3-storage (unified S3 gateway)
    if (activeProvider !== 'squidcloud' && activeProviderId) {
      return await uploadFileToS3Storage(file, folderPath, activeWorkspaceId, activeProviderId, onProgress);
    }

    // Tebi legacy support
    if (activeProvider === 'tebi') {
      if (!activeProviderId) {
        throw new Error('Selected provider is not configured. Please complete provider setup first.');
      }
      return await uploadFileToTebi(file, folderPath, activeWorkspaceId, activeProviderId, onProgress);
    }

    // Default SquidCloud route uses existing RES54 pipeline.
    // If the ZK vault is unlocked, encrypt the bytes before upload so the
    // server only ever holds ciphertext it cannot decrypt.
    let zkMeta: { salt: string; iv: string } | null = null;
    let uploadSource = file;
    let v4Salt: string | null = null;
    let v4Meta: import('./e2e-v4-upload').V4UploadMeta | null = null;
    if (authUser) {
      const { prepareV4Upload } = await import('./e2e-v4-upload');
      const prepared = await prepareV4Upload(file, authUser.id);
      if (prepared) {
        uploadSource = prepared.file;
        v4Salt = prepared.saltB64;
        v4Meta = prepared.meta;
      } else {
        const sealed = await zkEncryptForUpload(file, authUser.id);
        if (sealed) { uploadSource = sealed.file; zkMeta = sealed.meta; }
      }
    }
    if (v4Meta) {
      const { setPendingV4Meta } = await import('./res54');
      setPendingV4Meta(v4Meta);
    }
    const { id, metadata } = await uploadFileWithRes54(uploadSource, onProgress, undefined, !!v4Meta);
    if (v4Meta && authUser && id) {
      await import('./e2e-v4-store').then(m => m.saveV4Meta(id, authUser.id, v4Meta!.saltB64)).catch(() => {});
    }
    if (zkMeta && authUser) {
      await zkSaveMeta(id, authUser.id, zkMeta.salt, zkMeta.iv).catch(() => {});
    }
    
    // Update the file with parent folder information if provided
    if (folderPath || activeWorkspaceId || activeProviderType !== 'squidcloud') {
      const updatePayload: Record<string, unknown> = {};
      if (folderPath) {
        updatePayload.parent_folder = folderPath;
      }
      if (activeWorkspaceId) {
        updatePayload.workspace_id = activeWorkspaceId;
      }
      if (activeProviderType !== 'squidcloud') {
        if (!activeProviderId) {
          throw new Error('Selected provider is not configured. Please complete provider setup first.');
        }
        updatePayload.storage_provider_id = activeProviderId;
      }

      const { error: updateError } = await supabase
        .from('files')
        .update(updatePayload as any)
        .eq('id', id);
        
      if (updateError) {
        console.error("Error updating parent folder:", updateError);
      }
    }
    
    // Fetch the created file record with complete details
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) throw error;
    
    // Add processor info if not present in database response
    const fileItem = data as FileItem;
    if (!fileItem.processor && fileItem.storage_path === "github_distributed") {
      (fileItem as any).processor = "res54";
    }
    
    void emitWebhookEvent('file.uploaded', {
      file_id: fileItem.id,
      file_name: fileItem.name,
      file_size: fileItem.size,
      mime_type: fileItem.type,
      folder_id: fileItem.parent_folder || null,
      source: 'app',
    });
    
    return fileItem;
  } catch (error: any) {
    console.error("Error uploading file:", error);
    throw new Error(error.message || "Failed to upload file");
  }
}

// Compress multiple files into an archive
export async function compressFiles(
  files: FileItem[], 
  archiveName: string,
  archiveType: 'zip' | 'tar',
  parentFolder: string = "",
  onProgress?: (progress: number, stage: string, details?: any) => void
): Promise<FileItem> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");
    
    if (files.length === 0) {
      throw new Error("No files selected for compression");
    }
    
    const fileIds = files.map(file => file.id);
    
    // Call the compression edge function
    const response = await supabase.functions.invoke('file-operations', {
      body: { 
        action: 'compress', 
        fileIds,
        userId: user.id,
        archiveName,
        archiveType,
        parentFolder
      }
    });
    
    if (response.error || !response.data?.file) {
      throw new Error(response.error?.message || "Failed to compress files");
    }
    
    return response.data.file as FileItem;
  } catch (error: any) {
    console.error("Error compressing files:", error);
    throw new Error(error.message || "Failed to compress files");
  }
}

// Extract archive file
export async function extractArchive(
  fileId: string,
  destinationFolder: string = "",
  onProgress?: (progress: number, stage: string, details?: any) => void
): Promise<FileItem[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");
    
    // Call the extraction edge function
    const response = await supabase.functions.invoke('file-operations', {
      body: { 
        action: 'extract', 
        fileId,
        userId: user.id,
        destinationFolder
      }
    });
    
    if (response.error || !response.data?.files) {
      throw new Error(response.error?.message || "Failed to extract archive");
    }
    
    return response.data.files as FileItem[];
  } catch (error: any) {
    console.error("Error extracting archive:", error);
    throw new Error(error.message || "Failed to extract archive");
  }
}

// Enhanced download with retries, parallel processing, and better streaming
export async function downloadFile(fileId: string, onProgress?: (progress: number, stage: string, details?: any) => void): Promise<Blob> {
  try {
    const { data: fileRow, error: fileError } = await supabase
      .from('files')
      .select('id, storage_path, storage_provider_id, external_object_key, name, type, tags, processor')
      .eq('id', fileId)
      .single();

    if (fileError || !fileRow) {
      throw new Error(fileError?.message || 'File metadata not found');
    }

    if (fileRow.storage_path === 'tebi_external_encrypted') {
      if (!fileRow.storage_provider_id) {
        throw new Error('Tebi file metadata is incomplete.');
      }

      const metadata = parseTebiEncryptedMetadata(fileRow.tags);
      if (!metadata) {
        throw new Error('Encrypted Tebi metadata is invalid or missing.');
      }

      const decryptionKey = metadata.encryptionKey === 'managed_key' || !metadata.encryptionKey
        ? await fetchFileEncryptionKey(fileRow.id)
        : metadata.encryptionKey;
      const sortedChunks = [...metadata.chunks].sort((a, b) => a.index - b.index);
      const decryptedChunks: ArrayBuffer[] = [];

      for (let index = 0; index < sortedChunks.length; index++) {
        const chunk = sortedChunks[index];

        onProgress?.(15 + ((index / Math.max(sortedChunks.length, 1)) * 70), 'downloading', {
          provider: 'tebi',
          current: index + 1,
          total: sortedChunks.length,
        });

        const { data: presignData, error: presignError } = await supabase.functions.invoke('api-file-upload-tebi', {
          body: {
            action: 'download',
            fileName: fileRow.name,
            path: chunk.path,
            providerId: fileRow.storage_provider_id,
          },
        });

        if (presignError || !presignData?.success || !presignData?.downloadUrl) {
          throw new Error(presignError?.message || presignData?.error || 'Failed to prepare Tebi chunk download');
        }

        const chunkResponse = await fetch(presignData.downloadUrl);
        if (!chunkResponse.ok) {
          throw new Error(`Tebi chunk download failed (${chunkResponse.status})`);
        }

        const encryptedPayload = await chunkResponse.text();
        const decrypted = await decryptData(encryptedPayload, decryptionKey);
        decryptedChunks.push(decrypted);
      }

      onProgress?.(100, 'complete');
      return new Blob(decryptedChunks, { type: metadata.fileType || fileRow.type || 'application/octet-stream' });
    }

    if (fileRow.storage_path === 'tebi_external') {
      if (!fileRow.storage_provider_id || !fileRow.external_object_key) {
        throw new Error('Tebi file metadata is incomplete.');
      }

      onProgress?.(20, 'preparing');

      const { data: presignData, error: presignError } = await supabase.functions.invoke('api-file-upload-tebi', {
        body: {
          action: 'download',
          fileName: fileRow.name,
          path: fileRow.external_object_key,
          providerId: fileRow.storage_provider_id,
        },
      });

      if (presignError || !presignData?.success || !presignData?.downloadUrl) {
        throw new Error(presignError?.message || presignData?.error || 'Failed to prepare Tebi download');
      }

      onProgress?.(60, 'downloading');
      const fileResponse = await fetch(presignData.downloadUrl);
      if (!fileResponse.ok) {
        throw new Error(`Tebi download failed (${fileResponse.status})`);
      }

      const blob = await fileResponse.blob();
      onProgress?.(100, 'complete');
      return blob;
    }

    // SDE dispersal engine download
    if (fileRow.processor === 'sde' || fileRow.storage_path === 'sde') {
      onProgress?.(5, 'fetching recall token');
      const { data: tokenRow, error: tokenError } = await supabase
        .from('sde_recall_tokens')
        .select('recall_token')
        .eq('file_id', fileId)
        .single();
      if (tokenError || !tokenRow) {
        throw new Error('SDE recall token not found: ' + (tokenError?.message || 'missing'));
      }

      onProgress?.(10, 'deriving keys');
      const { SDE } = await import('sde/sdk/SDE');
      const { SDEBrain } = await import('sde/brain/SDEBrain');
      const { DHTSubstrate } = await import('sde/substrates/deep/DHT');
      const { NostrSubstrate } = await import('sde/substrates/nostr/NostrSubstrate');
      const { PasteSubstrate } = await import('sde/substrates/paste/PasteSubstrate');
      const { loadSdeLocators } = await import('@/lib/sde-locators');
      const brain = new SDEBrain([new DHTSubstrate(), new NostrSubstrate(), new PasteSubstrate()]);
      const sde = new SDE(brain);
      const locatorMap = await loadSdeLocators(fileId);

      let lastProgress = 10;
      const blob = await sde.download(
        tokenRow.recall_token,
        (_chunk) => {
          lastProgress = Math.min(lastProgress + 2, 95);
          onProgress?.(lastProgress, 'decrypting chunks');
        },
        {
          fileName: fileRow.name,
          mimeType: fileRow.type || 'application/octet-stream',
          resolveLocator: async (index: number) => locatorMap.get(index) || [],
        }
      );

      onProgress?.(100, 'complete');
      return blob;
    }

    // Raw object rows (migration / cloud-import / direct storage uploads):
    // no chunk metadata — the object at storage_path IS the file itself.
    if (isRawStorageRow(fileRow)) {
      onProgress?.(30, 'downloading');
      const blob = await downloadRawStorageObject(fileRow);
      onProgress?.(100, 'complete');
      return blob;
    }

    // Use optimized Res54 technology for parallel downloads
    const blob = await downloadFileWithRes54(fileId, onProgress);
    return blob;
  } catch (error: any) {
    console.error("Error downloading file:", error);
    throw new Error(error.message || "Failed to download file");
  }
}

export async function smartDownload(
  fileId: string,
  opts?: { reason?: string; fileName?: string; shareId?: string; onProgress?: (p: number, s: string) => void }
): Promise<Blob> {
  const { data: row, error } = await supabase
    .from("files")
    .select("processor, storage_path")
    .eq("id", fileId)
    .single();
  if (error || !row) throw new Error(error?.message || "File not found");

  // NOTE: ZK decryption is intentionally NOT done here. This function returns
  // the stored bytes as-is; the preview modal is the single decrypt boundary
  // (see EnhancedInstantPreviewModal). Decrypting in both places would corrupt
  // files by decrypting ciphertext twice.
  if (row.processor === "sde" || row.storage_path === "sde") {
    return downloadFile(fileId, opts?.onProgress);
  }
  return downloadFileWithRes54(fileId, opts as any);
}

export async function deleteFile(id: string): Promise<void> {
  try {
    const { data: fileRecord } = await supabase
      .from('files')
      .select('name, size')
      .eq('id', id)
      .single();

    const { data, error } = await supabase.rpc('delete_file_secure', { file_uuid: id });

    if (error || !data) {
      console.error("Error deleting file:", error);
      throw new Error(error?.message || 'Failed to delete file');
    }

    void emitWebhookEvent('file.deleted', {
      file_id: id,
      file_name: fileRecord?.name || null,
      file_size: fileRecord?.size || null,
      deleted_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
}

export async function updateFile(id: string, updates: Partial<FileItem>): Promise<FileItem | null> {
  try {
    const { data, error } = await supabase
      .from('files')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error("Error updating file:", error);
      return null;
    }

    return data as FileItem;
  } catch (error) {
    console.error("Error updating file:", error);
    return null;
  }
}

export async function shareFile(id: string, shared: boolean = true): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('files')
      .update({ shared })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error("Error sharing file:", error);
      throw error;
    }

    // Generate a shareable link
    const shareLink = buildPublicUrl(`/share/${id}`);
    return shareLink;
  } catch (error) {
    console.error("Error sharing file:", error);
    throw new Error("Failed to generate share link");
  }
}

// Emit a signal for the signed-in user (client-safe types only: password_changed, file_shared)
export async function emitSignal(payload: {
  type: 'password_changed' | 'file_shared';
  severity?: 'info' | 'warning' | 'urgent';
  title: string;
  body?: string;
  link?: string;
  idempotency_key?: string;
}): Promise<void> {
  try {
    await supabase.functions.invoke('emit-signal', {
      body: {
        type: payload.type,
        severity: payload.severity ?? 'info',
        title: payload.title,
        body: payload.body,
        link: payload.link,
        idempotency_key: payload.idempotency_key,
      },
    });
  } catch (error) {
    console.error('emitSignal failed:', error);
  }
}

// Create a secure share for a file with advanced options
export async function createFileShare(
  fileId: string,
  options?: ShareOptions & {
    sharedEncryptionKey?: string; shareSecretHash?: string;
    maxViews?: number; maxDownloads?: number;
    burnAfterReading?: boolean;
    allowedCountries?: string[]; blockedCountries?: string[];
    deviceFingerprint?: string; watermarkEmail?: boolean;
  }
): Promise<{ shareId: string; shareUrl: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data, error } = await supabase
      .rpc('create_file_share', {
        file_id_param: fileId,
        shared_encryption_key_param: options?.sharedEncryptionKey || null,
        share_secret_hash_param: options?.shareSecretHash || null,
      });

    if (error) {
      console.error("Error creating file share:", error);
      throw new Error(error.message);
    }

    const shareId = data[0].share_id;

    if (options) {
      const updateData: any = {
        share_type: options.shareType || 'public',
        allowed_users: options.allowedUsers || [],
      };

      if (options.expiresAt) updateData.expires_at = options.expiresAt;
      if (options.accessCode) updateData.access_code = options.accessCode;
      if (options.downloadLimit !== undefined) updateData.download_limit = options.downloadLimit;
      if (options.viewOnly !== undefined) updateData.view_only = options.viewOnly;
      if (options.requireEmail !== undefined) updateData.require_email = options.requireEmail;
      if (options.customMessage) updateData.custom_message = options.customMessage;
      if (options.maxViews !== undefined) updateData.max_views = options.maxViews;
      if (options.maxDownloads !== undefined) updateData.max_downloads = options.maxDownloads;
      if (options.burnAfterReading !== undefined) updateData.burn_after_reading = options.burnAfterReading;
      if (options.allowedCountries) updateData.allowed_countries = options.allowedCountries;
      if (options.blockedCountries) updateData.blocked_countries = options.blockedCountries;
      if (options.deviceFingerprint) updateData.device_fingerprint = options.deviceFingerprint;
      if (options.watermarkEmail !== undefined) updateData.watermark_email = options.watermarkEmail;

      const { error: updateError } = await supabase
        .from('shares')
        .update(updateData)
        .eq('share_id', shareId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error("Error updating share options:", updateError);
      }
    }

    await supabase.from('files').update({ shared: true }).eq('id', fileId);

    void emitSignal({
      type: 'file_shared',
      severity: 'info',
      title: 'Share link created',
      body: 'Your file share link is ready to send.',
      link: '/dashboard',
      idempotency_key: `file_shared:${shareId}`,
    });

    void emitWebhookEvent('file.shared', {
      file_id: fileId,
      share_id: shareId,
      expires_at: options?.expiresAt || null,
      access_level: options?.viewOnly ? 'view' : 'download',
    });

    const shareUrl = buildPublicUrl(`/s/${shareId}`);
    return { shareId, shareUrl };
  } catch (error: any) {
    console.error("Error creating file share:", error);
    throw error;
  }
}

// Create a secure share for a folder
export async function createFolderShare(
  folderId: string,
  options?: ShareOptions & {
    sharedEncryptionKey?: string; shareSecretHash?: string;
    maxViews?: number; maxDownloads?: number;
    burnAfterReading?: boolean;
    allowedCountries?: string[]; blockedCountries?: string[];
    deviceFingerprint?: string; watermarkEmail?: boolean;
  }
): Promise<{ shareId: string; shareUrl: string; fileCount: number }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data, error } = await supabase
      .rpc('create_folder_share', {
        folder_id_param: folderId,
        shared_encryption_key_param: options?.sharedEncryptionKey || null,
        share_secret_hash_param: options?.shareSecretHash || null,
      });

    if (error) {
      console.error("Error creating folder share:", error);
      throw new Error(error.message);
    }

    const shareId = data[0].share_id;
    const fileCount = data[0].file_count;

    if (options) {
      const updateData: any = {
        share_type: options.shareType || 'public',
        allowed_users: options.allowedUsers || [],
      };

      if (options.expiresAt) updateData.expires_at = options.expiresAt;
      if (options.accessCode) updateData.access_code = options.accessCode;
      if (options.downloadLimit !== undefined) updateData.download_limit = options.downloadLimit;
      if (options.viewOnly !== undefined) updateData.view_only = options.viewOnly;
      if (options.requireEmail !== undefined) updateData.require_email = options.requireEmail;
      if (options.customMessage) updateData.custom_message = options.customMessage;
      if (options.maxViews !== undefined) updateData.max_views = options.maxViews;
      if (options.maxDownloads !== undefined) updateData.max_downloads = options.maxDownloads;
      if (options.burnAfterReading !== undefined) updateData.burn_after_reading = options.burnAfterReading;
      if (options.allowedCountries) updateData.allowed_countries = options.allowedCountries;
      if (options.blockedCountries) updateData.blocked_countries = options.blockedCountries;
      if (options.deviceFingerprint) updateData.device_fingerprint = options.deviceFingerprint;
      if (options.watermarkEmail !== undefined) updateData.watermark_email = options.watermarkEmail;

      await supabase
        .from('shares')
        .update(updateData)
        .eq('share_id', shareId)
        .eq('user_id', user.id);
    }

    const shareUrl = buildPublicUrl(`/s/${shareId}`);
    void emitSignal({
      type: 'file_shared',
      severity: 'info',
      title: 'Folder share link created',
      body: fileCount > 0 ? `Your folder share is ready — ${fileCount} file${fileCount === 1 ? '' : 's'} included.` : 'Your folder share link is ready to send.',
      link: '/dashboard',
      idempotency_key: `file_shared:${shareId}`,
    });

    void emitWebhookEvent('file.shared', {
      folder_id: folderId,
      share_id: shareId,
      file_count: fileCount,
      expires_at: options?.expiresAt || null,
    });

    return { shareId, shareUrl, fileCount };
  } catch (error: any) {
    console.error("Error creating folder share:", error);
    throw error;
  }
}

// Revoke a file share
export async function revokeFileShare(fileId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { error } = await supabase
      .rpc('revoke_file_share', { file_id_param: fileId });

    if (error) {
      console.error("Error revoking file share:", error);
      throw new Error(error.message);
    }
    
    // Explicitly unset the 'shared' state on the actual file record
    await supabase.from('files').update({ shared: false }).eq('id', fileId);

    void emitWebhookEvent('share_link.revoked', {
      file_id: fileId,
      revoked_at: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    console.error("Error revoking file share:", error);
    throw error;
  }
}

// Get file information by file ID or share ID (supports both public and private access)
export async function getFileInfoById(id: string): Promise<any> {
  try {
    // First try to get as a shared file (public access)
    try {
      const sharedFileInfo = await getSharedFileInfo(id);
      return {
        file_id: sharedFileInfo.file_id,
        file_name: sharedFileInfo.file_name,
        file_type: sharedFileInfo.file_type,
        file_size: sharedFileInfo.file_size,
        file_created_at: sharedFileInfo.file_created_at,
        file_updated_at: sharedFileInfo.file_updated_at,
        is_encrypted: sharedFileInfo.is_encrypted,
        storage_path: sharedFileInfo.storage_path,
        owner_id: sharedFileInfo.owner_id,
        share_created_at: sharedFileInfo.share_created_at,
        share_expires_at: sharedFileInfo.share_expires_at,
        share_download_limit: sharedFileInfo.share_download_limit,
        share_download_count: sharedFileInfo.share_download_count,
        share_view_only: sharedFileInfo.share_view_only,
        share_require_email: sharedFileInfo.share_require_email,
        shared_encryption_key: sharedFileInfo.shared_encryption_key,
        is_folder_share: sharedFileInfo.is_folder_share,
        folder_id: sharedFileInfo.folder_id,
        folder_name: sharedFileInfo.folder_name,
        is_byok: !!sharedFileInfo.is_byok,
        file_tags: sharedFileInfo.file_tags,
        file_encryption_key: sharedFileInfo.file_encryption_key,
        isShared: true,
        accessType: 'public',
      };
    } catch (shareError) {
      // If not a share ID, try to get as a regular file (authenticated access)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Authentication required");
      }

      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        throw error;
      }

      return {
        file_id: data.id,
        file_name: data.name,
        file_type: data.type,
        file_size: data.size,
        file_created_at: data.created_at,
        file_updated_at: data.updated_at,
        is_encrypted: data.encrypted,
        storage_path: data.storage_path,
        owner_id: data.user_id,
        isShared: false,
        accessType: 'private'
      };
    }
  } catch (error: any) {
    console.error("Error getting file info:", error);
    throw new Error(error.message || "Failed to get file information");
  }
}



// Check if a file has an active share
export async function getFileShareId(fileId: string): Promise<string | null> {
  const getFallbackShareId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: shareRow, error: fallbackError } = await supabase
      .from('shares')
      .select('share_id, expires_at')
      .eq('file_id', fileId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackError || !shareRow) {
      if (fallbackError) {
        console.error('Fallback share lookup failed:', fallbackError);
      }
      return null;
    }

    if (shareRow.expires_at) {
      const expiresAt = new Date(shareRow.expires_at);
      if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
        return null;
      }
    }

    return shareRow.share_id;
  };

  try {
    const { data, error } = await supabase
      .rpc('get_file_share_id', { file_id_param: fileId });

    if (error) {
      console.error("Error getting file share ID:", error);
      return await getFallbackShareId();
    }

    return data as string | null;
  } catch (error: any) {
    console.error("Error getting file share ID:", error);
    return await getFallbackShareId();
  }
}

// Get shared file information (for public access)
export async function getSharedFileInfo(shareId: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .rpc('get_shared_file_info', { share_id_param: shareId });

    if (error) {
      console.error("Error getting shared file info:", error);
      throw error;
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      throw new Error("Shared file not found or expired");
    }

    const raw = Array.isArray(data) ? data[0] : data;
    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid shared file payload');
    }

    // Strip the original file encryption_key (never expose it)
    // BUT preserve shared_encryption_key which is the share-specific wrapped key
    const { encryption_key: _ignored, ...safePayload } = raw as Record<string, unknown>;
    return safePayload;
  } catch (error: any) {
    console.error("Error getting shared file info:", error);
    throw new Error(error.message || "Failed to get shared file information");
  }
}

// Get folder share contents (list files in a shared folder)
export async function getFolderShareContents(shareId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_folder_share_contents', { share_id_param: shareId });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Error getting folder share contents:", error);
    throw new Error(error.message || "Failed to get folder share contents");
  }
}

// Log a decryption attempt for surveillance
export async function logShareDecryptAttempt(
  shareId: string,
  success: boolean,
  failureReason?: string
): Promise<void> {
  try {
    await fetch('/api/internal/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'share-decrypt-log',
        shareId,
        success,
        failureReason: failureReason || null,
        userAgent: navigator.userAgent,
      }),
    });
  } catch (error) {
    console.error("Failed to log decrypt attempt:", error);
  }
}

// ─── Share Access API (via edge function) ──────────────────────────────────
export async function checkShareAccess(shareId: string, params?: {
  password?: string; country?: string; deviceFingerprint?: string;
}): Promise<any> {
  const { data, error } = await supabase.functions.invoke('share-access', {
    body: { action: 'check', shareId, ...params },
  });
  if (error) throw error;
  return data;
}

export async function logShareView(shareId: string, country?: string): Promise<void> {
  await supabase.functions.invoke('share-access', {
    body: { action: 'view', shareId, country },
  }).catch(() => {});
}

export async function logShareDownload(shareId: string, params?: {
  password?: string; country?: string; deviceFingerprint?: string;
}): Promise<any> {
  const { data, error } = await supabase.functions.invoke('share-access', {
    body: { action: 'download', shareId, ...params },
  });
  if (error) throw error;
  return data;
}

export async function getShareAnalytics(shareId: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke('share-access', {
    body: { action: 'analytics', shareId },
  });
  if (error) throw error;
  return data;
}

// ─── Update share options ──────────────────────────────────────────────────
export async function updateShareOptions(shareId: string, options: Record<string, any>): Promise<void> {
  const { error } = await supabase.rpc('update_share_options', {
    p_share_id: shareId,
    ...Object.fromEntries(
      Object.entries(options).map(([k, v]) => [`p_${k}`, v])
    ),
  });
  if (error) throw error;
}

// Added the missing initializeRepos function
export async function initializeRepos(count: number, password?: string): Promise<string[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");
    
    // Use the supabase edge function to create repos
    const response = await supabase.functions.invoke('create-repos', {
      body: { 
        action: 'create', 
        count
      }
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to create repositories');
    }

    if (!response.data?.repositories) {
      throw new Error('Invalid response from server');
    }

    return response.data.repositories.map((repo: any) => repo.name) || [];
  } catch (error: any) {
    console.error('Error initializing repos:', error);
    throw new Error(error.message || 'Failed to initialize secure repositories');
  }
}

// Mark file as recently viewed (for use in the file explorer)
export async function markFileViewed(id: string): Promise<void> {
  try {
    await supabase
      .from('files')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch (error) {
    console.error("Error marking file as viewed:", error);
  }
}

// Function to determine if a file is an archive
export function isArchiveFile(file: FileItem): boolean {
  const archiveExtensions = ['.zip', '.tar', '.gz', '.rar', '.7z'];
  const fileName = file.name.toLowerCase();
  return archiveExtensions.some(ext => fileName.endsWith(ext));
}

// Function to get appropriate icon for file type
export function getFileIcon(file: FileItem | FolderItem): string {
  if ('is_folder' in file && file.is_folder) {
    return 'folder';
  }
  
  const fileItem = file as FileItem;
  if (fileItem.type.startsWith('image/')) {
    return 'file-image';
  } else if (fileItem.type.startsWith('video/')) {
    return 'file-video';
  } else if (fileItem.type.startsWith('audio/')) {
    return 'file-audio';
  } else if (fileItem.type.includes('pdf') || fileItem.type.includes('document') || fileItem.type.includes('text')) {
    return 'file-text';
  } else if (isArchiveFile(fileItem)) {
    return 'file-archive';
  } else {
    return 'file';
  }
}

// Streaming video API functions
export interface StreamingManifestRequest {
  fileId: string;
  userId: string;
  requestedMaxQuality?: string;
  playbackMode?: 'streaming' | 'download';
}

export interface VideoQualityVariant {
  qualityId: string;
  label: string;
  playlistUrl: string;
  bandwidth: number;
  resolution?: string;
  codecs?: string;
}

export interface StreamingManifestResponse {
  masterManifestUrl: string;
  variants: VideoQualityVariant[];
  ttl: number;
  duration?: number;
  segmentDuration: number;
}

// Request HLS manifest for video streaming
export async function requestVideoManifest(
  fileId: string, 
  requestedMaxQuality: string = '1080p',
  playbackMode: 'streaming' | 'download' = 'streaming'
): Promise<StreamingManifestResponse> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('User not authenticated');
    }

    const response = await supabase.functions.invoke('media-manifest', {
      body: {
        fileId,
        userId: userData.user.id,
        requestedMaxQuality,
        playbackMode,
      },
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to get video manifest');
    }

    return response.data;
  } catch (error) {
    console.error('Failed to request video manifest:', error);
    throw error;
  }
}

// Check if file supports streaming
export function supportsVideoStreaming(file: FileItem): boolean {
  // Check if it's a video file and uses Res54 encryption
  return file.type.startsWith('video/') && 
         file.encrypted && 
         file.storage_path === 'res54_distributed';
}

// Get estimated video duration (placeholder - would be improved with actual metadata)
export function estimateVideoDuration(file: FileItem): number {
  // Rough estimation based on file size and typical bitrates
  const avgBitrate = file.type.includes('h264') ? 2000000 : 1500000; // 2Mbps for H.264
  return Math.round((file.size * 8) / avgBitrate);
}

export interface VideoStreamUrlResponse {
  url: string;
  ttl_seconds: number;
  qualities: {
    id: string;
    label: string;
    bandwidth: number;
    url: string;
    height?: number;
    width?: number;
  }[];
  sessionId?: string;
}

// Request direct streaming URL for byte-range playback (HLS fallback)
export async function requestVideoStreamUrl(
  fileId: string,
  playbackMode: 'stream' | 'download' = 'stream'
): Promise<VideoStreamUrlResponse> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('User not authenticated');
    }

    const response = await supabase.functions.invoke('video-stream-url', {
      body: {
        fileId,
        requesterUserId: userData.user.id,
        playbackMode,
      },
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to get stream URL');
    }

    return response.data;
  } catch (error) {
    console.error('Failed to request stream URL:', error);
    throw error;
  }
}

// ─── File Request API ────────────────────────────────────────────

export interface CreateFileRequestInput {
  title: string;
  description?: string;
  folderPath?: string;
  maxFiles?: number;
  maxSizePerFile?: number;
  allowedTypes?: string[];
  expiresAt?: string | null;
}

export async function createFileRequest(input: CreateFileRequestInput): Promise<{ id: string; slug: string; title: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data, error } = await supabase.rpc('create_file_request', {
    p_user_id: user.id,
    p_title: input.title,
    p_description: input.description || '',
    p_folder_path: input.folderPath || '',
    p_max_files: input.maxFiles || 0,
    p_max_size_per_file: input.maxSizePerFile || 0,
    p_allowed_types: input.allowedTypes || null,
    p_expires_at: input.expiresAt || null,
  });

  if (error) throw new Error(error.message);
  return data as any;
}

export async function getFileRequestBySlug(slug: string): Promise<any> {
  const { data, error } = await supabase.rpc('get_file_request_by_slug', {
    request_slug: slug,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function submitFileRequest(
  fileRequestId: string,
  fileId: string,
  fileName: string,
  fileSize: number,
  uploaderName?: string,
  uploaderEmail?: string,
): Promise<any> {
  const { data, error } = await supabase.rpc('submit_file_request', {
    p_file_request_id: fileRequestId,
    p_file_id: fileId,
    p_file_name: fileName,
    p_file_size: fileSize,
    p_uploader_name: uploaderName || '',
    p_uploader_email: uploaderEmail || '',
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function getMyFileRequests(): Promise<any[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data, error } = await supabase
    .from('file_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getFileRequestSubmissions(fileRequestId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('file_request_submissions')
    .select('*, file:files(id, name, type, size)')
    .eq('file_request_id', fileRequestId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function toggleFileRequest(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('file_requests')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteFileRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('file_requests')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// ─── Site Publication API ────────────────────────────────────────

export interface SitePublication {
  id: string;
  resource_id: string;
  resource_type: 'file' | 'folder';
  owner_id: string;
  site_slug: string;
  site_url: string;
  visibility: 'public' | 'private';
  status: 'live' | 'unpublished' | 'error';
  published_at: string;
  updated_at: string;
  file_count: number;
  total_size_bytes: number;
}

export async function checkPublishStatus(resourceId: string): Promise<SitePublication | null> {
  try {
    const { data, error } = await supabase.functions.invoke('sites-api', {
      body: { action: 'status', resourceId },
    });
    if (error) throw error;
    return data?.publication || null;
  } catch {
    return null;
  }
}

export async function listMyPublications(): Promise<SitePublication[]> {
  const { data, error } = await supabase.functions.invoke('sites-api', {
    body: { action: 'list' },
  });
  if (error) throw new Error(error.message);
  return data?.publications || [];
}

export async function createPublication(params: {
  resourceId: string;
  resourceType: 'file' | 'folder';
  siteName?: string;
  visibility?: 'public' | 'private';
  fileCount?: number;
  totalSizeBytes?: number;
}): Promise<{ publication: SitePublication; siteSlug: string; siteUrl: string }> {
  const { data, error } = await supabase.functions.invoke('sites-api', {
    body: { action: 'create', ...params },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function updatePublication(slug: string, params: {
  visibility?: 'public' | 'private';
  fileCount?: number;
  totalSizeBytes?: number;
}): Promise<SitePublication> {
  const { data, error } = await supabase.functions.invoke('sites-api', {
    body: { action: 'update', slug, ...params },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.publication;
}

export async function toggleSiteVisibility(slug: string, visibility: 'public' | 'private'): Promise<SitePublication> {
  const { data, error } = await supabase.functions.invoke('sites-api', {
    body: { action: 'visibility', slug, visibility },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.publication;
}

export async function unpublishSite(slug: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('sites-api', {
    body: { action: 'unpublish', slug },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}
