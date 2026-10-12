import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBytes } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  FileText, Calendar, HardDrive, User, Link, Shield, Hash, Eye,
  Folder, Image, Video, Music, Archive, Code, FileJson, MapPin,
  Clock, Database, FileType, Monitor, Copy, Check, X, Info,
} from '@/lib/icon-map';

interface FileInfoModalProps {
  file: any | null;
  open: boolean;
  onClose: () => void;
}

function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <div className="group flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2">
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground" title={value}>{value}</span>
      <button
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-all hover:bg-accent hover:text-foreground active:scale-90"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

function StatCell({ icon: Icon, label, value, sub }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3.5 transition-colors duration-150 hover:border-border">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1.5 truncate text-[15px] font-semibold tabular-nums tracking-tight text-foreground" title={value}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{sub}</p>}
    </div>
  );
}

function Section({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold text-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {title}
      </h4>
      {children}
    </div>
  );
}

const FileInfoModal: React.FC<FileInfoModalProps> = ({ file, open, onClose }) => {
  if (!file) return null;

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();
  const formatDateRelative = (dateString: string) => formatDistanceToNow(new Date(dateString), { addSuffix: true });

  const getFileTypeCategory = (mimeType: string) => {
    if (!mimeType) return 'File';
    if (mimeType.startsWith('image/')) return 'Image';
    if (mimeType.startsWith('video/')) return 'Video';
    if (mimeType.startsWith('audio/')) return 'Audio';
    if (mimeType.includes('pdf')) return 'PDF Document';
    if (mimeType.includes('text/') || mimeType.includes('json')) return 'Text Document';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'Archive';
    if (mimeType.includes('javascript') || mimeType.includes('typescript')) return 'Code';
    if (mimeType.includes('application/')) return 'Application';
    return 'File';
  };

  const getFileTypeIcon = (mimeType: string) => {
    if (!mimeType) return FileText;
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.startsWith('video/')) return Video;
    if (mimeType.startsWith('audio/')) return Music;
    if (mimeType.includes('pdf')) return FileText;
    if (mimeType.includes('zip') || mimeType.includes('archive')) return Archive;
    if (mimeType.includes('json')) return FileJson;
    if (mimeType.includes('javascript') || mimeType.includes('typescript')) return Code;
    return FileText;
  };

  const getFileSizeCategory = (size: number) => {
    if (size < 1024) return 'Tiny';
    if (size < 1024 * 1024) return 'Small';
    if (size < 1024 * 1024 * 10) return 'Medium';
    if (size < 1024 * 1024 * 100) return 'Large';
    return 'Very Large';
  };

  const TypeIcon = getFileTypeIcon(file.type);
  const flags: Array<{ on: boolean; icon: React.ComponentType<{ className?: string }>; label: string }> = [
    { on: !!file.encrypted, icon: Shield, label: 'Encrypted' },
    { on: !!file.shared, icon: Link, label: 'Shared' },
    { on: !!file.is_public, icon: Eye, label: 'Public' },
    { on: !!file.preview_available, icon: Monitor, label: 'Preview' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[85vh] w-[95vw] max-w-2xl flex-col gap-0 p-0 animate-fade-in-scale">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border/60 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <TypeIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-[15px] font-semibold tracking-tight text-foreground">{file.name}</DialogTitle>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{getFileTypeCategory(file.type || '')}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-5">
            {/* Overview stats */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCell icon={HardDrive} label="Size" value={formatBytes(file.size || 0)} sub={getFileSizeCategory(file.size || 0)} />
              <StatCell icon={FileType} label="Type" value={getFileTypeCategory(file.type || '')} sub={file.type || 'Unknown'} />
              <StatCell icon={Clock} label="Created" value={formatDateRelative(file.created_at)} sub={formatDate(file.created_at)} />
            </div>

            {/* Basic information */}
            <Section icon={FileText} title="Basic Information">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">File Name</p>
                  <p className="break-all rounded-lg border border-border/60 bg-muted/40 p-2.5 text-[13px] text-foreground">{file.name}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">MIME Type</p>
                  <p className="rounded-lg border border-border/60 bg-muted/40 p-2.5 font-mono text-[12px] text-foreground">{file.type || 'Unknown'}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">File Size</p>
                  <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5">
                    <p className="text-[13px] font-semibold tabular-nums text-foreground">{formatBytes(file.size || 0)}</p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground/70">{(file.size || 0).toLocaleString()} bytes</p>
                  </div>
                </div>
                {file.parent_folder && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Location</p>
                    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 p-2.5">
                      <Folder className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <p className="truncate font-mono text-[12px] text-foreground">{file.parent_folder}</p>
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* Timestamps */}
            <Section icon={Calendar} title="Timestamps">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-card/60 p-3.5">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Created</span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-foreground">{formatDate(file.created_at)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">{formatDateRelative(file.created_at)}</p>
                </div>
                {file.updated_at && (
                  <div className="rounded-xl border border-border/60 bg-card/60 p-3.5">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Last Modified</span>
                    </div>
                    <p className="mt-1.5 text-[13px] text-foreground">{formatDate(file.updated_at)}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">{formatDateRelative(file.updated_at)}</p>
                  </div>
                )}
              </div>
            </Section>

            {/* Storage & Security */}
            <Section icon={Database} title="Storage & Security">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {flags.map(f => f.on && (
                    <Badge key={f.label} variant="outline" className="gap-1.5 bg-muted/40 text-[11px] font-medium">
                      <f.icon className="h-3 w-3 text-primary" />
                      {f.label}
                    </Badge>
                  ))}
                </div>
                <CopyValue value={file.id} label="File ID" />
              </div>
            </Section>

            {/* Technical details */}
            {(file.processor || file.storage_path || file.user_id) && (
              <Section icon={Code} title="Technical Details">
                <div className="space-y-3">
                  {file.processor && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Processor</p>
                      <p className="rounded-lg border border-border/60 bg-muted/40 p-2.5 font-mono text-[12px] text-foreground">{file.processor}</p>
                    </div>
                  )}
                  {file.storage_path && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Storage Path</p>
                      <p className="break-all rounded-lg border border-border/60 bg-muted/40 p-2.5 font-mono text-[11px] text-foreground">{file.storage_path}</p>
                    </div>
                  )}
                  {file.user_id && <CopyValue value={file.user_id} label="Owner ID" />}
                </div>
              </Section>
            )}

            {/* Additional metadata */}
            {(file.checksum || file.version || file.compression) && (
              <Section icon={Info} title="Additional Metadata">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {file.checksum && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Checksum</p>
                      <p className="break-all rounded-lg border border-border/60 bg-muted/40 p-2.5 font-mono text-[11px] text-foreground">{file.checksum}</p>
                    </div>
                  )}
                  {file.version && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Version</p>
                      <p className="rounded-lg border border-border/60 bg-muted/40 p-2.5 text-[13px] text-foreground">{file.version}</p>
                    </div>
                  )}
                  {file.compression && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Compression</p>
                      <p className="rounded-lg border border-border/60 bg-muted/40 p-2.5 text-[13px] text-foreground">{file.compression}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default FileInfoModal;
