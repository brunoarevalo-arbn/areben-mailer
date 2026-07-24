import { EmailError, type Proveedor, type SendArgs, type SendResult } from './proveedor';
import { sesProvider } from './proveedores/ses';
import { resendProvider } from './proveedores/resend';
import { sendgridProvider } from './proveedores/sendgrid';

// Punto único de envío de la app. Todo el resto del código importa de acá y no
// sabe con qué proveedor está saliendo el mail.

const PROVEEDORES: Record<string, Proveedor> = {
  ses: sesProvider,
  resend: resendProvider,
  sendgrid: sendgridProvider,
};

/** Proveedor activo según EMAIL_PROVIDER (default: ses). */
export function getProveedor(): Proveedor {
  const nombre = (process.env.EMAIL_PROVIDER ?? 'ses').toLowerCase();
  const p = PROVEEDORES[nombre];
  if (!p) throw new EmailError(`EMAIL_PROVIDER desconocido: ${nombre}`);
  return p;
}

/** Envía un email por el proveedor activo. Devuelve el Message-ID. */
export function sendEmail(args: SendArgs): Promise<SendResult> {
  return getProveedor().enviar(args);
}

/**
 * ¿El fallo fue por ritmo (rate limit) y no por el destinatario?
 * En ese caso el envío se deja ENCOLADO para el próximo lote en vez de FALLIDO.
 */
export function esThrottle(e: unknown): boolean {
  if (e instanceof EmailError) return e.esThrottle;
  const name = (e as Error)?.name || '';
  return /throttl|TooManyRequests|Limit/i.test(name);
}

export type { SendArgs, SendResult };
export { EmailError };
