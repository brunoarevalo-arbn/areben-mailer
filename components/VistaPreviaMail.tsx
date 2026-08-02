"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Monitor, Smartphone } from "lucide-react";

/**
 * El marco donde se mira un mail: el HTML de verdad, al ancho de verdad,
 * escalado para entrar donde sea, con el toggle Escritorio/Celular.
 *
 * Salió de `editor/PreviewMail.tsx` el 2-ago-2026, sin tocarle una línea a lo
 * que hace. Existe aparte porque el mail ahora se mira en tres lugares —el
 * editor, la galería de plantillas y las listas de campañas y automations— y
 * cada copia de este cálculo sería una versión distinta de "cómo se ve".
 *
 * Dos cosas que no son obvias y son las que hay que respetar al reusarlo:
 *
 * - **El ancho del iframe importa.** El corte responsive del mail es el ancho
 *   del propio mail, no 600px fijos, así que un iframe angosto muestra la
 *   versión de celular aunque el toggle diga "escritorio". Por eso el marco
 *   tiene el ancho real y se **escala** para entrar, en vez de achicarse.
 * - **El alto lo decide quien lo usa** (`altoClase`): en el editor es lo que
 *   sobra de la pantalla, en un modal es otra cosa. Hasta que se extrajo estaba
 *   clavado al editor.
 */

/** El ancho del celular más chico que vale la pena mirar. */
const ANCHO_MOVIL = 375;

/**
 * El alto en el editor. Las 13rem son el encabezado, la barra de acciones, el
 * selector de vista y la fila del toggle; el `min-h-96` es el piso para una
 * pantalla corta.
 *
 * 🔴 `dvh` y no `vh`. En iOS Safari `vh` es el viewport GRANDE —el que queda
 * cuando la barra de direcciones se esconde—, así que un 70vh se mete abajo del
 * chrome del navegador y el mail se lee cortado. `dvh` sigue al alto real y se
 * ajusta solo cuando la barra aparece o se va. Arriba del corte vuelve al 70vh
 * de siempre, y va con el MISMO `@[66rem]` de la grilla del editor: acá "una
 * sola vista" quiere decir "el mail ocupa la pantalla", no "hay una pantalla
 * chica".
 */
export const ALTO_EDITOR = "h-[calc(100dvh-13rem)] min-h-96 @[66rem]:h-[70vh]";

export function VistaPreviaMail({
  html,
  /** Ancho del mail ya resuelto (el del tema). El marco de escritorio no baja de acá. */
  anchoMail = 600,
  /** Lo que dice a la izquierda del toggle. `null` lo saca (en un modal el título ya está arriba). */
  etiqueta = "Vista previa",
  /** A la derecha del todo, en la misma fila del toggle. */
  extra,
  altoClase = ALTO_EDITOR,
  className = "",
  /**
   * ⚠️ El default es `sandbox=""` **sin permisos**, y así se queda salvo que
   * quien lo use tenga una razón escrita: el contenido sale de un Json que pudo
   * escribir otro usuario de la cuenta y el iframe hereda el origen del panel.
   * Sin esto, un color con comillas es XSS almacenado.
   */
  sandbox = "",
  /** El iframe recién montado, para quien necesite colgarle algo (el editor). */
  onIframe,
}: {
  html: string;
  anchoMail?: number;
  etiqueta?: string | null;
  extra?: ReactNode;
  altoClase?: string;
  className?: string;
  sandbox?: string;
  onIframe?: (el: HTMLIFrameElement | null) => void;
}) {
  // Arranca en CELULAR a propósito: es donde el mail se lee de verdad, así que
  // es el default que empuja a diseñar para ahí. Escritorio queda a un click.
  const [movil, setMovil] = useState(true);
  const [caja, setCaja] = useState({ w: 0, h: 0 });
  const cont = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cont.current;
    if (!el) return;
    const medir = () => setCaja({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const anchoMarco = movil ? ANCHO_MOVIL : Math.max(640, anchoMail);
  // Solo se achica, nunca se agranda: un mail de 600px estirado a 900 se vería
  // borroso y encima mentiría sobre el tamaño de la tipografía.
  const escala = caja.w ? Math.min(1, caja.w / anchoMarco) : 1;

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        {etiqueta ? <span className="text-sm text-muted">{etiqueta}</span> : <span />}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            {([
              { movil: false, Icono: Monitor, label: "Escritorio" },
              { movil: true, Icono: Smartphone, label: "Celular" },
            ] as const).map(({ movil: m, Icono, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => setMovil(m)}
                aria-pressed={movil === m}
                title={label}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                  movil === m ? "bg-accent-subtle text-accent-subtle-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                <Icono className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          {extra}
        </div>
      </div>

      {/* Dos divs y no uno: el de afuera es el que MIDE (y el que observa el
          ResizeObserver), el de adentro es el que se achica al ancho real del
          mail. Con uno solo, cambiarle el ancho al elemento observado lo hace
          re-medir y dispararse para siempre.

          El de adentro mide `anchoMarco * escala` y va centrado. Sin eso, en
          celular el iframe queda en 375px dentro de una caja de ~460 y esos 85px
          sobrantes se ven como un borde blanco a la derecha — que es lo que se
          veía y parecía "que no actualiza". */}
      <div ref={cont} className={`flex w-full justify-center ${altoClase}`}>
        <div
          className="h-full overflow-hidden rounded-xl border border-border bg-white"
          style={{ width: caja.w ? anchoMarco * escala : "100%" }}
        >
          <iframe
            title="Vista previa del mail"
            ref={onIframe}
            sandbox={sandbox}
            srcDoc={html}
            style={{
              width: anchoMarco,
              // Alto compensado, para que después de escalar ocupe exactamente el
              // alto del contenedor y no quede una franja blanca abajo.
              height: caja.h ? caja.h / escala : "100%",
              transform: `scale(${escala})`,
              transformOrigin: "top left",
              border: 0,
            }}
          />
        </div>
      </div>
    </div>
  );
}
