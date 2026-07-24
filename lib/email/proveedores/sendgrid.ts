import {
  armarFrom,
  headersUnsubscribe,
  EmailError,
  type Proveedor,
  type SendArgs,
  type SendResult,
} from '../proveedor';

// SendGrid (Twilio) por API v3 Mail Send.
// Docs: https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send
// OJO: usamos el producto "Email API" (cobra por email enviado), NO "Marketing
// Campaigns" (cobra por contacto, que es justo el modelo que evitamos).

async function enviar(args: SendArgs): Promise<SendResult> {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new EmailError('falta SENDGRID_API_KEY');

  const { email, nombre } = armarFrom(args);
  const headers = headersUnsubscribe(args);

  // SendGrid exige el content ordenado por MIME: text/plain antes que text/html.
  const content: { type: string; value: string }[] = [];
  if (args.text) content.push({ type: 'text/plain', value: args.text });
  content.push({ type: 'text/html', value: args.html });

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: args.to }] }],
      from: nombre ? { email, name: nombre } : { email },
      ...(args.replyTo ? { reply_to: { email: args.replyTo } } : {}),
      subject: args.subject,
      content,
      ...(Object.keys(headers).length ? { headers } : {}),
    }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new EmailError(`SendGrid ${res.status}: ${detalle.slice(0, 200)}`, {
      esThrottle: res.status === 429,
    });
  }

  // Responde 202 sin body; el id viene en el header.
  return { messageId: res.headers.get('x-message-id') ?? '' };
}

export const sendgridProvider: Proveedor = { nombre: 'sendgrid', enviar };
