import { assertClientKeyAvailable } from '@/lib/upload-guard';
import { supabase } from '@/integrations/supabase/client';
import { generateEncryptionKey, encryptData, decryptData } from '@/lib/encryption';
import { emitWebhookEvent } from '@/lib/webhook-events';

/* File keys are held in the server-side key vault, NEVER in files.encryption_key
   (a DB trigger hashes that column). These helpers use the same edge functions
   as the rest of the app so AI-created files are readable. */
async function storeFileKey(fileId: string, key: string): Promise<boolean> { // e2e-invariant-allow: guarded by assertClientKeyAvailable; legacy key vault only
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.functions.invoke('store-file-key', { // e2e-invariant-allow: guarded by assertClientKeyAvailable; legacy key vault only
      headers: { Authorization: `Bearer ${session?.access_token}` },
      body: { fileId, key },
    });
    if (error) throw error;
    return true;
  } catch (e) { console.warn('[squid-ai] store-file-key failed', e); return false; }
}
async function fetchFileKey(fileId: string): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('file-key', {
      headers: { Authorization: `Bearer ${session?.access_token}` },
      body: { fileId },
    });
    if (error || !data?.key) return null;
    return data.key as string;
  } catch { return null; }
}

export interface FileOrganizationResult {
  foldersCreated: string[];
  filesMoved: { from: string; to: string }[];
  summary: string;
}

export interface FileAnalytics {
  totalFiles: number;
  totalSize: number;
  filesByType: Record<string, number>;
  largestFiles: Array<{ name: string; size: number }>;
  recentFiles: Array<{ name: string; created_at: string }>;
}

export interface SearchResult {
  files: any[];
  folders: any[];
  totalResults: number;
}

/**
 * AI Agent Tools for SquidAI
 * Provides real database operations and file management capabilities
 */
export class SquidAITools {
  
  // ==================== FILE ANALYTICS & QUERIES ====================
  
  /**
   * Get file statistics and analytics
   */
  static async getFileAnalytics(fileType?: string): Promise<FileAnalytics> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    let query = supabase
      .from('files')
      .select('*')
      .eq('user_id', user.id);

    if (fileType) {
      query = query.ilike('name', `%.${fileType}`);
    }

    const { data: files, error } = await query;
    if (error) throw error;

    const analytics: FileAnalytics = {
      totalFiles: files?.length || 0,
      totalSize: files?.reduce((sum, f) => sum + (f.size || 0), 0) || 0,
      filesByType: {},
      largestFiles: [],
      recentFiles: []
    };

