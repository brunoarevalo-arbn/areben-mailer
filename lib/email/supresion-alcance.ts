// A QUIÉN alcanza un rebote o una queja. Parte pura, sin base ni red, para que
// `probar-supresion.ts` la pueda fijar: la decisión de acá borra contactos de
// tiendas ajenas si se equivoca, y no tiene vuelta atrás.

export type TipoSupresion = 'REBOTE_PERMANENTE' | 'QUEJA';

/** Un envío que casó por message id: dice QUÉ tienda mandó ese mail y a quién. */
export interface EnvioCasado {
  id: string;
  cuentaId: string;
  contactoId: string;
  /** Email del contacto de ese envío, para no marcar a alguien que no rebotó. */
  email: string;
}

export interface Alcance {
  /** Contactos a marcar por id: la persona exacta de ese envío, en esa tienda. */
  contactoIds: string[];
  /** Envíos a marcar (los que casaron por message id). */
  envioIds: string[];
  /** Emails a suprimir en TODA la base, sin importar la cuenta. Solo rebote duro. */
  emailsGlobales: string[];
  /** Emails que no se pudieron atribuir a ninguna tienda y quedan intactos. */
  sinAtribuir: string[];
  /** Cuentas alcanzadas por la parte atribuida, para el log. */
  cuentaIds: string[];
}

/** Normaliza como comparan los proveedores: minúsculas, sin vacíos, sin repetidos. */
export function normalizarEmails(emails: string[]): string[] {
  const vistos = new Set<string>();
  for (const e of emails) {
    const limpio = (e ?? '').trim().toLowerCase();
    if (limpio) vistos.add(limpio);
  }
  return [...vistos];
}

/**
 * 🔴 **Un rebote duro es del BUZÓN; una queja es de la RELACIÓN.** De ahí sale
 * toda la asimetría de esta función, decidida el 2-ago-2026:
 *
 * - **Rebote permanente ⇒ se propaga a todas las cuentas.** Una casilla que no
 *   existe no existe para nadie, y la cuenta de SES es **una sola para todas las
 *   marcas**: si BDI le sigue pegando a un buzón muerto, la reputación que se
 *   quema es también la de Zattia. Propagarlo es lo que protege al resto.
 * - **Queja ⇒ solo la tienda que mandó ese mail.** Que alguien marque spam un
 *   mail de Zattia no dice nada de su relación con BDI, y marcarlo `SPAM` en la
 *   tienda de al lado es romperle un contacto a un tercero por algo que no hizo.
 *   Es el agujero que tenía `aplicarSupresion` hasta hoy: `updateMany` por email
 *   **sin `cuentaId`**.
 *
 * ⚠️ **Una queja que no se puede atribuir NO se aplica.** Sin message id casado
 * no hay forma de saber qué tienda mandó el mail, y elegir "todas" es
 * exactamente el bug. Se pierde una supresión; el mail siguiente a esa persona
 * genera su propio evento, con su propio message id, y ahí sí se aplica.
 */
export function decidirAlcance(
  tipo: TipoSupresion,
  emailsCrudos: string[],
  casados: EnvioCasado[],
): Alcance {
  const emails = normalizarEmails(emailsCrudos);
  const delEvento = new Set(emails);

  // Un envío solo cuenta si su contacto es uno de los que el proveedor nombró:
  // el message id casa el mail, pero quien rebotó es la casilla del evento.
  const propios = casados.filter((c) => delEvento.has((c.email ?? '').trim().toLowerCase()));

  const envioIds = [...new Set(propios.map((c) => c.id))];
  const cuentaIds = [...new Set(propios.map((c) => c.cuentaId))];

  if (tipo === 'REBOTE_PERMANENTE') {
    return {
      contactoIds: [],
      envioIds,
      emailsGlobales: emails,
      sinAtribuir: [],
      cuentaIds,
    };
  }

  const atribuidos = new Set(propios.map((c) => c.email.trim().toLowerCase()));
  return {
    contactoIds: [...new Set(propios.map((c) => c.contactoId))],
    envioIds,
    emailsGlobales: [],
    sinAtribuir: emails.filter((e) => !atribuidos.has(e)),
    cuentaIds,
  };
}
