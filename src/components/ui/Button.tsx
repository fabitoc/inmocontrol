import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-canvas disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variantStyles = {
    primary: 'bg-accent-primary hover:bg-accent-hover text-white shadow-md shadow-amber-900/20 active:bg-amber-800',
    secondary: 'bg-surface hover:bg-border border border-border-subtle text-text-primary active:bg-slate-800',
    danger: 'bg-status-danger hover:bg-red-600 text-white shadow-sm active:bg-red-700',
    ghost: 'bg-transparent hover:bg-surface text-text-muted hover:text-text-primary active:bg-border',
    outline: 'border border-accent-primary text-accent-primary hover:bg-accent-primary/10 active:bg-accent-primary/20',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
};
