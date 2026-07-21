import React, { useState, useEffect } from 'react';
import MobileSheet from '@/components/ui/MobileSheet';
import {
  Globe, ExternalLink, Eye, EyeOff, Trash2, Loader2,
} from '@/lib/icon-map';
import { listMyPublications, type SitePublication } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { usePublish } from '@/hooks/usePublish';
import { cn } from '@/lib/utils';

interface MobilePublishedSitesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MobilePublishedSitesManager: React.FC<MobilePublishedSitesManagerProps> = ({ open, onOpenChange }) => {
  const [sites, setSites] = useState<SitePublication[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [actionSlug, setActionSlug] = useState<string | null>(null);
  const { doToggleVisibility, doUnpublish } = usePublish();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setLoadingSites(true);
      listMyPublications()
        .then(setSites)
        .catch(() => toast({ title: 'Failed to load sites', variant: 'destructive' }))
        .finally(() => setLoadingSites(false));
    }
  }, [open]);

  const handleToggle = async (site: SitePublication) => {
    if (actionSlug) return;
    setActionSlug(site.site_slug);
    try {
      const newVis = site.visibility === 'public' ? 'private' : 'public';
      await doToggleVisibility(site.site_slug, newVis);
      setSites(prev => prev.map(s => s.id === site.id ? { ...s, visibility: newVis } : s));
      navigator.vibrate?.(30);
      toast({ title: newVis === 'public' ? 'Site is now public' : 'Site is now private' });
    } catch (e: any) {
      toast({ title: 'Failed to update visibility', description: e.message, variant: 'destructive' });
    } finally {
      setActionSlug(null);
    }
  };

  const handleUnpublish = async (site: SitePublication) => {
    if (actionSlug) return;
    setActionSlug(site.site_slug);
    try {
      await doUnpublish(site.site_slug);
      setSites(prev => prev.filter(s => s.id !== site.id));
      navigator.vibrate?.(30);
      toast({ title: `"${site.site_slug}" unpublished` });
    } catch (e: any) {
      toast({ title: 'Failed to unpublish', description: e.message, variant: 'destructive' });
    } finally {
      setActionSlug(null);
    }
  };

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-muted border border-border flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h3 className="text-[17px] font-semibold text-foreground">Published Sites</h3>
            <p className="text-[13px] text-muted-foreground mt-0.5">Manage your static websites</p>
          </div>
        </div>
      }
    >
      <div className="flex flex-col px-4 pt-3 pb-6 gap-3 max-h-[70vh] overflow-y-auto">
        {loadingSites && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loadingSites && sites.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center">
              <Globe className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <p className="text-[15px] text-muted-foreground">No published sites yet</p>
            <p className="text-[13px] text-muted-foreground/50">Publish an HTML file or folder to get started</p>
          </div>
        )}

        {sites.map(site => {
          const isBusy = actionSlug === site.site_slug;
          return (
            <div
              key={site.id}
              className="bg-muted rounded-[12px] border border-border overflow-hidden"
            >
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-[10px] bg-accent border border-border flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-foreground truncate">{site.site_slug}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {site.file_count} {site.file_count === 1 ? 'file' : 'files'}
                    {' · '}
                    {formatDistanceToNow(new Date(site.published_at), { addSuffix: true })}
                    {site.visibility === 'private' && (
                      <span className="ml-2 text-amber-400">Private</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex border-t border-border">
                <a
                  href={site.site_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => navigator.vibrate?.(30)}
                  className="flex-1 flex items-center justify-center gap-2 h-[44px] text-[13px] font-medium text-primary hover:bg-accent active:bg-muted transition-colors border-r border-border"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open
                </a>
                <button
                  onClick={() => handleToggle(site)}
                  disabled={!!actionSlug}
                  className="flex-1 flex items-center justify-center gap-2 h-[44px] text-[13px] font-medium text-foreground hover:bg-accent active:bg-muted transition-colors border-r border-border disabled:opacity-50"
                >
                  {isBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : site.visibility === 'public' ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  {site.visibility === 'public' ? 'Private' : 'Public'}
                </button>
                <button
                  onClick={() => handleUnpublish(site)}
                  disabled={!!actionSlug}
                  className="flex-1 flex items-center justify-center gap-2 h-[44px] text-[13px] font-medium text-destructive hover:bg-destructive/10 active:bg-destructive/20 transition-colors disabled:opacity-50"
                >
                  {isBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Unpublish
                </button>
              </div>
            </div>
          );
        })}

        {!loadingSites && sites.length > 0 && (
          <p className="text-[12px] text-muted-foreground/50 text-center pt-1">
            {sites.length} {sites.length === 1 ? 'site' : 'sites'} published
          </p>
        )}
      </div>
    </MobileSheet>
  );
};

export default MobilePublishedSitesManager;
