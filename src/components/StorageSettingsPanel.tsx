import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Sliders, Loader2, CheckCircle2, Globe, HardDrive, Cloud } from '@/lib/icon-map';
import { toast } from 'sonner';

interface StorageSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const FALLBACK_OPTIONS = [
  { value: 'squidcloud_only', label: 'Use SquidCloud only', desc: 'Always use SquidCloud default storage' },
  { value: 'mine_only', label: 'Use my buckets only', desc: 'Only use your connected buckets' },
  { value: 'squidcloud_then_mine', label: 'SquidCloud first, fallback to mine', desc: 'Default to SquidCloud, use your buckets as fallback' },
  { value: 'mine_then_squidcloud', label: 'My buckets first, fallback to SquidCloud', desc: 'Use your buckets when available, fallback to SquidCloud' },
];

const DISTRIBUTION_OPTIONS = [
  { value: 'round_robin', label: 'Round-robin', desc: 'Distribute evenly across all active buckets' },
  { value: 'least_used_first', label: 'Least used first', desc: 'Fill the bucket with the most free space' },
  { value: 'primary_only', label: 'Primary bucket only', desc: 'Always use the active bucket' },
];

export default function StorageSettingsPanel({ isOpen, onClose }: StorageSettingsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fallbackMode, setFallbackMode] = useState('squidcloud_then_mine');
  const [uploadDistribution, setUploadDistribution] = useState('round_robin');
  const [allowPublicSharing, setAllowPublicSharing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadPreferences();
  }, [isOpen]);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('get_user_storage_preferences', {
        p_user_id: user.id,
      });

      if (error) throw error;

      if (data) {
        setFallbackMode(data.fallback_mode || 'squidcloud_then_mine');
        setUploadDistribution(data.upload_distribution || 'round_robin');
        setAllowPublicSharing(data.allow_public_sharing || false);
      }
    } catch (err: any) {
      console.error('Failed to load preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_storage_preferences')
        .upsert({
          user_id: user.id,
          fallback_mode: fallbackMode,
          upload_distribution: uploadDistribution,
          allow_public_sharing: allowPublicSharing,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast.success('Storage preferences saved');
      onClose();
    } catch (err: any) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="left-0 right-0 top-0 bottom-0 translate-x-0 translate-y-0 max-w-none w-screen h-[100dvh] max-h-[100dvh] rounded-none border-0 p-0 sm:left-[50%] sm:top-[50%] sm:bottom-auto sm:right-auto sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-[calc(100vw-1.5rem)] sm:h-auto sm:max-h-[92vh] sm:max-w-[560px] sm:rounded-[20px] sm:border [&>button]:right-3 [&>button]:top-3 sm:[&>button]:right-4 sm:[&>button]:top-4">
        <div className="flex h-full max-h-[100dvh] sm:max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-border/50 px-4 pb-3 pt-4 pr-12 sm:px-6 sm:pr-14">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sliders className="h-5 w-5 text-primary" />
              Storage Preferences
            </DialogTitle>
            <DialogDescription className="text-xs mt-0.5">
              Configure how your storage buckets are used
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Fallback Behavior */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Fallback Behavior</p>
                  </div>
                  <RadioGroup value={fallbackMode} onValueChange={setFallbackMode} className="space-y-2">
                    {FALLBACK_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-start gap-3 rounded-lg border border-border/50 p-3 cursor-pointer hover:bg-accent/20 transition-colors" onClick={() => setFallbackMode(opt.value)}>
                        <RadioGroupItem value={opt.value} id={opt.value} className="mt-0.5" />
                        <div>
                          <Label htmlFor={opt.value} className="text-sm font-medium cursor-pointer">{opt.label}</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="border-t border-border/50" />

                {/* Upload Distribution */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Cloud className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Upload Distribution</p>
                  </div>
                  <Select value={uploadDistribution} onValueChange={setUploadDistribution}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISTRIBUTION_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div>
                            <p>{opt.label}</p>
                            <p className="text-xs text-muted-foreground">{opt.desc}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t border-border/50" />

                {/* Public Sharing */}
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Allow Public Sharing</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Allow your public buckets to be used by the SquidCloud network
                      </p>
                    </div>
                  </div>
                  <Switch checked={allowPublicSharing} onCheckedChange={setAllowPublicSharing} />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="border-t border-border/50 bg-background/95 px-4 py-4 sm:px-6">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={savePreferences} disabled={loading || saving}>
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><CheckCircle2 className="mr-2 h-4 w-4" /> Save Preferences</>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
