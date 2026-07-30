// Invariantes del cupón de la bienvenida de pop-up. Lógica pura: sin base ni red.
//
// El caso que justifica el archivo es el tercero: un lead del backfill no tiene
// cupón, y si el bloque se dibujara igual saldría el placeholder de la plantilla
// —`BIENVENIDA10`— que **no existe en Tiendanube**. El cliente lo tipea en el
// checkout, no anda, y el mail queda peor que si no hubiera traído nada.
//
// Correr:  node --import tsx scripts/probar-bienvenida.ts
import { aplicarCuponDelTrigger } from '../lib/email/cupon-trigger.ts';
import { renderEmailHtml, type Bloque } from '../lib/email/render.ts';
import { TRIGGER_EVENT, EVENT_TRIGGER } from '../lib/tn/eventos.ts';

const OPTS = { unsubscribeUrl: '#', nombreCuenta: 'BDI' };

const CUPON: Bloque = {
  tipo: 'cupon',
  texto: '10% en tu primera compra',
  codigo: 'BIENVENIDA10',
  botonTexto: 'Comprar',
  botonUrl: 'https://bdiaccesorios.com.ar',
};
const base = (): Bloque[] => [{ tipo: 'titulo', texto: 'Hola' }, { ...CUPON }];

const errores: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) errores.push(msg);
};
const html = (bloques: Bloque[]) => renderEmailHtml({ bloques }, OPTS);

// ─── 1. El run del webhook de TN no se toca ──────────────────────────────────
// Compatibilidad hacia atrás: quien tipeó un código estático lo sigue viendo.
{
  const r = aplicarCuponDelTrigger(base(), { orderId: '123' } as never);
  ok(html(r).includes('BIENVENIDA10'), 'webhook de TN (sin origen): el código estático se respeta');
  ok(html(r).includes('10% en tu primera compra'), 'webhook de TN: el texto del autor no se pisa');
}

// ─── 2. Lead de pop-up con cupón: se pisa el código ──────────────────────────
{
  const r = aplicarCuponDelTrigger(base(), { origen: 'popup', cupon: 'BDI-X7K2', condiciones: 'Válido 24 h' });
  const h = html(r);
  ok(h.includes('BDI-X7K2'), 'lead con cupón: sale el código REAL de Tiendanube');
  ok(!h.includes('BIENVENIDA10'), 'lead con cupón: el placeholder de la plantilla no sobrevive');
  ok(h.includes('Válido 24 h'), 'las condiciones se muestran');
  ok(h.includes('10% en tu primera compra'), 'las condiciones se AGREGAN, no reemplazan al texto');
}

// ─── 3. Lead sin cupón (backfill): el bloque se elimina ──────────────────────
// 🔴 La invariante cara del archivo.
{
  const r = aplicarCuponDelTrigger(base(), { origen: 'popup', backfill: true } as never);
  const h = html(r);
  ok(!h.includes('BIENVENIDA10'), 'backfill sin cupón: NO sale un código que no existe en TN');
  ok(!r.some((b) => b.tipo === 'cupon'), 'backfill sin cupón: el bloque se elimina entero');
  ok(h.includes('Hola'), 'backfill: el resto del mail sigue saliendo');
}
// Un crearCupon que falló deja `cupon: null`, no ausente. Tiene que caer igual.
{
  const r = aplicarCuponDelTrigger(base(), { origen: 'popup', cupon: null });
  ok(!r.some((b) => b.tipo === 'cupon'), 'cupon null (crearCupon falló): el bloque también se elimina');
}

// ─── 4. El premio de la ruleta le gana al texto de la plantilla ──────────────
// En una ruleta el texto del bloque puede no tener nada que ver con lo que salió:
// "10% en tu primera compra" cuando la persona vio girar "Envío gratis".
{
  const r = aplicarCuponDelTrigger(base(), {
    origen: 'popup', cupon: 'BDI-ENV', prizeLabel: 'Envío gratis', condiciones: 'Compra mínima $20.000',
  });
  const h = html(r);
  ok(h.includes('Envío gratis'), 'con premio: se anuncia lo que la persona vio ganar');
  ok(!h.includes('10% en tu primera compra'), 'con premio: el texto genérico de la plantilla no contradice al premio');
  ok(h.includes('Compra mínima $20.000'), 'con premio: las condiciones siguen saliendo');
}

