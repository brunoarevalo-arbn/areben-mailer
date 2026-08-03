import { aplicarSupresion } from "@/lib/email/supresion";
import { verificarFirmaSns } from "@/lib/email/sns-firma";

// Recibe notificaciones SNS de SES (rebotes y quejas) y limpia la lista.
// Config en AWS: Configuration Set → Event destination (SNS) → esta URL.
//
// Cada camino loguea una línea JSON con `ev: "ses-sns"` — filtrable en Vercel.
// Sin esos logs, un evento que llega y no matchea nada es indistinguible de uno
// que nunca llegó, que es exactamente el bug que hace invisible una supresión rota.

function log(datos: Record<string, unknown>) {
  console.log(JSON.stringify({ ev: "ses-sns", ...datos }));
}

/**
 * Las direcciones del simulador de SES no son datos personales y su etiqueta
 * (`bounce+<runId>@…`) identifica la corrida de prueba, así que van enteras.
 * Cualquier otra se ofusca: alcanza para reconocerla sin volcar la casilla al log.
 */
function ofuscar(email: string): string {
  const [usuario, dominio] = email.split("@");
  if (!dominio) return "***";
  if (dominio.toLowerCase() === "simulator.amazonses.com") return email;
  return `${usuario.slice(0, 2)}***@${dominio}`;
}

export async function POST(req: Request) {
  const raw = await req.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    log({ error: "bad-json" });
    return new Response("bad json", { status: 400 });
  }

  // Autenticación real: la firma RSA de Amazon. El TopicArn de abajo viaja en el
  // body y lo escribe cualquiera, así que solo sirve como filtro, no como prueba
  // de origen. Falla cerrado: sin firma válida no se toca la base.
  const firma = await verificarFirmaSns(body);
  if (!firma.valida) {
    log({ rechazado: "firma", motivo: firma.motivo, topicRecibido: body.TopicArn });
    return new Response("invalid signature", { status: 403 });
  }

  // Guard: si está seteado SES_SNS_TOPIC_ARN, solo aceptamos mensajes de ese
  // topic. Ya con la firma verificada esto es defensa en profundidad: descarta
  // mensajes legítimos de AWS que vengan de un topic que no es el nuestro.
  const expectedTopic = process.env.SES_SNS_TOPIC_ARN;
  if (expectedTopic && body.TopicArn !== expectedTopic) {
    log({ ignorado: "topic", topicRecibido: body.TopicArn });
    return new Response("ignored", { status: 200 });
  }

  // 1) Confirmación de suscripción del topic SNS: pegarle a la SubscribeURL.
  if (body.Type === "SubscriptionConfirmation" && typeof body.SubscribeURL === "string") {
    let ok = true;
    try {
      await fetch(body.SubscribeURL);
    } catch {
      ok = false;
    }
    log({ tipo: "SubscriptionConfirmation", ok });
    return new Response("subscription confirmed", { status: 200 });
  }

  // 2) Notificación real (el evento SES viene en Message como string JSON).
  if (body.Type === "Notification" && typeof body.Message === "string") {
    let ev: Record<string, unknown>;
    try {
      ev = JSON.parse(body.Message);
    } catch {
      log({ error: "bad-message" });
      return new Response("bad message", { status: 200 });
    }

    const tipo = ev.notificationType || ev.eventType;
    const messageId = (ev.mail as { messageId?: string })?.messageId;

    let supresion: { tipo: "REBOTE_PERMANENTE" | "QUEJA"; emails: string[] } | null = null;
    let subtipo: string | undefined;

    if (tipo === "Bounce") {
      const bounce = ev.bounce as { bounceType?: string; bounceSubType?: string; bouncedRecipients?: { emailAddress: string }[] };
      subtipo = bounce?.bounceSubType;
      // Solo rebotes permanentes queman el contacto.
      if (bounce?.bounceType === "Permanent") {
        supresion = {
          tipo: "REBOTE_PERMANENTE",
          emails: (bounce.bouncedRecipients ?? []).map((r) => r.emailAddress),
        };
      } else {
        log({ ignorado: "rebote-transitorio", tipo, subtipo: bounce?.bounceType, messageId });
      }
    } else if (tipo === "Complaint") {
      const complaint = ev.complaint as { complaintFeedbackType?: string; complainedRecipients?: { emailAddress: string }[] };
      subtipo = complaint?.complaintFeedbackType;
      supresion = {
        tipo: "QUEJA",
        emails: (complaint?.complainedRecipients ?? []).map((r) => r.emailAddress),
      };
    } else {
      log({ ignorado: "tipo", tipo, messageId });
    }

    if (supresion) {
      const t0 = Date.now();
      try {
        const res = await aplicarSupresion({ ...supresion, messageId });
        log({
          tipo,
          subtipo,
          messageId,
          destinatarios: supresion.emails.map(ofuscar),
          contactos: res.contactos,
          envios: res.envios,
          cuentas: res.cuentaIds,
          // Una queja sin message id casado no se aplica (ver supresion-alcance).
          // Que aparezca acá es la única forma de enterarse.
          sinAtribuir: res.sinAtribuir.map(ofuscar),
          ms: Date.now() - t0,
        });
      } catch (e) {
        // 500 a propósito: SNS reintenta. Devolver 200 ante un blip de la base
        // perdería el rebote para siempre.
        log({ error: "supresion", tipo, messageId, detalle: String(e), ms: Date.now() - t0 });
        return new Response("error", { status: 500 });
      }
    }
  }

  return new Response("ok", { status: 200 });
}
