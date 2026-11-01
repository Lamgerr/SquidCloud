import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight } from '@/lib/icon-map';

interface SettingsRowProps {
  icon: React.ElementType;
  label: string;
  description?: string;
  onClick?: () => void;
  variant?: 'default' | 'destructive';
  className?: string;
  disabled?: boolean;
  trailing?: React.ReactNode;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon: Icon,
  label,
  description,
  onClick,
  variant = 'default',
  className,
  disabled,
  trailing,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex w-full items-center gap-3 px-4 h-12 text-left transition-all duration-150',
        variant === 'destructive'
          ? 'hover:bg-red-500/5'
          : 'hover:bg-white/[0.04]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Icon className={cn(
        'w-4 h-4 flex-shrink-0',
        variant === 'destructive'
          ? 'text-red-400/60'
          : 'text-white/50 group-hover:text-white/70'
      )} />
      <span className={cn(
        'text-[14px] flex-1 font-medium',
        variant === 'destructive' ? 'text-red-400' : 'text-white'
      )}>
        {label}
      </span>
      {description && (
        <span className={cn(
          'text-[12px] hidden sm:inline',
          variant === 'destructive' ? 'text-red-400/40' : 'text-white/40'
        )}>
          {description}
        </span>
      )}
      {trailing || (
        <ChevronRight className={cn(
          'w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5',
          variant === 'destructive' ? 'text-red-400/20' : 'text-white/20'
        )} />
      )}
    </button>
  );
};

interface SettingsCardProps {
  children: React.ReactNode;
  className?: string;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({ children, className }) => {
  return (
    <div className={cn(
      'bg-white/[0.06] rounded-2xl border border-white/10 overflow-hidden',
      className
    )}>
      {children}
    </div>
  );
};

interface SettingsDividerProps {
  className?: string;
}

export const SettingsDivider: React.FC<SettingsDividerProps> = ({ className }) => {
  return <div className={cn('h-px bg-white/[0.06] mx-4', className)} />;
};
