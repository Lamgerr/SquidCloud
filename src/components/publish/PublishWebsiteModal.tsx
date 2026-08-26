import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Globe, Link, Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff, LayoutList } from '@/lib/icon-map';
import { usePublishState, usePublish, type PublishProgress } from '@/hooks/usePublish';
import { type SitePublication } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import MobilePublishedSitesManager from './MobilePublishedSitesManager';

interface PublishWebsiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: string;
  resourceType: 'file' | 'folder';
  resourceName: string;
  onPublished?: () => void;
}

const ProgressBar: React.FC<{ progress: PublishProgress }> = ({ progress }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{progress.stage}</span>
      <span className="text-muted-foreground">{progress.current}/{progress.total}</span>
    </div>
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-primary transition-all duration-300 rounded-full"
        style={{ width: `${progress.percent}%` }}
      />
    </div>
  </div>
);

export const PublishWebsiteModal: React.FC<PublishWebsiteModalProps> = ({
  open, onOpenChange, resourceId, resourceType, resourceName, onPublished,
}) => {
  const { publication, refresh } = usePublishState(open ? resourceId : null);
  const { progress, error, loading, doPublish, doRepublish, doToggleVisibility, doUnpublish } = usePublish();
  const { toast } = useToast();

  const [siteName, setSiteName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [publishResult, setPublishResult] = useState<{ slug: string; url: string } | null>(null);
  const [showMobileManager, setShowMobileManager] = useState(false);
  const isMobile = useIsMobile();

  const isPublished = !!publication;

  useEffect(() => {
    if (open && resourceName && !isPublished) {
      const name = resourceType === 'file'
        ? resourceName.replace(/\.html?$/i, '')
        : resourceName;
      setSiteName(name);
    }
    if (open && publication) {
      setVisibility(publication.visibility);
      setPublishResult({ slug: publication.site_slug, url: publication.site_url });
    }
    if (!open) {
      setPublishResult(null);
      setSiteName('');
      setVisibility('public');
    }
  }, [open, resourceName, resourceType, isPublished, publication]);

  const handlePublish = async () => {
    try {
      const result = await doPublish({
        resourceId,
        resourceType,
        siteName: siteName || undefined,
        visibility,
      });
      setPublishResult({ slug: result.slug, url: result.url });
      toast({ title: 'Published!', description: `Your site is live at ${result.url}` });
      refresh();
      onPublished?.();
    } catch (e: any) {
      toast({ title: 'Publish failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleRepublish = async () => {
    if (!publication) return;
    try {
      await doRepublish(publication.site_slug, { resourceId, resourceType });
      toast({ title: 'Re-published!', description: 'Your site has been updated.' });
      refresh();
      onPublished?.();
    } catch (e: any) {
      toast({ title: 'Re-publish failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleToggleVisibility = async () => {
    if (!publication) return;
    const newVis = publication.visibility === 'public' ? 'private' : 'public';
    try {
      await doToggleVisibility(publication.site_slug, newVis);
      toast({ title: 'Visibility updated', description: `Site is now ${newVis}` });
      refresh();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleUnpublish = async () => {
    if (!publication) return;
    try {
      await doUnpublish(publication.site_slug);
      toast({ title: 'Unpublished', description: 'Site has been unpublished.' });
      setPublishResult(null);
      refresh();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {isPublished ? 'Manage Published Site' : 'Publish as Website'}
          </DialogTitle>
          <DialogDescription>
            {isPublished
              ? `"${resourceName}" is already published at ${publication.site_slug}`
              : `Publish "${resourceName}" as a static website`}
          </DialogDescription>
        </DialogHeader>

        {progress && (
          <div className="py-4">
            <ProgressBar progress={progress} />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!isPublished && !publishResult && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="site-name">Site name</Label>
              <Input
                id="site-name"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="my-awesome-site"
              />
              <p className="text-xs text-muted-foreground">This will be used in the URL: .../serve-site/.../{siteName || 'site'}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Private site</Label>
                <p className="text-xs text-muted-foreground">Requires authentication to view</p>
              </div>
              <Switch
                checked={visibility === 'private'}
                onCheckedChange={(v) => setVisibility(v ? 'private' : 'public')}
              />
            </div>
          </div>
        )}

        {publishResult && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Site published!</p>
                <a
                  href={publishResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline truncate block"
                >
                  {publishResult.url}
                </a>
              </div>
            </div>
            {isMobile && (
              <button
                onClick={() => { onOpenChange(false); setTimeout(() => setShowMobileManager(true), 100); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-[13px] text-muted-foreground hover:text-foreground active:bg-accent transition-colors"
              >
                <LayoutList className="w-4 h-4" />
                Manage All Published Sites
              </button>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {!isPublished && !publishResult && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handlePublish} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Globe className="h-4 w-4 mr-1" />}
                Publish Site
              </Button>
            </>
          )}

          {isPublished && (
            <>
              <Button variant="outline" onClick={handleToggleVisibility} disabled={loading}>
                {publication?.visibility === 'private' ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
                Make {publication?.visibility === 'public' ? 'Private' : 'Public'}
              </Button>
              <Button variant="secondary" onClick={handleRepublish} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Re-publish
              </Button>
              <Button variant="destructive" onClick={handleUnpublish} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Unpublish
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

      <MobilePublishedSitesManager
        open={showMobileManager}
        onOpenChange={setShowMobileManager}
      />
    </>
  );
};
