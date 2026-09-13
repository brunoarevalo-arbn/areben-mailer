// La firma de los webhooks de Tiendanube se verifica como la FIRMA TN. Sin base ni red.
//
// Por qué existe: hasta el 12-sep-2026 `verifyTnWebhook` comparaba contra base64 y
// TN manda HEX ⇒ **todos los webhooks reales rebotaban con 401**, callados. La
// prueba a mano había salido verde porque firmaba con la misma codificación que
// verificaba. 🔑 Por eso el oráculo acá NO sale de `lib/tn/webhook.ts`: es la
// fórmula de la documentación de TN, `hash_hmac('sha256', $data, APP_SECRET)` de
// PHP, que devuelve hex en minúsculas.
//
// Correr:  node --import tsx scripts/probar-tn-webhook.ts
import { createHmac } from 'node:crypto';

// `lib/tn/webhook` importa `lib/prisma`, que tira sin DATABASE_URL. Una URL de
// mentira alcanza: ninguna prueba hace una query.
process.env.DATABASE_URL ??= 'postgresql://x:x@localhost:5432/x';

const errores: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) errores.push(msg);
};

const SECRET = 'secret-de-prueba-de-la-app';
const BODY = JSON.stringify({ store_id: 1096065, event: 'order/paid', id: 2068940908 });

/** Lo que hace PHP con `hash_hmac('sha256', $data, APP_SECRET)`: hex en minúsculas. */
const comoTn = (raw: string, secret = SECRET) => createHmac('sha256', secret).update(raw, 'utf8').digest('hex');

async function main() {
  const { verifyTnWebhook } = await import('../lib/tn/webhook.ts');

  process.env.TN_CLIENT_SECRET = SECRET;
  ok(verifyTnWebhook(BODY, comoTn(BODY)), 'la firma HEX de TN pasa (el caso real que rebotaba)');
  ok(verifyTnWebhook(BODY, comoTn(BODY).toUpperCase()), 'el hex en mayúsculas también pasa');
  ok(
    verifyTnWebhook(BODY, createHmac('sha256', SECRET).update(BODY, 'utf8').digest('base64')),
    'base64 del mismo digest sigue pasando',
  );
  ok(!verifyTnWebhook(BODY, comoTn(BODY, 'otro-secret')), 'firmado con OTRO secret no pasa');
  ok(!verifyTnWebhook(BODY + ' ', comoTn(BODY)), 'un byte cambiado en el cuerpo no pasa');
  ok(!verifyTnWebhook(BODY, 'xxx'), 'basura no pasa (y no tira por largo distinto)');
  ok(!verifyTnWebhook(BODY, null), 'sin header no pasa');
  ok(!verifyTnWebhook(BODY, ''), 'header vacío no pasa');

  delete process.env.TN_CLIENT_SECRET;
  ok(!verifyTnWebhook(BODY, comoTn(BODY)), 'sin TN_CLIENT_SECRET no pasa NADA, ni la firma correcta');

  if (errores.length) {
    console.log(`\n❌ ${errores.length} falla(s)`);
    process.exit(1);
  }
  console.log('\n✅ Todo en verde');
}
main();
