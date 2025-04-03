import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  File, Folder, Upload, Plus, 
  ArrowLeft, MoreVertical, Search,
  FileImage, FileVideo, FileText, 
  FileAudio, FilePlus, Share2,
  Download, Trash2, Clock,
  ChevronRight, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  getAllFiles, 
  createFolder, 
  uploadFile,
  downloadFile, 
  deleteFile, 
  shareFile,
  markFileViewed,
  formatBytes,
  FileItem as FileItemType,
  FolderItem
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import FilePreview from '@/components/FilePreview';
import { Loader2 } from 'lucide-react';
import DragDropUpload from '@/components/DragDropUpload';
import { supabase } from '@/integrations/supabase/client';

interface FileManagerProps {
  onFileSelected?: (file: FileItemType) => void;
}

const FileManager: React.FC<FileManagerProps> = ({ onFileSelected }) => {
  const [files, setFiles] = useState<(FileItemType | FolderItem)[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [breadcrumbs, setBreadcrumbs] = useState<{name: string, path: string}[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<FileItemType | FolderItem | null>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [fileToPreview, setFileToPreview] = useState<FileItemType | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const loadFiles = async () => {
      try {
        setLoading(true);
        const allFiles = await getAllFiles(currentFolder);
        setFiles(allFiles);
      } catch (error) {
        console.error("Error loading files:", error);
        toast({
          title: "Error",
          description: "Failed to load files",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadFiles();
    updateBreadcrumbs();
  }, [currentFolder, toast]);
  
  const updateBreadcrumbs = () => {
    const crumbs = [{ name: "Root", path: "" }];
    
    if (currentFolder) {
      const parts = currentFolder.split('/');
      let currentPath = "";
      
      parts.forEach((part, index) => {
        if (index === 0) return; // Skip user ID
        
        currentPath += (currentPath ? "/" : "") + part;
        crumbs.push({
          name: part,
          path: currentPath
        });
      });
    }
    
    setBreadcrumbs(crumbs);
  };
  
  const filteredFiles = files.filter(file => {
    const nameMatch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!nameMatch) return false;
    
    if (activeTab === "all") return true;
    
    if (activeTab === "images" && 'type' in file) {
      return file.type.startsWith('image/');
    }
    
    if (activeTab === "documents" && 'type' in file) {
      return file.type.includes('pdf') || 
             file.type.includes('document') || 
             file.type.includes('text') ||
             file.type.includes('sheet');
    }
    
    if (activeTab === "videos" && 'type' in file) {
      return file.type.startsWith('video/');
    }
    
    if (activeTab === "folders" && 'is_folder' in file) {
      return file.is_folder;
    }
    
    return false;
  });
  
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    handleFileUpload(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleFileUpload = async (file: File) => {
    setUploadingFile(file);
    setUploadProgress(0);
    setUploadStage("preparing");
    
    try {
      const fileItem = await uploadFile(file, currentFolder, (progress, stage, details) => {
        setUploadProgress(progress);
        setUploadStage(stage);
      });
      
      setFiles(prev => [fileItem, ...prev]);
      toast({
        title: "File Uploaded",
        description: `${file.name} has been uploaded successfully`
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file",
        variant: "destructive"
      });
    } finally {
      setUploadingFile(null);
    }
  };
  
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast({
        title: "Error",
        description: "Folder name cannot be empty",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const newFolder = await createFolder(newFolderName, currentFolder);
      setFiles(prev => [newFolder, ...prev]);
      setShowNewFolderDialog(false);
      setNewFolderName("");
      toast({
        title: "Folder Created",
        description: `Created folder ${newFolderName}`
      });
    } catch (error: any) {
      console.error("Error creating folder:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create folder",
        variant: "destructive"
      });
    }
  };
  
  const handleOpenFolder = (folder: FolderItem) => {
    setCurrentFolder(folder.path);
  };
  
  const handleBackToParent = () => {
    if (breadcrumbs.length <= 1) {
      setCurrentFolder("");
      return;
    }
    
    const parentIndex = breadcrumbs.length - 2;
    if (parentIndex >= 0) {
      setCurrentFolder(breadcrumbs[parentIndex].path);
    }
  };
  
  const handleOpenFile = async (file: FileItemType) => {
    try {
      setFileToPreview(file);
      
      await markFileViewed(file.id);
    } catch (error) {
      console.error("Error opening file:", error);
      toast({
        title: "Error",
        description: "Failed to open file",
        variant: "destructive"
      });
    }
  };
  
  const handleDownloadFile = async (file: FileItemType) => {
    try {
      toast({
        title: "Downloading...",
        description: `Preparing ${file.name} for download.`,
      });
      
      const fileBlob = await downloadFile(file.id, (progress, stage) => {
        console.log(`Download progress: ${progress}%, stage: ${stage}`);
      });
      
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      toast({
        title: "Download Complete",
        description: `${file.name} has been downloaded.`,
      });
    } catch (error: any) {
      console.error("Error downloading file:", error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download file",
        variant: "destructive"
      });
    }
  };
  
  const handleShareFile = async (file: FileItemType) => {
    try {
      const shareLink = await shareFile(file.id, true);
      
      setFiles(prev => 
        prev.map(f => 
          'id' in f && f.id === file.id 
            ? { ...f, shared: true } as FileItemType 
            : f
        )
      );
      
      navigator.clipboard.writeText(shareLink);
      
      toast({
        title: "Link Copied",
        description: "Share link has been copied to clipboard",
      });
    } catch (error: any) {
      console.error("Error sharing file:", error);
      toast({
        title: "Sharing Failed",
        description: error.message || "Failed to share file",
        variant: "destructive"
      });
    }
  };
  
  const handleDeleteConfirm = async () => {
    if (!selectedFile) return;
    
    try {
      if ('is_folder' in selectedFile && selectedFile.is_folder) {
        const { data, error } = await supabase.functions.invoke('github-storage', {
          body: { 
            action: 'delete_folder', 
            path: selectedFile.path 
          }
        });
        
        if (error) {
          throw new Error(error.message);
        }
        
        setFiles(prev => prev.filter(f => 
          !('is_folder' in f) || f.path !== selectedFile.path
        ));
        
        toast({
          title: "Folder Deleted",
          description: `${selectedFile.name} has been deleted`,
        });
      } else {
        await deleteFile((selectedFile as FileItemType).id);
        
        setFiles(prev => prev.filter(f => 
          !('id' in f) || f.id !== selectedFile.id
        ));
        
        toast({
          title: "File Deleted",
          description: `${selectedFile.name} has been deleted`,
        });
      }
    } catch (error: any) {
      console.error("Error deleting:", error);
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete the item",
        variant: "destructive"
      });
    } finally {
      setShowDeleteConfirm(false);
      setSelectedFile(null);
    }
  };
  
  const renderItemIcon = (item: FileItemType | FolderItem) => {
    if ('is_folder' in item && item.is_folder) {
      return <Folder className="h-10 w-10 text-blue-500" />;
    }
    
    const file = item as FileItemType;
    if (file.type.startsWith('image/')) {
      return <FileImage className="h-10 w-10 text-green-500" />;
    } else if (file.type.startsWith('video/')) {
      return <FileVideo className="h-10 w-10 text-red-500" />;
    } else if (file.type.startsWith('audio/')) {
      return <FileAudio className="h-10 w-10 text-purple-500" />;
    } else if (file.type.includes('pdf') || file.type.includes('document') || file.type.includes('text')) {
      return <FileText className="h-10 w-10 text-amber-500" />;
    } else {
      return <File className="h-10 w-10 text-gray-500" />;
    }
  };
  
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };
  
  const handleFilesDropped = (droppedFiles: File[]) => {
    if (droppedFiles.length === 0) return;
    
    toast({
      title: "Files received",
      description: `Processing ${droppedFiles.length} file(s) for upload`,
    });
    
    droppedFiles.forEach(file => {
      handleFileUpload(file);
    });
  };

  return (
    <DragDropUpload 
      onDragStateChange={setIsDragging}
      onFilesDropped={handleFilesDropped}
      currentFolder={currentFolder}
    >
      <div className={`space-y-4 ${isDragging ? 'border-2 border-dashed border-primary/50 rounded-lg p-4 bg-primary/5' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 overflow-x-auto whitespace-nowrap max-w-[60%] py-2">
            {breadcrumbs.length > 0 && (
              <div className="flex items-center space-x-2">
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <button
                      onClick={() => setCurrentFolder(crumb.path)}
                      className={`text-sm ${index === breadcrumbs.length - 1 ? 'font-semibold' : 'text-muted-foreground'}`}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowNewFolderDialog(true)}
            >
              <Folder className="h-4 w-4 mr-1" />
              New Folder
            </Button>
            
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </Button>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              className="hidden"
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="images">Images</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="videos">Videos</TabsTrigger>
              <TabsTrigger value="folders">Folders</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {isDragging && (
          <div className="border-2 border-dashed border-primary rounded-lg p-8 flex items-center justify-center">
            <div className="text-center">
              <Upload className="h-10 w-10 text-primary mx-auto mb-4" />
              <p className="text-lg font-medium">Drop your files here</p>
              <p className="text-sm text-muted-foreground">Files will be uploaded to current folder</p>
            </div>
          </div>
        )}
        
        {uploadingFile && (
          <Card className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">{uploadingFile.name}</span>
              <span className="text-xs text-muted-foreground">{formatBytes(uploadingFile.size)}</span>
            </div>
            <Progress value={uploadProgress} className="h-2 mb-2" />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span className="capitalize">{uploadStage}</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
          </Card>
        )}
        
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading files...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <Card className="flex flex-col items-center justify-center h-64 border-dashed">
            <FilePlus className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No files found</p>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload Files
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredFiles.map((item) => (
              <Card 
                key={item.id} 
                className="p-3 flex items-center hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => {
                  if ('is_folder' in item && item.is_folder) {
                    handleOpenFolder(item as FolderItem);
                  } else {
                    handleOpenFile(item as FileItemType);
                  }
                }}
              >
                <div className="flex-shrink-0 mr-3">
                  {renderItemIcon(item)}
                </div>
                
                <div className="flex-grow min-w-0">
                  <div className="truncate font-medium">{item.name}</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1" />
                    <span className="mr-3">{formatDate(item.created_at)}</span>
                    
                    {'size' in item && (
                      <span>{formatBytes((item as FileItemType).size)}</span>
                    )}
                    
                    {'shared' in item && (item as FileItemType).shared && (
                      <span className="ml-3 flex items-center">
                        <Share2 className="h-3 w-3 mr-1 text-primary" />
                        <span className="text-primary">Shared</span>
                      </span>
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
                    {'is_folder' in item && item.is_folder ? (
                      <>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleOpenFolder(item as FolderItem);
                        }}>
                          <Folder className="h-4 w-4 mr-2" />
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(item);
                            setShowDeleteConfirm(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleOpenFile(item as FileItemType);
                        }}>
                          <File className="h-4 w-4 mr-2" />
                          Open
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadFile(item as FileItemType);
                        }}>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleShareFile(item as FileItemType);
                        }}>
                          <Share2 className="h-4 w-4 mr-2" />
                          Share
                        </DropdownMenuItem>
                        
                        {(item as FileItemType).shared && (
                          <DropdownMenuItem asChild onClick={(e) => e.stopPropagation()}>
                            <a 
                              href={`/share/${(item as FileItemType).id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Share Link
                            </a>
                          </DropdownMenuItem>
                        )}
                        
                        <DropdownMenuSeparator />
                        
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(item);
                            setShowDeleteConfirm(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </Card>
            ))}
          </div>
        )}
        
        <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="my-4"
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFolder}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
            </DialogHeader>
            <p className="py-4">
              Are you sure you want to delete "{selectedFile?.name}"? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {fileToPreview && (
          <FilePreview 
            file={fileToPreview} 
            onClose={() => setFileToPreview(null)} 
          />
        )}
      </div>
    </DragDropUpload>
  );
};

export default FileManager;
