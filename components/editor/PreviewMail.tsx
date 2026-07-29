"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { renderEmailHtml, type ContenidoCampania } from "@/lib/email/render";
import type { Marca } from "@/lib/marca";
import { Monitor, Smartphone } from "lucide-react";

/**
 * El mail, dibujado con el MISMO `renderEmailHtml` que el envío.
 *
 * No es una aproximación: lo que se ve acá es byte por byte lo que sale, y por
 * eso el editor puede existir sin mantener una segunda versión del diseño.
 *
 * Dos cosas que no son obvias:
 *
 * - **El ancho del iframe importa.** El corte responsive del mail es el ancho
 *   del propio mail, no 600px fijos, así que un iframe angosto muestra la
 *   versión de celular aunque el toggle diga "escritorio". Por eso el marco
 *   tiene el ancho real y se **escala** para entrar en la columna, en vez de
 *   achicarse.
 * - **`useDeferredValue`**: sin esto, cada tecla que se escribe en un título
 *   vuelve a renderizar el mail entero y a reemplazar el `srcDoc` del iframe —
 *   que es un reparse de HTML completo por pulsación.
 */

/** El ancho del celular más chico que vale la pena mirar. */
const ANCHO_MOVIL = 375;

export function PreviewMail({
  contenido,
  marca,
  preheader,
  /** Ancho del mail ya resuelto (el del tema). El marco de escritorio no baja de acá. */
  anchoMail,
  className = "",
}: {
  contenido: ContenidoCampania;
  marca: Marca;
  preheader?: string;
  anchoMail: number;
  className?: string;
}) {
  const [movil, setMovil] = useState(false);
  const [caja, setCaja] = useState({ w: 0, h: 0 });
  const cont = useRef<HTMLDivElement>(null);

  // ⚠️ Cada valor se difiere por separado y nunca un objeto armado en el render:
  // un literal nuevo en cada pasada hace que el diferido nunca alcance al actual
  // y el componente se re-renderice para siempre.
  const contenidoDif = useDeferredValue(contenido);
  const preheaderDif = useDeferredValue(preheader);

  const html = useMemo(
    () =>
      renderEmailHtml(contenidoDif, {
        preheader: preheaderDif,
        unsubscribeUrl: "#",
        // El carrito se dibuja con productos de muestra SOLO acá. El bloque
        // guardado sigue vacío: si trajera datos, una automation se los mandaría
        // a un cliente real.
        muestraCarrito: true,
        ...marca,
      }),
    [contenidoDif, preheaderDif, marca],
  );

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
        <span className="text-sm text-muted">Vista previa</span>
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
      </div>

      <div
        ref={cont}
        className="h-[70vh] w-full overflow-hidden rounded-xl border border-border bg-white"
      >
        <iframe
          title="Vista previa del mail"
          // `sandbox=""` sin permisos: el contenido sale de un Json que puede
          // haber escrito otro usuario de la cuenta y el iframe hereda el origen
          // del panel. Sin esto, un color con comillas es XSS almacenado.
          sandbox=""
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
  );
}
