
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  File, Folder, Upload, Plus, 
  ArrowLeft, MoreVertical, Search,
  FileImage, FileVideo, FileText, 
  FileAudio, FilePlus, Share2,
  Download, Trash2, Edit, Clock,
  ChevronRight
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
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Load files for the current folder
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
  
  // Update breadcrumbs when current folder changes
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
  
  // Filter files based on search and active tab
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
  
  // Handle file upload
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setUploadingFile(file);
    setUploadProgress(0);
    setUploadStage("preparing");
    
    // Upload the file
    uploadFile(file, currentFolder, (progress, stage, details) => {
      setUploadProgress(progress);
      setUploadStage(stage);
    }).then(fileItem => {
      // Add the new file to the list
      setFiles(prev => [fileItem, ...prev]);
      setUploadingFile(null);
      toast({
        title: "File Uploaded",
        description: `${file.name} has been uploaded successfully`
      });
    }).catch(error => {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file",
        variant: "destructive"
      });
      setUploadingFile(null);
    });
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Handle creating a new folder
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
    } catch (error) {
      console.error("Error creating folder:", error);
      toast({
        title: "Error",
        description: "Failed to create folder",
        variant: "destructive"
      });
    }
  };
  
  // Handle opening a folder
  const handleOpenFolder = (folder: FolderItem) => {
    setCurrentFolder(folder.path);
  };
  
  // Handle navigating back to parent folder
  const handleBackToParent = () => {
    if (breadcrumbs.length <= 1) {
      setCurrentFolder("");
      return;
    }
    
    // Go back to the parent folder
    const parentIndex = breadcrumbs.length - 2;
    if (parentIndex >= 0) {
      setCurrentFolder(breadcrumbs[parentIndex].path);
    }
  };
  
  // Handle opening a file
  const handleOpenFile = async (file: FileItemType) => {
    try {
      setFileToPreview(file);
      
      // Mark file as recently viewed
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
  
  // Handle downloading a file
  const handleDownloadFile = async (file: FileItemType) => {
    try {
      toast({
        title: "Downloading...",
        description: `Preparing ${file.name} for download.`,
      });
      
      const fileBlob = await downloadFile(file.id, (progress, stage) => {
        // Could show download progress here
      });
      
      // Create a download link
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      toast({
        title: "Download Complete",
        description: `${file.name} has been downloaded.`,
      });
    } catch (error) {
      console.error("Error downloading file:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download file",
        variant: "destructive"
      });
    }
  };
  
  // Handle sharing a file
  const handleShareFile = async (file: FileItemType) => {
    try {
      const shareLink = await shareFile(file.id, true);
      
      // Update file state
      setFiles(prev => 
        prev.map(f => 
          'id' in f && f.id === file.id 
            ? { ...f, shared: true } as FileItemType 
            : f
        )
      );
      
      // Copy link to clipboard
      navigator.clipboard.writeText(shareLink);
      
      toast({
        title: "Link Copied",
        description: "Share link has been copied to clipboard",
      });
    } catch (error) {
      console.error("Error sharing file:", error);
      toast({
        title: "Sharing Failed",
        description: "Failed to share file",
        variant: "destructive"
      });
    }
  };
  
  // Handle deleting a file or folder
  const handleDeleteConfirm = async () => {
    if (!selectedFile) return;
    
    try {
      if ('is_folder' in selectedFile && selectedFile.is_folder) {
        // TODO: Implement folder deletion
        toast({
          title: "Not implemented",
          description: "Folder deletion is not implemented yet",
        });
      } else {
        await deleteFile((selectedFile as FileItemType).id);
        
        // Remove file from state
        setFiles(prev => prev.filter(f => 
          !('id' in f) || f.id !== selectedFile.id
        ));
        
        toast({
          title: "File Deleted",
          description: `${selectedFile.name} has been deleted`,
        });
      }
    } catch (error) {
      console.error("Error deleting:", error);
      toast({
        title: "Deletion Failed",
        description: "Failed to delete the item",
        variant: "destructive"
      });
    } finally {
      setShowDeleteConfirm(false);
      setSelectedFile(null);
    }
  };
  
  // Render file/folder icon based on type
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
  
  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Header with breadcrumbs */}
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
      
      {/* Search and filters */}
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
      
      {/* Upload progress indicator */}
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
      
      {/* File/folder list */}
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
                    // Folder options
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
                    // File options
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
      
      {/* New folder dialog */}
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
      
      {/* Delete confirmation */}
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
      
      {/* File preview */}
      {fileToPreview && (
        <FilePreview 
          file={fileToPreview} 
          onClose={() => setFileToPreview(null)} 
        />
      )}
    </div>
  );
};

export default FileManager;
