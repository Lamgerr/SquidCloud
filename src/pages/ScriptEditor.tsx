import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, Handle, Position,
  useNodesState, useEdgesState,
  type Node, type Edge, type NodeProps, type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Plus, Trash2, Save, Play, ChevronLeft, Loader2,
  Search, X, FileCode, Settings2, Zap,
} from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  createScript, updateScript, getScript, deleteScript, triggerRun,
} from '@/lib/automation-api';

/* ────────────────────────────────────────────────────────────────
   Action catalog — ONLY actions the engine truly executes.
   Each entry maps a palette component to its engine action ref.
──────────────────────────────────────────────────────────────── */

interface ActionDef {
  id: string;            // palette/component id
  action: string;        // engine action ref (squidcloud/…)
  title: string;
  group: 'Files' | 'Notify' | 'Logic';
  desc: string;
  fields: FieldDef[];
}

interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'boolean';
  placeholder?: string;
  required?: boolean;
}

const ACTIONS: ActionDef[] = [
  { id: 'scan',    action: 'squidcloud/scan',       title: 'Scan files',     group: 'Files',
    desc: 'Find files matching a name filter',
    fields: [{ key: 'filter', label: 'Name contains', placeholder: '.jpg' }] },
  { id: 'file-delete', action: 'squidcloud/file-delete', title: 'Delete files', group: 'Files',
    desc: 'Move matching files to trash',
    fields: [{ key: 'filter', label: 'Name contains', required: true }] },
  { id: 'file-move', action: 'squidcloud/file-move', title: 'Move files', group: 'Files',
    desc: 'Move matching files into a folder',
    fields: [{ key: 'filter', label: 'Name contains' },
             { key: 'folder', label: 'Target folder name', required: true }] },
  { id: 'file-copy', action: 'squidcloud/file-copy', title: 'Copy files', group: 'Files',
    desc: 'Duplicate matching files',
    fields: [{ key: 'filter', label: 'Name contains', required: true }] },
  { id: 'tag',     action: 'squidcloud/file-tag',   title: 'Tag files',      group: 'Files',
    desc: 'Append a tag to matching files',
    fields: [{ key: 'filter', label: 'Name contains' },
             { key: 'tag', label: 'Tag', required: true, placeholder: 'scripted' }] },

  { id: 'email',   action: 'squidcloud/email-send', title: 'Send email',     group: 'Notify',
    desc: 'Email via your SquidCloud address',
    fields: [{ key: 'to', label: 'To', placeholder: 'leave empty = your account email' },
             { key: 'subject', label: 'Subject', required: true },
             { key: 'body', label: 'Body', type: 'textarea', required: true }] },
  { id: 'slack',   action: 'squidcloud/slack',      title: 'Slack',          group: 'Notify',
    desc: 'Post to a Slack webhook',
    fields: [{ key: 'webhook_url', label: 'Webhook URL', required: true },
             { key: 'message', label: 'Message', type: 'textarea', required: true }] },
  { id: 'discord', action: 'squidcloud/discord',    title: 'Discord',        group: 'Notify',
    desc: 'Post to a Discord webhook',
    fields: [{ key: 'webhook_url', label: 'Webhook URL', required: true },
             { key: 'message', label: 'Message', type: 'textarea', required: true }] },

  { id: 'condition', action: 'squidcloud/condition', title: 'If condition', group: 'Logic',
    desc: 'Stop the pipeline unless a check passes',
    fields: [{ key: 'variable', label: 'Variable (${{ squid.file.name }})', required: true },
             { key: 'operator', label: 'Operator', type: 'text', placeholder: 'eq · contains · gt …' },
             { key: 'value', label: 'Value' }] },
  { id: 'delay',   action: 'squidcloud/delay',      title: 'Wait',           group: 'Logic',
    desc: 'Pause between steps',
    fields: [{ key: 'duration', label: 'Seconds', required: true }] },
  { id: 'log',     action: 'squidcloud/log',        title: 'Log',            group: 'Logic',
    desc: 'Record a line in the run log',
    fields: [{ key: 'message', label: 'Message', type: 'textarea' }] },
];

const ACTION_BY_ID = Object.fromEntries(ACTIONS.map(a => [a.id, a]));
const GROUPS: Array<ActionDef['group']> = ['Files', 'Notify', 'Logic'];

/* ── pipeline model ── */

interface StepModel {
  nodeId: string;
  actionId: string;
  label: string;
  config: Record<string, string>;
}

