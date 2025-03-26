
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileItem as FileItemType, 
  getFiles, 
  getCurrentUser, 
  formatBytes, 
  deleteFile, 
  shareFile,
  User
} from '@/lib/api';
import FileItem from '@/components/FileItem';
import UploadButton from '@/components/UploadButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  HardDrive, 
  FileText, 
  FileImage, 
  FileArchive, 
  FileAudio, 
  FileVideo, 
  Clock, 
  RefreshCw, 
  LayoutGrid,
  List,
  Search,
  Plus,
  FolderPlus
} from 'lucide-react';

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [files, setFiles] = useState<FileItemType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewType, setViewType] = useState<'grid' | 'list'>('list');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      navigate('/auth');
      return;
    }
    
    setUser(currentUser);
    
    const fetchFiles = async () => {
      try {
        const filesList = await getFiles();
        setFiles(filesList);
      } catch (error) {
        console.error('Failed to fetch files:', error);
        toast({
          title: "Failed to load files",
          description: "There was an error loading your files",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchFiles();
  }, [navigate, toast]);
  
  const handleFileUploaded = (newFile: FileItemType) => {
    setFiles(prevFiles => [newFile, ...prevFiles]);
  };
  
  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteFile(fileId);
      setFiles(prevFiles => prevFiles.filter(file => file.id !== fileId));
    } catch (error) {
      console.error('Failed to delete file:', error);
      toast({
        title: "Failed to delete file",
        description: "There was an error deleting your file",
        variant: "destructive",
      });
    }
  };
  
  const handleShareFile = async (fileId: string) => {
    try {
      const shareLink = await shareFile(fileId);
      navigator.clipboard.writeText(shareLink);
    } catch (error) {
      console.error('Failed to share file:', error);
      toast({
        title: "Failed to share file",
        description: "There was an error creating the share link",
        variant: "destructive",
      });
    }
  };
  
  const getStorageUsedPercentage = () => {
    if (!user) return 0;
    // For display purposes, we'll cap at 90% even though storage is "unlimited"
    return Math.min(90, (user.storage.used / (1000 * 1024 * 1024 * 1024)) * 100);
  };
  
  // Filter files based on search query
  const filteredFiles = searchQuery
    ? files.filter(file => 
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : files;
  
  // Group files by type
  const documentFiles = filteredFiles.filter(
    file => file.type.includes('pdf') || 
            file.type.includes('document') || 
            file.type.includes('text') ||
            file.type.includes('spreadsheet')
  );
  
  const imageFiles = filteredFiles.filter(
    file => file.type.startsWith('image/')
  );
  
  const archiveFiles = filteredFiles.filter(
    file => file.type.includes('zip') || 
            file.type.includes('compressed') ||
            file.type.includes('archive')
  );
  
  const mediaFiles = filteredFiles.filter(
    file => file.type.startsWith('audio/') || 
            file.type.startsWith('video/')
  );
  
  return (
    <div className="container max-w-7xl py-6 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Storage Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <HardDrive className="mr-2 h-5 w-5 text-primary" />
              Storage
            </CardTitle>
            <CardDescription>Your storage usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Used: {user ? formatBytes(user.storage.used) : '0 B'}</span>
                <span className="text-primary">Unlimited</span>
              </div>
              <Progress value={getStorageUsedPercentage()} className="h-2" />
              <div className="text-xs text-muted-foreground">
                End-to-end encrypted storage
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Quick Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <FileText className="mr-2 h-5 w-5 text-primary" />
              Files
            </CardTitle>
            <CardDescription>Your file statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center text-sm text-muted-foreground">
                  <FileText className="mr-1 h-4 w-4" />
                  <span>Documents</span>
                </div>
                <p className="text-2xl font-semibold">{documentFiles.length}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center text-sm text-muted-foreground">
                  <FileImage className="mr-1 h-4 w-4" />
                  <span>Images</span>
                </div>
                <p className="text-2xl font-semibold">{imageFiles.length}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center text-sm text-muted-foreground">
                  <FileArchive className="mr-1 h-4 w-4" />
                  <span>Archives</span>
                </div>
                <p className="text-2xl font-semibold">{archiveFiles.length}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center text-sm text-muted-foreground">
                  <FileVideo className="mr-1 h-4 w-4" />
                  <span>Media</span>
                </div>
                <p className="text-2xl font-semibold">{mediaFiles.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Upload Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Plus className="mr-2 h-5 w-5 text-primary" />
              Add Files
            </CardTitle>
            <CardDescription>Upload new files</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <UploadButton 
                onFileUploaded={handleFileUploaded} 
                className="w-full"
              />
              
              <Button 
                variant="outline" 
                className="w-full"
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </Button>
              
              <div className="text-xs text-muted-foreground text-center">
                All files are automatically encrypted
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Files Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-semibold">Your Files</h2>
          
          <div className="flex items-center space-x-2">
            {showSearch ? (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search files..."
                  className="pl-10 pr-4 py-2 w-[200px] sm:w-[300px] bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <Button
                  variant="ghost" 
                  size="icon"
                  className="absolute right-1 top-1"
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setShowSearch(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
            
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setViewType(viewType === 'list' ? 'grid' : 'list')}
            >
              {viewType === 'list' ? (
                <LayoutGrid className="h-4 w-4" />
              ) : (
                <List className="h-4 w-4" />
              )}
            </Button>
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={async () => {
                setIsLoading(true);
                try {
                  const filesList = await getFiles();
                  setFiles(filesList);
                  toast({
                    title: "Files refreshed",
                    description: "Your file list has been updated",
                  });
                } catch (error) {
                  console.error('Failed to refresh files:', error);
                  toast({
                    title: "Failed to refresh files",
                    description: "There was an error loading your files",
                    variant: "destructive",
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="all">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All Files</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="archives">Archives</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Loading your files...</p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border rounded-lg">
                <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No files found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? 'No files match your search query' : 'Upload your first file to get started'}
                </p>
                
                {!searchQuery && (
                  <UploadButton onFileUploaded={handleFileUploaded} />
                )}
              </div>
            ) : (
              <div className={viewType === 'list' ? 'space-y-2' : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'}>
                {filteredFiles.map(file => (
                  <FileItem 
                    key={file.id} 
                    file={file} 
                    onDelete={handleDeleteFile}
                    onShare={handleShareFile}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="recent" className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Loading your files...</p>
              </div>
            ) : (
              <div className={viewType === 'list' ? 'space-y-2' : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'}>
                {filteredFiles
                  .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
                  .slice(0, 10)
                  .map(file => (
                    <FileItem 
                      key={file.id} 
                      file={file} 
                      onDelete={handleDeleteFile}
                      onShare={handleShareFile}
                    />
                  ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="documents" className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Loading your files...</p>
              </div>
            ) : documentFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border rounded-lg">
                <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No documents found</h3>
                <p className="text-muted-foreground mb-4">
                  Upload some documents to see them here
                </p>
              </div>
            ) : (
              <div className={viewType === 'list' ? 'space-y-2' : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'}>
                {documentFiles.map(file => (
                  <FileItem 
                    key={file.id} 
                    file={file} 
                    onDelete={handleDeleteFile}
                    onShare={handleShareFile}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="images" className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Loading your files...</p>
              </div>
            ) : imageFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border rounded-lg">
                <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <FileImage className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No images found</h3>
                <p className="text-muted-foreground mb-4">
                  Upload some images to see them here
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {imageFiles.map(file => (
                  <FileItem 
                    key={file.id} 
                    file={file} 
                    onDelete={handleDeleteFile}
                    onShare={handleShareFile}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="archives" className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Loading your files...</p>
              </div>
            ) : archiveFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border rounded-lg">
                <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <FileArchive className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No archives found</h3>
                <p className="text-muted-foreground mb-4">
                  Upload some archives to see them here
                </p>
              </div>
            ) : (
              <div className={viewType === 'list' ? 'space-y-2' : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'}>
                {archiveFiles.map(file => (
                  <FileItem 
                    key={file.id} 
                    file={file} 
                    onDelete={handleDeleteFile}
                    onShare={handleShareFile}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="media" className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Loading your files...</p>
              </div>
            ) : mediaFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border rounded-lg">
                <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <FileVideo className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No media files found</h3>
                <p className="text-muted-foreground mb-4">
                  Upload some audio or video files to see them here
                </p>
              </div>
            ) : (
              <div className={viewType === 'list' ? 'space-y-2' : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'}>
                {mediaFiles.map(file => (
                  <FileItem 
                    key={file.id} 
                    file={file} 
                    onDelete={handleDeleteFile}
                    onShare={handleShareFile}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
