// El aviso interno del monitor (app/api/externo/aviso): sólo a casillas de la empresa,
// y nada que parta la cabecera. Lógica pura: sin base ni red.
//
// Correr:  node --import tsx scripts/probar-aviso-interno.ts
import { leerAviso, MAX_DESTINOS } from '../lib/email/aviso-interno.ts';

const errores: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) errores.push(msg);
};
const base = { para: ['darioarevalo@arebensrl.com'], asunto: 'Chequeo 13-oct', html: '<p>hola</p>', texto: 'hola' };

const r = leerAviso(base);
ok(r.ok && r.aviso.para[0] === 'darioarevalo@arebensrl.com', 'un aviso interno normal pasa');
ok(!leerAviso({ ...base, para: ['alguien@gmail.com'] }).ok, '🔴 una casilla de afuera ⛔ pasa');
ok(!leerAviso({ ...base, para: ['x@arebensrl.com.ar.evil.com'] }).ok, '🔴 un dominio que sólo EMPIEZA igual ⛔ pasa');
ok(!leerAviso({ ...base, para: ['darioarevalo@arebensrl.com', 'x@gmail.com'] }).ok, '🔴 una de afuera entre internas frena todo el pedido');
ok(!leerAviso({ ...base, para: [] }).ok, 'sin destinatarios ⛔ pasa');
ok(!leerAviso({ ...base, para: Array.from({ length: MAX_DESTINOS + 1 }, (_, i) => `p${i}@arebensrl.com`) }).ok, `más de ${MAX_DESTINOS} destinatarios ⛔ pasa`);
const salto = leerAviso({ ...base, asunto: 'Hola\r\nBcc: x@gmail.com' });
ok(salto.ok && !/[\r\n]/.test(salto.aviso.asunto), 'un salto de línea en el asunto ⛔ parte la cabecera');
ok(!leerAviso({ ...base, html: '' }).ok, 'sin html ⛔ pasa');
const dup = leerAviso({ ...base, para: ['DarioArevalo@arebensrl.com ', 'darioarevalo@arebensrl.com'] });
ok(dup.ok && dup.aviso.para.length === 1, 'la misma casilla dos veces sale una');

if (errores.length) {
  console.error(`\n${errores.length} fallaron`);
  process.exit(1);
}
console.log('\nTodo OK');
