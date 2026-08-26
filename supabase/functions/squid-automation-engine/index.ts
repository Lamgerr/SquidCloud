import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emitWebhookEvent } from "../_shared/webhook-emitter.ts";

import { sendEmail } from "../_shared/gmail-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

// ── YAML Parser ──────────────────────────────────────────────────────────────

interface ParsedStep {
  name: string;
  action: string;
  with: Record<string, string>;
}

interface ParsedJob {
  name: string;
  steps: ParsedStep[];
}

interface ParsedPipeline {
  name: string;
  description: string;
  on: Record<string, unknown>;
  jobs: Record<string, ParsedJob>;
}

function parseYamlPipeline(yaml: string): ParsedPipeline {
  const lines = yaml.split('\n');
  const pipeline: ParsedPipeline = { name: '', description: '', on: {}, jobs: {} };
  let currentSection = '';
  let currentJob = '';
  let currentStep: ParsedStep | null = null;
  let inSteps = false;
  let inWith = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    const nameMatch = line.match(/^name:\s*(.+)/);
    if (nameMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
      pipeline.name = nameMatch[1].replace(/^["']|["']$/g, '').trim();
      continue;
    }

    const descMatch = line.match(/^description:\s*(.+)/);
    if (descMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
      pipeline.description = descMatch[1].replace(/^["']|["']$/g, '').trim();
      continue;
    }

    if (line.match(/^on:/)) { currentSection = 'on'; continue; }
    if (line.match(/^jobs:/)) { currentSection = 'jobs'; continue; }

    if (currentSection === 'jobs') {
      const jobMatch = line.match(/^\s{2}(\S[^:]*):/);
      if (jobMatch) { currentJob = jobMatch[1].trim(); pipeline.jobs[currentJob] = { name: '', steps: [] }; inSteps = false; continue; }

      const jobNameMatch = line.match(/^\s{4}name:\s*(.+)/);
      if (jobNameMatch && currentJob) { pipeline.jobs[currentJob].name = jobNameMatch[1].replace(/^["']|["']$/g, '').trim(); continue; }

      if (line.match(/^\s{4}steps:/) && currentJob) { inSteps = true; continue; }

      if (inSteps && currentJob) {
        const stepNameMatch = line.match(/^\s{6}-\s*name:\s*(.+)/);
        if (stepNameMatch) {
          if (currentStep) pipeline.jobs[currentJob].steps.push(currentStep);
          currentStep = { name: stepNameMatch[1].replace(/^["']|["']$/g, '').trim(), action: '', with: {} };
          inWith = false;
          continue;
        }

        const actionMatch = line.match(/^\s{8}action:\s*(.+)/);
        if (actionMatch && currentStep) { currentStep.action = actionMatch[1].trim(); continue; }

        if (line.match(/^\s{8}with:/) && currentStep) { inWith = true; continue; }

        if (inWith && currentStep) {
          const kvMatch = line.match(/^\s{10}(\w+):\s*(.*)/);
          if (kvMatch) {
            let val = kvMatch[2].trim();
            val = val.replace(/^["']|["']$/g, '');
            currentStep.with[kvMatch[1]] = val;
          }
        }
      }
    }
  }

  if (currentStep && currentJob && pipeline.jobs[currentJob]) {
    pipeline.jobs[currentJob].steps.push(currentStep);
  }

  return pipeline;
}

// ── Variable Resolver ─────────────────────────────────────────────────────────

function buildVarContext(user: any, triggerType: string, fileContext?: Record<string, string>): Record<string, string> {
  const now = new Date().toISOString();
  const uuid = crypto.randomUUID();
  const ctx: Record<string, string> = {
    'squid.user.id': user.id,
    'squid.user.name': user.user_metadata?.full_name || user.user_metadata?.user_name || user.email?.split('@')[0] || 'unknown',
    'squid.user.email': user.email || '',
    'squid.trigger.type': triggerType,
    'squid.trigger.source': 'system',
    'squid.run.id': uuid,
    'squid.run.started_at': now,
    'squid.timestamp': now,
    'squid.uuid': uuid,
    'squid.date.YYYY': now.slice(0, 4),
    'squid.date.MM': now.slice(5, 7),
    'squid.date.DD': now.slice(8, 10),
    'squid.date.HH': now.slice(11, 13),
    'squid.date.mm': now.slice(14, 16),
    'squid.date.today': `${now.slice(0, 10)}`,
    'squid.date.now': now,
    'squid.date.weekday': ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()],
    'squid.date.month': ['January','February','March','April','May','June','July','August','September','October','November','December'][new Date().getMonth()],
    'squid.date.year': now.slice(0, 4),
    'squid.date.timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    'squid.pipeline.id': '',
    'squid.pipeline.name': '',
    'squid.pipeline.run_id': uuid,
  };

  if (fileContext) {
    for (const [k, v] of Object.entries(fileContext)) {
      ctx[`squid.file.${k}`] = v;
    }
  }

  return ctx;
}

function resolveVars(template: string, ctx: Record<string, string>): string {
  return template.replace(/\$\{\{\s*(squid\.[^}]+)\s*\}\}/g, (_match: string, token: string) => {
    const key = token.trim();
    if (ctx[key] !== undefined) return ctx[key];
    return `[unresolved:${key}]`;
  });
}

// ── Step Executor ────────────────────────────────────────────────────────────

const ACTION_HANDLERS: Record<string, (step: ParsedStep, ctx: Record<string, string>) => Promise<{ status: string; output: Record<string, unknown>; error?: string }>> = {
  'squidcloud/echo': async (step, ctx) => {
    return { status: 'success', output: { message: resolveVars(step.with.message || '', ctx), success: true } };
  },
  'squidcloud/log': async (step, ctx) => {
    return { status: 'success', output: { logged: resolveVars(step.with.message || '', ctx), success: true } };
  },
  'squidcloud/scan': async (step, ctx) => {
    const filter = resolveVars(step.with.filter || '', ctx);
    const uid = ctx['squid.user.id'];
    let q = adminDb.from('files').select('id, name, size').eq('user_id', uid).eq('is_deleted', false).limit(100);
    if (filter) q = q.ilike('name', `%${filter}%`);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { status: 'success', output: { found: data?.length ?? 0, names: data?.map(f => f.name) ?? [], ids: data?.map(f => f.id) ?? [], success: true } };
  },
  'squidcloud/condition': async (step, ctx) => {
    const variable = resolveVars(step.with.variable || '', ctx);
    const op = step.with.operator || 'eq';
    const value = resolveVars(step.with.value || '', ctx);
    let passed = false;
    switch (op) {
      case 'eq': passed = variable === value; break;
      case 'neq': passed = variable !== value; break;
      case 'contains': passed = variable.includes(value); break;
      case 'gt': passed = Number(variable) > Number(value); break;
      case 'gte': passed = Number(variable) >= Number(value); break;
      case 'lt': passed = Number(variable) < Number(value); break;
      case 'lte': passed = Number(variable) <= Number(value); break;
      case 'matches': try { passed = new RegExp(value).test(variable); } catch { passed = false; } break;
    }
    if (!passed) throw new Error('CONDITION_NOT_MET');
    return { status: 'success', output: { condition: 'met', success: true } };
  },
  'squidcloud/file-delete': async (step, ctx) => {
    const filter = resolveVars(step.with.filter || step.with.name || '', ctx);
    const uid = ctx['squid.user.id'];
    let q = adminDb.from('files').select('id').eq('user_id', uid).eq('is_deleted', false);
    if (filter) q = q.ilike('name', `%${filter}%`);
    const { data } = await q;
    const ids = (data ?? []).map(r => r.id);
    if (!ids.length) return { status: 'success', output: { deleted: 0, success: true } };
    const { error } = await adminDb.from('files').update({ is_deleted: true, deleted_at: new Date().toISOString() }).in('id', ids);
    if (error) throw new Error(error.message);
    return { status: 'success', output: { deleted: ids.length, success: true } };
  },
  'squidcloud/file-move': async (step, ctx) => {
    const filter = resolveVars(step.with.filter || '', ctx);
    const folderName = resolveVars(step.with.folder || '', ctx);
    const uid = ctx['squid.user.id'];
    const { data: folder } = await adminDb.from('folders').select('id').eq('user_id', uid).ilike('name', folderName).limit(1).maybeSingle();
    if (!folder) throw new Error(`Folder not found: ${folderName}`);
    let q = adminDb.from('files').select('id').eq('user_id', uid).eq('is_deleted', false);
    if (filter) q = q.ilike('name', `%${filter}%`);
    const { data } = await q;
    const ids = (data ?? []).map(r => r.id);
    if (!ids.length) return { status: 'success', output: { moved: 0, success: true } };
    const { error } = await adminDb.from('files').update({ parent_folder: folder.id }).in('id', ids);
    if (error) throw new Error(error.message);
    return { status: 'success', output: { moved: ids.length, folder: folderName, success: true } };
  },
  'squidcloud/file-copy': async (step, ctx) => {
    const filter = resolveVars(step.with.filter || '', ctx);
    const uid = ctx['squid.user.id'];
    let q = adminDb.from('files').select('*').eq('user_id', uid).eq('is_deleted', false);
    if (filter) q = q.ilike('name', `%${filter}%`);
    const { data } = await q;
    let copied = 0;
    for (const row of data ?? []) {
      const copy = { ...row, id: crypto.randomUUID(), name: `${row.name} (copy)`, created_at: undefined, updated_at: undefined };
      delete copy.created_at; delete copy.updated_at;
      const { error } = await adminDb.from('files').insert(copy);
      if (!error) copied++;
    }
    return { status: 'success', output: { copied, success: true } };
  },
  'squidcloud/file-tag': async (step, ctx) => {
    const filter = resolveVars(step.with.filter || '', ctx);
    const tag = resolveVars(step.with.tag || 'scripted', ctx);
    const uid = ctx['squid.user.id'];
    let q = adminDb.from('files').select('id, tags').eq('user_id', uid).eq('is_deleted', false);
    if (filter) q = q.ilike('name', `%${filter}%`);
    const { data } = await q;
    let tagged = 0;
    for (const row of data ?? []) {
      const tags = Array.isArray(row.tags) ? [...row.tags] : [];
      if (!tags.includes(tag)) { tags.push(tag); 
        const { error } = await adminDb.from('files').update({ tags }).eq('id', row.id);
        if (!error) tagged++;
      }
    }
    return { status: 'success', output: { tagged, tag, success: true } };
  },
  'squidcloud/slack': async (step, ctx) => {
    const url = resolveVars(step.with.webhook_url || '', ctx);
    const message = resolveVars(step.with.message || '', ctx);
    if (!url) return { status: 'skipped', output: { reason: 'no webhook_url provided' } };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: message }) });
    if (!res.ok) throw new Error(`Slack webhook HTTP ${res.status}`);
    return { status: 'success', output: { delivered: true, success: true } };
  },
  'squidcloud/discord': async (step, ctx) => {
    const url = resolveVars(step.with.webhook_url || '', ctx);
    const message = resolveVars(step.with.message || '', ctx);
    if (!url) return { status: 'skipped', output: { reason: 'no webhook_url provided' } };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: message }) });
    if (!res.ok) throw new Error(`Discord webhook HTTP ${res.status}`);
    return { status: 'success', output: { delivered: true, success: true } };
  },
  'squidcloud/email-send': async (step, ctx) => {
    const to = resolveVars(step.with.to || ctx['squid.user.email'] || '', ctx);
    const subject = resolveVars(step.with.subject || 'SquidActions pipeline notification', ctx);
    const body = resolveVars(step.with.body || step.with.message || '', ctx);
    if (!to) return { status: 'skipped', output: { reason: 'no recipient' } };
    try {
      await sendEmail(to, subject, body, `<p>${body}</p>`);
      return { status: 'success', output: { sent_to: to, success: true } };
    } catch (e) {
      return { status: 'skipped', output: { reason: 'email provider not configured (' + (e.message || '').slice(0, 60) + ')' } };
    }
  },
  'squidcloud/transform': async (step, ctx) => {
    return { status: 'success', output: { format: step.with.format || 'json', operation: step.with.operation || 'convert', note: 'metadata transform recorded', success: true } };
  },
  'squidcloud/delay': async (step, ctx) => {
    const ms = (Number(step.with.duration) || 1) * 1000;
    await new Promise(r => setTimeout(r, Math.min(ms, 30000)));
    return { status: 'success', output: { duration: step.with.duration, success: true } };
  },
  // Platform-dependent actions — reported honestly until their backends ship.
  ...Object.fromEntries([
    'squidcloud/compress', 'squidcloud/s3-upload', 'squidcloud/s3-download',
    'squidcloud/file-sync', 'squidcloud/image-resize', 'squidcloud/image-convert',
    'squidcloud/video-convert', 'squidcloud/media-extract', 'squidcloud/ai-classify',
  ].map(action => [action, async (step: ParsedStep) => ({
    status: 'skipped',
    output: { reason: `${action.split('/')[1]} requires a worker backend that is not enabled for this workspace`, success: false as boolean },
  })])),
};

async function executeStep(step: ParsedStep, ctx: Record<string, string>): Promise<{ status: string; output: Record<string, unknown>; error?: string }> {
  const handler = ACTION_HANDLERS[step.action];
  if (!handler) {
    return { status: 'failed', output: {}, error: `Unknown action: ${step.action}` };
  }
  try {
    return await handler(step, ctx);
  } catch (err: any) {
    return { status: 'failed', output: {}, error: err.message || 'Step execution error' };
  }
}


// ── Trigger sync: persist `on:` block from YAML as real trigger rows ─────────

function syncTriggersFromYaml(supabase: any, scriptId: string, yamlContent: string): Promise<void> {
  const lines = yamlContent.split('\n');
  let inOn = false;
  const wantsFileUpload = { enabled: false, path: '**/*' };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^on:\s*$/.test(line)) { inOn = true; continue; }
    if (inOn && /^\S/.test(line) && line.trim()) inOn = false;           // next top-level key ends the block
    if (!inOn) continue;
    const m = line.match(/^\s{2}(file-upload|manual|schedule|webhook):\s*(.*)$/);
    if (!m) continue;
    if (m[1] === 'file-upload') {
      wantsFileUpload.enabled = true;
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (val && val !== 'true') wantsFileUpload.path = val;
    }
  }

  return (async () => {
    await supabase.from('squid_script_triggers').delete().eq('script_id', scriptId).eq('trigger_type', 'file_change');
    if (wantsFileUpload.enabled) {
      await supabase.from('squid_script_triggers').insert({
        script_id: scriptId,
        trigger_type: 'file_change',
        config: { path: wantsFileUpload.path, events: ['create'] },
        is_active: true,
      });
    }
  })();
}

