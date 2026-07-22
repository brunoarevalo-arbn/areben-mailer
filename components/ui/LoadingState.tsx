interface LoadingStateProps {
  label?: string;
  className?: string;
}

// Estado de carga consistente (spinner + texto). Reemplaza los
// `<p>Cargando...</p>` sueltos.
export function LoadingState({ label = 'Cargando…', className = '' }: LoadingStateProps) {
  return (
    <div className={`flex items-center justify-center gap-2 py-12 text-sm text-muted ${className}`} role="status">
      <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-transparent" />
      {label}
    </div>
  );
}
