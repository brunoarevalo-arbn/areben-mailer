import { prisma } from '@/lib/prisma';

// Cada proveedor avisa los rebotes y quejas con su propio formato (SES por SNS,
// Resend y SendGrid por webhook propio). Los webhooks los traducen a ESTE evento
// y la limpieza de la lista pasa por una sola función.

export interface EventoSupresion {
  tipo: 'REBOTE_PERMANENTE' | 'QUEJA';
  emails: string[];
  /** Message-ID del proveedor, para marcar también el Envio puntual. */
  messageId?: string;
}

/**
 * Quema los contactos que rebotaron duro o se quejaron por spam: es lo que
 * cuida la reputación del dominio. Los rebotes transitorios NO llegan acá.
 */
export async function aplicarSupresion(ev: EventoSupresion): Promise<number> {
  const emails = ev.emails.map((e) => e.toLowerCase()).filter(Boolean);
  if (!emails.length) return 0;

  const estadoContacto = ev.tipo === 'QUEJA' ? 'SPAM' : 'REBOTADO';
  const estadoEnvio = ev.tipo === 'QUEJA' ? 'SPAM' : 'REBOTE';

  const res = await prisma.contacto.updateMany({
    where: { email: { in: emails } },
    data: { estado: estadoContacto },
  });

  if (ev.messageId) {
    await prisma.envio.updateMany({
      where: { sesMessageId: ev.messageId },
      data: { estado: estadoEnvio },
    });
  }

  return res.count;
}
