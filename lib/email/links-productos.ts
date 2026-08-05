// ¿Los productos elegidos a mano llevan a algún lado?
//
// 🔴 **La pregunta no es "¿está publicado?" sino "¿el link funciona?"**, y no es
// lo mismo. Medido el 5-ago-2026 contra las cuatro tiendas: la ficha de un
// producto oculto en Tiendanube devuelve **404**, no una página sin botón de
// compra. Preguntar por el link cubre además dos casos que la API no contesta:
// el producto **borrado**, y el **renombrado** —TN arma el slug con el nombre,
// así que cambiarlo mueve la URL y la que quedó guardada en el mail muere.
//
// Sólo aplica a `productos` (los elegidos a mano). El bloque de productos
// automáticos no guarda nada: pregunta al enviar y con `published: "true"`, así
// que lo que trae ya está publicado por construcción.

import type { Bloque } from "./bloques";

/** Las URLs de producto que un documento lleva guardadas. Sin repetir. */
export function urlsDeProductos(bloques: Bloque[]): string[] {
  const out = new Set<string>();
  for (const b of bloques) {
    if (b.tipo !== "productos") continue;
    for (const p of b.items ?? []) {
      const u = (p.url ?? "").trim();
      if (u && u !== "#") out.add(u);
    }
  }
  return [...out];
}

/**
 * ¿La URL es de la tienda de esta marca?
 *
 * 🔴 No es prolijidad: sin esto, cualquiera con permiso de editar podría escribir
 * una URL arbitraria en un bloque y hacer que **el servidor la visite** — un SSRF
 * con el disfraz de un chequeo de links. El único destino legítimo de estas URLs
 * es la tienda de la cuenta, así que se compara el host y punto.
 *
 * ⚠️ Compara el host **sin `www.`**: TN devuelve `canonical_url` con y sin, según
 * la tienda (`stunned.com.ar` guarda `www.stunned.com.ar`), y un chequeo estricto
 * dejaría todas esas URLs "de otro dominio" ⇒ el freno no frenaría nunca.
 */
export function esDeLaTienda(url: string, urlTienda: string | undefined): boolean {
  const host = (u: string) => {
    try {
      return new URL(u).host.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  };
  const h = host(url);
  const t = host(urlTienda ?? "");
  return !!h && !!t && h === t;
}

/** Cuántas se piden a la vez. Son 2-6 por mail; el tope es por las dudas. */
const A_LA_VEZ = 4;
/** Un link que no contesta en 6 s no frena una campaña: ver abajo. */
const TIMEOUT_MS = 6000;

/**
 * De una lista de URLs, las que están **rotas**: sólo 404 y 410.
 *
 * 🔑 **Frena sólo con una respuesta clara.** Un timeout, un 500 o la tienda
 * caída dejan pasar el mail: son estados transitorios, y frenar por ellos sería
 * dejar una campaña esperando por un problema que no es del contenido. Un 404 no
 * es transitorio — es "esa página no existe", que es exactamente lo que hay que
 * evitar mandarle a miles de personas.
 *
 * ⚠️ `GET` y no `HEAD`: hay tiendas de TN que responden 405 a `HEAD`, y eso se
 * leería como "anda" o como "roto" según cómo se interprete. Un `GET` con el
 * cuerpo descartado cuesta un poco más y no deja ambigüedad.
 */
export async function linksRotos(urls: string[]): Promise<string[]> {
  const rotos: string[] = [];
  for (let i = 0; i < urls.length; i += A_LA_VEZ) {
    await Promise.all(
      urls.slice(i, i + A_LA_VEZ).map(async (u) => {
        try {
          const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
          // El cuerpo se descarta, pero hay que consumirlo o el socket queda vivo.
          await r.body?.cancel();
          if (r.status === 404 || r.status === 410) rotos.push(u);
        } catch {
          // Red caída, timeout, DNS: no es un veredicto sobre el link.
        }
      }),
    );
  }
  return rotos;
}

/** El texto que ve una persona cuando el envío se frena por esto. */
export function motivoLinksRotos(rotos: string[], nombres: Map<string, string>): string {
  const lista = rotos.map((u) => nombres.get(u) ?? u).join(", ");
  return rotos.length === 1
    ? `El producto «${lista}» no está publicado en tu tienda: su página da 404 y el mail llevaría a un error. Publicalo y el envío sigue solo.`
    : `Estos productos no están publicados en tu tienda y su página da 404: ${lista}. Publicalos y el envío sigue solo.`;
}

/** Nombre por URL, para que el aviso diga el producto y no un link largo. */
export function nombresPorUrl(bloques: Bloque[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const b of bloques) {
    if (b.tipo !== "productos") continue;
    for (const p of b.items ?? []) if (p.url) m.set(p.url, p.nombre || p.url);
  }
  return m;
}
