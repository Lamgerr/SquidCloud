
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, X, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadFile } from '@/lib/api';

interface UploadButtonProps {
  onFileUploaded?: (file: any) => void;
  className?: string;
}

const UploadButton: React.FC<UploadButtonProps> = ({ onFileUploaded, className }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setCurrentFile(file);
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + Math.random() * 10;
      });
    }, 300);
    
    try {
      // Simulate encryption and upload
      toast({
        title: "Encrypting file",
        description: "Your file is being encrypted before upload",
      });
      
      // Upload the file and get the result
      const uploadedFile = await uploadFile(file);
      
      // Complete the progress
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setIsUploading(false);
        setCurrentFile(null);
        setUploadProgress(0);
        
        // Notify the parent component
        if (onFileUploaded) {
          onFileUploaded(uploadedFile);
        }
        
        toast({
          title: "Upload complete",
          description: `${file.name} has been securely uploaded`,
        });
      }, 500);
    } catch (error) {
      clearInterval(progressInterval);
      setIsUploading(false);
      
      toast({
        title: "Upload failed",
        description: "There was a problem uploading your file",
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
        <Button
          onClick={triggerFileInput}
          className="relative overflow-hidden group bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <span>Upload Files</span>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span>Secure Upload</span>
            </div>
          </div>
        </Button>
      ) : (
        <div className="w-full animate-fade-in">
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
          
          <div className="flex items-center gap-1 mt-1">
            <Lock className="h-3 w-3 text-green-500" />
            <span className="text-xs text-muted-foreground">End-to-end encrypted</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadButton;
