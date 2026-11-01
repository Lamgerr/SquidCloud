import React, { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

function assignRef<T>(ref: React.Ref<T> | undefined, node: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') ref(node);
  else (ref as React.MutableRefObject<T | null>).current = node;
}

// ── Ripple helper ───────────────────────────────────────────────────
export function useRipple() {
  const ref = useRef<HTMLElement | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const span = document.createElement('span');
    span.className = 'm3-ripple';
    span.style.left = `${x}px`;
    span.style.top = `${y}px`;
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
    el.appendChild(span);
    span.addEventListener('animationend', () => span.remove(), { once: true });
  };

  return { ref, onPointerDown };
}

// ── Button ──────────────────────────────────────────────────────────
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated' | 'danger' | 'danger-text';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'filled', size = 'md', icon, trailingIcon, loading, loadingLabel, fullWidth, className, children, disabled, ...props }, ref) => {
    const ripple = useRipple();
    const variantClass = {
      filled: '',
      tonal: 'm3-btn--tonal',
      outlined: 'm3-btn--outlined',
      text: 'm3-btn--text',
      elevated: 'm3-btn--elevated',
      danger: 'm3-btn--danger',
      'danger-text': 'm3-btn--danger-text',
    }[variant];
    const sizeClass = size === 'sm' ? 'm3-btn--sm' : size === 'lg' ? 'm3-btn--lg' : '';
    return (
      <button
        ref={(node) => {
          assignRef(ref, node);
          ripple.ref.current = node;
        }}
        className={cn('m3-btn', variantClass, sizeClass, fullWidth && 'w-full', className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        onPointerDown={ripple.onPointerDown}
        {...props}
      >
        {loading ? (
          <span className="m3-btn__spinner" aria-hidden="true" />
        ) : (
          icon && <span className="m3-btn__icon" aria-hidden="true">{icon}</span>
        )}
        <span className="truncate">{loading ? (loadingLabel || children) : children}</span>
        {!loading && trailingIcon && <span className="m3-btn__icon" aria-hidden="true">{trailingIcon}</span>}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ── IconButton ──────────────────────────────────────────────────────
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'standard' | 'filled' | 'tonal' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  label: string;
  danger?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'standard', size = 'md', selected, label, danger, className, children, ...props }, ref) => {
    const ripple = useRipple();
    const variantClass = {
      standard: '',
      filled: 'm3-icon-btn--filled',
      tonal: 'm3-icon-btn--tonal',
      outlined: 'm3-icon-btn--outlined',
    }[variant];
    const sizeClass = size === 'sm' ? 'm3-icon-btn--sm' : size === 'lg' ? 'm3-icon-btn--lg' : '';
    return (
      <button
        ref={(node) => {
          assignRef(ref, node);
          ripple.ref.current = node;
        }}
        aria-label={label}
        aria-pressed={selected !== undefined ? selected : undefined}
        className={cn(
          'm3-icon-btn',
          variantClass,
          sizeClass,
          selected && 'm3-icon-btn--selected',
          danger && 'm3-icon-btn--danger',
          className
        )}
        onPointerDown={ripple.onPointerDown}
        {...props}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = 'IconButton';

// ── Fab ─────────────────────────────────────────────────────────────
export interface FabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  extended?: boolean;
  icon?: ReactNode;
  label?: string;
  variant?: 'primary' | 'tertiary';
  lowered?: boolean;
}

export const Fab = React.forwardRef<HTMLButtonElement, FabProps>(
  ({ size = 'md', extended, icon, label, variant = 'primary', lowered, className, children, ...props }, ref) => {
    const ripple = useRipple();
    const sizeClass = size === 'sm' ? 'm3-fab--sm' : size === 'lg' ? 'm3-fab--lg' : '';
    const variantClass = variant === 'tertiary' ? 'm3-fab--tertiary' : 'm3-fab--primary';
    return (
      <button
        ref={(node) => {
          assignRef(ref, node);
          ripple.ref.current = node;
        }}
        className={cn(
          'm3-fab',
          sizeClass,
          extended && 'm3-fab--extended',
          lowered && 'm3-fab--lowered',
          variantClass,
          className
        )}
        onPointerDown={ripple.onPointerDown}
        {...props}
      >
        {icon && <span aria-hidden="true">{icon}</span>}
        {(label || children) && <span>{label || children}</span>}
      </button>
    );
  }
);
Fab.displayName = 'Fab';

// ── Card ─────────────────────────────────────────────────────────────
export interface CardProps {
  variant?: 'filled' | 'elevated' | 'outlined' | 'hero';
  interactive?: boolean;
  padding?: boolean;
  className?: string;
  children?: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  role?: string;
  tabIndex?: number;
  'aria-label'?: string;
}

export const Card: React.FC<CardProps> = ({
  variant = 'filled', interactive, padding = true, className, children, onClick, ...props
}) => {
  const variantClass = {
    filled: 'm3-card--filled',
    elevated: 'm3-card--elevated',
    outlined: 'm3-card--outlined',
    hero: 'm3-card--hero',
  }[variant];
  const interactiveProps = interactive
    ? { tabIndex: 0, role: 'button' as const, onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e as any); }
      } }
    : {};
  return (
    <div
      className={cn('m3-card', variantClass, interactive && 'm3-card--interactive', className)}
      onClick={onClick}
      {...interactiveProps}
      {...props}
    >
      {padding ? <div className="m3-card__body">{children}</div> : children}
    </div>
  );
};

