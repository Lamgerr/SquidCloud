import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, X, Lock, FileSymlink, UploadCloud, 
  Shield, Layers, KeyRound, Check, Loader2,
  Zap, HardDrive, Network, Share2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadFile, FileItem, getFiles, formatBytes } from '@/lib/api';
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

  const handleUploadError = (error: Error) => {
    if (error.message.includes("Storage Vault")) {
      toast({
        title: "Storage Vault Required",
        description: "Please create a Storage Vault first",
        variant: "destructive",
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/r/c/1')}
          >
            Create Vault
          </Button>
        )
      });
    } else {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

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
    setProcessingStage('preparing');
    
    // Estimate number of chunks based on file size
    const estimatedChunks = Math.ceil(file.size < 512 * 1024 * 1024 
      ? 10  // Less than 512MB - 10 chunks
      : (file.size < 1024 * 1024 * 1024 
        ? 20  // Between 512MB and 1GB - 20 chunks
        : 30  // More than 1GB - 30 chunks
      ));
    setTotalChunks(estimatedChunks);
    
    try {
      // Notify user about upload process
      toast({
        title: "Preparing file with Res54",
        description: "Your file is being analyzed and optimally chunked",
      });
      
      // Animate the upload progress for visual feedback
      // The actual progress will be tracked in the background
      const animateProgress = () => {
        const stageProgression = {
          preparing: { start: 0, end: 10, next: 'analyzing' },
          analyzing: { start: 10, end: 20, next: 'encrypting' },
          encrypting: { start: 20, end: 35, next: 'chunking' },
          chunking: { start: 35, end: 50, next: 'uploading' },
          uploading: { start: 50, end: 85, next: 'distributing' },
          distributing: { start: 85, end: 95, next: 'finalizing' },
          finalizing: { start: 95, end: 99, next: 'completed' },
          completed: { start: 100, end: 100, next: null }
        };
        
        const startAnimation = (stage: string) => {
          const currentStage = stageProgression[stage as keyof typeof stageProgression];
          if (!currentStage) return;
          
          setProcessingStage(stage);
          
          let currentProgress = currentStage.start;
          const targetProgress = currentStage.end;
          const step = (targetProgress - currentProgress) / 20;
          
          const interval = setInterval(() => {
            currentProgress += step;
            setUploadProgress(Math.min(currentProgress, targetProgress));
            
            if (currentProgress >= targetProgress) {
              clearInterval(interval);
              if (currentStage.next) {
                setTimeout(() => startAnimation(currentStage.next as string), 500);
              }
            }
            
            // Update current chunk count for visual feedback
            if (stage === 'chunking' || stage === 'uploading') {
              const progress = (currentProgress - currentStage.start) / (targetProgress - currentStage.start);
              setCurrentChunk(Math.floor(progress * estimatedChunks));
            }
          }, 200);
        };
        
        startAnimation('preparing');
      };
      
      // Start progress animation
      animateProgress();
      
      // Perform the actual upload using Res54 in the background
      const uploadedFile = await uploadFile(file, (progress, stage, details) => {
        // Real upload progress from the API
        if (stage === 'uploading' && details) {
          setCurrentChunk(details.current);
          setTotalChunks(details.total);
        }
      });
      
      // Set the final progress to 100% and stage to completed
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
          description: `${file.name} has been securely uploaded with Res54 technology`,
        });
      }, 1000);
    } catch (error: any) {
      setIsUploading(false);
      handleUploadError(error);
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
      case 'preparing':
        return <HardDrive className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'analyzing':
        return <Zap className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'encrypting':
        return <Lock className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'chunking':
        return <Layers className="h-4 w-4 text-orange-500 animate-pulse" />;
      case 'uploading':
        return <UploadCloud className="h-4 w-4 text-green-500 animate-pulse" />;
      case 'distributing':
        return <Network className="h-4 w-4 text-purple-500 animate-pulse" />;
      case 'finalizing':
        return <Share2 className="h-4 w-4 text-indigo-500 animate-pulse" />;
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  const getStageText = () => {
    switch (processingStage) {
      case 'preparing':
        return "Preparing file for Res54 processing...";
      case 'analyzing':
        return "Analyzing for optimal chunking strategy...";
      case 'encrypting':
        return "Encrypting with AES-256-GCM...";
      case 'chunking':
        return `Creating dynamic chunks (${currentChunk}/${totalChunks})...`;
      case 'uploading':
        return `Parallel uploading chunks (${currentChunk}/${totalChunks})...`;
      case 'distributing':
        return "Distributing to secure vaults...";
      case 'finalizing':
        return "Finalizing and verifying integrity...";
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
                <Zap className="h-4 w-4" />
                <span>Res54 Ultra-Fast Upload</span>
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
              <Zap className="h-3 w-3 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Res54</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-green-500" />
              <span className="text-xs text-muted-foreground">C2C Encrypted</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Layers className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-muted-foreground">Dynamic Chunks</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Network className="h-3 w-3 text-purple-500" />
              <span className="text-xs text-muted-foreground">Parallel Upload</span>
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
