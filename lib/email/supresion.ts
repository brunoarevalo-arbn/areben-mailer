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

export interface ResultadoSupresion {
  /** Contactos marcados REBOTADO/SPAM. */
  contactos: number;
  /** Envíos marcados REBOTE/SPAM (casados por messageId). */
  envios: number;
  /** Ids de esos envíos, para que el llamador pueda loguear o auditar. */
  envioIds: string[];
}

/**
 * Quema los contactos que rebotaron duro o se quejaron por spam: es lo que
 * cuida la reputación del dominio. Los rebotes transitorios NO llegan acá.
 */
export async function aplicarSupresion(ev: EventoSupresion): Promise<ResultadoSupresion> {
  const vacio: ResultadoSupresion = { contactos: 0, envios: 0, envioIds: [] };
  const emails = ev.emails.map((e) => e.toLowerCase()).filter(Boolean);
  if (!emails.length) return vacio;

  const estadoContacto = ev.tipo === 'QUEJA' ? 'SPAM' : 'REBOTADO';
  const estadoEnvio = ev.tipo === 'QUEJA' ? 'SPAM' : 'REBOTE';

  const res = await prisma.contacto.updateMany({
    where: { email: { in: emails } },
    data: { estado: estadoContacto },
  });

  // Los ids se resuelven ANTES del update: después de marcarlos ya no se
  // distinguen de los que estaban en ese estado de antes.
  let envioIds: string[] = [];
  if (ev.messageId) {
    const envios = await prisma.envio.findMany({
      where: { sesMessageId: ev.messageId },
      select: { id: true },
    });
    envioIds = envios.map((e) => e.id);
    if (envioIds.length) {
      await prisma.envio.updateMany({
        where: { id: { in: envioIds } },
        data: { estado: estadoEnvio },
      });
    }
  }

  return { contactos: res.count, envios: envioIds.length, envioIds };
}
