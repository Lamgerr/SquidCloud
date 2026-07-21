import React, { memo, useCallback, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Cloud, Key, HardDrive, Hash, CheckCircle2, ShieldCheck, AlertCircle, ExternalLink, ArrowLeft, Globe, Server, Database, Wifi, Box } from '@/lib/icon-map';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { StorageProviderRecord } from './StorageProviderManager';

interface ProviderDefinition {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  fields: Array<{
    key: string;
    label: string;
    type: string;
    placeholder: string;
    required: boolean;
  }>;
  endpoint?: string;
  docsUrl?: string;
}

const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: 's3',
    label: 'AWS S3',
    description: 'Amazon Simple Storage Service',
    icon: <Server className="h-6 w-6" />,
    fields: [
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', placeholder: 'AKIA...', required: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', placeholder: 'Enter secret key', required: true },
      { key: 'bucketName', label: 'Bucket Name', type: 'text', placeholder: 'my-bucket', required: true },
      { key: 'bucketRegion', label: 'Region', type: 'text', placeholder: 'us-east-1', required: true },
    ],
    docsUrl: 'https://docs.aws.amazon.com/...',
  },
  {
    id: 'backblaze',
    label: 'Backblaze B2',
    description: 'Backblaze B2 Cloud Storage',
    icon: <HardDrive className="h-6 w-6" />,
    fields: [
      { key: 'accessKeyId', label: 'Key ID', type: 'text', placeholder: 'Enter Key ID', required: true },
      { key: 'secretAccessKey', label: 'Application Key', type: 'password', placeholder: 'Enter Application Key', required: true },
      { key: 'bucketName', label: 'Bucket Name', type: 'text', placeholder: 'my-bucket', required: true },
      { key: 'bucketRegion', label: 'Region', type: 'text', placeholder: 'us-east-0', required: true },
      { key: 'bucketEndpoint', label: 'Endpoint', type: 'text', placeholder: 'https://s3.us-east-0.backblazeb2.com', required: false },
    ],
    docsUrl: 'https://www.backblaze.com/docs/...',
  },
  {
    id: 'r2',
    label: 'Cloudflare R2',
    description: 'Cloudflare R2 Object Storage',
    icon: <Cloud className="h-6 w-6" />,
    fields: [
      { key: 'accountId', label: 'Account ID', type: 'text', placeholder: '1a2b3c4d5e6f7g8h...', required: true },
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', placeholder: 'Enter Access Key', required: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', placeholder: 'Enter Secret Key', required: true },
      { key: 'bucketName', label: 'Bucket Name', type: 'text', placeholder: 'my-bucket', required: true },
      { key: 'bucketEndpoint', label: 'Endpoint (optional)', type: 'text', placeholder: 'https://<account>.r2.cloudflarestorage.com', required: false },
    ],
    docsUrl: 'https://developers.cloudflare.com/r2/',
  },
  {
    id: 'tebi',
    label: 'Tebi.io',
    description: 'S3-compatible storage by Tebi',
    icon: <Database className="h-6 w-6" />,
    fields: [
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', placeholder: 'Enter Access Key', required: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', placeholder: 'Enter Secret Key', required: true },
      { key: 'bucketName', label: 'Bucket Name', type: 'text', placeholder: 'my-bucket', required: true },
    ],
    endpoint: 'https://s3.tebi.io',
    docsUrl: 'https://docs.tebi.io/',
  },
  {
    id: 'wasabi',
    label: 'Wasabi',
    description: 'Wasabi Hot Cloud Storage',
    icon: <Globe className="h-6 w-6" />,
    fields: [
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', placeholder: 'Enter Access Key', required: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', placeholder: 'Enter Secret Key', required: true },
      { key: 'bucketName', label: 'Bucket Name', type: 'text', placeholder: 'my-bucket', required: true },
      { key: 'bucketRegion', label: 'Region', type: 'text', placeholder: 'us-east-2', required: true },
    ],
    docsUrl: 'https://wasabi.com/...',
  },
  {
    id: 'gcp',
    label: 'Google Cloud Storage',
    description: 'Google Cloud Storage',
    icon: <Wifi className="h-6 w-6" />,
    fields: [
      { key: 'accessKeyId', label: 'HMAC Access Key', type: 'text', placeholder: 'GOOG...', required: true },
      { key: 'secretAccessKey', label: 'HMAC Secret', type: 'password', placeholder: 'Enter secret', required: true },
      { key: 'bucketName', label: 'Bucket Name', type: 'text', placeholder: 'my-bucket', required: true },
      { key: 'bucketEndpoint', label: 'Endpoint', type: 'text', placeholder: 'https://storage.googleapis.com', required: false },
    ],
    docsUrl: 'https://cloud.google.com/storage/...',
  },
  {
    id: 'custom',
    label: 'S3 Compatible',
    description: 'Any S3-compatible storage provider',
    icon: <Box className="h-6 w-6" />,
    fields: [
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', placeholder: 'Enter Access Key', required: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', placeholder: 'Enter Secret Key', required: true },
      { key: 'bucketName', label: 'Bucket Name', type: 'text', placeholder: 'bucket-name', required: true },
      { key: 'bucketEndpoint', label: 'Endpoint URL', type: 'text', placeholder: 'https://s3.example.com', required: true },
      { key: 'bucketRegion', label: 'Region', type: 'text', placeholder: 'us-east-1', required: false },
    ],
  },
];