interface TriggerModel {
  enabled: boolean;         // on.file-upload
  pattern: string;          // e.g. "*.jpg"
}

/* ── YAML generation / parsing (engine-exact) ── */

function yamlSafe(v: string): string {
  if (/^[\w .\-/@]+$/.test(v) && !v.includes(': ') && v.trim() !== '') return v;
  return JSON.stringify(v);
}

function buildYaml(name: string, desc: string, trig: TriggerModel, steps: StepModel[]): string {
  const L: string[] = [];
  L.push(`name: ${yamlSafe(name || 'untitled-pipeline')}`);
  if (desc) L.push(`description: '${desc.replace(/'/g, "''")}'`);
  L.push(`on:`);
  L.push(`  manual: true`);
  if (trig.enabled) L.push(`  file-upload: ${yamlSafe(trig.pattern || '**/*')}`);
  L.push(`jobs:`);
  L.push(`  main:`);
  L.push(`    name: Main`);
  L.push(`    steps:`);
  if (steps.length === 0) L.push(`      - name: placeholder\n        action: squidcloud/log\n        with:\n          message: "no steps"`);
  steps.forEach((st, i) => {
    const def = ACTION_BY_ID[st.actionId];
    L.push(`      - name: ${yamlSafe(st.label || def?.title || `step-${i + 1}`)}`);
    L.push(`        action: ${def?.action ?? 'squidcloud/log'}`);
    const entries = Object.entries(st.config).filter(([, v]) => v !== '' && v != null);
    if (entries.length) {
      L.push(`        with:`);
      entries.forEach(([k, v]) => L.push(`          ${k}: ${yamlSafe(v)}`));
    }
  });
  return L.join('\n');
}

