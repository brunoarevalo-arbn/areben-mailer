// El ticket de una venta del local (la Caja del monitor), pasado a lo que dibuja
// el bloque `carrito` en modo `"ticket"`.
//
// 🔑 ⛔ CALCULA: los montos llegan del monitor, que son los MISMOS que mandó a
// Gestión Nube y que imprimió la térmica (`lib/caja/ticket.ts` del monitor). Acá
// sólo se validan y se escriben. Un mail que recalcule es un mail que puede decir
// un total distinto del ticket de papel.
//
// Puro: lo usan el endpoint `POST /api/externo/ticket` (valida al recibir), el
// procesador de automations (arma el bloque al enviar) y `probar-ticket.ts`.
import type { FilaTotal, ProductoEmail } from "./bloques";

export interface RenglonTicket {
  nombre: string;
  talle?: string | null;
  cantidad: number;
  /** Precio unitario de etiqueta. */
  precio: number;
  /** cantidad × precio, con la rebaja de la prenda si la hubo. */
  importe: number;
  foto?: string | null;
}

export interface PagoTicket {
  /** La forma de pago («Tarjeta de crédito»). Desde el 4-oct-2026 la cuenta de GN es interna: el
   *  monitor manda el medio, ⛔ el nombre de la cuenta. */
  cuenta: string;
  /** La parte de este pago del descuento a mano a TODA la venta (0 si ⛔ hubo). */
  rebaja: number;
  porcentaje: number;
  descuento: number;
  /** > 0 = recargo por redondeo; < 0 = redondeo que baja. */
  redondeo: number;
  monto: number;
}

/** Lo que guarda `triggerData.ticket`. */
export interface TicketLocal {
  /** El id de la venta en la Caja (uuid = `integration_id` de GN). Deduplica el run. */
  ventaId: string;
  /** El número de la venta en GN. */
  numero: number | null;
  /** Instante de la venta, ISO. */
  fecha: string;
  renglones: RenglonTicket[];
  subtotal: number;
  pagos: PagoTicket[];
  total: number;
  pagaCon: number | null;
  vuelto: number | null;
  politica: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : NaN);
const texto = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");
const numONull = (x: unknown) => (x == null ? null : num(x));

/**
 * Valida el ticket que manda el monitor. Devuelve el ticket limpio o el motivo
 * del rechazo, con nombre: el que llama lo devuelve en un 400.
 *
 * 🔑 Exige que los renglones y los pagos CIERREN (Σ importes = subtotal, Σ pagos
 * = total, al centavo). Un ticket que no cierra es un bug del que lo armó, y es
 * mejor que no salga a que le llegue a la clienta un comprobante que no suma.
 */
export function leerTicket(x: unknown): { ok: true; ticket: TicketLocal } | { ok: false; error: string } {
  if (!x || typeof x !== "object") return { ok: false, error: "falta el ticket" };
  const t = x as Record<string, unknown>;
  const ventaId = texto(t.ventaId, 40);
  if (!UUID.test(ventaId)) return { ok: false, error: "ventaId inválido (uuid)" };
  const fecha = texto(t.fecha, 40);
  if (Number.isNaN(Date.parse(fecha))) return { ok: false, error: "fecha inválida" };
  const numero = numONull(t.numero);
  if (numero !== null && !(Number.isInteger(numero) && numero > 0)) return { ok: false, error: "numero inválido" };

  if (!Array.isArray(t.renglones) || t.renglones.length === 0 || t.renglones.length > 50)
    return { ok: false, error: "renglones: entre 1 y 50" };
  const renglones: RenglonTicket[] = [];
  for (const [i, r0] of t.renglones.entries()) {
    const r = (r0 ?? {}) as Record<string, unknown>;
    const fila: RenglonTicket = {
      nombre: texto(r.nombre, 120) || "Producto",
      talle: texto(r.talle, 60) || null,
      cantidad: num(r.cantidad),
      precio: num(r.precio),
      importe: num(r.importe),
      foto: /^https:\/\//.test(texto(r.foto, 500)) ? texto(r.foto, 500) : null,
    };
    if (!(Number.isInteger(fila.cantidad) && fila.cantidad > 0) || !(fila.precio >= 0) || !(fila.importe >= 0))
      return { ok: false, error: `renglón ${i + 1}: cantidad, precio o importe inválido` };
    renglones.push(fila);
  }

  if (!Array.isArray(t.pagos) || t.pagos.length === 0 || t.pagos.length > 10)
    return { ok: false, error: "pagos: entre 1 y 10" };
  const pagos: PagoTicket[] = [];
  for (const [i, p0] of t.pagos.entries()) {
    const p = (p0 ?? {}) as Record<string, unknown>;
    const pago: PagoTicket = {
      cuenta: texto(p.cuenta, 60),
      // Opcional: los tickets de antes del 4-oct ⛔ lo traen.
      rebaja: p.rebaja == null ? 0 : num(p.rebaja),
      porcentaje: num(p.porcentaje),
      descuento: num(p.descuento),
      redondeo: num(p.redondeo),
      monto: num(p.monto),
    };
    if (!pago.cuenta || [pago.rebaja, pago.porcentaje, pago.descuento, pago.redondeo, pago.monto].some(Number.isNaN) || !(pago.monto > 0) || pago.rebaja < 0)
      return { ok: false, error: `pago ${i + 1} inválido` };
    pagos.push(pago);
  }

  const subtotal = num(t.subtotal);
  const total = num(t.total);
  if (!(subtotal >= 0) || !(total > 0)) return { ok: false, error: "subtotal o total inválido" };
  const c = (n: number) => Math.round(n * 100);
  if (c(renglones.reduce((s, r) => s + r.importe, 0)) !== c(subtotal))
    return { ok: false, error: "los renglones no suman el subtotal" };
  if (c(pagos.reduce((s, p) => s + p.monto, 0)) !== c(total)) return { ok: false, error: "los pagos no suman el total" };

  const pagaCon = numONull(t.pagaCon);
  const vuelto = numONull(t.vuelto);
  if (Number.isNaN(pagaCon) || Number.isNaN(vuelto) || (vuelto !== null && vuelto < 0))
    return { ok: false, error: "pagaCon o vuelto inválido" };

  return {
    ok: true,
    ticket: { ventaId: ventaId.toLowerCase(), numero, fecha, renglones, subtotal, pagos, total, pagaCon, vuelto, politica: texto(t.politica, 1000) || null },
  };
}

