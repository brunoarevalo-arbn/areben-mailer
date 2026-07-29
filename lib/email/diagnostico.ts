import 'server-only';
import { getProveedor } from './enviar';
import { listaEnsayo, modoEnvio, type ModoEnvio } from './proveedor';
import { getRemitenteEnvio } from '@/lib/remitentes';

// Estado del envío, leído en vivo del servidor que efectivamente manda.
//
// Existe porque la pregunta "¿a quién le va a llegar esto?" solo se podía
// responder entrando al panel de Vercel: `vercel env pull` devuelve los valores
// vacíos, así que ni siquiera desde la CLI se ve. Con 16.825 contactos de BDI en
// la base, esa pregunta no puede depender de acordarse.
//
// ⚠️ Acá NUNCA se devuelve el valor de una env. Solo booleanos y nombres. La
// única excepción es la lista de ensayo, que es el dato del que se trata todo:
// son las casillas que van a recibir, y verlas ES la verificación.

/** Por qué el camino de rebotes está abierto o cerrado, según el proveedor. */
export interface EstadoRebotes {
  cerrado: boolean;
  /** Qué env falta, en palabras. Vacío si está todo. */
  falta: string[];
  /** Dónde se configura del otro lado. */
  donde: string;
}

export interface DiagnosticoEnvio {
  /** Nombre del proveedor activo, o null si `EMAIL_PROVIDER` no resuelve. */
  proveedor: string | null;
  /** El valor crudo de EMAIL_PROVIDER solo cuando NO resuelve: es un typo a mostrar. */
  proveedorInvalido: string | null;
  modo: ModoEnvio;
  listaEnsayo: string[];
  rebotes: EstadoRebotes;
  remitente: { nombre: string; email: string; responderA: string | null } | null;
  /** El fallback por env cuando la marca no tiene remitente propio. */
  remitenteFallback: string | null;
}

function estadoRebotes(proveedor: string | null): EstadoRebotes {
  if (proveedor === 'ses') {
    // Dos piezas, y las dos hacen falta: el configuration set es lo que hace que
    // SES publique los eventos en SNS, y el topic ARN es el guard que hace que
    // /api/ses/sns no le crea a cualquiera.
    const falta = [
      process.env.SES_CONFIGURATION_SET ? null : 'SES_CONFIGURATION_SET',
      process.env.SES_SNS_TOPIC_ARN ? null : 'SES_SNS_TOPIC_ARN',
    ].filter((x): x is string => x !== null);
    return { cerrado: falta.length === 0, falta, donde: 'Consola de AWS (SES → Configuration sets → SNS)' };
  }

  if (proveedor === 'resend') {
    // Sin el secret el endpoint acepta cualquier POST sin firma: `firmaValida()`
    // solo corre si el secret existe.
    const falta = process.env.RESEND_WEBHOOK_SECRET ? [] : ['RESEND_WEBHOOK_SECRET'];
    return { cerrado: falta.length === 0, falta, donde: 'Panel de Resend → Webhooks' };
  }

  if (proveedor === 'sendgrid') {
    const falta = process.env.SENDGRID_WEBHOOK_TOKEN ? [] : ['SENDGRID_WEBHOOK_TOKEN'];
    return { cerrado: falta.length === 0, falta, donde: 'Panel de SendGrid → Event Webhook' };
  }

  return { cerrado: false, falta: [], donde: '—' };
}

/**
 * Foto del estado de envío de la marca activa.
 *
 * No lanza: si `EMAIL_PROVIDER` tiene un typo, `getProveedor()` tira y la app
 * queda sin poder mandar nada. Esta página es justo donde eso hay que VERLO, no
 * donde hay que explotar.
 */
export async function getDiagnosticoEnvio(cuentaId: string): Promise<DiagnosticoEnvio> {
  let proveedor: string | null = null;
  let proveedorInvalido: string | null = null;
  try {
    proveedor = getProveedor().nombre;
  } catch {
    proveedorInvalido = process.env.EMAIL_PROVIDER ?? '(vacío)';
  }

  const modo = modoEnvio();
  const rem = await getRemitenteEnvio(cuentaId);

  return {
    proveedor,
    proveedorInvalido,
    modo,
    // Solo tiene sentido mirarla cuando el gate está en ensayo: en `real` no
    // filtra nada y mostrarla haría pensar que sí.
    listaEnsayo: modo === 'ensayo' ? listaEnsayo() : [],
    rebotes: estadoRebotes(proveedor),
    remitente: rem,
    remitenteFallback: rem ? null : process.env.SES_FROM_EMAIL ?? null,
  };
}
