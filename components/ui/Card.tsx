import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'compact' | 'default' | 'loose';
  noBorder?: boolean;
}

export function Card({
  children,
  className = '',
  padding = 'default',
  noBorder = false,
}: CardProps) {
  const paddings = {
    none: '',
    compact: 'px-4 py-3',
    default: 'px-6 py-4',
    loose: 'px-8 py-6',
  };

  const border = noBorder ? '' : 'border border-stone-200';

  return (
    <div
      className={`bg-white rounded-2xl ${border} ${paddings[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
