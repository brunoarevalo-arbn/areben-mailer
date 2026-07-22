import crypto from 'crypto';

// Tiendanube firma cada webhook con HMAC-SHA256 (header x-linkedstore-hmac-sha256)
// usando el client secret de la app. Verificamos si el secret está configurado.
export function verifyTnWebhook(rawBody: string, hmacHeader: string | null): boolean {
  const secret = process.env.TN_CLIENT_SECRET;
  if (!secret) return true; // sin secret configurado todavía: no bloqueamos (dev)
  if (!hmacHeader) return false;
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
