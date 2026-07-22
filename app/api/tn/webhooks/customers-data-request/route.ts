import { readTnWebhook } from '@/lib/tn/webhook';

// LGPD: un cliente pidió ver los datos que la tienda tiene sobre él.
// Debemos registrar el pedido; la entrega se resuelve manualmente por ahora.
// Payload: { store_id, customer: { id, email }, ... }
export async function POST(req: Request) {
  const { ok, body } = await readTnWebhook(req);
  if (!ok) return new Response('invalid hmac', { status: 401 });

  // TODO: cuando haya volumen, notificar por mail y armar el export automático.
  console.log('[tn] customers-data-request', JSON.stringify(body));

  return new Response('ok', { status: 200 });
}
