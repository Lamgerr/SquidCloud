import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Book, HardDrive, Cloud, Shield, Settings2, HelpCircle, ExternalLink, ChevronRight, Globe, Database, Server, Power, Eye, Pencil } from '@/lib/icon-map';
import { cn } from '@/lib/utils';

interface StorageProviderHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: Book },
  { id: 'supported', label: 'Supported Providers', icon: Cloud },
  { id: 'adding', label: 'Adding a Bucket', icon: HardDrive },
  { id: 'permissions', label: 'Read & Write Permissions', icon: Shield },
  { id: 'settings', label: 'Storage Settings', icon: Settings2 },
  { id: 'public', label: 'Public Sharing', icon: Globe },
  { id: 'limits', label: 'Limits & Pricing', icon: Database },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: HelpCircle },
];

export default function StorageProviderHelp({ isOpen, onClose }: StorageProviderHelpProps) {
  const [activeSection, setActiveSection] = useState('overview');

  const SectionNav = ({ id, label, icon: Icon }: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }) => (
    <button
      onClick={() => setActiveSection(id)}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left',
        activeSection === id
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
      {activeSection === id && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
    </button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="left-0 right-0 top-0 bottom-0 translate-x-0 translate-y-0 max-w-none w-screen h-[100dvh] max-h-[100dvh] rounded-none border-0 p-0 sm:left-[50%] sm:top-[50%] sm:bottom-auto sm:right-auto sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-[calc(100vw-1.5rem)] sm:h-auto sm:max-h-[92vh] sm:max-w-[900px] sm:rounded-[20px] sm:border [&>button]:right-3 [&>button]:top-3 sm:[&>button]:right-4 sm:[&>button]:top-4">
        <div className="flex h-full max-h-[100dvh] sm:max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-border/50 px-4 pb-3 pt-4 pr-12 sm:px-6 sm:pr-14">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Book className="h-5 w-5 text-primary" />
              Bring Your Own Storage (BYOS) — Guide
            </DialogTitle>
            <DialogDescription className="text-xs mt-0.5">
              Learn how to connect and manage your own cloud storage buckets
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden flex-col sm:flex-row">
            {/* Sidebar navigation */}
            <div className="w-full sm:w-52 shrink-0 border-b sm:border-b-0 sm:border-r border-border/50 p-3 sm:p-4 space-y-1">
              {SECTIONS.map(s => <SectionNav key={s.id} {...s} />)}
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
              <div className="max-w-2xl space-y-6 text-sm leading-relaxed">
                {activeSection === 'overview' && (
                  <>
                    <h2 className="text-lg font-semibold">What is BYOS?</h2>
                    <p>
                      Bring Your Own Storage (BYOS) lets you connect your own cloud storage buckets to the platform.
                      Instead of relying solely on the built-in storage, you can use buckets from providers like
                      AWS S3, Backblaze B2, Cloudflare R2, Google Cloud Storage, Wasabi, Tebi, or any
                      S3-compatible service.
                    </p>
                    <h3 className="text-base font-semibold mt-6">Why use BYOS?</h3>
                    <ul className="list-disc pl-5 space-y-1.5">
                      <li><strong>Full control</strong> — Your data stays in your own bucket under your own account.</li>
                      <li><strong>No egress fees</strong> — Download directly from your provider without additional charges.</li>
                      <li><strong>Scalability</strong> — Use buckets with virtually unlimited capacity.</li>
                      <li><strong>Multiple buckets</strong> — Connect up to 20 different buckets and distribute uploads across them.</li>
                      <li><strong>Granular permissions</strong> — Control read and write access per bucket independently.</li>
                    </ul>
                    <h3 className="text-base font-semibold mt-6">How it works</h3>
                    <p>
                      When you add a storage bucket, you provide access credentials (Access Key and Secret Key).
                      These are encrypted and stored securely. Uploads and downloads are routed through a secure
                      gateway that generates time-limited presigned URLs, so your credentials are never exposed
                      to clients.
                    </p>
                    <p>
                      Files stored on your buckets are tracked in the system so they can be retrieved later.
                      You can switch between providers at any time, and existing files remain accessible as long
                      as the source bucket is available with read access enabled.
                    </p>
                  </>
                )}

                {activeSection === 'supported' && (
                  <>
                    <h2 className="text-lg font-semibold">Supported Storage Providers</h2>
                    <p>
                      Any S3-compatible object storage service can be connected. Below are the officially
                      supported and tested providers.
                    </p>

                    <div className="space-y-4 mt-4">
                      <div className="rounded-xl border border-border/50 p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500"><Server className="h-4 w-4" /></div>
                          <div><h3 className="font-medium text-sm">AWS S3</h3><p className="text-xs text-muted-foreground">Amazon Web Services</p></div>
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                          <li>Region: Any AWS region</li>
                          <li>Credentials: IAM Access Key + Secret Key with s3:PutObject, s3:GetObject, s3:ListBucket, s3:DeleteObject</li>
                          <li>Endpoint: Auto-detected from region</li>
                        </ul>
                      </div>

                      <div className="rounded-xl border border-border/50 p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500"><HardDrive className="h-4 w-4" /></div>
                          <div><h3 className="font-medium text-sm">Backblaze B2</h3><p className="text-xs text-muted-foreground">Backblaze</p></div>
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                          <li>Region: us-west-001, us-east-001, eu-central-001</li>
                          <li>Credentials: Application Key ID + Application Key with read/write access</li>
                          <li>Endpoint: s3.us-west-001.backblazeb2.com (auto-detected)</li>
                        </ul>
                      </div>

                      <div className="rounded-xl border border-border/50 p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500"><Cloud className="h-4 w-4" /></div>
                          <div><h3 className="font-medium text-sm">Cloudflare R2</h3><p className="text-xs text-muted-foreground">Cloudflare</p></div>
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                          <li>Region: auto</li>
                          <li>Credentials: Access Key ID + Secret Access Key</li>
                          <li>Account ID: Required (found in R2 dashboard)</li>
                        </ul>
                      </div>

                      <div className="rounded-xl border border-border/50 p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500"><Database className="h-4 w-4" /></div>
                          <div><h3 className="font-medium text-sm">Google Cloud Storage</h3><p className="text-xs text-muted-foreground">Google Cloud Platform</p></div>
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                          <li>Region: Any GCP multi-region or region</li>
                          <li>Credentials: HMAC Access Key + Secret (created via GCP Console)</li>
                        </ul>
                      </div>

                      <div className="rounded-xl border border-border/50 p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"><Database className="h-4 w-4" /></div>
                          <div><h3 className="font-medium text-sm">Tebi</h3><p className="text-xs text-muted-foreground">Tebi.io</p></div>
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                          <li>Region: eureti (Europe), uschic (US)</li>
                          <li>Credentials: Access Key + Secret Key</li>
                          <li>Endpoint: https://s3.tebi.io</li>
                        </ul>
                      </div>

                      <div className="rounded-xl border border-border/50 p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-500"><Server className="h-4 w-4" /></div>
                          <div><h3 className="font-medium text-sm">Wasabi</h3><p className="text-xs text-muted-foreground">Wasabi Technologies</p></div>
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                          <li>Region: us-east-1, us-east-2, us-west-1, eu-central-1, eu-west-1, ap-northeast-1</li>
                          <li>Credentials: Access Key + Secret Key</li>
                          <li>Endpoint: s3.[region].wasabisys.com</li>
                        </ul>
                      </div>

                      <div className="rounded-xl border border-dashed border-border/50 p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500"><HardDrive className="h-4 w-4" /></div>
                          <div><h3 className="font-medium text-sm">Any S3-Compatible</h3><p className="text-xs text-muted-foreground">Custom endpoint</p></div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Any service that implements the S3 API can be connected using the custom endpoint option.
                          Provide the full endpoint URL and your access credentials.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {activeSection === 'adding' && (
                  <>
                    <h2 className="text-lg font-semibold">Adding a Storage Bucket</h2>
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-base font-semibold">Step-by-step</h3>
                        <ol className="list-decimal pl-5 mt-2 space-y-2">
                          <li>
                            <strong>Open Storage Providers</strong> — Click the storage icon in the sidebar or
                            navigate to your Dashboard storage settings.
                          </li>
                          <li>
                            <strong>Click "Add Storage Bucket"</strong> — The button at the bottom of the
                            provider list opens the provider selection dialog.
                          </li>
                          <li>
                            <strong>Choose a provider</strong> — Select from the supported providers or choose
                            "Custom S3 Compatible" for other services.
                          </li>
                          <li>
                            <strong>Enter credentials</strong> — Fill in the required fields:
                            <ul className="list-disc pl-5 mt-1 space-y-1 text-muted-foreground">
                              <li>Access Key ID — Your storage provider's access key</li>
                              <li>Secret Access Key — The corresponding secret key</li>
                              <li>Bucket Name — The name of the bucket to connect</li>
                              <li>Region — The bucket's region (auto-filled for some providers)</li>
                              <li>Endpoint — Custom endpoint URL (for S3-compatible providers)</li>
                              <li>Label — A friendly name to identify this bucket</li>
                            </ul>
                          </li>
                          <li>
                            <strong>Verify</strong> — The system will test the connection to ensure the
                            credentials are valid and the bucket is accessible.
                          </li>
                          <li>
                            <strong>Done</strong> — Your bucket appears in the provider list and is ready to use.
                          </li>
                        </ol>
                      </div>

                      <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4">
                        <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                          <Shield className="h-4 w-4" /> Security Note
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Credentials are encrypted at rest using the platform's encryption layer. They are
                          never exposed to the client side. Only time-limited presigned URLs are generated for
                          actual file transfers.
                        </p>
                      </div>

                      <div>
                        <h3 className="text-base font-semibold">Required Bucket Permissions</h3>
                        <p>Your credentials need the following permissions on the bucket:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                          <li><strong>s3:PutObject</strong> — Upload files</li>
                          <li><strong>s3:GetObject</strong> — Download files</li>
                          <li><strong>s3:ListBucket</strong> — Check usage and list objects</li>
                          <li><strong>s3:DeleteObject</strong> — Delete files</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}

                {activeSection === 'permissions' && (
                  <>
                    <h2 className="text-lg font-semibold">Read & Write Permissions</h2>
                    <p>
                      Each bucket has independent read and write permission toggles, giving you fine-grained
                      control over how your storage is used.
                    </p>

                    <div className="space-y-4 mt-4">
                      <div className="rounded-xl border border-border/50 p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-500"><Eye className="h-4 w-4" /></div>
                          <div><h3 className="font-medium text-sm">Read Access</h3></div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Controls whether files stored on this bucket can be downloaded or viewed.
                          When read access is disabled, existing files and shares linked to this bucket
                          will stop being accessible. Re-enabling read access restores access immediately.
                        </p>
                      </div>

                      <div className="rounded-xl border border-border/50 p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500"><Pencil className="h-4 w-4" /></div>
                          <div><h3 className="font-medium text-sm">Write Access</h3></div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Controls whether new files can be uploaded to this bucket.
                          When write access is disabled, the bucket stops accepting new uploads.
                          Existing files remain readable and deletable (unless read access is also disabled).
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 mt-4">
                      <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <Power className="h-4 w-4" /> Toggle Behavior
                      </h4>
                      <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc pl-4">
                        <li>Toggling permission off shows a confirmation warning explaining the impact.</li>
                        <li>Permissions are independent — you can have read-only or write-only buckets.</li>
                        <li>Disabling the entire bucket (using the power toggle) overrides both permissions to off.</li>
                        <li>Bucket permissions apply to all files, regardless of which user uploaded them.</li>
                      </ul>
                    </div>
                  </>
                )}

                {activeSection === 'settings' && (
                  <>
                    <h2 className="text-lg font-semibold">Storage Settings</h2>
                    <p>
                      The Storage Settings panel lets you configure how your buckets are used. Access it
                      from the Settings button in the Storage Providers dialog.
                    </p>

                    <div className="space-y-4 mt-4">
                      <div className="rounded-xl border border-border/50 p-4">
                        <h3 className="font-medium text-sm">Fallback Behavior</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Controls what happens when no custom provider is actively selected for an upload:
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-muted-foreground">
                          <li><strong>SquidCloud only</strong> — Always use built-in storage</li>
                          <li><strong>My buckets only</strong> — Only use your connected buckets</li>
                          <li><strong>SquidCloud first, fallback to mine</strong> — Default to SquidCloud, use buckets if needed</li>
                          <li><strong>My buckets first, fallback to SquidCloud</strong> — Use your buckets when available</li>
                        </ul>
                      </div>

                      <div className="rounded-xl border border-border/50 p-4">
                        <h3 className="font-medium text-sm">Upload Distribution</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          When multiple custom buckets are connected, this setting determines how uploads are distributed:
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-muted-foreground">
                          <li><strong>Round-robin</strong> — Distribute evenly across all active buckets</li>
                          <li><strong>Least used first</strong> — Fill the bucket with the most free space</li>
                          <li><strong>Primary bucket only</strong> — Always use the currently selected active bucket</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}

                {activeSection === 'public' && (
                  <>
                    <h2 className="text-lg font-semibold">Public Sharing</h2>
                    <p>
                      Buckets can be marked as public, allowing the platform to use them as donation storage
                      for the network. This is entirely optional.
                    </p>
                    <div className="space-y-3 mt-4">
                      <div className="rounded-xl border border-border/50 p-4">
                        <h3 className="font-medium text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /> How it works</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          When you mark a bucket as public, it becomes available for the network to use as
                          additional storage capacity. Other users will be able to upload files to your bucket,
                          but only within the scope of the platform's anonymous upload system. You maintain
                          full ownership and can disable public sharing at any time.
                        </p>
                      </div>
                      <div className="rounded-xl bg-muted/30 p-4">
                        <h3 className="text-sm font-medium">Managing public sharing</h3>
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-muted-foreground">
                          <li>Toggle the "Public" badge per bucket in the provider list</li>
                          <li>Enable the "Allow Public Sharing" option in Storage Settings to opt into the network</li>
                          <li>Disable at any time — existing files remain but the bucket stops accepting new public uploads</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}

                {activeSection === 'limits' && (
                  <>
                    <h2 className="text-lg font-semibold">Limits & Pricing</h2>
                    <div className="space-y-3">
                      <div className="rounded-xl border border-border/50 p-4">
                        <h3 className="font-medium text-sm">Bucket Limits</h3>
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-muted-foreground">
                          <li>Maximum of <strong>20 buckets</strong> per account</li>
                          <li>No per-bucket file size limit (enforced by your provider's limits)</li>
                          <li>No per-bucket file count limit (enforced by your provider's limits)</li>
                          <li>Optional per-bucket storage limit that you can set when adding a bucket</li>
                        </ul>
                      </div>
                      <div className="rounded-xl border border-border/50 p-4">
                        <h3 className="font-medium text-sm">Pricing</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Connecting your own storage buckets is <strong>free</strong>. There are no platform
                          charges for using BYOS. You only pay your storage provider directly for the storage
                          and bandwidth you use. The built-in SquidCloud storage may have separate limits
                          depending on your plan.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {activeSection === 'troubleshooting' && (
                  <>
                    <h2 className="text-lg font-semibold">Troubleshooting</h2>
                    <div className="space-y-4">
                      <div className="rounded-xl border border-border/50 p-4">
                        <h3 className="font-medium text-sm">"Bucket not accessible"</h3>
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-muted-foreground">
                          <li>Verify your Access Key and Secret Key are correct</li>
                          <li>Ensure the bucket name is spelled exactly as created in your provider's dashboard</li>
                          <li>Check that your bucket is in the region you specified</li>
                          <li>Make sure your credentials have the required permissions (s3:ListBucket, s3:GetObject, s3:PutObject, s3:DeleteObject)</li>
                          <li>For Backblaze B2, ensure you're using an Application Key (not master credentials)</li>
                        </ul>
                      </div>
                      <div className="rounded-xl border border-border/50 p-4">
                        <h3 className="font-medium text-sm">"Provider not found"</h3>
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-muted-foreground">
                          <li>This usually means the provider was removed or the session expired</li>
                          <li>Try refreshing the page and re-opening the Storage Providers dialog</li>
                          <li>If the issue persists, remove and re-add the bucket</li>
                        </ul>
                      </div>
                      <div className="rounded-xl border border-border/50 p-4">
                        <h3 className="font-medium text-sm">"Read access is disabled" or "Write access is disabled"</h3>
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-muted-foreground">
                          <li>Open the Storage Providers dialog</li>
                          <li>Find the bucket showing the error</li>
                          <li>Click on "Read: OFF" or "Write: OFF" to toggle the permission back on</li>
                          <li>Confirm the change in the warning dialog</li>
                        </ul>
                      </div>
                      <div className="rounded-xl border border-border/50 p-4">
                        <h3 className="font-medium text-sm">Uploads fail silently</h3>
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-muted-foreground">
                          <li>Check that write access is enabled for the target bucket</li>
                          <li>Verify the bucket has sufficient space (if you set a storage limit)</li>
                          <li>Check your provider's dashboard for any service outages</li>
                          <li>Try toggling the bucket off and on again</li>
                        </ul>
                      </div>
                      <div className="rounded-xl border border-border/50 p-4">
                        <h3 className="font-medium text-sm">Downloads fail</h3>
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-muted-foreground">
                          <li>Check that read access is enabled for the bucket containing the file</li>
                          <li>Verify the file still exists in your provider's bucket</li>
                          <li>If the bucket was removed, the file is permanently inaccessible</li>
                          <li>Contact support if you believe this is an error</li>
                        </ul>
                      </div>
                      <div className="rounded-xl bg-muted/30 p-4">
                        <h3 className="text-sm font-medium">Still having issues?</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          If you've tried the above steps and are still experiencing issues, please contact
                          support with details about your provider type, bucket name, and the exact error
                          message you're seeing.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}