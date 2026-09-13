import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// Tiendanube firma cada webhook con HMAC-SHA256 (header x-linkedstore-hmac-sha256)
// usando el client secret de la app.
//
// 🔴 **La firma viene en HEXADECIMAL, no en base64.** La doc de TN la verifica con
// `hash_hmac('sha256', $data, APP_SECRET)` de PHP, que devuelve hex. Hasta el
// 12-sep-2026 esto comparaba contra base64 y **rechazó con 401 TODOS los webhooks
// reales desde el día uno**, sin un error visible: la automation de reseña de BDI
// estuvo ACTIVA 16 días con el `order/paid` registrado y **0 runs**, y en toda la
// base no había un solo run nacido de un webhook de TN (el carrito es un poller y
// la bienvenida la encola Resorty). Lo que lo tapó: probar la ruta firmando con
// el MISMO código que verifica — firma y verificación se equivocaban juntas.
// ⇒ el oráculo de `probar-tn-webhook.ts` es la fórmula de la doc, no esta función.
// ⚠️ Base64 se sigue aceptando: es la misma clave y el mismo digest en otra
// codificación, así que no abre nada, y no rompe a quien haya firmado así.
export function verifyTnWebhook(rawBody: string, hmacHeader: string | null): boolean {
  const secret = process.env.TN_CLIENT_SECRET;
  // Sin secret no hay forma de verificar: rechazamos. Estos webhooks borran datos
  // de contactos, así que nunca se aceptan a ciegas (antes, sin secret, pasaban).
  if (!secret || !hmacHeader) return false;
  const mac = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  const recibido = hmacHeader.trim();
  return (
    igual(mac.toString('hex'), recibido.toLowerCase()) || igual(mac.toString('base64'), recibido)
  );
}

function igual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
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