// ── Chip ─────────────────────────────────────────────────────────────
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'assist' | 'filter' | 'suggestion' | 'input';
  selected?: boolean;
  icon?: ReactNode;
  onRemove?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ variant = 'assist', selected, icon, onRemove, size = 'md', className, children, ...props }, ref) => {
    const ripple = useRipple();
    const variantClass = variant === 'assist' ? 'm3-chip--assist' : '';
    const sizeClass = size === 'sm' ? 'm3-chip--sm' : size === 'lg' ? 'm3-chip--lg' : '';
    return (
      <button
        ref={(node) => {
          assignRef(ref, node);
          ripple.ref.current = node;
        }}
        type={props.type || 'button'}
        aria-pressed={selected !== undefined ? selected : undefined}
        className={cn(
          'm3-chip',
          variantClass,
          sizeClass,
          selected && 'm3-chip--selected',
          className
        )}
        onPointerDown={ripple.onPointerDown}
        {...props}
      >
        {icon && <span className="inline-flex" aria-hidden="true">{icon}</span>}
        <span className="truncate">{children}</span>
        {onRemove && (
          <span
            className="m3-chip__remove"
            role="button"
            aria-label="Remove"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onRemove(); }
            }}
            tabIndex={0}
          >
            ×
          </span>
        )}
      </button>
    );
  }
);
Chip.displayName = 'Chip';

// ── ListItem ────────────────────────────────────────────────────────
export interface ListItemProps {
  leading?: ReactNode;
  headline: ReactNode;
  supporting?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  threeLine?: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  className?: string;
  as?: 'button' | 'div' | 'li';
  'aria-current'?: 'page' | boolean;
  'aria-label'?: string;
}

export const ListItem: React.FC<ListItemProps> = ({
  leading, headline, supporting, trailing, selected, disabled, threeLine, onClick, className, as = 'button', ...props
}) => {
  const ripple = useRipple();
  const Comp: any = onClick ? 'button' : as === 'li' ? 'li' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      disabled={disabled}
      aria-selected={selected}
      aria-disabled={disabled}
      onClick={onClick}
      className={cn(
        'm3-list-item',
        threeLine && 'm3-list-item--3line',
        selected && 'm3-list-item--selected',
        disabled && 'm3-list-item--disabled',
        className
      )}
      onPointerDown={onClick ? ripple.onPointerDown : undefined}
      {...props}
    >
      {leading && <span className="m3-list-item__leading">{leading}</span>}
      <span className="m3-list-item__content">
        <span className="m3-list-item__headline">{headline}</span>
        {supporting !== undefined && supporting !== null && (
          <span className="m3-list-item__supporting">{supporting}</span>
        )}
      </span>
      {trailing && <span className="m3-list-item__trailing">{trailing}</span>}
    </Comp>
  );
};

