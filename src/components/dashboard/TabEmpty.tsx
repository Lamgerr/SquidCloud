import React from 'react';
import { Button } from '@/components/ui/button';
import type { Icon } from '@/lib/icon-map';

interface TabEmptyProps {
  icon: Icon;
  line: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Single shared empty state for every dashboard tab.
 * One icon, one line, one optional action. No per-tab variants.
 */
export const TabEmpty: React.FC<TabEmptyProps> = ({
  icon: EmptyIcon,
  line,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <EmptyIcon className="mb-3 h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{line}</p>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default TabEmpty;