/** Pesos argentinos como el ticket de papel: centavos sólo si hay ($748,50 · $4.200). */
export function plata(n: number): string {
  const r = Math.round(n * 100) / 100;
  const conCentavos = Math.round(Math.abs(r) * 100) % 100 !== 0;
  return "$" + Math.abs(r).toLocaleString("es-AR", { minimumFractionDigits: conCentavos ? 2 : 0, maximumFractionDigits: 2 });
}

/** Fecha y hora de Argentina (UTC−3, sin horario de verano). */
export function fechaAR(iso: string): string {
  const ar = new Date(Date.parse(iso) - 3 * 3600_000).toISOString();
  return `${ar.slice(8, 10)}/${ar.slice(5, 7)}/${ar.slice(0, 4)} ${ar.slice(11, 16)}`;
}

/**
 * Lo que dibuja el bloque: las prendas, los renglones de plata y el pie. Mismo
 * orden y mismas palabras que el ticket de papel (🔴 el redondeo que sube es
 * «Recargo por redondeo», como en los tickets de GN — Bruno, 4-oct-2026).
 */
export function bloqueDeTicket(t: TicketLocal): { items: ProductoEmail[]; totales: FilaTotal[]; pie: string[] } {
  const items: ProductoEmail[] = t.renglones.map((r) => {
    const lista = r.cantidad * r.precio;
    const conRebaja = Math.round(r.importe * 100) < Math.round(lista * 100);
    return {
      nombre: r.nombre,
      variante: r.talle ?? undefined,
      cantidad: r.cantidad,
      precio: String(r.precio),
      // El precio con la rebaja de la prenda, por unidad: el bloque tacha el de lista.
      precioPromo: conRebaja ? String(Math.round((r.importe / r.cantidad) * 100) / 100) : undefined,
      imagen: r.foto ?? "",
      url: "",
    };
  });

  const totales: FilaTotal[] = [{ etiqueta: "Subtotal", monto: plata(t.subtotal) }];
  // 🔑 Cascada (Bruno, 4-oct): prenda (tachada arriba) ⇒ venta ⇒ forma de pago, que dice sólo
  // «Descuento 15%»: ⛔ «Descuento Transferencia CG».
  const aVenta = Math.round(t.pagos.reduce((s, p) => s + (p.rebaja || 0), 0) * 100) / 100;
  if (aVenta > 0) totales.push({ etiqueta: "Descuento en la venta", monto: `−${plata(aVenta)}` });
  for (const p of t.pagos) {
    if (p.descuento > 0) totales.push({ etiqueta: `Descuento ${p.porcentaje}%`, monto: `−${plata(p.descuento)}` });
    if (p.redondeo > 0) totales.push({ etiqueta: "Recargo por redondeo", monto: `+${plata(p.redondeo)}` });
    if (p.redondeo < 0) totales.push({ etiqueta: "Redondeo", monto: `−${plata(p.redondeo)}` });
  }
  totales.push({ etiqueta: "TOTAL", monto: plata(t.total), fuerte: true });
  for (const p of t.pagos) totales.push({ etiqueta: `Pagaste con ${p.cuenta}`, monto: plata(p.monto) });
  if (t.pagaCon != null && t.vuelto != null) {
    totales.push({ etiqueta: "Entregaste", monto: plata(t.pagaCon) });
    totales.push({ etiqueta: "Vuelto", monto: plata(t.vuelto) });
  }

  const pie = [
    `Comprobante ${t.numero != null ? `#${t.numero}` : "en proceso"} · ${fechaAR(t.fecha)}`,
    "Documento no válido como factura",
  ];
  if (t.politica) pie.push(t.politica);
  return { items, totales, pie };
}
