/**
 * Squid Agent runtime — ported from dex's model loop (opencode_bridge.py).
 * Model proposes tool_calls; the agent executes them on the SquidCloud tool
 * bench (SquidAITools.runTool), feeds short verdicts back, and loops to a final
 * answer. All work is backgrounded through squidAIJobs so it survives closing
 * the command palette.
 */
import { supabase } from '@/integrations/supabase/client';
import { SquidAITools } from './squid-ai-tools';
import { squidAIJobs, type AIJob } from './squid-ai-jobs';
import { SQUID_SOUL, stripEmoji } from './squid-ai-soul';

export interface AgentStep {
  kind: 'tool' | 'result';
  name?: string;
  label: string;
  detail?: string;
  status?: 'running' | 'done' | 'failed';
}
export interface AgentResult {
  message: string;
  steps: AgentStep[];
  jobId: string;
}

type Msg = { role: 'system' | 'user' | 'assistant' | 'tool'; content?: string; tool_calls?: any[]; tool_call_id?: string; name?: string };

/** OpenAI-style tool schemas for the model (dex registry pattern). */
export const SQUID_TOOL_SCHEMAS = [
  { type: 'function', function: { name: 'getFileAnalytics', description: 'Count files, total size, type breakdown, largest and recent files', parameters: { type: 'object', properties: { fileType: { type: 'string' } } } } },
  { type: 'function', function: { name: 'countFilesByExtension', description: 'Count files with a given extension', parameters: { type: 'object', properties: { extension: { type: 'string' } }, required: ['extension'] } } },
  { type: 'function', function: { name: 'searchFiles', description: 'Find files or folders by name', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'getFilesInFolder', description: 'List files in a folder', parameters: { type: 'object', properties: { folderPath: { type: 'string' } } } } },
  { type: 'function', function: { name: 'getStorageUsed', description: 'Get storage used/available', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'createFolder', description: 'Create a new folder', parameters: { type: 'object', properties: { folderName: { type: 'string' }, parentPath: { type: 'string' } }, required: ['folderName'] } } },
  { type: 'function', function: { name: 'renameFile', description: 'Rename a file', parameters: { type: 'object', properties: { fileId: { type: 'string' }, newName: { type: 'string' } }, required: ['fileId', 'newName'] } } },
  { type: 'function', function: { name: 'moveFilesToFolder', description: 'Move files into a folder', parameters: { type: 'object', properties: { fileIds: { type: 'array', items: { type: 'string' } }, targetFolder: { type: 'string' } }, required: ['fileIds', 'targetFolder'] } } },
  { type: 'function', function: { name: 'organizeFilesByType', description: 'Group files into folders by type', parameters: { type: 'object', properties: { currentPath: { type: 'string' } } } } },
  { type: 'function', function: { name: 'deleteFile', description: 'Delete a file (destructive — confirm intent first)', parameters: { type: 'object', properties: { fileId: { type: 'string' } }, required: ['fileId'] } } },
];

const LABELS: Record<string, string> = {
  getFileAnalytics: 'Reading file analytics', countFilesByExtension: 'Counting files',
  searchFiles: 'Searching your files', getFilesInFolder: 'Listing folder',
  getStorageUsed: 'Checking storage', createFolder: 'Creating folder',
  renameFile: 'Renaming file', moveFilesToFolder: 'Moving files',
  organizeFilesByType: 'Organizing files', deleteFile: 'Deleting file',
};

class SquidAgent {
  private history: Msg[] = [];

  reset() { this.history = []; }

  private async callModel(messages: Msg[], context?: any, withTools = true) {
    const { data, error } = await supabase.functions.invoke('squid-ai-chat', {
      body: { messages, context, tools: withTools ? SQUID_TOOL_SCHEMAS : undefined },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as { message: string; tool_calls?: any[]; finish_reason?: string };
  }

  /** Run a user request with a full tool loop, tracked as a background job. */
  ask(input: string, context?: any): Promise<AgentResult> {
    const steps: AgentStep[] = [];
    return squidAIJobs.run('Squid is working', async (setProgress) => {
      const jobSnap = squidAIJobs.snapshot().find(j => j.status === 'running');
      const jobId = jobSnap?.id || 'job_local';

      this.history.push({ role: 'user', content: input });
      // Keep the dex-style persona in every request (server also injects it).
      const messages: Msg[] = [{ role: 'system', content: SQUID_SOUL }, ...this.history];

      for (let turn = 0; turn < 5; turn++) {
        setProgress(Math.min(0.9, 0.15 + turn * 0.2));
        const res = await this.callModel(messages, context, turn === 0);
        const calls = res.tool_calls || [];

        if (!calls.length) {
          const clean = stripEmoji(res.message || 'Done.');
          this.history.push({ role: 'assistant', content: clean });
          setProgress(1);
          return { message: clean, steps, jobId };
        }

        // assistant message carrying the tool calls (OpenAI shape)
        messages.push({ role: 'assistant', content: res.message || '', tool_calls: calls });
        this.history.push({ role: 'assistant', content: res.message || '', tool_calls: calls });

        for (const tc of calls) {
          const name = tc.function?.name || tc.name || 'tool';
          let args: any = {};
          try { args = typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : (tc.function?.arguments || {}); } catch { args = {}; }
          steps.push({ kind: 'tool', name, label: LABELS[name] || name, detail: Object.values(args).filter(Boolean).slice(0, 2).join(' · '), status: 'running' });
          let verdict: string;
          try {
            verdict = await SquidAITools.runTool(name, { ...args, folder: args.folder || context?.currentFolder || '' });
          } catch (e: any) {
            verdict = `${name} failed: ${e?.message || 'unknown error'}`;
          }
          steps.push({ kind: 'result', name, label: verdict, status: verdict.includes('failed') ? 'failed' : 'done' });
          messages.push({ role: 'tool', tool_call_id: tc.id || `tc_${turn}_${name}`, name, content: verdict });
          this.history.push({ role: 'tool', tool_call_id: tc.id || `tc_${turn}_${name}`, name, content: verdict });
        }
      }

      const fallback = stripEmoji('I ran your tools but could not produce a final summary. Check the steps above.');
      setProgress(1);
      return { message: fallback, steps, jobId };
    });
  }
}

export const squidAgent = new SquidAgent();
