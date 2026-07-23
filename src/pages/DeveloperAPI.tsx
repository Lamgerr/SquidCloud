import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Settings2,
  Sliders,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Endpoint = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
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
    method: 'POST',
    path: '/upload',
    description: 'Initialize upload — get signed B2 URLs + encryption key (simple, recommended)',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/upload \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"video.mp4","type":"video/mp4","size":10485760}'`,
    sampleResponse: `{
  "upload_id": "uuid",
  "file_id": "uuid",
  "encryption_key": "hex_string",
  "urls": [{"index":0,"upload_url":"https://...","path":"..."}],
  "chunk_size": 1048576,
  "total_chunks": 10,
  "success": true
}`,
  },
  {
    method: 'POST',
    path: '/upload/complete',
    description: 'Complete upload — just send upload_id, server verifies and registers file',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/upload/complete \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"upload_id":"uuid"}'`,
    sampleResponse: `{
  "file": {"id":"...","name":"video.mp4","size":10485760},
  "success": true
}`,
  },
  {
    method: 'POST',
    path: '/upload/encrypted',
    description: 'Upload plaintext chunks, server encrypts with RES54 and stores on B2',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/upload/encrypted \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"photo.jpg","type":"image/jpeg","size":524288,"chunks":[{"index":0,"upload_url":"..."}]}'`,
  },
  {
    method: 'GET',
    path: '/download/:id',
    description: 'Download file — auto-decrypts encrypted files, returns plaintext (simple, recommended)',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/download/FILE_ID -H "X-SquidCloud-Key: YOUR_API_KEY" -o file.pdf`,
  },
  {
    method: 'GET',
    path: '/files',
    description: 'List all files and folders for the authenticated user (paginated, searchable)',
    scopes: ['read'],
    statusPath: '/files',
    example: `curl -X GET ${BASE_URL}/files?page=1&per_page=50 -H "X-SquidCloud-Key: YOUR_API_KEY"`,
    sampleResponse: `{
  "files": [...],
  "folders": [...],
  "total_files": 50,
  "total_folders": 2,
  "page": 1,
  "per_page": 50,
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
    description: 'Download decrypted file. Optional ?signed=true returns direct B2 URLs.',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/files/FILE_ID/download -H "X-SquidCloud-Key: YOUR_API_KEY" -o downloaded-file.pdf`,
  },
  {
    method: 'POST',
    path: '/files/upload/init',
    description: 'Legacy: Initialize a chunked upload — get signed B2 URLs',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/files/upload/init \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"video.mp4","type":"video/mp4","size":10485760}'`,
  },
  {
    method: 'POST',
    path: '/files/upload/complete',
    description: 'Legacy: Complete a chunked upload — verify chunks and register file',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/files/upload/complete \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"upload_id":"uuid","file_id":"uuid","chunks":[{"index":0,"path":"...","sha256":"..."}]}'`,
  },
  {
    method: 'DELETE',
    path: '/files/:id',
    description: 'Soft delete a file (moves to trash)',
    scopes: ['delete'],
    statusPath: null,
    example: `curl -X DELETE ${BASE_URL}/files/FILE_ID -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'POST',
    path: '/files/:id/restore',
    description: 'Restore a soft-deleted file from trash',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/files/FILE_ID/restore \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'PUT',
    path: '/files/:id/rename',
    description: 'Rename a file',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X PUT ${BASE_URL}/files/FILE_ID/rename \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"new-name.pdf"}'`,
  },
  {
    method: 'POST',
    path: '/files/:id/move',
    description: 'Move a file to a different folder',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/files/FILE_ID/move \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"folder_id":"TARGET_FOLDER_ID"}'`,
  },
  {
    method: 'POST',
    path: '/files/copy',
    description: 'Copy a file within the same workspace',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/files/copy \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"file_id":"SOURCE_FILE_ID","new_name":"copy-name.pdf"}'`,
  },
  {
    method: 'POST',
    path: '/stream/init',
    description: 'Get a short-lived streaming session token for encrypted media playback',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/stream/init \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"file_id":"FILE_ID"}'`,
    sampleResponse: `{
  "token": "eyJmaWxl...",
  "stream_url": "/stream?id=FILE_ID&token=eyJmaWxl...",
  "expires_in": 120,
  "success": true
}`,
  },
  {
    method: 'GET',
    path: '/stream',
    description: 'Stream encrypted file via server-side decrypting proxy (Range requests, seeking)',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET "${BASE_URL}/stream?id=FILE_ID&token=STREAM_TOKEN" -o -`,
  },
  {
    method: 'GET',
    path: '/search',
    description: 'Search files by name, type, or metadata with pagination',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET "${BASE_URL}/search?q=document&type=image&page=1&per_page=20" -H "X-SquidCloud-Key: YOUR_API_KEY"`,
    sampleResponse: `{
  "files": [...],
  "folders": [...],
  "total": 10,
  "page": 1,
  "per_page": 20,
  "success": true
}`,
  },
  {
    method: 'POST',
    path: '/batch/delete',
    description: 'Batch delete multiple files by ID (max 100)',
    scopes: ['delete'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/batch/delete \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"file_ids":["ID1","ID2"]}'`,
    sampleResponse: `{
  "action": "delete",
  "results": [...],
  "succeeded": 2,
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
    example: `curl -X POST ${BASE_URL}/batch/move \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"file_ids":["ID1","ID2"],"folder_id":"TARGET_FOLDER_ID"}'`,
    sampleResponse: `{
  "action": "move",
  "results": [...],
  "succeeded": 2,
  "failed": 0,
  "success": true
}`,
  },
  {
    method: 'POST',
    path: '/batch/restore',
    description: 'Batch restore multiple files from trash by ID',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/batch/restore \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"file_ids":["ID1","ID2"]}'`,
  },
  {
    method: 'POST',
    path: '/batch/copy',
    description: 'Batch copy files to a different folder',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/batch/copy \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"file_ids":["ID1","ID2"],"folder_id":"TARGET_FOLDER_ID"}'`,
  },
  {
    method: 'GET',
    path: '/stats/usage',
    description: 'Get daily/weekly/monthly credit usage statistics',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/stats/usage -H "X-SquidCloud-Key: YOUR_API_KEY"`,
    sampleResponse: `{
  "usage": {
    "today": {"credits_used": 42, "daily_limit": 1000},
    "this_week": {"credits_used": 210},
    "this_month": {"credits_used": 840},
    "total_requests_today": 42,
    "credits_remaining": 958
  },
  "success": true
}`,
  },
  {
    method: 'GET',
    path: '/stats/credits',
    description: 'Get detailed credit usage log with pagination',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET "${BASE_URL}/stats/credits?page=1&per_page=50" \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'GET',
    path: '/stats/storage',
    description: 'Get storage breakdown by file type and encryption status',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/stats/storage \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
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
    path: '/keys',
    description: 'List API keys for the authenticated user',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/keys -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'POST',
    path: '/keys',
    description: 'Create a new API key with optional scopes and expiration',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/keys \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"My Key","scopes":["*"]}'`,
    sampleResponse: `{
  "key": {"id":"...","name":"My Key","key_prefix":"cb_..."},
  "raw_key": "cb_...",
  "message": "Save the raw key — it will not be shown again.",
  "success": true
}`,
  },
  {
    method: 'PUT',
    path: '/keys/:id',
    description: 'Update API key name, scopes, or active status',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X PUT ${BASE_URL}/keys/KEY_ID \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Updated Key","is_active":false}'`,
  },
  {
    method: 'DELETE',
    path: '/keys/:id',
    description: 'Permanently delete an API key',
    scopes: ['delete'],
    statusPath: null,
    example: `curl -X DELETE ${BASE_URL}/keys/KEY_ID \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'PUT',
    path: '/keys/:id/limits',
    description: 'Set per-key custom daily limit and rate limit',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X PUT ${BASE_URL}/keys/KEY_ID/limits \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"custom_daily_limit":5000,"custom_rate_limit_rps":100}'`,
  },
  {
    method: 'GET',
    path: '/storage',
    description: 'Get storage usage, file count, and total size',
    scopes: ['read'],
    statusPath: '/storage',
    example: `curl -X GET ${BASE_URL}/storage -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'GET',
    path: '/user',
    description: 'Get user profile with credit balance and storage usage',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/user \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
    sampleResponse: `{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "User Name",
  "storage_used": 1048576,
  "total_files": 42,
  "credits": {"remaining": 850, "used_today": 150, "daily_limit": 1000},
  "success": true
}`,
  },
  {
    method: 'GET',
    path: '/whoami',
    description: 'Alias for GET /user',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/whoami \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'GET',
    path: '/secrets',
    description: 'List all stored secrets (values not returned)',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/secrets \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'POST',
    path: '/secrets',
    description: 'Create an encrypted secret stored in SquidVeil vault',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/secrets \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"db-password","value":"s3cret!","storage":"database"}'`,
    sampleResponse: `{
  "secret": {"id":"...","name":"db-password","storage_type":"database"},
  "success": true
}`,
  },
  {
    method: 'POST',
    path: '/secrets/:name/verify',
    description: 'Verify if a candidate value matches a stored secret',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/secrets/db-password/verify \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"value":"s3cret!"}'`,
    sampleResponse: `{
  "matched": true,
  "success": true
}`,
  },
  {
    method: 'PATCH',
    path: '/secrets/:id/rename',
    description: 'Rename a stored secret',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X PATCH ${BASE_URL}/secrets/SECRET_ID/rename \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"new-name"}'`,
  },
  {
    method: 'DELETE',
    path: '/secrets/:id',
    description: 'Permanently delete a secret',
    scopes: ['delete'],
    statusPath: null,
    example: `curl -X DELETE ${BASE_URL}/secrets/SECRET_ID \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'POST',
    path: '/squidshake/handshake',
    description: 'Initiate a SquidShake handshake for ephemeral session',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/squidshake/handshake \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"device_fingerprint":"device-id","project_id":"my-app"}'`,
  },
  {
    method: 'POST',
    path: '/squidshake/ref',
    description: 'Issue a VeilRef for a secret within an active session',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/squidshake/ref \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"session_id":"...","secret_name":"db-password","device_fingerprint":"..."}'`,
  },
  {
    method: 'POST',
    path: '/squidshake/audit',
    description: 'Log an audit entry for a SquidShake action',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/squidshake/audit \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"resolve","project_id":"my-app","secret_name":"db-password","success":true}'`,
  },
  {
    method: 'POST',
    path: '/veilref/verify',
    description: 'Verify a VeilRef is valid and not expired',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/veilref/verify \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"veil_ref_json":"..."}'`,
  },
  {
    method: 'POST',
    path: '/veilref/resolve',
    description: 'Resolve a VeilRef to retrieve the underlying secret value',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/veilref/resolve \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"veil_ref_json":"..."}'`,
  },
  {
    method: 'GET',
    path: '/health',
    description: 'Health check endpoint returning server status and version (no auth required)',
    scopes: ['read'],
    statusPath: '/health',
    example: `curl -X GET ${BASE_URL}/health`,
    sampleResponse: `{
  "status": "ok",
  "version": "4.0",
  "timestamp": "...",
  "db": "connected",
  "uptime": 12345,
  "success": true
}`,
  },
];

