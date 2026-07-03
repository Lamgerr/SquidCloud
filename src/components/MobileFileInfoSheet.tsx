import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import MobileSheet from '@/components/ui/MobileSheet';
import { formatBytes } from '@/lib/api';
import {
  FileText, Image as ImageIcon, Video, Music, Archive, Code, FileJson,
  HardDrive, FileType, Clock, Calendar, Shield, Link, Eye,
  Monitor, Hash, Folder, Database, MapPin, User,
} from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import type { FileItem } from '@/lib/api';

interface MobileFileInfoSheetProps {
  open: boolean;
  onClose: () => void;
  file: FileItem | null;
}

function getTypeIcon(mimeType: string) {
  if (!mimeType) return <FileText className="w-5 h-5 text-[#768390]" />;
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-green-500" />;
  if (mimeType.startsWith('video/')) return <Video className="w-5 h-5 text-red-500" />;
  if (mimeType.startsWith('audio/')) return <Music className="w-5 h-5 text-purple-500" />;
  if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-red-600" />;
  if (mimeType.includes('zip') || mimeType.includes('archive')) return <Archive className="w-5 h-5 text-orange-500" />;
  if (mimeType.includes('json')) return <FileJson className="w-5 h-5 text-yellow-500" />;
  if (mimeType.includes('javascript') || mimeType.includes('typescript')) return <Code className="w-5 h-5 text-blue-500" />;
  return <FileText className="w-5 h-5 text-[#768390]" />;
}

function getTypeCategory(mimeType: string) {
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
}

function getSizeCategory(size: number) {
  if (size < 1024) return 'Tiny';
  if (size < 1024 * 1024) return 'Small';
  if (size < 1024 * 1024 * 10) return 'Medium';
  if (size < 1024 * 1024 * 100) return 'Large';
  return 'Very Large';
}

const InfoCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string }> = ({ icon, label, value, sub }) => (
  <div className="p-3 rounded-[10px] bg-[#2D333B] border border-[#373E47]">
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-[#768390]">{icon}</span>
      <span className="text-[12px] font-medium text-[#8B949E]">{label}</span>
    </div>
    <div className="text-[15px] font-semibold text-[#E6EDF3]">{value}</div>
    {sub && <div className="text-[11px] text-[#768390]">{sub}</div>}
  </div>
);

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <p className="text-[12px] font-medium text-[#8B949E] mb-1">{label}</p>
    {children}
  </div>
);

