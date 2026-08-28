import React from 'react';
import { Calendar, Database } from 'lucide-react';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, actions }) => {
  const currentDateFormatted = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="h-16 bg-surface border-b border-border-subtle px-6 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h2 className="text-xl font-bold text-text-primary tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {actions}

        {/* Date Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-border-subtle text-xs text-text-muted capitalize">
          <Calendar className="w-3.5 h-3.5 text-accent-primary" />
          <span>{currentDateFormatted}</span>
        </div>

        {/* Database Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-border-subtle text-xs">
          <Database className="w-3.5 h-3.5 text-accent-primary" />
          <span className="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
          <span className="text-text-primary font-medium">SQLite Activo</span>
        </div>
      </div>
    </header>
  );
};
