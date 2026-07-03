import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type NodeTypes,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ComponentDefinition, COMPONENT_CATEGORIES, getComponentsByCategory, getComponent, componentCount } from '@/lib/component-registry';
import { ALL_VARIABLES, searchVariables } from '@/lib/variable-registry';
import { VisualStep, yamlFromSteps } from '@/lib/yaml-sync';
import { X, Plus, Search, ChevronDown, ChevronRight, GripVertical, Zap, FileCode, Trash2, Copy, Wand2, RefreshCw } from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PipelineCanvasProps {
  initialSteps?: VisualStep[];
  showComponents?: boolean;
  onYamlChange?: (yaml: string) => void;
}

export interface PipelineNodeData {
  componentId: string;
  label: string;
  config: Record<string, unknown>;
  expandedSubComponents: Record<string, boolean>;
  _comp: ComponentDefinition;
}

const PipelineNode = ({ data, selected }: { data: PipelineNodeData; selected?: boolean }) => {
  const comp = data._comp;
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>(data.expandedSubComponents || {});

  if (!comp) return null;

  const toggleSub = (id: string) => {
    setExpandedSubs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={cn(
      'min-w-[220px] rounded-xl border bg-card shadow-lg transition-shadow',
      selected ? 'ring-2 ring-primary shadow-xl' : 'border-border/50 hover:shadow-xl',
    )}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/20 rounded-t-xl bg-gradient-to-r from-card to-muted/10" style={{ borderLeft: `3px solid ${comp.color}` }}>
        <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-[3px] !border-primary !bg-card !shadow-sm" />
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 cursor-grab shrink-0" />
        <span className="text-xs font-semibold text-foreground flex-1 truncate">{data.label || comp.name}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono" style={{ backgroundColor: comp.color + '20', color: comp.color }}>{comp.category}</span>
        <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-[3px] !border-primary !bg-card !shadow-sm" />
      </div>

      <div className="px-3 py-2 space-y-1">
        {comp.configFields.map(f => {
          const val = data.config?.[f.name];
          return (
            <div key={f.name} className="flex items-center gap-2 text-[11px]">
              <span className="text-muted-foreground w-20 truncate shrink-0">{f.label}</span>
              <span className="text-foreground truncate font-mono bg-muted/20 px-1.5 py-0.5 rounded flex-1">
                {val !== undefined ? String(val) : <span className="text-muted-foreground/40 italic">not set</span>}
              </span>
            </div>
          );
        })}
      </div>

      {comp.subTypes && comp.subTypes.length > 0 && (
        <div className="border-t border-border/10">
          {comp.subTypes.map(st => {
            const expanded = expandedSubs[st.id] || false;
            return (
              <div key={st.id}>
                <button onClick={() => toggleSub(st.id)} className="flex items-center gap-2 w-full px-3 py-2 text-[11px] hover:bg-muted/10 transition-colors">
                  {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: comp.color }} />
                  <span className="font-medium text-foreground">{st.name}</span>
                  <span className="text-muted-foreground/50 ml-auto">{st.configFields?.length || 0} fields</span>
                </button>
                {expanded && (
                  <div className="px-4 pb-2 space-y-1.5 bg-muted/5">
                    {st.configFields?.map(f => {
                      const val = data.config?.[`${st.id}.${f.name}`] ?? f.default;
                      return (
                        <div key={f.name} className="flex items-center gap-2 text-[10px]">
                          <span className="text-muted-foreground w-16 truncate shrink-0">{f.label}</span>
                          {f.type === 'select' ? (
                            <select value={String(val ?? '')} onChange={() => {}}
                              className="flex-1 h-6 rounded border border-border/30 bg-card text-[10px] px-1 outline-none focus:border-primary/50">
                              {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : f.type === 'boolean' ? (
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={!!val} onChange={() => {}} className="rounded" />
                            </label>
                          ) : (
                            <input defaultValue={String(val ?? '')} placeholder={f.placeholder || f.label}
                              className="flex-1 h-6 rounded border border-border/30 bg-card text-[10px] px-1.5 outline-none focus:border-primary/50" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border/10 bg-muted/5 rounded-b-xl relative">
        {comp.inputs.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {comp.inputs.map(i => (
              <span key={i.name} className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-mono">{i.name}</span>
            ))}
          </div>
        )}
        {comp.outputs.length > 0 && (
          <div className="flex items-center gap-1 ml-auto flex-wrap">
            {comp.outputs.map(o => (
              <span key={o.name} className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 font-mono">{o.name}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const nodeTypes: NodeTypes = { pipeline: PipelineNode };

const CATEGORY_ICONS: Record<string, string> = {
  triggers: '\u26A1', file_ops: '\u{1F4C4}', data: '\u{1F4CA}',
  network: '\u{1F310}', security: '\u{1F512}', ai_ml: '\u{1F916}',
  media: '\u{1F3AC}', notifications: '\u{1F514}', control_flow: '\u{1F504}',
  utilities: '\u{1F527}', storage: '\u{1F4BE}', system: '\u{1F4BB}',
};

const ComponentPalette: React.FC<{ onAddNode: (comp: ComponentDefinition) => void }> = ({ onAddNode }) => {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const cats = COMPONENT_CATEGORIES.filter(c => c.id !== 'database' && c.id !== 'cloud');
    if (!search) return cats.map(cat => ({ ...cat, components: getComponentsByCategory(cat.id) }));
    const q = search.toLowerCase();
    return cats.map(cat => ({
      ...cat,
      components: getComponentsByCategory(cat.id).filter(c =>
        c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q)
      ),
    })).filter(g => g.components.length > 0);
  }, [search]);

  return (
    <div className="flex flex-col h-full">
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search..." className="w-full h-8 pl-8 pr-3 rounded-lg border border-border/40 bg-muted/20 text-xs outline-none focus:border-primary/50" />
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
        {filtered.map(cat => (
          <div key={cat.id}>
            <button onClick={() => setCollapsed(p => ({ ...p, [cat.id]: !p[cat.id] }))}
              className="flex items-center gap-1.5 w-full text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-1.5 px-1.5 rounded-md hover:bg-muted/20">
              {collapsed[cat.id] ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span className="text-xs">{CATEGORY_ICONS[cat.id] || '\u{1F9F0}'}</span>
              {cat.name}
              <span className="text-[10px] text-muted-foreground/40 font-normal lowercase ml-auto">{cat.components.length}</span>
            </button>
            {!collapsed[cat.id] && cat.components.map(comp => (
              <div key={comp.id} onClick={() => onAddNode(comp)} draggable
                onDragStart={e => { e.dataTransfer.setData('component', comp.id); }}
                className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/20 cursor-grab active:cursor-grabbing transition-colors text-[12px]"
              >
                <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: comp.color + '20' }}>
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: comp.color }} />
                </div>
                <span className="text-foreground truncate flex-1">{comp.name}</span>
                <Plus className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-border/20 mt-2 text-[10px] text-muted-foreground/50 text-center">
        {componentCount()} components &middot; {ALL_VARIABLES.length} variables
      </div>
    </div>
  );
};

const VariableSidebar: React.FC<{ onInsert: (token: string) => void }> = ({ onInsert }) => {
  const [search, setSearch] = useState('');
  const results = useMemo(() => searchVariables(search), [search]);

  return (
    <div className="flex flex-col h-full">
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search variables..." className="w-full h-8 pl-8 pr-3 rounded-lg border border-border/40 bg-muted/20 text-xs outline-none focus:border-primary/50" />
      </div>
      <div className="flex-1 overflow-y-auto space-y-0.5 scrollbar-thin">
        {results.map(v => (
          <div key={v.token} onClick={() => onInsert(v.token)}
            className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/20 cursor-pointer transition-colors"
          >
            <div className="flex-1 min-w-0">
              <code className="text-[11px] font-mono text-primary truncate block">{`\$\{{ ${v.token} }}`}</code>
              <span className="text-[10px] text-muted-foreground truncate block">{v.label} &middot; {v.category}</span>
            </div>
            <Copy className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 shrink-0" />
          </div>
        ))}
        {results.length === 0 && (
          <div className="text-xs text-muted-foreground/50 text-center py-8">No variables match</div>
        )}
      </div>
    </div>
  );
};

const CanvasInner: React.FC<PipelineCanvasProps> = ({ initialSteps, showComponents = true, onYamlChange }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showPalette, setShowPalette] = useState(showComponents);
  const [showVariables, setShowVariables] = useState(false);
  const { screenToFlowPosition } = useReactFlow();
  const { toast } = useToast();
  const nRef = useRef(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialSteps && initialSteps.length > 0 && !initialized.current) {
      initialized.current = true;
      const newNodes: Node[] = initialSteps.map((step, i) => ({
        id: step.id,
        type: 'pipeline',
        position: { x: 50 + i * 280, y: 100 + Math.sin(i) * 60 },
        data: { componentId: step.componentId, label: step.label, config: step.config, expandedSubComponents: {}, _comp: getComponent(step.componentId) },
      }));
      setNodes(newNodes);
      nRef.current = initialSteps.length;
    }
  }, [initialSteps]);

  useEffect(() => {
    const steps: VisualStep[] = nodes.map(n => ({
      id: n.id,
      componentId: n.data.componentId,
      label: n.data.label,
      config: n.data.config as Record<string, unknown>,
      subTypes: [],
    }));
    const yaml = yamlFromSteps(steps);
    if (nodes.length > 0 && onYamlChange) {
      onYamlChange(yaml);
    }
  }, [nodes, onYamlChange]);

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge({
      ...params, animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
    }, eds));
  }, [setEdges]);

  const addNode = useCallback((comp: ComponentDefinition) => {
    nRef.current += 1;
    const node: Node = {
      id: `${comp.id}-${nRef.current}`,
      type: 'pipeline',
      position: { x: 80 + Math.random() * 200, y: 80 + Math.random() * 150 },
      data: { componentId: comp.id, label: comp.name, config: { ...comp.defaultConfig }, expandedSubComponents: {}, _comp: comp },
    };
    setNodes(nds => [...nds, node]);
    toast({ title: `Added ${comp.name}`, description: `Drag to reposition` });
  }, [setNodes, toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const compId = e.dataTransfer.getData('component');
    if (!compId) return;
    const comp = getComponent(compId);
    if (!comp) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    nRef.current += 1;
    const node: Node = {
      id: `${comp.id}-${nRef.current}`, type: 'pipeline', position: pos,
      data: { componentId: comp.id, label: comp.name, config: { ...comp.defaultConfig }, expandedSubComponents: {}, _comp: comp },
    };
    setNodes(nds => [...nds, node]);
  }, [screenToFlowPosition, setNodes]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);

  const clearAll = () => { setNodes([]); setEdges([]); initialized.current = false; };

  return (
    <div className="flex flex-1 min-h-0 w-full">
      {showPalette && (
        <div className="w-64 shrink-0 border-r border-border/20 bg-card/50 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/20 bg-gradient-to-r from-primary/5 to-transparent">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary" /> Components
            </span>
            <button onClick={() => setShowPalette(false)} className="p-0.5 rounded hover:bg-muted/30 text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden p-2">
            <ComponentPalette onAddNode={addNode} />
          </div>
        </div>
      )}

      <div className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
          defaultEdgeOptions={{ animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } }}
          connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2 }}
          minZoom={0.2}
        >
          <Background color="#6366f1" gap={20} size={1} />
          <Controls showInteractive={false} className="!border-border/20 !rounded-lg !shadow-sm !bg-card" />
          <MiniMap nodeStrokeColor="#6366f1" nodeColor="#1e293b" nodeBorderRadius={8} className="!border-border/20 !rounded-lg !shadow-sm !bg-card" />
        </ReactFlow>

        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
          {!showPalette && (
            <button onClick={() => setShowPalette(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-card/90 border border-border/40 text-xs font-medium text-foreground hover:bg-accent shadow-md backdrop-blur-sm">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          )}
          <button onClick={() => setShowVariables(!showVariables)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-card/90 border border-border/40 text-xs font-medium text-foreground hover:bg-accent shadow-md backdrop-blur-sm">
            <FileCode className="w-3.5 h-3.5" /> Variables
          </button>
          <button onClick={clearAll}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-card/90 border border-border/40 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 shadow-md backdrop-blur-sm">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
          <span className="ml-2 text-[10px] text-muted-foreground/40 bg-card/60 px-2 py-1 rounded-md border border-border/20">
            {nodes.length} node{nodes.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {showVariables && (
        <div className="w-64 shrink-0 border-l border-border/20 bg-card/50 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/20 bg-gradient-to-r from-transparent to-primary/5">
            <span className="text-xs font-semibold text-foreground">Variables</span>
            <button onClick={() => setShowVariables(false)} className="p-0.5 rounded hover:bg-muted/30 text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden p-2">
            <VariableSidebar onInsert={(token) => {
              navigator.clipboard.writeText(`\$\{{ ${token} }}`).catch(() => {});
              toast({ title: 'Copied', description: `\$\{{ ${token} }}` });
            }} />
          </div>
        </div>
      )}
    </div>
  );
};

const PipelineCanvas: React.FC<PipelineCanvasProps> = (props) => (
  <ReactFlowProvider>
    <CanvasInner {...props} />
  </ReactFlowProvider>
);

export default PipelineCanvas;
