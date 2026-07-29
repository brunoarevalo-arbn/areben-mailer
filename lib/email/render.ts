// Convierte el contenido de una campaña (bloques) en HTML de email.
// Los bloques son un JSON simple; más adelante se suma un editor drag-and-drop.
//
// El aspecto (colores, ancho, fuente) vive en lib/email/tema.ts y llega acá ya
// resuelto como `Paleta`. Este archivo no decide de qué color es nada.
import { resolverPaleta, combinarTema, type Paleta, type Tema } from "./tema";
import { leerContenido } from "./esquema";
import {
  resolverEstilo, tonosSobre, extra, px, padCss,
  type CtxEstilo, type EstiloResuelto, type Estilos, type RolEstilo,
} from "./estilos";
import type { Bloque, Columna, ContenidoCampania, ProductoEmail, TipoBloque } from "./bloques";

// Los tipos de bloque viven en bloques.ts (para que esquema.ts los pueda usar
// sin ciclo) pero se re-exportan desde acá: media app importa `Bloque` y
// `nuevoBloque` de "@/lib/email/render" y no hay razón para hacerla cambiar.
export type { Bloque, BloqueBase, TipoBloque, ContenidoCampania, ProductoEmail, Columna } from "./bloques";
export { nuevoBloque, duplicarBloque, nuevoId, TIPOS_BLOQUE } from "./bloques";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const nl = (s: string) => esc(s).replace(/\n/g, "<br>");

/**
 * Todo lo que un bloque necesita para dibujarse.
 *
 * Reemplaza al par `(pal, muestraCarrito)` que se venía pasando suelto: ahora
 * también viajan los estilos del documento, que son la capa (b) de la cascada.
 */
interface Ctx extends CtxEstilo {
  muestraCarrito: boolean;
}

/** Atajo: el estilo de un rol de este bloque, con las cuatro capas aplicadas. */
const est = (
  tipo: TipoBloque,
  rol: RolEstilo,
  ctx: Ctx,
  propio: Estilos | undefined,
  sobre?: string,
): EstiloResuelto => resolverEstilo(tipo, rol, { pal: ctx.pal, doc: ctx.doc, propio }, sobre);

/** Contenedor con padding horizontal para los bloques "de texto". */
const pad = (inner: string, e?: EstiloResuelto) =>
  `<div style="padding:0 ${px(e?.padX ?? 32)}">${inner}</div>`;

/** Ancla de botón. El color sale del acento del tema, no del renderer. */
function botonAnchor(texto: string, url: string, e: EstiloResuelto, full = false): string {
  const w = full ? ";width:100%;box-sizing:border-box;text-align:center" : "";
  const resto = extra(e, ["padX", "padY", "tamano", "peso", "color", "fondo", "radio", "align"]);
  return `<a href="${esc(url || "#")}" style="display:inline-block;${padCss(e.padY, e.padX)};font-size:${px(e.tamano ?? 16)};font-weight:${e.peso ?? 600};color:${e.color};background:${e.fondo};border-radius:${px(e.radio ?? 8)};text-decoration:none${resto}${w}">${esc(texto)}</a>`;
}

function fmtPrecio(v: string): string {
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return "$" + n.toLocaleString("es-AR");
}

/** Precio, con el de lista tachado si hay promo. Compartido por la grilla y el carrito. */
function precioHtml(p: ProductoEmail, pal: Paleta): string {
  return p.precioPromo
    ? `<span style="color:${pal.tenue};text-decoration:line-through;font-size:13px">${fmtPrecio(p.precio)}</span> <span style="color:${pal.texto};font-weight:600">${fmtPrecio(p.precioPromo)}</span>`
    : `<span style="color:${pal.texto};font-weight:600">${fmtPrecio(p.precio)}</span>`;
}

