
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Eye, Download, File, FileText, Image, Video, Music, FileSpreadsheet, FileCode, Lock } from 'lucide-react';
import { downloadFile } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface FilePreviewProps {
  file: {
    id: string;
    name: string;
    type: string;
    previewUrl?: string;
    htmlUrl?: string;
    encrypted: boolean;
    processor?: string;
    preview_available?: boolean;
  };
  onClose?: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, onClose }) => {
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && !previewContent) {
      loadPreview();
    }
  }, [open, previewContent]);

  useEffect(() => {
    if (!open && onClose) {
      onClose();
    }
  }, [open, onClose]);

  const loadPreview = async () => {
    if (!file.id) return;
    
    setLoading(true);
    
    try {
      if (file.encrypted && !file.previewUrl) {
        const blob = await downloadFile(file.id);
        const url = URL.createObjectURL(blob);
        setPreviewContent(url);
      } 
      else if (file.previewUrl) {
        setPreviewContent(file.previewUrl);
      }
    } catch (error) {
      console.error("Preview error:", error);
      toast({
        title: "Preview failed",
        description: "There was a problem loading the file preview",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      setLoading(true);
      const blob = await downloadFile(file.id);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download complete",
        description: `${file.name} has been successfully downloaded`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: "There was a problem downloading your file",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = () => {
    if (file.type.startsWith('image/')) return <Image className="h-6 w-6 text-blue-500" />;
    if (file.type.startsWith('video/')) return <Video className="h-6 w-6 text-red-500" />;
    if (file.type.startsWith('audio/')) return <Music className="h-6 w-6 text-green-500" />;
    if (file.type.includes('pdf')) return <FileText className="h-6 w-6 text-red-600" />;
    if (file.type.includes('csv') || file.type.includes('excel') || file.type.includes('spreadsheet')) 
      return <FileSpreadsheet className="h-6 w-6 text-green-600" />;
    if (file.type.includes('json') || file.type.includes('javascript') || file.type.includes('html') || file.type.includes('css')) 
      return <FileCode className="h-6 w-6 text-purple-600" />;
    return <File className="h-6 w-6 text-gray-500" />;
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!previewContent) {
      return (
        <div className="flex flex-col justify-center items-center h-64">
          <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
            {getFileIcon()}
          </div>
          <p className="text-muted-foreground">No preview available for this file type</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4 mr-2" />
            Download to view
          </Button>
        </div>
      );
    }

    if (file.processor === "res54" && file.preview_available) {
      if (file.type.startsWith('image/')) {
        return (
          <div className="flex justify-center">
            <img 
              src={`/api/preview/${file.id}`} 
              alt={file.name} 
              className="max-w-full max-h-[500px] object-contain rounded-md" 
            />
          </div>
        );
      } else if (file.type.startsWith('video/')) {
        return (
          <div className="flex justify-center">
            <video 
              controls 
              className="max-w-full max-h-[500px] rounded-md"
            >
              <source src={`/api/preview/${file.id}`} type={file.type} />
              Your browser does not support the video tag.
            </video>
          </div>
        );
      } else if (file.type === 'application/pdf' || file.type.startsWith('text/')) {
        return (
          <div className="flex justify-center">
            <iframe 
              src={`/api/preview/${file.id}`} 
              className="w-full h-[500px] rounded-md border"
            ></iframe>
          </div>
        );
      }
    }

    if (file.type.startsWith('image/')) {
      return <img src={previewContent} alt={file.name} className="max-w-full h-auto max-h-[70vh] object-contain rounded-md" />;
    }

    if (file.type.startsWith('video/')) {
      return (
        <video controls className="max-w-full h-auto max-h-[70vh] rounded-md">
          <source src={previewContent} type={file.type} />
          Your browser does not support the video tag.
        </video>
      );
    }

    if (file.type.startsWith('audio/')) {
      return (
        <div className="p-8 bg-slate-100 dark:bg-slate-800 rounded-md">
          <audio controls className="w-full">
            <source src={previewContent} type={file.type} />
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    }

    if (file.type === 'application/pdf') {
      return (
        <iframe 
          src={`${previewContent}#view=fitH`} 
          className="w-full h-[70vh] rounded-md border"
          title={file.name}
        />
      );
    }

    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
          {getFileIcon()}
        </div>
        <p className="text-muted-foreground">This file type cannot be previewed directly</p>
        <div className="flex gap-2 mt-4">
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          <Button 
            onClick={handleDownload}
            disabled={loading}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen && onClose) {
        onClose();
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getFileIcon()}
            <span className="truncate max-w-[500px]">{file.name}</span>
            {file.encrypted && (
              <span className="inline-flex items-center ml-2 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full text-muted-foreground">
                <Lock className="h-3 w-3 mr-1" />
                Encrypted
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          {renderPreview()}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          <Button 
            onClick={handleDownload}
            disabled={loading}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilePreview;
