// Los avisos de retiro en el local (`lib/email/pedido.ts`, 26-oct-2026):
//  - sólo el LOCAL dispara: la sucursal del correo también es «pickup» y ⛔ entra;
//  - «retirado» sale de la orden (delivered / DELIVERED), no del nombre del evento;
//  - la fila «A PAGAR» se cae entera si ya pagó, y una transferencia pendiente ⛔ es efectivo;
//  - ⛔ nunca sale un `${pedido.…}` crudo (cuerpo, asunto, preheader, adentro de una banda);
//  - la vista `pedido` del carrito no muestra precios, ni en el HTML ni en el texto plano;
//  - los dos triggers cuelgan de los eventos de TN que corresponden.
//
// Correr:  node --import tsx scripts/probar-retiro.ts
import assert from 'node:assert/strict';
import {
  efectivoPendiente, esRetiroEnLocal, estaCancelada, estaRetirado, horarioEnTexto, lineasDePedido,
  pedidoDeOrden, resolverPedidoEnBloques, resolverPedidoEnTexto, type OrdenTnRetiro,
} from '../lib/email/pedido.ts';
import { TRIGGER_EVENT, EVENT_TRIGGER } from '../lib/tn/eventos.ts';
import { renderEmailHtml, renderEmailTexto } from '../lib/email/render.ts';
import { leerContenido, V_ACTUAL } from '../lib/email/esquema.ts';
import { MAX_POR_TRIGGER, ESPERAS_SIGUIENTES, vaAHoraFija, cuandoSale } from '../lib/automations.ts';

let fallas = 0;
const caso = (nombre: string, f: () => void) => {
  try { f(); console.log(`  ✓ ${nombre}`); } catch (e) { fallas++; console.log(`  ✗ ${nombre}\n    ${(e as Error).message}`); }
};

// Las formas MEDIDAS en Zattia el 26-oct (#7396 local, #7397 sucursal del correo, #7382 retirado).
const HORAS = [1, 2, 3, 4, 5, 6].map((day) => ({ day, start: '1000', end: '1900' }));
const local: OrdenTnRetiro = {
  number: 7396, status: 'open', shipping: 'pickup-point', shipping_pickup_type: 'pickup', shipping_status: 'unshipped',
  shipping_pickup_details: { name: 'Zattia Store', address: { address: 'Santa Fe', number: '1435', locality: 'Centro', city: 'Rosario' }, hours: HORAS },
  fulfillments: [{ status: 'READY_FOR_PICKUP' }], contact_name: 'Sofía Gómez', payment_status: 'paid', gateway_name: 'Pago Nube', total: '35073.00',
};
const correo: OrdenTnRetiro = { ...local, number: 7397, shipping: 'api_3799350', shipping_pickup_details: { name: 'Envío Nube - Correo Argentino Clásico a sucursal' } };
const domicilio: OrdenTnRetiro = { ...local, shipping: 'api_3799350', shipping_pickup_type: 'ship', shipping_pickup_details: null };

console.log('\n── qué dispara');
caso('el retiro en el LOCAL dispara', () => assert.equal(esRetiroEnLocal(local), true));
caso('la sucursal del correo (también «pickup») ⛔ dispara', () => assert.equal(esRetiroEnLocal(correo), false));
caso('el envío a domicilio ⛔ dispara', () => assert.equal(esRetiroEnLocal(domicilio), false));
caso('empaquetado ⛔ es retirado', () => assert.equal(estaRetirado(local), false));
caso('shipping_status delivered = retirado', () => assert.equal(estaRetirado({ ...local, shipping_status: 'delivered' }), true));
caso('fulfillment DELIVERED = retirado', () => assert.equal(estaRetirado({ ...local, fulfillments: [{ status: 'DELIVERED' }] }), true));
caso('cancelada se reconoce', () => assert.equal(estaCancelada({ ...local, status: 'cancelled' }), true));

console.log('\n── los datos del pedido');
caso('horario corrido y parejo se resume', () => assert.equal(horarioEnTexto(HORAS), 'Lunes a sábado, de 10 a 19'));
caso('horario salteado ⛔ se junta (un resumen que miente manda a un local cerrado)', () =>
  assert.equal(horarioEnTexto([{ day: 1, start: '1000', end: '1900' }, { day: 3, start: '1000', end: '1900' }]), 'Lunes de 10 a 19 y miércoles de 10 a 19'));
// BDI, medido en la orden real el 26-oct: lunes a viernes 10-19 y el sábado 10-13.
const BDI = [1, 2, 3, 4, 5].map((day) => ({ day, start: '1000', end: '1900' })).concat({ day: 6, start: '1000', end: '1300' });
caso('el sábado corto de BDI va en su TRAMO (⛔ seis veces «de 10 a 19»)', () =>
  assert.equal(horarioEnTexto(BDI), 'Lunes a viernes de 10 a 19 y sábados de 10 a 13'));
