
import React, { useState, useCallback, ReactNode } from 'react';
import { uploadFile } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface DragDropUploadProps {
  children: ReactNode;
  onDragStateChange?: (isDragging: boolean) => void;
  onFilesDropped?: (files: File[]) => void;
  currentFolder?: string;
}

const DragDropUpload: React.FC<DragDropUploadProps> = ({
  children,
  onDragStateChange,
  onFilesDropped,
  currentFolder = ""
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    if (onDragStateChange) onDragStateChange(true);
  }, [onDragStateChange]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (onDragStateChange) onDragStateChange(false);
  }, [onDragStateChange]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (onDragStateChange) onDragStateChange(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      
      if (onFilesDropped) {
        onFilesDropped(droppedFiles);
      }
      
      setUploading(true);
      
      // Process each file for upload
      for (const file of droppedFiles) {
        try {
          toast({
            title: "Uploading...",
            description: `Uploading ${file.name}`,
          });
          
          await uploadFile(file, currentFolder, (progress, stage) => {
            console.log(`${file.name}: ${stage} - ${progress}%`);
          });
          
          toast({
            title: "Upload Complete",
            description: `${file.name} uploaded successfully`,
          });
        } catch (error: any) {
          console.error("Upload error:", error);
          toast({
            title: "Upload Failed",
            description: error.message || "Failed to upload file",
            variant: "destructive"
          });
        }
      }
      
      setUploading(false);
    }
  }, [onDragStateChange, onFilesDropped, currentFolder, toast]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="w-full h-full min-h-[calc(100vh-4rem)] transition-colors duration-200"
    >
      {children}
    </div>
  );
};

export default DragDropUpload;
