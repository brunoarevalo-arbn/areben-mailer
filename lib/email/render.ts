// Convierte el contenido de una campaña (bloques) en HTML de email.
// Los bloques son un JSON simple; más adelante se suma un editor drag-and-drop.
//
// El aspecto (colores, ancho, fuente) vive en lib/email/tema.ts y llega acá ya
// resuelto como `Paleta`. Este archivo no decide de qué color es nada.
import { resolverPaleta, combinarTema, type Paleta, type Tema } from "./tema";
import { leerContenido } from "./esquema";
import {
  resolverEstilo, extra, px, padCss,
  type CtxEstilo, type EstiloResuelto, type Estilos, type RolEstilo,
} from "./estilos";
import { cabeza, apertura, cierre, botonVml, clase, clasesDe, CLASES } from "./shell";
import { claveProductos } from "./bloques";
import { redConIcono, urlIcono } from "./redes";
import type { Bloque, Columna, ContenidoCampania, PorFila, PorFilaMovil, ProductoEmail, TipoBloque } from "./bloques";

// Los tipos de bloque viven en bloques.ts (para que esquema.ts los pueda usar
// sin ciclo) pero se re-exportan desde acá: media app importa `Bloque` y
// `nuevoBloque` de "@/lib/email/render" y no hay razón para hacerla cambiar.
export type { Bloque, BloqueBase, TipoBloque, ContenidoCampania, ProductoEmail, Columna, PorFilaMovil, PorFila } from "./bloques";
export { nuevoBloque, duplicarBloque, nuevoId, TIPOS_BLOQUE, ETIQUETA_BLOQUE } from "./bloques";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const nl = (s: string) => esc(s).replace(/\n/g, "<br>");

/**
 * Un color de la base a `rgba(...)`, para poder pintarlo semitransparente.
 *
 * ⚠️ **NO escapa: parsea.** `esc()` no escapa comillas, así que un color con una
 * comilla adentro se escaparía del atributo `style="…"`. Acá lo único que sale
 * son números que salieron de un `parseInt` propio: si la entrada no es un hex
 * de 3 o 6 dígitos —un `rgb()`, un nombre de color, basura, un intento de
 * inyección— se cae a negro, que es un velo válido y no rompe nada. Es la misma
 * postura que `hex()` y `px()` en `estilos.ts`.
 */
function rgba(color: string, alfa: number): string {
  const c = canal(color);
  const [r, g, b] = c ?? [0, 0, 0];
  const a = Math.min(1, Math.max(0, alfa));
  return `rgba(${r},${g},${b},${a.toFixed(2)})`;
}

/** `#f0a` / `#ff00aa` → `[255, 0, 170]`. `null` si no es un hex. */
function canal(color: string): [number, number, number] | null {
  const h = String(color ?? "").trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [full.slice(0, 2), full.slice(2, 4), full.slice(4, 6)].map((x) => parseInt(x, 16)) as [number, number, number];
}

/**
 * Un color que se puede escribir adentro de un `style="…"` sin miedo.
 *
 * 🔴 **`esc()` NO alcanza para un color y nunca alcanzó**: no escapa comillas,
 * así que un `bg` como `#fff" onload="alert(1)` —que llega crudo del Json del
 * bloque, no de la cascada de estilos, que sí lo sanea— cierra el atributo y lo
 * que sigue son atributos del `<div>`. Es la regla que AGENTS.md ya pedía
 * ("ningún string del Json llega al HTML sin pasar por `hex()`, `px()` o un
 * enum") y que estos cuatro call sites se venían salteando.
 *
 * Devuelve el hex normalizado, o `respaldo` si la entrada no es un hex.
 */
function colorCss(color: string | undefined, respaldo: string): string {
  const c = canal(color ?? "");
  if (!c) return respaldo;
  return `#${c.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Todo lo que un bloque necesita para dibujarse.
 *
 * Reemplaza al par `(pal, muestraCarrito)` que se venía pasando suelto: ahora
 * también viajan los estilos del documento, que son la capa (b) de la cascada.
 */
interface Ctx extends CtxEstilo {
  muestraCarrito: boolean;
  /** Productos ya resueltos por consulta. Ver `RenderOpts.productosDinamicos`. */
  productosDinamicos?: Record<string, ProductoEmail[]>;
  /**
   * Nombre de la marca. Lo usa el bloque `encabezado` cuando no trae texto
   * propio, que es el caso normal: así una plantilla no lleva la marca adentro.
   */
  nombreCuenta: string;
  /** Logo y sitio de la marca (`Cuenta.config`, los trae TN). Ídem: defaults. */
  logoCuenta: string;
  urlCuenta: string;
  /** De dónde salen los iconos de `redes`. Ver `RenderOpts.assetsBase`. */
  assetsBase: string;
  /** Las redes de la marca, para el bloque que no trae links. Ver `RenderOpts`. */
  redesMarca: { red: string; url: string }[];
  /**
   * ¿Esta CUENTA puede usar el bloque `html`? No es el permiso del usuario que
   * edita —al enviar no hay usuario, solo cuenta—. Ausente/`false` = el bloque
   * no se dibuja aunque el Json lo tenga. Ver `Cuenta.config.htmlCrudoHabilitado`.
   */
  permiteHtmlCrudo: boolean;
}

/** Atajo: el estilo de un rol de este bloque, con las cuatro capas aplicadas. */
const est = (
  tipo: TipoBloque,
  rol: RolEstilo,
  ctx: Ctx,
  propio: Estilos | undefined,
  sobre?: string,
): EstiloResuelto => resolverEstilo(tipo, rol, { pal: ctx.pal, doc: ctx.doc, propio }, sobre);

/**
 * La clase que achica un título en el celular.
 *
 * Solo si **nadie eligió el tamaño**: si alguien puso 40px y la media query lo
 * bajara a 22 igual, el control del panel sería mentira — el mail se vería
 * distinto de lo que muestra el editor.
 */
const clasesTitulo = (e: EstiloResuelto): string[] => [
  e.elegidas.has("tamano") ? "" : CLASES.titulo,
  ...clasesDe(e),
].filter(Boolean);

/** Contenedor con padding horizontal para los bloques "de texto". */
const pad = (inner: string, e?: EstiloResuelto) =>
  `<div${clase(CLASES.pad, ...(e ? clasesDe(e) : []))} style="padding:0 ${px(e?.padX ?? 32)}">${inner}</div>`;

/**
 * Botón: el VML para Outlook de escritorio y el ancla para todo el resto.
 *
 * Los dos van siempre. El ancla queda envuelta en `<!--[if !mso]><!-->` porque
 * si no Outlook dibuja los dos, uno abajo del otro.
 */
function botonAnchor(texto: string, url: string, e: EstiloResuelto, pal: Paleta, full = false): string {
  const w = full ? ";width:100%;box-sizing:border-box;text-align:center" : "";
  const resto = extra(e, ["padX", "padY", "tamano", "peso", "color", "fondo", "radio", "align"]);
  const a = `<a href="${esc(url || "#")}" style="display:inline-block;${padCss(e.padY, e.padX)};font-size:${px(e.tamano ?? 16)};font-weight:${e.peso ?? 600};color:${e.color};background:${e.fondo};border-radius:${px(e.radio ?? 8)};text-decoration:none${resto}${w}">${esc(texto)}</a>`;
  return `${botonVml(esc(texto), esc(url || "#"), e, pal, full)}<!--[if !mso]><!-->${a}<!--<![endif]-->`;
}

