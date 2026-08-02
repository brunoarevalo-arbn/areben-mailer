"use client";

// Mirar un mail entero sin abrir el editor y sin crear nada.
//
// Es la mitad que faltaba de la galería: hasta el 2-ago-2026 lo único que se
// podía hacer con una plantilla era "Usar", que creaba una campaña BORRADOR y
// abría el editor. Para saber si servía había que crearla, así que `/campanias`
// se llenaba de intentos.

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { VistaPreviaMail } from "@/components/VistaPreviaMail";

/** De dónde sacar el HTML cuando no viene ya renderizado. */
export type FuenteVista = { tipo: "campania" | "automation" | "plantilla"; id: string };

export function ModalVistaPrevia({
  titulo,
  /** El HTML ya renderizado (la galería lo tiene en el payload: no pide nada). */
  html,
  /** …o de dónde pedirlo (las listas, que no pueden renderizar 40 mails de una). */
  fuente,
  anchoMail,
  /** Los botones del pie: "Crear campaña", "Editar", lo que sea. Van del server. */
  acciones,
  onCerrar,
}: {
  titulo: string;
  html?: string;
  fuente?: FuenteVista;
  anchoMail?: number;
  acciones?: ReactNode;
  onCerrar: () => void;
}) {
  const [pedido, setPedido] = useState<{ html: string; ancho: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (html || !fuente) return;
    // El `vivo` no es de trámite: si se abre y se cierra antes de que conteste
    // el fetch, el estado se setearía sobre un componente que ya no está.
    let vivo = true;
    fetch(`/api/vista?tipo=${fuente.tipo}&id=${encodeURIComponent(fuente.id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no se pudo leer"))))
      .then((d) => vivo && setPedido({ html: d.html, ancho: d.ancho }))
      .catch(() => vivo && setError("No se pudo dibujar este mail."));
    return () => {
      vivo = false;
    };
  }, [html, fuente]);

  // Escape cierra: un modal del que solo se sale con el mouse molesta cuando se
  // está mirando plantillas de a una.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  const elHtml = html ?? pedido?.html ?? null;
  const elAncho = anchoMail ?? pedido?.ancho;

  // 🔴 Se dibuja en `document.body`, no donde está escrito.
  //
  // El editor es un `@container`, y `container-type` implica `contain: layout`:
  // el contenedor se vuelve el bloque de referencia de todo `position: fixed`
  // que cuelgue adentro. Sin el portal, este `fixed inset-0` mediría la columna
  // del editor en vez de la pantalla. Es la misma razón por la que
  // `ImagenPicker` va portaleado; acá vale aunque hoy los call sites estén
  // afuera del editor, porque el que se agregue adentro no se va a acordar.
  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 sm:p-4"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={`Vista previa de ${titulo}`}
    >
      {/* En celular ocupa la pantalla entera: una caja centrada con márgenes
          deja el mail en menos de 300px de ancho y no se lee nada. */}
      <div
        className="flex h-full w-full flex-col bg-surface shadow-lg sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-xl sm:border sm:border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{titulo}</div>
            <div className="text-xs text-muted">Así se ve el mail. No se crea nada mientras lo mirás.</div>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error ? (
            <div className="py-12 text-center text-sm text-muted">{error}</div>
          ) : elHtml === null ? (
            <div className="py-12 text-center text-sm text-muted">Dibujando el mail…</div>
          ) : (
            <VistaPreviaMail
              html={elHtml}
              anchoMail={elAncho}
              etiqueta={null}
              altoClase="h-[calc(100dvh-16rem)] min-h-80 sm:h-[60vh]"
            />
          )}
        </div>

        {acciones && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border p-4">{acciones}</div>
        )}
      </div>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