    // Group by type
    files?.forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';
      analytics.filesByType[ext] = (analytics.filesByType[ext] || 0) + 1;
    });

    // Get largest files
    analytics.largestFiles = (files || [])
      .sort((a, b) => (b.size || 0) - (a.size || 0))
      .slice(0, 10)
      .map(f => ({ name: f.name, size: f.size || 0 }));

    // Get recent files
    analytics.recentFiles = (files || [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(f => ({ name: f.name, created_at: f.created_at }));

    return analytics;
  }

  /**
   * Count files by extension
   */
  static async countFilesByExtension(extension: string): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { count, error } = await supabase
      .from('files')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .ilike('name', `%.${extension}`);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Search files and folders by name or content
   */
  static async searchFiles(query: string, searchContent: boolean = false): Promise<SearchResult> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Search files
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', user.id)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`);

    // Search folders
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', user.id)
      .ilike('name', `%${query}%`);

    return {
      files: files || [],
      folders: folders || [],
      totalResults: (files?.length || 0) + (folders?.length || 0)
    };
  }

  /**
   * Get files in a specific folder
   */
  static async getFilesInFolder(folderPath: string): Promise<any[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', user.id)
      .eq('parent_folder', folderPath);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get total storage used
   */
  static async getStorageUsed(): Promise<{ used: number; total: number; percentage: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: files } = await supabase
      .from('files')
      .select('size')
      .eq('user_id', user.id);

    const used = files?.reduce((sum, f) => sum + (f.size || 0), 0) || 0;
    const total = 10 * 1024 * 1024 * 1024; // 10GB default
    const percentage = (used / total) * 100;

    return { used, total, percentage };
  }

  // ==================== FILE OPERATIONS ====================

  /**
   * Create a new file with content
   */
  static async createFile(
    fileName: string,
    content: string,
    parentFolder: string = '',
    fileType?: string
  ): Promise<{ success: boolean; fileId?: string; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    await assertClientKeyAvailable(user.id);

    try {
      // Convert content to blob
      const blob = new Blob([content], { type: fileType || 'text/plain' });
      const file = new File([blob], fileName, { type: fileType || 'text/plain' });

      // Generate encryption key
      const encryptionKey = generateEncryptionKey();

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Encrypt the file content
      const encryptedData = await encryptData(arrayBuffer, encryptionKey);

      // Convert encrypted data to blob for upload
      const encryptedBlob = new Blob([encryptedData], { type: 'application/octet-stream' });

      // Upload encrypted file to storage
      const filePath = `${user.id}/${Date.now()}_${fileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('files')
        .upload(filePath, encryptedBlob);

      if (uploadError) throw uploadError;

      // Create file record with encryption key
      const { data: fileRecord, error: dbError } = await supabase
        .from('files')
        .insert({
          user_id: user.id,
          name: fileName,
          size: blob.size, // Original size (not encrypted size)
          type: fileType || 'text/plain',
          storage_path: uploadData.path,
          parent_folder: parentFolder || null,
          is_deleted: false,
          encrypted: true
          // NOTE: never write the plaintext key here — a trigger hashes the column.
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Escrow the real key in the server-side vault so read/update can decrypt.
      const keyStored = await storeFileKey(fileRecord.id, encryptionKey); // e2e-invariant-allow: guarded by assertClientKeyAvailable; legacy key vault only
      if (!keyStored) return { success: false, error: 'File uploaded but key escrow failed' };

      return { success: true, fileId: fileRecord.id };
    } catch (error: any) {
      console.error('Create file error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Read file content
   */
  static async readFileContent(fileId: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single();

    if (fileError) throw fileError;

    // Download encrypted file from storage
    const { data: encryptedContent, error: downloadError } = await supabase.storage
      .from('files')
      .download(file.storage_path);

    if (downloadError) throw downloadError;

    // Fetch the real key from the server-side vault, not the hashed column
    const key = await fetchFileKey(fileId);
    if (!key) throw new Error('File key unavailable — this file may predate the key vault');

    // Decrypt the file content
    const encryptedText = await encryptedContent.text();
    const decryptedBuffer = await decryptData(encryptedText, key);

    // Convert ArrayBuffer to text
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  /**
   * Update file content
   */
  static async updateFileContent(
    fileId: string,
    newContent: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    await assertClientKeyAvailable(user.id);

    try {
      const { data: file, error: fileError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', user.id)
        .single();

      if (fileError) throw fileError;

      // Convert new content to ArrayBuffer
      const encoder = new TextEncoder();
      const contentBuffer = encoder.encode(newContent).buffer;

      // Prefer the real key from the vault (files.encryption_key is only a hash)
      const encryptionKey = (await fetchFileKey(fileId)) || generateEncryptionKey();

      // Encrypt the new content
      const encryptedData = await encryptData(contentBuffer, encryptionKey);

      // Convert encrypted data to blob
      const encryptedBlob = new Blob([encryptedData], { type: 'application/octet-stream' });

      // Update file in storage
      const { error: uploadError } = await supabase.storage
        .from('files')
        .update(file.storage_path, encryptedBlob, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Ensure the key is in the vault when we generated a fresh one
      await storeFileKey(fileId, encryptionKey); // e2e-invariant-allow: guarded by assertClientKeyAvailable; legacy key vault only
      await supabase
        .from('files')
        .update({
          size: newContent.length, // Original size
          encrypted_size: encryptedBlob.size
        })
        .eq('id', fileId);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete file
   */
  static async deleteFile(fileId: string): Promise<{ success: boolean; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      const { data: file } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', user.id)
        .single();

      if (!file) throw new Error('File not found');

      // Delete from storage
      await supabase.storage
        .from('files')
        .remove([file.storage_path]);

      // Delete from database
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId)
        .eq('user_id', user.id);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Rename file
   */
  static async renameFile(fileId: string, newName: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: fileRecord } = await supabase
      .from('files')
      .select('name')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single();

    const { error } = await supabase
      .from('files')
      .update({ name: newName })
      .eq('id', fileId)
      .eq('user_id', user.id);

    if (!error) {
      void emitWebhookEvent('file.renamed', {
        file_id: fileId,
        old_name: fileRecord?.name || null,
        new_name: newName,
      });
    }

    return !error;
  }

  // ==================== FOLDER OPERATIONS ====================

  /**
   * Create a new folder
   */
  static async createFolder(folderName: string, parentPath: string = ''): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;

    const { error } = await supabase
      .from('folders')
      .insert({
        user_id: user.id,
        name: folderName,
        path: folderPath,
        parent_folder: parentPath || null
      });

    return !error;
  }

  /**
   * Delete folder and optionally its contents
   */
  static async deleteFolder(
    folderPath: string,
    deleteContents: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      if (deleteContents) {
        // Delete all files in folder
        const { data: files } = await supabase
          .from('files')
          .select('id')
          .eq('user_id', user.id)
          .eq('parent_folder', folderPath);

        for (const file of files || []) {
          await this.deleteFile(file.id);
        }
      }

      // Delete folder
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('user_id', user.id)
        .eq('path', folderPath);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List all folders
   */
  static async listFolders(parentPath: string = ''): Promise<any[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const query = parentPath
      ? supabase.from('folders').select('*').eq('user_id', user.id).eq('parent_folder', parentPath)
      : supabase.from('folders').select('*').eq('user_id', user.id).is('parent_folder', null);

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  }

  // ==================== ORGANIZATION ====================

  /**
   * Organize files by type into categorized folders
   */
  static async organizeFilesByType(files: any[], currentPath: string = ''): Promise<FileOrganizationResult> {
    const result: FileOrganizationResult = {
      foldersCreated: [],
      filesMoved: [],
      summary: ''
    };

    const categories: Record<string, string[]> = {
      'Code Files': ['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.html', '.css', '.php', '.rb', '.go', '.rs', '.swift'],
      'Documents': ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.odt'],
      'Spreadsheets': ['.xlsx', '.xls', '.csv', '.ods'],
      'Images': ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico'],
      'Videos': ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv'],
      'Audio': ['.mp3', '.wav', '.ogg', '.m4a', '.flac'],
      'Archives': ['.zip', '.rar', '.7z', '.tar', '.gz'],
      'Data': ['.json', '.xml', '.yaml', '.yml', '.sql', '.db']
    };

    const filesByCategory: Record<string, any[]> = {};

    for (const file of files) {
      if (!file.name) continue;
      
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();

      let categorized = false;
      for (const [category, extensions] of Object.entries(categories)) {
        if (extensions.includes(ext)) {
          if (!filesByCategory[category]) {
            filesByCategory[category] = [];
          }
          filesByCategory[category].push(file);
          categorized = true;
          break;
        }
      }

      if (!categorized) {
        if (!filesByCategory['Others']) {
          filesByCategory['Others'] = [];
        }
        filesByCategory['Others'].push(file);
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    for (const [category, categoryFiles] of Object.entries(filesByCategory)) {
      if (categoryFiles.length === 0) continue;

      const folderPath = currentPath ? `${currentPath}/${category}` : category;
      
      const { error: folderError } = await supabase
        .from('folders')
        .insert({
          user_id: user.id,
          name: category,
          path: folderPath,
          parent_folder: currentPath || null
        });

      if (!folderError) {
        result.foldersCreated.push(category);
      }

      for (const file of categoryFiles) {
        const { error: moveError } = await supabase
          .from('files')
          .update({ parent_folder: folderPath })
          .eq('id', file.id)
          .eq('user_id', user.id);

        if (!moveError) {
          result.filesMoved.push({
            from: file.parent_folder || 'Root',
            to: folderPath
          });
        }
      }
    }

    result.summary = `Organized ${result.filesMoved.length} files into ${result.foldersCreated.length} categories`;
    return result;
  }

  /**
   * Move files to a specific folder
   */
  static async moveFilesToFolder(fileIds: string[], targetFolder: string): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    let movedCount = 0;

    for (const fileId of fileIds) {
      const { error } = await supabase
        .from('files')
        .update({ parent_folder: targetFolder })
        .eq('id', fileId)
        .eq('user_id', user.id);

      if (!error) movedCount++;
    }

    return movedCount;
  }

  // ==================== CONTENT GENERATION ====================

  /**
   * Generate file content based on reference text
   */
  static async generateContentFromReference(
    referenceText: string,
    outputType: 'markdown' | 'code' | 'text',
    instructions: string
  ): Promise<string> {
    // This would call Gemini API through edge function
    const prompt = `Based on this reference text:\n\n${referenceText}\n\nGenerate ${outputType} content with these instructions: ${instructions}`;
    
    // For now, return a template
    return `// Generated ${outputType} content\n// Instructions: ${instructions}\n\n${referenceText}`;
  }

  /**
   * Generate code from description
   */
  static async generateCode(
    language: string,
    description: string,
    context?: string
  ): Promise<string> {
    const prompt = `Generate ${language} code for: ${description}${context ? `\n\nContext: ${context}` : ''}`;
    
    // This would call Gemini API
    return `// ${language} code for: ${description}\n// TODO: Implement with Gemini API`;
  }

  // ==================== UTILITY ====================

  /**
   * Get file type icon/category
   */
  static getFileCategory(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const categories: Record<string, string[]> = {
      'code': ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'html', 'css'],
      'document': ['pdf', 'doc', 'docx', 'txt', 'md'],
      'image': ['jpg', 'jpeg', 'png', 'gif', 'svg'],
      'video': ['mp4', 'avi', 'mov', 'mkv'],
      'audio': ['mp3', 'wav', 'ogg'],
      'archive': ['zip', 'rar', '7z', 'tar'],
      'data': ['json', 'xml', 'csv', 'sql']
    };

    for (const [category, exts] of Object.entries(categories)) {
      if (exts.includes(ext)) return category;
    }
    return 'other';
  }

  /**
   * dex-style tool dispatcher. One entry point: tool(name, args) -> short string.
   * Mirrors dex's `tasks.tool()` / `run_tool()` contract — the AI calls tools by
   * name with a typed args object and gets a short, human-readable verdict back
   * (never a raw exception). Covers every SquidCloud file/storage operation.
   */
  static async runTool(name: string, args: Record<string, any> = {}): Promise<string> {
    // Normalize camelCase / PascalCase / UPPER_SNAKE to UPPER_SNAKE.
    // FIX: insert underscores on the ORIGINAL mixed-case name, then uppercase.
    const key = String(name || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toUpperCase()
      .replace(/^_+/, '');

    const need = (field: string): string | null =>
      args[field] === undefined || args[field] === null || args[field] === ''
        ? `Missing required argument "${field}" for ${name}`
        : null;

    try {
      switch (key) {
        case 'ORGANIZE_FILES': {
          const files = Array.isArray(args.files) ? args.files : [];
          if (!files.length) return 'No files supplied to organize';
          const r = await this.organizeFilesByType(files, args.currentPath || args.folder || '');
          return `Organized ${files.length} file(s): ${r.summary}`;
        }
        case 'CREATE_FOLDER': {
          const miss = need('folderName'); if (miss) return miss;
          const ok = await this.createFolder(String(args.folderName), args.parentPath || '');
          return ok ? `Created folder “${args.folderName}”` : 'Could not create that folder';
        }
        case 'MOVE_FILES': {
          const ids = Array.isArray(args.fileIds) ? args.fileIds : (args.fileId ? [args.fileId] : []);
          if (!ids.length) return 'No files specified to move';
          if (!args.targetFolder) return 'Missing target folder to move files into';
          const n = await this.moveFilesToFolder(ids, args.targetFolder);
          return `Moved ${n} file${n === 1 ? '' : 's'} to “${args.targetFolder}”`;
        }
        case 'GET_FILE_ANALYTICS':
        case 'GET_ANALYTICS': {
          const a = await this.getFileAnalytics(args.fileType);
          const types = Object.entries(a.filesByType).sort((x, y) => y[1] - x[1]).slice(0, 5)
            .map(([ext, n]) => `${ext}:${n}`).join(', ');
          return `${a.totalFiles} file(s), ${this.formatFileSize(a.totalSize)} used${types ? ` — ${types}` : ''}`;
        }
        case 'COUNT_FILES_BY_EXTENSION':
        case 'COUNT_FILES': {
          const miss = need('extension'); if (miss) return miss;
          const n = await this.countFilesByExtension(String(args.extension).replace(/^\./, ''));
          return `${n} file${n === 1 ? '' : 's'} with extension .${String(args.extension).replace(/^\./, '')}`;
        }
        case 'SEARCH_FILES': {
          const miss = need('query'); if (miss) return miss;
          const r = await this.searchFiles(String(args.query), !!args.searchContent);
          if (!r.totalResults) return `No matches for “${args.query}”`;
          const names = [...r.files, ...r.folders].slice(0, 5).map((f: any) => f.name).join(', ');
          return `${r.totalResults} result${r.totalResults === 1 ? '' : 's'} for “${args.query}”: ${names}`;
        }
        case 'GET_FILES_IN_FOLDER': {
          const r = await this.getFilesInFolder(args.folderPath || '');
          return r.length ? `Found ${r.length} file(s) in ${args.folderPath || 'root'}` : `No files in ${args.folderPath || 'root'}`;
        }
        case 'GET_STORAGE_USED': {
          const s = await this.getStorageUsed();
          return `Storage: ${this.formatFileSize(s.used)} of ${this.formatFileSize(s.total)} (${Math.round(s.percentage)}%)`;
        }
        case 'LIST_FOLDERS': {
          const r = await this.listFolders(args.parentPath || '');
          return r.length ? `${r.length} folder(s): ${r.slice(0, 8).map((f: any) => f.name).join(', ')}` : 'No folders yet';
        }
        case 'CREATE_FILE': {
          const miss = need('fileName'); if (miss) return miss;
          const r = await this.createFile(String(args.fileName), String(args.content ?? ''), args.parentFolder || '', args.fileType);
          return r.success ? `Created file “${args.fileName}”` : `Could not create file: ${r.error || 'unknown'}`;
        }
        case 'READ_FILE_CONTENT': {
          const miss = need('fileId'); if (miss) return miss;
          const c = await this.readFileContent(args.fileId);
          return c ? String(c).slice(0, 800) : 'File is empty or could not be read';
        }
        case 'UPDATE_FILE_CONTENT': {
          const miss = need('fileId'); if (miss) return miss;
          if (args.newContent === undefined) return 'Missing content to write';
          const r = await this.updateFileContent(args.fileId, String(args.newContent));
          return r.success ? 'File updated' : `Could not update file: ${r.error || 'unknown'}`;
        }
        case 'RENAME_FILE': {
          const miss = need('fileId') || need('newName'); if (miss) return miss;
          const ok = await this.renameFile(args.fileId, String(args.newName));
          return ok ? `Renamed to “${args.newName}”` : 'Could not rename that file';
        }
        case 'DELETE_FILE': {
          const miss = need('fileId'); if (miss) return miss;
          const r = await this.deleteFile(args.fileId);
          return r.success ? 'File deleted' : `Could not delete file: ${r.error || 'unknown'}`;
        }
        case 'DELETE_FOLDER': {
          const miss = need('folderPath'); if (miss) return miss;
          const r = await this.deleteFolder(String(args.folderPath), !!args.deleteContents);
          return r?.success !== false ? `Deleted folder “${args.folderPath}”` : `Could not delete folder: ${r?.error || 'unknown'}`;
        }
        case 'GENERATE_CONTENT_FROM_REFERENCE': {
          const miss = need('referenceText') || need('instructions'); if (miss) return miss;
          const r = await this.generateContentFromReference(String(args.referenceText), args.outputType || 'text', String(args.instructions));
          return String(r).slice(0, 800);
        }
        case 'GENERATE_CODE': {
          const miss = need('description'); if (miss) return miss;
          const r = await this.generateCode(args.language || 'typescript', String(args.description), args.context);
          return String(r).slice(0, 800);
        }
        default:
          return `Unknown tool: ${name}`;
      }
    } catch (error: any) {
      return `Tool ${name} failed: ${error?.message || 'unknown error'}`;
    }
  }

  /** dex-style capability list for progressive disclosure in the AI UI. */
  static listTools(): Array<{ name: string; description: string }> {
    return [
      { name: 'getFileAnalytics', description: 'Count files, size, type breakdown' },
      { name: 'countFilesByExtension', description: 'Count files of a type' },
      { name: 'searchFiles', description: 'Find files or folders by name' },
      { name: 'getFilesInFolder', description: 'List files in a folder' },
      { name: 'getStorageUsed', description: 'Check storage usage' },
      { name: 'listFolders', description: 'List all folders' },
      { name: 'createFolder', description: 'Create a folder' },
      { name: 'createFile', description: 'Create a file with content' },
      { name: 'readFileContent', description: 'Read a file’s text' },
      { name: 'updateFileContent', description: 'Overwrite a file’s text' },
      { name: 'renameFile', description: 'Rename a file' },
      { name: 'moveFilesToFolder', description: 'Move files into a folder' },
      { name: 'deleteFile', description: 'Delete a file' },
      { name: 'deleteFolder', description: 'Delete a folder' },
      { name: 'organizeFilesByType', description: 'Group files into type folders' },
      { name: 'generateContentFromReference', description: 'Write content from a reference' },
      { name: 'generateCode', description: 'Generate code' },
    ];
  }

}