/** Renglón "iPhone 11 · Marrón — 2 u." Vacío si el producto no aporta ninguno de los dos. */
function detalleHtml(p: ProductoEmail, e: EstiloResuelto): string {
  const partes = [p.variante, (p.cantidad ?? 1) > 1 ? `${p.cantidad} u.` : null].filter(Boolean);
  return partes.length
    ? `<div style="margin-top:3px;font-size:${px(e.tamano ?? 13)};color:${e.color}${extra(e, ["tamano", "color"])}">${esc(partes.join(" — "))}</div>`
    : "";
}

function renderCard(p: ProductoEmail, pal: Paleta, eTexto: EstiloResuelto, eNota: EstiloResuelto, eImg: EstiloResuelto): string {
  return `<td width="50%" valign="top" style="padding:8px">
    <a href="${esc(p.url)}" style="text-decoration:none;color:inherit">
      <img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" width="100%" style="max-width:100%;border-radius:${px(eImg.radio ?? 8)};display:block" />
      <div style="margin-top:8px;font-size:${px(eTexto.tamano ?? 14)};color:${eTexto.color}${extra(eTexto, ["tamano", "color"])}">${esc(p.nombre)}</div>
      ${detalleHtml(p, eNota)}
      <div style="margin-top:2px;font-size:${px(eTexto.tamano ?? 14)}">${precioHtml(p, pal)}</div>
    </a>
  </td>`;
}

/**
 * Una línea de carrito: foto | nombre + variante + cantidad | precio.
 *
 * Es la diferencia de fondo con `renderCard`: una grilla de tarjetas dice "mirá
 * estos productos", y un carrito abandonado tiene que decir "esto dejaste".
 */
function renderLineaCarrito(p: ProductoEmail, pal: Paleta, eNombre: EstiloResuelto, eNota: EstiloResuelto, eImg: EstiloResuelto): string {
  const foto = p.imagen
    ? `<img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" width="100%" style="max-width:100%;border-radius:${px(eImg.radio ?? 8)};display:block" />`
    : "";
  return `<tr>
    <td width="25%" valign="top" style="padding:10px 0"><a href="${esc(p.url)}">${foto}</a></td>
    <td valign="top" style="padding:10px 14px">
      <a href="${esc(p.url)}" style="text-decoration:none;color:inherit">
        <div style="font-size:${px(eNombre.tamano ?? 15)};line-height:${eNombre.interlinea ?? 1.35};color:${eNombre.color};font-weight:${eNombre.peso ?? 600}${extra(eNombre, ["tamano", "interlinea", "color", "peso", "align"])}">${esc(p.nombre)}</div>
        ${detalleHtml(p, eNota)}
      </a>
    </td>
    <td width="22%" valign="top" align="right" style="padding:10px 0;font-size:14px;white-space:nowrap">${precioHtml(p, pal)}</td>
  </tr>`;
}

/**
 * El carrito completo. `restantes` es lo que se recortó: se dice, no se esconde
 * — quien dejó 8 productos y ve 6 tiene que enterarse de que hay más.
 *
 * El `${cart.url}` del link lo resuelve el procesador de automations sobre el
 * HTML ya armado, igual que el resto de los links del carrito.
 */
function renderCarrito(items: ProductoEmail[], pal: Paleta, e: EstProducto, restantes = 0): string {
  if (items.length === 0) return "";
  const filas = items
    .map((p) => renderLineaCarrito(p, pal, e.nombre, e.nota, e.img))
    .join(`<tr><td colspan="3" style="border-top:1px solid ${pal.borde};font-size:0;line-height:0">&nbsp;</td></tr>`);
  const mas =
    restantes > 0
      ? `<div style="margin:4px 0 0;font-size:14px;color:${pal.medio}"><a href="\${cart.url}" style="color:${pal.link}">y ${restantes} producto${restantes === 1 ? "" : "s"} más</a></div>`
      : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px">${filas}</table>${mas}`;
}

