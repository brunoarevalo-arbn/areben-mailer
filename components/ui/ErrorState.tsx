import React from 'react';

interface ErrorStateProps {
  /** Mensaje de error. */
  message?: React.ReactNode;
  /** CTA opcional (ej. un botón "Reintentar"). */
  action?: React.ReactNode;
  className?: string;
}

// Estado de error consistente. Reemplaza los `<p text-red-500/600>` sueltos.
export function ErrorState({ message = 'Ocurrió un error.', action, className = '' }: ErrorStateProps) {
  return (
    <div className={`bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-sm text-red-700 flex items-start gap-3 ${className}`}>
      <span className="text-base leading-none mt-0.5">⚠️</span>
      <div className="flex-1">{message}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
