// El ticket del local (la Caja del monitor) en el mail. Lógica pura: sin base ni red.
//
// 🔑 El oráculo es el ticket de PAPEL: la venta real #30049 (4-oct-2026) por la
// Caja — accesorio de $4.990 en efectivo, paga con $5.000 — y el caso de la
// pantalla de cobro de GN del que salió el núcleo: descuento $748,50, redondeo
// −$41,50, total $4.200. El mail tiene que decir esos números, ⛔ otros.
//
// Correr:  node --import tsx scripts/probar-ticket.ts
import { renderEmailHtml, renderEmailTexto, type Bloque } from '../lib/email/render.ts';
import { bloqueDeTicket, leerTicket, lineaComprobante, plata, fechaAR } from '../lib/email/ticket.ts';
import { conTicketDePrueba, rellenoDeTicket } from '../lib/email/prueba.ts';

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
ok(fila('Descuento 15%') === '−$748,50', 'descuento 15% −$748,50, sin el nombre de la cuenta (Bruno, 4-oct)');
ok(fila('Redondeo') === '−$41,50', 'redondeo −$41,50 (el que baja)');
ok(fila('TOTAL') === '$4.200' && b.totales.find((t) => t.etiqueta === 'TOTAL')?.fuerte === true, 'TOTAL $4.200, en grande');
// 🔴 La forma de pago ⛔ sale (Bruno, 12-oct-2026: «el medio de cobro en los mails no sirve»).
const PAGO = /Pagaste con|Entregaste|Vuelto/;
ok(!b.totales.some((t) => PAGO.test(t.etiqueta)), '⛔ «Pagaste con», «Entregaste» ni «Vuelto» en los totales (Bruno, 12-oct)');
ok(b.totales[b.totales.length - 1].etiqueta === 'TOTAL', 'el TOTAL es el último renglón');
ok(b.cabecera.numero === 30049 && b.cabecera.fecha === '04/10/2026 15:30', 'cabecera: el número de GN y la fecha, sueltos');
ok(lineaComprobante(b.cabecera) === 'Comprobante #30049 · 04/10/2026 15:30', 'la línea del comprobante: número y fecha');
ok(lineaComprobante({ numero: null, fecha: 'x' }) === 'Comprobante en proceso · x', 'sin número: «en proceso»');
ok(b.pie[0] === 'Documento no válido como factura' && !b.pie.some((l) => l.startsWith('Comprobante')), 'el pie ya ⛔ trae el número (va en la cabecera)');
ok(b.totales.find((t) => t.etiqueta === 'Descuento 15%')?.tipo === 'descuento' && b.totales.find((t) => t.etiqueta === 'Redondeo')?.tipo === 'ajuste', 'el descuento y el redondeo van marcados');

const sube = bloqueDeTicket({ ...l.ticket, pagos: [{ ...l.ticket.pagos[0], redondeo: 23 }] });
ok(sube.totales.some((t) => t.etiqueta === 'Redondeo' && t.monto === '+$23'), 'el redondeo que SUBE es «Redondeo» con «+» (Bruno, 12-oct)');
ok(!sube.totales.some((t) => /recargo/i.test(t.etiqueta)), '⛔ «Recargo»: siempre «Redondeo» (Bruno, 12-oct)');
const sinVuelto = bloqueDeTicket({ ...l.ticket, pagaCon: null, vuelto: null });
ok(!sinVuelto.totales.some((t) => t.etiqueta === 'Vuelto'), 'sin «paga con» no hay vuelto');

const rebaja = bloqueDeTicket({ ...l.ticket, renglones: [{ nombre: 'TOP', cantidad: 2, precio: 10000, importe: 17000 }], subtotal: 17000 });
ok(rebaja.items[0].precio === '10000' && rebaja.items[0].precioPromo === '8500', 'una prenda rebajada tacha el de lista y muestra el unitario rebajado');

// Cascada (Bruno, 4-oct): $10.000 −20 % prenda (tachada) ⇒ −$800 a la venta ⇒ −10 % ⇒ $6.500 por Transferencia.
const cascada = leerTicket({ ...l.ticket, renglones: [{ nombre: 'TOP', cantidad: 1, precio: 10000, importe: 8000 }], subtotal: 8000,
  pagos: [{ cuenta: 'Transferencia', rebaja: 800, porcentaje: 10, descuento: 720, redondeo: 20, monto: 6500 }], total: 6500, pagaCon: null, vuelto: null });
