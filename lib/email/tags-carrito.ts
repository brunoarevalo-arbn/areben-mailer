// Los merge tags del CARRITO: `${cart.url}` y `${cart.producto}`.
//
// ⚠️ Puro: lo usan el procesador de automations, la prueba de «Mandar una
// prueba» y `scripts/ensayo-secuencia.ts`. Con el reemplazo escrito tres veces
// —como estaba el de `${cart.url}` hasta el 29-sep-2026— alcanza con que uno se
// quede viejo para que un tag salga LITERAL en una casilla.
import { mapearBloques, type Bloque, type FilaTotal, type ProductoEmail } from "./bloques";
import { cantidadCuotas, montoEnvioGratis, resolverTagsEnDoc, resolverTagsEnTexto, type Tienda } from "./tienda";
import { plata } from "./ticket";

/**
 * Lo que dice `${cart.producto}`: «Brownie Case», o «Brownie Case y 2 productos
 * más». Sin productos, «lo que elegiste», que se lee bien en cualquier frase
 * que lo use («Vi que dejaste ___ en el carrito»).
 *
 * Nació el 29-sep-2026 para el mail en texto plano de la secuencia de carrito:
 * un mail escrito como por una persona tiene que nombrar lo que la persona dejó.
 *
 * 🔑 Un nombre TODO EN MAYÚSCULAS —así vienen los de BDI desde Tiendanube— se
 * pasa a «Tipo Título»: en un mail de texto plano, «BROWNIE CASE» se lee como un
 * grito, y es justo el mail que tiene que parecer escrito a mano. Uno que ya
 * viene en minúsculas se respeta tal cual: ahí la marca eligió cómo se escribe.
 */
export function nombreDelCarrito(productos: ProductoEmail[] | undefined, restantes = 0): string {
  const lista = productos ?? [];
  if (lista.length === 0) return "lo que elegiste";
  const primero = legible(lista[0].nombre);
  const otros = lista.length - 1 + Math.max(0, restantes);
  return otros > 0 ? `${primero} y ${otros} producto${otros === 1 ? "" : "s"} más` : primero;
}

export const legible = (nombre: string): string => {
  const n = nombre.trim();
  if (n !== n.toUpperCase() || n === n.toLowerCase()) return n;
  return n.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase());
};

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Resuelve los dos tags del carrito sobre un HTML, un text/plain o un asunto.
 *
 * 🔴 `formato` es obligatorio: en el HTML el nombre del producto va ESCAPADO
 * —viene de Tiendanube y lo escribe el comerciante— y en el texto y el asunto va
 * crudo, o saldría un `&amp;` en la casilla.
 */
export function resolverTagsCarrito(
  s: string,
  c: { url: string; productos?: ProductoEmail[]; restantes?: number },
  formato: "html" | "texto",
): string {
  const producto = nombreDelCarrito(c.productos, c.restantes);
  return s
    .replaceAll("${cart.url}", c.url)
    .replaceAll("${cart.producto}", formato === "html" ? escHtml(producto) : producto)
    // 🔴 La red: cualquier `${cart.…}` que siga acá —uno calculado que no pasó
    // por `resolverCarritoEnDoc`, o uno mal escrito— se borra. Un tag crudo en
    // la casilla de un cliente no se arregla después.
    .replace(RE_CART, "");
}

// ── Los tags CALCULADOS del carrito (11-oct-2026, «Carrito v2 · B») ─────────
//
// `${cart.total}` · `${cart.cantidad}` · `${cart.cuotas}` · `${cart.envio}` ·
// `${cart.envioCorto}` · `${cart.modelos}` · `${cart.lineas}` ·
// `${cart.retiro}` · `${cart.entrega}` · `${cart.entregaDetalle}` (Zattia, 12-oct).
//
// 🔑 **Se resuelven en el DOCUMENTO, antes de dibujar**, con el mismo recorrido
// que `${tienda.…}` (`resolverTagsEnDoc`), y no sobre el HTML como `${cart.url}`.
// Por dos razones: (1) hereda la regla de que un tag sin dato vacía su frase
// entera —«Son , y lo podés pagar en » es peor que no decir nada—, y (2) el valor
// entra como TEXTO del documento, así que lo escapa el renderer y `\n` se vuelve
// renglón en los dos formatos sin escribir dos versiones.

