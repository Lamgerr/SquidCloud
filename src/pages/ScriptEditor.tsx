import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MonacoEditor from '@/components/MonacoEditor';
import PipelineCanvas from '@/components/pipeline/PipelineCanvas';
import { X, Save, Zap, FileCode, Grid, Zap as ZapIcon, Copy, Download, Wand2, Check, Eye, EyeOff, Book, Maximize, Minimize, LayoutTemplate } from '@/lib/icon-map';
import { createScript, updateScript, getScript } from '@/lib/automation-api';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { componentCount } from '@/lib/component-registry';
import { TOTAL_VARIABLES } from '@/lib/variable-registry';
import { yamlFromSteps, stepsFromYaml, VisualStep } from '@/lib/yaml-sync';
import { getTemplates, PipelineTemplate } from '@/lib/pipeline-templates';
import { cn } from '@/lib/utils';

const DEFAULT_YAML = `# SquidActions Pipeline
# Build visually or write YAML directly
name: my-pipeline
description: A SquidScript automation
on:
  manual: true
jobs:
  job-1:
    name: Example Job
    steps:
      - name: Print file info
        action: squidcloud/echo
        with:
          message: "Processing {{ squid.file.name }}"
`;

const ScriptEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();
  const isEditing = !!id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [yaml, setYaml] = useState(DEFAULT_YAML);
  const [saving, setSaving] = useState(false);
  const [showVisual, setShowVisual] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [visualSteps, setVisualSteps] = useState<VisualStep[]>([]);
  const syncLock = useRef(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { script } = await getScript(id);
        setName(script.name);
        setDescription(script.description || '');
        setYaml(script.yaml_content);
      } catch (e: any) {
        toast({ title: 'Failed to load pipeline', description: e.message, variant: 'destructive' });
        navigate('/scripts');
      }
    })();
  }, [id]);

  const handleYamlFromCanvas = useCallback((newYaml: string) => {
    if (syncLock.current) return;
    syncLock.current = true;
    setYaml(newYaml);
    setTimeout(() => { syncLock.current = false; }, 50);
  }, []);

  const switchToVisual = useCallback(() => {
    if (showVisual) return;
    const steps = stepsFromYaml(yaml);
    setVisualSteps(steps);
    setShowVisual(true);
  }, [yaml, showVisual]);

  const switchToYaml = useCallback(() => {
    if (!showVisual) return;
    const newYaml = yamlFromSteps(visualSteps.length > 0 ? visualSteps : stepsFromYaml(yaml), name, description);
    if (newYaml !== yaml) {
      setYaml(newYaml);
    }
    setShowVisual(false);
  }, [showVisual, visualSteps, yaml, name, description]);

  const applyTemplate = useCallback((tpl: PipelineTemplate) => {
    setName(tpl.name);
    setDescription(tpl.description);
    setYaml(tpl.yaml);
    setShowTemplates(false);
    if (!showVisual) setShowVisual(true);
    toast({ title: `Template loaded`, description: tpl.name });
  }, [toast, showVisual]);

  const handleCopyYaml = useCallback(async () => {
    const finalYaml = showVisual
      ? yamlFromSteps(visualSteps.length > 0 ? visualSteps : stepsFromYaml(yaml), name, description)
      : yaml;
    try {
      await navigator.clipboard.writeText(finalYaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied to clipboard' });
    } catch { toast({ title: 'Failed to copy', variant: 'destructive' }); }
  }, [yaml, showVisual, visualSteps, name, description, toast]);

  const handleDownloadYaml = useCallback(() => {
    const finalYaml = showVisual
      ? yamlFromSteps(visualSteps.length > 0 ? visualSteps : stepsFromYaml(yaml), name, description)
      : yaml;
    const blob = new Blob([finalYaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'pipeline'}.squid.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded YAML' });
  }, [yaml, showVisual, visualSteps, name, description, toast]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const finalYaml = showVisual
      ? yamlFromSteps(visualSteps.length > 0 ? visualSteps : stepsFromYaml(yaml), name, description)
      : yaml;
    try {
      const parsedConfig = { name, description };
      if (isEditing) {
        await updateScript(id!, { name, description, yamlContent: finalYaml, parsedConfig });
        toast({ title: 'Pipeline updated' });
      } else {
        const { script } = await createScript({ name, description, yamlContent: finalYaml, parsedConfig });
        toast({ title: 'Pipeline created' });
        navigate(`/scripts/${script.id}/edit`, { replace: true });
      }
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [id, name, description, yaml, visualSteps, showVisual, isEditing]);

  return (
    <div className={cn('flex flex-col', fullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-full')}>
      {/* ── Toolbar ───────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border/30 bg-gradient-to-r from-card via-card/95 to-card shadow-sm">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={() => navigate('/scripts')} className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors" title="Back">
            <X className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0 shadow-sm">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Pipeline name"
                className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 truncate" />
              {!name.trim() && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium">unnamed</span>
              )}
            </div>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Brief description (optional)"
              className="w-full bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/30 mt-0.5" />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="hidden md:flex items-center gap-3 mr-3 text-[11px] text-muted-foreground/60 border-r border-border/20 pr-4">
            <span className="flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-full"><ZapIcon className="w-3 h-3 text-primary" /> {componentCount()}</span>
            <span className="flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-full"><FileCode className="w-3 h-3 text-primary" /> {TOTAL_VARIABLES}</span>
          </div>

          <div className="flex items-center gap-1 bg-muted/20 rounded-lg p-0.5 border border-border/20">
            <button onClick={() => { if (!showVisual) switchToVisual(); }}
              className={cn("flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all",
                showVisual ? "bg-card text-primary shadow-sm border border-border/20" : "text-muted-foreground hover:text-foreground")}>
              <Grid className="w-3.5 h-3.5" /> Visual
            </button>
            <button onClick={() => { if (showVisual) switchToYaml(); }}
              className={cn("flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all",
                !showVisual ? "bg-card text-primary shadow-sm border border-border/20" : "text-muted-foreground hover:text-foreground")}>
              <FileCode className="w-3.5 h-3.5" /> YAML
            </button>
          </div>

          <div className="w-px h-5 bg-border/30 mx-1" />

          <button onClick={() => setShowTemplates(true)} className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-purple-600 hover:text-purple-500 hover:bg-purple-500/10 transition-colors" title="Load template">
            <Wand2 className="w-3.5 h-3.5" /> Templates
          </button>

          <div className="w-px h-5 bg-border/30 mx-1" />

          <button onClick={handleCopyYaml} className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors" title="Copy YAML">
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleDownloadYaml} className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors" title="Download YAML">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowSidebar(!showSidebar)} className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors" title="Toggle sidebar">
            {showSidebar ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setFullscreen(!fullscreen)} className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors" title="Fullscreen">
            {fullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>

          <div className="w-px h-5 bg-border/30 mx-1" />

          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 shadow-sm transition-all disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Split Editor ────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {showVisual ? (
          <>
            <div className={cn('min-h-0', showSidebar ? 'flex-1' : 'flex-1')}>
              <PipelineCanvas
                initialSteps={visualSteps.length > 0 ? visualSteps : undefined}
                showComponents={showSidebar}
                onYamlChange={handleYamlFromCanvas}
              />
            </div>
            {showSidebar && (
              <div className="w-80 shrink-0 border-l border-border/20 bg-card/30 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-primary" /> Tips
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[12px] text-muted-foreground">
                  <div className="space-y-1.5">
                    <p className="font-medium text-foreground text-xs">Getting Started</p>
                    <p>Click a component from the palette to add it to the canvas. Drag to reposition.</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-medium text-foreground text-xs">Connections</p>
                    <p>Drag from the blue dot on the right of a node to connect it to another node.</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-medium text-foreground text-xs">Variables</p>
                    <p>Use <code className="text-primary text-[11px] font-mono bg-primary/5 px-1 rounded">{'{{ squid.file.name }}'}</code> to reference dynamic values. Click Variables button above to browse.</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-medium text-foreground text-xs">Auto-YAML Sync</p>
                    <p>Every change you make visually is automatically reflected in YAML. Switch to the YAML tab to see the code.</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-medium text-foreground text-xs">Sub-Components</p>
                    <p>Click on any expandable section inside a node card to configure its sub-options.</p>
                  </div>
                  <div className="pt-2 border-t border-border/10">
                    <a href="/docs/squidactions-ai-skill.md" target="_blank"
                      className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors">
                      <Book className="w-3.5 h-3.5" /> AI Skill Docs
                    </a>
                  </div>
                  <div className="text-[10px] text-muted-foreground/30 pt-4 text-center">
                    Press <kbd className="px-1 py-0.5 rounded bg-muted/20 border border-border/30 font-mono">Ctrl+S</kbd> to save
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 min-h-0">
            <MonacoEditor
              value={yaml} language="yaml"
              theme={theme === 'dark' ? 'dark' : 'light'}
              onChange={setYaml}
              options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false, wordWrap: 'on' }}
            />
          </div>
        )}
      </div>

      {/* ── Template Gallery ─────────────────────── */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowTemplates(false)}>
          <div className="bg-card border border-border/40 rounded-2xl shadow-2xl w-[720px] max-w-[95vw] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/20">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-purple-500" /> Pipeline Templates
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Start with a pre-built template and customize</p>
              </div>
              <button onClick={() => setShowTemplates(false)} className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3">
              {getTemplates().map(tpl => {
                const diffColors = { beginner: 'text-green-500 bg-green-500/10', intermediate: 'text-amber-500 bg-amber-500/10', advanced: 'text-red-500 bg-red-500/10' };
                return (
                  <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                    className="flex flex-col items-start gap-2 p-4 rounded-xl border border-border/20 bg-card/50 hover:bg-accent hover:border-border/40 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: tpl.color + '20' }}>
                        {tpl.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tpl.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/20 text-muted-foreground">{tpl.category}</span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', diffColors[tpl.difficulty])}>{tpl.difficulty}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground/40 shrink-0">{tpl.steps} steps</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-2">{tpl.description}</p>
                  </button>
                );
              })}
            </div>
            <div className="px-6 py-3 border-t border-border/20 text-[11px] text-muted-foreground/50 text-center">
              {getTemplates().length} templates &middot; Click to load &middot; Customize freely after
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScriptEditor;
