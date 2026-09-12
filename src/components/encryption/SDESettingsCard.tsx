import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Zap, Info, CheckCircle2, AlertTriangle } from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SDESettingsCardProps {
  className?: string;
}

export function SDESettingsCard({ className }: SDESettingsCardProps) {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('user_encryption_settings')
        .select('settings')
        .eq('user_id', user.id)
        .maybeSingle();
      setEnabled(data?.settings?.sde_enabled === true);
    })();
  }, [user?.id]);

  const handleToggle = async (nextEnabled: boolean) => {
    if (!user) return;
    setSaving(true);
    setEnabled(nextEnabled);

    const { data: existing } = await supabase
      .from('user_encryption_settings')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      const { data: current } = await supabase
        .from('user_encryption_settings')
        .select('settings')
        .eq('user_id', user.id)
        .maybeSingle();
      await supabase
        .from('user_encryption_settings')
        .update({ settings: { ...(current?.settings || {}), sde_enabled: nextEnabled } })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_encryption_settings')
        .insert({ user_id: user.id, settings: { sde_enabled: nextEnabled } });
    }
    setSaving(false);
  };

  return (
    <Card className={cn('border-white/10 bg-white/5', className)}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Zap className="h-5 w-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-white flex items-center gap-2">
              Dispersal Engine (SDE)
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                Beta
              </Badge>
            </CardTitle>
            <CardDescription className="text-white/50">
              Decentralized file dispersal across internet substrates
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white">Enable SDE for new uploads</p>
            <p className="text-xs text-white/50">
              {enabled
                ? 'New uploads use decentralized dispersal. Existing files unaffected.'
                : 'New uploads use the standard B2/S3 pipeline.'}
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        </div>

        <div className="p-4 bg-black/20 rounded-xl">
          <p className="text-xs uppercase tracking-wide text-white/50 mb-2 flex items-center gap-2">
            <Info className="h-3 w-3" />
            How it works
          </p>
          <ul className="text-xs text-white/40 space-y-1.5">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
              <span>Files split into encrypted chunks across multiple internet substrates</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
              <span>Single recall token is the only way to recover your data</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
              <span>No single point of failure — resilient to any individual service going down</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
              <span>Backup your recall token — it is the only way to recover dispersed files</span>
            </li>
          </ul>
        </div>

        <div className="p-4 bg-black/20 rounded-xl space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Upload mode</span>
            <span className="text-white font-medium capitalize">
              {enabled ? 'SDE (Beta)' : 'Standard'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Existing files</span>
            <span className="text-white">Unaffected</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
