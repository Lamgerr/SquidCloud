
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBytes } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  FileText, 
  Calendar, 
  HardDrive, 
  User, 
  Link,
  Shield,
  Hash,
  Eye,
  Folder,
  Image,
  Video,
  Music,
  Archive,
  Code,
  FileJson,
  MapPin,
  Clock,
  Database,
  FileType,
  Monitor
} from '@/lib/icon-map';

interface FileInfoModalProps {
  file: any | null; // Made more flexible to accept different file interfaces
  open: boolean;
  onClose: () => void;
}

const FileInfoModal: React.FC<FileInfoModalProps> = ({
  file,
  open,
  onClose
}) => {
  if (!file) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDateRelative = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

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
    if (!mimeType) return <FileText className="h-5 w-5 text-gray-500" />;
    if (mimeType.startsWith('image/')) return <Image className="h-5 w-5 text-green-500" />;
    if (mimeType.startsWith('video/')) return <Video className="h-5 w-5 text-red-500" />;
    if (mimeType.startsWith('audio/')) return <Music className="h-5 w-5 text-purple-500" />;
    if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-red-600" />;
    if (mimeType.includes('zip') || mimeType.includes('archive')) return <Archive className="h-5 w-5 text-orange-500" />;
    if (mimeType.includes('json')) return <FileJson className="h-5 w-5 text-yellow-500" />;
    if (mimeType.includes('javascript') || mimeType.includes('typescript')) return <Code className="h-5 w-5 text-blue-500" />;
    return <FileText className="h-5 w-5 text-gray-500" />;
  };

  const getFileSizeCategory = (size: number) => {
    if (size < 1024) return 'Tiny';
    if (size < 1024 * 1024) return 'Small';
    if (size < 1024 * 1024 * 10) return 'Medium';
    if (size < 1024 * 1024 * 100) return 'Large';
    return 'Very Large';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-2xl w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0",
      )}>
        <DialogHeader className="p-5 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            {getFileTypeIcon(file.type)}
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold truncate text-[#E6EDF3]">{file.name}</div>
              <div className="text-[12px] text-[#768390]">{getFileTypeCategory(file.type || '')}</div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 overflow-auto">
          <div className="px-5 pb-5 space-y-5">
            {/* File Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-[10px] bg-[#2D333B] border border-[#373E47]">
                <div className="flex items-center gap-2 mb-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-[#768390]" />
                  <span className="text-[12px] font-medium text-[#8B949E]">Size</span>
                </div>
                <div className="text-[15px] font-semibold text-[#E6EDF3]">{formatBytes(file.size || 0)}</div>
                <div className="text-[11px] text-[#768390]">{getFileSizeCategory(file.size || 0)}</div>
              </div>
              
              <div className="p-3 rounded-[10px] bg-[#2D333B] border border-[#373E47]">
                <div className="flex items-center gap-2 mb-1.5">
                  <FileType className="h-3.5 w-3.5 text-[#768390]" />
                  <span className="text-[12px] font-medium text-[#8B949E]">Type</span>
                </div>
                <div className="text-[15px] font-semibold text-[#E6EDF3]">{getFileTypeCategory(file.type || '')}</div>
                <div className="text-[11px] text-[#768390] truncate">{file.type || 'Unknown'}</div>
              </div>
              
              <div className="p-3 rounded-[10px] bg-[#2D333B] border border-[#373E47]">
                <div className="flex items-center gap-2 mb-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#768390]" />
                  <span className="text-[12px] font-medium text-[#8B949E]">Created</span>
                </div>
                <div className="text-[15px] font-semibold text-[#E6EDF3]">{formatDateRelative(file.created_at)}</div>
                <div className="text-[11px] text-[#768390]">{new Date(file.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Basic Information */}
            <div>
              <h4 className="text-[13px] font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-[#768390]" />
                Basic Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-3">
                  <div>
                    <p className="text-[12px] font-medium text-[#8B949E] mb-1">File Name</p>
                    <p className="text-[13px] break-all p-2.5 rounded-[8px] bg-[#2D333B] border border-[#373E47] text-[#E6EDF3]">{file.name}</p>
                  </div>
                  
                  <div>
                    <p className="text-[12px] font-medium text-[#8B949E] mb-1">MIME Type</p>
                    <p className="text-[12px] font-mono bg-[#2D333B] border border-[#373E47] p-2.5 rounded-[8px] text-[#E6EDF3]">{file.type || 'Unknown'}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-[12px] font-medium text-[#8B949E] mb-1">File Size</p>
                    <div className="bg-[#2D333B] border border-[#373E47] p-2.5 rounded-[8px]">
                      <p className="text-[13px] text-[#E6EDF3]">{formatBytes(file.size || 0)}</p>
                      <p className="text-[11px] text-[#768390]">{(file.size || 0).toLocaleString()} bytes</p>
                    </div>
                  </div>
                  
                  {file.parent_folder && (
                    <div>
                      <p className="text-[12px] font-medium text-[#8B949E] mb-1">Location</p>
                      <div className="flex items-center gap-2 bg-[#2D333B] border border-[#373E47] p-2.5 rounded-[8px]">
                        <Folder className="h-3.5 w-3.5 text-[#58A6FF]" />
                        <p className="text-[12px] font-mono truncate text-[#E6EDF3]">{file.parent_folder}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="h-px bg-[#2D333B]" />
            
            {/* Timestamps */}
            <div>
              <h4 className="text-[13px] font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-[#768390]" />
                Timestamps
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-[10px] bg-[#2D333B] border border-[#373E47]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#58A6FF]" />
                    <span className="text-[12px] font-medium text-[#8B949E]">Created</span>
                  </div>
                  <p className="text-[13px] text-[#E6EDF3]">{formatDate(file.created_at)}</p>
                  <p className="text-[11px] text-[#768390]">{formatDateRelative(file.created_at)}</p>
                </div>
                
                {file.updated_at && (
                  <div className="p-3 rounded-[10px] bg-[#2D333B] border border-[#373E47]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[#58A6FF]" />
                      <span className="text-[12px] font-medium text-[#8B949E]">Last Modified</span>
                    </div>
                    <p className="text-[13px] text-[#E6EDF3]">{formatDate(file.updated_at)}</p>
                    <p className="text-[11px] text-[#768390]">{formatDateRelative(file.updated_at)}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="h-px bg-[#2D333B]" />
            
            {/* Storage & Security */}
            <div>
              <h4 className="text-[13px] font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-[#768390]" />
                Storage & Security
              </h4>
              <div className="space-y-3">
                <div className="p-3 rounded-[10px] bg-[#2D333B] border border-[#373E47]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Hash className="h-3.5 w-3.5 text-[#768390]" />
                    <span className="text-[12px] font-medium text-[#8B949E]">File ID</span>
                  </div>
                  <p className="text-[11px] font-mono bg-[#1C2128] p-2 rounded-[6px] break-all text-[#8B949E]">{file.id}</p>
                </div>
                
                {(file.encrypted || file.shared || file.is_public || file.preview_available) && (
                  <div className="flex flex-wrap gap-2">
                    {file.encrypted && (
                      <Badge variant="outline" className="justify-center bg-[#1A3A5C] border-[#58A6FF]/30 text-[#58A6FF]">
                        <Shield className="h-3 w-3 mr-1" />
                        Encrypted
                      </Badge>
                    )}
                    {file.shared && (
                      <Badge variant="outline" className="justify-center bg-[#2D333B] border-[#373E47] text-[#8B949E]">
                        <Link className="h-3 w-3 mr-1" />
                        Shared
                      </Badge>
                    )}
                    {file.is_public && (
                      <Badge variant="outline" className="justify-center bg-[#2D333B] border-[#373E47] text-[#8B949E]">
                        <Eye className="h-3 w-3 mr-1" />
                        Public
                      </Badge>
                    )}
                    {file.preview_available && (
                      <Badge variant="outline" className="justify-center bg-[#2D333B] border-[#373E47] text-[#8B949E]">
                        <Monitor className="h-3 w-3 mr-1" />
                        Preview
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Technical Details */}
            {(file.processor || file.storage_path || file.user_id) && (
              <>
                <div className="h-px bg-[#2D333B]" />
                <div>
                  <h4 className="text-[13px] font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
                    <Code className="h-3.5 w-3.5 text-[#768390]" />
                    Technical Details
                  </h4>
                  <div className="space-y-3">
                    {file.processor && (
                      <div>
                        <p className="text-[12px] font-medium text-[#8B949E] mb-1">Processor</p>
                        <p className="text-[12px] font-mono bg-[#2D333B] border border-[#373E47] p-2.5 rounded-[8px] text-[#E6EDF3]">{file.processor}</p>
                      </div>
                    )}
                    {file.storage_path && (
                      <div>
                        <p className="text-[12px] font-medium text-[#8B949E] mb-1">Storage Path</p>
                        <p className="text-[11px] font-mono bg-[#2D333B] border border-[#373E47] p-2.5 rounded-[8px] break-all text-[#E6EDF3]">{file.storage_path}</p>
                      </div>
                    )}
                    {file.user_id && (
                      <div>
                        <p className="text-[12px] font-medium text-[#8B949E] mb-1">Owner ID</p>
                        <p className="text-[11px] font-mono bg-[#2D333B] border border-[#373E47] p-2.5 rounded-[8px] break-all text-[#E6EDF3]">{file.user_id}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Additional Metadata */}
            {(file.checksum || file.version || file.compression) && (
              <>
                <div className="h-px bg-[#2D333B]" />
                <div>
                  <h4 className="text-[13px] font-semibold text-[#E6EDF3] mb-3">Additional Metadata</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {file.checksum && (
                      <div>
                        <p className="text-[12px] font-medium text-[#8B949E] mb-1">Checksum</p>
                        <p className="text-[11px] bg-[#2D333B] border border-[#373E47] p-2.5 rounded-[8px] font-mono break-all text-[#E6EDF3]">{file.checksum}</p>
                      </div>
                    )}
                    {file.version && (
                      <div>
                        <p className="text-[12px] font-medium text-[#8B949E] mb-1">Version</p>
                        <p className="text-[13px] bg-[#2D333B] border border-[#373E47] p-2.5 rounded-[8px] text-[#E6EDF3]">{file.version}</p>
                      </div>
                    )}
                    {file.compression && (
                      <div>
                        <p className="text-[12px] font-medium text-[#8B949E] mb-1">Compression</p>
                        <p className="text-[13px] bg-[#2D333B] border border-[#373E47] p-2.5 rounded-[8px] text-[#E6EDF3]">{file.compression}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default FileInfoModal;
