import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Repeat, Book, Activity, Code, Copy, CheckCircle2,
  ExternalLink, Shield, Zap, Clock, AlertCircle, Terminal,
} from '@/lib/icon-map';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { WebhookManager } from '@/components/WebhookManager';
import { WebhookUsageChart } from '@/components/WebhookUsageChart';
import { WebhookEventLogs } from '@/components/WebhookEventLogs';

const WEBHOOK_BASE_URL = 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/webhook-dispatch';

const templateExamples = [
  {
    name: 'Slack Notification',
    description: 'Post file events to a Slack channel',
    language: 'json',
    code: JSON.stringify({
      url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK',
      events: ['file.uploaded', 'file.deleted', 'file.shared'],
      payload: {
        text: '📁 File {{event_name}}: {{file_name}} was {{action}}',
      },
    }, null, 2),
  },
  {
    name: 'Discord Bot',
    description: 'Send embed messages for pipeline events',
    language: 'json',
    code: JSON.stringify({
      url: 'https://discord.com/api/webhooks/YOUR/DISCORD/WEBHOOK',
      events: ['pipeline.completed', 'pipeline.failed'],
      payload: {
        embeds: [{
          title: 'Pipeline {{status}}',
          description: 'Pipeline {{pipeline_id}} {{status}} at {{timestamp}}',
          color: '{{#if success}}65280{{else}}16711680{{/if}}',
        }],
      },
    }, null, 2),
  },
  {
    name: 'GitHub Actions Trigger',
    description: 'Trigger a GitHub Actions workflow on file changes',
    language: 'json',
    code: JSON.stringify({
      url: 'https://api.github.com/repos/YOUR_ORG/YOUR_REPO/dispatches',
      headers: {
        'Authorization': 'Bearer YOUR_GITHUB_TOKEN',
        'Accept': 'application/vnd.github.v3+json',
      },
      events: ['file.uploaded', 'site.published'],
    }, null, 2),
  },
  {
    name: 'Custom API Endpoint',
    description: 'Forward events to your own backend',
    language: 'json',
    code: JSON.stringify({
      url: 'https://your-api.com/webhooks/squidcloud',
      events: ['*'],
      headers: {
        'X-API-Key': 'your-api-key',
      },
    }, null, 2),
  },
];

const signingCode = `// Verify SquidCloud webhook signature (Node.js)
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Express.js middleware example
app.post('/webhooks/squidcloud', (req, res) => {
  const signature = req.headers['x-squidcloud-signature'];
  const isValid = verifyWebhookSignature(
    JSON.stringify(req.body),
    signature,
    process.env.SQUIDCLOUD_WEBHOOK_SECRET
  );
  if (!isValid) return res.status(401).send('Invalid signature');
  res.status(200).send('OK');
});`;

const setupGuides = [
  {
    title: 'Creating Your First Webhook',
    steps: [
      'Navigate to the Webhooks tab below',
      'Click "Create Webhook" and enter your endpoint URL',
      'Select which events to subscribe to',
      'Copy the generated secret key — you\'ll need it to verify signatures',
      'Your webhook secret is shown once; store it securely',
    ],
  },
  {
    title: 'Verifying Signatures',
    steps: [
      'Every webhook request includes an X-SquidCloud-Signature header',
      'The signature is HMAC-SHA256 of the raw request body',
      'Use your secret key to verify the signature server-side',
      'Always use timing-safe comparison (crypto.timingSafeEqual)',
      'Reject requests with invalid signatures immediately',
    ],
  },
  {
    title: 'Retry Policy',
    steps: [
      'Failed deliveries are retried up to 3 times',
      'Retry interval: 5 seconds, 30 seconds, 5 minutes',
      'After all retries fail, the event is marked as "failed"',
      'Monitor failed events in the Webhook Usage dashboard',
      'Fix your endpoint and the next event will deliver automatically',
    ],
  },
];

