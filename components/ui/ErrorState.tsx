import React from 'react';
import { AlertTriangle } from 'lucide-react';

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
    <div className={`bg-danger border border-danger-border rounded-2xl px-5 py-4 text-sm text-danger-foreground flex items-start gap-3 ${className}`}>
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1">{message}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
