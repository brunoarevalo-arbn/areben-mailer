"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { tapTarget } from "@/lib/ui";

/**
 * Una sección que se pliega. Nativa: `<details>` + `<summary>`, cero estado.
 *
 * Salió de `editor/PanelEstilo.tsx` el 2-ago-2026, que era el único lugar de la
 * app que plegaba algo. Va nativo por dos razones y las dos importan:
 *
 * - Un acordeón de verdad **ya viene correcto de teclado y de lector de
 *   pantalla**; uno hecho con `useState` y un `div` hay que rehacerlo entero.
 * - 🔴 **El `open` del DOM no vuelve atrás cuando React re-renderiza.** El editor
 *   re-renderiza en CADA tecla que se escribe en un formulario: con el abierto
 *   en un `useState` del padre habría que subirlo todo, y con uno controlado por
 *   un valor que cambia (`open={!asunto}`) la sección se cerraría de golpe al
 *   escribir la primera letra.
 *
 * ⚠️ Por eso `abiertoDeFabrica` tiene que ser un valor **estable**: React compara
 * la prop contra su render anterior, así que uno fijo se comporta como "abierto
 * de fábrica" (cerrar a mano no se deshace solo) y uno que cambia PISA lo que
 * hizo la persona. Si depende de datos que se editan, congelalo en el montaje
 * (`useState(() => …)`).
 *
 * El `resumen` es la contracara de plegar: una sección cerrada que no dice qué
 * tiene adentro es una sección escondida. Se ve **solo cuando está cerrada**.
 */
export function Desplegable({
  titulo,
  resumen,
  abiertoDeFabrica = false,
  onToggle,
  /** `seccion` = título normal (una caja del editor) · `rol` = rotulito del panel de estilo. */
  tono = "seccion",
  children,
  className = "",
}: {
  titulo: ReactNode;
  resumen?: ReactNode;
  abiertoDeFabrica?: boolean;
  /**
   * Avisa que la persona abrió o cerró la sección. Existe para que un padre
   * pueda **recordar** el estado a través de un remonte, no para controlarla:
   * quien lo use tiene que devolver el mismo valor por `abiertoDeFabrica`, así
   * la prop va SIGUIENDO al DOM y nunca peleándose con él. Ver `PanelEstilo`.
   *
   * ⚠️ El evento `toggle` de `<details>` **no burbujea**. React lo engancha
   * directo al nodo, así que anda igual — pero por eso no se puede escuchar
   * desde un contenedor.
   */
  onToggle?: (abierto: boolean) => void;
  tono?: "seccion" | "rol";
  children: ReactNode;
  className?: string;
}) {
  const esRol = tono === "rol";
  return (
    <details
      open={abiertoDeFabrica}
      onToggle={onToggle ? (e) => onToggle(e.currentTarget.open) : undefined}
      className={`group ${esRol ? "border-t border-border pt-3 first:border-0 first:pt-0" : ""} ${className}`}
    >
      <summary
        className={`flex ${tapTarget} cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden ${
          esRol
            ? "text-xs font-semibold uppercase tracking-wide text-subtle"
            : "text-sm font-semibold text-foreground"
        }`}
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="shrink-0">{titulo}</span>
          {/* Solo con la sección cerrada: abierta, el resumen repetiría lo que ya
              se está mirando. `group-open` es del `<details>`, no hace falta JS. */}
          {resumen && (
            <span className="min-w-0 truncate text-xs font-normal text-muted group-open:hidden">{resumen}</span>
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-3 pt-3">{children}</div>
    </details>
  );
}
