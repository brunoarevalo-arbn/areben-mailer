import { readTnWebhook } from '@/lib/tn/webhook';
import { prisma } from '@/lib/prisma';

// LGPD: Tiendanube pide borrar los datos de un cliente puntual.
// Payload: { store_id, customer: { id, email, ... } }
export async function POST(req: Request) {
  const { ok, body } = await readTnWebhook(req);
  if (!ok) return new Response('invalid hmac', { status: 401 });

  const data = body as { store_id?: number; customer?: { id?: number; email?: string } };
  const email = data?.customer?.email;
  const tnCustomerId = data?.customer?.id?.toString();

  if (email || tnCustomerId) {
    await prisma.contacto.deleteMany({
      where: {
        OR: [
          email ? { email } : undefined,
          tnCustomerId ? { tnCustomerId } : undefined,
        ].filter(Boolean) as object[],
      },
    });
  }

  return new Response('ok', { status: 200 });
}
