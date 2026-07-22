import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'compact' | 'default' | 'loose';
  noBorder?: boolean;
  /** Sombra más marcada para tarjetas destacadas (KPIs, paneles). */
  elevated?: boolean;
}

export function Card({
  children,
  className = '',
  padding = 'default',
  noBorder = false,
  elevated = false,
}: CardProps) {
  const paddings = {
    none: '',
    compact: 'px-4 py-3',
    default: 'px-6 py-4',
    loose: 'px-8 py-6',
  };

  const border = noBorder ? '' : 'border border-border';
  const shadow = elevated ? 'shadow-md' : 'shadow-sm';

  return (
    <div
      className={`bg-surface rounded-2xl ${border} ${shadow} ${paddings[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