// ─── 5. Nada de lo que viene de afuera entra crudo al HTML ───────────────────
// El código lo arma Resorty, pero llega por una columna Json: si algún día algo
// lo ensucia, no puede escaparse del documento.
{
  const r = aplicarCuponDelTrigger(base(), { origen: 'popup', cupon: '<script>x</script>' });
  ok(!html(r).includes('<script>'), 'un código con HTML adentro sale escapado');
}

// ─── 6. La pregunta es "¿vino de una captura?", no "¿vino de un pop-up?" ─────
// 🔴 Hasta el 30-jul-2026 esto preguntaba `td.origen !== 'popup'`. Los
// formularios `/f/[slug]` son la segunda superficie de captura y todavía no
// encolan runs; el día que lo hagan, con el literal hardcodeado caerían en la
// rama del webhook de TN y le mandarían a cada lead el placeholder de la
// plantilla — un código que no existe en Tiendanube. Se prueba con un `origen`
// que hoy nadie escribe a propósito: el que se rompe es el futuro.
{
  const conCupon = aplicarCuponDelTrigger(base(), { origen: 'formulario', cupon: 'Z-9F3K' });
  const h = html(conCupon);
  ok(h.includes('Z-9F3K'), 'otra superficie de captura: el código real también se pisa');
  ok(!h.includes('BIENVENIDA10'), 'otra superficie de captura: el placeholder tampoco sobrevive');

  const sinCupon = aplicarCuponDelTrigger(base(), { origen: 'formulario' });
  ok(!sinCupon.some((b) => b.tipo === 'cupon'), 'otra superficie SIN cupón: el bloque se elimina igual');
}
// Y la contracara: sin `origen` sigue siendo el webhook, y no se toca nada.
// Un `origen: ''` cuenta como ausente — un string vacío no es una superficie.
{
  const r = aplicarCuponDelTrigger(base(), { origen: '', cupon: 'X' });
  ok(html(r).includes('BIENVENIDA10'), 'origen vacío: se trata como el webhook y el código estático queda');
}

// ─── 7. `NUEVO_SUSCRIPTOR` no puede dispararse desde Tiendanube ──────────────
// Es lo que hace que el trigger no necesite un filtro en ningún lado: el
// webhook resuelve evento → trigger con este mapa, y el que no está no existe.
// Si alguien le agrega un evento acá, esta invariante se pone roja el mismo día.
{
  ok(!('NUEVO_SUSCRIPTOR' in TRIGGER_EVENT), 'NUEVO_SUSCRIPTOR no mapea a ningún evento de Tiendanube');
  ok(!Object.values(EVENT_TRIGGER).includes('NUEVO_SUSCRIPTOR'), 'ningún evento de TN resuelve a NUEVO_SUSCRIPTOR');
  ok(TRIGGER_EVENT.NUEVO_CLIENTE === 'customer/created', 'NUEVO_CLIENTE sí sigue colgando de customer/created');
}

// ─── 8. Un mail sin bloque `cupon` no se rompe ───────────────────────────────
// Es el caso REAL de hoy: ninguna de las 4 bienvenidas declara el bloque.
{
  const sinBloque: Bloque[] = [{ tipo: 'titulo', texto: 'Hola' }];
  ok(
    html(aplicarCuponDelTrigger(sinBloque, { origen: 'popup', cupon: 'BDI-X7K2' })).includes('Hola'),
    'bienvenida sin bloque de cupón: el mail sale igual (el caso de hoy)',
  );
}

console.log();
if (errores.length) {
  for (const e of errores) console.error(`❌ ${e}`);
  process.exit(1);
}
console.log('✅ Invariantes de la bienvenida OK.\n');
