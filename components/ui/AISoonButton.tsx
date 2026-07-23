import { Sparkles } from "lucide-react";

/**
 * Placeholder deshabilitado de asistencia con IA ("Próximamente").
 * Reserva el lugar en la UI sin llamar a ninguna API ni generar costo.
 */
export function AISoonButton({
  label = "Asistir con IA",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled
      title="Próximamente"
      aria-label={`${label} (próximamente)`}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-2.5 py-1 text-xs font-medium text-subtle cursor-not-allowed ${className}`}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      {label}
      <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        Próximamente
      </span>
    </button>
  );
}
