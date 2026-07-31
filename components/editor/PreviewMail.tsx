"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { renderEmailHtml, type ContenidoCampania } from "@/lib/email/render";
import { claveProductos, type ConsultaProductos, type ProductoEmail } from "@/lib/email/bloques";
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
  // Arranca en CELULAR a propósito: es donde el mail se lee de verdad, así que
  // es el default que empuja a diseñar para ahí. Escritorio queda a un click.
  const [movil, setMovil] = useState(true);
  const [caja, setCaja] = useState({ w: 0, h: 0 });
  const cont = useRef<HTMLDivElement>(null);

  // ⚠️ Cada valor se difiere por separado y nunca un objeto armado en el render:
  // un literal nuevo en cada pasada hace que el diferido nunca alcance al actual
  // y el componente se re-renderice para siempre.
  const contenidoDif = useDeferredValue(contenido);
  const preheaderDif = useDeferredValue(preheader);

  // Los bloques de productos automáticos guardan una consulta, no productos, así
  // que el preview tiene que resolverla igual que lo hace el envío — contra la
  // misma tienda y con la misma llave (`claveProductos`). Si acá se dibujara una
  // lista de ejemplo, el editor mostraría un mail que no existe.
  const [productos, setProductos] = useState<Record<string, ProductoEmail[]>>({});

  const consultas = useMemo(() => {
    const m = new Map<string, ConsultaProductos>();
    for (const b of contenidoDif.bloques) {
      if (b.tipo === "productos-dinamicos") {
        m.set(claveProductos(b), { fuente: b.fuente, categoriaId: b.categoriaId, n: b.n });
      }
    }
    return m;
  }, [contenidoDif]);

  useEffect(() => {
    // Solo lo que falta: cambiar el color de un título no vuelve a pedirle los
    // productos a Tiendanube. Y dos bloques con la misma consulta comparten la
    // respuesta, igual que en el envío.
    const faltan = [...consultas].filter(([k]) => !(k in productos));
    if (!faltan.length) return;
    let vivo = true;
    Promise.all(
      faltan.map(async ([k, c]) => {
        const sp = new URLSearchParams({ fuente: c.fuente, n: String(c.n ?? 4) });
        if (c.categoriaId) sp.set("categoriaId", c.categoriaId);
        const d = await fetch(`/api/productos?${sp}`)
          .then((r) => r.json())
          .catch(() => ({}));
        return [k, (d.productos ?? []) as ProductoEmail[]] as const;
      }),
    ).then((pares) => {
      if (vivo) setProductos((p) => ({ ...p, ...Object.fromEntries(pares) }));
    });
    return () => {
      vivo = false;
    };
  }, [consultas, productos]);

  const html = useMemo(
    () =>
      renderEmailHtml(contenidoDif, {
        preheader: preheaderDif,
        unsubscribeUrl: "#",
        // Los iconos de `redes` necesitan URL absoluta (el iframe va con
        // `srcDoc`, así que una relativa no resuelve contra ningún origen). Se
        // usa el del propio panel y no el dominio de la marca a propósito: son
        // los MISMOS archivos, el preview se ve igual, y evita enhebrar la prop
        // por los tres editores. Lo que el preview promete es el aspecto, no la
        // URL — esa la decide `hostDeEnvio` al enviar.
        assetsBase: typeof window === "undefined" ? "" : window.location.origin,
        // El carrito se dibuja con productos de muestra SOLO acá. El bloque
        // guardado sigue vacío: si trajera datos, una automation se los mandaría
        // a un cliente real.
        muestraCarrito: true,
        // Los productos automáticos entran por el MISMO canal que en el envío
        // (`opts`, no el documento) y con la misma llave. Es lo que hace que el
        // preview no sea una aproximación de lo que va a salir.
        productosDinamicos: productos,
        ...marca,
      }),
    [contenidoDif, preheaderDif, marca, productos],
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

      {/* Dos divs y no uno: el de afuera es el que MIDE (y el que observa el
          ResizeObserver), el de adentro es el que se achica al ancho real del
          mail. Con uno solo, cambiarle el ancho al elemento observado lo hace
          re-medir y dispararse para siempre.

          El de adentro mide `anchoMarco * escala` y va centrado. Sin eso, en
          celular el iframe queda en 375px dentro de una caja de ~460 y esos 85px
          sobrantes se ven como un borde blanco a la derecha — que es lo que se
          veía y parecía "que no actualiza". */}
      <div ref={cont} className="flex h-[70vh] w-full justify-center">
        <div
          className="h-full overflow-hidden rounded-xl border border-border bg-white"
          style={{ width: caja.w ? anchoMarco * escala : "100%" }}
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
    </div>
  );
}
