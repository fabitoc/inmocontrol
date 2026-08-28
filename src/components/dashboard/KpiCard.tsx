import React from 'react';
import { Card } from '../ui/Card';

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: 'success' | 'warning' | 'info' | 'purple' | 'danger';
  badgeText?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'info',
  badgeText,
}) => {
  const borderColors = {
    success: 'border-l-status-success',
    warning: 'border-l-accent-primary',
    info: 'border-l-blue-500',
    purple: 'border-l-purple-500',
    danger: 'border-l-status-danger',
  };

  const iconBgColors = {
    success: 'bg-status-success/10 text-status-success',
    warning: 'bg-accent-primary/10 text-accent-primary',
    info: 'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    danger: 'bg-status-danger/10 text-status-danger',
  };

  const valueColors = {
    success: 'text-text-primary',
    warning: 'text-amber-500',
    info: 'text-text-primary',
    purple: 'text-text-primary',
    danger: 'text-status-danger',
  };

  return (
    <Card className={`border-l-4 ${borderColors[variant]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{title}</p>
          <h4 className={`text-2xl font-extrabold mt-1 ${valueColors[variant]}`}>{value}</h4>
          {badgeText && (
            <span className="text-xs text-text-muted font-medium mt-1 inline-block">
              {badgeText}
            </span>
          )}
          {subtitle && !badgeText && (
            <span className="text-xs text-text-muted font-medium mt-1 inline-block">
              {subtitle}
            </span>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBgColors[variant]}`}>{icon}</div>
      </div>
    </Card>
  );
};
