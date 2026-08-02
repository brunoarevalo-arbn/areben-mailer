"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { renderEmailHtml, type ContenidoCampania } from "@/lib/email/render";
import { claveProductos, type ConsultaProductos, type ProductoEmail } from "@/lib/email/bloques";
import type { Marca } from "@/lib/marca";
import { VistaPreviaMail } from "@/components/VistaPreviaMail";

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
        // ⛔ Solo acá. Le pone `data-b` a cada bloque para poder saber qué se
        // tocó; `probar-marcado.ts` fija que no salga en ningún envío.
        marcarBloques: true,
        ...marca,
      }),
    [contenidoDif, preheaderDif, marca, productos],
  );

  /**
   * Un click adentro del mail abre el formulario de ESA parte.
   *
   * 🔴 Y de paso arregla el bug que se veía como "el preview se pone en blanco":
   * tocar un botón del mail navegaba el iframe a la tienda, que no se deja
   * enmarcar, y quedaba un cuadro vacío hasta la próxima tecla. Apagar el mouse
   * (`pointer-events-none`, como la miniatura de la galería) no servía: el mail
   * es más alto que el marco y hay que poder scrollearlo adentro.
   *
   * ⚠️ El listener se recuelga en cada `load`: el `srcDoc` se reemplaza entero
   * cada vez que cambia el HTML, y con él el documento donde estaba colgado.
   */
  useEffect(() => {
    if (!frame || !onSeleccionar) return;
    const alClick = (e: MouseEvent) => {
      // TODO click se frena, no solo los links: adentro del mail no hay nada a
      // dónde ir. Lo que decide es el `data-b` más cercano hacia arriba.
      e.preventDefault();
      const cerca = (e.target as Element | null)?.closest?.("[data-b]");
      const id = cerca?.getAttribute("data-b");
      if (id) onSeleccionar(id);
    };
    const enganchar = () => frame.contentDocument?.addEventListener("click", alClick);
    frame.addEventListener("load", enganchar);
    // Por si el documento ya está montado cuando corre el efecto.
    enganchar();
    return () => {
      frame.removeEventListener("load", enganchar);
      frame.contentDocument?.removeEventListener("click", alClick);
    };
  }, [frame, onSeleccionar, html]);

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
  useEffect(() => {
    if (!seleccionadoId) return;
    frame?.contentDocument
      ?.querySelector(`[data-b="${CSS.escape(seleccionadoId)}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionadoId]);

  return (
    <VistaPreviaMail
      html={html}
      anchoMail={anchoMail}
      className={className}
      onIframe={setFrame}
      // 🔴 `allow-same-origin` **sin `allow-scripts`**: el panel necesita leer el
      // documento para saber qué bloque se tocó, y sin `allow-scripts` el
      // navegador no ejecuta NADA de adentro —ni `<script>`, ni `onerror=`, ni
      // `javascript:`—, así que el XSS almacenado que motivó el `sandbox=""`
      // sigue tapado. Tampoco van `allow-forms`, `allow-popups` ni
      // `allow-top-navigation`: el documento queda inerte, solo legible.
      // ⚠️ La miniatura de la galería NO cambia: sigue `sandbox=""`.
      sandbox="allow-same-origin"
    />
  );
}