const eventReference = [
  {
    group: 'File Events',
    events: [
      { id: 'file.uploaded', description: 'A file was uploaded to your account', payload: '{ file_id, file_name, file_size, folder_id, mime_type }' },
      { id: 'file.shared', description: 'A share link was created for a file', payload: '{ file_id, share_id, expires_at, access_level }' },
      { id: 'file.renamed', description: 'A file was renamed', payload: '{ file_id, old_name, new_name }' },
      { id: 'file.moved', description: 'A file was moved between folders', payload: '{ file_id, file_name, old_folder_id, new_folder_id }' },
      { id: 'file.ext', description: 'File extension metadata changed', payload: '{ file_id, file_name, old_ext, new_ext }' },
      { id: 'file.deleted', description: 'A file was soft-deleted', payload: '{ file_id, file_name, deleted_at }' },
    ],
  },
  {
    group: 'Website Events',
    events: [
      { id: 'site.published', description: 'A website was published', payload: '{ site_id, site_name, url, published_at }' },
      { id: 'site.unpublished', description: 'A website was unpublished', payload: '{ site_id, site_name, unpublished_at }' },
      { id: 'site.redeployed', description: 'A website was redeployed', payload: '{ site_id, site_name, deploy_id, deploy_url }' },
      { id: 'site.archived', description: 'A website was archived', payload: '{ site_id, site_name, archived_at, retention_days }' },
      { id: 'site.unarchived', description: 'A website was restored from archive', payload: '{ site_id, site_name, restored_at }' },
    ],
  },
  {
    group: 'Share Events',
    events: [
      { id: 'share_link.accessed', description: 'A share link was accessed by a recipient', payload: '{ share_id, file_id, ip_address, user_agent, accessed_at }' },
      { id: 'share_link.revoked', description: 'A share link was revoked', payload: '{ share_id, file_id, revoked_at }' },
    ],
  },
  {
    group: 'Pipeline Events',
    events: [
      { id: 'pipeline.completed', description: 'An action pipeline completed successfully', payload: '{ pipeline_id, pipeline_name, duration_ms, output }' },
      { id: 'pipeline.failed', description: 'An action pipeline failed', payload: '{ pipeline_id, pipeline_name, error_message, failed_step }' },
    ],
  },
  {
    group: 'API Events',
    events: [
      { id: 'api_tokens.quota_warning', description: 'API token usage exceeded 80% of daily limit', payload: '{ used, limit, remaining, reset_at }' },
    ],
  },
];

const WebhooksPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');

  const copyToClipboard = (text: string, label = 'Copied!') => {
    navigator.clipboard.writeText(text);
    toast({ title: label, description: 'Copied to clipboard' });
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4 text-white/60" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-white/90">Webhooks</h1>
            <p className="text-sm text-white/40">Event-driven notifications for your SquidCloud account</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {!isMobile && (
            <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl">
              <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-[#4FC3F7]/10 data-[state=active]:text-[#4FC3F7]">Overview</TabsTrigger>
              <TabsTrigger value="webhooks" className="rounded-lg data-[state=active]:bg-[#4FC3F7]/10 data-[state=active]:text-[#4FC3F7]">Webhooks</TabsTrigger>
              <TabsTrigger value="docs" className="rounded-lg data-[state=active]:bg-[#4FC3F7]/10 data-[state=active]:text-[#4FC3F7]">Docs</TabsTrigger>
              <TabsTrigger value="logs" className="rounded-lg data-[state=active]:bg-[#4FC3F7]/10 data-[state=active]:text-[#4FC3F7]">Event Logs</TabsTrigger>
              <TabsTrigger value="events" className="rounded-lg data-[state=active]:bg-[#4FC3F7]/10 data-[state=active]:text-[#4FC3F7]">Events Reference</TabsTrigger>
            </TabsList>
          )}

          {isMobile && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {['overview', 'webhooks', 'docs', 'logs', 'events'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    activeTab === tab ? 'bg-[#4FC3F7]/10 text-[#4FC3F7] border border-[#4FC3F7]/20' : 'bg-white/5 text-white/50 border border-white/10',
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          )}

          <TabsContent value="overview" className="space-y-6 mt-0">
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-5">
              <h2 className="text-base font-semibold text-white/80 mb-1">Usage & Analytics</h2>
              <p className="text-sm text-white/40 mb-4">Real-time webhook dispatch metrics from your account</p>
              <WebhookUsageChart />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
                <Terminal className="w-5 h-5 text-[#4FC3F7] mb-2" />
                <h3 className="text-sm font-semibold text-white/80 mb-1">Quick Start</h3>
                <p className="text-xs text-white/40">Create your first webhook in under 2 minutes. Subscribe to file events and get notified instantly.</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
                <Shield className="w-5 h-5 text-[#4FC3F7] mb-2" />
                <h3 className="text-sm font-semibold text-white/80 mb-1">Signed Payloads</h3>
                <p className="text-xs text-white/40">Every webhook includes HMAC-SHA256 signatures so you can verify the request came from SquidCloud.</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
                <Zap className="w-5 h-5 text-[#4FC3F7] mb-2" />
                <h3 className="text-sm font-semibold text-white/80 mb-1">Automatic Retries</h3>
                <p className="text-xs text-white/40">Failed deliveries are retried 3 times with exponential backoff. No manual intervention needed.</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="webhooks" className="mt-0">
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-5">
              <WebhookManager open={true} onClose={() => {}} standalone />
            </div>
          </TabsContent>

          <TabsContent value="docs" className="space-y-6 mt-0">
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-5">
              <h2 className="text-base font-semibold text-white/80 mb-1">How Webhooks Work</h2>
              <p className="text-sm text-white/40 mb-4">
                Webhooks are HTTP callbacks that SquidCloud sends to your endpoint when specific events occur.
                When an event matching your subscription fires, we send an HTTP POST request to your configured URL
                with a JSON payload describing the event.
              </p>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <code className="text-xs font-mono text-[#4FC3F7]">POST</code>
                  <code className="text-xs font-mono text-white/40">{'->'} your-endpoint.com/webhook</code>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px] border-white/10 text-white/40 bg-transparent">Content-Type: application/json</Badge>
                  <Badge variant="outline" className="text-[10px] border-white/10 text-white/40 bg-transparent">X-SquidCloud-Signature: HMAC-SHA256</Badge>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-5">
              <h2 className="text-base font-semibold text-white/80 mb-1">Setup Guides</h2>
              <p className="text-sm text-white/40 mb-4">Step-by-step tutorials for common use cases</p>
              <div className="space-y-4">
                {setupGuides.map(guide => (
                  <div key={guide.title} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white/70 mb-2">{guide.title}</h3>
                    <ol className="space-y-1.5">
                      {guide.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-white/50">
                          <span className="text-[10px] font-mono text-[#4FC3F7]/60 w-4 shrink-0 mt-0.5">{i + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-5">
              <h2 className="text-base font-semibold text-white/80 mb-3">Signature Verification</h2>
              <p className="text-sm text-white/40 mb-4">Always verify webhook signatures to ensure requests are from SquidCloud.</p>
              <div className="relative">
                <pre className="bg-[#0A0E1A] border border-white/[0.06] rounded-xl p-4 overflow-x-auto text-xs font-mono text-white/60 leading-relaxed">
                  {signingCode}
                </pre>
                <button
                  onClick={() => copyToClipboard(signingCode, 'Code copied!')}
                  className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-white/40" />
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-5">
              <h2 className="text-base font-semibold text-white/80 mb-1">Templates</h2>
              <p className="text-sm text-white/40 mb-4">Ready-to-use examples for popular integrations</p>
              <div className="space-y-4">
                {templateExamples.map(template => (
                  <div key={template.name} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                      <div>
                        <h3 className="text-sm font-semibold text-white/70">{template.name}</h3>
                        <p className="text-xs text-white/40">{template.description}</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(template.code, 'Template copied!')}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5 text-white/40" />
                      </button>
                    </div>
                    <pre className="p-4 overflow-x-auto text-xs font-mono text-white/50 leading-relaxed bg-[#0A0E1A]">{template.code}</pre>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="mt-0">
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-5">
              <h2 className="text-base font-semibold text-white/80 mb-1">Webhook Event Logs</h2>
              <p className="text-sm text-white/40 mb-4">View all webhook delivery attempts with status and timing</p>
              <WebhookEventLogs />
            </div>
          </TabsContent>

          <TabsContent value="events" className="mt-0">
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-5">
              <h2 className="text-base font-semibold text-white/80 mb-1">Event Reference</h2>
              <p className="text-sm text-white/40 mb-4">Complete list of available webhook events and their payloads</p>
              <div className="space-y-6">
                {eventReference.map(group => (
                  <div key={group.group}>
                    <h3 className="text-sm font-semibold text-white/60 mb-2">{group.group}</h3>
                    <div className="space-y-2">
                      {group.events.map(event => (
                        <div key={event.id} className="flex items-start gap-3 bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                          <Badge className="shrink-0 mt-0.5 text-[10px] font-mono bg-[#4FC3F7]/10 text-[#4FC3F7] border-[#4FC3F7]/20">{event.id}</Badge>
                          <div className="min-w-0">
                            <p className="text-xs text-white/60">{event.description}</p>
                            <code className="text-[10px] text-white/30 font-mono block mt-1">{event.payload}</code>
                          </div>
                        </div>
                      ))}
                    </div>
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

export default WebhooksPage;
