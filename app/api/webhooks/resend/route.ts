import { createHmac, timingSafeEqual } from "node:crypto";
import { aplicarSupresion } from "@/lib/email/supresion";

// Webhook de eventos de Resend (rebotes y quejas) → misma limpieza de lista que
// hace el SNS de SES. Configurar en el panel de Resend apuntando a esta URL y
// guardar el signing secret en RESEND_WEBHOOK_SECRET.

/** Verifica la firma Svix que usa Resend (HMAC SHA-256 sobre id.timestamp.body). */
function firmaValida(raw: string, headers: Headers, secret: string): boolean {
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;

  // Ventana de 5 minutos: corta los replays de un payload viejo capturado.
  const edad = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(edad) || edad > 300) return false;

  const clave = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const esperada = createHmac("sha256", clave)
    .update(`${id}.${ts}.${raw}`)
    .digest("base64");

  // El header trae una o más firmas: "v1,<sig> v1,<sig2>".
  return sigHeader.split(" ").some((parte) => {
    const sig = parte.split(",")[1];
    if (!sig) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(esperada);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export async function POST(req: Request) {
  const raw = await req.text();

  // 🔴 FALLA CERRADO, igual que el SNS de SES. Esta ruta es pública
  // (`PUBLIC_PREFIXES` en proxy.ts) y lo único que hace es SUPRIMIR contactos.
  //
  // Hasta el 30-jul-2026 el chequeo era `if (secret && !firmaValida(…))`: sin la
  // env cargada —que era el estado real, porque el webhook nunca se dio de alta—
  // un POST anónimo con `{"type":"email.bounced","data":{"to":[…]}}` suprimía a
  // quien quisiera. Y la supresión es **de una sola vía** por diseño: no vuelve
  // ni re-importando el CSV (ver lib/contactos/importar.ts).
  //
  // 503 y no 401 a propósito: Svix reintenta ante 5xx, así que los eventos que
  // lleguen antes de que la env esté puesta no se pierden.
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("webhook sin secret configurado", { status: 503 });
  if (!firmaValida(raw, req.headers, secret)) {
    return new Response("firma inválida", { status: 401 });
  }

  let body: { type?: string; data?: Record<string, unknown> };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const data = body.data ?? {};
  const emails = Array.isArray(data.to) ? (data.to as string[]) : [];
  const messageId = typeof data.email_id === "string" ? data.email_id : undefined;

  if (body.type === "email.bounced") {
    // Igual que en SES: solo el rebote permanente quema el contacto.
    const bounce = data.bounce as { type?: string } | undefined;
    if (!bounce?.type || bounce.type === "Permanent") {
      await aplicarSupresion({ tipo: "REBOTE_PERMANENTE", emails, messageId });
    }
  } else if (body.type === "email.complained") {
    await aplicarSupresion({ tipo: "QUEJA", emails, messageId });
  }

  return new Response("ok", { status: 200 });
}
