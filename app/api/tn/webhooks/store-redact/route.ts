import { cuentaDelWebhook, readTnWebhook } from '@/lib/tn/webhook';
import { prisma } from '@/lib/prisma';

// LGPD: pasaron 48h desde que la tienda desinstaló la app → hay que borrar sus datos.
// Payload: { store_id }
//
// Criterio: se borran los **datos personales** (los contactos y todo lo que cuelga
// de ellos por cascada) y se corta el vínculo con Tiendanube. La fila de la cuenta
// queda, vacía y desvinculada, en vez de hacer un `delete` en cascada de todo:
// un webhook mal dirigido —o un store_id equivocado como el que ya nos pasó al
// instalar la app— borraría campañas, listas y plantillas sin vuelta atrás.
export async function POST(req: Request) {
  const { ok, body } = await readTnWebhook(req);
  if (!ok) return new Response('invalid hmac', { status: 401 });

  const cuenta = await cuentaDelWebhook(body);
  if (!cuenta) return new Response('ok', { status: 200 });

  const { count } = await prisma.contacto.deleteMany({ where: { cuentaId: cuenta.id } });
  await prisma.cuenta.update({
    where: { id: cuenta.id },
    data: { tnStoreId: null, tnToken: null },
  });
  console.log(`[tn] store-redact: "${cuenta.nombre}" desvinculada, ${count} contacto(s) borrados`);

  return new Response('ok', { status: 200 });
}
