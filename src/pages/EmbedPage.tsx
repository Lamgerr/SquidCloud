/**
 * Embed Page — Public embed viewer for SquidEmbed tokens
 * Renders embedded files/folders in a frameless view
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { PageFrame } from '@/components/layout/PageFrame';

const EMBED_CSS = `
.emb-root{background:var(--sa-bg,#090b0a);color:var(--sa-text,#e8e7e1)}
.emb-dark,.emb-light{background:var(--sa-bg,#090b0a);color:var(--sa-text,#e8e7e1)}
.emb-center{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.emb-spin{width:28px;height:28px;border:1px solid var(--sa-line,#1f2221);border-top-color:var(--sa-text,#e8e7e1);border-radius:50%;animation:emb-spin .8s linear infinite}
@keyframes emb-spin{to{transform:rotate(360deg)}}
.emb-icon{width:48px;height:48px;display:grid;place-items:center;border:1px solid var(--sa-line,#1f2221);border-radius:14px;color:var(--sa-mute,#8d8f89);background:var(--sa-bg-2,#0e1110)}
.emb-msg{margin:0;font-size:14px;color:var(--sa-text,#e8e7e1);text-align:center}
.emb-sub{margin:0;font-size:12px;color:var(--sa-dim,#62655f);text-align:center}
.emb-file{min-height:100vh;display:flex;flex-direction:column}
.emb-stage{flex:1;display:flex;align-items:center;justify-content:center;padding:24px}
.emb-surface{background:var(--sa-bg-2,#0e1110);border:1px solid var(--sa-line,#1f2221);overflow:hidden}
.emb-audio{width:100%;max-width:420px;padding:24px;background:var(--sa-bg-2,#0e1110);border:1px solid var(--sa-line,#1f2221);border-radius:16px}
.emb-dl{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:8px;background:var(--sa-text,#e8e7e1);color:var(--sa-bg,#090b0a);font-size:12px;text-decoration:none}
.emb-brand{padding:12px;text-align:center;font-size:10px;color:var(--sa-dim,#62655f)}
.emb-list{display:grid;gap:4px}
.emb-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px}
.emb-row:hover{background:var(--sa-bg-3,#141816)}
.emb-row p{margin:0;font-size:13px;color:var(--sa-text,#e8e7e1)}
.emb-row small{font-size:11px;color:var(--sa-dim,#62655f)}
.emb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.emb-tile{padding:14px;background:var(--sa-bg-2,#0e1110);border:1px solid var(--sa-line,#1f2221)}
.emb-tile:hover{background:var(--sa-bg-3,#141816)}
.emb-tile p{margin:0;font-size:12px;color:var(--sa-text,#e8e7e1)}
.emb-tile small{font-size:10px;color:var(--sa-dim,#62655f)}
.emb-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.emb-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px 16px;text-align:center;color:var(--sa-mute,#8d8f89)}
`;
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
      <PageFrame title="Embed" subtitle="Loading embed…">
        <style>{EMBED_CSS}</style>
        <div className="emb-center" style={{ minHeight: 0 }}>
          <div className="emb-spin" />
        </div>
      </PageFrame>
    );
  }

  if (error || !embedData) {
    return (
      <PageFrame title="Embed unavailable" subtitle={error || 'Embed not available'}>
        <style>{EMBED_CSS}</style>
        <div className="emb-center" style={{ minHeight: 0 }}>
          <div className="emb-icon"><Lock className="w-5 h-5" /></div>
          <p className="emb-sub" style={{ marginTop: 12 }}>This content is private or has been removed.</p>
        </div>
      </PageFrame>
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
      <div className={cn('emb-root emb-center', theme === 'dark' ? 'emb-dark' : 'emb-light')}>
        <style>{EMBED_CSS}</style>
        <div className="emb-spin" />
      </div>
    );
  }

  const isImage = file.type?.startsWith('image/');
  const isVideo = file.type?.startsWith('video/');
  const isAudio = file.type?.startsWith('audio/');
  const isPdf = file.type?.includes('pdf');

  return (
    <div className={cn('emb-root emb-file', theme === 'dark' ? 'emb-dark' : 'emb-light')} style={{ borderRadius }}>
      <style>{EMBED_CSS}</style>
      <div className="emb-stage">
        {isImage ? (
          <div className="max-w-full max-h-full">
            <div className="emb-surface" style={{ borderRadius }}>
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
          <div className="emb-audio" style={{ borderRadius }}>
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
          <div className="emb-audio" style={{ borderRadius, display: 'grid', justifyItems: 'center', gap: 12 }}>
            <FileText className="w-8 h-8 opacity-40" />
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs opacity-50">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            <a
              href={`/api/serve-file/${fileId}?download=true`}
              className="emb-dl"
            >
              <Download className="w-3 h-3" />
              Download
            </a>
          </div>
        )}
      </div>
      {showBranding && (
        <div className="emb-brand">
          <p>Powered by SquidCloud</p>
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
      <div className={cn('emb-root emb-center', theme === 'dark' ? 'emb-dark' : 'emb-light')}>
        <style>{EMBED_CSS}</style>
        <div className="emb-spin" />
      </div>
    );
  }

  return (
    <div className={cn('emb-root', theme === 'dark' ? 'emb-dark' : 'emb-light')}>
      <style>{EMBED_CSS}</style>
      <div className="p-4">
        {files.length === 0 ? (
          <div className="emb-empty">
            <Folder className="w-8 h-8 mb-2" />
            <p>This folder is empty</p>
          </div>
        ) : layout === 'list' ? (
          <div className="emb-list">
            {files.map(f => (
              <div key={f.id} className="emb-row" style={{ borderRadius: borderRadius / 2 }}>
                <FileIcon type={f.type} theme={theme} />
                <div className="flex-1 min-w-0">
                  <p>{f.name}</p>
                  <small>{(f.size / 1024 / 1024).toFixed(1)} MB</small>
                </div>
              </div>
            ))}
          </div>
        ) : layout === 'gallery' ? (
          <div className="emb-gallery">
            {files.filter(f => f.type?.startsWith('image/')).map(f => (
              <div key={f.id} className="emb-tile aspect-square" style={{ borderRadius }}>
                <img src={`/api/serve-file/${f.id}`} alt={f.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="emb-grid">
            {files.map(f => (
              <div key={f.id} className="emb-tile" style={{ borderRadius }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <FileIcon type={f.type} theme={theme} />
                </div>
                <p>{f.name}</p>
                <small>{(f.size / 1024 / 1024).toFixed(1)} MB</small>
              </div>
            ))}
          </div>
        )}
      </div>
      {showBranding && (
        <div className="emb-brand">
          <p>Powered by SquidCloud</p>
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
