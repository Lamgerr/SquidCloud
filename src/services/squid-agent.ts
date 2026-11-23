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
const S = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []) =>
  ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, ...(required.length ? { required } : {}) } } });

export const SQUID_TOOL_SCHEMAS = [
  S('getFileAnalytics', 'Count files, total size, type breakdown, largest and recent files', { fileType: { type: 'string' } }),
  S('countFilesByExtension', 'Count files with a given extension', { extension: { type: 'string' } }, ['extension']),
  S('searchFiles', 'Find files or folders by name', { query: { type: 'string' }, searchContent: { type: 'boolean' } }, ['query']),
  S('getFilesInFolder', 'List files in a folder', { folderPath: { type: 'string' } }),
  S('listFolders', 'List all folders', { parentPath: { type: 'string' } }),
  S('getStorageUsed', 'Get storage used/available', {}),
  S('createFolder', 'Create a new folder', { folderName: { type: 'string' }, parentPath: { type: 'string' } }, ['folderName']),
  S('createFile', 'Create a file with content', { fileName: { type: 'string' }, content: { type: 'string' }, parentFolder: { type: 'string' }, fileType: { type: 'string' } }, ['fileName']),
  S('readFileContent', 'Read a file’s text content', { fileId: { type: 'string' } }, ['fileId']),
  S('updateFileContent', 'Overwrite a file’s text content', { fileId: { type: 'string' }, newContent: { type: 'string' } }, ['fileId', 'newContent']),
  S('renameFile', 'Rename a file', { fileId: { type: 'string' }, newName: { type: 'string' } }, ['fileId', 'newName']),
  S('moveFilesToFolder', 'Move files into a folder', { fileIds: { type: 'array', items: { type: 'string' } }, targetFolder: { type: 'string' } }, ['fileIds', 'targetFolder']),
  S('deleteFile', 'Delete a file (destructive — confirm intent first)', { fileId: { type: 'string' } }, ['fileId']),
  S('deleteFolder', 'Delete a folder (destructive — confirm intent first)', { folderPath: { type: 'string' }, deleteContents: { type: 'boolean' } }, ['folderPath']),
  S('organizeFilesByType', 'Group files into folders by type', { currentPath: { type: 'string' }, files: { type: 'array', items: { type: 'object' } } }),
  S('generateContentFromReference', 'Write content based on a reference text', { referenceText: { type: 'string' }, outputType: { type: 'string', enum: ['markdown', 'code', 'text'] }, instructions: { type: 'string' } }, ['referenceText', 'instructions']),
  S('generateCode', 'Generate code from a description', { language: { type: 'string' }, description: { type: 'string' }, context: { type: 'string' } }, ['description']),
];

const LABELS: Record<string, string> = {
  getFileAnalytics: 'Reading file analytics', countFilesByExtension: 'Counting files',
  searchFiles: 'Searching your files', getFilesInFolder: 'Listing folder',
  listFolders: 'Listing folders', getStorageUsed: 'Checking storage',
  createFolder: 'Creating folder', createFile: 'Creating file',
  readFileContent: 'Reading file', updateFileContent: 'Updating file',
  renameFile: 'Renaming file', moveFilesToFolder: 'Moving files',
  deleteFile: 'Deleting file', deleteFolder: 'Deleting folder',
  organizeFilesByType: 'Organizing files',
  generateContentFromReference: 'Writing content', generateCode: 'Generating code',
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
          // One compact step per tool. Short argument hint only — never the full
          // generated file body (that's what made the UI look like gibberish).
          const hint = Object.entries(args)
            .filter(([, v]) => typeof v === 'string' && (v as string).length < 60)
            .slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ');
          const step: AgentStep = { kind: 'tool', name, label: LABELS[name] || name, detail: hint, status: 'running' };
          steps.push(step);
          let verdict: string;
          try {
            verdict = await SquidAITools.runTool(name, { ...args, folder: args.folder || context?.currentFolder || '' });
          } catch (e: any) {
            verdict = `${name} failed: ${e?.message || 'unknown error'}`;
          }
          // Mark THIS step finished — no second "result" row, no full dump.
          step.status = verdict.includes('failed') ? 'failed' : 'done';
          step.detail = verdict.length > 70 ? verdict.slice(0, 70) + '…' : verdict;
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
