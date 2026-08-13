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

export interface RebotePara {
  /** Message-ID del proveedor: sin esto no hay a qué envío colgar el evento. */
  messageId?: string;
  /** `Permanent` | `Transient` | `Undetermined`, tal cual lo manda SES. */
  bounceType?: string;
  /** `General`, `NoEmail`, `Suppressed`, `MailboxFull`… */
  bounceSubType?: string;
}

/**
 * Deja el rebote ESCRITO, no sólo suprimido.
 *
 * 🔴 Hasta el 13-ago-2026 un rebote existía únicamente como `Envio.estado =
 * 'REBOTE'`, así que `bounceType` y `bounceSubType` —lo único que distingue una
 * casilla que NO EXISTE de una llena o de un bloqueo temporal— se perdían en el
 * log de Vercel. Con público caliente (rebote 0,36-0,76%) daba igual. Deja de
 * dar igual el día que se le manda a gente que nunca validó una compra: ahí el
 * rebote DURO es el número que decide si se sigue o se frena.
 *
 * Se escribe para los **dos** tipos, permanente y transitorio: el transitorio no
 * quema a nadie, pero un pico de `Transient/General` es cómo se ve un bloqueo de
 * Gmail por reputación, y ése es el sensor que faltaba.
 *
 * ⚠️ Sin `messageId` casado no hay `Envio` al cual colgar el `Evento` (la
 * columna es obligatoria) ⇒ ese rebote sigue viviendo sólo en el log, igual que
 * la queja `sinAtribuir`. Devuelve cuántos escribió para que el webhook lo loguee.
 */
export async function registrarRebote(ev: RebotePara): Promise<number> {
  if (!ev.messageId) return 0;

  const envios = await prisma.envio.findMany({
    where: { sesMessageId: ev.messageId },
    select: { id: true },
  });
  if (!envios.length) return 0;

  // SNS reintenta ante un 5xx —y el handler devuelve 500 a propósito para no
  // perder el evento—, así que el mismo rebote puede llegar dos veces. La llave
  // es el envío + el TIPO de rebote: un transitorio seguido de un permanente son
  // dos hechos distintos y los dos interesan; el mismo repetido, no.
  const yaEstan = await prisma.evento.findMany({
    where: { envioId: { in: envios.map((e) => e.id) }, tipo: 'BOUNCE' },
    select: { envioId: true, meta: true },
  });
  const visto = new Set(
    yaEstan.map((e) => `${e.envioId}·${(e.meta as { bounceType?: string })?.bounceType ?? ''}`),
  );

  const nuevos = envios
    .filter((e) => !visto.has(`${e.id}·${ev.bounceType ?? ''}`))
    .map((e) => ({
      envioId: e.id,
      tipo: 'BOUNCE' as const,
      meta: { bounceType: ev.bounceType ?? null, bounceSubType: ev.bounceSubType ?? null },
    }));
  if (!nuevos.length) return 0;

  const res = await prisma.evento.createMany({ data: nuevos });
  return res.count;
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