/** Productos de mentira para el preview del editor. NUNCA salen en un envío real. */
const CARRITO_MUESTRA: ProductoEmail[] = [
  { nombre: "Producto de ejemplo", variante: "Variante · Color", cantidad: 2, precio: "12990", imagen: "", url: "#" },
  { nombre: "Otro producto", variante: "Variante", precio: "10990", precioPromo: "7490", imagen: "", url: "#" },
];

/**
 * Los tres roles que usan la grilla de productos y las líneas del carrito.
 *
 * Van juntos porque las tres funciones que dibujan producto los necesitan a los
 * tres, y resolverlos adentro del loop sería recalcular la cascada por ítem.
 */
interface EstProducto {
  nombre: EstiloResuelto;
  nota: EstiloResuelto;
  img: EstiloResuelto;
}

function estProducto(tipo: TipoBloque, rolNombre: RolEstilo, ctx: Ctx, propio: Estilos | undefined): EstProducto {
  return {
    nombre: est(tipo, rolNombre, ctx, propio),
    nota: est(tipo, "nota", ctx, propio),
    img: est(tipo, "imagen", ctx, propio),
  };
}

/** Render de una grilla de productos, reutilizable (ej. email de carrito abandonado). */
export function renderProductosHtml(items: ProductoEmail[], tema?: Tema): string {
  const pal = resolverPaleta(tema);
  const ctx: Ctx = { pal, muestraCarrito: false };
  return renderProductos(items, pal, estProducto("productos", "cuerpo", ctx, undefined));
}

