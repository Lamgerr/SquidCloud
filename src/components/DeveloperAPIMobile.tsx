import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Code, Key, Activity, FileText,
  Play, Copy, CheckCircle2, XCircle, Loader2,
  ChevronDown, Terminal, AlertCircle,
} from '@/lib/icon-map';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import ApiKeyManagement from './ApiKeyManagement';
import ApiUsageChart from './ApiUsageChart';
import ApiRequestLogs from './ApiRequestLogs';
import { AI_AGENT_PROMPT } from '@/lib/ai-agent-prompt';

type Endpoint = {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  description: string;
  scopes: string[];
  example: string;
  sampleResponse?: string;
};

type EndpointHealth = {
  status: 'checking' | 'online' | 'offline';
  latency?: number;
};

const BASE_URL = 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api';

const endpoints: Endpoint[] = [
  { method: 'POST', path: '/upload', description: 'Initialize upload — get signed B2 URLs + raw encryption key (save it, shown once). Server picks chunk_size: 512KB/1MB/2MB', scopes: ['write'], example: `curl -X POST ${BASE_URL}/upload -H "X-SquidCloud-Key: YOUR_API_KEY" -H "Content-Type: application/json" -d '{"name":"doc.pdf","type":"application/pdf","size":1024}'` },
  { method: 'POST', path: '/upload/complete', description: 'Complete upload — server verifies chunks, re-encrypts them (RES54 v2, AES-256-GCM) and registers the file', scopes: ['write'], example: `curl -X POST ${BASE_URL}/upload/complete -H "X-SquidCloud-Key: YOUR_API_KEY" -H "Content-Type: application/json" -d '{"upload_id":"uuid"}'` },
  { method: 'GET', path: '/download/:id', description: 'Download decrypted file. Add ?signed=true for B2 URLs + raw key to decrypt client-side (RES54 v2)', scopes: ['read'], example: `curl -X GET "${BASE_URL}/download/FILE_ID?signed=true" -H "X-SquidCloud-Key: YOUR_API_KEY"` },
  { method: 'GET', path: '/files', description: 'List all files and folders', scopes: ['read'], example: `curl -X GET ${BASE_URL}/files -H "X-SquidCloud-Key: YOUR_API_KEY"`, sampleResponse: '{"files":[...],"success":true}' },
  { method: 'GET', path: '/files/:id/metadata', description: 'Get file metadata and encryption info', scopes: ['read'], example: `curl -X GET ${BASE_URL}/files/FILE_ID/metadata -H "X-SquidCloud-Key: YOUR_API_KEY"` },
  { method: 'GET', path: '/files/:id/download', description: 'Download decrypted file (legacy)', scopes: ['read'], example: `curl -X GET ${BASE_URL}/files/FILE_ID/download -H "X-SquidCloud-Key: YOUR_API_KEY" -o file.pdf` },
  { method: 'POST', path: '/files/upload/init', description: 'Legacy: Initialize chunked upload — get signed B2 URLs', scopes: ['write'], example: `curl -X POST ${BASE_URL}/files/upload/init -H "X-SquidCloud-Key: YOUR_API_KEY" -H "Content-Type: application/json" -d '{"name":"doc.pdf","type":"application/pdf","size":1024}'` },
  { method: 'POST', path: '/files/upload/complete', description: 'Legacy: Complete upload and register file', scopes: ['write'], example: `curl -X POST ${BASE_URL}/files/upload/complete -H "X-SquidCloud-Key: YOUR_API_KEY" -H "Content-Type: application/json" -d '{"upload_id":"...","file_id":"...","chunks":[...]}'` },
  { method: 'DELETE', path: '/files/:id', description: 'Soft delete a file (trash)', scopes: ['delete'], example: `curl -X DELETE ${BASE_URL}/files/FILE_ID -H "X-SquidCloud-Key: YOUR_API_KEY"` },
  { method: 'POST', path: '/stream/init', description: 'Get short-lived streaming session token (120s)', scopes: ['write'], example: `curl -X POST ${BASE_URL}/stream/init -H "X-SquidCloud-Key: YOUR_API_KEY" -H "Content-Type: application/json" -d '{"file_id":"FILE_ID"}'` },
  { method: 'GET', path: '/stream', description: 'Stream encrypted file (Range proxy, server-side decrypt)', scopes: ['read'], example: `curl -X GET "${BASE_URL}/stream?id=FILE_ID&token=STREAM_TOKEN"` },
  { method: 'GET', path: '/search', description: 'Search files by name, type, or metadata', scopes: ['read'], example: `curl -X GET "${BASE_URL}/search?q=doc&page=1&per_page=20" -H "X-SquidCloud-Key: YOUR_API_KEY"` },
  { method: 'GET', path: '/user', description: 'Get profile with credit balance and storage usage (alias /whoami)', scopes: ['read'], example: `curl -X GET ${BASE_URL}/user -H "X-SquidCloud-Key: YOUR_API_KEY"` },
  { method: 'GET', path: '/keys', description: 'List your API keys', scopes: ['read'], example: `curl -X GET ${BASE_URL}/keys -H "X-SquidCloud-Key: YOUR_API_KEY"` },
  { method: 'GET', path: '/storage', description: 'Get storage usage and quota', scopes: ['read'], example: `curl -X GET ${BASE_URL}/storage -H "X-SquidCloud-Key: YOUR_API_KEY"` },
  { method: 'GET', path: '/health', description: 'Health check (no auth required)', scopes: ['read'], example: `curl -X GET ${BASE_URL}/health` },
];