const methodBadgeClass = (method: Endpoint['method']) => {
  if (method === 'GET') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  if (method === 'POST') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  if (method === 'PUT') return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  if (method === 'PATCH') return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
  return 'bg-red-500/10 text-red-600 border-red-500/20';
};

const DeveloperAPI = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [endpointStatus, setEndpointStatus] = useState<Record<string, EndpointHealth>>({});

  const [playgroundMethod, setPlaygroundMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>('GET');
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
  const [configKey, setConfigKey] = useState<any>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configForm, setConfigForm] = useState<Record<string, any>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  const [accountCredits, setAccountCredits] = useState<any>(null);
  const [accountWeeklyLog, setAccountWeeklyLog] = useState<any>(null);
  const [accountMonthlyLog, setAccountMonthlyLog] = useState<any>(null);
  const [accountRequestCount, setAccountRequestCount] = useState(0);
  const [statusLoading, setStatusLoading] = useState(false);
  const [resetCountdown, setResetCountdown] = useState('');

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
        const apiKey = user.email || '';
        const [userRes, usageRes] = await Promise.allSettled([
          fetch(`${BASE_URL}/user`, { headers: { 'X-SquidCloud-Key': apiKey } }),
          fetch(`${BASE_URL}/stats/usage`, { headers: { 'X-SquidCloud-Key': apiKey } }),
        ]);

        if (userRes.status === 'fulfilled' && userRes.value.ok) {
          const data = await userRes.value.json();
          if (isMounted && data.credits) {
            setCreditInfo(data.credits);
          }
        }

      } catch {
      } finally {
        if (isMounted) setLoadingCredits(false);
      }

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

    fetchUserAndCredits();
    fetchAccountData();
    return () => { isMounted = false; };
  }, []);

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

  const fetchAccountData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setStatusLoading(true);
    try {
      const [creditsRes, weekRes, monthRes, reqsRes] = await Promise.all([
        supabase.from('api_credits').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('api_credit_log').select('credits_deducted').gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).eq('user_id', user.id),
        supabase.from('api_credit_log').select('credits_deducted').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()).eq('user_id', user.id),
        supabase.from('api_request_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', new Date().toISOString().slice(0, 10)),
      ]);
      if (creditsRes.data) setAccountCredits(creditsRes.data);
      if (weekRes.data) setAccountWeeklyLog(weekRes.data.reduce((s: number, r: any) => s + (r.credits_deducted || 0), 0));
      if (monthRes.data) setAccountMonthlyLog(monthRes.data.reduce((s: number, r: any) => s + (r.credits_deducted || 0), 0));
      setAccountRequestCount(reqsRes.count || 0);
    } catch {} finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    const calcCountdown = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setUTCHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setResetCountdown(`${h}h ${m}m ${s}s`);
    };
    calcCountdown();
    const interval = setInterval(calcCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

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
            <p className="text-[12px] text-muted-foreground/70">Build with SquidCloud API v4.0</p>
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
                <span className="text-[13px] font-medium">SquidCloud API v4.0</span>
                <span className="text-[11px] text-muted-foreground/50">Credit-based file API with CDN streaming, secrets vault, and workspace collaboration</span>
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

            {apiKeys.length > 0 && (
              <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-4 h-4 text-muted-foreground/70" />
                  <span className="text-[13px] font-medium">Per-Key Configuration</span>
                </div>
                <p className="text-[12px] text-muted-foreground/60">Configure limits, rate limits, and security per API key</p>
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between h-9 px-2.5 rounded-lg hover:bg-accent/20 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <Key className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                        <code className="text-[12px] text-muted-foreground/80 truncate">{key.name || key.key_prefix || key.key?.substring(0, 12)}</code>
                      </div>
                      <Dialog open={configDialogOpen && configKey?.id === key.id} onOpenChange={(open) => { setConfigDialogOpen(open); if (open) { setConfigKey(key); setConfigForm({ custom_daily_limit: String(key.custom_daily_limit ?? ''), custom_rate_limit_rps: String(key.custom_rate_limit_rps ?? ''), allow_hmac: key.allow_hmac ?? false, is_disabled: key.is_disabled ?? false }); } }}>
                        <DialogTrigger asChild>
                          <button
                            className="inline-flex items-center gap-1 h-7 rounded-md px-2 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground hover:bg-accent/50 transition-colors border border-border/40"
                            onClick={() => { setConfigKey(key); setConfigForm({ custom_daily_limit: String(key.custom_daily_limit ?? ''), custom_rate_limit_rps: String(key.custom_rate_limit_rps ?? ''), allow_hmac: key.allow_hmac ?? false, is_disabled: key.is_disabled ?? false }); }}
                          >
                            <Settings2 className="w-3 h-3" />
                            Configure
                          </button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Key Configuration</DialogTitle>
                            <DialogDescription>
                              Configure limits and security for <code className="text-xs">{key.name || key.key_prefix}</code>
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-muted-foreground/70">Daily Credit Limit</Label>
                                <Input
                                  className="h-8 text-xs"
                                  type="number" min="0"
                                  placeholder="Default"
                                  value={configForm.custom_daily_limit}
                                  onChange={(e) => setConfigForm(p => ({ ...p, custom_daily_limit: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-muted-foreground/70">Rate Limit (req/s)</Label>
                                <Input
                                  className="h-8 text-xs"
                                  type="number" min="0"
                                  placeholder="Default"
                                  value={configForm.custom_rate_limit_rps}
                                  onChange={(e) => setConfigForm(p => ({ ...p, custom_rate_limit_rps: e.target.value }))}
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between h-8 px-2.5 rounded-lg border border-border/40 bg-muted/20">
                              <Label className="text-[12px] text-muted-foreground/80">Require HMAC Request Signing</Label>
                              <Switch
                                checked={configForm.allow_hmac}
                                onCheckedChange={(v) => setConfigForm(p => ({ ...p, allow_hmac: v }))}
                              />
                            </div>
                            <div className="flex items-center justify-between h-8 px-2.5 rounded-lg border border-border/40 bg-muted/20">
                              <Label className="text-[12px] text-foreground/80">Disable This Key</Label>
                              <Switch
                                checked={configForm.is_disabled}
                                onCheckedChange={(v) => setConfigForm(p => ({ ...p, is_disabled: v }))}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <button
                              className="inline-flex items-center justify-center gap-1 h-8 rounded-md px-3 text-[12px] font-medium text-muted-foreground/60 hover:text-foreground hover:bg-accent/50 transition-colors border border-border/40"
                              onClick={() => setConfigDialogOpen(false)}
                            >Cancel</button>
                            <button
                              className="inline-flex items-center justify-center gap-1 h-8 rounded-md px-3 text-[12px] font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
                              disabled={savingConfig}
                              onClick={async () => {
                                setSavingConfig(true);
                                try {
                                  const body: Record<string, any> = {};
                                  if (configForm.custom_daily_limit) body.custom_daily_limit = parseInt(configForm.custom_daily_limit) || 0;
                                  if (configForm.custom_rate_limit_rps) body.custom_rate_limit_rps = parseInt(configForm.custom_rate_limit_rps) || 0;
                                  body.allow_hmac = !!configForm.allow_hmac;
                                  body.is_disabled = !!configForm.is_disabled;

                                  const res = await supabase
                                    .from('api_key_limits')
                                    .upsert({
                                      api_key_id: configKey.id,
                                      custom_daily_limit: body.custom_daily_limit || null,
                                      custom_rate_limit_rps: body.custom_rate_limit_rps || null,
                                      is_disabled: body.is_disabled,
                                    });

                                  if (configKey.allow_hmac !== body.allow_hmac) {
                                    await supabase
                                      .from('api_keys')
                                      .update({ allow_hmac: body.allow_hmac })
                                      .eq('id', configKey.id);
                                  }

                                  setConfigDialogOpen(false);
                                  sonnerToast.success('Key configuration saved');
                                } catch {
                                  sonnerToast.error('Failed to save configuration');
                                } finally {
                                  setSavingConfig(false);
                                }
                              }}
                            >
                              {savingConfig ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                            </button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  ))}
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
            <div className="rounded-2xl border border-border/50 bg-card/80 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-muted-foreground/70" />
                  <span className="text-[13px] font-medium">Account Credits</span>
                </div>
                <button
                  onClick={fetchAccountData}
                  disabled={statusLoading}
                  className="inline-flex items-center justify-center gap-1 h-7 rounded-md px-2 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground hover:bg-accent/50 transition-colors border border-border/40 disabled:opacity-50"
                >
                  {statusLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                  Refresh
                </button>
              </div>
              <div className="h-px bg-border/40" />
              {accountCredits ? (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
                      <div className="text-lg font-semibold tabular-nums">{accountCredits.credits_used_today}</div>
                      <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Used Today</div>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
                      <div className="text-lg font-semibold tabular-nums">{accountCredits.credits_remaining < 0 ? '∞' : accountCredits.credits_remaining}</div>
                      <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Left</div>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
                      <div className="text-lg font-semibold tabular-nums">{accountCredits.daily_limit < 0 ? '∞' : accountCredits.daily_limit}</div>
                      <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Daily Limit</div>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
                      <div className="text-lg font-semibold tabular-nums">{accountRequestCount}</div>
                      <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Requests Today</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
                      <div className="text-lg font-semibold tabular-nums">{accountWeeklyLog ?? '-'}</div>
                      <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">This Week</div>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
                      <div className="text-lg font-semibold tabular-nums">{accountMonthlyLog ?? '-'}</div>
                      <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">This Month</div>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
                      <div className="text-lg font-semibold tabular-nums">{resetCountdown}</div>
                      <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Until Reset</div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[12px] text-muted-foreground/70 mb-1">
                      <span>Credits remaining: {accountCredits.credits_remaining < 0 ? '∞' : accountCredits.credits_remaining} / {accountCredits.daily_limit < 0 ? '∞' : accountCredits.daily_limit}</span>
                      <span>
                        {accountCredits.daily_limit > 0
                          ? Math.round((accountCredits.credits_remaining / accountCredits.daily_limit) * 100) + '%'
                          : 'Unlimited'}
                      </span>
                    </div>
                    {accountCredits.daily_limit > 0 && (
                      <div className="w-full h-2.5 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", {
                            'bg-green-500': (accountCredits.credits_remaining / accountCredits.daily_limit) > 0.5,
                            'bg-yellow-500': (accountCredits.credits_remaining / accountCredits.daily_limit) <= 0.5 && (accountCredits.credits_remaining / accountCredits.daily_limit) >= 0.25,
                            'bg-red-500': (accountCredits.credits_remaining / accountCredits.daily_limit) < 0.25,
                          })}
                          style={{ width: `${Math.min(100, (accountCredits.credits_remaining / accountCredits.daily_limit) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground/50 text-center">
                    Last reset: {new Date(accountCredits.last_reset_date + 'T00:00:00Z').toLocaleDateString()}
                  </div>
                </>
              ) : (
                <p className="text-[12px] text-muted-foreground/50 text-center py-4">
                  {statusLoading ? 'Loading credits...' : 'Sign in to view your account credits'}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/80 p-3 space-y-2">
              <div className="flex items-center gap-2.5 pb-1">
                <Key className="w-4 h-4 text-muted-foreground/70" />
                <span className="text-[13px] font-medium">API Keys (Shared Credits)</span>
              </div>
              <p className="text-[11px] text-muted-foreground/60">All keys under your account share the same credit pool</p>
              <div className="space-y-1">
                {apiKeys.length > 0 ? apiKeys.map((key) => {
                  const limit = key.custom_daily_limit || key.daily_limit;
                  return (
                    <div key={key.id} className="flex items-center justify-between h-8 px-2.5 rounded-lg hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <Key className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
                        <code className="text-[11px] text-muted-foreground/80 truncate">{key.name || key.key_prefix}</code>
                        {!key.is_active && <span className="text-[10px] text-red-400/80">Disabled</span>}
                      </div>
                      <span className="text-[11px] text-muted-foreground/50">
                        {limit ? `${limit}/day` : 'No limit'} · {key.allow_hmac ? 'HMAC' : 'No HMAC'}
                      </span>
                    </div>
                  );
                }) : (
                  <p className="text-[12px] text-muted-foreground/50 text-center py-2">No API keys found</p>
                )}
              </div>
            </div>

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
                <div className="flex items-center h-8 px-2.5 rounded-lg border border-border/40 bg-muted/20">
                  <code className="text-[11px] text-muted-foreground/80">X-Timestamp: 1700000000000 (Unix ms, ±5 min)</code>
                </div>
                <div className="flex items-center h-8 px-2.5 rounded-lg border border-border/40 bg-muted/20">
                  <code className="text-[11px] text-muted-foreground/80">X-Signature: HMAC-SHA256(timestamp+nonce+body, apiKey)</code>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[12px] font-medium text-amber-400/90">Security notes</p>
                  <p className="text-[11px] text-amber-400/60 mt-0.5">Invalid encryption key format returns 400. Wrong key for encrypted download returns 422. Opt-in HMAC signing prevents request tampering. Credit deduction info is included in every response.</p>
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
                <span className="text-[13px] font-medium">Credit System</span>
              </div>
              <div className="space-y-2">
                <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
                  Every API call deducts credits based on the operation type and file size (where applicable).
                  Credits reset daily at midnight UTC. The response headers include your remaining credit balance.
                </p>
                <div className="rounded-lg border border-border/30 bg-muted/20 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground/70">Credit deduction response</span>
                  </div>
                  <code className="text-[11px] leading-relaxed text-muted-foreground/70 font-mono block">
{`{
  "...": "...",
  "credits": {
    "deducted": 1,
    "remaining": 842,
    "used_today": 158,
    "daily_limit": 1000
  }
}`}
                  </code>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/80 p-3 space-y-2">
              <div className="flex items-center gap-2.5 pb-1">
                <span className="text-[13px] font-medium">HTTP Status Codes</span>
              </div>
              <div className="space-y-1">
                {[
                  { code: '200 OK', desc: 'Request succeeded' },
                  { code: '201 Created', desc: 'Resource created (upload, key, secret)' },
                  { code: '400 Bad Request', desc: 'Invalid input or encryption key format' },
                  { code: '401 Unauthorized', desc: 'Missing or invalid API key' },
                  { code: '402 Payment Required', desc: 'Insufficient credits or expired subscription' },
                  { code: '403 Forbidden', desc: 'Key disabled or insufficient permissions' },
                  { code: '404 Not Found', desc: 'Resource not found' },
                  { code: '409 Conflict', desc: 'Duplicate resource (secret name, CDN publish)' },
                  { code: '422 Unprocessable Entity', desc: 'Encryption key missing/mismatch for encrypted download' },
                  { code: '503 Service Unavailable', desc: 'API disabled for maintenance (global guard)' },
                  { code: '500 Server Error', desc: 'Internal server error' },
                ].map(item => (
                  <div key={item.code} className="flex items-center justify-between h-7 px-2.5 rounded-lg hover:bg-accent/30 transition-colors">
                    <code className="text-[12px] text-muted-foreground/80">{item.code}</code>
                    <span className="text-[11px] text-muted-foreground/50">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/80 p-3 space-y-2">
              <div className="flex items-center gap-2.5 pb-1">
                <FileText className="w-4 h-4 text-muted-foreground/70" />
                <span className="text-[13px] font-medium">Downloadable API Docs</span>
              </div>
              <div className="space-y-2">
                <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
                  Complete API documentation in Markdown format. Two versions available:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="https://aouqcwbdoyrccjcrhzzi.supabase.co/storage/v1/object/public/apidoc/api-docs-for-ai-agents.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/40 bg-muted/20 hover:bg-accent/30 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-foreground/80">AI Agent Guide</div>
                      <div className="text-[10px] text-muted-foreground/50 truncate">Technical setup guide for AI agents</div>
                    </div>
                  </a>
                  <a
                    href="https://aouqcwbdoyrccjcrhzzi.supabase.co/storage/v1/object/public/apidoc/api-docs-for-humans.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/40 bg-muted/20 hover:bg-accent/30 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-foreground/80">User Guide</div>
                      <div className="text-[10px] text-muted-foreground/50 truncate">Simple English user-friendly guide</div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DeveloperAPI;