function renderProductos(items: ProductoEmail[], pal: Paleta, e: EstProducto): string {
  if (items.length === 0) return "";
  const filas: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const a = renderCard(items[i], pal, e.nombre, e.nota, e.img);
    const b = items[i + 1] ? renderCard(items[i + 1], pal, e.nombre, e.nota, e.img) : `<td width="50%"></td>`;
    filas.push(`<tr>${a}${b}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px">${filas.join("")}</table>`;
}

function renderBloque(b: Bloque, ctx: Ctx): string {
  const { pal } = ctx;
  // Los cuatro escalones de la cascada, resueltos para ESTE bloque. `sobre` es
  // el fondo real cuando el bloque trae uno propio: solo pesa si nadie eligió el
  // color a mano.
  const e = (rol: RolEstilo, sobre?: string) => est(b.tipo, rol, ctx, b.estilo, sobre);
  const caja = () => e("caja");

  switch (b.tipo) {
    case "titulo": {
      const t = e("titulo");
      return pad(`<h1 style="margin:16px 0;font-size:${px(t.tamano ?? 26)};line-height:${t.interlinea ?? 1.25};color:${t.color};text-align:${b.align ?? t.align ?? "left"}${extra(t, ["tamano", "interlinea", "color", "align"])}">${esc(b.texto)}</h1>`, caja());
    }
    case "texto": {
      const t = e("cuerpo");
      return pad(`<p style="margin:0 0 16px;font-size:${px(t.tamano ?? 16)};line-height:${t.interlinea ?? 1.6};color:${t.color};text-align:${b.align ?? t.align ?? "left"}${extra(t, ["tamano", "interlinea", "color", "align"])}">${nl(b.texto)}</p>`, caja());
    }
    case "boton": {
      const t = e("boton");
      return pad(`<div style="text-align:${b.align ?? t.align ?? "left"};margin:8px 0 20px">${botonAnchor(b.texto, b.url, t, b.full)}</div>`, caja());
    }
    case "imagen": {
      const t = e("imagen");
      return pad(`<img src="${esc(b.url)}" alt="${esc(b.alt ?? "")}" style="max-width:100%;height:auto;border-radius:${px(t.radio ?? 8)};margin:8px 0 16px;display:block${extra(t, ["radio", "align", "tamano", "color"])}" />`, caja());
    }
    case "productos":
      return pad(renderProductos(b.items ?? [], pal, estProducto(b.tipo, "cuerpo", ctx, b.estilo)), caja());
    case "carrito": {
      // Sin items no se inventa nada: si el carrito llegó vacío, el bloque
      // desaparece. La muestra es solo del preview del editor.
      const items = b.items?.length ? b.items : ctx.muestraCarrito ? CARRITO_MUESTRA : [];
      return pad(
        renderCarrito(items, pal, estProducto(b.tipo, "titulo", ctx, b.estilo), b.items?.length ? b.restantes ?? 0 : 0),
        caja(),
      );
    }
    case "columnas": {
      const t = e("imagen");
      const cell = (c: Columna) =>
        c.imagen
          ? `<td width="50%" valign="top" style="padding:6px"><a href="${esc(c.url || "#")}"><img src="${esc(c.imagen)}" width="100%" style="max-width:100%;border-radius:${px(t.radio ?? 8)};display:block" alt="" /></a></td>`
          : `<td width="50%"></td>`;
      return pad(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px"><tr>${cell(b.izq)}${cell(b.der)}</tr></table>`, caja());
    }
    case "video": {
      const t = e("imagen");
      return b.imagen
        ? pad(`<a href="${esc(b.url || "#")}" style="display:block;position:relative;margin:8px 0 16px"><img src="${esc(b.imagen)}" width="100%" style="max-width:100%;border-radius:${px(t.radio ?? 8)};display:block" alt="Ver video" /><span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:48px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.5)">▶</span></a>`, caja())
        : "";
    }
    case "redes": {
      const t = e("cuerpo");
      return pad(`<div style="text-align:center;margin:16px 0">${(b.links ?? [])
        .filter((l) => l.url)
        .map((l) => `<a href="${esc(l.url)}" style="display:inline-block;margin:0 8px;color:${t.color};font-size:${px(t.tamano ?? 14)};text-decoration:none${extra(t, ["color", "tamano", "align", "subrayado"])}">${esc(l.red)}</a>`)
        .join("")}</div>`, caja());
    }
    case "divisor": {
      const t = e("caja");
      return pad(`<hr style="border:0;border-top:${px(t.bordeAncho ?? 1)} ${t.bordeEstilo ?? "solid"} ${t.bordeColor ?? pal.bordeSuave};margin:24px 0" />`, t);
    }
    case "espaciador": {
      // `font-size:0;line-height:0` no es adorno: sin eso Outlook le mete la
      // altura de línea por defecto y el espacio termina midiendo de más.
      const alto = Math.min(120, Math.max(4, Math.round(b.alto ?? 24)));
      return `<div style="height:${alto}px;font-size:0;line-height:0">&nbsp;</div>`;
    }
    case "hero": {
      const t0 = e("imagen");
      const img = b.imagen ? `<img src="${esc(b.imagen)}" alt="" style="width:100%;display:block;margin:0${extra(t0, ["radio", "align", "color", "tamano"])}" />` : "";
      // El `bg` lo elige el autor, así que el color del texto se decide por ESE
      // fondo y no por el tema: un hero blanco dentro de un mail oscuro tendría
      // título blanco sobre blanco si se heredara la paleta.
      const c = caja();
      const bg = c.autoFondo ? b.bg || pal.tarjeta : c.fondo!;
      const t = b.titulo ? (() => { const x = e("titulo", bg); return `<h1 style="margin:0 0 10px;font-size:${px(x.tamano ?? 30)};line-height:${x.interlinea ?? 1.2};color:${x.color}${extra(x, ["tamano", "interlinea", "color", "align"])}">${esc(b.titulo)}</h1>`; })() : "";
      const s = b.subtitulo ? (() => { const x = e("subtitulo", bg); return `<p style="margin:0 0 20px;font-size:${px(x.tamano ?? 17)};line-height:${x.interlinea ?? 1.5};color:${x.color}${extra(x, ["tamano", "interlinea", "color", "align"])}">${esc(b.subtitulo)}</p>`; })() : "";
      const btn = b.botonTexto ? botonAnchor(b.botonTexto, b.botonUrl, e("boton")) : "";
      const cajaHtml = t || s || btn ? `<div style="background:${esc(bg)};${padCss(c.padY ?? 36, c.padX ?? 32)};text-align:center${extra(c, ["fondo", "padX", "padY", "align"])}">${t}${s}${btn}</div>` : "";
      return `${img}${cajaHtml}`;
    }
    case "seccion": {
      const c = caja();
      const bg = c.autoFondo ? b.bg || pal.seccion : c.fondo!;
      const t = b.titulo ? (() => { const x = e("titulo", bg); return `<h2 style="margin:0 0 8px;font-size:${px(x.tamano ?? 22)};line-height:${x.interlinea ?? 1.3};color:${x.color}${extra(x, ["tamano", "interlinea", "color", "align"])}">${esc(b.titulo)}</h2>`; })() : "";
      const tx = b.texto ? (() => { const x = e("subtitulo", bg); return `<p style="margin:0 0 16px;font-size:${px(x.tamano ?? 16)};line-height:${x.interlinea ?? 1.6};color:${x.color}${extra(x, ["tamano", "interlinea", "color", "align"])}">${nl(b.texto)}</p>`; })() : "";
      const btn = b.botonTexto ? botonAnchor(b.botonTexto, b.botonUrl, e("boton")) : "";
      return `<div style="background:${esc(bg)};${padCss(c.padY ?? 32, c.padX ?? 32)};text-align:center${extra(c, ["fondo", "padX", "padY", "align"])}">${t}${tx}${btn}</div>`;
    }
    case "cupon": {
      const c = caja();
      const bg = c.fondo ?? pal.cuponFondo;
      const t = b.texto ? (() => { const x = e("cuerpo", bg); return `<div style="font-size:${px(x.tamano ?? 16)};color:${x.color}${extra(x, ["tamano", "color", "align"])};margin-bottom:8px">${esc(b.texto)}</div>`; })() : "";
      const cod = b.codigo ? (() => { const x = e("titulo"); return `<div style="font-size:${px(x.tamano ?? 26)};font-weight:${x.peso ?? 700};letter-spacing:${px(x.espaciado ?? 3)};color:${x.color}${extra(x, ["tamano", "peso", "espaciado", "color", "align", "interlinea"])};margin-bottom:14px">${esc(b.codigo)}</div>`; })() : "";
      const btn = b.botonTexto ? botonAnchor(b.botonTexto, b.botonUrl, e("boton")) : "";
      return pad(`<div style="border:${px(c.bordeAncho ?? 2)} ${c.bordeEstilo ?? "dashed"} ${c.bordeColor ?? pal.acento};border-radius:${px(c.radio ?? 12)};background:${bg};${padCss(c.padY ?? 24, c.padX ?? 24)};text-align:center;margin:8px 0 16px">${t}${cod}${btn}</div>`, undefined);
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
  /**
   * Solo para el preview del editor: dibuja el bloque `carrito` con productos de
   * muestra para que se vea cómo va a quedar.
   *
   * ⛔ Nunca en un envío real. En el envío, un carrito sin items no se dibuja.
   */
  muestraCarrito?: boolean;
  /** Tema por defecto de la marca (`Cuenta.config.tema`). Lo pisa el de la campaña. */
  temaMarca?: Tema | null;
}

/** Renderiza el contenido a un HTML de email completo (shell + bloques + footer). */
export function renderEmailHtml(entrada: ContenidoCampania, opts: RenderOpts): string {
  // Cinturón y tiradores: los call sites ya normalizan, pero si alguno se olvida
  // el mail sale igual bien. Es barato — un contenido que ya está en la versión
  // actual se devuelve tal cual, sin recorrer nada.
  const contenido = leerContenido(entrada);
  // El tema de la campaña pisa al de la marca, campo por campo.
  const pal = resolverPaleta(combinarTema(opts.temaMarca, contenido.tema));
  const ctx: Ctx = { pal, doc: contenido.estilos, muestraCarrito: !!opts.muestraCarrito };
  const cuerpo = (contenido.bloques ?? [])
    .map((b) => renderBloque(b, ctx))
    .join("\n");
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>`
    : "";

  // Sin borde cuando la tarjeta y el fondo son el mismo color: dibujar un
  // recuadro alrededor de algo que no se distingue del fondo se ve como una
  // línea suelta, no como una tarjeta. Es el "transparent" del editor de BEE.
  const aSangre = pal.tarjeta.toLowerCase() === pal.fondo.toLowerCase();
  const cajaCuerpo = aSangre
    ? `background:${pal.tarjeta}`
    : `background:${pal.tarjeta};border:1px solid ${pal.borde};border-radius:12px`;

  return `<!doctype html>
<html lang="${esc(pal.idioma)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:${pal.fondo};font-family:${pal.fuente}">
  ${preheader}
  <div style="max-width:${pal.ancho}px;margin:0 auto;padding:24px 16px">
    <!-- Encabezado de marca -->
    <div style="text-align:center;padding:8px 0 16px">
      <span style="font-size:18px;font-weight:700;letter-spacing:1px;color:${tonosSobre(pal.fondo).texto}">${esc(opts.nombreCuenta.toUpperCase())}</span>
      <div style="width:40px;height:3px;background:${pal.acento};margin:10px auto 0;border-radius:2px"></div>
    </div>
    <!-- Cuerpo -->
    <div style="${cajaCuerpo};overflow:hidden">
      <div style="height:12px"></div>
      ${cuerpo}
      <div style="height:16px"></div>
    </div>
    <!-- Footer -->
    <div style="text-align:center;color:${pal.tenue};font-size:12px;line-height:1.6;margin-top:20px">
      ${esc(opts.nombreCuenta)}${opts.direccionPostal ? " · " + esc(opts.direccionPostal) : ""}<br>
      <a href="${esc(opts.unsubscribeUrl)}" style="color:${pal.tenue}">Desuscribirme</a>
    </div>
  </div>
</body></html>`;
}

/** Un bloque, en texto. `null` = no aporta nada legible (imágenes sueltas, etc.). */
function bloqueATexto(b: Bloque): string | null {
  const link = (texto: string, url?: string) => (url ? `${texto}: ${url}` : texto);
  /** "PRINT CASE (iPhone 11 · Marrón, 2 u.) — 7490". Mismo dato que la línea HTML. */
  const lineaTexto = (p: ProductoEmail) => {
    const detalle = [p.variante, (p.cantidad ?? 1) > 1 ? `${p.cantidad} u.` : null].filter(Boolean);
    // Mismo formato que el HTML: TN devuelve "10990.00" y en el mail va "$10.990".
    const precio = p.precioPromo || p.precio;
    return `${p.nombre}${detalle.length ? ` (${detalle.join(", ")})` : ""}${precio ? ` — ${fmtPrecio(precio)}` : ""}`;
  };
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
      return (b.items ?? []).map((p) => link(`· ${lineaTexto(p)}`, p.url)).join("\n") || null;
    case "carrito": {
      const lineas = (b.items ?? []).map((p) => link(`· ${lineaTexto(p)}`, p.url));
      if (!lineas.length) return null;
      const r = b.restantes ?? 0;
      if (r > 0) lineas.push(`y ${r} producto${r === 1 ? "" : "s"} más: \${cart.url}`);
      return lineas.join("\n");
    }
    case "columnas":
      return [b.izq?.url, b.der?.url].filter(Boolean).join("\n") || null;
    case "video":
      return b.url ? `Ver el video: ${b.url}` : null;
    case "redes":
      return (b.links ?? []).filter((l) => l.url).map((l) => link(l.red, l.url)).join("\n") || null;
    case "divisor":
      return "—";
    case "espaciador":
      // No aporta nada legible: en texto plano el aire ya lo dan los saltos.
      return null;
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
export function renderEmailTexto(entrada: ContenidoCampania, opts: RenderOpts): string {
  const contenido = leerContenido(entrada);
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