ok(cascada.ok, 'un pago con «rebaja» valida');
if (cascada.ok) {
  const bc = bloqueDeTicket(cascada.ticket);
  const fc = (e: string) => bc.totales.find((t) => t.etiqueta === e)?.monto;
  ok(fc('Descuento en la venta') === '−$800' && fc('Descuento 10%') === '−$720' && fc('TOTAL') === '$6.500' && !fc('Pagaste con Transferencia'), 'cascada: «Descuento en la venta» −$800, «Descuento 10%» −$720, TOTAL $6.500 (⛔ el medio)');
}
ok(!b.totales.some((t) => t.etiqueta === 'Descuento en la venta'), 'sin descuento a la venta ⛔ sale el renglón');
const negativa = leerTicket({ ...l.ticket, pagos: [{ ...l.ticket.pagos[0], rebaja: -1 }] });
ok(!negativa.ok, 'una rebaja negativa se rechaza');

// ─── El mail ─────────────────────────────────────────────────────────────────
const bloque: Bloque = { tipo: 'carrito', items: b.items, ...rellenoDeTicket(b) };
const OPTS = { unsubscribeUrl: '#', nombreCuenta: 'ZATTIA' };
const html = renderEmailHtml({ bloques: [bloque] }, OPTS);
for (const n of ['ACCESORIO NRO 1', 'LILA', '$4.990', '−$748,50', '−$41,50', '$4.200', 'Comprobante #30049 · 04/10/2026 15:30', 'Documento no válido como factura', 'Cambios dentro de los 30 días'])
  ok(html.includes(n), `HTML: «${n}»`);
ok(html.indexOf('Comprobante #30049') < html.indexOf('Documento no válido'), 'vista de siempre (Zattia): el comprobante sigue siendo el primer renglón del pie');
for (const n of ['Pagaste con', 'Entregaste', 'Vuelto', 'Efectivo', '$5.000', '$800']) ok(!html.includes(n), `HTML: ⛔ «${n}»`);
ok(!/href=""/.test(html), 'HTML: las prendas sin ficha van sin link (⛔ href vacío)');
const txt = renderEmailTexto({ bloques: [bloque] }, OPTS);
ok(txt.includes('TOTAL: $4.200') && txt.includes('Comprobante #30049 · 04/10/2026 15:30'), 'texto plano: total y número');
ok(!PAGO.test(txt) && !txt.includes('Efectivo'), 'texto plano: ⛔ el medio de cobro');

// El modo carrito de siempre ⛔ dibuja totales aunque vengan.
const carrito = renderEmailHtml({ bloques: [{ ...bloque, modo: undefined }] }, OPTS);
ok(!carrito.includes('Subtotal') && !carrito.includes('Comprobante'), 'fuera del modo ticket, los totales ⛔ se dibujan');

