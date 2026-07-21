import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Code,
  Copy,
  FileText,
  Key,
  Loader2,
  Play,
  XCircle,
} from '@/lib/icon-map';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileScrollToTop from '@/components/MobileScrollToTop';
import ApiKeyManagement from '@/components/ApiKeyManagement';
import ApiUsageChart from '@/components/ApiUsageChart';
import ApiRequestLogs from '@/components/ApiRequestLogs';
import DeveloperAPIMobile from '@/components/DeveloperAPIMobile';
import { supabase } from '@/integrations/supabase/client';
import { toast as sonnerToast } from 'sonner';

type Endpoint = {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  description: string;
  scopes: string[];
  statusPath: string | null;
  example: string;
  sampleResponse?: string;
};

type EndpointHealth = {
  status: 'checking' | 'online' | 'offline';
  latency?: number;
};

const BASE_URL = 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api';

const endpoints: Endpoint[] = [
  {
    method: 'GET',
    path: '/files',
    description: 'List all files and folders for the authenticated user',
    scopes: ['read'],
    statusPath: '/files',
    example: `curl -X GET ${BASE_URL}/files -H "X-SquidCloud-Key: YOUR_API_KEY"`,
    sampleResponse: `{
  "files": [...],
  "folders": [...],
  "total_files": 50,
  "total_folders": 2,
  "success": true
}`,
  },
  {
    method: 'GET',
    path: '/files/:id/metadata',
    description: 'Get metadata and encryption info for a file',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/files/FILE_ID/metadata -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'GET',
    path: '/files/:id/download',
    description:
      'Download decrypted file. Optional encryption key header is supported; wrong key returns 422.',
    scopes: ['read'],
    statusPath: null,
    example:
      `curl -X GET ${BASE_URL}/files/FILE_ID/download ` +
      `-H "X-SquidCloud-Key: YOUR_API_KEY" ` +
      `-H "X-SquidCloud-Encryption-Key: OPTIONAL_USER_KEY" ` +
      `-o downloaded-file.pdf`,
  },
  {
    method: 'POST',
    path: '/files/upload',
    description:
      'Upload file with optional folder and optional caller-provided encryption key.',
    scopes: ['write'],
    statusPath: null,
    example:
      `curl -X POST ${BASE_URL}/files/upload ` +
      `-H "X-SquidCloud-Key: YOUR_API_KEY" ` +
      `-H "X-SquidCloud-Encryption-Key: OPTIONAL_USER_KEY" ` +
      `-F "file=@document.pdf" ` +
      `-F "encryption_key=OPTIONAL_USER_KEY" ` +
      `-F "folderId=FOLDER_ID"`,
    sampleResponse: `{
  "file": {
    "id": "...",
    "name": "My Document",
    "size": 1024,
    "created_at": "..."
  },
  "encryption": {
    "mode": "provided",
    "key_required_for_download": true
  },
  "success": true
}`,
  },
  {
    method: 'DELETE',
    path: '/files/:id',
    description: 'Soft delete a file',
    scopes: ['delete'],
    statusPath: null,
    example: `curl -X DELETE ${BASE_URL}/files/FILE_ID -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'GET',
    path: '/keys',
    description: 'List API keys for the authenticated user',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/keys -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'GET',
    path: '/storage',
    description: 'Get storage usage, quota stats, and API credit balance',
    scopes: ['read'],
    statusPath: '/storage',
    example: `curl -X GET ${BASE_URL}/storage -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'POST',
    path: '/cdn/publish',
    description: 'Publish a file to the CDN for public access with optional TTL',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/cdn/publish -H "X-SquidCloud-Key: YOUR_API_KEY" -H "Content-Type: application/json" -d '{"file_id":"FILE_ID","ttl":3600}'`,
  },
  {
    method: 'GET',
    path: '/cdn/play/*',
    description: 'Stream or play a CDN-published media file directly in the browser',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/cdn/play/FILE_ID -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'GET',
    path: '/search',
    description: 'Search files by name, type, or metadata with pagination',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET "${BASE_URL}/search?q=document&page=1&limit=20" -H "X-SquidCloud-Key: YOUR_API_KEY"`,
    sampleResponse: `{
  "results": [...],
  "total": 10,
  "page": 1,
  "limit": 20,
  "success": true
}`,
  },
  {
    method: 'POST',
    path: '/batch/delete',
    description: 'Batch delete multiple files by ID',
    scopes: ['delete'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/batch/delete -H "X-SquidCloud-Key: YOUR_API_KEY" -H "Content-Type: application/json" -d '{"file_ids":["ID1","ID2"]}'`,
    sampleResponse: `{
  "deleted": 2,
  "failed": 0,
  "success": true
}`,
  },
  {
    method: 'POST',
    path: '/batch/move',
    description: 'Batch move files to a different folder',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/batch/move -H "X-SquidCloud-Key: YOUR_API_KEY" -H "Content-Type: application/json" -d '{"file_ids":["ID1","ID2"],"target_folder_id":"FOLDER_ID"}'`,
    sampleResponse: `{
  "moved": 2,
  "failed": 0,
  "success": true
}`,
  },
  {
    method: 'GET',
    path: '/stats/usage',
    description: 'Get detailed API usage statistics including credits consumed',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/stats/usage -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'GET',
    path: '/export/files',
    description: 'Export file metadata as CSV or JSON for backup',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET "${BASE_URL}/export/files?format=csv" -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'GET',
    path: '/health',
    description: 'Health check endpoint returning server status and version',
    scopes: ['read'],
    statusPath: '/health',
    example: `curl -X GET ${BASE_URL}/health`,
    sampleResponse: `{
  "status": "healthy",
  "version": "2.2.0",
  "timestamp": "...",
  "success": true
}`,
  },
];

const methodBadgeClass = (method: Endpoint['method']) => {
  if (method === 'GET') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  if (method === 'POST') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  return 'bg-red-500/10 text-red-600 border-red-500/20';
};

const DeveloperAPI = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [endpointStatus, setEndpointStatus] = useState<Record<string, EndpointHealth>>({});

  const [playgroundMethod, setPlaygroundMethod] = useState<'GET' | 'POST' | 'DELETE'>('GET');
  const [playgroundEndpoint, setPlaygroundEndpoint] = useState('/files');
  const [playgroundApiKey, setPlaygroundApiKey] = useState('');
  const [playgroundEncryptionKey, setPlaygroundEncryptionKey] = useState('');
  const [playgroundBody, setPlaygroundBody] = useState('');
  const [playgroundResponse, setPlaygroundResponse] = useState('');
  const [playgroundLoading, setPlaygroundLoading] = useState(false);

  const [creditInfo, setCreditInfo] = useState<{used: number; daily_limit: number; remaining: number} | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [operationCosts, setOperationCosts] = useState<any[]>([]);
  const [costFilter, setCostFilter] = useState('');
  const [costsOpen, setCostsOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [customLimits, setCustomLimits] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Code copied to clipboard' });
  };

  useEffect(() => {
    let isMounted = true;

    const checkEndpointStatus = async () => {
      const targets = endpoints.filter((e) => e.statusPath);

      for (const endpoint of targets) {
        if (!endpoint.statusPath) continue;
        const key = endpoint.path;

        if (!isMounted) return;
        setEndpointStatus((prev) => ({ ...prev, [key]: { status: 'checking' } }));

        try {
          const start = performance.now();
          const response = await fetch(`${BASE_URL}${endpoint.statusPath}`, {
            method: 'HEAD',
            headers: {
              'X-SquidCloud-Key': 'status-check',
            },
          });
          const latency = Math.round(performance.now() - start);

          if (!isMounted) return;
          if (response.status === 200 || response.status === 401) {
            setEndpointStatus((prev) => ({ ...prev, [key]: { status: 'online', latency } }));
          } else {
            setEndpointStatus((prev) => ({ ...prev, [key]: { status: 'offline' } }));
          }
        } catch (_error) {
          if (!isMounted) return;
          setEndpointStatus((prev) => ({ ...prev, [key]: { status: 'offline' } }));
        }
      }
    };

    checkEndpointStatus();
    const interval = setInterval(checkEndpointStatus, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchUserAndCredits = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .single();

      if (!isMounted) return;
      if (profileData) setProfile(profileData);

      setLoadingCredits(true);
      try {
        const { data: keysData } = await supabase
          .from('api_keys')
          .select('key')
          .eq('user_id', user.id)
          .limit(1);

        if (keysData && keysData.length > 0) {
          const apiKey = keysData[0].key;
          const res = await fetch(`${BASE_URL}/storage`, {
            headers: { 'X-SquidCloud-Key': apiKey },
          });
          if (res.ok) {
            const data = await res.json();
            if (isMounted && data.credits) {
              setCreditInfo(data.credits);
            }
          }
        }
      } catch {
      } finally {
        if (isMounted) setLoadingCredits(false);
      }
    };

    fetchUserAndCredits();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (profile?.tier !== 'supporter-plus') return;
    let isMounted = true;

    const fetchKeys = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: keysData } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id);
      if (!isMounted) return;
      if (keysData) {
        setApiKeys(keysData);
        const limits: Record<string, string> = {};
        keysData.forEach(k => { limits[k.id] = String(k.custom_daily_limit ?? ''); });
        setCustomLimits(limits);
      }
    };

    fetchKeys();
    return () => { isMounted = false; };
  }, [profile?.tier]);

  useEffect(() => {
    let isMounted = true;

    const fetchCosts = async () => {
      const { data } = await supabase
        .from('api_operation_costs')
        .select('*')
        .order('operation');
      if (!isMounted) return;
      if (data) setOperationCosts(data);
    };

    fetchCosts();
    return () => { isMounted = false; };
  }, []);

  const testEndpoint = async () => {
    if (!playgroundEndpoint.trim() || !playgroundApiKey.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide endpoint path and API key',
        variant: 'destructive',
      });
      return;
    }

    setPlaygroundLoading(true);
    setPlaygroundResponse('');

    try {
      const headers: Record<string, string> = {
        'X-SquidCloud-Key': playgroundApiKey.trim(),
      };

      if (playgroundEncryptionKey.trim()) {
        headers['X-SquidCloud-Encryption-Key'] = playgroundEncryptionKey.trim();
      }

      const options: RequestInit = {
        method: playgroundMethod,
        headers,
      };

      if (playgroundMethod !== 'GET') {
        headers['Content-Type'] = 'application/json';
        if (playgroundBody.trim()) {
          options.body = playgroundBody;
        }
      }

      const start = performance.now();
      const response = await fetch(`${BASE_URL}${playgroundEndpoint}`, options);
      const latency = Math.round(performance.now() - start);

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      const formatted = {
        status: response.status,
        statusText: response.statusText,
        latency: `${latency}ms`,
        headers: Object.fromEntries(response.headers.entries()),
        body: payload,
      };

      setPlaygroundResponse(JSON.stringify(formatted, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setPlaygroundResponse(JSON.stringify({ error: message }, null, 2));
      toast({
        title: 'Request Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setPlaygroundLoading(false);
    }
  };

  if (isMobile) {
    return <DeveloperAPIMobile />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <MobileScrollToTop />

      <div className="container mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate('/dashboard')} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Developer API</h1>
            <p className="text-[12px] text-muted-foreground/70">Build with SquidCloud API v2.2</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-muted/30 mb-4 w-fit">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'keys', label: 'API Keys' },
              { id: 'playground', label: 'Playground' },
              { id: 'status', label: 'Status' },
              { id: 'docs', label: 'Docs' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn("px-2.5 h-7 text-[12px] font-medium rounded-md transition-colors",
                  activeTab === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}>
                {tab.label}
              </button>
            ))}
          </div>

          <TabsContent value="overview" className="space-y-3 mt-0">
            <div className="rounded-2xl border border-border/50 bg-card/80 p-3 space-y-3">
              <div className="flex items-center gap-2.5">
                <Code className="w-4 h-4 text-muted-foreground/70" />
                <span className="text-[13px] font-medium">SquidCloud API v2.2</span>
                <span className="text-[11px] text-muted-foreground/50">Secure file API with optional caller-provided encryption keys</span>
              </div>
              <div className="h-px bg-border/40" />
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
                  <div className="text-lg font-semibold tabular-nums">{endpoints.length}</div>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Endpoints</div>
                </div>
                <div className="flex-1 rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
                  <div className="text-lg font-semibold">99.9%</div>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Uptime</div>
                </div>
                <div className="flex-1 rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
                  <div className="text-lg font-semibold">&lt;100ms</div>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Latency</div>
                </div>
              </div>
              <div className="h-px bg-border/40" />
              <div>
                <p className="text-[11px] font-medium text-muted-foreground/70 mb-1.5 uppercase tracking-[0.06em]">Base URL</p>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-2.5 h-8">
                  <code className="text-[11px] text-muted-foreground/80 truncate">{BASE_URL}</code>
                  <button onClick={() => copyToClipboard(BASE_URL)} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent/50 transition-colors flex-shrink-0">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground/70 mb-1.5 uppercase tracking-[0.06em]">Quick Start</p>
                <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5">
                  <code className="text-[11px] leading-relaxed whitespace-pre-wrap block font-mono text-muted-foreground/80">
{`curl -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "X-SquidCloud-Encryption-Key: OPTIONAL_USER_KEY" \\
  ${BASE_URL}/files`}
                  </code>
                  <button onClick={() => copyToClipboard(`curl -H "X-SquidCloud-Key: YOUR_API_KEY" -H "X-SquidCloud-Encryption-Key: OPTIONAL_USER_KEY" ${BASE_URL}/files`)}
                    className="mt-2 inline-flex items-center gap-1.5 h-6 rounded px-2 text-[11px] font-medium text-muted-foreground/70 hover:text-foreground hover:bg-accent/50 transition-colors border border-border/40">
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-muted-foreground/70" />
                  <span className="text-[13px] font-medium">API Credits</span>
                </div>
                {loadingCredits && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/50" />}
              </div>
              {creditInfo ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-[12px] text-muted-foreground/70">
                    <span>{creditInfo.used} used of {creditInfo.daily_limit} today</span>
                    <span>{creditInfo.remaining} remaining</span>
                  </div>
                  <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", {
                        'bg-green-500': creditInfo.remaining / creditInfo.daily_limit > 0.5,
                        'bg-yellow-500': creditInfo.remaining / creditInfo.daily_limit <= 0.5 && creditInfo.remaining / creditInfo.daily_limit >= 0.25,
                        'bg-red-500': creditInfo.remaining / creditInfo.daily_limit < 0.25,
                      })}
                      style={{ width: `${(creditInfo.remaining / creditInfo.daily_limit) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                !loadingCredits && <p className="text-[12px] text-muted-foreground/50">Sign in to view your credit usage</p>
              )}
            </div>

            {profile?.tier === 'supporter-plus' && (
              <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Key className="w-4 h-4 text-muted-foreground/70" />
                  <span className="text-[13px] font-medium">Custom API Limits</span>
                </div>
                <p className="text-[12px] text-muted-foreground/60">Set custom daily limits per API key</p>
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="flex items-center gap-2">
                      <code className="text-[11px] text-muted-foreground/80 flex-1 truncate">{key.key_preview || key.key?.substring(0, 12) + '...'}</code>
                      <input
                        className="flex h-8 w-24 rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        type="number"
                        min="0"
                        placeholder="Limit"
                        value={customLimits[key.id] || ''}
                        onChange={(e) => setCustomLimits(prev => ({ ...prev, [key.id]: e.target.value }))}
                      />
                      <button
                        className="inline-flex items-center justify-center gap-1 h-7 rounded-md px-2 text-[11px] font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
                        disabled={savingKey === key.id}
                        onClick={async () => {
                          setSavingKey(key.id);
                          try {
                            const res = await fetch(`${BASE_URL}/keys/${key.id}/limits`, {
                              method: 'PATCH',
                              headers: {
                                'Content-Type': 'application/json',
                                'X-SquidCloud-Key': key.key,
                              },
                              body: JSON.stringify({ custom_daily_limit: parseInt(customLimits[key.id]) || 0 }),
                            });
                            if (res.ok) {
                              sonnerToast.success('Limit updated');
                            } else {
                              sonnerToast.error('Failed to update limit');
                            }
                          } catch {
                            sonnerToast.error('Failed to update limit');
                          } finally {
                            setSavingKey(null);
                          }
                        }}
                      >
                        {savingKey === key.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                      </button>
                    </div>
                  ))}
                  {apiKeys.length === 0 && (
                    <p className="text-[12px] text-muted-foreground/50">No API keys found</p>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="keys" className="mt-0">
            <ApiKeyManagement />
          </TabsContent>

          <TabsContent value="playground" className="space-y-3 mt-0">
            <div className="rounded-2xl border border-border/50 bg-card/80 p-3 space-y-3">
              <div className="flex items-center gap-2.5">
                <Play className="w-4 h-4 text-muted-foreground/70" />
                <span className="text-[13px] font-medium">API Playground</span>
                <span className="text-[11px] text-muted-foreground/50">Send requests with API key and optional encryption key</span>
              </div>
              <div className="h-px bg-border/40" />
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground/70">Method</Label>
                  <Select value={playgroundMethod} onValueChange={(value) => setPlaygroundMethod(value as 'GET' | 'POST' | 'DELETE')}>
                    <SelectTrigger className="h-8 mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET" className="text-xs">GET</SelectItem>
                      <SelectItem value="POST" className="text-xs">POST</SelectItem>
                      <SelectItem value="DELETE" className="text-xs">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground/70">Endpoint Path</Label>
                  <Input className="h-8 mt-1 text-xs" value={playgroundEndpoint} onChange={(e) => setPlaygroundEndpoint(e.target.value)} placeholder="/files" />
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground/70">API Key</Label>
                <Input className="h-8 mt-1 text-xs font-mono" type="password" value={playgroundApiKey} onChange={(e) => setPlaygroundApiKey(e.target.value)} placeholder="cb_your_api_key" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground/70">Encryption Key <span className="text-muted-foreground/40 font-normal">(optional)</span></Label>
                <Input className="h-8 mt-1 text-xs font-mono" type="password" value={playgroundEncryptionKey} onChange={(e) => setPlaygroundEncryptionKey(e.target.value)} placeholder="optional user encryption key" />
                <p className="text-[10px] text-muted-foreground/50 mt-1">Wrong key for encrypted download returns 422.</p>
              </div>
              {playgroundMethod !== 'GET' && (
                <div>
                  <Label className="text-[11px] text-muted-foreground/70">Request Body <span className="text-muted-foreground/40 font-normal">(JSON)</span></Label>
                  <Textarea className="mt-1 font-mono text-xs" rows={4} value={playgroundBody} onChange={(e) => setPlaygroundBody(e.target.value)} placeholder='{"key":"value"}' />
                </div>
              )}
              <button onClick={testEndpoint} disabled={playgroundLoading}
                className="flex items-center justify-center gap-1.5 h-8 rounded-lg bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/20 transition-colors disabled:opacity-50">
                {playgroundLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending Request...</> : <><Play className="w-3.5 h-3.5" /> Send Request</>}
              </button>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/80 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium">Response</span>
                {playgroundResponse && <span className="text-[10px] text-muted-foreground/50">Latest request result</span>}
              </div>
              <Textarea value={playgroundResponse} readOnly rows={10} className="font-mono text-[11px] leading-relaxed min-h-[100px]" placeholder="Response will appear here..." />
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-3 mt-0">
            <div className="rounded-2xl border border-border/50 bg-card/80 p-3 space-y-2">
              <div className="flex items-center gap-2.5 pb-2">
                <Activity className="w-4 h-4 text-muted-foreground/70" />
                <span className="text-[13px] font-medium">Endpoint Health</span>
              </div>
              <div className="space-y-1">
                {endpoints.filter((e) => e.statusPath).map((endpoint) => {
                  const status = endpointStatus[endpoint.path];
                  return (
                    <div key={endpoint.path} className="flex items-center justify-between h-8 px-2.5 rounded-lg hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", methodBadgeClass(endpoint.method))}>{endpoint.method}</span>
                        <code className="text-[12px] text-muted-foreground/80">{endpoint.path}</code>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        {status?.status === 'online' && <><CheckCircle2 className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400/80">{status.latency ? `${status.latency}ms` : 'Online'}</span></>}
                        {status?.status === 'offline' && <><XCircle className="w-3 h-3 text-red-400" /><span className="text-red-400/80">Offline</span></>}
                        {(!status || status.status === 'checking') && <><Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50" /><span className="text-muted-foreground/50">Checking</span></>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <ApiUsageChart />
            <ApiRequestLogs />
          </TabsContent>

          <TabsContent value="docs" className="space-y-3 mt-0">
            <div className="rounded-2xl border border-border/50 bg-card/80 p-3 space-y-3">
              <div className="flex items-center gap-2.5">
                <Key className="w-4 h-4 text-muted-foreground/70" />
                <span className="text-[13px] font-medium">Authentication</span>
              </div>
              <div className="h-px bg-border/40" />
              <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
                All requests require <code className="text-[11px] text-foreground/80 bg-muted/30 px-1 py-0.5 rounded">X-SquidCloud-Key</code> with a <code className="text-[11px] text-foreground/80 bg-muted/30 px-1 py-0.5 rounded">cb_...</code> API key. Upload and download also support optional caller key input.
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center h-8 px-2.5 rounded-lg border border-border/40 bg-muted/20">
                  <code className="text-[11px] text-muted-foreground/80">X-SquidCloud-Key: cb_your_api_key_here</code>
                </div>
                <div className="flex items-center h-8 px-2.5 rounded-lg border border-border/40 bg-muted/20">
                  <code className="text-[11px] text-muted-foreground/80">X-SquidCloud-Encryption-Key: optional_user_encryption_key</code>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[12px] font-medium text-amber-400/90">Security notes</p>
                  <p className="text-[11px] text-amber-400/60 mt-0.5">Invalid encryption key format returns 400. Wrong key for encrypted download returns 422.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/80 p-3 space-y-2">
              <div className="flex items-center gap-2.5 pb-1">
                <FileText className="w-4 h-4 text-muted-foreground/70" />
                <span className="text-[13px] font-medium">Endpoint Reference</span>
              </div>
              <div className="space-y-2">
                {endpoints.map((endpoint) => (
                  <div key={`${endpoint.method}-${endpoint.path}`} className="rounded-lg border border-border/40 bg-muted/15 p-2.5 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", methodBadgeClass(endpoint.method))}>{endpoint.method}</span>
                      <code className="text-[12px] font-medium text-foreground/80">{endpoint.path}</code>
                      <div className="flex gap-1">
                        {endpoint.scopes.map((scope) => (
                          <span key={scope} className="text-[9px] text-muted-foreground/50 px-1.5 py-0.5 rounded-full bg-muted/30 border border-border/30">{scope}</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[12px] text-muted-foreground/70">{endpoint.description}</p>
                    <div className="rounded-lg border border-border/30 bg-muted/30 p-2">
                      <code className="text-[11px] leading-relaxed whitespace-pre-wrap break-all text-muted-foreground/80 font-mono">{endpoint.example}</code>
                    </div>
                    {endpoint.sampleResponse && (
                      <div className="rounded-lg border border-border/30 bg-muted/30 p-2">
                        <code className="text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground/70 font-mono">{endpoint.sampleResponse}</code>
                      </div>
                    )}
                    <div className="flex gap-1.5 pt-0.5">
                      <button onClick={() => copyToClipboard(endpoint.example)}
                        className="inline-flex items-center gap-1 h-6 rounded px-2 text-[11px] text-muted-foreground/60 hover:text-foreground hover:bg-accent/50 transition-colors border border-border/40">
                        <Copy className="w-3 h-3" />
                        Copy cURL
                      </button>
                      <button onClick={() => { setPlaygroundMethod(endpoint.method); setPlaygroundEndpoint(endpoint.path.replace(':id', 'FILE_ID')); setActiveTab('playground'); }}
                        className="inline-flex items-center gap-1 h-6 rounded px-2 text-[11px] text-muted-foreground/60 hover:text-foreground hover:bg-accent/50 transition-colors border border-border/40">
                        <Play className="w-3 h-3" />
                        Try in Playground
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/80 p-3 space-y-2">
              <button onClick={() => setCostsOpen(!costsOpen)} className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2.5">
                  <span className="text-[13px] font-medium">Credit Costs</span>
                </div>
                <span className="text-[11px] text-muted-foreground/50">{costsOpen ? 'Hide' : 'Show'} costs</span>
              </button>
              {costsOpen && (
                <div className="space-y-2 pt-1">
                  <input
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Filter by operation name..."
                    value={costFilter}
                    onChange={(e) => setCostFilter(e.target.value)}
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-muted-foreground/50 border-b border-border/40">
                          <th className="text-left py-1.5 px-2 font-medium">Operation</th>
                          <th className="text-left py-1.5 px-2 font-medium">Base Cost</th>
                          <th className="text-left py-1.5 px-2 font-medium">Per MB</th>
                          <th className="text-left py-1.5 px-2 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {operationCosts
                          .filter(c => !costFilter || c.operation.toLowerCase().includes(costFilter.toLowerCase()))
                          .map((cost) => (
                            <tr key={cost.id || cost.operation} className="border-b border-border/20 hover:bg-accent/20 transition-colors">
                              <td className="py-1.5 px-2 font-mono text-foreground/80">{cost.operation}</td>
                              <td className="py-1.5 px-2 text-muted-foreground/70">{cost.base_cost}</td>
                              <td className="py-1.5 px-2 text-muted-foreground/70">{cost.per_mb ?? '-'}</td>
                              <td className="py-1.5 px-2 text-muted-foreground/60">{cost.description || '-'}</td>
                            </tr>
                          ))}
                        {operationCosts.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-3 text-center text-muted-foreground/50">No cost data available</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/80 p-3 space-y-2">
              <div className="flex items-center gap-2.5 pb-1">
                <span className="text-[13px] font-medium">HTTP Status Codes</span>
              </div>
              <div className="space-y-1">
                {[
                  { code: '200 OK', desc: 'Request succeeded' },
                  { code: '400 Bad Request', desc: 'Invalid input or encryption key format' },
                  { code: '401 Unauthorized', desc: 'Missing or invalid API key' },
                  { code: '422 Unprocessable Entity', desc: 'Encryption key missing/mismatch for encrypted download' },
                  { code: '404 Not Found', desc: 'Resource not found' },
                  { code: '500 Server Error', desc: 'Internal server error' },
                ].map(item => (
                  <div key={item.code} className="flex items-center justify-between h-7 px-2.5 rounded-lg hover:bg-accent/30 transition-colors">
                    <code className="text-[12px] text-muted-foreground/80">{item.code}</code>
                    <span className="text-[11px] text-muted-foreground/50">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DeveloperAPI;