// ── IconWell ────────────────────────────────────────────────────────
export interface IconWellProps {
  icon: ReactNode;
  tone?: 'primary' | 'tonal' | 'tertiary' | 'surface' | 'error' | 'image' | 'video' | 'audio' | 'doc' | 'archive' | 'code';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}
export const IconWell: React.FC<IconWellProps> = ({ icon, tone = 'primary', size = 'md', className }) => {
  const toneClass = {
    primary: '',
    tonal: 'm3-icon-well--tonal',
    tertiary: 'm3-icon-well--tertiary',
    surface: 'm3-icon-well--surface',
    error: 'm3-icon-well--error',
    image: 'm3-icon-well--image',
    video: 'm3-icon-well--video',
    audio: 'm3-icon-well--audio',
    doc: 'm3-icon-well--doc',
    archive: 'm3-icon-well--archive',
    code: 'm3-icon-well--code',
  }[tone];
  const sizeClass = size === 'sm' ? 'm3-icon-well--sm' : size === 'lg' ? 'm3-icon-well--lg' : size === 'xl' ? 'm3-icon-well--xl' : '';
  return (
    <span className={cn('m3-icon-well', toneClass, sizeClass, className)} aria-hidden="true">
      {icon}
    </span>
  );
};

// ── Badge ───────────────────────────────────────────────────────────
export interface BadgeProps {
  variant?: 'error' | 'tonal' | 'outline' | 'dot';
  children?: ReactNode;
  className?: string;
}
export const BadgeM3: React.FC<BadgeProps> = ({ variant = 'error', children, className }) => {
  const variantClass = variant === 'tonal' ? 'm3-badge--tonal' : variant === 'outline' ? 'm3-badge--outline' : variant === 'dot' ? 'm3-badge--dot' : '';
  return (
    <span className={cn('m3-badge', variantClass, className)}>
      {variant !== 'dot' && children}
    </span>
  );
};

// ── Divider ─────────────────────────────────────────────────────────
export const Divider: React.FC<{ inset?: boolean; className?: string }> = ({ inset, className }) => (
  <hr className={cn('m3-divider', inset && 'm3-divider--inset', className)} />
);

// ── Progress ────────────────────────────────────────────────────────
export interface ProgressProps {
  value?: number;
  max?: number;
  indeterminate?: boolean;
  tone?: 'primary' | 'warning' | 'error';
  thick?: boolean;
  className?: string;
  ariaLabel?: string;
}
export const Progress: React.FC<ProgressProps> = ({ value = 0, max = 100, indeterminate, tone, thick, className, ariaLabel }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const toneClass = tone === 'warning' ? 'm3-progress--warning' : tone === 'error' ? 'm3-progress--error' : '';
  return (
    <div
      className={cn('m3-progress', indeterminate && 'm3-progress--indeterminate', toneClass, thick && 'm3-progress--thick', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={indeterminate ? undefined : value}
      aria-label={ariaLabel}
    >
      <div className="m3-progress__bar" style={indeterminate ? undefined : { width: `${pct}%` }} />
    </div>
  );
};

// ── Ring (storage) ──────────────────────────────────────────────────
export interface RingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: ReactNode;
}
export const Ring: React.FC<RingProps> = ({ value, max = 100, size = 72, strokeWidth = 6, className, children }) => {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value / max));
  const offset = c * (1 - pct);
  return (
    <svg className={cn('m3-ring', className)} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle className="m3-ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} />
      <circle className="m3-ring__value" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} strokeDasharray={c} strokeDashoffset={offset} />
      {children}
    </svg>
  );
};

// ── Switch ──────────────────────────────────────────────────────────
export interface SwitchProps {
  checked: boolean;
  onCheckedChange?: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}
export const Switch: React.FC<SwitchProps> = ({ checked, onCheckedChange, disabled, label, className }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    className={cn('m3-switch', className)}
    onClick={() => onCheckedChange?.(!checked)}
  >
    <span className="m3-switch__thumb" />
  </button>
);