// ─── El descuento en su color (BDI: magenta) ─────────────────────────────────
ok(!html.includes('#e40044'), 'sin `colorDescuento`, el descuento sale como los demás renglones');
const conColor = renderEmailHtml({ bloques: [{ ...bloque, colorDescuento: '#E40044' } as Bloque] }, OPTS);
ok(/color:#e40044">Descuento 15%/.test(conColor) && !/color:#e40044">Subtotal/.test(conColor), 'con `colorDescuento`, SÓLO los descuentos en ese color (vista de siempre)');
const malo = renderEmailHtml({ bloques: [{ ...bloque, colorDescuento: 'red;background:url(x)' } as Bloque] }, OPTS);
ok(!malo.includes('url(x)') && malo === html, 'un color basura se descarta (⛔ llega al style)');
const token = renderEmailHtml({ bloques: [{ ...bloque, colorDescuento: '$acento' } as Bloque], tema: { acento: '#123456' } }, OPTS);
ok(/color:#123456">Descuento 15%/.test(token), 'un token (`$acento`) se resuelve contra el tema');

// ─── La vista `tarjeta` (ticket de BDI) ─────────────────────────────────────
const CABLE = 'CABLE TIPO C CLD DISPLAY 60W - 1m';
const tb = bloqueDeTicket({ ...l.ticket, numero: 48217, renglones: [
  { nombre: 'LUCKY CASE', talle: 'iPhone 15', cantidad: 1, precio: 10000, importe: 10000, foto: 'https://x.test/lucky.jpg' },
  { nombre: CABLE, talle: null, cantidad: 2, precio: 3000, importe: 6000, foto: 'https://x.test/cable.png' },
], subtotal: 16000, pagos: [{ cuenta: 'Transferencia', rebaja: 0, porcentaje: 10, descuento: 1600, redondeo: 27, monto: 14427 }], total: 14427 });
const tarjeta: Bloque = { tipo: 'carrito', items: tb.items, vista: 'tarjeta', colorDescuento: '#e40044',
  estilo: { titulo: { mayusculas: true } }, ...rellenoDeTicket(tb) } as Bloque;
const th = renderEmailHtml({ bloques: [tarjeta] }, OPTS);
ok(th.includes('TU TICKET') && th.includes('#48217 · 04/10/2026 15:30'), 'tarjeta: la franja dice «TU TICKET» y «#número · fecha»');
ok(!th.includes('Comprobante'), 'tarjeta: el número ⛔ se repite en el pie');
ok(th.includes('Documento no válido como factura'), 'tarjeta: la letra chica al pie');
ok(th.includes(CABLE) && !/text-transform:uppercase[^>]*>CABLE/.test(th), 'tarjeta: el nombre como viene de GN (⛔ mayúsculas forzadas aunque el estilo las pida)');
ok(/<img[^>]*lucky\.jpg[^>]*width="64"/.test(th) && !/<img[^>]*lucky\.jpg[^>]*height="/.test(th) && /lucky\.jpg[^>]*height:auto/.test(th), 'tarjeta: la foto con ancho 64 y alto según el archivo');
ok(!/<img[^>]*(lucky|cable)[^>]*object-fit/.test(th), 'tarjeta: ⛔ object-fit (Gmail lo ignora)');
ok(th.includes('iPhone 15') && th.includes('2 u.'), 'tarjeta: el modelo abajo del nombre, y la cantidad');
ok(/color:#e40044;font-weight:600">Descuento 10%/.test(th), 'tarjeta: el descuento en el color elegido');
ok(/bgcolor="[^"]+"[^>]*font-style:italic[^>]*>\$14\.427</.test(th), 'tarjeta: el TOTAL en barra, con el monto en bold italic');
ok(th.includes('Redondeo') && !/Recargo/i.test(th) && th.includes('+$27'), 'tarjeta: el redondeo, sin «Recargo»');
for (const n of ['Pagaste con', 'Entregaste', 'Vuelto', 'Transferencia']) ok(!th.includes(n), `tarjeta: ⛔ «${n}»`);
const tt = renderEmailTexto({ bloques: [tarjeta] }, OPTS);
ok(tt.includes('Comprobante #48217') && tt.includes('TOTAL: $14.427') && tt.includes('Descuento 10%: −$1.600') && !PAGO.test(tt), 'tarjeta, texto plano: número, descuento y total, ⛔ el medio');
const fueraDeTicket = renderEmailHtml({ bloques: [{ ...tarjeta, modo: undefined } as Bloque] }, OPTS);
ok(!fueraDeTicket.includes('TU TICKET'), 'la tarjeta es un comprobante: fuera del modo ticket cae a la lista');

// «Mandar una prueba» de TICKET: con el ticket de un run real, por `conCarrito`
// —el mismo relleno que el procesador—, y ⛔ sin ticket ⇒ no hay prueba.
const doc: Bloque[] = [
  { tipo: 'texto', texto: 'Gracias' } as Bloque,
  { tipo: 'banda', bloques: [{ tipo: 'carrito' } as Bloque] } as Bloque,
];
const conT = conTicketDePrueba(doc, { ticket: T30049 });
const prueba = conT && renderEmailHtml({ bloques: conT }, { unsubscribeUrl: '#', nombreCuenta: 'ZATTIA' });
ok(!!prueba && ['ACCESORIO NRO 1', '$4.200', 'Comprobante #30049'].every((n) => prueba.includes(n)) && !prueba.includes('Vuelto'), 'prueba: el ticket del run real entra al carrito de adentro de la banda (con su cabecera)');
ok(!!conT && JSON.stringify(conT).split('"tipo":"carrito"').length === 2, 'prueba: ⛔ appendea un segundo carrito si ya hay uno');
ok(conTicketDePrueba(doc, {}) === null && conTicketDePrueba(doc, null) === null, 'prueba: sin ticket en el run ⇒ null (⛔ prueba vacía)');
ok(conTicketDePrueba(doc, { ticket: { ...T30049, total: 1 } }) === null, 'prueba: un ticket que no cierra ⇒ null');

if (errores.length) {
  console.log(`\n❌ ${errores.length} falla(s)`);
  process.exit(1);
}
console.log('\n✅ todo bien');
