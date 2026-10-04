// El ticket del local (la Caja del monitor) en el mail. Lógica pura: sin base ni red.
//
// 🔑 El oráculo es el ticket de PAPEL: la venta real #30049 (4-oct-2026) por la
// Caja — accesorio de $4.990 en efectivo, paga con $5.000 — y el caso de la
// pantalla de cobro de GN del que salió el núcleo: descuento $748,50, redondeo
// −$41,50, total $4.200. El mail tiene que decir esos números, ⛔ otros.
//
// Correr:  node --import tsx scripts/probar-ticket.ts
import { renderEmailHtml, renderEmailTexto, type Bloque } from '../lib/email/render.ts';
import { bloqueDeTicket, leerTicket, plata, fechaAR } from '../lib/email/ticket.ts';

const errores: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) errores.push(msg);
};

const T30049 = {
  ventaId: '0b6f1c8e-2d3a-4f5b-9c7d-1e2f3a4b5c6d',
  numero: 30049,
  fecha: '2026-10-04T18:30:00.000Z',
  renglones: [{ nombre: 'ACCESORIO NRO 1', talle: 'LILA', cantidad: 1, precio: 4990, importe: 4990 }],
  subtotal: 4990,
  pagos: [{ cuenta: 'Efectivo', porcentaje: 15, descuento: 748.5, redondeo: -41.5, monto: 4200 }],
  total: 4200,
  pagaCon: 5000,
  vuelto: 800,
  politica: 'Cambios dentro de los 30 días con este ticket.',
};

// ─── Validación ──────────────────────────────────────────────────────────────
const l = leerTicket(T30049);
ok(l.ok, 'el ticket de la #30049 se acepta');
ok(!leerTicket({ ...T30049, total: 4300 }).ok, 'los pagos que no suman el total se rechazan');
ok(!leerTicket({ ...T30049, subtotal: 5000 }).ok, 'los renglones que no suman el subtotal se rechazan');
ok(!leerTicket({ ...T30049, ventaId: 'abc' }).ok, 'un ventaId que no es uuid se rechaza');
ok(!leerTicket({ ...T30049, renglones: [] }).ok, 'sin renglones se rechaza');
ok(
  (() => { const r = leerTicket({ ...T30049, renglones: [{ ...T30049.renglones[0], foto: 'javascript:alert(1)' }] }); return r.ok && r.ticket.renglones[0].foto === null; })(),
  'una foto que no es https se descarta',
);

// ─── Los números del papel ───────────────────────────────────────────────────
ok(plata(748.5) === '$748,50' && plata(4200) === '$4.200' && plata(-41.5) === '$41,50', 'plata: $748,50 · $4.200 (como el ticket de GN)');
ok(fechaAR('2026-10-04T18:30:00.000Z') === '04/10/2026 15:30', 'la fecha va en hora de Argentina');

if (!l.ok) throw new Error('sin ticket');
const b = bloqueDeTicket(l.ticket);
const fila = (e: string) => b.totales.find((t) => t.etiqueta === e)?.monto;
ok(fila('Subtotal') === '$4.990', 'subtotal $4.990');
ok(fila('Descuento Efectivo 15%') === '−$748,50', 'descuento Efectivo 15% −$748,50');
ok(fila('Redondeo') === '−$41,50', 'redondeo −$41,50 (el que baja)');
ok(fila('TOTAL') === '$4.200' && b.totales.find((t) => t.etiqueta === 'TOTAL')?.fuerte === true, 'TOTAL $4.200, en grande');
ok(fila('Pagaste con Efectivo') === '$4.200', 'pagó $4.200 en Efectivo');
ok(fila('Vuelto') === '$800' && fila('Entregaste') === '$5.000', 'entregó $5.000, vuelto $800');
ok(b.pie[0] === 'Comprobante #30049 · 04/10/2026 15:30', 'el pie dice el número de GN y la fecha');

const sube = bloqueDeTicket({ ...l.ticket, pagos: [{ ...l.ticket.pagos[0], redondeo: 23 }] });
ok(sube.totales.some((t) => t.etiqueta === 'Recargo por redondeo' && t.monto === '+$23'), 'el redondeo que SUBE es «Recargo por redondeo» (Bruno, 4-oct)');
const sinVuelto = bloqueDeTicket({ ...l.ticket, pagaCon: null, vuelto: null });
ok(!sinVuelto.totales.some((t) => t.etiqueta === 'Vuelto'), 'sin «paga con» no hay vuelto');

const rebaja = bloqueDeTicket({ ...l.ticket, renglones: [{ nombre: 'TOP', cantidad: 2, precio: 10000, importe: 17000 }], subtotal: 17000 });
ok(rebaja.items[0].precio === '10000' && rebaja.items[0].precioPromo === '8500', 'una prenda rebajada tacha el de lista y muestra el unitario rebajado');

// ─── El mail ─────────────────────────────────────────────────────────────────
const bloque: Bloque = { tipo: 'carrito', items: b.items, modo: 'ticket', totales: b.totales, pie: b.pie };
const html = renderEmailHtml({ bloques: [bloque] }, { unsubscribeUrl: '#', nombreCuenta: 'ZATTIA' });
for (const n of ['ACCESORIO NRO 1', 'LILA', '$4.990', '−$748,50', '−$41,50', '$4.200', 'Vuelto', '$800', 'Comprobante #30049', 'Documento no válido como factura', 'Cambios dentro de los 30 días'])
  ok(html.includes(n), `HTML: «${n}»`);
ok(!/href=""/.test(html), 'HTML: las prendas sin ficha van sin link (⛔ href vacío)');
const txt = renderEmailTexto({ bloques: [bloque] }, { unsubscribeUrl: '#', nombreCuenta: 'ZATTIA' });
ok(txt.includes('TOTAL: $4.200') && txt.includes('Vuelto: $800') && txt.includes('Comprobante #30049'), 'texto plano: total, vuelto y número');

// El modo carrito de siempre ⛔ dibuja totales aunque vengan.
const carrito = renderEmailHtml({ bloques: [{ ...bloque, modo: undefined }] }, { unsubscribeUrl: '#', nombreCuenta: 'ZATTIA' });
ok(!carrito.includes('Vuelto'), 'fuera del modo ticket, los totales ⛔ se dibujan');

if (errores.length) {
  console.log(`\n❌ ${errores.length} falla(s)`);
  process.exit(1);
}
console.log('\n✅ todo bien');
