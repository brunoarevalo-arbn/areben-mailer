import { createVerify } from 'node:crypto';

// Verificación de la firma de Amazon SNS.
//
// El `TopicArn` solo no alcanza como autenticación: viaja en el body y lo puede
// escribir cualquiera. Sin esto, quien conozca el ARN puede POSTear rebotes
// falsos y marcar contactos reales como REBOTADO/SPAM.
//
// Docs: https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html

/**
 * El certificado se baja de una URL que viene EN EL MENSAJE, así que hay que
 * validarla antes de pedirla: si no, un atacante nos hace traer su propio
 * certificado (o nos usa de proxy contra una URL interna).
 */
const URL_CERT_VALIDA = /^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?\/SimpleNotificationService-[a-zA-Z0-9]+\.pem$/;

/**
 * Campos que entran en la cadena firmada, en este orden exacto. `Subject` solo
 * se incluye si el mensaje lo trae.
 */
const CAMPOS_FIRMADOS: Record<string, string[]> = {
  Notification: ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'],
  SubscriptionConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
  UnsubscribeConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
};

/** Los certificados de SNS rotan muy de vez en cuando: cachearlos evita una
 *  request HTTP por cada rebote. */
const cacheCert = new Map<string, string>();

async function traerCertificado(url: string): Promise<string> {
  const cacheado = cacheCert.get(url);
  if (cacheado) return cacheado;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`no se pudo bajar el certificado (${res.status})`);
  const pem = await res.text();
  cacheCert.set(url, pem);
  return pem;
}

/** Arma la cadena canónica: por cada campo presente, `clave\nvalor\n`. */
function cadenaFirmada(body: Record<string, unknown>, campos: string[]): string {
  let out = '';
  for (const campo of campos) {
    const valor = body[campo];
    if (valor === undefined || valor === null) continue; // Subject es opcional
    out += `${campo}\n${String(valor)}\n`;
  }
  return out;
}

export type ResultadoFirma = { valida: true } | { valida: false; motivo: string };

/**
 * Devuelve si el mensaje viene realmente de Amazon SNS. Falla cerrado: ante
 * cualquier duda (campo faltante, URL rara, error de red) devuelve inválido.
 */
export async function verificarFirmaSns(body: Record<string, unknown>): Promise<ResultadoFirma> {
  const tipo = typeof body.Type === 'string' ? body.Type : '';
  const campos = CAMPOS_FIRMADOS[tipo];
  if (!campos) return { valida: false, motivo: `tipo desconocido: ${tipo || '(vacío)'}` };

  const firma = body.Signature;
  const urlCert = body.SigningCertURL;
  if (typeof firma !== 'string' || !firma) return { valida: false, motivo: 'sin Signature' };
  if (typeof urlCert !== 'string' || !URL_CERT_VALIDA.test(urlCert)) {
    return { valida: false, motivo: 'SigningCertURL no es de SNS' };
  }

  // SignatureVersion 1 = SHA1withRSA (histórica), 2 = SHA256withRSA.
  const version = String(body.SignatureVersion ?? '');
  const algoritmo = version === '2' ? 'RSA-SHA256' : version === '1' ? 'RSA-SHA1' : null;
  if (!algoritmo) return { valida: false, motivo: `SignatureVersion inesperada: ${version || '(vacía)'}` };

  let pem: string;
  try {
    pem = await traerCertificado(urlCert);
  } catch (e) {
    return { valida: false, motivo: e instanceof Error ? e.message : 'error bajando el certificado' };
  }

  try {
    const verificador = createVerify(algoritmo);
    verificador.update(cadenaFirmada(body, campos), 'utf8');
    const ok = verificador.verify(pem, firma, 'base64');
    return ok ? { valida: true } : { valida: false, motivo: 'firma no coincide' };
  } catch (e) {
    return { valida: false, motivo: e instanceof Error ? e.message : 'error verificando' };
  }
}