const MobileFileInfoSheet: React.FC<MobileFileInfoSheetProps> = ({ open, onClose, file }) => {
  if (!file) return null;

  const fmtDate = (d: string) => new Date(d).toLocaleString();
  const fmtRel = (d: string) => formatDistanceToNow(new Date(d), { addSuffix: true });

  return (
    <MobileSheet
      open={open}
      onOpenChange={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-[#2D333B] border border-[#373E47] flex items-center justify-center shrink-0">
            {getTypeIcon(file.type)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-[#E6EDF3] truncate">{file.name}</h3>
            <p className="text-[12px] text-[#768390]">{getTypeCategory(file.type)}</p>
          </div>
        </div>
      }
      className="overflow-y-auto max-h-[70vh]"
    >
      <div className="px-5 py-4 space-y-5">
        <div className="grid grid-cols-3 gap-2.5">
          <InfoCard icon={<HardDrive className="w-3.5 h-3.5" />} label="Size" value={formatBytes(file.size || 0)} sub={getSizeCategory(file.size || 0)} />
          <InfoCard icon={<FileType className="w-3.5 h-3.5" />} label="Type" value={getTypeCategory(file.type)} sub={file.type || 'Unknown'} />
          <InfoCard icon={<Clock className="w-3.5 h-3.5" />} label="Created" value={fmtRel(file.created_at)} sub={new Date(file.created_at).toLocaleDateString()} />
        </div>

        <div className="h-px bg-[#2D333B]" />

        <div>
          <h4 className="text-[13px] font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[#768390]" />
            Basic Information
          </h4>
          <div className="space-y-3">
            <InfoRow label="File Name">
              <p className="text-[13px] break-all p-2.5 rounded-[8px] bg-[#2D333B] border border-[#373E47] text-[#E6EDF3]">{file.name}</p>
            </InfoRow>
            <InfoRow label="MIME Type">
              <p className="text-[12px] font-mono bg-[#2D333B] border border-[#373E47] p-2.5 rounded-[8px] text-[#E6EDF3]">{file.type || 'Unknown'}</p>
            </InfoRow>
            <InfoRow label="File Size">
              <div className="bg-[#2D333B] border border-[#373E47] p-2.5 rounded-[8px]">
                <p className="text-[13px] text-[#E6EDF3]">{formatBytes(file.size || 0)}</p>
                <p className="text-[11px] text-[#768390]">{(file.size || 0).toLocaleString()} bytes</p>
              </div>
            </InfoRow>
            {file.parent_folder && (
              <InfoRow label="Location">
                <div className="flex items-center gap-2 bg-[#2D333B] border border-[#373E47] p-2.5 rounded-[8px]">
                  <Folder className="w-3.5 h-3.5 text-[#58A6FF]" />
                  <p className="text-[12px] font-mono truncate text-[#E6EDF3]">{file.parent_folder}</p>
                </div>
              </InfoRow>
            )}
          </div>
        </div>

        <div className="h-px bg-[#2D333B]" />

        <div>
          <h4 className="text-[13px] font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#768390]" />
            Timestamps
          </h4>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-[10px] bg-[#2D333B] border border-[#373E47]">
              <p className="text-[12px] font-medium text-[#8B949E] mb-1">Created</p>
              <p className="text-[13px] text-[#E6EDF3]">{fmtDate(file.created_at)}</p>
              <p className="text-[11px] text-[#768390]">{fmtRel(file.created_at)}</p>
            </div>
            {file.updated_at && (
              <div className="p-3 rounded-[10px] bg-[#2D333B] border border-[#373E47]">
                <p className="text-[12px] font-medium text-[#8B949E] mb-1">Modified</p>
                <p className="text-[13px] text-[#E6EDF3]">{fmtDate(file.updated_at)}</p>
                <p className="text-[11px] text-[#768390]">{fmtRel(file.updated_at)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-[#2D333B]" />

        <div>
          <h4 className="text-[13px] font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-[#768390]" />
            Storage & Security
          </h4>
          <div className="space-y-3">
            <div className="p-3 rounded-[10px] bg-[#2D333B] border border-[#373E47]">
              <p className="text-[12px] font-medium text-[#8B949E] mb-1.5 flex items-center gap-2">
                <Hash className="w-3 h-3" />
                File ID
              </p>
              <p className="text-[11px] font-mono bg-[#1C2128] p-2 rounded-[6px] break-all text-[#8B949E]">{file.id}</p>
            </div>
            {(file.encrypted || file.shared || file.is_public || file.preview_available) && (
              <div className="flex flex-wrap gap-2">
                {file.encrypted && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#1A3A5C] border border-[#58A6FF]/30 text-[#58A6FF] text-[11px] font-medium">
                    <Shield className="w-3 h-3" /> Encrypted
                  </span>
                )}
                {file.shared && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#2D333B] border border-[#373E47] text-[#8B949E] text-[11px] font-medium">
                    <Link className="w-3 h-3" /> Shared
                  </span>
                )}
                {file.is_public && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#2D333B] border border-[#373E47] text-[#8B949E] text-[11px] font-medium">
                    <Eye className="w-3 h-3" /> Public
                  </span>
                )}
                {file.preview_available && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#2D333B] border border-[#373E47] text-[#8B949E] text-[11px] font-medium">
                    <Monitor className="w-3 h-3" /> Preview
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {(file.processor || file.storage_path || file.user_id) && (
          <>
            <div className="h-px bg-[#2D333B]" />
            <div>
              <h4 className="text-[13px] font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
                <Code className="w-3.5 h-3.5 text-[#768390]" />
                Technical Details
              </h4>
              <div className="space-y-3">
                {file.processor && (
                  <InfoRow label="Processor">
                    <p className="text-[12px] font-mono bg-[#2D333B] border border-[#373E47] p-2.5 rounded-[8px] text-[#E6EDF3]">{file.processor}</p>
                  </InfoRow>
                )}
                {file.storage_path && (
                  <InfoRow label="Storage Path">
                    <p className="text-[11px] font-mono bg-[#2D333B] border border-[#373E47] p-2.5 rounded-[8px] break-all text-[#E6EDF3]">{file.storage_path}</p>
                  </InfoRow>
                )}
                {file.user_id && (
                  <InfoRow label="Owner ID">
                    <p className="text-[11px] font-mono bg-[#2D333B] border border-[#373E47] p-2.5 rounded-[8px] break-all text-[#E6EDF3]">{file.user_id}</p>
                  </InfoRow>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </MobileSheet>
  );
};

export default MobileFileInfoSheet;
