import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getFileRequestBySlug, submitFileRequest, uploadFile } from '@/lib/api';
import { Inbox, Upload, Check, AlertCircle, Loader2, Globe, Clock, FileText, HardDrive, X } from '@/lib/icon-map';
import { formatBytes } from '@/lib/api';
import { PageFrame } from '@/components/layout/PageFrame';

const FR_CSS = `
.fr-body{max-width:560px;margin:0 auto;text-align:center}
.fr-mark{width:52px;height:52px;margin:0 auto 20px;display:grid;place-items:center;border:1px solid var(--sa-line,#1f2221);border-radius:15px;color:var(--sa-mute,#8d8f89)}
.fr-mark svg{width:22px;height:22px;stroke-width:1.6}
.fr-panel{border:1px solid var(--sa-line,#1f2221);border-radius:16px;background:var(--sa-bg-2,#0e1110);padding:24px;text-align:left}
.fr-title{margin:0;font-size:20px;font-weight:400;letter-spacing:-.03em;color:var(--sa-text,#e8e7e1)}
.fr-desc{margin:8px 0 0;font-size:13px;line-height:1.6;color:var(--sa-mute,#8d8f89)}
.fr-badges{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-bottom:20px}
.fr-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--sa-line,#1f2221);border-radius:999px;font-size:11px;color:var(--sa-mute,#8d8f89)}
.fr-badge svg{width:12px;height:12px}
.fr-notice{padding:14px;border:1px solid var(--sa-line,#1f2221);border-radius:12px;background:var(--sa-bg,#090b0a);text-align:center}
.fr-notice p{margin:0;font-size:13px;color:var(--sa-text,#e8e7e1)}
.fr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:20px 0}
.fr-label{display:block;margin-bottom:8px;font-size:11px;color:var(--sa-mute,#8d8f89)}
.fr-input{width:100%;height:42px;padding:0 12px;background:var(--sa-bg,#090b0a);border:1px solid var(--sa-line,#1f2221);border-radius:10px;color:var(--sa-text,#e8e7e1);font-size:13px}
.fr-input::placeholder{color:var(--sa-dim,#62655f)}
.fr-drop{display:block;padding:28px 16px;border:1px dashed var(--sa-line,#1f2221);border-radius:12px;text-align:center;cursor:pointer;transition:border-color .18s,background .18s}
.fr-drop:hover{border-color:var(--sa-rim,#2f3230);background:var(--sa-bg-3,#141816)}
.fr-drop.off{cursor:not-allowed;opacity:.6}
.fr-drop svg{width:26px;height:26px;margin-bottom:8px;color:var(--sa-mute,#8d8f89)}
.fr-drop p{margin:0;font-size:13px;color:var(--sa-text,#e8e7e1)}
.fr-drop small{display:block;margin-top:6px;font-size:11px;color:var(--sa-dim,#62655f)}
.fr-file{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--sa-line,#1f2221);border-radius:10px;background:var(--sa-bg,#090b0a)}
.fr-file-n{display:flex;align-items:center;gap:8px;min-width:0;font-size:13px;color:var(--sa-text,#e8e7e1)}
.fr-file-n svg{flex:none;color:var(--sa-mute,#8d8f89)}
.fr-file-n span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fr-file-n em{font-style:normal;font-size:11px;color:var(--sa-dim,#62655f)}
.fr-remove{display:grid;place-items:center;width:24px;height:24px;flex:none;border:0;background:transparent;color:var(--sa-mute,#8d8f89);cursor:pointer}
.fr-remove:hover{color:var(--sa-text,#e8e7e1)}
.fr-cta{width:100%;height:44px;margin-top:20px}
.fr-foot{margin-top:28px;font-size:11px;color:var(--sa-dim,#62655f)}
`;

interface FileRequestData {
  id: string;
  title: string;
  description: string;
  slug: string;
  max_files: number;
  max_size_per_file: number;
  allowed_types: string[] | null;
  expires_at: string | null;
  is_active: boolean;
  folder_path: string;
  submission_count: number;
}

const FileRequestPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [request, setRequest] = useState<FileRequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploaderName, setUploaderName] = useState('');
  const [uploaderEmail, setUploaderEmail] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [uploadComplete, setUploadComplete] = useState(false);

  const authRequired = !authLoading && !user;
  const canUpload = !!user && !authLoading;

  const handleSignIn = useCallback(() => {
    const next = slug ? `/r/${slug}` : '/';
    navigate(`/auth?next=${encodeURIComponent(next)}`);
  }, [navigate, slug]);

  const handlePickFiles = useCallback(() => {
    if (!canUpload) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to upload files to this request.',
        variant: 'destructive',
      });
      return;
    }

    document.getElementById('file-input')?.click();
  }, [canUpload, toast]);

  useEffect(() => {
    if (!slug) {
      setError('Invalid file request link');
      setLoading(false);
      return;
    }

    const fetch = async () => {
      try {
        const data = await getFileRequestBySlug(slug);
        setRequest(data);
      } catch (err: any) {
        setError(err.message || 'File request not found or expired');
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [slug]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const validateFiles = (): string | null => {
    if (!request) return 'Request not found';

    if (request.max_files > 0 && selectedFiles.length > request.max_files) {
      return `Maximum ${request.max_files} file(s) allowed`;
    }

    for (const file of selectedFiles) {
      if (request.max_size_per_file > 0 && file.size > request.max_size_per_file) {
        return `"${file.name}" exceeds the maximum file size of ${formatBytes(request.max_size_per_file)}`;
      }

      if (request.allowed_types && request.allowed_types.length > 0) {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!request.allowed_types.some(t => t.toLowerCase() === ext || file.type.startsWith(t))) {
          return `"${file.name}" type is not allowed. Accepted: ${request.allowed_types.join(', ')}`;
        }
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    if (!request || selectedFiles.length === 0) return;
    if (authLoading) return;
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to upload files to this request.',
        variant: 'destructive',
      });
      return;
    }

    const validationError = validateFiles();
    if (validationError) {
      toast({ title: 'Validation error', description: validationError, variant: 'destructive' });
      return;
    }

    setUploading(true);

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadProgress(`Uploading ${i + 1}/${selectedFiles.length}: ${file.name}...`);

      try {
        const uploaded = await uploadFile(file, request.folder_path, (progress) => {
          setUploadProgress(`Uploading ${i + 1}/${selectedFiles.length}: ${Math.round(progress)}%`);
        });

        await submitFileRequest(
          request.id,
          uploaded.id,
          file.name,
          file.size,
          uploaderName || undefined,
          uploaderEmail || undefined,
        );
      } catch (err: any) {
        toast({
          title: `Failed to upload "${file.name}"`,
          description: err.message,
          variant: 'destructive',
        });
        setUploading(false);
        return;
      }
    }

    setUploadComplete(true);
    setUploading(false);
    toast({ title: 'Upload complete!', description: `${selectedFiles.length} file(s) submitted successfully.` });
  };

  if (loading) {
    return (
      <PageFrame title="File Upload Request" subtitle="Loading upload request…">
        <style>{FR_CSS}</style>
        <div className="fr-body">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      </PageFrame>
    );
  }

  if (error || !request) {
    return (
      <PageFrame title="Link Expired or Invalid" subtitle="This upload request link is no longer accepting files. Contact the sender for a new link.">
        <style>{FR_CSS}</style>
        <div className="fr-body">
          <div className="fr-mark"><AlertCircle className="h-6 w-6" /></div>
        </div>
      </PageFrame>
    );
  }

  if (uploadComplete) {
    return (
      <PageFrame title="Files Submitted!" subtitle="Your files have been uploaded successfully. The owner will be notified.">
        <style>{FR_CSS}</style>
        <div className="fr-body">
          <div className="fr-mark"><Check className="h-6 w-6" /></div>
          <p className="fr-desc">
            {selectedFiles.length} file(s) submitted to "{request.title}"
          </p>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame title="File Upload Request" subtitle="Secured by SquidCloud">
      <style>{FR_CSS}</style>
      <div className="fr-body">
        <div className="fr-panel">
          <div className="fr-mark"><Inbox className="h-5 w-5" /></div>
          <h2 className="fr-title">{request.title}</h2>
          {request.description && (
            <p className="fr-desc">{request.description}</p>
          )}
        </div>

        <div className="fr-panel" style={{ marginTop: 12 }}>
          <div className="fr-badges">
            {request.max_files > 0 && (
              <span className="fr-badge">
                <FileText className="w-3 h-3" />
                Max {request.max_files} files
              </span>
            )}
            {request.max_size_per_file > 0 && (
              <span className="fr-badge">
                <HardDrive className="w-3 h-3" />
                Max {formatBytes(request.max_size_per_file)} each
              </span>
            )}
            {request.expires_at && (
              <span className="fr-badge">
                <Clock className="w-3 h-3" />
                Expires {new Date(request.expires_at).toLocaleDateString()}
              </span>
            )}
            {request.allowed_types && request.allowed_types.length > 0 && (
              <span className="fr-badge">
                <Globe className="w-3 h-3" />
                {request.allowed_types.join(', ')}
              </span>
            )}
          </div>

          {authRequired && (
            <div className="fr-notice">
              <p>Uploads for this request need an authenticated account.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={handleSignIn}>
                Sign in to upload
              </Button>
            </div>
          )}

          <div className="fr-grid">
            <div>
              <label className="fr-label">Your name (optional)</label>
              <Input
                className="fr-input"
                placeholder="Name"
                value={uploaderName}
                onChange={e => setUploaderName(e.target.value)}
              />
            </div>
            <div>
              <label className="fr-label">Your email (optional)</label>
              <Input
                className="fr-input"
                type="email"
                placeholder="email@example.com"
                value={uploaderEmail}
                onChange={e => setUploaderEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="fr-label">Files</label>
            <div
              className={`fr-drop${canUpload ? '' : ' off'}`}
              onClick={handlePickFiles}
            >
              <Upload className="h-7 w-7 mx-auto" />
              <p>Click to select files</p>
              <small>
                {request.allowed_types?.length ? request.allowed_types.join(', ') : 'Any file type'} accepted
              </small>
              <input
                id="file-input"
                type="file"
                multiple
                className="hidden"
                disabled={!canUpload || uploading}
                onChange={handleFileSelect}
              />
            </div>

            {selectedFiles.length > 0 && (
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                {selectedFiles.map((file, i) => (
                  <div key={i} className="fr-file">
                    <div className="fr-file-n">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{file.name}</span>
                      <em>{formatBytes(file.size)}</em>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      aria-label={`Remove ${file.name}`}
                      className="fr-remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            className="fr-cta"
            disabled={uploading || selectedFiles.length === 0 || !canUpload}
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {uploadProgress}</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" /> Upload {selectedFiles.length > 0 ? `(${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''})` : ''}</>
            )}
          </Button>
        </div>

        <p className="fr-foot">Powered by SquidCloud · Zero-Knowledge Cloud Infrastructure</p>
      </div>
    </PageFrame>
  );
};

export default FileRequestPage;
