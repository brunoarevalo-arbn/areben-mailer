// Las reglas del barrido de carritos recuperados (`lib/carritos.ts`).
//
// POR QUÉ EXISTE. Las dos reglas que fija son de la peor clase: invertir
// cualquiera de las dos **no rompe nada**. El endpoint sigue devolviendo 200, el
// build pasa, el typecheck pasa, el cron no se queja — y la única métrica que
// contesta "¿esto sirve?" queda mal para siempre, de un modo que recién se nota
// mirando un número raro tres semanas después.
//
// ✅ VERIFICADO EN ROJO. Cada comprobación se probó mutando `decidirCarrito`:
//   - devolviendo `{ revisadoAt }` para "desconocido"   → 2 fallas
//   - devolviendo `null` para "abierto"                 → 2 fallas
//   - usando `ahora` en vez del `completed_at` de TN    → 1 falla
//   - `TOLERANCIA_FALLOS = 0`                           → 3 fallas
//   - `TOLERANCIA_FALLOS = Infinity`                    → 1 falla
// Un ensayo que no se vio en rojo no prueba nada (ver el episodio de la sonda).
//
// Correr: node --import tsx scripts/probar-recuperados.ts
import { cuentaViva, decidirCarrito, TOLERANCIA_FALLOS } from '../lib/carritos.ts';

let ok = 0;
const fallas: string[] = [];

function comprobar(nombre: string, condicion: boolean) {
  if (condicion) ok++;
  else fallas.push(nombre);
}

const AHORA = new Date('2026-08-08T21:00:00.000Z');
const COMPRA = new Date('2026-08-08T18:30:00.000Z');

// ── REGLA 1: un "no sé" no se marca como revisado ────────────────────────────
//
// Si esto se invierte, una caída de la API de TN deja un lote entero sellado
// como consultado y no se lo vuelve a mirar hasta 12 h después, con la ventana
// de 7 días corriendo. Los carritos de ese lote no se cuentan nunca.
{
  const d = decidirCarrito('desconocido', null, AHORA);
  comprobar('un "desconocido" no escribe nada', d === null);
  comprobar(
    'un "desconocido" NO sella revisadoAt (si no, un fallo de TN se lee como "no compró")',
    d?.revisadoAt === undefined,
  );
}

// ── REGLA 2: un "sigue abierto" SÍ se marca ──────────────────────────────────
//
// Es la mitad que se olvida, y su modo de falla es peor que el de la regla 1:
// la consulta del barrido ordena por `revisadoAt NULLS FIRST`, así que sin el
// sello vuelve a levantar los MISMOS carritos en cada corrida y no avanza
// nunca — los que están más allá del tope no se consultan jamás.
{
  const d = decidirCarrito('abierto', null, AHORA);
  comprobar('un "abierto" escribe algo', d !== null);
  comprobar('un "abierto" sella revisadoAt (o el barrido no avanza nunca)', d?.revisadoAt === AHORA);
  comprobar('un "abierto" NO lo marca recuperado', d?.estado === undefined);
  comprobar('un "abierto" no inventa fecha de compra', d?.completadoAt === undefined);
}

// ── REGLA 3: la fecha de compra sale de TN cuando TN la tiene ────────────────
{
  const conFecha = decidirCarrito('completado', COMPRA, AHORA);
  comprobar('un "completado" lo marca RECUPERADO', conFecha?.estado === 'RECUPERADO');
  comprobar(
    'un "completado" con objeto usa el completed_at DE TN, no el reloj nuestro',
    conFecha?.completadoAt === COMPRA,
  );
  comprobar('un "completado" también sella revisadoAt', conFecha?.revisadoAt === AHORA);

  // El 404 es el caso NORMAL, no el raro: un checkout que se convierte en orden
  // desaparece de TN. Ahí no hay objeto y `ahora` es una cota superior.
  const sinFecha = decidirCarrito('completado', null, AHORA);
  comprobar('un "completado" por 404 igual lo marca RECUPERADO', sinFecha?.estado === 'RECUPERADO');
  comprobar('un "completado" sin objeto cae a ahora (cota superior)', sinFecha?.completadoAt === AHORA);
  comprobar(
    'un undefined se trata igual que un null (TN puede no mandar el campo)',
    decidirCarrito('completado', undefined, AHORA)?.completadoAt === AHORA,
  );
}

// ── El corte por cuenta ──────────────────────────────────────────────────────
//
// La regla 1 sola es una bomba: sin marcar nada, un token vencido son 40
// llamadas fallidas cada 15 minutos, para siempre.
{
  comprobar('una cuenta sin fallos se consulta', cuentaViva(0));
  comprobar('un fallo suelto no corta la cuenta', cuentaViva(1));
  comprobar(
    `la cuenta se corta al llegar a ${TOLERANCIA_FALLOS} fallos seguidos`,
    !cuentaViva(TOLERANCIA_FALLOS),
  );
  comprobar('la tolerancia no es 0 (un fallo puntual no puede cortar la cuenta)', cuentaViva(0));
  comprobar('la tolerancia es finita (una cuenta rota no puede consultarse sin fin)', !cuentaViva(999));
}

// ── La invariante que ata las tres ───────────────────────────────────────────
//
// Todo lo que escribe, sella. Es lo que garantiza que el barrido siempre avance:
// cualquier decisión que toque la fila la saca de la cabeza de la cola.
{
  const casos: [Parameters<typeof decidirCarrito>[0], Date | null][] = [
    ['abierto', null],
    ['completado', null],
    ['completado', COMPRA],
    ['desconocido', null],
  ];
  const todasSellan = casos
    .map(([e, f]) => decidirCarrito(e, f, AHORA))
    .filter((d) => d !== null)
    .every((d) => d!.revisadoAt instanceof Date);
  comprobar('TODA escritura sella revisadoAt ⇒ el barrido siempre avanza', todasSellan);
}

console.log(`\n${fallas.length === 0 ? '✅' : '❌'} ${ok} comprobaciones OK, ${fallas.length} fallas`);
for (const f of fallas) console.log(`   ❌ ${f}`);
process.exit(fallas.length === 0 ? 0 : 1);
