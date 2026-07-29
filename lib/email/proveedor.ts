// Contrato común de los proveedores de envío (SES, Resend, SendGrid).
// La app entera habla ESTE lenguaje; los detalles de cada API viven en
// lib/email/proveedores/*. Cambiar de proveedor = cambiar la env EMAIL_PROVIDER.

// ─── Gate del envío masivo ────────────────────────────────────────────────
//
// Hay TRES estados, no dos. El del medio es el que permite probar el motor sin
// arriesgar la lista real:
//
//   bloqueado — no sale nada. Es el default y el estado de hoy.
//   ensayo    — corre el camino real completo (cola, lease, tracking, estados)
//               pero SOLO contra los destinatarios de `ENVIO_ENSAYO`.
//   real      — sale todo, a quien corresponda.
//
// El estado "ensayo" existe porque abrir el gate del todo para probar sería
// jugar con fuego: con 16.825 contactos de BDI en la misma base, una campaña
// apuntada al destino equivocado los manda a todos, y en sandbox esas
// direcciones rebotarían en masa — justo lo que hundiría el caso ante AWS.

export type ModoEnvio = 'bloqueado' | 'ensayo' | 'real';

/** Mailbox simulator de SES: destinatarios que no existen como personas. */
export const DOMINIO_SIMULADOR = 'simulator.amazonses.com';

/**
 * ¿Está habilitado el envío masivo a la lista real, sin restricciones?
 *
 * El default es **bloqueado**: si la env falta, está vacía o mal escrita, no
 * sale nada. Preferimos quedarnos mudos a mandarle de más a 16.000 personas.
 *
 * El nombre es neutro a propósito. Antes esto se llamaba `SES_SANDBOX`, y ese
 * nombre mentía por partida doble: frenaba el envío con CUALQUIER proveedor —así
 * que migrar a Resend habría dejado la app muda sin ninguna pista de por qué— y
 * además nombraba un estado de AWS que dejó de existir el 29-jul, cuando la
 * cuenta salió del sandbox. Una env que decide quién recibe 16.825 mails no
 * puede llamarse por algo que ya no es cierto.
 */
export function envioRealHabilitado(): boolean {
  return process.env.ENVIO_REAL === 'true';
}

/**
 * Destinatarios habilitados en modo ensayo, de `ENVIO_ENSAYO` (separados por
 * coma). Dos formas, y la segunda es la que hace esto usable:
 *
 *   - dirección exacta — `qa@bdiaccesorios.com.ar`
 *   - dominio entero   — `@zattia.com.ar` (todo lo que termine así)
 *
 * El dominio entero sirve porque en el sandbox de SES un dominio verificado
 * habilita todas sus casillas: hoy `@bdiaccesorios.com.ar` y `@zattia.com.ar`
 * ya reciben, sin verificar nada nuevo.
 */
export function listaEnsayo(): string[] {
  return (process.env.ENVIO_ENSAYO ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Estado actual del gate. `real` gana sobre `ensayo` si las dos envs están puestas. */
export function modoEnvio(): ModoEnvio {
  if (envioRealHabilitado()) return 'real';
  return listaEnsayo().length > 0 ? 'ensayo' : 'bloqueado';
}

/**
 * ¿Se le puede mandar a esta dirección con el gate como está hoy?
 *
 * Esta es **la** función que protege: se consulta justo antes de cada envío, no
 * solo al encolar. Filtrar al encolar evita crear miles de filas al pedo, pero
 * los `Envio` también nacen por otros caminos (una campaña encolada antes de
 * cambiar la lista, los scripts de QA), y a esos el filtro de arriba no los ve.
 */
export function destinatarioPermitido(email: string): boolean {
  const dest = email.trim().toLowerCase();

  // El mailbox simulator de SES está permitido SIEMPRE, en cualquier modo. Es un
  // agujero negro por construcción: no llega a ninguna persona, no consume la
  // cuota diaria y no toca la reputación. Los scripts de QA dependen de esto
  // para poder correr con el gate cerrado, que es como está prod hoy.
  if (dest.endsWith(`@${DOMINIO_SIMULADOR}`)) return true;

  const modo = modoEnvio();
  if (modo === 'real') return true;
  if (modo === 'bloqueado') return false;

  return listaEnsayo().some((permitido) =>
    permitido.startsWith('@') ? dest.endsWith(permitido) : dest === permitido,
  );
}

/** Motivo único para rechazar un envío masivo cuando el gate está cerrado. */
export const MSG_ENVIO_BLOQUEADO =
  'El envío a la lista está desactivado: se habilita con ENVIO_REAL="true" (o con ENVIO_ENSAYO para probar el motor contra casillas propias).';

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