/**
 * Una banda con una foto de fondo y el texto ENCIMA, no arriba.
 *
 * La escribió el `hero` y la usa también `seccion` desde el 1-ago-2026: 4 de las
 * 21 referencias de la primera tanda ponen una banda así **en el medio del
 * mail**, no en la portada, y copiarle los 30 renglones al otro bloque era
 * garantizar que dentro de un mes uno de los dos tuviera el arreglo y el otro no.
 *
 * Outlook no entiende `background-image` en un `<div>`, así que necesita su
 * propio camino con `<v:rect>` — mismo criterio que el botón VML: los dos van
 * siempre, y el que no aplica se esconde con comentarios condicionales para que
 * no se dibujen los dos a la vez.
 */
function bandaConFoto(o: {
  foto: string;
  /** Alto aproximado en px: Outlook no mide el texto y necesita el número. */
  alto: number;
  /** 0-100. Ausente = 0, que es como se portó siempre. */
  velo?: number;
  /** El color de la banda: es el respaldo Y el color del velo. */
  bg: string;
  pal: Paleta;
  /** Padding y alineación ya resueltos por la caja del bloque. */
  estiloCaja: string;
  interior: string;
}): string {
  const alto = Math.min(600, Math.max(120, Math.round(o.alto)));
  // El velo: una capa del color `bg` encima de la foto, para que el texto se
  // lea. Sin esto, un título claro sobre una foto clara desaparece — es
  // exactamente lo que hizo descartar esta portada en Zattia.
  //
  // Va como CAPA de `background-image` y no como un div encima: un mail no puede
  // usar `position`, así que superponer dos elementos no es una opción. Es el
  // mismo truco que el pop-up de Resorty.
  //
  // 💡 De paso arregla una mentira vieja: el contraste del título se calcula
  // contra `bg`, pero lo que había atrás era la FOTO. Con el velo del color
  // `bg`, el fondo real se parece a lo que el cálculo supone.
  const velo = Math.min(100, Math.max(0, Math.round(o.velo ?? 0)));
  const capaVelo = velo > 0 ? `linear-gradient(${rgba(o.bg, velo / 100)},${rgba(o.bg, velo / 100)}),` : "";
  const fondo = colorCss(o.bg, o.pal.tarjeta);
  // `background-color` de respaldo: si la imagen no carga —Outlook con las
  // imágenes bloqueadas, un 404— el texto queda sobre el color y no sobre el
  // blanco de la tarjeta, que es donde se volvía invisible.
  return `<!--[if mso]>
<v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:${o.pal.ancho}px;height:${alto}px">
<v:fill type="frame" src="${esc(o.foto)}" color="${fondo}"${velo > 0 ? ` opacity="${(1 - velo / 100).toFixed(2)}"` : ""} />
<v:textbox inset="0,0,0,0">
<div style="${o.estiloCaja}">
${o.interior}
</div>
</v:textbox>
</v:rect>
<![endif]-->
<!--[if !mso]><!-->
<div style="background-color:${fondo};background-image:${capaVelo}url(${esc(o.foto)});background-size:cover;background-position:center;min-height:${px(alto)};${o.estiloCaja}">
${o.interior}
</div>
<!--<![endif]-->`;
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

function renderCard(p: ProductoEmail, pal: Paleta, eTexto: EstiloResuelto, eNota: EstiloResuelto, eImg: EstiloResuelto, dosEnMovil: boolean, pct = 50): string {
  // La única diferencia entre una y dos por fila en el celular es CUÁL de las dos
  // clases lleva la celda: `m-col` la apila y `m-col2` la deja en la mitad. El
  // `width` inline —el layout de escritorio— es el mismo en los dos casos, que
  // es la regla del shell: la clase solo puede ser un override.
  return `<td width="${pct}%" valign="top"${clase(dosEnMovil ? CLASES.col2 : CLASES.col)} style="padding:8px">
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
    <!-- Sin \`m-col\`: apilar la línea la parte en tres renglones por producto y
         un carrito de 6 se vuelve interminable. Foto | nombre | precio aguanta
         los 375px de un celular. -->
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
export function renderProductosHtml(items: ProductoEmail[], tema?: Tema, movil?: PorFilaMovil): string {
  const pal = resolverPaleta(tema);
  // `assetsBase` vacío: esto dibuja una grilla de productos, que no tiene
  // iconos. Vacío es el valor seguro — el bloque `redes` cae al texto.
  const ctx: Ctx = { pal, muestraCarrito: false, nombreCuenta: "", logoCuenta: "", urlCuenta: "", permiteHtmlCrudo: false, assetsBase: "", redesMarca: [] };
  return renderProductos(items, pal, estProducto("productos", "cuerpo", ctx, undefined), movil);
}

/**
 * La grilla: filas de dos o de tres tarjetas.
 *
 * `porFila` es el layout de escritorio y **ausente son 2**, que es como salieron
 * todos los mails hasta el 1-ago-2026. `movil` decide qué pasa en el teléfono y
 * **ausente es 1**, apilada (ver `PorFilaMovil`). La fila incompleta se rellena
 * con celdas vacías: con la grilla de a dos o de a tres, el hueco a la derecha
 * es exactamente lo que corresponde ver.
 *
 * ⚠️ Con `porFila: 3` el `movil` no se puede respetar —una `<tr>` de tres celdas
 * no se parte en dos filas con CSS— y la grilla apila. Ver `PorFila`.
 */
function renderProductos(items: ProductoEmail[], pal: Paleta, e: EstProducto, movil?: PorFilaMovil, porFila?: PorFila): string {
  if (items.length === 0) return "";
  const n = porFila === 3 ? 3 : 2;
  const dos = movil === 2 && n === 2;
  const pct = Math.round(100 / n);
  const filas: string[] = [];
  for (let i = 0; i < items.length; i += n) {
    const celdas = Array.from({ length: n }, (_, j) =>
      items[i + j] ? renderCard(items[i + j], pal, e.nombre, e.nota, e.img, dos, pct) : `<td width="${pct}%"></td>`,
    );
    filas.push(`<tr>${celdas.join("")}</tr>`);
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
    case "encabezado": {
      // ⚠️ Este bloque se dibuja SIEMPRE fuera de la tarjeta de contenido, sobre
      // el fondo de la página — `renderEmailHtml` lo saca de la lista antes de
      // recorrer el cuerpo. Por eso el `sobre` es `pal.fondo` y no la tarjeta:
      // en un mail oscuro con tarjeta clara (o al revés) el nombre de la marca
      // saldría del color equivocado.
      const c = caja();
      const t = e("titulo", pal.fondo);
      const al = c.align ?? t.align ?? "center";
      // `margin:auto` centra un bloque aunque el `text-align` no lo alcance
      // (la barrita y el logo son elementos de bloque, no texto).
      const m = (top: string) =>
        al === "center" ? `${top} auto 0 auto` : al === "right" ? `${top} 0 0 auto` : `${top} auto 0 0`;

      const nombre = b.texto?.trim() || ctx.nombreCuenta;
      const rotulo = b.mayusculas === false ? nombre : nombre.toUpperCase();

      // Tres estados, y el que importa es el del medio:
      //   "logo"    → el logo del bloque, y si no cargaron ninguno, el de la tienda
      //   ausente   → el logo de la tienda si lo hay; si no, el nombre (lo de antes)
      //   "texto"   → el nombre, aunque la tienda tenga logo (alguien lo eligió)
      // "Ausente = heredar" es la misma convención que el resto del motor, y es
      // lo que hace que las campañas y plantillas que ya existen —a las que la
      // migración les materializó un `{tipo:"encabezado"}` pelado— muestren el
      // logo el primer minuto, sin que nadie las edite.
      const logo =
        b.variante === "logo"
          ? b.logo?.trim() || ctx.logoCuenta
          : b.variante === "texto"
            ? ""
            : ctx.logoCuenta;
      let interior: string;
      if (logo) {
        // El `width` en atributo además del inline: Outlook de escritorio no
        // escala una imagen por CSS y la dibujaría a su tamaño original.
        const eImg = e("imagen");
        const anchoLogo = Math.min(pal.ancho - 64, Math.max(40, Math.round(b.logoAncho ?? 140)));
        interior = `<img src="${esc(logo)}" alt="${esc(nombre)}" width="${anchoLogo}" style="width:${px(anchoLogo)};max-width:100%;height:auto;display:block;margin:${m("0")}${extra(eImg, ["align", "ancho", "alto"])}" />`;
      } else {
        // Sin logo cargado, la variante "logo" cae a texto en vez de dejar un
        // ícono roto arriba de todo el mail.
        interior = `<span style="font-size:${px(t.tamano ?? 18)};font-weight:${t.peso ?? 700};letter-spacing:${px(t.espaciado ?? 1)};color:${t.color}${extra(t, ["tamano", "peso", "espaciado", "color", "align", "mayusculas"])}">${esc(rotulo)}</span>`;
      }

      // Sin link propio, la cabecera lleva a la tienda. Un logo que no se puede
      // tocar es un clic perdido en el mail que más se mira.
      const destino = b.url?.trim() || ctx.urlCuenta;
      const conLink = destino
        ? `<a href="${esc(destino)}" style="text-decoration:none;color:inherit">${interior}</a>`
        : interior;
      const barra =
        b.linea === false
          ? ""
          : `<div style="width:40px;height:3px;background:${c.bordeColor ?? pal.acento};margin:${m("10px")};border-radius:2px"></div>`;

      return `<div${clase(...clasesDe(c))} style="text-align:${al};${padCss(c.padY ?? 12, c.padX ?? 0)}${extra(c, ["align", "padX", "padY", "bordeAncho", "bordeColor", "bordeEstilo"])}">${conLink}${barra}</div>`;
    }
    case "titulo": {
      const t = e("titulo");
      return pad(`<h1${clase(...clasesTitulo(t))} style="margin:16px 0;font-size:${px(t.tamano ?? 26)};line-height:${t.interlinea ?? 1.25};color:${t.color};text-align:${b.align ?? t.align ?? "left"}${extra(t, ["tamano", "interlinea", "color", "align"])}">${esc(b.texto)}</h1>`, caja());
    }
    case "texto": {
      const t = e("cuerpo");
      return pad(`<p style="margin:0 0 16px;font-size:${px(t.tamano ?? 16)};line-height:${t.interlinea ?? 1.6};color:${t.color};text-align:${b.align ?? t.align ?? "left"}${extra(t, ["tamano", "interlinea", "color", "align"])}">${nl(b.texto)}</p>`, caja());
    }
    case "boton": {
      const t = e("boton");
      return pad(`<div style="text-align:${b.align ?? t.align ?? "left"};margin:8px 0 20px">${botonAnchor(b.texto, b.url, t, pal, b.full)}</div>`, caja());
    }
    case "imagen": {
      // Sin URL no se dibuja nada. Un `<img src="">` no es una imagen vacía: el
      // cliente de mail resuelve el src contra el documento y muestra el ícono
      // de imagen rota, en la casilla de otra persona y sin arreglo posible.
      // `nuevoBloque("imagen")` nace con `url: ""`, así que alcanzaba con
      // agregar el bloque y no completarlo — y cuatro presets de la galería
      // salían así hasta el 1-ago-2026.
      //
      // Es el mismo criterio que ya tenían `video` (que guarda por `b.imagen`),
      // `carrito` y `productos-dinamicos`: un bloque sin contenido desaparece en
      // vez de mandar un hueco. `imagen` era el único que faltaba.
      if (!b.url) return "";
      const t = e("imagen");
      // A sangre: la foto ocupa la tarjeta de lado a lado, sin el margen lateral
      // ni las esquinas redondeadas. Es el hero fotográfico de 6 de las 21
      // referencias de la primera tanda (ver PLANTILLAS.md), y hasta el
      // 1-ago-2026 no había forma de decirlo.
      //
      // El padding lo pone `pad()`, así que "a sangre" es no envolver: no hay
      // una propiedad nueva en el `<img>`, hay un `<div>` menos. El `width="100%"`
      // como ATRIBUTO además del style es por Outlook, que ignora `max-width` y
      // dibujaría la foto a su tamaño original — 2000px de ancho adentro de una
      // tarjeta de 600.
      if (b.sangre) {
        return `<img src="${esc(b.url)}" alt="${esc(b.alt ?? "")}" width="100%" style="width:100%;max-width:100%;height:auto;display:block;border:0" />`;
      }
      return pad(`<img src="${esc(b.url)}" alt="${esc(b.alt ?? "")}" style="max-width:100%;height:auto;border-radius:${px(t.radio ?? 8)};margin:8px 0 16px;display:block${extra(t, ["radio", "align", "tamano", "color"])}" />`, caja());
    }
    case "productos":
      return pad(renderProductos(b.items ?? [], pal, estProducto(b.tipo, "cuerpo", ctx, b.estilo), b.movil, b.porFila), caja());
    // Se dibuja igual que `productos` —es la misma grilla— y la diferencia entera
    // está en de dónde salen los productos: el bloque guarda la consulta y la
    // respuesta llega por `opts`, resuelta contra la tienda minutos antes.
    //
    // Sin productos **no se dibuja nada**: si TN no contestó, o la consulta
    // volvió vacía porque no hay nada en oferta, el mail sale sin el bloque en
    // vez de con un hueco. Mismo criterio que el carrito vacío.
    case "productos-dinamicos": {
      const items = ctx.productosDinamicos?.[claveProductos(b)] ?? [];
      // ⚠️ `movil` NO entra en `claveProductos`: es cómo se dibuja la grilla, no
      // qué se le pide a Tiendanube. Si entrara, dos bloques con la misma
      // consulta y distinto layout costarían dos llamadas a TN.
      return pad(renderProductos(items, pal, estProducto(b.tipo, "cuerpo", ctx, b.estilo), b.movil, b.porFila), caja());
    }
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
      // Cuatro variantes, dos formas de celda. `variante` decide, celda por
      // celda, si va imagen o texto — no hay un quinto caso "mixto libre" a
      // propósito: menos combinaciones, menos perillas que probar en el panel.
      const variante = b.variante ?? "imagenes";
      const celdas = b.celdas ?? [];
      if (!celdas.length) return "";
      // La proporción es una pregunta de dos celdas: "cuál de las DOS es más
      // ancha". Con tres o cuatro el reparto es parejo — ver el comentario del
      // campo en `bloques.ts`.
      const pcts =
        celdas.length === 2
          ? [b.proporcion ?? 50, 100 - (b.proporcion ?? 50)]
          : celdas.map(() => Math.round(100 / celdas.length));
      const tImg = e("imagen");
      const tTitulo = e("titulo");
      const tCuerpo = e("cuerpo");

      // El `alt` sale del título de la columna. No es accesibilidad de manual:
      // **Outlook bloquea las imágenes por defecto**, así que con `alt=""` esa
      // celda queda literalmente vacía y el mail se lee partido. Si la columna no
      // tiene título se deja vacío a propósito — ahí la imagen sí es decorativa y
      // un alt inventado sería ruido para un lector de pantalla.
      const celdaImagen = (c: Columna, pct: number) => {
        if (!c.imagen) return `<td width="${pct}%"></td>`;
        // La etiqueta debajo de la foto. Es la fila de categorías de 10 de las
        // 21 referencias de la primera tanda: sin ella, la celda de imagen es
        // una foto muda y hay que adivinar a dónde lleva.
        const label = c.titulo
          ? `<div style="margin-top:8px;font-size:${px(tTitulo.tamano ?? 15)};font-weight:${tTitulo.peso ?? 600};color:${tTitulo.color};text-align:${tTitulo.align ?? "center"}${extra(tTitulo, ["tamano", "peso", "color", "align"])}">${esc(c.titulo)}</div>`
          : "";
        return `<td width="${pct}%" valign="top"${clase(CLASES.col)} style="padding:6px"><a href="${esc(c.url || "#")}" style="text-decoration:none;color:inherit"><img src="${esc(c.imagen)}" width="100%" style="max-width:100%;border-radius:${px(tImg.radio ?? 8)};display:block" alt="${esc(c.titulo ?? "")}" />${label}</a></td>`;
      };

      const celdaTexto = (c: Columna, pct: number) => {
        const titulo = c.titulo
          ? `<div style="margin:0 0 6px;font-size:${px(tTitulo.tamano ?? 18)};font-weight:${tTitulo.peso ?? 700};line-height:${tTitulo.interlinea ?? 1.3};color:${tTitulo.color};text-align:${tTitulo.align ?? "left"}${extra(tTitulo, ["tamano", "peso", "interlinea", "color", "align"])}">${esc(c.titulo)}</div>`
          : "";
        const texto = c.texto
          ? `<div style="font-size:${px(tCuerpo.tamano ?? 14)};line-height:${tCuerpo.interlinea ?? 1.5};color:${tCuerpo.color};text-align:${tCuerpo.align ?? "left"}${extra(tCuerpo, ["tamano", "interlinea", "color", "align"])}">${nl(c.texto)}</div>`
          : "";
        const contenido = `${titulo}${texto}`;
        const interior = c.url ? `<a href="${esc(c.url)}" style="text-decoration:none;color:inherit">${contenido}</a>` : contenido;
        return `<td width="${pct}%" valign="top"${clase(CLASES.col)} style="padding:6px">${interior}</td>`;
      };

      // Con dos celdas esto es exactamente lo que hacía antes (`imagen-texto` =
      // izquierda con foto). Con tres o cuatro, "la primera" y "la última" son
      // la única lectura que no inventa nada.
      const esImagen = (i: number) =>
        variante === "imagenes" ||
        (variante === "imagen-texto" && i === 0) ||
        (variante === "texto-imagen" && i === celdas.length - 1);

      const html = celdas
        .map((c, i) => (esImagen(i) ? celdaImagen(c, pcts[i]) : celdaTexto(c, pcts[i])))
        .join("");

      return pad(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px"><tr>${html}</tr></table>`, caja());
    }
    case "video": {
      // El ▶ estaba superpuesto con `position:absolute`, y **Gmail elimina
      // `position`**: el triángulo caía suelto en cualquier lado de la tarjeta.
      // Ahora es una pastilla debajo de la miniatura — se ve igual en todos
      // lados y encima dice qué es, que un ▶ solo no lo dice.
      const t = e("imagen");
      const btn = e("boton");
      return b.imagen
        ? pad(`<a href="${esc(b.url || "#")}" style="display:block;text-decoration:none;margin:8px 0 16px"><img src="${esc(b.imagen)}" width="100%" style="max-width:100%;border-radius:${px(t.radio ?? 8)};display:block" alt="Ver el video" /><span style="display:inline-block;margin-top:10px;padding:8px 18px;font-size:14px;font-weight:600;color:${btn.color};background:${btn.fondo};border-radius:${px(btn.radio ?? 8)};text-decoration:none">▶&nbsp; Ver el video</span></a>`, caja())
        : "";
    }
    case "redes": {
      const t = e("cuerpo");
      // El icono mide lo que mida el texto, ×2. Así la perilla de tamaño del
      // panel sigue haciendo algo en este bloque (lo exige `probar-panel-estilo`)
      // y no hace falta un control nuevo solo para las redes.
      const lado = Math.round((t.tamano ?? 14) * 2);
      // 🔑 Sin links propios, las de la marca. Es lo que permite que una
      // PLANTILLA cierre con redes: un preset no puede guardar el Instagram de
      // nadie adentro del Json (regla 1 de PLANTILLAS.md), así que nace con la
      // lista vacía y cada marca la completa al renderizar — igual que el logo.
      //
      // El bloque con links propios manda: quien escribió un link en ESTE mail
      // quiso ese link, no el de la configuración.
      const propios = (b.links ?? []).filter((l) => l.url);
      const lista = propios.length ? propios : ctx.redesMarca;
      // Sin una sola red que dibujar, el bloque no existe — el mismo criterio
      // que `imagen`, `video` y `carrito`. Antes dejaba un `<div>` vacío con 32
      // px de aire adentro de un mail que no muestra nada ahí.
      if (!lista.length) return "";
      return pad(`<div style="text-align:center;margin:16px 0">${lista
        .map((l) => {
          const red = redConIcono(l.red);
          const src = red && urlIcono(ctx.assetsBase, red);
          // 🔴 Con icono o con texto, NUNCA con una imagen rota: si la red no
          // está en la lista o no hay `assetsBase`, sale el nombre — que es
          // exactamente lo que este bloque dibujó siempre.
          const dentro = src
            // `width`/`height` como ATRIBUTOS además del style: Outlook ignora
            // las medidas en CSS y dibujaría el PNG a 96px, que es el triple.
            // `display:block` mata el hueco que el baseline le deja debajo.
            ? `<img src="${esc(src)}" width="${lado}" height="${lado}" alt="${esc(red!.nombre)}" style="width:${px(lado)};height:${px(lado)};display:block;border:0" />`
            : `<span style="color:${t.color};font-size:${px(t.tamano ?? 14)}${extra(t, ["color", "tamano", "align", "subrayado"])}">${esc(l.red)}</span>`;
          return `<a href="${esc(l.url)}" style="display:inline-block;margin:0 8px;text-decoration:none">${dentro}</a>`;
        })
        .join("")}</div>`, caja());
    }
    case "menu": {
      const t = e("cuerpo");
      const enlaces = (b.links ?? []).filter((l) => l.url && l.texto);
      if (!enlaces.length) return "";
      const align = t.align ?? "center";
      return pad(
        `<div style="text-align:${align};margin:12px 0">${enlaces
          .map(
            (l) =>
              `<a href="${esc(l.url)}" style="display:inline-block;margin:0 12px;font-size:${px(t.tamano ?? 14)};font-weight:${t.peso ?? 600};color:${t.color};text-decoration:none${extra(t, ["tamano", "peso", "color", "align"])}">${esc(l.texto)}</a>`,
          )
          .join("")}</div>`,
        caja(),
      );
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
      // El `bg` lo elige el autor, así que el color del texto se decide por ESE
      // fondo y no por el tema: un hero blanco dentro de un mail oscuro tendría
      // título blanco sobre blanco si se heredara la paleta.
      const c = caja();
      const bg = c.autoFondo ? b.bg || pal.tarjeta : c.fondo!;
      const t = b.titulo ? (() => { const x = e("titulo", bg); return `<h1${clase(...clasesTitulo(x))} style="margin:0 0 10px;font-size:${px(x.tamano ?? 30)};line-height:${x.interlinea ?? 1.2};color:${x.color}${extra(x, ["tamano", "interlinea", "color", "align"])}">${esc(b.titulo)}</h1>`; })() : "";
      const s = b.subtitulo ? (() => { const x = e("subtitulo", bg); return `<p style="margin:0 0 20px;font-size:${px(x.tamano ?? 17)};line-height:${x.interlinea ?? 1.5};color:${x.color}${extra(x, ["tamano", "interlinea", "color", "align"])}">${esc(b.subtitulo)}</p>`; })() : "";
      const btn = b.botonTexto ? botonAnchor(b.botonTexto, b.botonUrl, e("boton"), pal) : "";
      const interior = `${t}${s}${btn}`;

      // Portada con imagen de FONDO: el texto va encima, no arriba. Outlook no
      // entiende `background-image` en un `<div>`, así que necesita su propio
      // camino con `<v:rect>` — mismo criterio que el botón VML: los dos
      // caminos van siempre, y el que no aplica se esconde con comentarios
      // condicionales para que no se dibujen los dos a la vez.
      if (b.fondoImagen) {
        return bandaConFoto({
          foto: b.fondoImagen,
          alto: b.alto ?? 280,
          velo: b.velo,
          bg,
          pal,
          estiloCaja: `${padCss(c.padY ?? 36, c.padX ?? 32)};text-align:center${extra(c, ["fondo", "padX", "padY", "align"])}`,
          interior,
        });
      }

      const img = b.imagen ? `<img src="${esc(b.imagen)}" alt="" style="width:100%;display:block;margin:0${extra(t0, ["radio", "align", "color", "tamano"])}" />` : "";
      const cajaHtml = interior ? `<div style="background:${colorCss(bg, pal.tarjeta)};${padCss(c.padY ?? 36, c.padX ?? 32)};text-align:center${extra(c, ["fondo", "padX", "padY", "align"])}">${interior}</div>` : "";
      return `${img}${cajaHtml}`;
    }
    case "seccion": {
      const c = caja();
      const bg = c.autoFondo ? b.bg || pal.seccion : c.fondo!;
      const t = b.titulo ? (() => { const x = e("titulo", bg); return `<h2${clase(...clasesTitulo(x))} style="margin:0 0 8px;font-size:${px(x.tamano ?? 22)};line-height:${x.interlinea ?? 1.3};color:${x.color}${extra(x, ["tamano", "interlinea", "color", "align"])}">${esc(b.titulo)}</h2>`; })() : "";
      const tx = b.texto ? (() => { const x = e("subtitulo", bg); return `<p style="margin:0 0 16px;font-size:${px(x.tamano ?? 16)};line-height:${x.interlinea ?? 1.6};color:${x.color}${extra(x, ["tamano", "interlinea", "color", "align"])}">${nl(b.texto)}</p>`; })() : "";
      const btn = b.botonTexto ? botonAnchor(b.botonTexto, b.botonUrl, e("boton"), pal) : "";
      const estiloCaja = `${padCss(c.padY ?? 32, c.padX ?? 32)};text-align:center${extra(c, ["fondo", "padX", "padY", "align"])}`;
      // La misma banda del `hero`, en el medio del mail. Con la foto, el color
      // pasa a ser el respaldo y el velo; sin ella, es la sección de siempre.
      if (b.fondoImagen) {
        return bandaConFoto({ foto: b.fondoImagen, alto: b.alto ?? 220, velo: b.velo, bg, pal, estiloCaja, interior: `${t}${tx}${btn}` });
      }
      return `<div style="background:${colorCss(bg, pal.tarjeta)};${estiloCaja}">${t}${tx}${btn}</div>`;
    }
    case "cupon": {
      const c = caja();
      const bg = c.fondo ?? pal.cuponFondo;
      const t = b.texto ? (() => { const x = e("cuerpo", bg); return `<div style="font-size:${px(x.tamano ?? 16)};color:${x.color}${extra(x, ["tamano", "color", "align"])};margin-bottom:8px">${esc(b.texto)}</div>`; })() : "";
      const cod = b.codigo ? (() => { const x = e("titulo"); return `<div style="font-size:${px(x.tamano ?? 26)};font-weight:${x.peso ?? 700};letter-spacing:${px(x.espaciado ?? 3)};color:${x.color}${extra(x, ["tamano", "peso", "espaciado", "color", "align", "interlinea"])};margin-bottom:14px">${esc(b.codigo)}</div>`; })() : "";
      const btn = b.botonTexto ? botonAnchor(b.botonTexto, b.botonUrl, e("boton"), pal) : "";
      return pad(`<div style="border:${px(c.bordeAncho ?? 2)} ${c.bordeEstilo ?? "dashed"} ${c.bordeColor ?? pal.acento};border-radius:${px(c.radio ?? 12)};background:${bg};${padCss(c.padY ?? 24, c.padX ?? 24)};text-align:center;margin:8px 0 16px">${t}${cod}${btn}</div>`, undefined);
    }
    // ⛔ Gateado por la CUENTA, no por quién lo editó — ver el comentario en
    // `Ctx.permiteHtmlCrudo`. Sin el toggle prendido, el bloque no se dibuja
    // aunque el Json lo tenga: la paleta del editor es nomás la UI, el freno
    // real vive acá.
    case "html":
      return ctx.permiteHtmlCrudo ? pad(b.contenido ?? "", caja()) : "";
    default:
      return "";
  }
}

