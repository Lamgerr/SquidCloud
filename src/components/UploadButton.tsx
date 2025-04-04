
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, X, Lock, FileSymlink, UploadCloud, 
  Shield, Layers, KeyRound, Check, Loader2,
  Zap, HardDrive, Network, Share2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadFile } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';

interface UploadButtonProps {
  onUploadComplete?: (file: any) => void;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setCurrentFile(file);
    setIsUploading(true);
    setUploadProgress(0);
    setProcessingStage('preparing');
    
    try {
      // Start the upload process
      const uploadedFile = await uploadFile(
        file, 
        "", // Empty string for parentFolder parameter
        (progress, stage, details) => {
          setUploadProgress(progress);
          setProcessingStage(stage);
          if (details?.current && details?.total) {
            setCurrentChunk(details.current);
            setTotalChunks(details.total);
          }
        }
      );

      // Handle successful upload
      setProcessingStage('completed');
      setUploadProgress(100);
      
      setTimeout(() => {
        setIsUploading(false);
        setCurrentFile(null);
        setUploadProgress(0);
        if (onUploadComplete) {
          onUploadComplete(uploadedFile);
        }
        toast({
          title: "Upload complete",
          description: `${file.name} has been securely uploaded`,
        });
      }, 1000);
      
    } catch (error: any) {
      setIsUploading(false);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
