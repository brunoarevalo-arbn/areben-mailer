import React from 'react';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'amber' | 'blue' | 'violet' | 'pink';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

const variants = {
  default: 'bg-surface-muted text-muted',
  success: 'bg-success text-success-foreground border border-success-border',
  warning: 'bg-warning text-warning-foreground border border-warning-border',
  danger: 'bg-danger text-danger-foreground border border-danger-border',
  info: 'bg-info text-info-foreground border border-info-border',
  // Colores adicionales para estados con identidad propia (no se colapsan).
  amber: 'bg-accent-subtle text-accent-subtle-foreground',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  pink: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
};

const sizes = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
};

export function Badge({
  variant = 'default',
  size = 'sm',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-block font-medium rounded-lg ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </span>
  );
}
