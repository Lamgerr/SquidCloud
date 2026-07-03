import React, { useState } from 'react';
import { SQUID_VARIABLES, SQUID_CATEGORIES } from '@/lib/squid-variables';
import { Search, Copy, Check, ChevronDown, ChevronRight } from '@/lib/icon-map';
import { cn } from '@/lib/utils';

interface Props {
  onInsert?: (token: string) => void;
}

const VariableReferencePanel: React.FC<Props> = ({ onInsert }) => {
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = SQUID_VARIABLES.filter(v =>
    !search || v.token.toLowerCase().includes(search.toLowerCase()) || v.label.toLowerCase().includes(search.toLowerCase()) || v.category.toLowerCase().includes(search.toLowerCase())
  );

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(`\${{ ${token} }}`);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  };

  const grouped = SQUID_CATEGORIES.map(cat => ({
    category: cat,
    vars: filtered.filter(v => v.category === cat),
  })).filter(g => g.vars.length > 0);

  return (
    <div className="flex flex-col h-full">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search variables..."
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/60 bg-muted/30 text-sm outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {grouped.map(({ category, vars }) => (
          <div key={category}>
            <button
              onClick={() => setCollapsed(p => ({ ...p, [category]: !p[category] }))}
              className="flex items-center gap-1.5 w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider py-1.5 px-1 rounded-md hover:bg-muted/20 transition-colors"
            >
              {collapsed[category] ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {category}
            </button>
            {!collapsed[category] && (
              <div className="space-y-0.5 mt-0.5">
                {vars.map(v => (
                  <div
                    key={v.token}
                    className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => {
                      if (onInsert) onInsert(v.token);
                      else copy(v.token);
                    }}
                    title={v.description}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-[12px] font-mono text-primary truncate">{`\$\{{ ${v.token} }}`}</code>
                        {copied === v.token && <Check className="w-3 h-3 text-green-500 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{v.label}</p>
                    </div>
                    <Copy className="w-3.5 h-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VariableReferencePanel;
