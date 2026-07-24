import { aplicarSupresion } from "@/lib/email/supresion";

// Webhook de eventos de SendGrid (rebotes y quejas) → misma limpieza de lista
// que hace el SNS de SES. Configurar en Settings → Mail Settings → Event Webhook
// apuntando a esta URL CON el token en la query:
//   https://areben-mailer.vercel.app/api/webhooks/sendgrid?token=<SENDGRID_WEBHOOK_TOKEN>
// (SendGrid también ofrece firma ECDSA; el token compartido alcanza y es simple.)

interface EventoSendGrid {
  email?: string;
  event?: string;
  type?: string;
  sg_message_id?: string;
}

export async function POST(req: Request) {
  const token = process.env.SENDGRID_WEBHOOK_TOKEN;
  if (token) {
    const url = new URL(req.url);
    if (url.searchParams.get("token") !== token) {
      return new Response("no autorizado", { status: 401 });
    }
  }

  let eventos: EventoSendGrid[];
  try {
    eventos = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  if (!Array.isArray(eventos)) return new Response("ok", { status: 200 });

  for (const ev of eventos) {
    if (!ev.email) continue;

    // sg_message_id llega como "<id>.filterXXXX"; el X-Message-Id que guardamos
    // al enviar es solo el prefijo, así que cortamos para poder casarlo.
    const messageId = ev.sg_message_id?.split(".")[0];

    if (ev.event === "bounce" && ev.type !== "blocked") {
      // type "blocked" es rebote transitorio: no quema el contacto.
      await aplicarSupresion({
        tipo: "REBOTE_PERMANENTE",
        emails: [ev.email],
        messageId,
      });
    } else if (ev.event === "spamreport") {
      await aplicarSupresion({ tipo: "QUEJA", emails: [ev.email], messageId });
    }
  }

  return new Response("ok", { status: 200 });
}