caso('tres tramos: comas y la «y» al final', () =>
  assert.equal(horarioEnTexto([...BDI.slice(0, 2), { day: 3, start: '1400', end: '1930' }, { day: 6, start: '1000', end: '1300' }]),
    'Lunes a martes de 10 a 19, miércoles de 14 a 19:30 y sábados de 10 a 13'));
caso('sin horario: vacío', () => assert.equal(horarioEnTexto(null), ''));
caso('pagado: sin efectivo', () => assert.equal(efectivoPendiente(local), ''));
caso('efectivo pendiente: el total', () => assert.equal(efectivoPendiente({ ...local, payment_status: 'pending', gateway_name: 'Efectivo (ROSARIO)', total: '42111.90' }), '$42.111,90'));
caso('transferencia pendiente ⛔ es «abonás en efectivo»', () => assert.equal(efectivoPendiente({ ...local, payment_status: 'pending', gateway_name: 'Transferencia' }), ''));
const p = pedidoDeOrden(local);
caso('número, titular, local, dirección', () => assert.deepEqual([p.numero, p.titular, p.local, p.direccion], ['7396', 'Sofía Gómez', 'Zattia Store', 'Santa Fe 1435, Centro, Rosario']));
const { productos, restantes } = lineasDePedido([{ name: 'SHORT ATLAS (42)', name_without_variants: 'SHORT ATLAS', variant_values: ['42'], quantity: 1, image: { src: 'https://x/a.jpg' } }, { name: 'MINI VINNI', name_without_variants: null, quantity: '2' }]);
caso('las prendas salen de la orden, sin precio y sin link', () => {
  assert.equal(productos.length, 2); assert.equal(restantes, 0);
  for (const x of productos as { precio: string; url: string }[]) { assert.equal(x.precio, ''); assert.equal(x.url, ''); }
  assert.equal((productos[1] as { nombre: string; cantidad: number }).nombre, 'MINI VINNI');
  assert.equal((productos[1] as { cantidad: number }).cantidad, 2);
});

console.log('\n── los tags');
const fila = (texto: string) => ({ id: 'x' + Math.random(), tipo: 'texto', texto });
const bloques = [
  fila('Tu pedido #${pedido.numero}'),
  fila('A PAGAR · Abonás ${pedido.efectivo} en efectivo'),
  { id: 'b', tipo: 'banda', bloques: [fila('A nombre de ${pedido.titular}'), fila('Abonás ${pedido.efectivo}')] },
];
caso('ya pagó: la fila de efectivo se cae ENTERA (también adentro de la banda)', () => {
  const r = resolverPedidoEnBloques(bloques as never[], p) as unknown as { tipo: string; texto?: string; bloques?: { texto: string }[] }[];
  assert.equal(r.length, 2);
  assert.equal(r[0].texto, 'Tu pedido #7396');
  assert.deepEqual(r[1].bloques!.map((b) => b.texto), ['A nombre de Sofía Gómez']);
});
caso('con efectivo, la fila queda con el monto', () => {
  const r = resolverPedidoEnBloques(bloques as never[], { ...p, efectivo: '$1.000' }) as unknown as { texto?: string }[];
  assert.equal(r[1].texto, 'A PAGAR · Abonás $1.000 en efectivo');
});
caso('sin pedido (run viejo, dato roto): ningún tag sale crudo', () => {
  const r = JSON.stringify(resolverPedidoEnBloques(bloques as never[], undefined));
  assert.ok(!r.includes('${pedido.'), r);
});
caso('una clave inventada se cae, ⛔ sale cruda', () => assert.equal(resolverPedidoEnBloques([fila('${pedido.inventado}')] as never[], p).length, 0));
caso('asunto y preheader: reemplazo, y sin dato vacío (⛔ crudo)', () => {
  assert.equal(resolverPedidoEnTexto('Tu pedido #${pedido.numero} está listo', p), 'Tu pedido #7396 está listo');
  assert.equal(resolverPedidoEnTexto('Pasá ${pedido.efectivo} hoy', p), 'Pasá hoy');
});

