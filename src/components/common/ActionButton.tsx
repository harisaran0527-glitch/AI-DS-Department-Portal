import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  isLoading = false,
  loadingText,
  icon,
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded-xl shadow-md transition-transform transition-box-shadow duration-200 cubic-bezier(0.16, 1, 0.3, 1) will-change-transform transform-gpu hover:scale-[1.03] active:scale-[0.97] disabled:scale-100 disabled:opacity-75 disabled:cursor-not-allowed motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500';

  const variantStyles = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 shadow-slate-900/30',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20',
    warning: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20',
    ghost: 'bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white shadow-none',
    outline: 'bg-transparent hover:bg-indigo-600/10 text-indigo-400 border border-indigo-500/40 shadow-none',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
    md: 'px-4 py-2 text-sm gap-2 rounded-xl',
    lg: 'px-6 py-3 text-base gap-2.5 rounded-xl',
  };

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`.trim();

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={combinedClassName}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{loadingText || 'Processing...'}</span>
        </>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};

export default ActionButton;