export interface RenderOpts {
  preheader?: string;
  unsubscribeUrl: string;
  nombreCuenta: string;
  /**
   * Logo de la marca (lo trae Tiendanube). Es el **default** del bloque
   * `encabezado`, no un valor clavado: el bloque puede pisarlo o pedir texto.
   *
   * Mismo criterio que `nombreCuenta`: la plantilla no lleva la marca adentro,
   * se resuelve al renderizar. Es lo que deja compartir una plantilla entre
   * tiendas sin que el mail de Zattia salga con el logo de BDI.
   */
  logoCuenta?: string;
  /** Sitio de la tienda: a dónde lleva el encabezado si nadie puso otro link. */
  urlCuenta?: string;
  direccionPostal?: string;
  /**
   * Solo para el preview del editor: dibuja el bloque `carrito` con productos de
   * muestra para que se vea cómo va a quedar.
   *
   * ⛔ Nunca en un envío real. En el envío, un carrito sin items no se dibuja.
   */
  muestraCarrito?: boolean;
  /**
   * De dónde cuelgan los archivos estáticos que van DENTRO del mail (hoy, los
   * iconos de `redes`). Sin barra final.
   *
   * Es el mismo host del que cuelgan los links —`hostDeEnvio(cuenta, APP_URL)`—
   * y no una constante: un mail de Zattia tiene que traer sus iconos de
   * `links.zattia.com.ar`, no de un dominio ajeno. Viaja por `RenderOpts` y no
   * adentro del documento por lo mismo que el logo: el Json se comparte entre
   * marcas y no puede llevar la infraestructura adentro.
   *
   * 🔴 **Ausente = no se dibuja ningún icono, se dibuja el texto.** Un `<img>`
   * con `src` relativo o vacío es una imagen rota en la casilla de otra persona;
   * el nombre en texto es lo que hacía este bloque desde siempre y no falla.
   */
  assetsBase?: string;
  /**
   * Las redes de la marca (`Cuenta.config.redes`), para el bloque `redes` que no
   * trae links propios.
   *
   * 🔑 Es lo que permite que una **plantilla** cierre con redes. Un preset no
   * puede guardar el Instagram de nadie adentro del Json —sería la regla 1 de
   * `PLANTILLAS.md` al revés, la bienvenida de Zattia linkeando al Instagram de
   * BDI—, así que el bloque nace con la lista vacía y la marca la completa al
   * renderizar. Mismo mecanismo que el logo y el nombre.
   *
   * Ausente = el bloque no se dibuja, que es lo que ya pasaba con los links
   * vacíos. Nunca un `href=""`.
   */
  redesMarca?: { red: string; url: string }[];
  /** Tema por defecto de la marca (`Cuenta.config.tema`). Lo pisa el de la campaña. */
  temaMarca?: Tema | null;
  /**
   * Los productos de los bloques `productos-dinamicos`, ya resueltos contra la
   * tienda, indexados por `claveProductos(bloque)`.
   *
   * Viajan por acá y **no adentro del bloque** por lo mismo que el logo y el
   * nombre de la marca: son datos de la tienda resueltos al enviar, y el
   * documento tiene que poder compartirse entre marcas sin llevarlos adentro.
   * Ver el comentario del bloque en `bloques.ts`.
   *
   * Ausente = el bloque no se dibuja. Es lo correcto: sin productos no hay
   * grilla, y un hueco es peor que nada.
   */
  productosDinamicos?: Record<string, ProductoEmail[]>;
  /**
   * ¿La cuenta puede usar el bloque `html`? Sale de
   * `Cuenta.config.htmlCrudoHabilitado` vía `marcaDe()`. Ausente/`false` = el
   * bloque `html` no se dibuja, aunque el documento lo tenga guardado.
   */
  permiteHtmlCrudo?: boolean;
}

