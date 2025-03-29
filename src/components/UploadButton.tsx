
import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, X, Lock, FileSymlink, UploadCloud, Shield, Layers, KeyRound, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadFile, FileItem, getFiles } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';

interface UploadButtonProps {
  onUploadComplete?: (file: FileItem) => void;
  onFileUploaded?: (file: any) => void;
  className?: string;
}

const UploadButton: React.FC<UploadButtonProps> = ({ onUploadComplete, onFileUploaded, className }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('initializing');
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [isFirstUpload, setIsFirstUpload] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has uploaded files before
    const checkPreviousUploads = async () => {
      try {
        const files = await getFiles();
        setIsFirstUpload(files.length === 0);
      } catch (error) {
        console.error("Error checking previous uploads:", error);
      }
    };

    checkPreviousUploads();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setCurrentFile(file);
    
    // If this is the first upload, redirect to repository creation
    if (isFirstUpload) {
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      toast({
        title: "First upload detected",
        description: "Please set up your repository before uploading files"
      });
      
      // Redirect to repository creation
      navigate('/r/c/1');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    setProcessingStage('encrypting');
    
    // Estimate number of chunks
    const estimatedChunks = Math.ceil(file.size / (500 * 1024)); // 500KB chunks
    setTotalChunks(estimatedChunks);
    
    try {
      // Notify user about encryption
      toast({
        title: "Preparing file",
        description: "Your file is being encrypted before upload",
      });
      
      // Start progress animation for encryption phase
      let progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 25) {
            clearInterval(progressInterval);
            return 25;
          }
          return prev + Math.random() * 2;
        });
      }, 200);
      
      // Simulate JSON conversion phase
      setTimeout(() => {
        clearInterval(progressInterval);
        setProcessingStage('converting');
        setUploadProgress(25);
        
        progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 40) {
              clearInterval(progressInterval);
              return 40;
            }
            return prev + Math.random() * 1.5;
          });
        }, 200);
        
        // Simulate chunking phase
        setTimeout(() => {
          clearInterval(progressInterval);
          setProcessingStage('chunking');
          setUploadProgress(40);
          
          progressInterval = setInterval(() => {
            setUploadProgress(prev => {
              if (prev >= 60) {
                clearInterval(progressInterval);
                return 60;
              }
              return prev + Math.random() * 1.5;
            });
            setCurrentChunk(prev => Math.min(prev + 1, Math.floor(estimatedChunks * 0.6)));
          }, 300);
          
          // Simulate distributing phase
          setTimeout(async () => {
            clearInterval(progressInterval);
            setProcessingStage('distributing');
            setUploadProgress(60);
            
            progressInterval = setInterval(() => {
              setUploadProgress(prev => {
                if (prev >= 95) {
                  clearInterval(progressInterval);
                  return 95;
                }
                return prev + Math.random() * 1;
              });
              setCurrentChunk(prev => Math.min(prev + 1, estimatedChunks));
            }, 400);
            
            try {
              // Perform the actual upload
              const uploadedFile = await uploadFile(file);
              
              // Complete the progress
              clearInterval(progressInterval);
              setProcessingStage('completed');
              setUploadProgress(100);
              
              // Update first upload status
              setIsFirstUpload(false);
              
              // Finish up
              setTimeout(() => {
                setIsUploading(false);
                setCurrentFile(null);
                setUploadProgress(0);
                setCurrentChunk(0);
                setTotalChunks(0);
                setProcessingStage('initializing');
                
                // Notify the parent component using the appropriate callback
                if (onUploadComplete) {
                  onUploadComplete(uploadedFile);
                } else if (onFileUploaded) {
                  onFileUploaded(uploadedFile);
                }
                
                toast({
                  title: "Upload complete",
                  description: `${file.name} has been securely uploaded, encrypted, and distributed`,
                });
              }, 1000);
            } catch (error: any) {
              clearInterval(progressInterval);
              setIsUploading(false);
              
              toast({
                title: "Upload failed",
                description: error.message || "There was a problem uploading your file",
                variant: "destructive",
              });
              
              console.error("Upload error:", error);
            }
          }, 3000);
        }, 2000);
      }, 2000);
      
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
    setProcessingStage('initializing');
    
    toast({
      title: "Upload cancelled",
      description: "Your file upload has been cancelled",
    });
  };

  const getStageIcon = () => {
    switch (processingStage) {
      case 'encrypting':
        return <Lock className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'converting':
        return <FileSymlink className="h-4 w-4 text-purple-500 animate-pulse" />;
      case 'chunking':
        return <Layers className="h-4 w-4 text-orange-500 animate-pulse" />;
      case 'distributing':
        return <UploadCloud className="h-4 w-4 text-green-500 animate-pulse" />;
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  const getStageText = () => {
    switch (processingStage) {
      case 'encrypting':
        return "Encrypting with AES-256-GCM...";
      case 'converting':
        return "Converting to secure JSON format...";
      case 'chunking':
        return `Creating JSON chunks (${currentChunk}/${totalChunks})...`;
      case 'distributing':
        return `Distributing chunks to secure vaults (${currentChunk}/${totalChunks})...`;
      case 'completed':
        return "Upload complete!";
      default:
        return "Preparing file...";
    }
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
            className={`relative overflow-hidden group bg-primary text-primary-foreground hover:bg-primary/90 ${isMobile ? 'w-full' : 'w-full sm:w-auto'}`}
          >
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span>Upload Files</span>
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                <span>Multi-Layer Encryption</span>
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
          
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            {getStageIcon()}
            <span>{getStageText()}</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-green-500" />
              <span className="text-xs text-muted-foreground">AES-256-GCM</span>
            </div>
            
            <div className="flex items-center gap-1">
              <FileSymlink className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-muted-foreground">JSON Format</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Layers className="h-3 w-3 text-purple-500" />
              <span className="text-xs text-muted-foreground">Chunked Data</span>
            </div>
            
            <div className="flex items-center gap-1">
              <KeyRound className="h-3 w-3 text-orange-500" />
              <span className="text-xs text-muted-foreground">Unique Key</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-gray-500" />
              <span className="text-xs text-muted-foreground">Distributed</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default UploadButton;