/** Parse engine-format YAML back into the model (best effort). */
function parseYaml(yaml: string): { name: string; desc: string; trig: TriggerModel; steps: StepModel[] } {
  const lines = yaml.split('\n');
  let name = '', desc = '';
  const trig: TriggerModel = { enabled: false, pattern: '**/*' };
  const steps: StepModel[] = [];
  let inOn = false;
  let cur: StepModel | null = null;
  let inWith = false;

  const idFor = (actionRef: string): string => {
    const found = ACTIONS.find(a => a.action === actionRef);
    return found?.id ?? 'log';
  };

  for (const raw of lines) {
    const line = raw.replace(/\t/g, '  ');
    const top = line.match(/^(name|description|on|jobs):\s*(.*)$/);
    if (top && !line.startsWith(' ')) {
      inOn = top[1] === 'on';
      if (top[1] === 'name') name = top[2].trim();
      if (top[1] === 'description') desc = top[2].replace(/^['"]|['"]$/g, '').trim();
      continue;
    }
    if (inOn) {
      const t = line.match(/^ {2}([\w-]+):\s*(.*)$/);
      if (t) {
        if (t[1] === 'manual') continue;
        // any other key (file-upload, http-request…) = upload watcher
        trig.enabled = true;
        const val = t[2].trim().replace(/^['"]|['"]$/g, '');
        trig.pattern = val && val !== 'true' ? val : '**/*';
      }
      continue;
    }
    const stepM = line.match(/^ {6}- name:\s*(.*)$/);
    if (stepM) {
      cur = { nodeId: `n${steps.length + 1}-${Math.random().toString(36).slice(2, 7)}`,
              actionId: 'log', label: stepM[1].trim(), config: {} };
      steps.push(cur);
      inWith = false;
      continue;
    }
    const actM = line.match(/^ {8}action:\s*(\S+)/);
    if (actM && cur) { cur.actionId = idFor(actM[1]); cur.label = cur.label || ACTION_BY_ID[cur.actionId]?.title || ''; continue; }
    if (line.match(/^ {8}with:/) && cur) { inWith = true; continue; }
    if (inWith && cur) {
      const kv = line.match(/^ {10}([\w_]+):\s*(.*)$/);
      if (kv) cur.config[kv[1]] = kv[2].replace(/^["']|["']$/g, '').replace(/\|-\s*$/, '').trim();
      else if (!line.startsWith(' ')) inWith = false;
    }
  }
  return { name, desc, trig, steps };
}

/* ────────────────────────────────────────────────────────────────
   Custom node
──────────────────────────────────────────────────────────────── */

type StepNodeData = { step: StepModel; selected: boolean };

function StepNode({ data }: NodeProps<StepNodeData>) {
  const def = ACTION_BY_ID[data.step.actionId];
  const chips = Object.entries(data.step.config).slice(0, 3);
  return (
    <div className={cn(
      'w-[240px] rounded-[10px] border bg-card shadow-sm transition-shadow',
      data.selected ? 'border-foreground/60 shadow-md' : 'border-border/70 hover:border-foreground/25'
    )}>
      <Handle type="target" position={Position.Top} className="!h-2.5 !w-2.5 !border-2 !border-background !bg-neutral-500" />
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/60 shrink-0">
          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <span className="text-[13px] font-medium text-foreground truncate flex-1">
          {data.step.label || def?.title || 'Step'}
        </span>
      </div>
      <div className="px-3 pb-2.5 space-y-1">
        <p className="font-mono text-[10px] text-muted-foreground truncate">{def?.action}</p>
        {chips.map(([k, v]) => (
          <p key={k} className="text-[10.5px] text-muted-foreground/80 truncate">
            <span className="text-neutral-500">{k}:</span> {String(v)}
          </p>
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2.5 !w-2.5 !border-2 !border-background !bg-neutral-500" />
    </div>
  );
}

const nodeTypes: NodeTypes = { stepNode: StepNode };

/* ────────────────────────────────────────────────────────────────
   Editor page
──────────────────────────────────────────────────────────────── */

const ScriptEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = !!id;

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [trig, setTrig] = useState<TriggerModel>({ enabled: false, pattern: '**/*' });
  const [steps, setSteps] = useState<StepModel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteGroup, setPaletteGroup] = useState<string>('All');

  const rfWrapper = useRef<HTMLDivElement>(null);

  /* layout helper: vertical chain positions */
  const layout = useCallback((models: StepModel[]) => {
    const nodes: Node[] = models.map((st, i) => ({
      id: st.nodeId,
      type: 'stepNode',
      position: { x: 0, y: i * 130 },
      data: { step: st, selected: false } as unknown as Record<string, unknown>,
      draggable: true,
    }));
    const edges: Edge[] = [];
    for (let i = 0; i < models.length - 1; i++) {
      edges.push({
        id: `e-${models[i].nodeId}->${models[i + 1].nodeId}`,
        source: models[i].nodeId, target: models[i + 1].nodeId,
        animated: false,
        style: { stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1.5 },
      });
    }
    return { nodes, edges };
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const selectedStep = steps.find(s => s.nodeId === selectedId) ?? null;

  const syncGraph = useCallback((models: StepModel[], keepPositions = false) => {
    setSteps(models);
    const prevPos = new Map(nodesRef.current.map(n => [n.id, n.position]));
    const { nodes: n, edges: e } = layout(models);
    const merged = n.map(nd => keepPositions && prevPos.has(nd.id) ? { ...nd, position: prevPos.get(nd.id)! } : nd);
    setNodes(merged);
    setEdges(e);
  }, [layout, setNodes, setEdges]);

  // ref mirror so syncGraph can read latest positions without dep loops
  const nodesRef = useRef<Node[]>([]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  /* load existing */
  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      try {
        const { script } = await getScript(id!);
        setName(script.name);
        setDesc(script.description || '');
        const parsed = parseYaml(script.yaml_content || '');
        setTrig(parsed.trig);
        syncGraph(parsed.steps);
      } catch (e: any) {
        toast({ title: 'Failed to load pipeline', description: e.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* mutations */
  const addStep = (actionId: string) => {
    const st: StepModel = {
      nodeId: `n${Date.now().toString(36)}${Math.floor(Math.random() * 999)}`,
      actionId, label: ACTION_BY_ID[actionId].title,
      config: {},
    };
    syncGraph([...steps, st]);
    setSelectedId(st.nodeId);
  };

  const updateSelected = (patch: Partial<StepModel>) => {
    if (!selectedId) return;
    const next = steps.map(s => s.nodeId === selectedId ? { ...s, ...patch } : s);
    syncGraph(next, true);
  };

  const updateConfig = (key: string, value: string) => {
    if (!selectedId) return;
    const next = steps.map(s =>
      s.nodeId === selectedId ? { ...s, config: { ...s.config, [key]: value } } : s);
    setSteps(next); // config-only: no relayout needed, node reads from model
    setNodes(ns => ns.map(n => n.id === selectedId
      ? { ...n, data: { ...n.data, step: next.find(x => x.nodeId === selectedId) } } : n));
  };

  const removeSelected = () => {
    if (!selectedId) return;
    syncGraph(steps.filter(s => s.nodeId !== selectedId));
    setSelectedId(null);
  };

  const moveSelected = (dir: -1 | 1) => {
    const idx = steps.findIndex(s => s.nodeId === selectedId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[idx], next[j]] = [next[j], next[idx]];
    syncGraph(next);
  };

  /* persistence */
  const yamlNow = () => buildYaml(name, desc, trig, steps);

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    if (steps.length === 0) { toast({ title: 'Add at least one step', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const yaml = yamlNow();
      if (isEditing) {
        await updateScript(id!, { name: name.trim(), description: desc, yamlContent: yaml });
        toast({ title: 'Pipeline saved' });
      } else {
        const { script } = await createScript({ name: name.trim(), description: desc, yamlContent: yaml });
        toast({ title: 'Pipeline created' });
        navigate(`/scripts/${script.id}/edit`, { replace: true });
      }
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    if (!isEditing) { toast({ title: 'Save the pipeline first', variant: 'destructive' }); return; }
    setRunning(true);
    try {
      await handleSave();
      const { run } = await triggerRun(id!);
      toast({ title: 'Run finished', description: `Status: ${(run as any).status}` });
    } catch (e: any) {
      toast({ title: 'Run failed', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing) return;
    try {
      await deleteScript(id!);
      toast({ title: 'Pipeline deleted' });
      navigate('/scripts');
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  /* palette filtering */
  const filteredActions = ACTIONS.filter(a =>
    (paletteGroup === 'All' || a.group === paletteGroup) &&
    (a.title.toLowerCase().includes(paletteQuery.toLowerCase()) ||
     a.desc.toLowerCase().includes(paletteQuery.toLowerCase())));

  /* ── render ── */
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 h-12 shrink-0">
        <button
          onClick={() => navigate('/scripts')}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Back to pipelines"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled pipeline"
          className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold tracking-tight outline-none placeholder:text-neutral-600"
        />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCode(v => !v)}
            title="View generated YAML"
            className={cn('inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] transition-colors',
              showCode ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
          >
            <FileCode className="h-3.5 w-3.5" /> YAML
          </button>
          {isEditing && (
            <>
              <button
                onClick={handleRun}
                disabled={running}
                title="Save & run"
                className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 transition-colors"
              >
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run
              </button>
              <button
                onClick={handleDelete}
                title="Delete pipeline"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12px] font-medium text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Palette */}
        {!showCode && (
          <aside className="w-[240px] shrink-0 border-r border-border/60 flex flex-col">
            <div className="p-2.5 space-y-2 border-b border-border/40">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-600" />
                <input
                  value={paletteQuery}
                  onChange={(e) => setPaletteQuery(e.target.value)}
                  placeholder="Search actions"
                  className="w-full h-8 rounded-md border border-border/60 bg-card pl-7 pr-2 text-[12px] outline-none focus:border-foreground/30"
                />
              </div>
              <div className="flex gap-1">
                {['All', ...GROUPS].map(g => (
                  <button key={g}
                    onClick={() => setPaletteGroup(g)}
                    className={cn('h-6 px-2 rounded text-[11px] transition-colors',
                      paletteGroup === g ? 'bg-white/[0.09] text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent')}
                  >{g}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredActions.map(a => (
                <button
                  key={a.id}
                  onClick={() => addStep(a.id)}
                  className="group w-full rounded-md px-2.5 py-2 text-left hover:bg-accent/50 transition-colors outline-none"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="h-3 w-3 text-neutral-600 group-hover:text-foreground" />
                    <span className="text-[12.5px] font-medium text-foreground">{a.title}</span>
                  </div>
                  <p className="pl-5 text-[11px] text-muted-foreground leading-snug">{a.desc}</p>
                </button>
              ))}
              {filteredActions.length === 0 && (
                <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">No matching actions</p>
              )}
            </div>
          </aside>
        )}

        {/* Canvas / code */}
        <div ref={rfWrapper} className="relative min-w-0 flex-1">
          {showCode ? (
            <pre className="h-full overflow-auto p-4 font-mono text-[11.5px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {yamlNow()}
            </pre>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onNodeClick={(_, n) => setSelectedId(n.id)}
              onPaneClick={() => setSelectedId(null)}
              fitView
              proOptions={{ hideAttribution: true }}
              defaultViewport={{ x: 120, y: 40, zoom: 0.95 }}
            >
              <Background color="#26262a" gap={18} size={1} />
              <Controls showInteractive={false} position="bottom-right"
                className="!rounded-md !border !border-border !bg-card [&_button]:!bg-card [&_button]:!border-border [&_button]:!fill-foreground" />
            </ReactFlow>
          )}

          {/* Inspector overlay */}
          {!showCode && selectedStep && (
            <aside className="absolute right-3 top-3 bottom-3 w-[280px] rounded-lg border border-border/60 bg-card/95 backdrop-blur-sm flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 h-10 border-b border-border/50">
                <span className="text-[12px] font-semibold text-foreground">Step settings</span>
                <button onClick={() => setSelectedId(null)}
                  className="h-6 w-6 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5 mx-auto" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Label</label>
                  <input
                    value={selectedStep.label}
                    onChange={(e) => updateSelected({ label: e.target.value })}
                    className="mt-1 w-full h-8 rounded-md border border-border/60 bg-background px-2.5 text-[13px] outline-none focus:border-foreground/30"
                  />
                </div>

                {(() => {
                  const def = ACTION_BY_ID[selectedStep.actionId];
                  if (!def?.fields?.length) return (
                    <p className="text-[11px] text-muted-foreground">No settings for this step.</p>
                  );
                  return def.fields.map(f => (
                    <div key={f.key}>
                      <label className="text-[11px] font-medium text-muted-foreground">
                        {f.label}{f.required && <span className="text-red-400"> *</span>}
                      </label>
                      {f.type === 'textarea' ? (
                        <textarea
                          rows={3}
                          value={selectedStep.config[f.key] ?? ''}
                          onChange={(e) => updateConfig(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          className="mt-1 w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-[13px] outline-none focus:border-foreground/30 resize-y"
                        />
                      ) : (
                        <input
                          value={selectedStep.config[f.key] ?? ''}
                          onChange={(e) => updateConfig(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          className="mt-1 w-full h-8 rounded-md border border-border/60 bg-background px-2.5 text-[13px] outline-none focus:border-foreground/30"
                        />
                      )}
                    </div>
                  ));
                })()}

                <div className="pt-1 flex items-center gap-1.5">
                  <button onClick={() => moveSelected(-1)}
                    disabled={steps.findIndex(s => s.nodeId === selectedId) <= 0}
                    className="flex-1 h-7 rounded-md border border-border/60 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 transition-colors">
                    Move up
                  </button>
                  <button onClick={() => moveSelected(1)}
                    disabled={steps.findIndex(s => s.nodeId === selectedId) >= steps.length - 1}
                    className="flex-1 h-7 rounded-md border border-border/60 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 transition-colors">
                    Move down
                  </button>
                  <button onClick={removeSelected}
                    title="Delete step"
                    className="h-7 w-7 rounded-md border border-border/60 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5 mx-auto" />
                  </button>
                </div>
              </div>
            </aside>
          )}

          {/* Trigger strip (always visible over canvas) */}
          {!showCode && (
            <div className="absolute left-3 top-3 z-10 rounded-lg border border-border/60 bg-card/95 backdrop-blur-sm px-3 py-2.5 w-[240px]">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[12px] font-semibold">When a file is uploaded</span>
              </div>
              <div className="space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[11.5px] text-muted-foreground">Enabled</span>
                  <button
                    role="switch"
                    aria-checked={trig.enabled}
                    onClick={() => setTrig(t => ({ ...t, enabled: !t.enabled }))}
                    className={cn('relative h-4.5 w-8 h-[18px] w-[32px] rounded-full transition-colors',
                      trig.enabled ? 'bg-foreground' : 'bg-neutral-700')}
                  >
                    <span className={cn('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all',
                      trig.enabled ? 'left-[16px]' : 'left-[2px]')} />
                  </button>
                </label>
                {trig.enabled && (
                  <input
                    value={trig.pattern}
                    onChange={(e) => setTrig(t => ({ ...t, pattern: e.target.value }))}
                    placeholder="*.jpg"
                    className="w-full h-7 rounded-md border border-border/60 bg-background px-2 text-[12px] font-mono outline-none focus:border-foreground/30"
                  />
                )}
                <p className="text-[10px] text-muted-foreground/70 leading-snug">
                  Runs automatically whenever a matching file finishes uploading.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScriptEditor;
