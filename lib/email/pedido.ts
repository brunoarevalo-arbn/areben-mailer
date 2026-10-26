/**
 * Los mails de RETIRO EN EL LOCAL (26-oct-2026): «listo para retirar», los dos
 * recordatorios y «gracias por pasar». Puro: lo usan el webhook de TN, el
 * procesador y `probar-retiro.ts`.
 *
 * POR QUÉ existen. Tiendanube tiene su «Listo para retirar» PRENDIDO en Zattia y
 * no lo manda: en 5 de 5 retiros empaquetados el historial del pedido registra el
 * mail de compra y el de pago, y ⛔ ninguno de retiro (medido en el admin el
 * 26-oct). Había pedidos «Por retirar» de un mes sin que la clienta supiera nada.
 *
 * 🔴 **«Retiro» en TN son DOS cosas** y las dos llegan con
 * `shipping_pickup_type: "pickup"`: el local propio (`shipping: "pickup-point"`,
 * «Zattia Store») y la SUCURSAL DEL CORREO de Envío Nube (`shipping: "api_…"`,
 * que la API nombra «Punto de retiro»). Estos mails son SÓLO del local: a la
 * sucursal del correo la avisa el correo. Medido en 4 pedidos reales el 26-oct.
 */

/** Lo que el mail necesita del pedido. Viaja en `triggerData.pedido`. */
export interface PedidoRetiro {
  /** «7396», sin el #. */
  numero: string;
  /** El nombre de quien hizo la compra: es lo que se pide en el mostrador. */
  titular: string;
  /** «$35.073» si paga en efectivo al retirar; vacío si ya pagó. */
  efectivo: string;
  /** «Zattia Store». */
  local: string;
  /** «Santa Fe 1435, Centro, Rosario». */
  direccion: string;
  /** «Lunes a sábado, de 10 a 19». Vacío si TN no trae horario. */
  horario: string;
  /** El link a Google Maps armado de la dirección. */
  mapa: string;
}

/** La forma mínima de una orden de TN que se lee acá (todo opcional: TN omite campos). */
export interface OrdenTnRetiro {
  number?: number | string;
  status?: string;
  shipping?: string;
  shipping_pickup_type?: string;
  shipping_status?: string;
  shipping_pickup_details?: {
    name?: string | null;
    address?: { address?: string | null; number?: string | null; locality?: string | null; city?: string | null } | null;
    hours?: { day?: number; start?: string; end?: string }[] | null;
  } | null;
  fulfillments?: { status?: string }[] | null;
  contact_name?: string | null;
  billing_name?: string | null;
  customer?: { name?: string | null } | null;
  payment_status?: string;
  gateway?: string;
  gateway_name?: string | null;
  total?: string | number;
}

/** ¿Es un retiro en el LOCAL propio? (⛔ la sucursal del correo, ver arriba.) */
export function esRetiroEnLocal(o: OrdenTnRetiro): boolean {
  return o.shipping_pickup_type === "pickup" && o.shipping === "pickup-point";
}

/**
 * ¿Ya lo retiró? Medido en Zattia el 26-oct sobre tres retirados: `shipping_status`
 * `delivered` y el fulfillment en `DELIVERED`. Cualquiera de los dos alcanza.
 */
export function estaRetirado(o: OrdenTnRetiro): boolean {
  if (o.shipping_status === "delivered") return true;
  return (o.fulfillments ?? []).some((f) => f.status === "DELIVERED");
}

/** Una orden cancelada no se va a retirar: ningún recordatorio. */
export function estaCancelada(o: OrdenTnRetiro): boolean {
  return o.status === "cancelled";
}

/** «35073.00» → «$35.073». Los centavos sólo si los hay. */
export function fmtPesos(v: string | number | undefined): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return "";
  const entero = Number.isInteger(n);
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: entero ? 0 : 2, maximumFractionDigits: 2 });
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const hora = (h?: string) => {
  const m = /^(\d{2})(\d{2})$/.exec(h ?? "");
  if (!m) return "";
  return m[2] === "00" ? String(Number(m[1])) : `${Number(m[1])}:${m[2]}`;
};

