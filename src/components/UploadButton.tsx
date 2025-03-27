
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, X, Lock, FileSymlink, UploadCloud, Github } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadFile, FileItem } from '@/lib/api';
import { Card } from '@/components/ui/card';

interface UploadButtonProps {
  onUploadComplete?: (file: FileItem) => void;
  onFileUploaded?: (file: any) => void;
  className?: string;
}

const UploadButton: React.FC<UploadButtonProps> = ({ onUploadComplete, onFileUploaded, className }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isChunkedUpload, setIsChunkedUpload] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setCurrentFile(file);
    setIsUploading(true);
    setUploadProgress(0);
    
    // Check if file is larger than 10MB for chunking
    const isLarge = file.size > 10 * 1024 * 1024;
    setIsChunkedUpload(isLarge);
    
    if (isLarge) {
      // Estimate number of chunks (10MB each)
      const estimatedChunks = Math.ceil(file.size / (10 * 1024 * 1024));
      setTotalChunks(estimatedChunks);
    }
    
    try {
      // Notify user about encryption
      toast({
        title: "Preparing file",
        description: "Your file is being encrypted before upload",
      });
      
      // Start progress animation
      let progressInterval: NodeJS.Timeout;
      
      if (isLarge) {
        // For chunked uploads, progress updates differently
        progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 95) {
              clearInterval(progressInterval);
              return 95;
            }
            return prev + (Math.random() * 2); // Slower progress for large files
          });
          
          // Update current chunk indicator periodically
          setCurrentChunk(prev => {
            if (prev >= totalChunks) return totalChunks;
            const elapsed = uploadProgress / 100;
            return Math.min(Math.ceil(elapsed * totalChunks), totalChunks);
          });
        }, 300);
      } else {
        // For regular uploads, simple progress
        progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 95) {
              clearInterval(progressInterval);
              return 95;
            }
            return prev + Math.random() * 5;
          });
        }, 200);
      }
      
      // Perform the actual upload
      const uploadedFile = await uploadFile(file);
      
      // Complete the progress
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Finish up
      setTimeout(() => {
        setIsUploading(false);
        setCurrentFile(null);
        setUploadProgress(0);
        setCurrentChunk(0);
        setTotalChunks(0);
        
        // Notify the parent component using the appropriate callback
        if (onUploadComplete) {
          onUploadComplete(uploadedFile);
        } else if (onFileUploaded) {
          onFileUploaded(uploadedFile);
        }
        
        toast({
          title: "Upload complete",
          description: `${file.name} has been securely uploaded and encrypted`,
        });
      }, 500);
    } catch (error: any) {
      setIsUploading(false);
      
      toast({
        title: "Upload failed",
        description: error.message || "There was a problem uploading your file",
        variant: "destructive",
      });
      
      console.error("Upload error:", error);
    }
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const cancelUpload = () => {
    setIsUploading(false);
    setCurrentFile(null);
    setUploadProgress(0);
    setCurrentChunk(0);
    setTotalChunks(0);
    
    toast({
      title: "Upload cancelled",
      description: "Your file upload has been cancelled",
    });
  };

  return (
    <div className={className}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      
      {!isUploading ? (
        <div className="space-y-4">
          <Button
            onClick={triggerFileInput}
            className="relative overflow-hidden group bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
          >
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span>Upload Files</span>
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span>End-to-End Encrypted</span>
              </div>
            </div>
          </Button>
        </div>
      ) : (
        <Card className="w-full p-4 animate-fade-in">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-medium truncate max-w-[200px]">
              {currentFile?.name}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={cancelUpload}
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Progress value={uploadProgress} className="h-2" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {Math.round(uploadProgress)}%
            </span>
          </div>
          
          {isChunkedUpload && (
            <div className="text-xs text-muted-foreground mt-1">
              Uploading chunk {currentChunk} of {totalChunks}
            </div>
          )}
          
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-green-500" />
              <span className="text-xs text-muted-foreground">End-to-end encrypted</span>
            </div>
            
            {isChunkedUpload && (
              <div className="flex items-center gap-1">
                <FileSymlink className="h-3 w-3 text-blue-500" />
                <span className="text-xs text-muted-foreground">Multi-part upload</span>
              </div>
            )}
            
            <div className="flex items-center gap-1">
              <UploadCloud className="h-3 w-3 text-purple-500" />
              <span className="text-xs text-muted-foreground">AES-256 encryption</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Github className="h-3 w-3 text-gray-500" />
              <span className="text-xs text-muted-foreground">Universal storage</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default UploadButton;
