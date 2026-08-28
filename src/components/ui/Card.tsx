import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  headerAction,
  footer,
  hoverEffect = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`acrylic-card rounded-xl shadow-lg transition-all duration-200 ${
        hoverEffect ? 'hover:border-accent-primary/40 hover:shadow-xl' : ''
      } ${className}`}
      {...props}
    >
      {(title || subtitle || headerAction) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div>
            {title && <h3 className="text-base font-semibold text-text-primary">{title}</h3>}
            {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer && (
        <div className="px-5 py-3 border-t border-border-subtle bg-slate-950/40 rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  );
};
