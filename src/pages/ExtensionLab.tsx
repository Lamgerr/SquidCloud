import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { GlassNav, type GlassNavItem } from '@/components/layout/GlassNav';
import { PageFrame } from '@/components/layout/PageFrame';
import {
  Package, Download, Star, Search, Plus, Sparkles, Code,
} from '@/lib/icon-map';
import { useToast } from '@/hooks/use-toast';

interface Extension {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  downloads: number;
  rating: number;
  total_ratings: number;
  category: string;
  icon_url?: string;
  is_verified: boolean;
}

const EX_CSS = `
.ex-tabs [role="tabpanel"]{margin-top:0!important}
.ex-search{position:relative;max-width:420px;margin:0 auto 20px}
.ex-search>svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);
  width:16px;height:16px;color:var(--sa-mute,#8d8f89)}
.ex-input{width:100%;height:38px;padding:0 12px 0 36px;
  border:1px solid var(--sa-line,#1f2221);border-radius:8px;
  background:var(--sa-bg-2,#0e1110);color:var(--sa-text,#e8e7e1);
  font:400 12px/1 var(--sa-f,-apple-system,sans-serif)}
.ex-input::placeholder{color:var(--sa-dim,#62655f)}
.ex-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media(max-width:900px){.ex-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.ex-grid{grid-template-columns:1fr}}
.ex-card{padding:16px;border:1px solid var(--sa-line,#1f2221);border-radius:12px;
  background:var(--sa-bg,#090b0a)}
.ex-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.ex-who{display:flex;align-items:center;gap:10px;min-width:0}
.ex-icon{display:grid;place-items:center;width:36px;height:36px;flex:none;
  border:1px solid var(--sa-line,#1f2221);border-radius:8px;color:var(--sa-text,#e8e7e1);overflow:hidden}
.ex-icon svg{width:16px;height:16px}
.ex-icon img{width:36px;height:36px;object-fit:cover}
.ex-name{display:flex;align-items:center;gap:6px;margin:0;
  font-size:13px;font-weight:400;color:var(--sa-text,#e8e7e1)}
.ex-name svg{width:14px;height:14px;color:var(--sa-mute,#8d8f89)}
.ex-author{margin:2px 0 0;font-size:11px;color:var(--sa-dim,#62655f)}
.ex-badge{border:1px solid var(--sa-line,#1f2221)!important;
  background:var(--sa-bg-2,#0e1110)!important;color:var(--sa-mute,#8d8f89)!important;
  font:400 10px/1.4 var(--sa-f,-apple-system,sans-serif)!important;
  border-radius:6px!important;padding:2px 6px!important;text-transform:none!important}
.ex-desc{margin:16px 0;font-size:11px;line-height:1.6;color:var(--sa-mute,#8d8f89)}
.ex-stats{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:16px}
.ex-stats-left{display:flex;align-items:center;gap:14px;font-size:11px;color:var(--sa-dim,#62655f)}
.ex-stats-left span{display:flex;align-items:center;gap:5px}
.ex-stats-left svg{width:13px;height:13px;color:var(--sa-mute,#8d8f89)}
.ex-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;
  width:100%;height:34px;border:1px solid var(--sa-line,#1f2221);border-radius:8px;
  background:var(--sa-bg-2,#0e1110);color:var(--sa-text,#e8e7e1);
  font:400 12px/1 var(--sa-f,-apple-system,sans-serif);cursor:pointer}
.ex-btn:hover{background:var(--sa-bg-3,#141816)}
.ex-btn svg{width:14px;height:14px}
`;

