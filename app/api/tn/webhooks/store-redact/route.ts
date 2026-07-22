import { readTnWebhook } from '@/lib/tn/webhook';
import { prisma } from '@/lib/prisma';

// LGPD: la tienda desinstaló la app; borrar todos sus datos.
// Payload: { store_id }
export async function POST(req: Request) {
  const { ok, body } = await readTnWebhook(req);
  if (!ok) return new Response('invalid hmac', { status: 401 });

  const storeId = (body as { store_id?: number })?.store_id?.toString();
  if (storeId) {
    // Borra la cuenta ligada a esa tienda y, en cascada, todos sus datos.
    await prisma.cuenta.deleteMany({ where: { tnStoreId: storeId } });
  }

  return new Response('ok', { status: 200 });
}
