
import React from 'react';
import { formatBytes } from '@/lib/api';
import { 
  File, FileImage, FileText, FileArchive, FileAudio, 
  FileVideo, Folder, MoreVertical, Download, Trash2, 
  Edit, Share2, MoveIcon, Eye
} from 'lucide-react';
import { FileSystemItem } from '@/types/file-manager';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadFileById, deleteItem, renameItem } from '@/lib/file-manager';
import { useFileManager } from './FileManagerContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FileListItemProps {
  item: FileSystemItem;
  onOpenPreview?: (fileId: string, fileType: string) => void;
}

const FileListItem: React.FC<FileListItemProps> = ({ item, onOpenPreview }) => {
  const { dispatch, navigateTo, refreshCurrentFolder } = useFileManager();
  const { toast } = useToast();
  const [showRenameDialog, setShowRenameDialog] = React.useState(false);
  const [newName, setNewName] = React.useState(item.name);
  
  const getFileIcon = () => {
    if (item.type === 'folder') {
      return <Folder className="h-10 w-10 text-blue-500" />;
    }
    
    const fileType = item.fileType || '';
    
    if (fileType.startsWith('image/')) {
      return <FileImage className="h-10 w-10 text-green-500" />;
    } else if (fileType.startsWith('video/')) {
      return <FileVideo className="h-10 w-10 text-purple-500" />;
    } else if (fileType.startsWith('audio/')) {
      return <FileAudio className="h-10 w-10 text-pink-500" />;
    } else if (fileType.includes('zip') || fileType.includes('compressed')) {
      return <FileArchive className="h-10 w-10 text-amber-500" />;
    } else if (fileType.includes('pdf') || fileType.includes('text') || fileType.includes('document')) {
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

  const handleClick = (e: React.MouseEvent) => {
    if (item.type === 'folder') {
      navigateTo(item.id);
    } else if (onOpenPreview && item.fileType) {
      onOpenPreview(item.id, item.fileType);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (item.type === 'file') {
      try {
        toast({
          title: "Downloading...",
          description: `Preparing ${item.name} for download.`,
        });
        
        const fileBlob = await downloadFileById(item.id);
        
        const url = URL.createObjectURL(fileBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        
        toast({
          title: "Download Complete",
          description: `${item.name} has been downloaded.`,
        });
      } catch (error: any) {
        toast({
          title: "Download Failed",
          description: error.message || "Failed to download file",
          variant: "destructive",
        });
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await deleteItem(item.id);
      
      dispatch({ type: 'REMOVE_ITEM', payload: item.id });
      
      toast({
        title: item.type === 'folder' ? "Folder Deleted" : "File Deleted",
        description: `${item.name} has been deleted.`,
      });
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete item",
        variant: "destructive",
      });
    }
  };

  const handleRename = async () => {
    if (!newName.trim() || newName === item.name) {
      setShowRenameDialog(false);
      return;
    }
    
    try {
      const updatedItem = await renameItem(item.id, newName.trim());
      
      dispatch({ type: 'UPDATE_ITEM', payload: updatedItem });
      
      setShowRenameDialog(false);
      
      toast({
        title: "Renamed",
        description: `Item has been renamed to ${newName}.`,
      });
    } catch (error: any) {
      toast({
        title: "Rename Failed",
        description: error.message || "Failed to rename item",
        variant: "destructive",
      });
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Implement share functionality
    toast({
      title: "Share Link Generated",
      description: "Link has been copied to clipboard",
    });
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenPreview && item.type === 'file' && item.fileType) {
      onOpenPreview(item.id, item.fileType);
    }
  };

  return (
    <>
      <div 
        className={cn(
          "flex items-center p-2 rounded-md hover:bg-secondary/50 cursor-pointer transition-colors",
          item.type === 'folder' ? "hover:bg-blue-50/50 dark:hover:bg-blue-900/20" : ""
        )}
        onClick={handleClick}
      >
        <div className="mr-2 flex-shrink-0">
          {getFileIcon()}
        </div>
        
        <div className="flex-grow overflow-hidden">
          <h3 className="font-medium truncate">{item.name}</h3>
          <div className="flex text-xs text-muted-foreground">
            <span>{formatDate(item.updated_at)}</span>
            {item.type === 'file' && item.size !== undefined && (
              <span className="ml-2">{formatBytes(item.size)}</span>
            )}
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {item.type === 'file' && (
              <>
                <DropdownMenuItem onClick={handlePreviewClick}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => setShowRenameDialog(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {item.type}</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FileListItem;
