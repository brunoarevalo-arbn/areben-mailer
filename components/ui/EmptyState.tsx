import React from 'react';

interface EmptyStateProps {
  /** Emoji o ícono opcional arriba. */
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  /** CTA opcional (ej. un <Button>). */
  action?: React.ReactNode;
  className?: string;
}

// Estado vacío consistente. Reemplaza los `<div border-dashed text-center>` y
// los `<p text-stone-400 italic>Sin ...</p>` sueltos repartidos por la app.
export function EmptyState({ icon, title, message, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`bg-surface rounded-2xl border border-dashed border-border-strong px-6 py-12 text-center ${className}`}>
      {icon && <div className="mb-3 flex justify-center text-subtle [&>svg]:h-9 [&>svg]:w-9 text-4xl">{icon}</div>}
      {title && <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>}
      {message && <p className="text-muted text-sm max-w-md mx-auto">{message}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
