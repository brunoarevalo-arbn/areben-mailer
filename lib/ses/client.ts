import {
  SESv2Client,
  SendEmailCommand,
  GetEmailIdentityCommand,
} from '@aws-sdk/client-sesv2';

const ses = new SESv2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** URL de baja para el header List-Unsubscribe (one-click). */
  unsubscribeUrl?: string;
  /** Dirección Reply-To opcional. */
  replyTo?: string;
  /** Remitente de la marca (fallback a SES_FROM_EMAIL si no se pasa). */
  fromEmail?: string;
  fromName?: string;
}

export interface SendResult {
  messageId: string;
}

/** Envía un email por SES. Devuelve el Message-ID. */
export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const email = args.fromEmail ?? process.env.SES_FROM_EMAIL!;
  const name = args.fromName ?? process.env.SES_FROM_NAME ?? '';
  const from = name ? `${name} <${email}>` : email;

  const headers = args.unsubscribeUrl
    ? [
        { Name: 'List-Unsubscribe', Value: `<${args.unsubscribeUrl}>` },
        { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
      ]
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

  const res = await ses.send(cmd);
  return { messageId: res.MessageId ?? '' };
}

/** Consulta en SES si una identidad (dominio o email) está verificada para enviar. */
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