/** «sábado» → «sábados»: un día suelto de un horario con varios TRAMOS se dice en plural. */
const plural = (dia: string) => (dia.endsWith("s") ? dia : `${dia}s`);

/**
 * El horario de TN («day 1..6, 1000-1900») en una frase. Se agrupa en TRAMOS: días
 * CORRIDOS con el mismo horario. Un tramo solo: «Lunes a sábado, de 10 a 19» (Zattia).
 * Varios: «Lunes a viernes de 10 a 19 y sábados de 10 a 13» (BDI cierra a las 13 el
 * sábado; hasta el 26-oct eso salía día por día, seis veces «de 10 a 19»).
 * ⛔ Nunca se junta lo que no es corrido ni igual: un resumen que miente manda a
 * alguien a un local cerrado.
 */
export function horarioEnTexto(hours: { day?: number; start?: string; end?: string }[] | null | undefined): string {
  const hs = (hours ?? []).filter((h) => typeof h.day === "number" && hora(h.start) && hora(h.end)).sort((a, b) => a.day! - b.day!);
  if (!hs.length) return "";
  const tramos: (typeof hs)[] = [];
  for (const h of hs) {
    const t = tramos[tramos.length - 1];
    const ult = t?.[t.length - 1];
    if (ult && h.day === ult.day! + 1 && h.start === ult.start && h.end === ult.end) t.push(h);
    else tramos.push([h]);
  }
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const dias = (t: typeof hs, varios: boolean) =>
    t.length === 1 ? (varios ? plural(DIAS[t[0].day!]) : DIAS[t[0].day!]) : `${DIAS[t[0].day!]} a ${DIAS[t[t.length - 1].day!]}`;
  const de = (t: typeof hs) => `de ${hora(t[0].start)} a ${hora(t[0].end)}`;
  if (tramos.length === 1) return `${cap(dias(tramos[0], false))}, ${de(tramos[0])}`;
  const partes = tramos.map((t) => `${dias(t, true)} ${de(t)}`);
  return cap(`${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`);
}

/**
 * Efectivo pendiente: se paga en el mostrador. TN lo marca como medio `offline`
 * («Efectivo (ROSARIO)») con el pago `pending`. ⛔ Una transferencia pendiente no
 * es «abonás en efectivo»: ahí falta que se acredite, que es otra conversación.
 */
export function efectivoPendiente(o: OrdenTnRetiro): string {
  if (o.payment_status !== "pending") return "";
  if (!/efectivo/i.test(o.gateway_name ?? "")) return "";
  return fmtPesos(o.total);
}

