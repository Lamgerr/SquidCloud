import React, { useState, useEffect } from 'react';
import { X, Download, Share2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { downloadFileById } from '@/lib/file-manager';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

interface FilePreviewProps {
  fileId: string;
  fileType: string;
  onClose: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ fileId, fileType, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [preview, setPreview] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    async function loadPreview() {
      try {
        setLoading(true);
        setError(null);
        
        // Get file details
        const { data: file, error: fileError } = await supabase
          .from('files')
          .select('*')
          .eq('id', fileId)
          .single();
          
        if (fileError) throw fileError;
        
        // Get file system entry using RPC function
        const { data: fsData, error: fsError } = await supabase
          .rpc('get_filesystem_entry_by_file_id', { file_id: fileId });
          
        if (fsError) throw fsError;
        
        if (fsData && fsData.length > 0) {
          setFileName(fsData[0].name);
        } else {
          setFileName(file.name);
        }
        
        // Download the file for preview
        const blob = await downloadFileById(fileId);
        const url = URL.createObjectURL(blob);
        setPreview(url);
        
        // If it's a text file, load the content
        if (fileType.includes('text') || fileType.includes('javascript') || fileType.includes('json') || fileType.includes('css') || fileType.includes('html')) {
          const text = await blob.text();
          setTextContent(text);
        }
      } catch (err: any) {
        console.error('Error loading preview:', err);
        setError(err.message || 'Failed to load preview');
        toast({
          title: 'Error',
          description: 'Failed to load file preview',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    }
    
    loadPreview();
    
    // Cleanup function
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [fileId, fileType, toast]);
  
  const handleDownload = async () => {
    try {
      const fileBlob = await downloadFileById(fileId);
      
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      toast({
        title: 'Download Complete',
        description: `${fileName} has been downloaded.`,
      });
    } catch (error: any) {
      toast({
        title: 'Download Failed',
        description: error.message || 'Failed to download file',
        variant: 'destructive',
      });
    }
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download instead
          </Button>
        </div>
      );
    }

    if (!preview) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <p>Preview not available</p>
          <Button variant="outline" className="mt-4" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download instead
          </Button>
        </div>
      );
    }

    if (fileType.startsWith('image/')) {
      return (
        <div className="flex items-center justify-center h-full">
          <img 
            src={preview} 
            alt={fileName} 
            className="max-w-full max-h-[70vh] object-contain" 
          />
        </div>
      );
    }

    if (fileType.startsWith('video/')) {
      return (
        <div className="flex items-center justify-center h-full">
          <video 
            src={preview} 
            controls 
            className="max-w-full max-h-[70vh]"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (fileType.startsWith('audio/')) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="w-64 h-64 bg-muted rounded-full flex items-center justify-center mb-8">
            <FileText className="h-24 w-24 text-muted-foreground" />
          </div>
          <audio src={preview} controls className="w-full max-w-md" />
        </div>
      );
    }

    if (fileType.includes('pdf')) {
      return (
        <div className="h-full">
          <iframe 
            src={`${preview}#view=FitH`} 
            className="w-full h-[70vh]" 
            title={fileName} 
          />
        </div>
      );
    }

    if (textContent) {
      return (
        <div className="h-full">
          <pre className="bg-muted p-4 rounded overflow-auto h-[70vh] text-sm">
            {textContent}
          </pre>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <p>Preview not available for this file type</p>
        <Button variant="outline" className="mt-4" onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download instead
        </Button>
      </div>
    );
  };

  return (
    <Card className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-semibold truncate">{fileName}</h2>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={handleDownload}>
            <Download className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-grow overflow-auto p-4">
        {renderPreview()}
      </div>
    </Card>
  );
};

export default FilePreview;