export default function ExtensionLab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [installedExtensions, setInstalledExtensions] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    loadExtensions();
    loadInstalledExtensions();
  }, []);

  const loadExtensions = async () => {
    try {
      const { data, error } = await supabase
        .from('extensions')
        .select('*')
        .eq('approval', 'approved')
        .eq('is_active', true)
        .order('downloads', { ascending: false });

      if (error) throw error;
      setExtensions(data || []);
    } catch (error) {
      console.error('Error loading extensions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load extensions',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadInstalledExtensions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('installed_extensions')
        .select('extension_id')
        .eq('user_id', user.id);

      if (error) throw error;
      setInstalledExtensions(data?.map(e => e.extension_id) || []);
    } catch (error) {
      console.error('Error loading installed extensions:', error);
    }
  };

  const installExtension = async (extensionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('installed_extensions')
        .insert({
          user_id: user.id,
          extension_id: extensionId,
          is_enabled: true
        });

      if (error) throw error;

      setInstalledExtensions([...installedExtensions, extensionId]);

      toast({
        title: 'Extension Installed',
        description: 'Extension has been successfully installed'
      });

      await loadExtensions();
    } catch (error) {
      console.error('Error installing extension:', error);
      toast({
        title: 'Installation Failed',
        description: 'Failed to install extension',
        variant: 'destructive'
      });
    }
  };

  const uninstallExtension = async (extensionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('installed_extensions')
        .delete()
        .eq('user_id', user.id)
        .eq('extension_id', extensionId);

      if (error) throw error;

      setInstalledExtensions(installedExtensions.filter(id => id !== extensionId));

      toast({
        title: 'Extension Uninstalled',
        description: 'Extension has been removed'
      });
    } catch (error) {
      console.error('Error uninstalling extension:', error);
      toast({
        title: 'Uninstall Failed',
        description: 'Failed to uninstall extension',
        variant: 'destructive'
      });
    }
  };

  const filteredExtensions = extensions.filter(ext =>
    ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ext.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = ['all', ...new Set(extensions.map(e => e.category))];

  const navItems: GlassNavItem[] = categories.map(cat => ({
    key: cat,
    label: cat,
    icon: cat === 'all' ? <Package /> : <Code />,
    active: activeCategory === cat,
    onClick: () => setActiveCategory(cat),
  }));

  return (
    <PageFrame
      title="Extension Lab"
      subtitle="Extend SquidCloud with powerful extensions."
      items={navItems}
      layoutId="extension-categories"
      wide
    >
      <style>{EX_CSS}</style>
      <div className="ex-search">
        <Search />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search extensions..."
          className="ex-input"
        />
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="ex-tabs">
        {categories.map(category => (
          <TabsContent key={category} value={category}>
            <div className="ex-grid">
              {filteredExtensions
                .filter(ext => category === 'all' || ext.category === category)
                .map(extension => {
                  const isInstalled = installedExtensions.includes(extension.id);

                  return (
                    <div key={extension.id} className="ex-card">
                      <div className="ex-head">
                        <div className="ex-who">
                          {extension.icon_url ? (
                            <div className="ex-icon"><img src={extension.icon_url} alt={extension.name} /></div>
                          ) : (
                            <div className="ex-icon"><Code /></div>
                          )}
                          <div>
                            <h3 className="ex-name">
                              {extension.name}
                              {extension.is_verified && <Sparkles />}
                            </h3>
                            <p className="ex-author">by {extension.author}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="ex-badge">v{extension.version}</Badge>
                      </div>

                      <p className="ex-desc">{extension.description}</p>

                      <div className="ex-stats">
                        <div className="ex-stats-left">
                          <span><Download />{extension.downloads}</span>
                          <span><Star />{extension.rating.toFixed(1)} ({extension.total_ratings})</span>
                        </div>
                        <Badge variant="outline" className="ex-badge">{extension.category}</Badge>
                      </div>

                      {isInstalled ? (
                        <button
                          onClick={() => uninstallExtension(extension.id)}
                          className="ex-btn"
                        >
                          Uninstall
                        </button>
                      ) : (
                        <button
                          onClick={() => installExtension(extension.id)}
                          className="ex-btn"
                        >
                          <Plus />
                          Install
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </PageFrame>
  );
}
