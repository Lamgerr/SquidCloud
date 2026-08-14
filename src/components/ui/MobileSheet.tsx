import React from 'react';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
} from '@/components/ui/bottom-sheet';
import { cn } from '@/lib/utils';

interface MobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: string;
  className?: string;
  /** Accessory node in the header row (e.g. an action button). */
  headerAccessory?: React.ReactNode;
}

const MobileSheet: React.FC<MobileSheetProps> = ({
  open,
  onOpenChange,
  children,
  title,
  subtitle,
  className,
  headerAccessory,
}) => {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent className="bg-[hsl(var(--card)/0.92)]">
        {title && (
          <BottomSheetHeader title={title} subtitle={subtitle} accessory={headerAccessory} />
        )}
        {title && <div className="h-px bg-border/60" />}
        <div className={cn('flex flex-col', className)}>
          {children}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
};

export default MobileSheet;
