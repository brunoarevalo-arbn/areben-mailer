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
    <div className={`bg-white rounded-2xl border border-dashed border-stone-300 px-6 py-12 text-center ${className}`}>
      {icon && <div className="text-4xl mb-3">{icon}</div>}
      {title && <h3 className="text-base font-semibold text-stone-700 mb-1">{title}</h3>}
      {message && <p className="text-stone-500 text-sm max-w-md mx-auto">{message}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