// ── SegmentedButton ────────────────────────────────────────────────
export interface SegmentedOption {
  value: string;
  label?: string;
  icon?: ReactNode;
}
export interface SegmentedButtonProps {
  options: SegmentedOption[];
  value: string;
  onChange: (v: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}
export const SegmentedButton: React.FC<SegmentedButtonProps> = ({ options, value, onChange, size = 'md', className }) => (
  <div role="group" className={cn('m3-seg', size === 'sm' && 'm3-seg--sm', className)}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        aria-pressed={value === o.value}
        className="m3-seg__item"
        onClick={() => onChange(o.value)}
      >
        {o.icon && <span aria-hidden="true">{o.icon}</span>}
        {o.label && <span>{o.label}</span>}
      </button>
    ))}
  </div>
);

// ── TextField ───────────────────────────────────────────────────────
export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  supporting?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  filled?: boolean;
  fieldClassName?: string;
}
export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, supporting, error, leadingIcon, trailingIcon, filled, fieldClassName, id, value, className, ...props }, ref) => {
    const autoId = id || `m3-field-${label.toLowerCase().replace(/\s+/g, '-')}`;
    const hasValue = value !== undefined && value !== null && String(value).length > 0;
    return (
      <div className={cn('m3-field', hasValue && 'm3-field--filled', error && 'm3-field--error', fieldClassName)}>
        <div className="m3-field__box">
          {leadingIcon && <span className="m3-on-surface-variant" aria-hidden="true">{leadingIcon}</span>}
          <input
            ref={ref}
            id={autoId}
            value={value}
            className={cn('m3-field__input', className)}
            placeholder=" "
            {...props}
          />
          {trailingIcon && <span className="m3-on-surface-variant" aria-hidden="true">{trailingIcon}</span>}
          <label className="m3-field__label" htmlFor={autoId}>{label}</label>
        </div>
        {(supporting || error) && (
          <div className="m3-field__support">{error || supporting}</div>
        )}
      </div>
    );
  }
);
TextField.displayName = 'TextField';

// ── SearchBar ───────────────────────────────────────────────────────
export interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onSubmit?: (v: string) => void;
  small?: boolean;
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  autoFocus?: boolean;
}
export const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, placeholder, onSubmit, small, leadingIcon, trailing, className, autoFocus }) => (
  <form
    role="search"
    className={cn('m3-search', small && 'm3-search--sm', className)}
    onSubmit={(e) => { e.preventDefault(); onSubmit?.(value); }}
  >
    <span className="m3-search__icon" aria-hidden="true">
      {leadingIcon || <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>}
    </span>
    <input
      className="m3-search__input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || 'Search'}
      aria-label={placeholder || 'Search'}
      autoFocus={autoFocus}
    />
    {trailing}
  </form>
);

// ── EmptyState ──────────────────────────────────────────────────────
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, body, action, className }) => (
  <div className={cn('m3-empty', className)}>
    {icon && <div className="m3-empty__icon" aria-hidden="true">{icon}</div>}
    <div className="m3-empty__title">{title}</div>
    {body && <div className="m3-empty__body">{body}</div>}
    {action}
  </div>
);

// ── Skeleton ────────────────────────────────────────────────────────
export const Skeleton: React.FC<{ className?: string; width?: number | string; height?: number | string }> = ({ className, width, height }) => (
  <div className={cn('m3-skeleton', className)} style={{ width, height }} aria-hidden="true" />
);

// ── Kbd ─────────────────────────────────────────────────────────────
export const Kbd: React.FC<{ children: ReactNode; className?: string }> = ({ children, className }) => (
  <kbd className={cn('m3-kbd', className)}>{children}</kbd>
);

// ── Kbd (legacy alias) ─────────────────────────────────────────────
export const M3Kbd = Kbd;

// ── ListGroup ───────────────────────────────────────────────────────
export interface ListGroupProps {
  outlined?: boolean;
  className?: string;
  children?: ReactNode;
}
export const ListGroup: React.FC<ListGroupProps> = ({ outlined, className, children }) => (
  <div className={cn('m3-list-group', outlined && 'm3-list-group--outlined', className)}>{children}</div>
);
