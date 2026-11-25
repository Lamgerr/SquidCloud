import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { GlassNav, type GlassNavItem } from '@/components/layout/GlassNav';
import { PageFrame } from '@/components/layout/PageFrame';
import {
  ArrowLeft, Repeat, Book, Activity, Code, Copy, Shield, Zap, Terminal,
} from '@/lib/icon-map';
import { useToast } from '@/hooks/use-toast';
import { WebhookManager } from '@/components/WebhookManager';
import { WebhookUsageChart } from '@/components/WebhookUsageChart';
import { WebhookEventLogs } from '@/components/WebhookEventLogs';

const WEBHOOK_BASE_URL = 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/webhook-dispatch';

const WB_CSS = `
.wb-tabs [role="tabpanel"]{margin-top:0!important}
.wb-back{display:flex;justify-content:center;margin-bottom:16px}
.wb-back button{display:grid;place-items:center;width:32px;height:32px;
  border:1px solid var(--sa-line,#1f2221);border-radius:8px;
  background:var(--sa-bg-2,#0e1110);color:var(--sa-text,#e8e7e1);cursor:pointer}
.wb-back button:hover{background:var(--sa-bg-3,#141816)}
.wb-back svg{width:15px;height:15px}
.wb-panel{padding:20px;border:1px solid var(--sa-line,#1f2221);border-radius:16px}
.wb-h2{margin:0 0 4px;font-size:15px;font-weight:400;color:var(--sa-text,#e8e7e1)}
.wb-p{margin:0 0 16px;font-size:12px;line-height:1.6;color:var(--sa-mute,#8d8f89)}
.wb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media(max-width:720px){.wb-grid{grid-template-columns:1fr}}
.wb-feature{padding:16px;border:1px solid var(--sa-line,#1f2221);border-radius:12px}
.wb-feature>svg{width:18px;height:18px;color:var(--sa-text,#e8e7e1);margin-bottom:8px}
.wb-h3{margin:0 0 4px;font-size:13px;font-weight:400;color:var(--sa-text,#e8e7e1)}
.wb-note{margin:0;font-size:11px;line-height:1.6;color:var(--sa-mute,#8d8f89)}
.wb-subpanel{padding:16px;border:1px solid var(--sa-line,#1f2221);border-radius:12px;margin-bottom:20px}
.wb-inline{font:400 11px/1.4 var(--sa-mono,monospace);color:var(--sa-text,#e8e7e1)}
.wb-inline-dim{font:400 11px/1.4 var(--sa-mono,monospace);color:var(--sa-mute,#8d8f89)}
.wb-chip,.wb-event-badge{border:1px solid var(--sa-line,#1f2221)!important;
  background:var(--sa-bg-2,#0e1110)!important;color:var(--sa-mute,#8d8f89)!important;
  font:400 10px/1.4 var(--sa-mono,monospace)!important;border-radius:6px!important;padding:2px 6px!important}
.wb-ol{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.wb-li{display:flex;gap:8px;font-size:12px;line-height:1.6;color:var(--sa-mute,#8d8f89)}
.wb-num{font:400 10px/1.6 var(--sa-mono,monospace);color:var(--sa-dim,#62655f);width:14px;flex:none}
.wb-code{position:relative}
.wb-pre{margin:0;padding:16px;border:1px solid var(--sa-line,#1f2221);border-radius:12px;
  background:var(--sa-bg,#090b0a);overflow-x:auto;
  font:400 11px/1.7 var(--sa-mono,monospace);color:var(--sa-mute,#8d8f89)}
.wb-copy{position:absolute;top:12px;right:12px;display:grid;place-items:center;
  width:28px;height:28px;border:1px solid var(--sa-line,#1f2221);border-radius:8px;
  background:var(--sa-bg-2,#0e1110);color:var(--sa-mute,#8d8f89);cursor:pointer}
.wb-copy:hover{color:var(--sa-text,#e8e7e1);background:var(--sa-bg-3,#141816)}
.wb-copy svg{width:14px;height:14px}
.wb-stack{display:grid;gap:12px;margin-bottom:20px}
.wb-tpl{border:1px solid var(--sa-line,#1f2221);border-radius:12px;overflow:hidden}
.wb-tpl-head{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:12px 16px;border-bottom:1px solid var(--sa-line,#1f2221)}
.wb-tpl-pre{margin:0;padding:16px;overflow-x:auto;background:var(--sa-bg,#090b0a);
  font:400 11px/1.7 var(--sa-mono,monospace);color:var(--sa-mute,#8d8f89)}
.wb-group{margin-bottom:24px}
.wb-group:last-child{margin-bottom:0}
.wb-group h3{margin:0 0 8px;font-size:13px;font-weight:400;color:var(--sa-mute,#8d8f89)}
.wb-events{display:grid;gap:8px}
.wb-event-row{display:flex;align-items:flex-start;gap:12px;padding:12px;
  border:1px solid var(--sa-line,#1f2221);border-radius:10px}
.wb-event-desc{margin:0;font-size:11px;color:var(--sa-mute,#8d8f89)}
.wb-event-payload{display:block;margin-top:4px;
  font:400 10px/1.5 var(--sa-mono,monospace);color:var(--sa-dim,#62655f)}
`;

