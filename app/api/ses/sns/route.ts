import { aplicarSupresion } from "@/lib/email/supresion";

// Recibe notificaciones SNS de SES (rebotes y quejas) y limpia la lista.
// Config en AWS: Configuration Set → Event destination (SNS) → esta URL.
export async function POST(req: Request) {
  const raw = await req.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Guard: si está seteado SES_SNS_TOPIC_ARN, solo aceptamos mensajes de ese
  // topic (evita que alguien postee rebotes/quejas falsos y queme contactos).
  // Sin la env var, es permisivo (útil durante el setup inicial).
  const expectedTopic = process.env.SES_SNS_TOPIC_ARN;
  if (expectedTopic && body.TopicArn !== expectedTopic) {
    return new Response("ignored", { status: 200 });
  }

  // 1) Confirmación de suscripción del topic SNS: pegarle a la SubscribeURL.
  if (body.Type === "SubscriptionConfirmation" && typeof body.SubscribeURL === "string") {
    try {
      await fetch(body.SubscribeURL);
    } catch {
      /* noop */
    }
    return new Response("subscription confirmed", { status: 200 });
  }

  // 2) Notificación real (el evento SES viene en Message como string JSON).
  if (body.Type === "Notification" && typeof body.Message === "string") {
    let ev: Record<string, unknown>;
    try {
      ev = JSON.parse(body.Message);
    } catch {
      return new Response("bad message", { status: 200 });
    }

    const tipo = ev.notificationType || ev.eventType;
    const messageId = (ev.mail as { messageId?: string })?.messageId;

    if (tipo === "Bounce") {
      const bounce = ev.bounce as { bounceType?: string; bouncedRecipients?: { emailAddress: string }[] };
      // Solo rebotes permanentes queman el contacto.
      if (bounce?.bounceType === "Permanent") {
        await aplicarSupresion({
          tipo: "REBOTE_PERMANENTE",
          emails: (bounce.bouncedRecipients ?? []).map((r) => r.emailAddress),
          messageId,
        });
      }
    } else if (tipo === "Complaint") {
      const complaint = ev.complaint as { complainedRecipients?: { emailAddress: string }[] };
      await aplicarSupresion({
        tipo: "QUEJA",
        emails: (complaint?.complainedRecipients ?? []).map((r) => r.emailAddress),
        messageId,
      });
    }
  }

  return new Response("ok", { status: 200 });
}
