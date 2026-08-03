import { prisma } from '@/lib/prisma';
import { decidirAlcance, normalizarEmails, type TipoSupresion } from './supresion-alcance';

// Cada proveedor avisa los rebotes y quejas con su propio formato (SES por SNS,
// Resend y SendGrid por webhook propio). Los webhooks los traducen a ESTE evento
// y la limpieza de la lista pasa por una sola función.

export interface EventoSupresion {
  tipo: TipoSupresion;
  emails: string[];
  /** Message-ID del proveedor: es lo que dice QUÉ tienda mandó ese mail. */
  messageId?: string;
}

export interface ResultadoSupresion {
  /** Contactos marcados REBOTADO/SPAM. */
  contactos: number;
  /** Envíos marcados REBOTE/SPAM (casados por messageId). */
  envios: number;
  /** Ids de esos envíos, para que el llamador pueda loguear o auditar. */
  envioIds: string[];
  /** Cuentas alcanzadas, para el log del webhook. */
  cuentaIds: string[];
  /** Quejas que no se pudieron atribuir a una tienda: NO se aplicaron. */
  sinAtribuir: string[];
}

/**
 * Quema los contactos que rebotaron duro o se quejaron por spam: es lo que
 * cuida la reputación del dominio. Los rebotes transitorios NO llegan acá.
 *
 * 🔴 **El alcance NO es "el email en toda la base".** Quién queda alcanzado lo
 * decide `decidirAlcance()`, que es puro y está explicado allá: el rebote duro
 * se propaga a todas las cuentas y la queja se queda en la tienda que mandó el
 * mail. Hasta el 2-ago-2026 acá había un `updateMany` por email **sin
 * `cuentaId`** y una queja en una tienda apagaba al mismo contacto en la otra.
 */
export async function aplicarSupresion(ev: EventoSupresion): Promise<ResultadoSupresion> {
  const vacio: ResultadoSupresion = {
    contactos: 0,
    envios: 0,
    envioIds: [],
    cuentaIds: [],
    sinAtribuir: [],
  };
  const emails = normalizarEmails(ev.emails);
  if (!emails.length) return vacio;

  // El envío se busca ANTES de marcar nada: es la única fuente de "de qué tienda
  // era este mail". `sesMessageId` está indexado.
  const casados = ev.messageId
    ? await prisma.envio.findMany({
        where: { sesMessageId: ev.messageId },
        select: { id: true, cuentaId: true, contactoId: true, contacto: { select: { email: true } } },
      })
    : [];

  const alcance = decidirAlcance(
    ev.tipo,
    emails,
    casados.map((c) => ({
      id: c.id,
      cuentaId: c.cuentaId,
      contactoId: c.contactoId,
      email: c.contacto.email,
    })),
  );

  const estadoContacto = ev.tipo === 'QUEJA' ? 'SPAM' : 'REBOTADO';
  const estadoEnvio = ev.tipo === 'QUEJA' ? 'SPAM' : 'REBOTE';

  let contactos = 0;
  if (alcance.emailsGlobales.length) {
    const res = await prisma.contacto.updateMany({
      where: { email: { in: alcance.emailsGlobales } },
      data: { estado: estadoContacto },
    });
    contactos += res.count;
  }
  if (alcance.contactoIds.length) {
    const res = await prisma.contacto.updateMany({
      where: { id: { in: alcance.contactoIds } },
      data: { estado: estadoContacto },
    });
    contactos += res.count;
  }

  if (alcance.envioIds.length) {
    await prisma.envio.updateMany({
      where: { id: { in: alcance.envioIds } },
      data: { estado: estadoEnvio },
    });
  }

  return {
    contactos,
    envios: alcance.envioIds.length,
    envioIds: alcance.envioIds,
    cuentaIds: alcance.cuentaIds,
    sinAtribuir: alcance.sinAtribuir,
  };
}