const templateExamples = [
  {
    name: 'Slack Notification',
    description: 'Post file events to a Slack channel',
    language: 'json',
    code: JSON.stringify({
      url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK',
      events: ['file.uploaded', 'file.deleted', 'file.shared'],
      payload: {
        text: ' File {{event_name}}: {{file_name}} was {{action}}',
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

const NAV: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: 'overview', label: 'Overview', icon: <Activity /> },
  { value: 'webhooks', label: 'Webhooks', icon: <Repeat /> },
  { value: 'docs', label: 'Docs', icon: <Book /> },
  { value: 'logs', label: 'Event Logs', icon: <Terminal /> },
  { value: 'events', label: 'Events Reference', icon: <Code /> },
];

const WebhooksPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');

  const copyToClipboard = (text: string, label = 'Copied!') => {
    navigator.clipboard.writeText(text);
    toast({ title: label, description: 'Copied to clipboard' });
  };

  const navItems: GlassNavItem[] = NAV.map((n) => ({
    key: n.value,
    label: n.label,
    icon: n.icon,
    active: activeTab === n.value,
    onClick: () => setActiveTab(n.value),
  }));

  return (
    <PageFrame
      title="Webhooks"
      subtitle="Event-driven notifications for your SquidCloud account"
      items={navItems}
      layoutId="webhooks-tabs"
      wide
    >
      <style>{WB_CSS}</style>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="wb-tabs">
        <div className="wb-back">
          <button onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft />
          </button>
        </div>

        <TabsContent value="overview">
          <div className="wb-panel">
            <h2 className="wb-h2">Usage &amp; Analytics</h2>
            <p className="wb-p">Real-time webhook dispatch metrics from your account</p>
            <WebhookUsageChart />
          </div>

          <div className="wb-grid" style={{ marginTop: 12 }}>
            <div className="wb-feature">
              <Terminal />
              <h3 className="wb-h3">Quick Start</h3>
              <p className="wb-note">Create your first webhook in under 2 minutes. Subscribe to file events and get notified instantly.</p>
            </div>
            <div className="wb-feature">
              <Shield />
              <h3 className="wb-h3">Signed Payloads</h3>
              <p className="wb-note">Every webhook includes HMAC-SHA256 signatures so you can verify the request came from SquidCloud.</p>
            </div>
            <div className="wb-feature">
              <Zap />
              <h3 className="wb-h3">Automatic Retries</h3>
              <p className="wb-note">Failed deliveries are retried 3 times with exponential backoff. No manual intervention needed.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="webhooks">
          <div className="wb-panel">
            <WebhookManager open={true} onClose={() => {}} standalone />
          </div>
        </TabsContent>

        <TabsContent value="docs">
          <div className="wb-panel" style={{ marginBottom: 12 }}>
            <h2 className="wb-h2">How Webhooks Work</h2>
            <p className="wb-p">
              Webhooks are HTTP callbacks that SquidCloud sends to your endpoint when specific events occur.
              When an event matching your subscription fires, we send an HTTP POST request to your configured URL
              with a JSON payload describing the event.
            </p>

            <div className="wb-subpanel">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <code className="wb-inline">POST</code>
                <code className="wb-inline-dim">{'->'} your-endpoint.com/webhook</code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Badge variant="outline" className="wb-chip">Content-Type: application/json</Badge>
                <Badge variant="outline" className="wb-chip">X-SquidCloud-Signature: HMAC-SHA256</Badge>
              </div>
            </div>
          </div>

          <div className="wb-panel" style={{ marginBottom: 12 }}>
            <h2 className="wb-h2">Setup Guides</h2>
            <p className="wb-p">Step-by-step tutorials for common use cases</p>
            <div className="wb-stack" style={{ marginBottom: 0 }}>
              {setupGuides.map(guide => (
                <div key={guide.title} className="wb-subpanel" style={{ marginBottom: 0 }}>
                  <h3 className="wb-h3">{guide.title}</h3>
                  <ol className="wb-ol">
                    {guide.steps.map((step, i) => (
                      <li key={i} className="wb-li">
                        <span className="wb-num">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>

          <div className="wb-panel" style={{ marginBottom: 12 }}>
            <h2 className="wb-h2">Signature Verification</h2>
            <p className="wb-p">Always verify webhook signatures to ensure requests are from SquidCloud.</p>
            <div className="wb-code">
              <pre className="wb-pre">{signingCode}</pre>
              <button
                onClick={() => copyToClipboard(signingCode, 'Code copied!')}
                className="wb-copy"
                aria-label="Copy code"
              >
                <Copy />
              </button>
            </div>
          </div>

          <div className="wb-panel">
            <h2 className="wb-h2">Templates</h2>
            <p className="wb-p">Ready-to-use examples for popular integrations</p>
            <div className="wb-stack" style={{ marginBottom: 0 }}>
              {templateExamples.map(template => (
                <div key={template.name} className="wb-tpl">
                  <div className="wb-tpl-head">
                    <div>
                      <h3 className="wb-h3">{template.name}</h3>
                      <p className="wb-note">{template.description}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(template.code, 'Template copied!')}
                      className="wb-copy" style={{ position: 'static' }}
                      aria-label={`Copy ${template.name} template`}
                    >
                      <Copy />
                    </button>
                  </div>
                  <pre className="wb-tpl-pre">{template.code}</pre>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <div className="wb-panel">
            <h2 className="wb-h2">Webhook Event Logs</h2>
            <p className="wb-p">View all webhook delivery attempts with status and timing</p>
            <WebhookEventLogs />
          </div>
        </TabsContent>

        <TabsContent value="events">
          <div className="wb-panel">
            <h2 className="wb-h2">Event Reference</h2>
            <p className="wb-p">Complete list of available webhook events and their payloads</p>
            <div>
              {eventReference.map(group => (
                <div key={group.group} className="wb-group">
                  <h3>{group.group}</h3>
                  <div className="wb-events">
                    {group.events.map(event => (
                      <div key={event.id} className="wb-event-row">
                        <Badge variant="outline" className="wb-event-badge">{event.id}</Badge>
                        <div style={{ minWidth: 0 }}>
                          <p className="wb-event-desc">{event.description}</p>
                          <code className="wb-event-payload">{event.payload}</code>
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
    </PageFrame>
  );
};

export default WebhooksPage;
