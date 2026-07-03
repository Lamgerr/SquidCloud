import React from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

interface MobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: string;
  className?: string;
}

const MobileSheet: React.FC<MobileSheetProps> = ({
  open,
  onOpenChange,
  children,
  title,
  subtitle,
  className,
}) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {title && (
          <div className="px-5 pt-4 pb-3">
            <div className="min-w-0">
              {typeof title === 'string' ? (
                <h3 className="text-[17px] font-semibold text-[#E6EDF3]">{title}</h3>
              ) : (
                title
              )}
              {subtitle && (
                <p className="text-[13px] text-[#768390] mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
        )}
        {title && <div className="h-px bg-[#2D333B]" />}
        <div className={cn('flex flex-col', className)}>
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MobileSheet;
