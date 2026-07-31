import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  isLoading?: boolean;
  /** Ocupa el ancho del contenedor. Espeja la API que ya tienen los campos. */
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  isLoading,
  fullWidth = false,
  children,
  ...props
}: ButtonProps) {
  // `min-h-11` (44px) es el mínimo táctil de Apple y Google. Va acá y no en cada
  // variante porque el botón ya es `inline-flex items-center justify-center`:
  // crece la CAJA y el contenido queda centrado, así que no se toca ni el
  // padding ni la letra ni ninguna de las cinco variantes. En `lg` se apaga y el
  // escritorio queda idéntico — con el mouse, un `size="sm"` de 27px se acierta.
  const baseClasses = 'inline-flex min-h-11 lg:min-h-0 items-center justify-center font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
    accent: 'bg-accent text-accent-foreground hover:bg-accent-hover',
    secondary: 'border border-border text-foreground hover:bg-surface-muted hover:border-border-strong',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    ghost: 'text-muted hover:bg-surface-muted hover:text-foreground',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span
          aria-hidden
          className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