const RE_CART = /\$\{cart\.([a-zA-Z]+)\}/g;
const PREFIJO_CART = "${cart.";

/** Lo que hace falta para calcular. Todo puede faltar: lo que falta, no se dice. */
export interface DatosCarrito {
  productos?: ProductoEmail[];
  restantes?: number;
  /** Σ de TODAS las líneas (`CheckoutNormalizado.subtotal`). */
  subtotal?: number | null;
  /** Unidades de TODAS las líneas. */
  cantidad?: number;
  /** Eligió retirar en el local: el envío gratis no le aplica (`CheckoutNormalizado.retiroEnLocal`). */
  retiroEnLocal?: boolean;
  tienda?: Tienda;
}

/**
 * El modelo de teléfono de una línea. La variante viene «iPhone 17 Pro» o
 * «iPhone 17 Pro · ROSA» (los valores de TN pegados con « · »): se toma el que
 * parece un teléfono y, si ninguno lo parece, el primero.
 */
export function modeloDe(p: ProductoEmail): string | null {
  const vals = (p.variante ?? "").split(" · ").map((v) => v.trim()).filter(Boolean);
  if (!vals.length) return null;
  return vals.find((v) => /\b(iphone|galaxy|samsung|moto|motorola|redmi|xiaomi|pixel|huawei)\b/i.test(v)) ?? vals[0];
}

/** «iPhone 17 Pro, iPhone 16 y iPhone 13», sin repetir y en el orden del carrito. */
const enumerar = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

/** Los valores de cada tag. `undefined` = sin dato (la frase se cae). */
export function valoresCarrito(d: DatosCarrito): Record<string, string | undefined> {
  const productos = d.productos ?? [];
  const restantes = Math.max(0, d.restantes ?? 0);
  const total = typeof d.subtotal === "number" && d.subtotal > 0 ? d.subtotal : null;
  const unidades = d.cantidad && d.cantidad > 0 ? d.cantidad : productos.length + restantes;
  const umbral = montoEnvioGratis(d.tienda);
  const cuotas = cantidadCuotas(d.tienda);
  const modelos = [...new Set(productos.map(modeloDe).filter((m): m is string => !!m))];
  const falta = total !== null && umbral !== null ? umbral - total : null;
  // 🔑 Quien eligió RETIRAR EN EL LOCAL no escucha del envío gratis: se le dice
  // cuándo lo puede retirar. ⛔ Nunca «ya está listo»: el pedido se arma en el
  // plazo de despacho (Bruno, 11-oct-2026: «demora un día en armar»).
  const plazo = d.tienda?.plazoDespacho?.trim();
  const retiro = d.retiroEnLocal ? `Lo retirás por el local${plazo ? ` en ${plazo}` : ""}` : null;

  return {
    total: total !== null ? plata(total) : undefined,
    cantidad: unidades > 0 ? `${unidades} producto${unidades === 1 ? "" : "s"}` : undefined,
    cuotas: total !== null && cuotas ? `${cuotas} cuotas de ${plata(total / cuotas)}` : undefined,
    envio: retiro ?? (falta === null ? undefined
      : falta <= 0 ? "Tu pedido ya tiene envío gratis" : `Te faltan ${plata(falta)} para el envío gratis`),
    envioCorto: d.retiroEnLocal ? `En el local${plazo ? `, en ${plazo}` : ""}`
      : falta === null ? undefined : falta <= 0 ? "Gratis" : `Te faltan ${plata(falta)}`,
    // 🔑 Los tres de Zattia (12-oct-2026). Ahí el envío ⛔ se nombra por el
    // carrito —con un carrito mediano de $26.990 contra un umbral de $150.000,
    // «te faltan $X» le diría a casi todos que le falta mucho (Bruno: nunca)—:
    // `retiro` sólo habla para quien eligió retirar, y `entrega`/`entregaDetalle`
    // son la tercera celda de las garantías, que cambia de «ENVÍO GRATIS» a «RETIRO».
    retiro: retiro ?? undefined,
    entrega: d.retiroEnLocal ? "Retiro" : umbral !== null ? "Envío gratis" : undefined,
    entregaDetalle: d.retiroEnLocal
      ? `en el local${d.tienda?.local?.trim() ? `, ${d.tienda.local.trim()}` : ""}`
      : umbral !== null && d.tienda?.envioGratis?.trim() ? `desde ${d.tienda.envioGratis.trim()}` : undefined,
    modelos: modelos.length ? enumerar(modelos) : undefined,
    lineas: productos.length
      ? productos.map((p) => `${legible(p.nombre)}${modeloDe(p) ? ` — ${modeloDe(p)}` : ""}`).join("\n")
        + (restantes ? `\ny ${restantes} más.` : "")
      : undefined,
  };
}

