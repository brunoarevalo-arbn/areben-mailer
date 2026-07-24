import {
  armarFrom,
  headersUnsubscribe,
  EmailError,
  type Proveedor,
  type SendArgs,
  type SendResult,
} from '../proveedor';

// Resend por API REST (sin SDK: es un POST, no vale sumar dependencia).
// Docs: https://resend.com/docs/api-reference/emails/send-email
// Nota: Resend corre arriba de la infraestructura de SES, con la cuenta de
// ellos → no arrastra nuestro problema de sandbox. Requiere verificar el
// dominio en su panel (CNAMEs en Cloudflare, igual que SES).

async function enviar(args: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new EmailError('falta RESEND_API_KEY');

  const { email, nombre } = armarFrom(args);
  const headers = headersUnsubscribe(args);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: nombre ? `${nombre} <${email}>` : email,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      ...(args.text ? { text: args.text } : {}),
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      ...(Object.keys(headers).length ? { headers } : {}),
    }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new EmailError(`Resend ${res.status}: ${detalle.slice(0, 200)}`, {
      esThrottle: res.status === 429,
    });
  }

  const json = (await res.json()) as { id?: string };
  return { messageId: json.id ?? '' };
}

export const resendProvider: Proveedor = { nombre: 'resend', enviar };