interface StorageProviderAddDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (provider: StorageProviderRecord) => void;
}

export default function StorageProviderAddDialog({ isOpen, onClose, onSuccess }: StorageProviderAddDialogProps) {
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [selectedProvider, setSelectedProvider] = useState<ProviderDefinition | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [label, setLabel] = useState('');

  const reset = useCallback(() => {
    setStep('select');
    setSelectedProvider(null);
    setFormData({});
    setLabel('');
    setIsVerifying(false);
  }, []);

  const handleClose = useCallback(() => {
    if (!isVerifying) {
      reset();
      onClose();
    }
  }, [isVerifying, reset, onClose]);

  const handleSelect = useCallback((def: ProviderDefinition) => {
    setSelectedProvider(def);
    setLabel(`${def.label} - ${def.fields.find(f => f.key === 'bucketName')?.placeholder || 'new'}`);
    setStep('configure');
  }, []);

  const updateField = useCallback((key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleVerifyAndSave = async () => {
    if (!selectedProvider) return;

    try {
      setIsVerifying(true);

      // Verify credentials
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-provider', {
        body: {
          providerType: selectedProvider.id,
          ...formData,
          endpoint: formData.bucketEndpoint || undefined,
          region: formData.bucketRegion || undefined,
        },
      });

      if (verifyError || !verifyData?.success) {
        throw new Error(verifyError?.message || verifyData?.error || 'Verification failed');
      }

      toast.success('Connection verified successfully!');

      // Store provider
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const { data: storedData, error: storeError } = await supabase.functions.invoke('store-provider', {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          providerType: selectedProvider.id,
          label: label.trim() || `${selectedProvider.label} - ${formData.bucketName}`,
          ...formData,
        },
      });

      if (storeError || !storedData?.success) {
        throw new Error(storeError?.message || storedData?.error || 'Failed to save');
      }

      const saved = storedData.provider;

      // Attempt to configure CORS for browser uploads (best-effort)
      try {
        const { data: corsResult, error: corsError } = await supabase.functions.invoke('s3-storage', {
          body: { action: 'fix-cors', providerId: saved.id },
        });
        if (corsError || !corsResult?.corsConfigured) {
          toast.warning('Connected but CORS auto-setup failed. Manual CORS config may be needed for browser uploads.');
        }
      } catch {
        toast.warning('Connected but CORS auto-setup failed. Manual CORS config may be needed for browser uploads.');
      }

      toast.success(`${selectedProvider.label} connected!`);
      onSuccess({
        id: saved.id,
        provider_type: saved.provider_type,
        label: saved.label || null,
        bucket_name: formData.bucketName || null,
        is_enabled: true,
        is_public: false,
        is_default: false,
        storage_used_bytes: 0,
        storage_limit_bytes: null,
        health_status: 'healthy',
        last_health_check: new Date().toISOString(),
        last_error: null,
        bucket_region: formData.bucketRegion || null,
        created_at: new Date().toISOString(),
      });

      reset();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const allFieldsFilled = useMemo(() => {
    if (!selectedProvider) return false;
    return selectedProvider.fields
      .filter(f => f.required)
      .every(f => formData[f.key]?.trim());
  }, [selectedProvider, formData]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="left-0 right-0 top-0 bottom-0 translate-x-0 translate-y-0 max-w-none w-screen h-[100dvh] max-h-[100dvh] rounded-none border-0 p-0 sm:left-[50%] sm:top-[50%] sm:bottom-auto sm:right-auto sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-[calc(100vw-1.5rem)] sm:h-auto sm:max-h-[92vh] sm:max-w-[600px] sm:rounded-[20px] sm:border [&>button]:right-3 [&>button]:top-3 sm:[&>button]:right-4 sm:[&>button]:top-4">
        <div className="flex h-full max-h-[100dvh] sm:max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-border/50 px-4 pb-3 pt-4 pr-12 sm:px-6 sm:pr-14">
            <DialogTitle className="flex items-center gap-2 text-base">
              {step === 'select' ? (
                <><HardDrive className="h-5 w-5 text-primary" /> Add Storage Bucket</>
              ) : (
                <><Button variant="ghost" size="sm" className="h-7 w-7 p-0 -ml-1.5" onClick={() => setStep('select')}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  Configure {selectedProvider?.label}
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs mt-0.5">
              {step === 'select'
                ? 'Choose a provider to connect your bucket'
                : `Enter your ${selectedProvider?.label} credentials`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {step === 'select' ? (
              <div className="grid gap-2">
                {PROVIDER_DEFINITIONS.map(def => (
                  <button
                    key={def.id}
                    onClick={() => handleSelect(def)}
                    className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3 pr-4 text-left hover:border-primary/30 hover:bg-accent/30 transition-all"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 shrink-0">
                      <span className="text-foreground">{def.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{def.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{def.description}</p>
                    </div>
                    <div className="ml-auto shrink-0">
                      <span className="text-xs text-muted-foreground">Add →</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Label */}
                <div className="grid gap-2">
                  <Label htmlFor="label" className="text-xs">Display Label</Label>
                  <Input
                    id="label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. My B2 Backup"
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </div>

                {/* Credential fields */}
                {selectedProvider?.fields.map(field => (
                  <div className="grid gap-2" key={field.key}>
                    <Label htmlFor={field.key} className="flex items-center gap-2 text-xs">
                      {field.key === 'accessKeyId' || field.key === 'secretAccessKey' ? (
                        <Key className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : field.key === 'bucketName' ? (
                        <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : field.key === 'accountId' ? (
                        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : field.key === 'bucketEndpoint' ? (
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      id={field.key}
                      type={field.type}
                      value={formData[field.key] || ''}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete={field.type === 'password' ? 'new-password' : 'off'}
                    />
                  </div>
                ))}

                {selectedProvider?.docsUrl && (
                  <a href={selectedProvider.docsUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                    <ExternalLink className="h-3 w-3" /> Setup guide
                  </a>
                )}

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>Use dedicated keys only for this bucket. Rotate them periodically. Keep secret keys private.</p>
                </div>
              </div>
            )}
          </div>

          {step === 'configure' && (
            <DialogFooter className="flex-col-reverse gap-2 border-t border-border/50 bg-background/95 px-4 py-4 sm:flex-row sm:gap-0 sm:px-6">
              <Button variant="outline" onClick={handleClose} disabled={isVerifying}>Cancel</Button>
              <Button onClick={handleVerifyAndSave} disabled={!allFieldsFilled || isVerifying}>
                {isVerifying ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                ) : (
                  <><CheckCircle2 className="mr-2 h-4 w-4" /> Verify & Connect</>
                )}
              </Button>
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