console.log('\n── la vista `pedido` del carrito');
const items = [{ nombre: 'SHORT ATLAS', variante: '42', cantidad: 1, precio: '25990.00', imagen: 'https://x/a.jpg', url: '' }];
const doc = leerContenido({ v: V_ACTUAL, bloques: [{ id: 'c', tipo: 'carrito', vista: 'pedido', items }] });
const html = renderEmailHtml(doc, { unsubscribeUrl: 'https://x/baja', nombreCuenta: 'Zattia' });
const texto = renderEmailTexto(doc, { unsubscribeUrl: 'https://x/baja', nombreCuenta: 'Zattia' });
caso('dibuja la prenda y la cantidad', () => { assert.ok(html.includes('SHORT ATLAS')); assert.ok(html.includes('x1')); });
caso('⛔ precio en el HTML aunque el ítem lo traiga', () => assert.ok(!/25\.990|25990/.test(html)));
caso('⛔ precio en el texto plano', () => { assert.ok(texto.includes('SHORT ATLAS')); assert.ok(!/25\.990|25990/.test(texto), texto); });
caso('⛔ link en la línea (no hay a dónde llevar)', () => assert.ok(!/<a [^>]*>\s*<img[^>]*a\.jpg/.test(html)));
// La foto 4:5 de BDI: el alto lo pone el ARCHIVO. `object-fit` lo ignoran Gmail y Outlook.
caso('la foto lleva sólo el ancho (⛔ alto fijo ni object-fit: aplasta las 4:5)', () => {
  const img = /<img[^>]*a\.jpg[^>]*>/.exec(html)?.[0] ?? '';
  assert.ok(img && !/object-fit|height="/.test(img) && /height:auto/.test(img), img);
});
caso('lo que no entra se cuenta como «productos» (⛔ «prendas»: BDI vende fundas)', () => {
  const muchos = leerContenido({ v: V_ACTUAL, bloques: [{ id: 'c', tipo: 'carrito', vista: 'pedido', items, restantes: 2 }] });
  const h = renderEmailHtml(muchos, { unsubscribeUrl: 'https://x/baja', nombreCuenta: 'BDI' });
  assert.ok(!/prenda/.test(h + renderEmailTexto(muchos, { unsubscribeUrl: 'https://x/baja', nombreCuenta: 'BDI' })));
});

console.log('\n── el pase de BDI: la banda con `borde` y `cabecera`');
const pase = { id: 'p', tipo: 'banda', fondo: '#ffffff', borde: '#1b1717', cabecera: { izquierda: 'Tu pedido', derecha: '#${pedido.numero}' }, bloques: [{ id: 't', tipo: 'texto', texto: 'hola' }] };
caso('el `${pedido.numero}` de la cabecera se resuelve (⛔ crudo)', () => {
  const [b] = resolverPedidoEnBloques([pase] as never[], p) as unknown as { cabecera: { derecha: string } }[];
  assert.equal(b.cabecera.derecha, '#7396');
});
caso('la cabecera se pinta del color del borde, y sale en el texto plano', () => {
  const d = leerContenido({ v: V_ACTUAL, bloques: resolverPedidoEnBloques([pase] as never[], p) });
  const h = renderEmailHtml(d, { unsubscribeUrl: 'https://x/baja', nombreCuenta: 'BDI' });
  assert.ok(/border:1px solid #1b1717/.test(h) && /bgcolor="#1b1717"[^>]*>.*TU PEDIDO.*#7396/s.test(h), 'html');
  assert.ok(renderEmailTexto(d, { unsubscribeUrl: 'https://x/baja', nombreCuenta: 'BDI' }).includes('TU PEDIDO #7396'));
});
caso('sin `borde` no hay cabecera ni filete (⛔ cambia una banda vieja)', () => {
  const sin = { ...pase, borde: undefined };
  const h = renderEmailHtml(leerContenido({ v: V_ACTUAL, bloques: [sin] }), { unsubscribeUrl: 'https://x/baja', nombreCuenta: 'BDI' });
  assert.ok(!/TU PEDIDO|border:1px solid #1b1717/.test(h));
});

console.log('\n── el cableado');
caso('RETIRO_LISTO ← order/packed, RETIRADO ← order/fulfilled', () => {
  assert.equal(TRIGGER_EVENT.RETIRO_LISTO, 'order/packed');
  assert.equal(TRIGGER_EVENT.RETIRADO, 'order/fulfilled');
  assert.deepEqual(EVENT_TRIGGER['order/packed'], ['RETIRO_LISTO']);
});
caso('order/paid sigue despertando COMPRA y RESENA (no se pisó)', () => assert.deepEqual(EVENT_TRIGGER['order/paid'], ['COMPRA', 'RESENA']));
caso('el retiro admite listo + 2 recordatorios, con una escalera de 2', () => {
  assert.equal(MAX_POR_TRIGGER.RETIRO_LISTO, 3);
  assert.equal(ESPERAS_SIGUIENTES.RETIRO_LISTO.length, MAX_POR_TRIGGER.RETIRO_LISTO - 1);
});
caso('el 1º sale al instante; los recordatorios, el día N a las 11', () => {
  assert.equal(vaAHoraFija('RETIRO_LISTO', 0), false);
  assert.equal(vaAHoraFija('RETIRO_LISTO', 72), true);
  const sale = cuandoSale('RETIRO_LISTO', 72, new Date('2026-10-26T23:30:00-03:00'));
  assert.equal(sale.toISOString(), '2026-10-29T14:00:00.000Z'); // jueves 29, 11:00 de Argentina
});

console.log(fallas ? `\n🔴 ${fallas} falla(s)\n` : '\n✅ todo en verde\n');
process.exit(fallas ? 1 : 0);
