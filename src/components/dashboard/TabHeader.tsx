import React from 'react';
import { Button } from '@/components/ui/button';
import type { Icon } from '@/lib/icon-map';

interface TabHeaderProps {
  title: string;
  subtitle?: string;
  count?: number | null;
  primaryLabel?: string;
  primaryIcon?: Icon;
  onPrimary?: () => void;
}

/**
 * Single shared header for every dashboard tab.
 * Quiet title + one-line subtitle, optional live count, and at most
 * one primary action in the accent treatment. No per-tab header variants.
 */
export const TabHeader: React.FC<TabHeaderProps> = ({
  title,
  subtitle,
  count,
  primaryLabel,
  primaryIcon: PrimaryIcon,
  onPrimary,
}) => {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="lg-title">
          {title}
          {typeof count === 'number' && (
            <span className="ml-2 align-middle font-mono text-[11px] font-normal tabular-nums text-muted-foreground">
              {count}
            </span>
          )}
        </h1>
        {subtitle && <p className="lg-caption mt-1">{subtitle}</p>}
      </div>
      {primaryLabel && onPrimary && (
        <Button onClick={onPrimary} className="shrink-0 gap-2">
          {PrimaryIcon && <PrimaryIcon className="h-4 w-4" />}
          {primaryLabel}
        </Button>
      )}
    </div>
  );
};

export default TabHeader;
