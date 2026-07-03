import { supabase } from '@/integrations/supabase/client';

export interface SquidScript {
  id: string;
  user_id: string;
  name: string;
  description: string;
  yaml_content: string;
  parsed_config: Record<string, any>;
  is_active: boolean;
  source_path: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  total_runs: number;
  created_at: string;
  updated_at: string;
}

export interface SquidScriptTrigger {
  id: string;
  script_id: string;
  trigger_type: 'manual' | 'schedule' | 'file_change' | 'webhook' | 'pipeline_complete';
  config: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

export interface SquidScriptRun {
  id: string;
  script_id: string;
  user_id: string;
  trigger_type: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  execution_plan: Record<string, any>;
  created_at: string;
}

export interface SquidRunJob {
  id: string;
  run_id: string;
  job_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  step_index: number;
  squid_run_steps?: SquidRunStep[];
}

export interface SquidRunStep {
  id: string;
  job_id: string;
  step_name: string;
  action: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  step_index: number;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string | null;
}

interface InvokeOptions {
  action: string;
  [key: string]: unknown;
}

async function invoke<T = any>(options: InvokeOptions): Promise<T> {
  const { data, error } = await supabase.functions.invoke('squid-automation-engine', {
    body: options,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

// ── Script CRUD ─────────────────────────────────────────────

export async function listScripts(): Promise<{ scripts: SquidScript[] }> {
  return invoke({ action: 'list-scripts' });
}

export async function getScript(scriptId: string): Promise<{ script: SquidScript }> {
  return invoke({ action: 'get-script', scriptId });
}

export async function createScript(params: {
  name: string;
  description?: string;
  yamlContent: string;
  parsedConfig?: Record<string, any>;
}): Promise<{ script: SquidScript }> {
  return invoke({ action: 'create-script', ...params });
}

export async function updateScript(scriptId: string, params: {
  name?: string;
  description?: string;
  yamlContent?: string;
  parsedConfig?: Record<string, any>;
  isActive?: boolean;
}): Promise<{ script: SquidScript }> {
  return invoke({ action: 'update-script', scriptId, ...params });
}

export async function deleteScript(scriptId: string): Promise<{ success: boolean }> {
  return invoke({ action: 'delete-script', scriptId });
}

// ── Triggers ────────────────────────────────────────────────

export async function listTriggers(scriptId: string): Promise<{ triggers: SquidScriptTrigger[] }> {
  return invoke({ action: 'list-triggers', scriptId });
}

export async function saveTriggers(scriptId: string, triggers: Omit<SquidScriptTrigger, 'id' | 'script_id' | 'created_at'>[]): Promise<{ success: boolean }> {
  return invoke({ action: 'save-triggers', scriptId, triggers });
}

// ── Runs ────────────────────────────────────────────────────

export async function listRuns(scriptId: string, limit = 20): Promise<{ runs: SquidScriptRun[] }> {
  return invoke({ action: 'list-runs', scriptId, limit });
}

export async function getRun(runId: string): Promise<{ run: SquidScriptRun; jobs: SquidRunJob[] }> {
  return invoke({ action: 'get-run', runId });
}

export async function triggerRun(scriptId: string): Promise<{ run: SquidScriptRun }> {
  return invoke({ action: 'trigger-run', scriptId });
}

export async function getRunLogs(runId: string): Promise<{ logs: string; run: SquidScriptRun; jobs: SquidRunJob[] }> {
  return invoke({ action: 'get-run-logs', runId });
}

// ── SquidVault ──────────────────────────────────────────────

export async function listSecrets(): Promise<{ secrets: { id: string; name: string; scope: any; created_at: string; updated_at: string }[] }> {
  return invoke({ action: 'list-secrets' });
}

export async function deleteSecret(secretId: string): Promise<{ success: boolean }> {
  return invoke({ action: 'delete-secret', secretId });
}