/**
 * El documento con los tags calculados resueltos. ⚠️ `${cart.url}` y
 * `${cart.producto}` NO se tocan acá (siguen saliendo después, sobre el HTML):
 * para esos dos siempre hay valor.
 */
export function resolverCarritoEnDoc<T>(contenido: T, d: DatosCarrito): T {
  const v = valoresCarrito(d);
  return resolverTagsEnDoc(contenido, PREFIJO_CART, RE_CART, (k) =>
    k === "url" || k === "producto" ? `\${cart.${k}}` : v[k]);
}

/** Ídem para el preheader. Sin dato, el preheader no sale (`undefined`). */
export function resolverCarritoEnTexto(s: string | null | undefined, d: DatosCarrito): string | undefined {
  if (!s) return undefined;
  const v = valoresCarrito(d);
  return resolverTagsEnTexto(s, PREFIJO_CART, RE_CART, (k) =>
    k === "url" || k === "producto" ? `\${cart.${k}}` : v[k]) ?? undefined;
}

/**
 * Los renglones del carrito en vista `resumen` (el «ticket» del último mail):
 * Tu carrito · Total · Envío · En cuotas. Un renglón sin dato no sale.
 */
export function filasResumen(d: DatosCarrito): FilaTotal[] {
  const v = valoresCarrito(d);
  const filas: [string, string | undefined, boolean?][] = [
    ["Tu carrito", v.cantidad],
    ["Total", v.total, true],
    [d.retiroEnLocal ? "Retiro" : "Envío", v.envioCorto],
    ["En cuotas", v.cuotas ? `${v.cuotas.replace(" cuotas de ", " × ")} sin interés` : undefined],
  ];
  return filas.filter(([, m]) => !!m).map(([etiqueta, monto, fuerte]) => ({ etiqueta, monto: monto!, ...(fuerte ? { fuerte } : {}) }));
}

/**
 * El renglón de abajo de la vista `tienda` (Zattia, 12-oct-2026): «3 PRODUCTOS ·
 * $26.670». Sólo eso: el envío, si corresponde, lo dice el mail con `${cart.retiro}`.
 */
export function filasTienda(d: DatosCarrito): FilaTotal[] {
  const v = valoresCarrito(d);
  return v.cantidad ? [{ etiqueta: v.cantidad, monto: v.total ?? "", fuerte: true }] : [];
}

/**
 * Lo último que se le hace al documento de un mail de carrito antes de dibujarlo:
 * los renglones de la vista `resumen` y los tags calculados. 🔑 Una sola función
 * para las tres puertas —el procesador, «Mandar una prueba» y el ensayo— porque
 * con tres copias alcanza con que una se quede vieja para que la prueba muestre
 * un mail que nadie va a recibir.
 */
export function prepararCarrito(bloques: Bloque[], d: DatosCarrito): Bloque[] {
  const filas = filasResumen(d);
  const pie = filasTienda(d);
  const conResumen = mapearBloques(bloques, (b) =>
    b.tipo === "carrito" && b.vista === "resumen" ? { ...b, totales: filas }
      : b.tipo === "carrito" && b.vista === "tienda" ? { ...b, totales: pie } : b);
  return resolverCarritoEnDoc(conResumen, d);
}