/** Renderiza el contenido a un HTML de email completo (shell + bloques + footer). */
export function renderEmailHtml(entrada: ContenidoCampania, opts: RenderOpts): string {
  // Cinturón y tiradores: los call sites ya normalizan, pero si alguno se olvida
  // el mail sale igual bien. Es barato — un contenido que ya está en la versión
  // actual se devuelve tal cual, sin recorrer nada.
  const contenido = leerContenido(entrada);
  // El tema de la campaña pisa al de la marca, campo por campo.
  const pal = resolverPaleta(combinarTema(opts.temaMarca, contenido.tema));
  const ctx: Ctx = {
    pal,
    doc: contenido.estilos,
    muestraCarrito: !!opts.muestraCarrito,
    productosDinamicos: opts.productosDinamicos,
    nombreCuenta: opts.nombreCuenta,
    logoCuenta: opts.logoCuenta?.trim() ?? "",
    urlCuenta: opts.urlCuenta?.trim() ?? "",
    permiteHtmlCrudo: !!opts.permiteHtmlCrudo,
    assetsBase: opts.assetsBase?.trim().replace(/\/+$/, "") ?? "",
    redesMarca: (opts.redesMarca ?? []).filter((r) => r?.url),
  };
  // El encabezado se saca de la lista y se dibuja arriba de la tarjeta, que es
  // donde estuvo siempre. `leerContenido` ya garantiza que hay uno solo y que
  // está primero, pero se busca por tipo igual: el camino rápido del
  // normalizador no re-acomoda un documento que ya está en la versión actual, y
  // el renderer no puede depender de eso para no dibujar dos cabeceras.
  const bloques = contenido.bloques ?? [];
  const cabecera = bloques.find((b) => b.tipo === "encabezado");
  const cuerpo = bloques
    .filter((b) => b.tipo !== "encabezado")
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

  // El namespace de VML va en el <html> o Outlook no dibuja los botones.
  return `<!doctype html>
<html lang="${esc(pal.idioma)}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
${cabeza(pal)}
<body style="margin:0;padding:0;background:${pal.fondo};font-family:${pal.fuente}">
  ${preheader}
${apertura(pal)}
    <!-- Encabezado de marca (bloque; se puede editar o borrar) -->
    ${cabecera ? renderBloque(cabecera, ctx) : ""}
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
${cierre}
</body></html>`;
}

