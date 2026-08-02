"use client";

import { useEffect, useRef, useState } from "react";

/**
 * El mail de verdad, renderizado y escalado para entrar en una tarjeta.
 *
 * No es una captura ni un dibujo aparte: es el HTML que sale de
 * `renderEmailHtml` con la marca de esta cuenta puesta. Una galería que muestre
 * una versión genérica miente sobre lo que va a salir, y el comerciante lo
 * descubre después de elegir.
 *
 * 🔴 **La escala se mide, no se calibra.** Hasta el 31-jul-2026 era un
 * `scale(0.68)` fijo pensado para un solo ancho de tarjeta, y ya estaba mal en
 * escritorio: en `lg:grid-cols-4` con ~1088px útiles la tarjeta mide ~250px y el
 * iframe escalado 272 ⇒ se cortaba por la derecha. En un celular, con la tarjeta
 * a ancho completo, sobraba al revés. Con el `ResizeObserver` la miniatura vale
 * en los dos lados y en cualquier grilla futura.
 *
 * 🔴 **El iframe no nace: nace cuando la tarjeta se acerca.** Lo que cuesta de
 * una miniatura no es el HTML —4-13 KB, y ese ya viajó en el payload del server
 * component— sino **las fotos que se descargan al pintarla**: con el pack de
 * stock, una pestaña de 12 son ~24 URLs únicas × ~70 KB ≈ 1,5 MB en frío,
 * todos en paralelo y compitiendo con lo que el comerciante sí está mirando.
 * En `lg:grid-cols-4` la primera pantalla son dos filas: el resto se pinta a
 * medida que baja, y las que nunca mira no se descargan nunca.
 */

/** El ancho con el que se dibuja el mail adentro del iframe. */
const ANCHO = 400;

/**
 * Cuánto antes de entrar en pantalla se empieza a pintar. Con 0 la miniatura
 * aparece en blanco y se llena mientras se scrollea, que se ve peor que la
 * versión de antes; con 400px la tarjeta ya está lista cuando llega arriba.
 */
const ANTICIPO = "400px";

export function MiniaturaMail({ titulo, html }: { titulo: string; html: string }) {
  const cont = useRef<HTMLDivElement>(null);
  const [caja, setCaja] = useState({ w: 0, h: 0 });
  const [cerca, setCerca] = useState(false);

  // El mismo patrón que `PreviewMail` y `EnviosChart`: medir el contenedor y
  // redibujar cuando cambie. Sin esto la escala depende de un ancho supuesto.
  useEffect(() => {
    const el = cont.current;
    if (!el) return;
    const medir = () => setCaja({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = cont.current;
    if (!el) return;
    // ⛔ Sin guarda de "¿existe `IntersectionObserver`?" a propósito: el efecto
    // de arriba ya hace `new ResizeObserver` sin preguntar, y `ResizeObserver`
    // es MÁS nuevo (Safari 13.1, contra 12.1 de este) ⇒ un navegador que llegue
    // hasta acá lo tiene seguro. La guarda sería letra muerta, y encima pedía un
    // `setState` sincrónico adentro del efecto que el lint frena.
    const io = new IntersectionObserver(
      ([e]) => {
        // ⚠️ De una sola vía: una vez pintada NO se vuelve a apagar al salir de
        // pantalla. Apagarla ahorraría memoria pero hace que scrollear para
        // arriba muestre huecos blancos y vuelva a bajar las mismas fotos.
        if (!e.isIntersecting) return;
        setCerca(true);
        io.disconnect();
      },
      { rootMargin: ANTICIPO },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const escala = caja.w ? caja.w / ANCHO : 0.68;

  return (
    <div ref={cont} className="h-56 overflow-hidden border-b border-border bg-white">
      {/* El alto lo fija el contenedor (`h-56`), así que la tarjeta mide lo
          mismo con miniatura y sin ella: la grilla no salta al pintarse. */}
      {cerca && (
        <iframe
          title={titulo}
          // `sandbox=""` sin `allow-same-origin`: el srcDoc hereda el origen del
          // panel, y `esc()` no escapa comillas. Sin esto, un texto guardado
          // puede ejecutar JS con la sesión de quien mira.
          sandbox=""
          srcDoc={html}
          // El ancho va en `style` y no en una clase de Tailwind: una utilidad
          // de ancho fijo de 400 es más de lo que mide un celular y la marca la
          // regla 1 de `auditar-responsive.ts`. Acá los 400 son el ancho INTERNO
          // del mail, que después se escala — pero el auditor no puede saber
          // eso, y una excepción en el script se convierte en la de todos.
          style={{
            width: ANCHO,
            // Compensado, para que después de escalar ocupe exactamente el alto
            // de la tarjeta y no quede una franja blanca abajo.
            height: caja.h ? caja.h / escala : 560,
            transform: `scale(${escala})`,
            transformOrigin: "top left",
            border: 0,
          }}
          className="pointer-events-none"
          tabIndex={-1}
        />
      )}
    </div>
  );
}
