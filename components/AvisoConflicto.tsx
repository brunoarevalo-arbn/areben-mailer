"use client";

import { AlertTriangle } from "lucide-react";

/**
 * El cartel de "alguien más guardó esto mientras lo tenías abierto".
 *
 * 🔴 **No se auto-oculta y no se puede cerrar.** Un mensaje que desaparece a los
 * 4 segundos sirve para "Guardado ✓" y no sirve para algo que hay que ir a
 * resolver: acá lo que está en pantalla NO se guardó, y si el cartel se va, la
 * persona sigue escribiendo sobre trabajo que ya se perdió. Es el mismo criterio
 * que el aviso del webhook rechazado al activar una automation.
 */
export function AvisoConflicto({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{texto}</span>
    </div>
  );
}
