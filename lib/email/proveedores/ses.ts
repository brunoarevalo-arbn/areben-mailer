import {
  SESv2Client,
  SendEmailCommand,
  GetEmailIdentityCommand,
} from '@aws-sdk/client-sesv2';
import {
  armarFrom,
  headersUnsubscribe,
  EmailError,
  type Proveedor,
  type SendArgs,
  type SendResult,
} from '../proveedor';

const ses = new SESv2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function enviar(args: SendArgs): Promise<SendResult> {
  const { email, nombre } = armarFrom(args);
  const from = nombre ? `${nombre} <${email}>` : email;

  const hs = headersUnsubscribe(args);
  const headers = Object.keys(hs).length
    ? Object.entries(hs).map(([Name, Value]) => ({ Name, Value }))
    : undefined;

  const cmd = new SendEmailCommand({
    FromEmailAddress: from,
    Destination: { ToAddresses: [args.to] },
    ReplyToAddresses: args.replyTo ? [args.replyTo] : undefined,
    ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined,
    Content: {
      Simple: {
        Subject: { Data: args.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: args.html, Charset: 'UTF-8' },
          ...(args.text ? { Text: { Data: args.text, Charset: 'UTF-8' } } : {}),
        },
        ...(headers ? { Headers: headers } : {}),
      },
    },
  });

  try {
    const res = await ses.send(cmd);
    return { messageId: res.MessageId ?? '' };
  } catch (e) {
    const name = (e as Error).name || '';
    throw new EmailError((e as Error).message || 'fallo SES', {
      esThrottle: /throttl|TooManyRequests|Limit/i.test(name),
      cause: e,
    });
  }
}

export const sesProvider: Proveedor = { nombre: 'ses', enviar };

/**
 * Consulta en SES si una identidad (dominio o email) está verificada para enviar.
 * Es específico de SES: la sección /remitentes lo usa para el estado de DKIM.
 */
export async function getIdentityStatus(
  identity: string
): Promise<'AUTENTICADO' | 'PENDIENTE' | 'RECHAZADO'> {
  try {
    const res = await ses.send(
      new GetEmailIdentityCommand({ EmailIdentity: identity })
    );
    if (res.VerifiedForSendingStatus) return 'AUTENTICADO';
    if (res.DkimAttributes?.Status === 'FAILED') return 'RECHAZADO';
    return 'PENDIENTE';
  } catch {
    // La identidad todavía no existe en SES.
    return 'PENDIENTE';
  }
}
