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
  leadingTone?: 'primary' | 'tonal' | 'tertiary' | 'surface' | 'error';
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
  leadingTone,
}) => {
  const destructive = variant === 'destructive';
  const tone = leadingTone || (destructive ? 'error' : 'tonal');
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'm3-list-item',
        destructive && 'm3-list-item--danger' as any,
        disabled && 'm3-list-item--disabled',
        className
      )}
    >
      <span className="m3-list-item__leading">
        <span className={cn(
          'm3-icon-well m3-icon-well--sm',
          tone === 'primary' && '',
          tone === 'tonal' && 'm3-icon-well--tonal',
          tone === 'tertiary' && 'm3-icon-well--tertiary',
          tone === 'surface' && 'm3-icon-well--surface',
          tone === 'error' && 'm3-icon-well--error',
        )}>
          <Icon className="h-4 w-4" />
        </span>
      </span>
      <span className="m3-list-item__content">
        <span className={cn('m3-list-item__headline', destructive && 'm3-error-text')}>{label}</span>
        {description && <span className="m3-list-item__supporting">{description}</span>}
      </span>
      <span className="m3-list-item__trailing">
        {trailing || <ChevronRight className="h-4 w-4" />}
      </span>
    </button>
  );
};

interface SettingsCardProps {
  children: React.ReactNode;
  className?: string;
  outlined?: boolean;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({ children, className, outlined }) => {
  return (
    <div className={cn('m3-list-group', outlined && 'm3-list-group--outlined', className)}>
      {children}
    </div>
  );
};

interface SettingsDividerProps {
  className?: string;
}

export const SettingsDivider: React.FC<SettingsDividerProps> = ({ className }) => {
  return <div className={cn('m3-divider m3-divider--inset', className)} />;
};
