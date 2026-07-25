import { cuentaDelWebhook, readTnWebhook } from '@/lib/tn/webhook';
import { prisma } from '@/lib/prisma';

// LGPD: Tiendanube pide borrar los datos de un cliente puntual.
// Payload: { store_id, customer: { id, email, ... } }
//
// ⚠️ El borrado se acota SIEMPRE a la cuenta de esa tienda. Antes se borraba por
// email/tnCustomerId sin filtrar, así que un pedido de una tienda se llevaba
// puesto al contacto homónimo de las otras (todas comparten esta base).
export async function POST(req: Request) {
  const { ok, body } = await readTnWebhook(req);
  if (!ok) return new Response('invalid hmac', { status: 401 });

  const cuenta = await cuentaDelWebhook(body);
  if (!cuenta) return new Response('ok', { status: 200 }); // tienda que no conocemos

  const data = body as { customer?: { id?: number; email?: string } };
  const email = data?.customer?.email;
  const tnCustomerId = data?.customer?.id?.toString();
  if (!email && !tnCustomerId) return new Response('ok', { status: 200 });

  const { count } = await prisma.contacto.deleteMany({
    where: {
      cuentaId: cuenta.id,
      OR: [email ? { email } : undefined, tnCustomerId ? { tnCustomerId } : undefined].filter(
        Boolean,
      ) as object[],
    },
  });
  console.log(`[tn] customers-redact: ${count} contacto(s) borrados de "${cuenta.nombre}"`);

  return new Response('ok', { status: 200 });
}
