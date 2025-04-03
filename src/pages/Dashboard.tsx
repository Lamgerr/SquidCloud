
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
import FileManager from '@/components/FileManager';
import { FileItem as FileItemType, getFiles, deleteFile, downloadFile, shareFile, formatBytes } from '@/lib/api';
import { Loader2, Plus, FileText, Info, Settings, FolderOpen, HardDrive, BarChart3, Share2, Monitor, Smartphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileBottomNav from '@/components/MobileBottomNav';
import { supabase } from '@/integrations/supabase/client';
import { ThemeToggle } from '@/components/ThemeToggle';

interface DashboardProps {
  defaultTab?: string;
  openUpload?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ defaultTab = 'files', openUpload = false }) => {
  const [files, setFiles] = useState<FileItemType[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItemType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalSize, setTotalSize] = useState(0);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [uploadButtonRef, setUploadButtonRef] = useState<HTMLDivElement | null>(null);
  const [isOnboarding, setIsOnboarding] = useState(true);
  const [repoCount, setRepoCount] = useState(0);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  useEffect(() => {
    if (openUpload && uploadButtonRef) {
      const uploadBtn = uploadButtonRef.querySelector('button');
      if (uploadBtn) {
        (uploadBtn as HTMLElement).click();
      }
    }
  }, [openUpload, uploadButtonRef]);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const fetchedFiles = await getFiles();
        setFiles(fetchedFiles);
        
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

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete, repo_count')
      .eq('id', session.user.id)
      .single();

    setIsOnboarding(!profile?.onboarding_complete);
    setRepoCount(profile?.repo_count || 0);
  };

  const handleCreateVault = () => {
    if (repoCount >= 2) {
      toast({
        title: "Maximum vaults reached",
        description: "You can only create up to 2 storage vaults.",
        variant: "destructive"
      });
      return;
    }
    navigate('/r/c/1');
  };

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
      
      const shareLink = await shareFile(fileId, true);
      
      setFiles((prev) => 
        prev.map((f) => 
          f.id === fileId ? { ...f, shared: true } : f
        )
      );
      
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

  const renderStorageCards = () => {
    if (isMobile) {
      return (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col items-center justify-center text-center">
                <HardDrive className="h-8 w-8 text-blue-500 mb-2" />
                <p className="text-sm text-muted-foreground">Storage Used</p>
                <p className="text-xl font-semibold">{formatBytes(totalSize)}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col items-center justify-center text-center">
                <FileText className="h-8 w-8 text-green-500 mb-2" />
                <p className="text-sm text-muted-foreground">Files</p>
                <p className="text-xl font-semibold">{files.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    return (
      <div className="w-full md:w-64 space-y-4 mb-6 md:mb-0">
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
                className={`flex items-center px-4 py-2 hover:bg-muted text-left ${activeTab === 'shared' ? 'bg-muted' : ''}`}
                onClick={() => setActiveTab('shared')}
              >
                <Share2 className="mr-2 h-4 w-4" />
                <span>Shared</span>
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
    );
  };

  const renderMobileActivity = () => {
    if (!isMobile) return null;
    
    return (
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2 px-1">Recent Activity</h2>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="flex space-x-3 p-4">
              {[1, 2, 3].map((_, index) => (
                <div key={index} className="flex-none w-48">
                  <Card className="h-full">
                    <CardContent className="p-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center">
                          <BarChart3 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium">CloudBliss</h3>
                          <p className="text-xs text-muted-foreground">Updated today</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderSharedContent = () => {
    const sharedFiles = files.filter(file => file.shared);
    
    if (sharedFiles.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center">
            <div className="rounded-full bg-muted p-3 mb-4">
              <Share2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No shared files</h3>
            <p className="text-muted-foreground text-center mb-4">
              You haven't shared any files yet. Share your files to collaborate with others.
            </p>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <div className="grid grid-cols-1 gap-3">
        {sharedFiles.map((file) => (
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
    );
  };

  const renderActionButtons = () => {
    return (
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {repoCount < 2 && (
          <Button
            onClick={handleCreateVault}
            className="bg-primary text-white hover:bg-primary/90 flex items-center gap-2"
            size={isMobile ? "sm" : "default"}
          >
            <HardDrive className="h-4 w-4" />
            Create Vault ({repoCount}/2)
          </Button>
        )}
        <UploadButton onUploadComplete={handleFileUpload} />
      </div>
    );
  };

  const renderSettings = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <Label className="text-sm">Email</Label>
              <p className="font-medium">{user?.email || 'No email available'}</p>
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-sm">Theme</Label>
              <ThemeToggle />
            </div>
            
            {!isCapacitorApp() && (
              <div>
                <Label className="text-sm">App Download</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href="/app/updates?platform=windows" target="_blank">
                      Windows
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href="/app/updates?platform=macos" target="_blank">
                      macOS
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href="/app/updates?platform=linux" target="_blank">
                      Linux
                    </a>
                  </Button>
                </div>
              </div>
            )}
            
            <div className="pt-4">
              <Button
                variant="destructive"
                onClick={() => signOut()}
                className="w-full"
              >
                Logout
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const isCapacitorApp = () => {
    return typeof (window as any)?.Capacitor !== 'undefined';
  };

  if (isOnboarding) {
    return (
      <div className="container mx-auto p-4">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <h1 className="text-2xl font-bold">Welcome to CloudBliss!</h1>
          <p className="text-muted-foreground">To get started, create your first secure storage vault.</p>
          
          <div className="animate-pulse">
            <Button
              onClick={handleCreateVault}
              className="bg-primary text-white hover:bg-primary/90 flex items-center gap-2"
              size="lg"
            >
              <HardDrive className="h-5 w-5" />
              Create Storage Vault ({repoCount}/2)
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Other features will be unlocked after creating your first vault.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`container ${isMobile ? 'px-4' : 'max-w-6xl'} py-6`}>
      <div className="flex flex-col md:flex-row gap-6">
        {!isMobile && renderStorageCards()}
        
        <div className="flex-1">
          {isMobile && renderStorageCards()}
          
          {isMobile && activeTab === 'files' && renderMobileActivity()}
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-4">
              {!isMobile && (
                <TabsList>
                  <TabsTrigger value="files">Files</TabsTrigger>
                  <TabsTrigger value="storage">Storage</TabsTrigger>
                  <TabsTrigger value="shared">Shared</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
              )}
              
              {(activeTab === 'files' || activeTab === 'upload') && (
                <div 
                  className={`button-container ${isMobile ? 'w-full flex justify-center' : ''}`}
                  ref={setUploadButtonRef}
                >
                  {renderActionButtons()}
                </div>
              )}
            </div>
            
            <TabsContent value="files" className="space-y-4">
              {isMobile && files.length > 0 && (
                <div className="flex items-center justify-between mb-2 px-1">
                  <h2 className="text-lg font-semibold">Your Files</h2>
                </div>
              )}
              
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
                  <div className="grid grid-cols-1 gap-3">
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
                      <FilePreview 
                        file={{
                          id: selectedFile.id,
                          name: selectedFile.name,
                          type: selectedFile.type,
                          encrypted: selectedFile.encrypted,
                          processor: selectedFile.processor || "legacy",
                          preview_available: selectedFile.preview_available || false,
                          preview_type: selectedFile.preview_type
                        }} 
                        onClose={() => setSelectedFile(null)} 
                      />
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
                      Upload your first file to get started with secure storage.
                    </p>
                    <UploadButton onUploadComplete={handleFileUpload} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="storage">
              <Card>
                <CardHeader>
                  <CardTitle>Storage Manager</CardTitle>
                </CardHeader>
                <CardContent>
                  <FileManager />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="shared" className="space-y-4">
              {renderSharedContent()}
            </TabsContent>
            
            <TabsContent value="settings">
              {renderSettings()}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