const methodBadgeClass = (method: Endpoint['method']) => {
  if (method === 'GET') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  if (method === 'POST') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  return 'bg-red-500/10 text-red-600 border-red-500/20';
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: Code },
  { id: 'keys', label: 'API Keys', icon: Key },
  { id: 'playground', label: 'Playground', icon: Play },
  { id: 'status', label: 'Status', icon: Activity },
  { id: 'docs', label: 'Docs', icon: FileText },
] as const;

const DeveloperAPIMobile = () => {
  const navigate = useNavigate();
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

  const [docsExpanded, setDocsExpanded] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Code copied to clipboard' });
  };

  React.useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      for (const ep of endpoints.filter(e => e.path === '/files' || e.path === '/storage')) {
        const key = ep.path;
        setEndpointStatus(p => ({ ...p, [key]: { status: 'checking' } }));
        try {
          const start = performance.now();
          const res = await fetch(`${BASE_URL}${ep.path}`, {
            method: 'HEAD',
            headers: { 'X-SquidCloud-Key': 'status-check' },
          });
          const latency = Math.round(performance.now() - start);
          if (!mounted) return;
          setEndpointStatus(p => ({ ...p, [key]: { status: res.status === 200 || res.status === 401 ? 'online' : 'offline', latency } }));
        } catch {
          if (!mounted) return;
          setEndpointStatus(p => ({ ...p, [key]: { status: 'offline' } }));
        }
      }
    };
    checkStatus();
    return () => { mounted = false; };
  }, []);

  const testEndpoint = async () => {
    if (!playgroundEndpoint.trim() || !playgroundApiKey.trim()) {
      toast({ title: 'Missing Information', description: 'Provide endpoint path and API key', variant: 'destructive' });
      return;
    }
    setPlaygroundLoading(true);
    setPlaygroundResponse('');
    try {
      const headers: Record<string, string> = { 'X-SquidCloud-Key': playgroundApiKey.trim(), 'Content-Type': 'application/json' };
      if (playgroundEncryptionKey.trim()) headers['X-SquidCloud-Encryption-Key'] = playgroundEncryptionKey.trim();
      const options: RequestInit = { method: playgroundMethod, headers };
      if (playgroundMethod !== 'GET' && playgroundBody.trim()) options.body = playgroundBody;
      const start = performance.now();
      const response = await fetch(`${BASE_URL}${playgroundEndpoint}`, options);
      const latency = Math.round(performance.now() - start);
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : await response.text();
      setPlaygroundResponse(JSON.stringify({ status: response.status, statusText: response.statusText, latency: `${latency}ms`, body: payload }, null, 2));
    } catch (error: any) {
      setPlaygroundResponse(JSON.stringify({ error: error.message || 'Unknown error' }, null, 2));
    } finally {
      setPlaygroundLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center gap-2 px-4 h-12">
          <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors -ml-1">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-[15px] font-bold leading-tight">Developer API</h1>
            <p className="text-[10px] text-muted-foreground/60">SquidCloud API v4.0</p>
          </div>
        </div>
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-none">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 h-8 text-[12px] font-medium rounded-full whitespace-nowrap transition-colors flex-shrink-0",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground/70 hover:text-foreground hover:bg-accent/40"
                )}>
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 pb-8 space-y-3">
        {activeTab === 'overview' && (
          <>
            <div className="rounded-2xl border border-border/50 bg-card/80 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-muted-foreground/70" />
                <span className="text-[13px] font-medium">SquidCloud API v4.0</span>
              </div>
              <div className="h-px bg-border/40" />
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: endpoints.length.toString(), label: 'Endpoints' },
                  { value: '99.9%', label: 'Uptime' },
                  { value: '<100ms', label: 'Latency' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center">
                    <div className="text-lg font-semibold tabular-nums">{s.value}</div>
                    <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="h-px bg-border/40" />
              <div>
                <p className="text-[10px] font-medium text-muted-foreground/70 mb-1.5 uppercase tracking-[0.06em]">Base URL</p>
                <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 h-10">
                  <code className="text-[11px] text-muted-foreground/80 truncate flex-1 font-mono">{BASE_URL}</code>
                  <button onClick={() => copyToClipboard(BASE_URL)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-accent/50 transition-colors flex-shrink-0">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground/70 mb-1.5 uppercase tracking-[0.06em]">Quick Start</p>
                <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                  <code className="text-[11px] leading-relaxed whitespace-pre-wrap block font-mono text-muted-foreground/80">
{`curl -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  ${BASE_URL}/files`}
                  </code>
                  <button onClick={() => copyToClipboard(`curl -H "X-SquidCloud-Key: YOUR_API_KEY" ${BASE_URL}/files`)}
                    className="mt-2 inline-flex items-center gap-1.5 h-8 rounded-lg px-3 text-[11px] font-medium text-muted-foreground/70 hover:text-foreground hover:bg-accent/50 transition-colors border border-border/40">
                    <Copy className="w-3.5 h-3.5" />
                    Copy cURL
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'keys' && (
          <ApiKeyManagement />
        )}

        {activeTab === 'playground' && (
          <>
            <div className="rounded-2xl border border-border/50 bg-card/80 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-muted-foreground/70" />
                <span className="text-[13px] font-medium">API Playground</span>
              </div>
              <div className="h-px bg-border/40" />
              <div>
                <Label className="text-[11px] text-muted-foreground/70">Method</Label>
                <Select value={playgroundMethod} onValueChange={(v) => setPlaygroundMethod(v as 'GET' | 'POST' | 'DELETE')}>
                  <SelectTrigger className="h-10 mt-1 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground/70">Endpoint Path</Label>
                <Input className="h-10 mt-1 text-sm" value={playgroundEndpoint} onChange={(e) => setPlaygroundEndpoint(e.target.value)} placeholder="/files" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground/70">API Key</Label>
                <Input className="h-10 mt-1 text-sm font-mono" type="password" value={playgroundApiKey} onChange={(e) => setPlaygroundApiKey(e.target.value)} placeholder="cb_your_api_key" />
              </div>
              <div>
                <button onClick={() => setPlaygroundEncryptionKey(playgroundEncryptionKey ? '' : ' ')} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground">
                  <ChevronDown className={cn("w-3 h-3 transition-transform", playgroundEncryptionKey.length > 0 && "rotate-180")} />
                  Encryption Key (optional)
                </button>
                {playgroundEncryptionKey.length > 0 && (
                  <div className="mt-2">
                    <Input className="h-10 text-sm font-mono" type="password" value={playgroundEncryptionKey === ' ' ? '' : playgroundEncryptionKey} onChange={(e) => setPlaygroundEncryptionKey(e.target.value)} placeholder="optional user encryption key" />
                    <p className="text-[10px] text-muted-foreground/50 mt-1">Wrong key for encrypted download returns 422.</p>
                  </div>
                )}
              </div>
              {playgroundMethod !== 'GET' && (
                <div>
                  <Label className="text-[11px] text-muted-foreground/70">Request Body <span className="text-muted-foreground/40 font-normal">(JSON)</span></Label>
                  <Textarea className="mt-1 font-mono text-sm" rows={4} value={playgroundBody} onChange={(e) => setPlaygroundBody(e.target.value)} placeholder='{"key":"value"}' />
                </div>
              )}
              <button onClick={testEndpoint} disabled={playgroundLoading}
                className="w-full flex items-center justify-center gap-1.5 h-11 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50">
                {playgroundLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><Play className="w-4 h-4" /> Send Request</>}
              </button>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/80 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted-foreground/70" />
                <span className="text-[13px] font-medium">Response</span>
                {playgroundResponse && <span className="text-[10px] text-muted-foreground/50 ml-auto">Latest</span>}
              </div>
              <Textarea value={playgroundResponse} readOnly rows={8} className="font-mono text-[11px] leading-relaxed min-h-[100px]" placeholder="Response will appear here..." />
            </div>
          </>
        )}

        {activeTab === 'status' && (
          <>
            <div className="rounded-2xl border border-border/50 bg-card/80 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground/70" />
                <span className="text-[13px] font-medium">Endpoint Health</span>
              </div>
              <div className="space-y-1">
                {endpoints.filter(e => e.path === '/files' || e.path === '/storage').map(ep => {
                  const status = endpointStatus[ep.path];
                  return (
                    <div key={ep.path} className="flex items-center justify-between h-10 px-3 rounded-xl hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", methodBadgeClass(ep.method))}>{ep.method}</span>
                        <code className="text-[12px] text-muted-foreground/80">{ep.path}</code>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        {status?.status === 'online' && <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400/80">{status.latency ? `${status.latency}ms` : 'Online'}</span></>}
                        {status?.status === 'offline' && <><XCircle className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400/80">Offline</span></>}
                        {(!status || status.status === 'checking') && <><Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/50" /><span className="text-muted-foreground/50">Checking</span></>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <ApiUsageChart />
            <ApiRequestLogs />
          </>
        )}

        {activeTab === 'docs' && (
          <>
            <div className="rounded-2xl border border-border/50 bg-card/80 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-muted-foreground/70" />
                <span className="text-[13px] font-medium">Authentication</span>
              </div>
              <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
                All requests require <code className="text-[11px] text-foreground/80 bg-muted/30 px-1 py-0.5 rounded">X-SquidCloud-Key</code> with a <code className="text-[11px] text-foreground/80 bg-muted/30 px-1 py-0.5 rounded">cb_...</code> API key.
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center h-10 px-3 rounded-xl border border-border/40 bg-muted/20">
                  <code className="text-[11px] text-muted-foreground/80">X-SquidCloud-Key: cb_your_api_key</code>
                </div>
                <div className="flex items-center h-10 px-3 rounded-xl border border-border/40 bg-muted/20">
                  <code className="text-[11px] text-muted-foreground/80">X-SquidCloud-Encryption-Key: optional</code>
                </div>
                <div className="flex items-center h-10 px-3 rounded-xl border border-border/40 bg-muted/20">
                  <code className="text-[11px] text-muted-foreground/80">Authorization: Bearer cb_your_api_key (also works)</code>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[12px] font-medium text-amber-400/90">Security notes</p>
                  <p className="text-[11px] text-amber-400/60 mt-0.5">Invalid encryption key format returns 400. Wrong key for encrypted download returns 422. Every response includes remaining credits.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" />
                <span className="text-[13px] font-medium">AI Agent Prompt</span>
                <span className="text-[10px] text-emerald-400/60 ml-auto">Copy-paste to any AI agent</span>
              </div>
              <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
                Paste this prompt into Cursor, Claude, Copilot or GPT and it will integrate the CloudBliss API —
                uploads, decryption, streaming, error handling — without guessing.
              </p>
              <Textarea
                readOnly
                rows={10}
                value={AI_AGENT_PROMPT}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-[10.5px] leading-relaxed resize-y min-h-[120px]"
              />
              <button onClick={() => copyToClipboard(AI_AGENT_PROMPT)}
                className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 text-[12px] font-medium">
                <Copy className="w-3.5 h-3.5" />
                Copy Prompt
              </button>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/80 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground/70" />
                <span className="text-[13px] font-medium">Endpoints</span>
              </div>
              <div className="space-y-2">
                {endpoints.map((ep, i) => (
                  <div key={i}>
                    <button onClick={() => setDocsExpanded(docsExpanded === ep.path ? null : ep.path)}
                      className="w-full flex items-center justify-between h-10 px-3 rounded-xl hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0", methodBadgeClass(ep.method))}>{ep.method}</span>
                        <code className="text-[12px] text-muted-foreground/80 truncate">{ep.path}</code>
                      </div>
                      <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0 transition-transform", docsExpanded === ep.path && "rotate-180")} />
                    </button>
                    {docsExpanded === ep.path && (
                      <div className="px-3 pb-3 space-y-2">
                        <p className="text-[12px] text-muted-foreground/70">{ep.description}</p>
                        <div className="flex gap-1">
                          {ep.scopes.map(s => (
                            <span key={s} className="text-[9px] text-muted-foreground/50 px-2 py-0.5 rounded-full bg-muted/30 border border-border/30">{s}</span>
                          ))}
                        </div>
                        <div className="rounded-xl border border-border/30 bg-muted/30 p-3">
                          <code className="text-[11px] leading-relaxed whitespace-pre-wrap break-all text-muted-foreground/80 font-mono">{ep.example}</code>
                        </div>
                        <button onClick={() => copyToClipboard(ep.example)}
                          className="inline-flex items-center gap-1.5 h-8 rounded-lg px-3 text-[11px] text-muted-foreground/60 hover:text-foreground hover:bg-accent/50 transition-colors border border-border/40">
                          <Copy className="w-3.5 h-3.5" />
                          Copy cURL
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/80 p-4 space-y-2">
              <span className="text-[13px] font-medium block">HTTP Status Codes</span>
              <div className="space-y-1">
                {[
                  { code: '200 OK', desc: 'Request succeeded' },
                  { code: '400 Bad Request', desc: 'Invalid input or encryption key format' },
                  { code: '401 Unauthorized', desc: 'Missing or invalid API key' },
                  { code: '422 Unprocessable', desc: 'Encryption key missing/mismatch' },
                  { code: '404 Not Found', desc: 'Resource not found' },
                  { code: '500 Server Error', desc: 'Internal server error' },
                ].map(item => (
                  <div key={item.code} className="flex items-center justify-between h-10 px-3 rounded-xl hover:bg-accent/30 transition-colors">
                    <code className="text-[12px] text-muted-foreground/80">{item.code}</code>
                    <span className="text-[11px] text-muted-foreground/50">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DeveloperAPIMobile;
