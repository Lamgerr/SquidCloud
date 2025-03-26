import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import UploadButton from '@/components/UploadButton';
import { formatBytes } from '@/lib/api';
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
  Github,
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
  Trash
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
import { generateWithGemini } from '@/services/gemini';
import { supabase } from '@/integrations/supabase/client';
import GitHubRepositories from '@/components/GitHubRepositories';

const Dashboard = () => {
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<any[]>([]);
  const [fetchingFiles, setFetchingFiles] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('files');

  React.useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setFetchingFiles(true);
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
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

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-6 w-6 text-blue-500" />;
    if (type.startsWith('video/')) return <Video className="h-6 w-6 text-red-500" />;
    if (type.startsWith('audio/')) return <Music className="h-6 w-6 text-green-500" />;
    if (type.includes('zip') || type.includes('tar') || type.includes('rar'))
      return <Archive className="h-6 w-6 text-yellow-500" />;
    if (type.includes('pdf'))
      return <FileText className="h-6 w-6 text-red-600" />;
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
  const unlimitedStorage = true; // Premium feature indicator
  const usagePercentage = unlimitedStorage ? 0 : Math.min((totalStorage / (1024 * 1024 * 1024 * 1024)) * 100, 100);

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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={fetchFiles}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>

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
            <Button
              variant={activeTab === 'github' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveTab('github')}
            >
              <Github className="mr-2 h-4 w-4" />
              GitHub Repos
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="md:hidden mb-4">
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="ai">AI Assistant</TabsTrigger>
              <TabsTrigger value="github">GitHub</TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="space-y-4">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">My Files</h1>
                <UploadButton
                  onFileUploaded={handleFileUploaded}
                  className="sm:hidden"
                />
              </div>

              {fetchingFiles ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                  <p className="text-muted-foreground">Loading your files...</p>
                </div>
              ) : files.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {files.map((file) => (
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
                            </CardDescription>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Share2 className="mr-2 h-4 w-4" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-500 focus:text-red-500">
                              <Trash className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardHeader>
                      <CardFooter className="p-4 pt-2 flex justify-between text-xs text-muted-foreground">
                        <span>
                          {new Date(file.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        {file.encrypted && (
                          <span className="flex items-center">
                            <Lock className="h-3 w-3 mr-1" />
                            Encrypted
                          </span>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-lg p-12 text-center">
                  <div className="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                    <Upload className="h-8 w-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No files uploaded yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Upload your first file to get started with secure, encrypted storage.
                  </p>
                  <UploadButton onFileUploaded={handleFileUploaded} />
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

            <TabsContent value="github" className="space-y-4">
              <div className="mb-6">
                <h1 className="text-2xl font-bold mb-2">GitHub Integration</h1>
                <p className="text-muted-foreground">
                  Search for GitHub users and explore their repositories.
                </p>
              </div>
              
              <GitHubRepositories />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
