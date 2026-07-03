#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

const program = new Command();

const API_URL = process.env.SQUIDCLOUD_API_URL || 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api';

function apiKey() {
  const key = process.env.SQUIDCLOUD_API_KEY;
  if (!key) {
    console.error('Set SQUIDCLOUD_API_KEY env var or run: squidlink config set-api-key <key>');
    process.exit(1);
  }
  return key;
}

async function api(path, opts = {}) {
  const resp = await fetch(`${API_URL.replace(/\/+$/, '')}${path}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-SquidCloud-Key': apiKey(),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

program.name('squidlink').description('SquidVeil CLI — Zero-Exposure Secrets Management').version('1.0.0');

// init
program.command('init')
  .description('Initialize .squidveil and .squidproxy in current project')
  .option('-f, --force', 'Overwrite existing files')
  .action((opts_) => {
    const cwd = process.cwd();
    const name = cwd.split('/').pop() || 'project';
    const svPath = resolve(cwd, '.squidveil');
    const spPath = resolve(cwd, '.squidproxy');

    if (existsSync(svPath) && !opts.force) {
      console.error('.squidveil already exists. Use --force.');
      process.exit(1);
    }

    const sv = `# .squidveil\n[project]\nid = "proj_${randomUUID().replace(/-/g, '').slice(0, 12)}"\nname = "${name}"\nenvironment = "production"\n\n[policy]\nfail_closed = true\naudit = true\nref_ttl = 60\nref_max_uses = 1\n\n[secrets]\nallow = ["*"]\n`;
    const sp = `# .squidproxy\n# [[secret]]\n# name = "MY_SECRET"\n# type = "http_auth"\n# inject_header = "Authorization"\n# inject_format = "Bearer {secret}"\n`;

    writeFileSync(svPath, sv);
    writeFileSync(spPath, sp);
    console.log('✓ .squidveil created');
    console.log('✓ .squidproxy created');
  });

// secrets group
const secrets = program.command('secrets').description('Manage secrets');

secrets.command('list')
  .description('List all secrets')
  .action(async () => {
    const d = await api('/secrets');
    const list = d.secrets || [];
    if (!list.length) { console.log('No secrets.'); return; }
    for (const s of list) console.log(`${s.name}  ${s.id.slice(0, 8)}  ${new Date(s.created_at).toLocaleDateString()}`);
    console.log(`\n${list.length} secret(s)`);
  });

secrets.command('create <name> <value>')
  .description('Create a secret')
  .action(async (name, value) => {
    const d = await api('/secrets', { method: 'POST', body: { name, value } });
    console.log(`✓ Secret "${name}" created (${d.secret.id.slice(0, 8)})`);
  });

secrets.command('rename <id> <new-name>')
  .description('Rename a secret')
  .action(async (id, nn) => {
    await api(`/secrets/${id}/rename`, { method: 'PATCH', body: { name: nn } });
    console.log(`✓ Renamed to "${nn}"`);
  });

secrets.command('delete <id>')
  .description('Delete a secret')
  .action(async (id) => {
    await api(`/secrets/${id}`, { method: 'DELETE' });
    console.log('✓ Deleted');
  });

secrets.command('verify <name> <value>')
  .description('Verify a value against a stored secret')
  .action(async (name, value) => {
    const d = await api(`/secrets/${name}/verify`, { method: 'POST', body: { value } });
    if (d.matched) { console.log('MATCHED'); } else { console.log('NOT_MATCHED'); process.exit(1); }
  });

// config
const config = program.command('config').description('CLI configuration');
config.command('set-api-key <key>').action((k) => {
  process.env.SQUIDCLOUD_API_KEY = k;
  console.log('Set SQUIDCLOUD_API_KEY for this session. Add to .env to persist.');
});
config.command('show').action(() => {
  console.log(`API URL: ${API_URL}`);
  console.log(`API Key: ${process.env.SQUIDCLOUD_API_KEY ? '✓ set' : '✗ not set'}`);
});

// whoami
program.command('whoami')
  .description('Verify API key identity')
  .action(async () => {
    const d = await api('/user');
    console.log(`Authenticated: ${d.email || d.id}`);
  });

// proxy
program.command('proxy-gen')
  .description('Generate .squidproxy from existing secrets')
  .action(async () => {
    const d = await api('/secrets');
    const list = d.secrets || [];
    let out = '# .squidproxy — auto-generated\n\n';
    for (const s of list) {
      out += `[[secret]]\nname = "${s.name}"\ntype = "http_auth"\ninject_header = "Authorization"\ninject_format = "Bearer {secret}"\nallowed_hosts = []\nmethods = ["GET", "POST"]\nrate_limit = 500\n\n`;
    }
    writeFileSync(resolve(process.cwd(), '.squidproxy'), out);
    console.log(`✓ Generated .squidproxy with ${list.length} secret(s)`);
  });

program.parse(process.argv);