/** Un bloque, en texto. `null` = no aporta nada legible (imágenes sueltas, etc.). */
function bloqueATexto(b: Bloque, opts: RenderOpts): string | null {
  const link = (texto: string, url?: string) => (url ? `${texto}: ${url}` : texto);
  /** "PRINT CASE (iPhone 11 · Marrón, 2 u.) — 7490". Mismo dato que la línea HTML. */
  const lineaTexto = (p: ProductoEmail) => {
    const detalle = [p.variante, (p.cantidad ?? 1) > 1 ? `${p.cantidad} u.` : null].filter(Boolean);
    // Mismo formato que el HTML: TN devuelve "10990.00" y en el mail va "$10.990".
    const precio = p.precioPromo || p.precio;
    return `${p.nombre}${detalle.length ? ` (${detalle.join(", ")})` : ""}${precio ? ` — ${fmtPrecio(precio)}` : ""}`;
  };
  switch (b.tipo) {
    case "encabezado": {
      // El logo no aporta nada en texto plano, pero el nombre de la marca sí:
      // es el primer renglón, igual que cuando lo escribía el shell.
      const nombre = b.texto?.trim() || opts.nombreCuenta;
      return b.mayusculas === false ? nombre : nombre.toUpperCase();
    }
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
    // Los productos salen de `opts`, igual que en el HTML: la parte de texto no
    // puede quedarse corta o el mail se vuelve vacío para quien lo lea así.
    case "productos-dinamicos":
      return (opts.productosDinamicos?.[claveProductos(b)] ?? [])
        .map((p) => link(`· ${lineaTexto(p)}`, p.url))
        .join("\n") || null;
    case "carrito": {
      const lineas = (b.items ?? []).map((p) => link(`· ${lineaTexto(p)}`, p.url));
      if (!lineas.length) return null;
      const r = b.restantes ?? 0;
      if (r > 0) lineas.push(`y ${r} producto${r === 1 ? "" : "s"} más: \${cart.url}`);
      return lineas.join("\n");
    }
    case "columnas": {
      // Sirve tanto para la variante de fotos (etiqueta + link) como para la de
      // texto (título + texto + link) — cada celda aporta lo que tenga.
      const lado = (c: Columna) => [c.titulo, c.texto, c.url].filter(Boolean).join(" — ");
      return (b.celdas ?? []).map(lado).filter(Boolean).join("\n") || null;
    }
    case "video":
      return b.url ? `Ver el video: ${b.url}` : null;
    case "redes": {
      // La misma caída a las redes de la marca que en el HTML. Si el texto plano
      // mirara solo el bloque, una plantilla que en el mail cierra con cuatro
      // iconos saldría sin una sola red en la versión de texto.
      const propias = (b.links ?? []).filter((l) => l.url);
      const lista = propias.length ? propias : (opts.redesMarca ?? []).filter((l) => l?.url);
      return lista.map((l) => link(l.red, l.url)).join("\n") || null;
    }
    case "menu":
      return (b.links ?? []).filter((l) => l.url && l.texto).map((l) => link(l.texto, l.url)).join(" · ") || null;
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
    // Sin conversión razonable a texto plano: es la escotilla de HTML libre.
    case "html":
      return null;
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
  // Mismo criterio que el HTML: el encabezado va primero, esté donde esté en la
  // lista. Si alguien lo borró, el mail arranca directo por el contenido.
  const bloques = contenido.bloques ?? [];
  const cuerpo = [
    ...bloques.filter((b) => b.tipo === "encabezado").slice(0, 1),
    ...bloques.filter((b) => b.tipo !== "encabezado"),
  ]
    .map((b) => bloqueATexto(b, opts))
    .filter((t): t is string => !!t && t.trim() !== "")
    .join("\n\n");

  return [
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
