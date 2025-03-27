import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import UploadButton from '@/components/UploadButton';
import FileItem from '@/components/FileItem';
import FilePreview from '@/components/FilePreview';
import { FileItem as FileItemType, getFiles, formatBytes, deleteFile, downloadFile, shareFile, initializeRepos } from '@/lib/api';
import { Loader2, Plus, FileText, Info, Settings, GraduationCap, FolderOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import GitHubRepositories from '@/components/GitHubRepositories';

const Dashboard = () => {
  const [files, setFiles] = useState<FileItemType[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItemType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalSize, setTotalSize] = useState(0);
  const [activeTab, setActiveTab] = useState('files');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  useEffect(() => {
    // Initialize repositories
    const initRepos = async () => {
      try {
        await initializeRepos();
      } catch (err: any) {
        console.error("Error initializing repositories:", err);
      }
    };

    initRepos();
  }, []);

  useEffect(() => {
    // Fetch files
    const fetchFiles = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const fetchedFiles = await getFiles();
        setFiles(fetchedFiles);
        
        // Calculate total size
        const totalBytes = fetchedFiles.reduce((acc, file) => acc + file.size, 0);
        setTotalSize(totalBytes);
      } catch (err: any) {
        console.error("Error fetching files:", err);
        setError(err.message || "Failed to fetch files");
        toast({
          title: "Error",
          description: err.message || "Failed to fetch files",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [toast]);

  const handleFileUpload = (newFile: FileItemType) => {
    setFiles((prev) => [newFile, ...prev]);
    setTotalSize((prev) => prev + newFile.size);
    toast({
      title: "File Uploaded",
      description: `${newFile.name} has been uploaded successfully.`,
    });
  };

  const handleFileDelete = async (fileId: string) => {
    try {
      await deleteFile(fileId);
      
      // Update state
      const deletedFile = files.find(f => f.id === fileId);
      setFiles((prev) => prev.filter((file) => file.id !== fileId));
      
      if (deletedFile) {
        setTotalSize((prev) => prev - deletedFile.size);
      }
      
      if (selectedFile?.id === fileId) {
        setSelectedFile(null);
      }
      
      toast({
        title: "File Deleted",
        description: "The file has been deleted successfully.",
      });
    } catch (err: any) {
      console.error("Error deleting file:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const handleFileDownload = async (fileId: string) => {
    try {
      const file = files.find(f => f.id === fileId);
      if (!file) return;
      
      toast({
        title: "Downloading...",
        description: `Preparing ${file.name} for download.`,
      });
      
      const fileBlob = await downloadFile(fileId);
      
      // Create download link
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
    } catch (err: any) {
      console.error("Error downloading file:", err);
      toast({
        title: "Download Failed",
        description: err.message || "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const handleFileShare = async (fileId: string) => {
    try {
      const file = files.find(f => f.id === fileId);
      if (!file) return;
      
      const shareLink = await shareFile(fileId);
      
      // Update file in state
      setFiles((prev) => 
        prev.map((f) => 
          f.id === fileId ? { ...f, shared: true } : f
        )
      );
      
      // Copy link to clipboard
      navigator.clipboard.writeText(shareLink);
      
      toast({
        title: "Link Copied",
        description: "Share link has been copied to clipboard.",
      });
    } catch (err: any) {
      console.error("Error sharing file:", err);
      toast({
        title: "Sharing Failed",
        description: err.message || "Failed to generate share link",
        variant: "destructive",
      });
    }
  };

  const handleSelectFile = (file: FileItemType) => {
    setSelectedFile(file);
  };

  return (
    <div className="container max-w-6xl py-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left sidebar */}
        <div className="w-full md:w-64 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Storage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-normal text-muted-foreground">Used Space</Label>
                  <p className="font-medium">{formatBytes(totalSize)}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-normal text-muted-foreground">Files</Label>
                  <p className="font-medium">{files.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Navigation</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col">
                <button 
                  className={`flex items-center px-4 py-2 hover:bg-muted text-left ${activeTab === 'files' ? 'bg-muted' : ''}`}
                  onClick={() => setActiveTab('files')}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Files</span>
                </button>
                <button 
                  className={`flex items-center px-4 py-2 hover:bg-muted text-left ${activeTab === 'storage' ? 'bg-muted' : ''}`}
                  onClick={() => setActiveTab('storage')}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  <span>Storage</span>
                </button>
                <button 
                  className={`flex items-center px-4 py-2 hover:bg-muted text-left ${activeTab === 'github' ? 'bg-muted' : ''}`}
                  onClick={() => setActiveTab('github')}
                >
                  <GraduationCap className="mr-2 h-4 w-4" />
                  <span>GitHub</span>
                </button>
                <button 
                  className={`flex items-center px-4 py-2 hover:bg-muted text-left ${activeTab === 'about' ? 'bg-muted' : ''}`}
                  onClick={() => setActiveTab('about')}
                >
                  <Info className="mr-2 h-4 w-4" />
                  <span>About</span>
                </button>
                <button 
                  className={`flex items-center px-4 py-2 hover:bg-muted text-left ${activeTab === 'settings' ? 'bg-muted' : ''}`}
                  onClick={() => setActiveTab('settings')}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </button>
              </div>
            </CardContent>
            <CardFooter className="border-t p-0">
              <button 
                className="w-full flex items-center justify-center px-4 py-2 hover:bg-muted text-red-500 hover:text-red-600"
                onClick={() => signOut()}
              >
                Logout
              </button>
            </CardFooter>
          </Card>
        </div>
        
        {/* Main content */}
        <div className="flex-1">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="storage">Storage</TabsTrigger>
                <TabsTrigger value="github">GitHub</TabsTrigger>
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              
              {activeTab === 'files' && (
                <UploadButton onUploadComplete={handleFileUpload} />
              )}
            </div>
            
            <TabsContent value="files" className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                  <p className="text-muted-foreground">Loading your files...</p>
                </div>
              ) : error ? (
                <Card>
                  <CardContent className="py-6">
                    <div className="text-center">
                      <p className="text-red-500 mb-2">{error}</p>
                      <Button onClick={() => window.location.reload()}>Retry</Button>
                    </div>
                  </CardContent>
                </Card>
              ) : files.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    {files.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        onSelect={handleSelectFile}
                        onDelete={handleFileDelete}
                        onDownload={handleFileDownload}
                        onShare={handleFileShare}
                        selected={selectedFile?.id === file.id}
                      />
                    ))}
                  </div>
                  
                  {selectedFile && (
                    <div className="mt-6">
                      <FilePreview file={selectedFile} onClose={() => setSelectedFile(null)} />
                    </div>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 flex flex-col items-center justify-center">
                    <div className="rounded-full bg-muted p-3 mb-4">
                      <Plus className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No files yet</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Upload your first file to get started with universal storage.
                    </p>
                    <UploadButton onUploadComplete={handleFileUpload} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="storage">
              <Card>
                <CardHeader>
                  <CardTitle>Storage Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Your files are stored securely across multiple repositories 
                    for redundancy and availability.
                  </p>
                  <div className="mt-4">
                    <Button onClick={() => navigate('/r/c/5')}>
                      Initialize Storage
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="github">
              <Card>
                <CardHeader>
                  <CardTitle>GitHub Integration</CardTitle>
                </CardHeader>
                <CardContent>
                  <GitHubRepositories />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="about">
              <Card>
                <CardHeader>
                  <CardTitle>About Universal Storage</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Universal Storage is a secure and distributed file storage system that 
                    leverages GitHub repositories to store your files with end-to-end encryption.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>Account Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm">Email</Label>
                      <p className="font-medium">{user?.email || 'No email available'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
