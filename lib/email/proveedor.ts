// Contrato común de los proveedores de envío (SES, Resend, SendGrid).
// La app entera habla ESTE lenguaje; los detalles de cada API viven en
// lib/email/proveedores/*. Cambiar de proveedor = cambiar la env EMAIL_PROVIDER.

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
  /** Message-ID del proveedor. Es la llave para casar los webhooks de rebote. */
  messageId: string;
}

export interface Proveedor {
  nombre: string;
  enviar(args: SendArgs): Promise<SendResult>;
}

/**
 * Error de envío normalizado. Lo que a los llamadores les importa no es qué API
 * falló sino si conviene reintentar: `esThrottle` significa "frenó el ritmo,
 * dejá el envío encolado para el próximo lote" (no es un fallo del destinatario).
 */
export class EmailError extends Error {
  readonly esThrottle: boolean;

  constructor(message: string, opts: { esThrottle?: boolean; cause?: unknown } = {}) {
    super(message, { cause: opts.cause });
    this.name = 'EmailError';
    this.esThrottle = opts.esThrottle ?? false;
  }
}

/** Arma el `Nombre <email>` a partir del remitente de la marca o el default. */
export function armarFrom(args: SendArgs): { email: string; nombre: string } {
  const email = args.fromEmail ?? process.env.SES_FROM_EMAIL!;
  const nombre = args.fromName ?? process.env.SES_FROM_NAME ?? '';
  return { email, nombre };
}

/** Headers de baja one-click (RFC 8058). Los soportan los tres proveedores. */
export function headersUnsubscribe(args: SendArgs): Record<string, string> {
  if (!args.unsubscribeUrl) return {};
  return {
    'List-Unsubscribe': `<${args.unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