// ── Pipeline Executor ────────────────────────────────────────────────────────

async function executePipeline(
  supabase: any,
  script: any,
  runId: string,
  user: any,
  triggerType: string,
  fileContext?: Record<string, string>,
): Promise<void> {
  const pipeline = parseYamlPipeline(script.yaml_content);
  const ctx = buildVarContext(user, triggerType, fileContext);
  ctx['squid.pipeline.id'] = script.id;
  ctx['squid.pipeline.name'] = script.name;

  const now = new Date().toISOString();

  // Mark run as running
  await supabase.from('squid_script_runs').update({ status: 'running', started_at: now }).eq('id', runId);

  let runStatus = 'success';
  let stepIndex = 0;

  for (const [jobId, job] of Object.entries(pipeline.jobs)) {
    // Create job record
    const { data: jobRecord } = await supabase.from('squid_run_jobs').insert({
      run_id: runId, job_name: job.name || jobId, status: 'running', started_at: new Date().toISOString(), step_index: 0,
    }).select().single();

    if (!jobRecord) continue;

    for (const step of job.steps) {
      const stepNow = new Date().toISOString();
      stepIndex++;

      // Resolve variables in step config
      const resolvedWith: Record<string, string> = {};
      for (const [k, v] of Object.entries(step.with)) {
        resolvedWith[k] = resolveVars(v, ctx);
      }

      // Create step record
      const stepInput = JSON.stringify(resolvedWith);
      const { data: stepRecord, error: stepError } = await supabase.from('squid_run_steps').insert({
        job_id: jobRecord.id,
        step_name: step.name,
        action_use: step.action,
        status: 'running',
        input: stepInput,
        started_at: stepNow,
        step_index: stepIndex,
      }).select().single();

      if (stepError || !stepRecord) {
        console.error('Step insert error:', stepError || 'No data returned');
        continue;
      }

      // Execute
      const result = await executeStep({ ...step, with: resolvedWith }, ctx);

      // Update step
      await supabase.from('squid_run_steps').update({
        status: result.status,
        output: typeof result.output === 'string' ? result.output : JSON.stringify(result.output),
        error_message: result.error || null,
        completed_at: new Date().toISOString(),
      }).eq('id', stepRecord.id);

      if (result.status === 'failed') {
        runStatus = 'failed';
        break;
      }
    }

    // Update job
    await supabase.from('squid_run_jobs').update({
      status: runStatus === 'failed' ? 'failed' : 'success',
      completed_at: new Date().toISOString(),
    }).eq('id', jobRecord.id);

    if (runStatus === 'failed') break;
  }

  // Finalize run
  const completedAt = new Date().toISOString();
  await supabase.from('squid_script_runs').update({
    status: runStatus,
    completed_at: completedAt,
  }).eq('id', runId);

  // Update script
  await supabase.from('squid_scripts').update({
    last_run_at: completedAt,
    last_run_status: runStatus,
    total_runs: (script.total_runs || 0) + 1,
  }).eq('id', script.id);

  // Emit pipeline webhook event
  void emitWebhookEvent({
    userId: script.user_id || user?.id,
    event: runStatus === 'failed' ? 'pipeline.failed' : 'pipeline.completed',
    data: {
      pipeline_id: script.id,
      pipeline_name: script.name,
      run_id: runId,
      status: runStatus,
      trigger_type: triggerType,
      completed_at: completedAt,
    },
  });
}

// ── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) return json({ error: 'Unauthorized' }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  // Internal service-role calls may act on behalf of a user (file-event fan-in).
  const isInternal = jwt === SUPABASE_SERVICE_ROLE_KEY;
  let user: any;

  if (isInternal) {
    if ((body.action as string) !== 'file-event') {
      return json({ error: 'Internal token only supports file-event' }, 403);
    }
    const uid = body.userId as string;
    if (!uid) return json({ error: 'userId required for internal file-event' }, 400);
    user = { id: uid, email: '', user_metadata: {} };
  } else {
    const { data: { user: jwtUser }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !jwtUser) return json({ error: 'Invalid token' }, 401);
    user = jwtUser;
  }

  const action = (body.action as string) || '';

  try {
    switch (action) {

      // ── Script CRUD ──────────────────────────────────────────

      case 'list-scripts': {
        const { data: scripts } = await supabase
          .from('squid_scripts')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });
        return json({ scripts: scripts || [] });
      }

      case 'get-script': {
        const scriptId = body.scriptId as string;
        if (!scriptId) return json({ error: 'scriptId required' }, 400);
        const { data: script } = await supabase
          .from('squid_scripts')
          .select('*')
          .eq('id', scriptId)
          .eq('user_id', user.id)
          .single();
        if (!script) return json({ error: 'Script not found' }, 404);
        return json({ script });
      }

      case 'create-script': {
        const { name, description, yamlContent, parsedConfig } = body;
        if (!name || !yamlContent) return json({ error: 'name and yamlContent required' }, 400);

        const { data: script, error: insertError } = await supabase
          .from('squid_scripts')
          .insert({
            user_id: user.id,
            name: name as string,
            description: (description as string) || '',
            yaml_content: yamlContent as string,
            parsed_config: (parsedConfig as Record<string, unknown>) || {},
          })
          .select()
          .single();

        if (insertError) return json({ error: insertError.message }, 500);
        await syncTriggersFromYaml(supabase, script.id, yamlContent as string);
        return json({ script });
      }

      case 'update-script': {
        const scriptId = body.scriptId as string;
        if (!scriptId) return json({ error: 'scriptId required' }, 400);

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.name) updates.name = body.name;
        if (body.description !== undefined) updates.description = body.description;
        if (body.yamlContent) updates.yaml_content = body.yamlContent;
        if (body.parsedConfig) updates.parsed_config = body.parsedConfig;
        if (body.isActive !== undefined) updates.is_active = body.isActive;

        const { data: script, error: updateError } = await supabase
          .from('squid_scripts')
          .update(updates)
          .eq('id', scriptId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (body.yamlContent) await syncTriggersFromYaml(supabase, scriptId, body.yamlContent as string);

        if (updateError) return json({ error: updateError.message }, 500);
        return json({ script });
      }

      case 'delete-script': {
        const scriptId = body.scriptId as string;
        if (!scriptId) return json({ error: 'scriptId required' }, 400);

        await supabase.from('squid_run_steps').delete().filter('job_id', 'in', 
          `(select id from squid_run_jobs where run_id in (select id from squid_script_runs where script_id = '${scriptId}'))`
        );
        await supabase.from('squid_run_jobs').delete().filter('run_id', 'in',
          `(select id from squid_script_runs where script_id = '${scriptId}')`
        );
        await supabase.from('squid_script_runs').delete().eq('script_id', scriptId);
        await supabase.from('squid_script_triggers').delete().eq('script_id', scriptId);
        const { error: deleteError } = await supabase.from('squid_scripts').delete().eq('id', scriptId).eq('user_id', user.id);

        if (deleteError) return json({ error: deleteError.message }, 500);
        return json({ success: true });
      }

      // ── Triggers ─────────────────────────────────────────────

      case 'list-triggers': {
        const scriptId = body.scriptId as string;
        if (!scriptId) return json({ error: 'scriptId required' }, 400);
        const { data: triggers } = await supabase
          .from('squid_script_triggers')
          .select('*')
          .eq('script_id', scriptId);
        return json({ triggers: triggers || [] });
      }

      case 'save-triggers': {
        const scriptId = body.scriptId as string;
        const triggers = body.triggers as any[];
        if (!scriptId || !triggers) return json({ error: 'scriptId and triggers required' }, 400);

        await supabase.from('squid_script_triggers').delete().eq('script_id', scriptId);

        if (triggers.length > 0) {
          const { error: insertError } = await supabase
            .from('squid_script_triggers')
            .insert(triggers.map((t: any) => ({
              script_id: scriptId,
              trigger_type: t.trigger_type,
              config: t.config || {},
              is_active: t.is_active !== false,
            })));
          if (insertError) return json({ error: insertError.message }, 500);
        }

        return json({ success: true });
      }

      // ── Runs ─────────────────────────────────────────────────

      case 'list-runs': {
        const scriptId = body.scriptId as string;
        const limit = Math.min((body.limit as number) || 20, 100);
        if (!scriptId) return json({ error: 'scriptId required' }, 400);

        const { data: runs } = await supabase
          .from('squid_script_runs')
          .select('*')
          .eq('script_id', scriptId)
          .order('created_at', { ascending: false })
          .limit(limit);
        return json({ runs: runs || [] });
      }

      case 'get-run': {
        const runId = body.runId as string;
        if (!runId) return json({ error: 'runId required' }, 400);

        const { data: run } = await supabase
          .from('squid_script_runs')
          .select('*')
          .eq('id', runId)
          .eq('user_id', user.id)
          .single();

        if (!run) return json({ error: 'Run not found' }, 404);

        const { data: jobs } = await supabase
          .from('squid_run_jobs')
          .select('*, squid_run_steps(*)')
          .eq('run_id', runId)
          .order('step_index', { ascending: true });

        return json({ run, jobs: jobs || [] });
      }

      case 'get-run-logs': {
        const runId = body.runId as string;
        if (!runId) return json({ error: 'runId required' }, 400);

        const { data: run } = await supabase.from('squid_script_runs').select('*').eq('id', runId).single();
        if (!run) return json({ error: 'Run not found' }, 404);

        const { data: jobs } = await supabase
          .from('squid_run_jobs')
          .select('*, squid_run_steps(*)')
          .eq('run_id', runId)
          .order('step_index', { ascending: true });

        const logs: string[] = [];
        logs.push(`[${run.status?.toUpperCase()}] Run ${runId.slice(0, 8)}`);
        logs.push(`Trigger: ${run.trigger_type} | Started: ${run.started_at || '-'} | Completed: ${run.completed_at || '-'}`);
        logs.push('');

        for (const job of jobs || []) {
          logs.push(`  Job: ${job.job_name} [${job.status}]`);
          for (const step of job.squid_run_steps || []) {
            const statusIcon = step.status === 'completed' ? '✓' : step.status === 'running' ? '→' : step.status === 'failed' ? '✗' : '○';
            logs.push(`    ${statusIcon} ${step.step_name} (${step.action_use || step.action || '-'}) [${step.status}]`);
            if (step.error_message) logs.push(`      Error: ${step.error_message}`);
          }
        }

        return json({ logs: logs.join('\n'), run, jobs: jobs || [] });
      }

      // ── Manual trigger ───────────────────────────────────────

      case 'trigger-run': {
        const scriptId = body.scriptId as string;
        if (!scriptId) return json({ error: 'scriptId required' }, 400);

        const { data: script } = await supabase
          .from('squid_scripts')
          .select('*')
          .eq('id', scriptId)
          .eq('user_id', user.id)
          .single();

        if (!script) return json({ error: 'Script not found' }, 404);

        // Create run record
        const { data: run, error: runError } = await supabase
          .from('squid_script_runs')
          .insert({
            script_id: scriptId,
            user_id: user.id,
            trigger_type: 'manual',
            status: 'pending',
          })
          .select()
          .single();

        if (runError) return json({ error: runError.message }, 500);

        // Execute pipeline synchronously to see errors
        try {
          await executePipeline(supabase, script, run.id, user, 'manual');
        } catch (err: any) {
          console.error('Pipeline execution error:', err);
          await supabase.from('squid_script_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_message: err.message }).eq('id', run.id);
        }

        const { data: finalRun } = await supabase.from('squid_script_runs').select('*').eq('id', run.id).single();
        return json({ run: finalRun });
      }

      // ── Res54 File Event Trigger ──────────────────────────────

      case 'file-event': {
        const filePath = body.path as string;
        const event = body.event as string; // create, update, delete, move
        if (!filePath || !event) return json({ error: 'path and event required' }, 400);

        // Find all scripts with file_change triggers matching this path
        const { data: triggers } = await supabase
          .from('squid_script_triggers')
          .select('*, squid_scripts!inner(*)')
          .eq('trigger_type', 'file_change')
          .eq('is_active', true);

        const matchedRuns: string[] = [];

        for (const trigger of triggers || []) {
          const config = trigger.config as Record<string, any> || {};
          const watchPath = config.path || '**/*';
          const watchEvents = config.events || ['create', 'update'];

          if (!watchEvents.includes(event)) continue;

          // Simple glob match
          let pathMatch = false;
          if (watchPath === '**/*' || watchPath === '*') pathMatch = true;
          else if (watchPath.includes('*')) {
            try {
              const rx = new RegExp('^' + watchPath.split('*').map(seg => seg.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
              pathMatch = rx.test(filePath);
            } catch { pathMatch = false; }
          } else pathMatch = filePath.startsWith(watchPath);
          if (!pathMatch) continue;

          // Found a matching pipeline — execute
          const { data: script } = await supabase
            .from('squid_scripts')
            .select('*')
            .eq('id', trigger.script_id)
            .single();

          // Ownership flows through the parent script — squid_script_triggers
          // has no user_id column, so comparing against it skipped every match.
          if (!script) continue;
          if (!script.is_active) continue;
          if (script.user_id !== (body.userId as string)) continue;

          const fileName = filePath.split('/').pop() || filePath;
          const fileCtx: Record<string, string> = {
            'path': filePath,
            'name': fileName,
            'extension': fileName.includes('.') ? fileName.split('.').pop() || '' : '',
            'event': event,
            'size': String(body.size || 0),
            'mime_type': body.mimeType as string || 'application/octet-stream',
            'squid.event': event,
            'squid.file.path': filePath,
            'squid.file.name': fileName,
            'squid.file.size': String(body.size || 0),
            'squid.file.mime': body.mimeType as string || 'application/octet-stream',
          };

          const { data: run } = await supabase.from('squid_script_runs').insert({
            script_id: script.id,
            user_id: script.user_id,
            trigger_type: 'file_change',
            status: 'pending',
          }).select().single();

            if (run) {
              matchedRuns.push(run.id);
              const dummyUser = { id: script.user_id, email: '', user_metadata: {} };
              executePipeline(supabase, script, run.id, dummyUser as any, 'file_change', fileCtx).catch(console.error);
            }
        }

        return json({ matched: matchedRuns.length, run_ids: matchedRuns });
      }

      // ── SquidVault ───────────────────────────────────────────

      case 'list-secrets': {
        const { data: secrets } = await supabase
          .from('squid_vault_secrets')
          .select('id, name, scope, created_at, updated_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        return json({ secrets: secrets || [] });
      }

      case 'delete-secret': {
        const secretId = body.secretId as string;
        if (!secretId) return json({ error: 'secretId required' }, 400);
        await supabase.from('squid_vault_secrets').delete().eq('id', secretId).eq('user_id', user.id);
        return json({ success: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error: any) {
    return json({ error: error.message }, 500);
  }
});
