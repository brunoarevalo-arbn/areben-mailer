// Los webhooks de rebotes/quejas no procesan nada sin autenticar. Sin base ni red.
//
// Por qué existe: `/api/webhooks/*` está en `PUBLIC_PREFIXES` (proxy.ts) y lo
// único que hace es SUPRIMIR contactos. La supresión es **de una sola vía** —un
// suprimido no vuelve a ACTIVO ni re-importando el CSV, ver
// lib/contactos/importar.ts—, así que un POST anónimo que pase el filtro no
// tiene deshacer: quema audiencia para siempre.
//
// Hasta el 30-jul-2026 los dos handlers hacían `if (secret) { … }`, o sea que
// **sin la env configurada aceptaban cualquier cosa**. Este script existe para
// que esa forma no vuelva.
//
// Correr:  node --import tsx scripts/probar-webhooks.ts
import { createHmac } from 'node:crypto';

// Los handlers importan `aplicarSupresion` → `lib/prisma`, que TIRA al importarse
// si no hay DATABASE_URL. Una URL de mentira alcanza: el cliente de Prisma se
// construye sin conectarse, y ninguna de estas pruebas llega a hacer una query
// (por eso la del camino feliz usa un evento que el handler ignora). Así el
// script sigue corriendo sin base, sin red y sin --env-file.
process.env.DATABASE_URL ??= 'postgresql://x:x@localhost:5432/x';

// Import dinámico y dentro de main(): los `import` estáticos se izan, y la env
// de arriba tiene que estar puesta ANTES de que se evalúe lib/prisma. Además tsx
// compila estos scripts a CJS, donde no hay top-level await.

const errores: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) errores.push(msg);
};

const SECRET = 'whsec_' + Buffer.from('clave-de-prueba-para-firmar').toString('base64');
// El payload que un atacante mandaría: quemar contactos reales.
const ATAQUE = JSON.stringify({ type: 'email.bounced', data: { to: ['cliente@bdiaccesorios.com.ar'] } });

function firmar(raw: string, secret: string, ts = Math.floor(Date.now() / 1000), id = 'msg_1') {
  const clave = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const sig = createHmac('sha256', clave).update(`${id}.${ts}.${raw}`).digest('base64');
  return { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': `v1,${sig}` };
}
const pedido = (raw: string, headers: Record<string, string> = {}, url = 'https://x/api/webhooks/resend') =>
  new Request(url, { method: 'POST', body: raw, headers });

async function main() {
  const { POST: resendPost } = await import('../app/api/webhooks/resend/route.ts');
  const { POST: sendgridPost } = await import('../app/api/webhooks/sendgrid/route.ts');

  // ─── Resend ──────────────────────────────────────────────────────────────────
  {
    delete process.env.RESEND_WEBHOOK_SECRET;
    // ⚠️ El try/catch NO es cosmético. Si alguien restaura el `if (secret && …)`,
    // la request llega hasta `aplicarSupresion` y Prisma explota contra la
    // DATABASE_URL de mentira. Sin esto se ve un stack de Prisma que parece
    // "al script le falta la base" — y el reflejo sería correrlo con
    // `--env-file=.env`, que **suprimiría un contacto real de producción**.
    try {
      const r = await resendPost(pedido(ATAQUE));
      ok(r.status === 503, `sin RESEND_WEBHOOK_SECRET: se rechaza (${r.status}, esperado 503)`);
      ok(r.status !== 200, '🔴 sin secret NO se procesa la supresión (el agujero del 30-jul)');
    } catch {
      ok(false, '🔴 sin secret el handler INTENTÓ suprimir: el chequeo volvió a fallar abierto');
      console.error('   ↑ NO corras esto con --env-file: contra la base real habría suprimido de verdad.');
    }
  }
  {
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    const r = await resendPost(pedido(ATAQUE));
    ok(r.status === 401, `con secret pero sin headers Svix: 401 (${r.status})`);
  }
  {
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    const otra = 'whsec_' + Buffer.from('otra-clave-distinta-cualquiera').toString('base64');
    const r = await resendPost(pedido(ATAQUE, firmar(ATAQUE, otra)));
    ok(r.status === 401, `firmado con OTRA clave: 401 (${r.status})`);
  }
  {
    // Replay: firma válida pero de hace una hora. La ventana es de 5 minutos.
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    const viejo = Math.floor(Date.now() / 1000) - 3600;
    const r = await resendPost(pedido(ATAQUE, firmar(ATAQUE, SECRET, viejo)));
    ok(r.status === 401, `replay de un payload de hace 1 h: 401 (${r.status})`);
  }
  {
    // Body cambiado después de firmar: la firma ya no cierra.
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    const headers = firmar(ATAQUE, SECRET);
    const alterado = JSON.stringify({ type: 'email.bounced', data: { to: ['otra@victima.com'] } });
    const r = await resendPost(pedido(alterado, headers));
    ok(r.status === 401, `body alterado después de firmar: 401 (${r.status})`);
  }
  {
    // Firma buena. Se usa un evento que el handler ignora para no tocar la base:
    // prueba el camino de autenticación, no el de supresión.
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    const raw = JSON.stringify({ type: 'email.delivered', data: { to: ['x@y.com'] } });
    const r = await resendPost(pedido(raw, firmar(raw, SECRET)));
    ok(r.status === 200, `firma válida: pasa (${r.status})`);
  }

  // ─── SendGrid ────────────────────────────────────────────────────────────────
  const URL_SG = 'https://x/api/webhooks/sendgrid';
  const EV = JSON.stringify([{ email: 'cliente@bdiaccesorios.com.ar', event: 'bounce', type: 'blocked' }]);
  {
    delete process.env.SENDGRID_WEBHOOK_TOKEN;
    const r = await sendgridPost(pedido(EV, {}, URL_SG));
    ok(r.status === 503, `sin SENDGRID_WEBHOOK_TOKEN: se rechaza (${r.status}, esperado 503)`);
  }
  {
    process.env.SENDGRID_WEBHOOK_TOKEN = 'tok-secreto';
    const r = await sendgridPost(pedido(EV, {}, `${URL_SG}?token=equivocado`));
    ok(r.status === 401, `token equivocado: 401 (${r.status})`);
  }

  console.log();
  if (errores.length) {
    for (const e of errores) console.error(`❌ ${e}`);
    process.exit(1);
  }
  console.log('✅ Los webhooks fallan cerrado.\n');
}

main();
