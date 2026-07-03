/**
 * Embed Page — Public embed viewer for SquidEmbed tokens
 * Renders embedded files/folders in a frameless view
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  FileText, Folder, Image, Video, Music, Download,
  ExternalLink, Lock, AlertCircle,
} from '@/lib/icon-map';

interface EmbedData {
  entity_id: string;
  entity_type: 'file' | 'folder';
  is_active: boolean;
  embed_config: Record<string, any>;
}

const EmbedPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [embedData, setEmbedData] = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const loadEmbed = async () => {
      try {
        // Fetch embed token data
        const { data, error: fetchError } = await supabase
          .from('embed_tokens')
          .select('entity_id, entity_type, is_active, embed_config')
          .eq('id', token)
          .single();

        if (fetchError || !data) {
          setError('Embed not found');
          return;
        }

        if (!data.is_active) {
          setError('This embed has been revoked by its owner');
          return;
        }

        setEmbedData(data as EmbedData);

        // Increment view count
        await supabase.rpc('increment_embed_view' as any, {
          p_token_id: token,
        });
      } catch (e: any) {
        setError(e.message || 'Failed to load embed');
      } finally {
        setLoading(false);
      }
    };

    loadEmbed();
  }, [token]);

  // Get theme from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const theme = urlParams.get('theme') || embedData?.embed_config?.theme || 'dark';
  const layout = urlParams.get('layout') || embedData?.embed_config?.layout || 'grid';
  const borderRadius = embedData?.embed_config?.borderRadius ?? 12;

  if (loading) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center',
        theme === 'dark' ? 'bg-[#0d1117] text-white' : 'bg-gray-50 text-gray-900',
      )}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm opacity-60">Loading embed...</p>
        </div>
      </div>
    );
  }

  if (error || !embedData) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center p-8',
        theme === 'dark' ? 'bg-[#0d1117] text-white' : 'bg-gray-50 text-gray-900',
      )}>
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            theme === 'dark' ? 'bg-white/5' : 'bg-gray-200',
          )}>
            <Lock className="w-5 h-5 opacity-40" />
          </div>
          <p className="text-sm font-medium opacity-80">{error || 'Embed not available'}</p>
          <p className="text-xs opacity-40">This content is private or has been removed.</p>
        </div>
      </div>
    );
  }

  // For file embeds, show the file viewer
  if (embedData.entity_type === 'file') {
    return (
      <FileEmbedView
        fileId={embedData.entity_id}
        theme={theme as 'dark' | 'light'}
        borderRadius={borderRadius}
        showBranding={embedData.embed_config?.showBranding !== false}
      />
    );
  }

  // For folder embeds, show the folder browser
  return (
    <FolderEmbedView
      folderId={embedData.entity_id}
      theme={theme as 'dark' | 'light'}
      layout={layout as 'grid' | 'list' | 'gallery'}
      borderRadius={borderRadius}
      showBranding={embedData.embed_config?.showBranding !== false}
    />
  );
};

// ── File Embed View ────────────────────────────────────────────

function FileEmbedView({ fileId, theme, borderRadius, showBranding }: {
  fileId: string;
  theme: 'dark' | 'light';
  borderRadius: number;
  showBranding: boolean;
}) {
  const [file, setFile] = useState<any>(null);

  useEffect(() => {
    const loadFile = async () => {
      const { data } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .single();
      setFile(data);
    };
    loadFile();
  }, [fileId]);

  if (!file) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center', theme === 'dark' ? 'bg-[#0d1117]' : 'bg-gray-50')}>
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isImage = file.type?.startsWith('image/');
  const isVideo = file.type?.startsWith('video/');
  const isAudio = file.type?.startsWith('audio/');
  const isPdf = file.type?.includes('pdf');

  return (
    <div className={cn(
      'min-h-screen flex flex-col',
      theme === 'dark' ? 'bg-[#0d1117] text-white' : 'bg-gray-50 text-gray-900',
    )} style={{ borderRadius }}>
      <div className="flex-1 flex items-center justify-center p-4">
        {isImage ? (
          <div className="max-w-full max-h-full">
            <div className={cn(
              'rounded-lg overflow-hidden',
              theme === 'dark' ? 'bg-[#161b22]' : 'bg-white shadow-sm',
            )} style={{ borderRadius }}>
              <img
                src={`/api/serve-file/${fileId}`}
                alt={file.name}
                className="max-w-full max-h-[80vh] object-contain"
              />
            </div>
          </div>
        ) : isVideo ? (
          <video
            src={`/api/serve-file/${fileId}`}
            controls
            className="max-w-full max-h-[80vh] rounded-lg"
            style={{ borderRadius }}
          />
        ) : isAudio ? (
          <div className={cn(
            'w-full max-w-md p-6 rounded-xl',
            theme === 'dark' ? 'bg-[#161b22]' : 'bg-white shadow-sm',
          )} style={{ borderRadius }}>
            <div className="flex items-center gap-3 mb-4">
              <Music className="w-5 h-5 opacity-60" />
              <div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs opacity-50">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            </div>
            <audio src={`/api/serve-file/${fileId}`} controls className="w-full" />
          </div>
        ) : isPdf ? (
          <iframe
            src={`/api/serve-file/${fileId}`}
            className="w-full max-w-4xl h-[85vh] rounded-lg border-0"
            style={{ borderRadius }}
          />
        ) : (
          <div className={cn(
            'flex flex-col items-center gap-3 p-8 rounded-xl',
            theme === 'dark' ? 'bg-[#161b22]' : 'bg-white shadow-sm',
          )} style={{ borderRadius }}>
            <FileText className="w-8 h-8 opacity-40" />
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs opacity-50">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            <a
              href={`/api/serve-file/${fileId}?download=true`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Download className="w-3 h-3" />
              Download
            </a>
          </div>
        )}
      </div>
      {showBranding && (
        <div className="text-center py-2">
          <p className="text-[10px] opacity-30">Powered by SquidCloud</p>
        </div>
      )}
    </div>
  );
}

// ── Folder Embed View ──────────────────────────────────────────

function FolderEmbedView({ folderId, theme, layout, borderRadius, showBranding }: {
  folderId: string;
  theme: 'dark' | 'light';
  layout: 'grid' | 'list' | 'gallery';
  borderRadius: number;
  showBranding: boolean;
}) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFiles = async () => {
      const { data } = await supabase
        .from('files')
        .select('*')
        .eq('parent_folder', folderId)
        .order('created_at', { ascending: false })
        .limit(100);
      setFiles(data || []);
      setLoading(false);
    };
    loadFiles();
  }, [folderId]);

  if (loading) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center', theme === 'dark' ? 'bg-[#0d1117]' : 'bg-gray-50')}>
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn(
      'min-h-screen',
      theme === 'dark' ? 'bg-[#0d1117] text-white' : 'bg-gray-50 text-gray-900',
    )}>
      <div className="p-4">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Folder className="w-8 h-8 opacity-30 mb-2" />
            <p className="text-sm opacity-50">This folder is empty</p>
          </div>
        ) : layout === 'list' ? (
          <div className="space-y-1">
            {files.map(f => (
              <div key={f.id} className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-100',
              )} style={{ borderRadius: borderRadius / 2 }}>
                <FileIcon type={f.type} theme={theme} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p className="text-xs opacity-40">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              </div>
            ))}
          </div>
        ) : layout === 'gallery' ? (
          <div className="grid grid-cols-2 gap-2">
            {files.filter(f => f.type?.startsWith('image/')).map(f => (
              <div key={f.id} className="aspect-square rounded-lg overflow-hidden" style={{ borderRadius }}>
                <img src={`/api/serve-file/${f.id}`} alt={f.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {files.map(f => (
              <div key={f.id} className={cn(
                'p-3 rounded-xl transition-colors',
                theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-white hover:bg-gray-100 shadow-sm',
              )} style={{ borderRadius }}>
                <div className="flex items-center gap-2 mb-2">
                  <FileIcon type={f.type} theme={theme} />
                </div>
                <p className="text-xs font-medium truncate">{f.name}</p>
                <p className="text-[10px] opacity-40 mt-0.5">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {showBranding && (
        <div className="text-center py-3">
          <p className="text-[10px] opacity-30">Powered by SquidCloud</p>
        </div>
      )}
    </div>
  );
}

function FileIcon({ type, theme }: { type: string; theme: string }) {
  const opacity = theme === 'dark' ? 'opacity-40' : 'opacity-50';
  if (type?.startsWith('image/')) return <Image className={cn('w-4 h-4', opacity)} />;
  if (type?.startsWith('video/')) return <Video className={cn('w-4 h-4', opacity)} />;
  if (type?.startsWith('audio/')) return <Music className={cn('w-4 h-4', opacity)} />;
  if (type?.includes('pdf')) return <FileText className={cn('w-4 h-4', opacity)} />;
  return <FileText className={cn('w-4 h-4', opacity)} />;
}

export default EmbedPage;
