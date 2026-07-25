import { cuentaDelWebhook, readTnWebhook } from '@/lib/tn/webhook';
import { prisma } from '@/lib/prisma';

// La tienda desinstaló la app. Payload: { store_id, event: "app/uninstalled" }
//
// Acá NO se borra nada: el token deja de servir, así que solo lo limpiamos para
// que la app no siga intentando pegarle a la API con una credencial revocada.
// Los datos se borran recién con `store/redact`, que Tiendanube manda a las 48h
// (y que el comerciante puede evitar reinstalando).
export async function POST(req: Request) {
  const { ok, body } = await readTnWebhook(req);
  if (!ok) return new Response('invalid hmac', { status: 401 });

  const cuenta = await cuentaDelWebhook(body);
  if (!cuenta) return new Response('ok', { status: 200 });

  await prisma.cuenta.update({ where: { id: cuenta.id }, data: { tnToken: null } });
  console.log(`[tn] app-uninstalled: "${cuenta.nombre}" quedó sin token`);

  return new Response('ok', { status: 200 });
}
