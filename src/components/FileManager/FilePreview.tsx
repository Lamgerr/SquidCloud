
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download, Share2, Eye, FileText } from 'lucide-react';
import { downloadFileById } from '@/lib/file-manager';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileSystemItem, 
  GetFilesystemItemResult, 
  FilePreviewData,
  RpcResponse,
  GetFilesystemItemFunctionArgs
} from '@/types/file-manager';

interface FilePreviewProps {
  fileId: string;
  fileType?: string;
  onClose: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ fileId, fileType = '', onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [fileData, setFileData] = useState<FilePreviewData | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchFileData = async () => {
      try {
        setIsLoading(true);

        // First get the filesystem entry with proper typing
        const { data: fsData, error: fsError } = await supabase
          .rpc('get_filesystem_item', { item_id: fileId } as GetFilesystemItemFunctionArgs) as RpcResponse<GetFilesystemItemResult[]>;

        if (fsError || !fsData || fsData.length === 0) {
          console.error("Error fetching file system item:", fsError);
          throw new Error("File not found");
        }

        const fileEntry = fsData[0];
        
        // Then get the actual file data if file_id exists
        if (fileEntry.file_id) {
          const { data: fileDetails, error: fileError } = await supabase
            .from('files')
            .select('*')
            .eq('id', fileEntry.file_id)
            .single();

          if (fileError) throw fileError;
          
          const fullFileData: FilePreviewData = {
            ...fileEntry,
            ...fileDetails,
            file_id: fileEntry.file_id  // Make sure file_id is included
          };
          
          setFileData(fullFileData);

          // Generate preview URL if applicable
          if (fullFileData.preview_available) {
            // Handle preview generation or URL
          } else if (fileDetails.type?.startsWith('image/')) {
            const { data: urlData } = await supabase.storage
              .from('previews')
              .createSignedUrl(`${fullFileData.id}/preview.jpg`, 60);
              
            if (urlData?.signedUrl) {
              setFileUrl(urlData.signedUrl);
            }
          }
        } else {
          setFileData(fileEntry as unknown as FilePreviewData);
        }
      } catch (error) {
        console.error("Error in FilePreview:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (fileId) {
      fetchFileData();
    }

    return () => {
      // Clean up any resources
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileId]);

  const handleDownload = async () => {
    try {
      if (!fileData || !fileData.file_id) return;
      
      const blob = await downloadFileById(fileData.file_id);
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = fileData.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  const renderPreview = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      );
    }
    
    if (!fileData) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">File not found</p>
          <p className="text-sm text-muted-foreground">The requested file could not be loaded</p>
        </div>
      );
    }
    
    if (fileUrl && fileData.type?.startsWith('image/')) {
      return (
        <div className="flex items-center justify-center p-4">
          <img 
            src={fileUrl} 
            alt={fileData.name}
            className="max-w-full max-h-[70vh] object-contain rounded-md" 
          />
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-4">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Preview not available</p>
        <p className="text-sm text-muted-foreground mb-4">This file type cannot be previewed</p>
        <Button onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download to View
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={!!fileId} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-lg font-semibold">{fileData?.name}</h2>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          {renderPreview()}
        </div>
        
        {fileData && (
          <div className="border-t pt-2 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Type: {fileData.type || 'Unknown'}</span>
              <span>Last modified: {new Date(fileData.updated_at || fileData.created_at || '').toLocaleString()}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FilePreview;
