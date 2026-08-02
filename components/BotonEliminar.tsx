"use client";

// Borrar una fila de una lista, con la confirmación pegada al daño concreto.
//
// No hay componente de diálogo en la app y este no lo trae: `confirm()` nativo,
// igual que el borrado de imágenes y el de usuarios. Lo que sí trae es el
// **motivo** cuando no se puede borrar: un botón que existe y tira error es peor
// que un texto que explica por qué no está.

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { tapTarget } from "@/lib/ui";

export function BotonEliminar({
  /** Lo que se le pregunta a la persona. Que diga qué se pierde, no "¿estás seguro?". */
  confirmacion,
  /** La server action ya atada al id. Devuelve el motivo si el servidor la frena. */
  accion,
  /** Si viene, no se borra: se muestra esto en lugar del botón. */
  motivo,
}: {
  confirmacion: string;
  accion: () => Promise<{ ok: boolean; error?: string }>;
  motivo?: string | null;
}) {
  const [pendiente, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (motivo) {
    return (
      <span title={motivo} className="cursor-help text-xs text-subtle">
        no se borra
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={pendiente}
        title="Eliminar"
        aria-label="Eliminar"
        onClick={() => {
          if (!confirm(confirmacion)) return;
          setError(null);
          start(async () => {
            const r = await accion();
            // La guarda de verdad es la del servidor: la lista puede estar
            // cacheada y el estado que se ve acá, viejo.
            if (!r.ok) setError(r.error ?? "No se pudo borrar.");
          });
        }}
        className={`flex ${tapTarget} items-center justify-center rounded-xl border border-border p-1.5 text-muted transition-colors hover:border-danger-border hover:bg-danger hover:text-danger-foreground disabled:opacity-40`}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
      {error && <span className="text-xs text-danger-foreground">{error}</span>}
    </>
  );
}
