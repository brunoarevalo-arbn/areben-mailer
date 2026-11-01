/**
 * Un mail que YA ES un documento HTML entero (`formato: "completo"`).
 *
 * Existe porque el bloque `html` no alcanza para una pieza diseñada aparte: va
 * ADENTRO de la tarjeta del motor, así que pierde el `<style>` del `<head>` (la
 * grilla 2×2 del celular) y le suma el encabezado y el pie de la marca, que
 * duplican el logo y el «Desuscribirme». Nació con los dos mails del Cyber
 * 2026, aprobados como maqueta.
 *
 * 🔴 El motor ⛔ dibuja nada acá, pero **el link de baja sigue sin poder faltar**:
 * si el documento no trae el marcador, se agrega un renglón antes de `</body>`.
 * El tracking lo pone después `inyectarTracking`, igual que a cualquier mail.
 *
 * Puro: lo importan el renderer y el procesador, y lo prueba
 * `scripts/probar-html-completo.ts`.
 */

/** Dónde va el link de baja adentro del documento: `href="${baja}"`. */
export const MARCADOR_BAJA = "${baja}";

/** El HTML que sale, con el link de baja de ESTE envío. */
export function armarHtmlCompleto(html: string, unsubscribeUrl: string): string {
  if (html.includes(MARCADOR_BAJA)) return html.split(MARCADOR_BAJA).join(unsubscribeUrl);
  const renglon = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;text-align:center;padding:12px"><a href="${unsubscribeUrl}" style="color:#666666;text-decoration:underline">Desuscribirme</a></div>`;
  return html.includes("</body>") ? html.replace("</body>", `${renglon}</body>`) : html + renglon;
}

const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " ", ntilde: "ñ", Ntilde: "Ñ", aacute: "á", eacute: "é",
  iacute: "í", oacute: "ó", uacute: "ú", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", middot: "·",
};

function decodificar(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== "#") return ENTIDADES[e] ?? m;
    const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : m;
  });
}

/**
 * La parte text/plain. Un mail solo-HTML es señal de spam, y de acá saca el
 * buzón lo que no puede dibujar.
 *
 * ⛔ Lo oculto no se manda (el preheader escondido va por su lado): es la misma
 * regla de `probar-precio-oculto.ts`. Los botones conservan su destino, porque
 * un «COMPRAR» sin link no le sirve a nadie.
 */
export function textoDeHtmlCompleto(html: string, unsubscribeUrl: string): string {
  const cuerpo = html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<div\b[^>]*display:\s*none[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<a\b[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, url: string, dentro: string) => {
      const texto = dentro.replace(/<[^>]+>/g, " ").trim();
      return texto ? `${texto} (${url}) ` : "";
    })
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (m) => (m.includes(MARCADOR_BAJA) ? "" : m))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(tr|div|h[1-6]|p|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const limpio = decodificar(cuerpo)
    .replace(/[ \t ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
  return `${limpio}\n\nDesuscribirme: ${unsubscribeUrl}`;
}

/** Las fichas de producto que nombra el documento, sin repetir y sin parámetros. */
export function urlsDeProductoEnHtml(html: string): string[] {
  const urls = [...html.matchAll(/href="(https?:\/\/[^"]+\/productos\/[^"?#]+)/gi)].map((m) => m[1]);
  return [...new Set(urls)];
}
