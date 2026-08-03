import {
  SESv2Client,
  SendEmailCommand,
  GetEmailIdentityCommand,
  CreateEmailIdentityCommand,
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

/** Un CNAME de DKIM, listo para copiar y pegar en el DNS. */
export interface RegistroDkim {
  nombre: string;
  valor: string;
}

export interface AltaDominio {
  estado: 'AUTENTICADO' | 'PENDIENTE' | 'RECHAZADO';
  registros: RegistroDkim[];
  /** Qué salió mal, si SES no contestó. El alta del remitente NO se cae por esto. */
  error?: string;
}

/**
 * Da de alta un dominio en SES (Easy DKIM) y devuelve los CNAME que hay que
 * cargar en el DNS. Idempotente: si la identidad ya existía, la lee.
 *
 * 🔑 Es lo que convierte "Bruno corre un script" en "el comerciante se da de
 * alta solo". Sin esto, `crearRemitente` escribía una fila y nada más: la marca
 * quedaba con un remitente que nunca iba a poder enviar y sin ningún cartel que
 * lo dijera.
 *
 * ⚠️ **Los tokens no se guardan en la base.** SES los devuelve iguales cada vez
 * que se pregunta, así que guardarlos sería una copia que se puede desincronizar
 * (y una columna nueva, que acá es SQL crudo). La pantalla los pide en vivo
 * mientras el dominio no esté verificado.
 */
export async function altaDominioSes(dominio: string): Promise<AltaDominio> {
  const limpio = dominio.trim().toLowerCase();
  const registros = (tokens: string[]) =>
    tokens.map((t) => ({
      nombre: `${t}._domainkey.${limpio}`,
      valor: `${t}.dkim.amazonses.com`,
    }));

  try {
    const res = await ses.send(new CreateEmailIdentityCommand({ EmailIdentity: limpio }));
    return {
      estado: res.VerifiedForSendingStatus ? 'AUTENTICADO' : 'PENDIENTE',
      registros: registros(res.DkimAttributes?.Tokens ?? []),
    };
  } catch (e) {
    if ((e as { name?: string }).name !== 'AlreadyExistsException') {
      // Un dominio ajeno ya dado de alta por otra cuenta de AWS, credenciales
      // vencidas, SES caído. El remitente igual se crea: la pantalla muestra
      // "falta verificar" y el botón Verificar reintenta.
      return { estado: 'PENDIENTE', registros: [], error: (e as Error).message };
    }
  }

  try {
    const res = await ses.send(new GetEmailIdentityCommand({ EmailIdentity: limpio }));
    return {
      estado: res.VerifiedForSendingStatus
        ? 'AUTENTICADO'
        : res.DkimAttributes?.Status === 'FAILED'
          ? 'RECHAZADO'
          : 'PENDIENTE',
      registros: registros(res.DkimAttributes?.Tokens ?? []),
    };
  } catch (e) {
    return { estado: 'PENDIENTE', registros: [], error: (e as Error).message };
  }
}
