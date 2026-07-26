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
  | { tipo: "titulo"; texto: string; align?: "left" | "center" }
  | { tipo: "texto"; texto: string; align?: "left" | "center" }
  | { tipo: "boton"; texto: string; url: string; align?: "left" | "center"; full?: boolean }
  | { tipo: "imagen"; url: string; alt?: string }
  | { tipo: "productos"; items: ProductoEmail[] }
  | { tipo: "columnas"; izq: Columna; der: Columna }
  | { tipo: "video"; imagen: string; url: string }
  | { tipo: "redes"; links: { red: string; url: string }[] }
  | { tipo: "divisor" }
  // Bloques "ricos"
  | { tipo: "hero"; imagen: string; titulo: string; subtitulo: string; botonTexto: string; botonUrl: string; bg: string }
  | { tipo: "seccion"; bg: string; titulo: string; texto: string; botonTexto: string; botonUrl: string }
  | { tipo: "cupon"; texto: string; codigo: string; botonTexto: string; botonUrl: string };

export interface ContenidoCampania {
  bloques: Bloque[];
}

/** Bloque inicial por tipo, compartido por todos los editores de contenido. */
export function nuevoBloque(tipo: Bloque["tipo"]): Bloque {
  switch (tipo) {
    case "titulo": return { tipo, texto: "Título", align: "left" };
    case "texto": return { tipo, texto: "Escribí tu mensaje. Podés usar ${contacto.nombre}.", align: "left" };
    case "boton": return { tipo, texto: "Ver más", url: "", align: "left", full: false };
    case "imagen": return { tipo, url: "", alt: "" };
    case "productos": return { tipo, items: [] };
    case "columnas": return { tipo, izq: { imagen: "", url: "" }, der: { imagen: "", url: "" } };
    case "video": return { tipo, imagen: "", url: "" };
    case "redes": return { tipo, links: [{ red: "Instagram", url: "" }] };
    case "divisor": return { tipo };
    case "hero": return { tipo, imagen: "", titulo: "Título principal", subtitulo: "Un subtítulo que acompaña", botonTexto: "Ver más", botonUrl: "", bg: "#ffffff" };
    case "seccion": return { tipo, bg: "#faf7f0", titulo: "Título de sección", texto: "Texto de la sección.", botonTexto: "", botonUrl: "" };
    case "cupon": return { tipo, texto: "Usá este código en el checkout", codigo: "DESCUENTO10", botonTexto: "Comprar", botonUrl: "" };
  }
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const nl = (s: string) => esc(s).replace(/\n/g, "<br>");

/** Contenedor con padding horizontal para los bloques "de texto". */
const pad = (inner: string) => `<div style="padding:0 32px">${inner}</div>`;

/** Ancla de botón (relleno ámbar). */
function botonAnchor(texto: string, url: string, full = false): string {
  const w = full ? ";width:100%;box-sizing:border-box;text-align:center" : "";
  return `<a href="${esc(url || "#")}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#ffffff;background:#f59e0b;border-radius:8px;text-decoration:none${w}">${esc(texto)}</a>`;
}

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
      return pad(`<h1 style="margin:16px 0;font-size:26px;line-height:1.25;color:#171717;text-align:${b.align ?? "left"}">${esc(b.texto)}</h1>`);
    case "texto":
      return pad(`<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#404040;text-align:${b.align ?? "left"}">${nl(b.texto)}</p>`);
    case "boton":
      return pad(`<div style="text-align:${b.align ?? "left"};margin:8px 0 20px">${botonAnchor(b.texto, b.url, b.full)}</div>`);
    case "imagen":
      return pad(`<img src="${esc(b.url)}" alt="${esc(b.alt ?? "")}" style="max-width:100%;height:auto;border-radius:8px;margin:8px 0 16px;display:block" />`);
    case "productos":
      return pad(renderProductos(b.items ?? []));
    case "columnas": {
      const cell = (c: Columna) =>
        c.imagen
          ? `<td width="50%" valign="top" style="padding:6px"><a href="${esc(c.url || "#")}"><img src="${esc(c.imagen)}" width="100%" style="max-width:100%;border-radius:8px;display:block" alt="" /></a></td>`
          : `<td width="50%"></td>`;
      return pad(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px"><tr>${cell(b.izq)}${cell(b.der)}</tr></table>`);
    }
    case "video":
      return b.imagen
        ? pad(`<a href="${esc(b.url || "#")}" style="display:block;position:relative;margin:8px 0 16px"><img src="${esc(b.imagen)}" width="100%" style="max-width:100%;border-radius:8px;display:block" alt="Ver video" /><span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:48px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.5)">▶</span></a>`)
        : "";
    case "redes":
      return pad(`<div style="text-align:center;margin:16px 0">${(b.links ?? [])
        .filter((l) => l.url)
        .map((l) => `<a href="${esc(l.url)}" style="display:inline-block;margin:0 8px;color:#525252;font-size:14px;text-decoration:none">${esc(l.red)}</a>`)
        .join("")}</div>`);
    case "divisor":
      return pad(`<hr style="border:0;border-top:1px solid #e5e5e5;margin:24px 0" />`);
    case "hero": {
      const img = b.imagen ? `<img src="${esc(b.imagen)}" alt="" style="width:100%;display:block;margin:0" />` : "";
      const t = b.titulo ? `<h1 style="margin:0 0 10px;font-size:30px;line-height:1.2;color:#171717">${esc(b.titulo)}</h1>` : "";
      const s = b.subtitulo ? `<p style="margin:0 0 20px;font-size:17px;line-height:1.5;color:#525252">${esc(b.subtitulo)}</p>` : "";
      const btn = b.botonTexto ? botonAnchor(b.botonTexto, b.botonUrl) : "";
      const caja = t || s || btn ? `<div style="background:${esc(b.bg || "#ffffff")};padding:36px 32px;text-align:center">${t}${s}${btn}</div>` : "";
      return `${img}${caja}`;
    }
    case "seccion": {
      const t = b.titulo ? `<h2 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#171717">${esc(b.titulo)}</h2>` : "";
      const tx = b.texto ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#525252">${nl(b.texto)}</p>` : "";
      const btn = b.botonTexto ? botonAnchor(b.botonTexto, b.botonUrl) : "";
      return `<div style="background:${esc(b.bg || "#faf7f0")};padding:32px;text-align:center">${t}${tx}${btn}</div>`;
    }
    case "cupon": {
      const t = b.texto ? `<div style="font-size:16px;color:#404040;margin-bottom:8px">${esc(b.texto)}</div>` : "";
      const cod = b.codigo ? `<div style="font-size:26px;font-weight:700;letter-spacing:3px;color:#b45309;margin-bottom:14px">${esc(b.codigo)}</div>` : "";
      const btn = b.botonTexto ? botonAnchor(b.botonTexto, b.botonUrl) : "";
      return pad(`<div style="border:2px dashed #f59e0b;border-radius:12px;background:#fffbeb;padding:24px;text-align:center;margin:8px 0 16px">${t}${cod}${btn}</div>`);
    }
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
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
  ${preheader}
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <!-- Encabezado de marca -->
    <div style="text-align:center;padding:8px 0 16px">
      <span style="font-size:18px;font-weight:700;letter-spacing:1px;color:#171717">${esc(opts.nombreCuenta.toUpperCase())}</span>
      <div style="width:40px;height:3px;background:#f59e0b;margin:10px auto 0;border-radius:2px"></div>
    </div>
    <!-- Cuerpo -->
    <div style="background:#ffffff;border:1px solid #ececec;border-radius:12px;overflow:hidden">
      <div style="height:12px"></div>
      ${cuerpo}
      <div style="height:16px"></div>
    </div>
    <!-- Footer -->
    <div style="text-align:center;color:#a3a3a3;font-size:12px;line-height:1.6;margin-top:20px">
      ${esc(opts.nombreCuenta)}${opts.direccionPostal ? " · " + esc(opts.direccionPostal) : ""}<br>
      <a href="${esc(opts.unsubscribeUrl)}" style="color:#a3a3a3">Desuscribirme</a>
    </div>
  </div>
</body></html>`;
}

/** Un bloque, en texto. `null` = no aporta nada legible (imágenes sueltas, etc.). */
function bloqueATexto(b: Bloque): string | null {
  const link = (texto: string, url?: string) => (url ? `${texto}: ${url}` : texto);
  switch (b.tipo) {
    case "titulo":
      return b.texto;
    case "texto":
      return b.texto;
    case "boton":
      return b.url ? link(b.texto, b.url) : b.texto;
    case "imagen":
      return b.alt ? `[${b.alt}]` : null;
    case "productos":
      return (b.items ?? []).map((p) => link(`· ${p.nombre}${p.precio ? ` — ${p.precio}` : ""}`, p.url)).join("\n") || null;
    case "columnas":
      return [b.izq?.url, b.der?.url].filter(Boolean).join("\n") || null;
    case "video":
      return b.url ? `Ver el video: ${b.url}` : null;
    case "redes":
      return (b.links ?? []).filter((l) => l.url).map((l) => link(l.red, l.url)).join("\n") || null;
    case "divisor":
      return "—";
    case "hero":
      return [b.titulo, b.subtitulo, b.botonTexto ? link(b.botonTexto, b.botonUrl) : null].filter(Boolean).join("\n") || null;
    case "seccion":
      return [b.titulo, b.texto, b.botonTexto ? link(b.botonTexto, b.botonUrl) : null].filter(Boolean).join("\n") || null;
    case "cupon":
      return [b.texto, b.codigo, b.botonTexto ? link(b.botonTexto, b.botonUrl) : null].filter(Boolean).join("\n") || null;
    default:
      return null;
  }
}

/**
 * Versión en texto plano del mismo contenido.
 *
 * No es un adorno: un mail **solo HTML**, sin parte `text/plain`, es una señal de
 * spam clásica —así se ve un bot— y pesa sobre todo en Outlook/Hotmail. Además es
 * lo que leen los lectores de pantalla, los relojes y quien tenga el cliente en
 * modo texto.
 *
 * Ojo: el HTML lleva el tracking inyectado y este texto NO. Es a propósito — las
 * URLs de redirección en texto plano se ven horribles y espantan más de lo que
 * miden. El costo es que un click desde la versión texto no queda registrado.
 */
export function renderEmailTexto(contenido: ContenidoCampania, opts: RenderOpts): string {
  const cuerpo = (contenido.bloques ?? [])
    .map(bloqueATexto)
    .filter((t): t is string => !!t && t.trim() !== "")
    .join("\n\n");

  return [
    opts.nombreCuenta.toUpperCase(),
    "",
    cuerpo,
    "",
    "—",
    opts.direccionPostal ? `${opts.nombreCuenta} · ${opts.direccionPostal}` : opts.nombreCuenta,
    `Para no recibir más estos correos: ${opts.unsubscribeUrl}`,
  ].join("\n");
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
