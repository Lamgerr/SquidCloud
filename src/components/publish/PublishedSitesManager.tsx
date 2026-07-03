import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Globe, Loader2, ExternalLink, Eye, EyeOff, Trash2, AlertTriangle } from '@/lib/icon-map';
import { usePublish } from '@/hooks/usePublish';
import { listMyPublications, type SitePublication } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface PublishedSitesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PublishedSitesManager: React.FC<PublishedSitesManagerProps> = ({ open, onOpenChange }) => {
  const [sites, setSites] = useState<SitePublication[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const { doToggleVisibility, doUnpublish, loading } = usePublish();
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
    const newVis = site.visibility === 'public' ? 'private' : 'public';
    try {
      await doToggleVisibility(site.site_slug, newVis);
      setSites(prev => prev.map(s => s.id === site.id ? { ...s, visibility: newVis } : s));
      toast({ title: 'Visibility updated' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleUnpublish = async (site: SitePublication) => {
    try {
      await doUnpublish(site.site_slug);
      setSites(prev => prev.filter(s => s.id !== site.id));
      toast({ title: 'Site unpublished' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Published Sites
          </DialogTitle>
          <DialogDescription>Manage all your published static websites</DialogDescription>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto space-y-2">
          {loadingSites && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loadingSites && sites.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No published sites yet</p>
          )}

          {sites.map(site => (
            <div
              key={site.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{site.site_slug}</p>
                <p className="text-xs text-muted-foreground">
                  {site.file_count} files &middot; {formatDistanceToNow(new Date(site.published_at), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={site.site_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={() => handleToggle(site)}
                  className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  disabled={loading}
                  title={site.visibility === 'public' ? 'Make private' : 'Make public'}
                >
                  {site.visibility === 'public' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => handleUnpublish(site)}
                  className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  disabled={loading}
                  title="Unpublish"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
