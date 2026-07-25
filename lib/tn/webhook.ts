import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// Tiendanube firma cada webhook con HMAC-SHA256 (header x-linkedstore-hmac-sha256)
// usando el client secret de la app.
export function verifyTnWebhook(rawBody: string, hmacHeader: string | null): boolean {
  const secret = process.env.TN_CLIENT_SECRET;
  // Sin secret no hay forma de verificar: rechazamos. Estos webhooks borran datos
  // de contactos, así que nunca se aceptan a ciegas (antes, sin secret, pasaban).
  if (!secret || !hmacHeader) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

export async function readTnWebhook(req: Request) {
  const raw = await req.text();
  const hmac = req.headers.get('x-linkedstore-hmac-sha256');
  const ok = verifyTnWebhook(raw, hmac);
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    /* noop */
  }
  return { ok, body };
}

/**
 * Cuenta dueña del webhook, resuelta por el `store_id` del payload.
 *
 * ⚠️ Todo lo que un webhook borre o modifique tiene que acotarse a esta cuenta:
 * varias tiendas comparten esta base y, sin el filtro, un pedido de borrado de
 * una tienda alcanzaría a los contactos con el mismo email de las demás.
 */
export async function cuentaDelWebhook(body: unknown) {
  const storeId = (body as { store_id?: number | string })?.store_id?.toString();
  if (!storeId) return null;
  return prisma.cuenta.findUnique({ where: { tnStoreId: storeId } });
}
