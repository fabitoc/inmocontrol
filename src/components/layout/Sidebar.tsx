import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  FolderCog,
  Users,
  Building2,
  Settings,
  ShieldCheck
} from 'lucide-react';
import { NavTab } from '../../types';

export interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'finanzas', label: 'Finanzas', icon: <Receipt className="w-5 h-5" /> },
    { id: 'administracion', label: 'Administración', icon: <FolderCog className="w-5 h-5" /> },
    { id: 'settings', label: 'Configuración', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-64 shrink-0 bg-surface border-r border-border-subtle flex flex-col justify-between h-screen sticky top-0 z-30 select-none">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-border-subtle">
          <div className="w-9 h-9 rounded-lg bg-accent-primary flex items-center justify-center shadow-lg shadow-amber-900/30">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary tracking-tight leading-tight">InmoControl</h1>
            <p className="text-[10px] text-accent-primary font-medium tracking-wider uppercase">SilvaCooperativa</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1 mt-3">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-accent-subtle/40 text-text-primary border-l-4 border-accent-primary font-semibold shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-border/50'
                }`}
              >
                <span className={isActive ? 'text-accent-primary' : 'text-text-muted'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Offline SQLite Status Badge */}
      <div className="p-4 m-3 bg-slate-950/60 rounded-xl border border-border-subtle">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <ShieldCheck className="w-4 h-4 text-status-success" />
          <span className="font-medium text-text-primary">SQLite Local Sync</span>
        </div>
        <p className="text-[11px] text-text-muted mt-1">100% Offline & Seguro</p>
      </div>
    </aside>
  );
};
