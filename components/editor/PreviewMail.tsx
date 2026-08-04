"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { renderEmailHtml, type ContenidoCampania } from "@/lib/email/render";
import { claveProductos, type ConsultaProductos, type ProductoEmail } from "@/lib/email/bloques";
import type { Marca } from "@/lib/marca";
import { VistaPreviaMail } from "@/components/VistaPreviaMail";
import { AbrirEnPestana } from "@/components/editor/AbrirEnPestana";

/**
 * El mail, dibujado con el MISMO `renderEmailHtml` que el envío.
 *
 * No es una aproximación: lo que se ve acá es byte por byte lo que sale, y por
 * eso el editor puede existir sin mantener una segunda versión del diseño.
 *
 * Este componente resuelve **qué** se dibuja (los productos automáticos, los
 * merge tags, la marca); el marco escalado y el toggle Escritorio/Celular viven
 * en `VistaPreviaMail`, que es el mismo que usa la galería y las listas.
 *
 * `useDeferredValue`: sin esto, cada tecla que se escribe en un título vuelve a
 * renderizar el mail entero y a reemplazar el `srcDoc` del iframe — que es un
 * reparse de HTML completo por pulsación.
 */

export function PreviewMail({
  contenido,
  marca,
  preheader,
  /** Ancho del mail ya resuelto (el del tema). El marco de escritorio no baja de acá. */
  anchoMail,
  /** El bloque que se está editando: se le pinta un contorno acá adentro. */
  seleccionadoId,
  /** Tocar una parte del mail abre su formulario. */
  onSeleccionar,
  className = "",
}: {
  contenido: ContenidoCampania;
  marca: Marca;
  preheader?: string;
  anchoMail: number;
  seleccionadoId?: string | null;
  onSeleccionar?: (id: string) => void;
  className?: string;
}) {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
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
        // ⚠️ `assetsBase` —de donde salen los iconos de `redes`— NO se arma
        // acá: viene adentro de `...marca`, resuelto en el servidor con el
        // mismo `hostDeEnvio` del envío.
        //
        // 🔴 Hasta el 2-ago-2026 salía de `window.location.origin`, con un
        // ternario para el render del servidor. Ese ternario era el bug: en el
        // servidor `window` no existe ⇒ `assetsBase` vacío ⇒ `urlIcono()`
        // devuelve `undefined` ⇒ el bloque `redes` cae al fallback de texto. El
        // preview mostraba los nombres pelados mientras el envío real mandaba
        // los iconos bien, que es la peor forma de equivocarse: la que hace
        // desconfiar de lo que sí funciona.
        // El carrito se dibuja con productos de muestra SOLO acá. El bloque
        // guardado sigue vacío: si trajera datos, una automation se los mandaría
        // a un cliente real.
        muestraCarrito: true,
        // Los productos automáticos entran por el MISMO canal que en el envío
        // (`opts`, no el documento) y con la misma llave. Es lo que hace que el
        // preview no sea una aproximación de lo que va a salir.
        productosDinamicos: productos,
        // ⛔ Solo acá. Le pone `data-b` a cada bloque para poder saber qué se
        // tocó; `probar-marcado.ts` fija que no salga en ningún envío.
        marcarBloques: true,
        ...marca,
      }),
    [contenidoDif, preheaderDif, marca, productos],
  );

  // ⛔ Acá NO va el listener que frena los clicks: vive en `VistaPreviaMail`,
  // que es el marco que comparten el editor, la galería y las listas. Estaba
  // acá y por eso el preview del modal se seguía poniendo en blanco, y un
  // usuario VIEWER —que no recibe `onSeleccionar`— tampoco quedaba protegido.
  // Este componente solo dice QUÉ hacer con el bloque tocado (`onBloque`).

  // El contorno del bloque elegido, del lado de adentro. Se pinta por DOM y no
  // en el HTML del mail: lo que se renderiza tiene que seguir siendo el mail que
  // sale, y un borde de más ahí saldría en el envío.
  useEffect(() => {
    const d = frame?.contentDocument;
    if (!d) return;
    for (const el of d.querySelectorAll<HTMLElement>("[data-b]")) {
      const puesto = el.getAttribute("data-b") === seleccionadoId;
      el.style.outline = puesto ? "2px solid #f59e0b" : "";
      el.style.outlineOffset = puesto ? "-2px" : "";
    }
  }, [frame, seleccionadoId, html]);

  // Llevar el mail hasta el bloque elegido. Solo cuando cambia la selección: si
  // dependiera del html, scrollearía en cada tecla que se escribe.
  //
  // 🔴 **A mano, y NUNCA con `scrollIntoView`.** El iframe es same-origin, así
  // que el navegador no frena en el borde del documento del mail: sigue subiendo
  // por los contenedores scrolleables, **cruza al documento del panel** y lo
  // mueve para dejar el iframe centrado en la pantalla. Se veía como "cada vez
  // que toco un bloque, la página se va sola para arriba" — y era eso, no un
  // remonte ni un submit.
  //
  // ⚠️ Las tres medidas salen de adentro del iframe (`getBoundingClientRect`,
  // `scrollY`, `innerHeight`), así que están en su propio sistema de
  // coordenadas y el `transform: scale()` que el marco le aplica desde afuera
  // no las toca. Mezclar una medida de afuera acá erraría por el factor de
  // escala.
  useEffect(() => {
    if (!seleccionadoId) return;
    const win = frame?.contentWindow;
    const el = frame?.contentDocument?.querySelector<HTMLElement>(
      `[data-b="${CSS.escape(seleccionadoId)}"]`,
    );
    if (!win || !el) return;
    const y = el.getBoundingClientRect().top + win.scrollY - win.innerHeight / 2;
    win.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionadoId]);

  return (
    <VistaPreviaMail
      html={html}
      anchoMail={anchoMail}
      className={className}
      // El frame se pide igual: el contorno del bloque elegido y el scroll hasta
      // él se pintan por DOM, y eso sigue siendo del editor.
      onIframe={setFrame}
      // Tocar una parte del mail abre su formulario. Que el click además **no
      // navegue** ya lo garantiza el marco, con o sin esto.
      onBloque={onSeleccionar}
      // La otra pregunta que se le hace a un mail: ¿los links llevan a algún
      // lado? Acá adentro no se puede contestar —todo click está frenado—, así
      // que se abre en una pestaña donde sí andan.
      extra={<AbrirEnPestana html={html} />}
      // ⚠️ El `sandbox` no se pasa: el default de `VistaPreviaMail` ya es
      // `allow-same-origin` sin `allow-scripts`, que es lo que hace falta acá.
      // La miniatura de la galería NO usa este componente y sigue con el suyo.
    />
  );
}
