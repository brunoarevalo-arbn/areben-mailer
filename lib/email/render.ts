// Convierte el contenido de una campaña (bloques) en HTML de email.
// Los bloques son un JSON simple; más adelante se suma un editor drag-and-drop.

export interface ProductoEmail {
  nombre: string;
  precio: string;
  precioPromo?: string;
  imagen: string;
  url: string;
}

export interface Columna {
  imagen: string;
  url: string;
}

export type Bloque =
  | { tipo: "titulo"; texto: string }
  | { tipo: "texto"; texto: string }
  | { tipo: "boton"; texto: string; url: string }
  | { tipo: "imagen"; url: string; alt?: string }
  | { tipo: "productos"; items: ProductoEmail[] }
  | { tipo: "columnas"; izq: Columna; der: Columna }
  | { tipo: "video"; imagen: string; url: string }
  | { tipo: "redes"; links: { red: string; url: string }[] }
  | { tipo: "divisor" };

export interface ContenidoCampania {
  bloques: Bloque[];
}

/** Bloque inicial por tipo, compartido por todos los editores de contenido. */
export function nuevoBloque(tipo: Bloque["tipo"]): Bloque {
  switch (tipo) {
    case "titulo": return { tipo, texto: "Título" };
    case "texto": return { tipo, texto: "Escribí tu mensaje. Podés usar ${contacto.nombre}." };
    case "boton": return { tipo, texto: "Ver más", url: "https://bdiaccesorios.com.ar" };
    case "imagen": return { tipo, url: "", alt: "" };
    case "productos": return { tipo, items: [] };
    case "columnas": return { tipo, izq: { imagen: "", url: "" }, der: { imagen: "", url: "" } };
    case "video": return { tipo, imagen: "", url: "" };
    case "redes": return { tipo, links: [{ red: "Instagram", url: "" }] };
    case "divisor": return { tipo };
  }
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function fmtPrecio(v: string): string {
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return "$" + n.toLocaleString("es-AR");
}

function renderCard(p: ProductoEmail): string {
  const precio = p.precioPromo
    ? `<span style="color:#a3a3a3;text-decoration:line-through;font-size:13px">${fmtPrecio(p.precio)}</span> <span style="color:#171717;font-weight:600">${fmtPrecio(p.precioPromo)}</span>`
    : `<span style="color:#171717;font-weight:600">${fmtPrecio(p.precio)}</span>`;
  return `<td width="50%" valign="top" style="padding:8px">
    <a href="${esc(p.url)}" style="text-decoration:none;color:inherit">
      <img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" width="100%" style="max-width:100%;border-radius:8px;display:block" />
      <div style="margin-top:8px;font-size:14px;color:#404040">${esc(p.nombre)}</div>
      <div style="margin-top:2px;font-size:14px">${precio}</div>
    </a>
  </td>`;
}

/** Render de una grilla de productos, reutilizable (ej. email de carrito abandonado). */
export function renderProductosHtml(items: ProductoEmail[]): string {
  return renderProductos(items);
}

function renderProductos(items: ProductoEmail[]): string {
  if (items.length === 0) return "";
  const filas: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const a = renderCard(items[i]);
    const b = items[i + 1] ? renderCard(items[i + 1]) : `<td width="50%"></td>`;
    filas.push(`<tr>${a}${b}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px">${filas.join("")}</table>`;
}

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
    case "productos":
      return renderProductos(b.items ?? []);
    case "columnas": {
      const cell = (c: Columna) =>
        c.imagen
          ? `<td width="50%" valign="top" style="padding:6px"><a href="${esc(c.url || "#")}"><img src="${esc(c.imagen)}" width="100%" style="max-width:100%;border-radius:8px;display:block" alt="" /></a></td>`
          : `<td width="50%"></td>`;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px"><tr>${cell(b.izq)}${cell(b.der)}</tr></table>`;
    }
    case "video":
      return b.imagen
        ? `<a href="${esc(b.url || "#")}" style="display:block;position:relative;margin:0 0 16px"><img src="${esc(b.imagen)}" width="100%" style="max-width:100%;border-radius:8px;display:block" alt="Ver video" /><span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:48px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.5)">▶</span></a>`
        : "";
    case "redes":
      return `<div style="text-align:center;margin:16px 0">${(b.links ?? [])
        .filter((l) => l.url)
        .map((l) => `<a href="${esc(l.url)}" style="display:inline-block;margin:0 8px;color:#404040;font-size:14px;text-decoration:none">${esc(l.red)}</a>`)
        .join("")}</div>`;
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
