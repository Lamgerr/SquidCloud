export interface SquidVariable {
  token: string;
  label: string;
  category: string;
  description: string;
  type: 'string' | 'number' | 'object' | 'timestamp';
  example?: string;
}

export const SQUID_VARIABLES: SquidVariable[] = [
  // ── User ─────────────────────────────────────────────
  { token: 'squid.user.id',       label: 'User ID',        category: 'User',        description: 'Your SquidCloud user UUID', type: 'string', example: 'a1b2c3d4-...' },
  { token: 'squid.user.name',     label: 'User Name',      category: 'User',        description: 'Your display name on SquidCloud', type: 'string', example: 'jdoe' },
  { token: 'squid.user.email',    label: 'User Email',     category: 'User',        description: 'Your registered email address', type: 'string', example: 'user@example.com' },

  // ── Environment ──────────────────────────────────────
  { token: 'squid.env.BRANCH',    label: 'Branch',         category: 'Environment', description: 'Current git or deployment branch', type: 'string', example: 'main' },
  { token: 'squid.env.REGION',    label: 'Region',         category: 'Environment', description: 'SquidCloud compute region', type: 'string', example: 'us-east' },

  // ── File ─────────────────────────────────────────────
  { token: 'squid.file.name',       label: 'File Name',         category: 'File',    description: 'Name of the file being processed', type: 'string', example: 'report.pdf' },
  { token: 'squid.file.path',       label: 'File Path',         category: 'File',    description: 'Full storage path of the file', type: 'string', example: '/documents/report.pdf' },
  { token: 'squid.file.extension',  label: 'File Extension',    category: 'File',    description: 'File extension without dot', type: 'string', example: 'pdf' },
  { token: 'squid.file.size',       label: 'File Size (bytes)', category: 'File',    description: 'File size in bytes', type: 'number', example: '1048576' },
  { token: 'squid.file.mime',       label: 'MIME Type',         category: 'File',    description: 'Detected MIME content type', type: 'string', example: 'application/pdf' },
  { token: 'squid.file.scan[content_type]', label: 'Scan: Content Type', category: 'File', description: 'Content-type from file scan', type: 'string', example: 'image/png' },
  { token: 'squid.file.scan[is_malicious]', label: 'Scan: Malicious', category: 'File', description: 'Whether file is flagged as malicious', type: 'string', example: 'false' },
  { token: 'squid.file.scan[threat]',        label: 'Scan: Threat Name', category: 'File', description: 'Threat name if flagged', type: 'string', example: 'Trojan.Generic' },

  // ── Trigger / Run ────────────────────────────────────
  { token: 'squid.trigger.type',        label: 'Trigger Type',     category: 'Trigger', description: 'What triggered this pipeline (manual, schedule, webhook, file_change)', type: 'string', example: 'manual' },
  { token: 'squid.trigger.source',      label: 'Trigger Source',   category: 'Trigger', description: 'Source details (webhook URL, file path, cron expression)', type: 'string', example: '/api/webhook/incoming' },
  { token: 'squid.run.id',              label: 'Run ID',           category: 'Trigger', description: 'Unique execution run UUID', type: 'string', example: 'run_abc123' },
  { token: 'squid.run.started_at',      label: 'Run Start Time',   category: 'Trigger', description: 'ISO timestamp when the run started', type: 'timestamp', example: '2026-06-27T12:00:00Z' },

  // ── Job / Step ───────────────────────────────────────
  { token: 'squid.job.name',           label: 'Job Name',          category: 'Job',     description: 'Current job identifier', type: 'string', example: 'build-site' },
  { token: 'squid.job.status',         label: 'Job Status',        category: 'Job',     description: 'Current job status', type: 'string', example: 'running' },
  { token: 'squid.job.exit_code',      label: 'Job Exit Code',     category: 'Job',     description: 'Exit code of the last completed step', type: 'string', example: '0' },
  { token: 'squid.step.name',          label: 'Step Name',         category: 'Job',     description: 'Current step within the job', type: 'string', example: 'deploy-to-vercel' },
  { token: 'squid.step.index',         label: 'Step Index',        category: 'Job',     description: 'Zero-based step index in the job', type: 'number', example: '2' },

  // ── Secrets (resolved at runtime from SquidVault) ────
  { token: 'squid.secret.API_KEY',     label: 'Secret: API Key',   category: 'Secrets', description: 'Resolve a vault secret named API_KEY', type: 'string', example: '(resolved at runtime)' },
  { token: 'squid.secret.DEPLOY_KEY',  label: 'Secret: Deploy Key', category: 'Secrets', description: 'Resolve a vault secret named DEPLOY_KEY', type: 'string', example: '(resolved at runtime)' },
  { token: 'squid.secret.*',           label: 'Any Secret',        category: 'Secrets', description: 'Access any vault secret by name', type: 'string', example: 'squid.secret.MY_SECRET' },

  // ── System ───────────────────────────────────────────
  { token: 'squid.timestamp',        label: 'Now Timestamp',     category: 'System',   description: 'Current UTC ISO timestamp', type: 'timestamp', example: '2026-06-27T12:00:00Z' },
  { token: 'squid.uuid',             label: 'UUID v4',           category: 'System',   description: 'Generate a unique UUID v4', type: 'string', example: '550e8400-...' },
  { token: 'squid.date.YYYY',        label: 'Year (4-digit)',    category: 'System',   description: 'Current year', type: 'number', example: '2026' },
  { token: 'squid.date.MM',          label: 'Month (zero-padded)', category: 'System', description: 'Current month (01-12)', type: 'number', example: '06' },
  { token: 'squid.date.DD',          label: 'Day (zero-padded)',   category: 'System', description: 'Current day (01-31)', type: 'number', example: '27' },
  { token: 'squid.date.HH',          label: 'Hour (24h)',        category: 'System',   description: 'Current hour in UTC', type: 'number', example: '14' },
  { token: 'squid.date.mm',          label: 'Minute',            category: 'System',   description: 'Current minute', type: 'number', example: '30' },
];

export const SQUID_CATEGORIES = [...new Set(SQUID_VARIABLES.map(v => v.category))];

export function resolveSquidVariables(
  template: string,
  context: Record<string, string>,
): string {
  return template.replace(/\$\{\{\s*(squid\.[^}]+)\s*\}\}/g, (match, token) => {
    const trimmed = (token as string).trim();
    if (context[trimmed] !== undefined) return context[trimmed];
    if (trimmed === 'squid.uuid') {
      return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }
    if (trimmed === 'squid.timestamp') return new Date().toISOString();
    if (trimmed === 'squid.date.YYYY') return String(new Date().getFullYear());
    if (trimmed === 'squid.date.MM') return String(new Date().getMonth() + 1).padStart(2, '0');
    if (trimmed === 'squid.date.DD') return String(new Date().getDate()).padStart(2, '0');
    if (trimmed === 'squid.date.HH') return String(new Date().getUTCHours()).padStart(2, '0');
    if (trimmed === 'squid.date.mm') return String(new Date().getMinutes()).padStart(2, '0');
    return match;
  });
}

export function extractVariableTokens(yaml: string): string[] {
  const tokens: string[] = [];
  const re = /\$\{\{\s*(squid\.[^}]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(yaml)) !== null) {
    if (!tokens.includes(m[1].trim())) tokens.push(m[1].trim());
  }
  return tokens;
}
