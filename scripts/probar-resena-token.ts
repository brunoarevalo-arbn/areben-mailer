// Ensayo del token firmado que lleva del mail a /opinar. Sin base, sin red.
//
//   RESENA_SECRET=vector-fijo-de-ensayo node --import tsx scripts/probar-resena-token.ts
//
// 🔴 EL VECTOR FIJO ES EL PUNTO DE ESTE ARCHIVO. `lib/resena-token.ts` está
// ESPEJADO en `areben-mailer`: uno firma y el otro verifica. El ensayo de los dos
// repos afirma el MISMO string contra el MISMO secreto, así que si alguien toca
// un lado —cambia el orden de las claves del payload, el encoding, el algoritmo—
// el otro repo se pone rojo antes del deploy, en vez de producir 400 contra una
// casilla real dentro de diez días.
import { firmarResena, verificarResena, type PayloadResena } from '../lib/resena-token.ts';

let ok = 0, mal = 0;
const chk = (nombre: string, cond: unknown, extra = '') => {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { mal++; console.error(`  ✗ ${nombre}${extra ? `\n      ${extra}` : ''}`); }
};
const titulo = (s: string) => console.log(`\n${s}`);

if (process.env.RESENA_SECRET !== 'vector-fijo-de-ensayo') {
  console.error('⛔ Corré con  RESENA_SECRET=vector-fijo-de-ensayo  o el vector no puede compararse.');
  process.exit(1);
}

const P: PayloadResena = {
  cuentaId: 'cta1', orderId: 'ord9', productoId: 'p42', producto: 'Funda MagSafe',
  email: 'a@b.com', nombre: 'Ana', rating: 4, exp: 4102444800000, // 2100
};

// ⛔ NO se recalcula: está escrito a mano y tiene que coincidir en los dos repos.
const VECTOR =
  'eyJjdWVudGFJZCI6ImN0YTEiLCJvcmRlcklkIjoib3JkOSIsInByb2R1Y3RvSWQiOiJwNDIiLCJwcm9kdWN0byI6IkZ1bmRhIE1hZ1NhZmUiLCJlbWFpbCI6ImFAYi5jb20iLCJub21icmUiOiJBbmEiLCJyYXRpbmciOjQsImV4cCI6NDEwMjQ0NDgwMDAwMH0.vKcwkSUmwpdj6DJJ6ozW7HJ_zfUyr_HQiqIsJew0X6M';

titulo('🔴 El vector fijo: los dos repos firman IGUAL');
{
  chk('el token es exactamente el esperado', firmarResena(P) === VECTOR, `dio ${firmarResena(P)}`);
  chk('y se verifica', JSON.stringify(verificarResena(VECTOR)) === JSON.stringify(P));
}

titulo('Un token editado NO pasa');
{
  const [body, sig] = VECTOR.split('.');
  chk('firma cambiada en un byte', verificarResena(`${body}.${sig.slice(0, -1)}X`) === null);
  chk('firma vacía', verificarResena(`${body}.`) === null);
  chk('sin punto', verificarResena(body) === null);
  chk('body vacío', verificarResena(`.${sig}`) === null);
  chk('basura', verificarResena('cualquier-cosa') === null);
  chk('string vacío', verificarResena('') === null);

  // 🔴 El caso de fondo: cambiar el PAYLOAD y dejar la firma vieja. Si esto
  // pasara, editar la URL alcanzaría para dejar 5 estrellas en nombre de otro,
  // o para reseñar un producto que la persona no compró.
  const otro = Buffer.from(JSON.stringify({ ...P, rating: 5 })).toString('base64url');
  chk('rating cambiado con la firma vieja', verificarResena(`${otro}.${sig}`) === null);
  const otroProd = Buffer.from(JSON.stringify({ ...P, productoId: 'p99' })).toString('base64url');
  chk('producto cambiado con la firma vieja', verificarResena(`${otroProd}.${sig}`) === null);
}

titulo('Un token RE-FIRMADO con datos inválidos tampoco pasa');
{
  // Éstos llevan firma NUESTRA y válida: lo único que los frena son las guardas
  // de forma. Sin ellas, un bug de quien firma se convierte en una reseña rota.
  chk('rating 0', verificarResena(firmarResena({ ...P, rating: 0 })!) === null);
  chk('rating 6', verificarResena(firmarResena({ ...P, rating: 6 })!) === null);
  chk('rating decimal', verificarResena(firmarResena({ ...P, rating: 4.5 })!) === null);
  chk('sin producto', verificarResena(firmarResena({ ...P, productoId: '' })!) === null);
  chk('sin cuenta', verificarResena(firmarResena({ ...P, cuentaId: '' })!) === null);
  chk('sin orden', verificarResena(firmarResena({ ...P, orderId: '' })!) === null);
  chk('sin email', verificarResena(firmarResena({ ...P, email: '' })!) === null);
  // Un nombre vacío SÍ pasa: TN no siempre trae el nombre y la página lo pide.
  chk('sin nombre igual pasa (la página lo pregunta)', verificarResena(firmarResena({ ...P, nombre: '' })!) !== null);
  // Ídem el nombre del producto: sólo decora la página. Si DECIDIERA algo tendría
  // que estar exigido arriba, como el `productoId`.
  chk('sin nombre de producto también pasa', verificarResena(firmarResena({ ...P, producto: '' })!) !== null);
}

titulo('El vencimiento corta');
{
  chk('vencido ayer', verificarResena(firmarResena({ ...P, exp: Date.now() - 1000 })!) === null);
  chk('vence en un minuto: todavía vale', verificarResena(firmarResena({ ...P, exp: Date.now() + 60_000 })!) !== null);
  chk('exp 0', verificarResena(firmarResena({ ...P, exp: 0 })!) === null);
}

console.log(`\n${mal === 0 ? '✅ Todo en verde' : `❌ ${mal} fallas`} · ${ok} comprobaciones`);
process.exit(mal === 0 ? 0 : 1);