export function pedidoDeOrden(o: OrdenTnRetiro): PedidoRetiro {
  const d = o.shipping_pickup_details ?? {};
  const a = d.address ?? {};
  const calle = [a.address, a.number].filter(Boolean).join(" ");
  const direccion = [calle, a.locality, a.city].filter(Boolean).join(", ");
  const paraMapa = [calle, a.city].filter(Boolean).join(", ");
  return {
    numero: o.number == null ? "" : String(o.number),
    titular: (o.contact_name || o.billing_name || o.customer?.name || "").trim(),
    efectivo: efectivoPendiente(o),
    local: (d.name ?? "").trim(),
    direccion,
    horario: horarioEnTexto(d.hours),
    mapa: paraMapa ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(paraMapa)}` : "",
  };
}

/** Un producto tal como viene adentro de una orden de TN (lo que se usa acá). */
export interface ProductoDeOrden {
  name?: string;
  name_without_variants?: string | null;
  image?: string | { src?: string } | null;
  quantity?: number | string;
  variant_values?: string[] | null;
}

/** Cuántas prendas se dibujan; el resto se cuenta («y 3 más»). */
export const TOPE_PEDIDO = 12;

/**
 * Las prendas del pedido para el bloque `carrito` en vista `pedido`.
 *
 * 🔑 **Salen de la ORDEN, sin pedir la ficha** (al revés que la reseña, que la
 * necesita para el link). Lo que se retira es lo que se compró: una prenda que
 * después se despublicó igual está en la bolsa y tiene que figurar. Sin `url` la
 * línea va sin link, y sin precio: confirma, no vende.
 */
export function lineasDePedido(products: ProductoDeOrden[] | null | undefined): { productos: object[]; restantes: number } {
  const todos = products ?? [];
  const productos = todos.slice(0, TOPE_PEDIDO).map((p) => {
    const cantidad = Number(p.quantity);
    return {
      // `name` trae la variante pegada; `name_without_variants` es null en los
      // productos sin variantes (medido en BDI), de ahí el fallback.
      nombre: p.name_without_variants || p.name || "",
      variante: p.variant_values?.length ? p.variant_values.join(" · ") : undefined,
      cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1,
      precio: "",
      imagen: typeof p.image === "string" ? p.image : p.image?.src ?? "",
      url: "",
    };
  });
  return { productos, restantes: Math.max(0, todos.length - productos.length) };
}

// ── Los tags `${pedido.…}` ────────────────────────────────────────────────────

const TAG = /\$\{pedido\.([a-zA-Z]+)\}/g;
const CLAVES: (keyof PedidoRetiro)[] = ["numero", "titular", "efectivo", "local", "direccion", "horario", "mapa"];

/** El valor de un tag, o `null` si no hay dato (o la clave no existe). */
function valor(pedido: PedidoRetiro | undefined, clave: string): string | null {
  if (!pedido || !(CLAVES as string[]).includes(clave)) return null;
  const v = pedido[clave as keyof PedidoRetiro];
  return v ? v : null;
}

/** ¿Algún string de adentro de `x` lleva un tag `${pedido.…}` SIN dato? */
function llevaTagVacio(x: unknown, pedido: PedidoRetiro | undefined): boolean {
  if (typeof x === "string") return [...x.matchAll(TAG)].some((m) => valor(pedido, m[1]) === null);
  if (Array.isArray(x)) return x.some((y) => llevaTagVacio(y, pedido));
  if (x && typeof x === "object") return Object.values(x).some((y) => llevaTagVacio(y, pedido));
  return false;
}

function reemplazar<T>(x: T, pedido: PedidoRetiro): T {
  if (typeof x === "string") return x.replace(TAG, (_m, k) => valor(pedido, k) ?? "") as T;
  if (Array.isArray(x)) return x.map((y) => reemplazar(y, pedido)) as T;
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, reemplazar(v, pedido)])) as T;
  return x;
}

/**
 * Resuelve los `${pedido.…}` de los bloques, ANTES de dibujar (así el renderer
 * los escapa como a cualquier texto).
 *
 * 🔴 **Un bloque con un tag sin dato se cae ENTERO**, y es la regla y no un
 * descuido: la fila «A PAGAR · Abonás ${pedido.efectivo} en efectivo» es un bloque
 * propio, y sin efectivo pendiente tiene que desaparecer, no salir como «Abonás
 * en efectivo». Lo mismo un horario que TN no trajo. ⛔ Nunca sale el tag crudo.
 * Va también adentro de una `banda`: un hijo se cae, la franja queda.
 */
export function resolverPedidoEnBloques<B extends { tipo: string }>(bloques: B[], pedido: PedidoRetiro | undefined): B[] {
  return bloques
    .filter((b) => b.tipo === "banda" || !llevaTagVacio(b, pedido))
    .map((b) => {
      if (b.tipo !== "banda") return pedido ? reemplazar(b, pedido) : b;
      const hijos = ((b as unknown as { bloques?: B[] }).bloques ?? []);
      // Lo PROPIO de la banda (la `cabecera` del pase) también lleva tags.
      const propia = pedido ? reemplazar({ ...b, bloques: [] }, pedido) : b;
      return { ...propia, bloques: resolverPedidoEnBloques(hijos, pedido) };
    });
}

/** Asunto y preheader: el tag se reemplaza; sin dato, vacío (⛔ nunca crudo). */
export function resolverPedidoEnTexto(s: string | null | undefined, pedido: PedidoRetiro | undefined): string {
  return (s ?? "").replace(TAG, (_m, k) => valor(pedido, k) ?? "").replace(/\s{2,}/g, " ").trim();
}
