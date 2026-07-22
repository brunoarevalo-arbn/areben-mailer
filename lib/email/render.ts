// Convierte el contenido de una campaña (bloques) en HTML de email.
// Los bloques son un JSON simple; más adelante se suma un editor drag-and-drop.

export type Bloque =
  | { tipo: "titulo"; texto: string }
  | { tipo: "texto"; texto: string }
  | { tipo: "boton"; texto: string; url: string }
  | { tipo: "imagen"; url: string; alt?: string }
  | { tipo: "divisor" };

export interface ContenidoCampania {
  bloques: Bloque[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renderBloque(b: Bloque): string {
  switch (b.tipo) {
    case "titulo":
      return `<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#171717">${esc(b.texto)}</h1>`;
    case "texto":
      return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#404040">${esc(b.texto).replace(/\n/g, "<br>")}</p>`;
    case "boton":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="border-radius:8px;background:#f59e0b">
        <a href="${esc(b.url)}" style="display:inline-block;padding:12px 24px;font-size:16px;font-weight:600;color:#fff;text-decoration:none">${esc(b.texto)}</a>
      </td></tr></table>`;
    case "imagen":
      return `<img src="${esc(b.url)}" alt="${esc(b.alt ?? "")}" style="max-width:100%;height:auto;border-radius:8px;margin:0 0 16px;display:block" />`;
    case "divisor":
      return `<hr style="border:0;border-top:1px solid #e5e5e5;margin:24px 0" />`;
    default:
      return "";
  }
}

export interface RenderOpts {
  preheader?: string;
  unsubscribeUrl: string;
  nombreCuenta: string;
  direccionPostal?: string;
}

/** Renderiza el contenido a un HTML de email completo (shell + bloques + footer). */
export function renderEmailHtml(contenido: ContenidoCampania, opts: RenderOpts): string {
  const cuerpo = (contenido.bloques ?? []).map(renderBloque).join("\n");
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>`
    : "";

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
  ${preheader}
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <div style="background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:32px">
      ${cuerpo}
    </div>
    <div style="text-align:center;color:#a3a3a3;font-size:12px;line-height:1.5;margin-top:16px">
      ${esc(opts.nombreCuenta)}${opts.direccionPostal ? " · " + esc(opts.direccionPostal) : ""}<br>
      <a href="${esc(opts.unsubscribeUrl)}" style="color:#a3a3a3">Desuscribirme</a>
    </div>
  </div>
</body></html>`;
}

/** Reemplaza merge tags (${contacto.nombre}, etc.) con datos del contacto. */
export function aplicarMergeTags(
  html: string,
  contacto: { nombre?: string | null; email: string },
): string {
  return html
    .replace(/\$\{contacto\.nombre\}/g, contacto.nombre ?? "")
    .replace(/\$\{contacto\.email\}/g, contacto.email);
}
