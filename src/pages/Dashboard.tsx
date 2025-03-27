import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import UploadButton from '@/components/UploadButton';
import { formatBytes, getFiles, downloadFile, deleteFile, shareFile, initializeRepos } from '@/lib/api';
import FilePreview from '@/components/FilePreview';
import {
  ShieldCheck,
  Lock,
  Search,
  Share2,
  Cloud,
  Smartphone,
  FileUp,
  Folder,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  Settings,
  LogOut,
  File,
  Upload,
  Image,
  Video,
  Music,
  Archive,
  MessageSquare,
  FileText,
  Loader2,
  RefreshCw,
  Download,
  Trash,
  Filter,
  LayoutGrid,
  List,
  FileDigit,
  ZoomIn,
  ZoomOut,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Github,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

const generateWithGemini = async (prompt: string): Promise<string> => {
  console.log("Sending prompt to Gemini:", prompt);
  return `This is a simulated AI response to: "${prompt}"\n\nIn a real implementation, this would connect to the Gemini API service.`;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<any[]>([]);
  const [fetchingFiles, setFetchingFiles] = useState(false);
  const [initializingRepos, setInitializingRepos] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('files');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [reposInitialized, setReposInitialized] = useState(false);

  useEffect(() => {
    const initializeStorage = async () => {
      if (!reposInitialized) {
        setInitializingRepos(true);
        try {
          await initializeRepos();
          setReposInitialized(true);
        } catch (error) {
          console.error("Failed to initialize repos:", error);
          // We'll try again later, so don't show an error to the user
        } finally {
          setInitializingRepos(false);
        }
      }
    };

    initializeStorage();
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setFetchingFiles(true);
      const filesData = await getFiles();
      setFiles(filesData);
    } catch (error) {
      console.error('Error fetching files:', error);
      
      if (!reposInitialized) {
        toast({
          title: 'Setting up storage',
          description: 'Preparing your secure storage. Please wait...',
        });
        
        navigate('/r/c/5');
        return;
      }
      
      toast({
        title: 'Error fetching files',
        description: 'There was a problem loading your files',
        variant: 'destructive',
      });
    } finally {
      setFetchingFiles(false);
    }
  };

  const handleFileUploaded = (file: any) => {
    setFiles((prevFiles) => [file, ...prevFiles]);
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      toast({
        title: "Preparing download",
        description: "Decrypting and preparing your file...",
      });
      
      const fileBlob = await downloadFile(fileId);
      
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download complete",
        description: `${fileName} has been successfully downloaded`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: "There was a problem downloading your file",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    try {
      await deleteFile(fileId);
      setFiles(files.filter(file => file.id !== fileId));
      
      toast({
        title: "File deleted",
        description: `${fileName} has been deleted`
      });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Delete failed",
        description: "There was a problem deleting your file",
        variant: "destructive",
      });
    }
  };

  const handleShareFile = async (fileId: string) => {
    try {
      const shareLink = await shareFile(fileId);
      
      await navigator.clipboard.writeText(shareLink);
      
      toast({
        title: "Share link created",
        description: "The secure link has been copied to your clipboard"
      });
    } catch (error) {
      console.error("Share error:", error);
      toast({
        title: "Share failed",
        description: "There was a problem creating a share link",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-6 w-6 text-blue-500" />;
    if (type.startsWith('video/')) return <Video className="h-6 w-6 text-red-500" />;
    if (type.startsWith('audio/')) return <Music className="h-6 w-6 text-green-500" />;
    if (type.includes('zip') || type.includes('tar') || type.includes('rar'))
      return <Archive className="h-6 w-6 text-yellow-500" />;
    if (type.includes('pdf'))
      return <FileText className="h-6 w-6 text-red-600" />;
    if (type.includes('csv') || type.includes('excel') || type.includes('spreadsheet'))
      return <FileDigit className="h-6 w-6 text-green-600" />;
    return <File className="h-6 w-6 text-gray-500" />;
  };

  const handleAskAI = async () => {
    if (!promptInput.trim()) {
      toast({
        title: 'Empty prompt',
        description: 'Please enter a question or prompt for the AI',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setAiResponse('');

    try {
      const response = await generateWithGemini(promptInput);
      setAiResponse(response);
    } catch (error: any) {
      console.error('Error with Gemini API:', error);
      toast({
        title: 'AI Error',
        description: error.message || 'Error generating response',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const totalStorage = (profile?.storage_used || 0);
  const unlimitedStorage = true;
  const usagePercentage = unlimitedStorage ? 0 : Math.min((totalStorage / (1024 * 1024 * 1024 * 1024)) * 100, 100);

  const filteredFiles = files.filter(file => {
    const matchesSearch = searchQuery ? 
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) : 
      true;
    
    const matchesCategory = filterCategory ? 
      (filterCategory === 'images' && file.type.startsWith('image/')) ||
      (filterCategory === 'videos' && file.type.startsWith('video/')) ||
      (filterCategory === 'audio' && file.type.startsWith('audio/')) ||
      (filterCategory === 'documents' && (file.type.includes('pdf') || file.type.includes('document') || file.type.includes('text'))) ||
      (filterCategory === 'archives' && (file.type.includes('zip') || file.type.includes('tar') || file.type.includes('rar'))) : 
      true;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen flex flex-col font-inter bg-slate-50 dark:bg-slate-900/50">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Link to="/" className="flex items-center space-x-2">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg w-8 h-8 flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-sm" />
              </div>
              <span className="font-semibold text-xl hidden sm:inline-block">InflateStorage</span>
            </Link>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={fetchFiles}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <UploadButton
              onFileUploaded={handleFileUploaded}
              className="hidden sm:block"
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="font-medium truncate">{profile?.full_name || user?.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden md:block w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4">
          <div className="space-y-1">
            <Button
              variant={activeTab === 'files' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveTab('files')}
            >
              <File className="mr-2 h-4 w-4" />
              My Files
            </Button>
            <Button
              variant={activeTab === 'ai' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveTab('ai')}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              AI Assistant
            </Button>
          </div>

          <div className="mt-6 space-y-1">
            <p className="text-xs font-medium mb-2 text-muted-foreground">CATEGORIES</p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => setFilterCategory('images')}
            >
              <Image className="mr-2 h-4 w-4 text-blue-500" />
              Images
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => setFilterCategory('videos')}
            >
              <Video className="mr-2 h-4 w-4 text-red-500" />
              Videos
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => setFilterCategory('documents')}
            >
              <FileText className="mr-2 h-4 w-4 text-amber-500" />
              Documents
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => setFilterCategory('audio')}
            >
              <Music className="mr-2 h-4 w-4 text-green-500" />
              Audio
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => setFilterCategory('archives')}
            >
              <Archive className="mr-2 h-4 w-4 text-purple-500" />
              Archives
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-primary"
              onClick={() => setFilterCategory(null)}
            >
              <File className="mr-2 h-4 w-4" />
              All Files
            </Button>
          </div>

          <div className="mt-8">
            <div className="text-xs font-medium mb-2">Storage Usage</div>
            <div className="bg-slate-100 dark:bg-slate-700 rounded-full h-2 mb-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${usagePercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatBytes(totalStorage)}</span>
              <span>{unlimitedStorage ? 'Unlimited' : '1 TB'}</span>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-6">
          <TooltipProvider>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="md:hidden mb-4">
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="ai">AI Assistant</TabsTrigger>
              </TabsList>

              <TabsContent value="files" className="space-y-4">
                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-2xl font-bold">My Files</h1>
                  
                  {initializingRepos ? (
                    <Button disabled variant="outline" size="sm">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Setting up storage...
                    </Button>
                  ) : !reposInitialized ? (
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => navigate('/r/c/5')}
                    >
                      <Github className="h-4 w-4 mr-2" />
                      Initialize Storage
                    </Button>
                  ) : (
                    <UploadButton
                      onFileUploaded={handleFileUploaded}
                      className="sm:hidden"
                    />
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-grow">
                    <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input 
                      placeholder="Search files..." 
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setViewMode('grid')}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                          <Filter className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setFilterCategory(null)}>
                          All Files
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilterCategory('images')}>
                          Images
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilterCategory('videos')}>
                          Videos
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilterCategory('documents')}>
                          Documents
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilterCategory('audio')}>
                          Audio
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilterCategory('archives')}>
                          Archives
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {fetchingFiles ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                    <p className="text-muted-foreground">Loading your files...</p>
                  </div>
                ) : filteredFiles.length > 0 ? (
                  viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredFiles.map((file) => (
                        <Card key={file.id} className="overflow-hidden hover:shadow-md transition-shadow">
                          <CardHeader className="p-4 pb-2 flex flex-row justify-between items-start">
                            <div className="flex items-start space-x-3">
                              {getFileIcon(file.type)}
                              <div>
                                <CardTitle className="text-base truncate" title={file.name}>
                                  {file.name}
                                </CardTitle>
                                <CardDescription className="text-xs">
                                  {formatBytes(file.size)}
                                  {file.chunks && <span className="ml-1">• {file.chunks} parts</span>}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center">
                              <FilePreview file={file} />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleDownload(file.id, file.name)}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleShareFile(file.id)}>
                                    <Share2 className="mr-2 h-4 w-4" />
                                    Share
                                  </DropdownMenuItem>
                                  {file.htmlUrl && (
                                    <DropdownMenuItem onClick={() => window.open(file.htmlUrl, '_blank')}>
                                      <ExternalLink className="mr-2 h-4 w-4" />
                                      View on GitHub
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-red-500 focus:text-red-500"
                                    onClick={() => handleDeleteFile(file.id, file.name)}
                                  >
                                    <Trash className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardHeader>
                          <CardFooter className="p-4 pt-2 flex justify-between text-xs text-muted-foreground">
                            <span>
                              {new Date(file.lastModified).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                            {file.encrypted && (
                              <span className="flex items-center">
                                <Lock className="h-3 w-3 mr-1" />
                                AES-256
                              </span>
                            )}
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <div className="flex items-center space-x-3">
                            {getFileIcon(file.type)}
                            <div>
                              <p className="font-medium">{file.name}</p>
                              <div className="flex items-center text-xs text-muted-foreground">
                                <span>{formatBytes(file.size)}</span>
                                <span className="mx-2">•</span>
                                <span>
                                  {new Date(file.lastModified).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </span>
                                {file.chunks && (
                                  <>
                                    <span className="mx-2">•</span>
                                    <span>{file.chunks} parts</span>
                                  </>
                                )}
                                {file.encrypted && (
                                  <>
                                    <span className="mx-2">•</span>
                                    <span className="flex items-center">
                                      <Lock className="h-3 w-3 mr-1" />
                                      Encrypted
                                    </span>
                                  </>
                                )}
                                {file.githubRepo && (
                                  <>
                                    <span className="mx-2">•</span>
                                    <span className="flex items-center">
                                      {file.githubRepo}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <FilePreview file={file} />
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDownload(file.id, file.name)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleShareFile(file.id)}
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                            {file.htmlUrl && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => window.open(file.htmlUrl, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => handleDeleteFile(file.id, file.name)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-12 text-center">
                    <div className="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                      <Upload className="h-8 w-8 text-blue-500" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No files found</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      {searchQuery || filterCategory
                        ? "Try adjusting your search or filters to find what you're looking for."
                        : "Upload your first file to get started with secure, encrypted storage."}
                    </p>
                    {!searchQuery && !filterCategory && (
                      <UploadButton onFileUploaded={handleFileUploaded} />
                    )}
                    {(searchQuery || filterCategory) && (
                      <Button variant="outline" onClick={() => {
                        setSearchQuery('');
                        setFilterCategory(null);
                      }}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ai" className="space-y-4">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold mb-2">AI Assistant</h1>
                  <p className="text-muted-foreground">
                    Ask about file organization, security, or get help with content generation.
                  </p>
                </div>

                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Ask Gemini AI</CardTitle>
                    <CardDescription>Powered by Google's Gemini 1.5 Flash</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Textarea
                          placeholder="Ask anything about your files, storage, or ask for content generation..."
                          className="min-h-20"
                          value={promptInput}
                          onChange={(e) => setPromptInput(e.target.value)}
                        />
                      </div>
                      <Button 
                        onClick={handleAskAI} 
                        disabled={isGenerating || !promptInput.trim()}
                        className="w-full"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Ask AI
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {aiResponse && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">AI Response</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose dark:prose-invert">
                        {aiResponse.split('\n').map((line, i) => (
                          <React.Fragment key={i}>
                            {line}
                            <br />
                          </React.Fragment>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </TooltipProvider>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
