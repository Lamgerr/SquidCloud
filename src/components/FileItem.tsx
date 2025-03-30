
import React from 'react';
import { FileItem as FileItemType, formatBytes } from '@/lib/api';
import { 
  File, 
  FileImage, 
  FileText, 
  FileArchive,
  FileAudio,
  FileVideo,
  FileSpreadsheet,
  Clock,
  Download,
  Share2,
  Trash2,
  Lock,
  MoreVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from '@/hooks/use-mobile';

interface FileItemProps {
  file: FileItemType;
  onSelect?: (file: FileItemType) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onDownload?: (id: string) => void;
  selected?: boolean;
}

const FileItem: React.FC<FileItemProps> = ({ 
  file, 
  onSelect,
  onDelete, 
  onShare, 
  onDownload,
  selected
}) => {
  const isMobile = useIsMobile();
  
  const getFileIcon = () => {
    if (file.type.startsWith('image/')) {
      return <FileImage className="h-10 w-10 text-blue-500" />;
    } else if (file.type.startsWith('video/')) {
      return <FileVideo className="h-10 w-10 text-purple-500" />;
    } else if (file.type.startsWith('audio/')) {
      return <FileAudio className="h-10 w-10 text-pink-500" />;
    } else if (file.type.includes('spreadsheet') || file.type.includes('excel')) {
      return <FileSpreadsheet className="h-10 w-10 text-green-500" />;
    } else if (file.type.includes('zip') || file.type.includes('compressed')) {
      return <FileArchive className="h-10 w-10 text-amber-500" />;
    } else if (file.type.includes('pdf') || file.type.includes('text') || file.type.includes('document')) {
      return <FileText className="h-10 w-10 text-red-500" />;
    }
    return <File className="h-10 w-10 text-gray-500" />;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleClick = () => {
    if (onSelect) {
      onSelect(file);
    }
  };

  const handleDownload = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (onDownload) {
      onDownload(file.id);
    }
    toast({
      title: "Download started",
      description: `${file.name} is being prepared for download`
    });
  };

  const handleShare = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (onShare) {
      onShare(file.id);
    }
    toast({
      title: "File shared",
      description: "Share link has been copied to clipboard"
    });
  };

  const handleDelete = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (onDelete) {
      onDelete(file.id);
    }
    toast({
      title: "File deleted",
      description: `${file.name} has been deleted`
    });
  };

  return (
    <div 
      className={`group p-4 rounded-xl transition-all duration-200 hover:bg-secondary/80 flex items-center gap-4 animate-fade-in ${selected ? 'bg-secondary' : ''}`}
      onClick={handleClick}
    >
      <div className="shrink-0">
        {getFileIcon()}
      </div>
      
      <div className="flex-grow min-w-0">
        <div className="flex items-center">
          <h3 className="font-medium text-foreground truncate">{file.name}</h3>
          {file.encrypted && <Lock className="h-3 w-3 ml-2 text-green-500" />}
        </div>
        <div className="flex items-center text-xs text-muted-foreground mt-1 gap-3">
          <span>{formatBytes(file.size)}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(file.updated_at || file.created_at)}
          </span>
        </div>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-background">
          <DropdownMenuLabel>File Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            <span>Download</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" />
            <span>Share</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default FileItem;
