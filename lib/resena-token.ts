// El link firmado que lleva del mail a la página donde se deja la opinión.
//
// 🔴 **ESTE ARCHIVO ESTÁ ESPEJADO EN `areben-mailer/lib/resena-token.ts`.** Lo
// firma el mailer al renderizar el mail y lo verifica Resorty al abrir la
// página: los dos lados tienen que producir exactamente el mismo HMAC. Si se
// toca uno, se toca el otro — el ensayo de cada repo compara contra los mismos
// vectores fijos, que es lo que hace que una divergencia se vea antes del deploy
// y no en un 400 contra una casilla real.
//
// 🔑 **No hay tabla de tokens.** El token va FIRMADO, no guardado: es una
// columna menos, una escritura menos por mail y por producto (con 6 productos
// serían 6), y un vencimiento que nadie tiene que limpiar.
import { createHmac, timingSafeEqual } from 'crypto';

/** Lo que el token dice, y que por lo tanto NO se puede editar desde la URL. */
export interface PayloadResena {
  /** `Cuenta.id`. Los dos repos comparten la base, así que es el mismo id. */
  cuentaId: string;
  /** La orden de TN que habilita la opinión. Es lo que la hace "compra verificada". */
  orderId: string;
  productoId: string;
  /**
   * El nombre del producto, tal como lo trajo TN al armar el mail.
   *
   * 🔑 Viaja adentro del token —y no se busca al abrir la página— porque
   * `/opinar` es PÚBLICA y la abren también los escáneres de seguridad de Gmail
   * y Outlook: pedirle el producto a Tiendanube en cada apertura sería una
   * llamada a su API por cada escaneo, con un modo de falla (TN caído) que
   * dejaría la página sin poder decir de QUÉ se está opinando.
   */
  producto: string;
  email: string;
  nombre: string;
  /** 1-5. La estrella que la persona apretó en el mail. */
  rating: number;
  /** Vencimiento, en ms epoch. */
  exp: number;
}

/**
 * ⚠️ Sin `RESENA_SECRET` **no se firma y no se verifica**: `firmarResena`
 * devuelve `null` (el mail sale sin estrellas, entero) y `verificarResena`
 * devuelve `null` (la página dice que el link no es válido). Falla CERRADO en
 * los dos sentidos; nunca cae a un secreto por defecto, que sería un token que
 * cualquiera con el repo puede fabricar.
 */
const secreto = (): string | null => process.env.RESENA_SECRET || null;

const b64url = (b: Buffer) => b.toString('base64url');
const firma = (body: string, s: string) => b64url(createHmac('sha256', s).update(body).digest());

/** 30 días desde que sale el mail. */
export const VIDA_MS = 30 * 24 * 3600_000;

export function firmarResena(p: PayloadResena): string | null {
  const s = secreto();
  if (!s) return null;
  const body = b64url(Buffer.from(JSON.stringify(p)));
  return `${body}.${firma(body, s)}`;
}

/**
 * Devuelve el payload si el token es nuestro y está vigente; `null` si no.
 *
 * 🔴 **`cuentaId`, `orderId` y `productoId` salen de ACÁ y NUNCA del body del
 * POST.** Sueltos, un token legítimo de un producto sirve para dejar una reseña
 * «compra verificada» en cualquier otro producto de la tienda — que es justo lo
 * que esa marca promete que no pasa.
 *
 * ⚠️ **El `rating` es la excepción, y a propósito.** Acá viaja el que la persona
 * apretó en el mail, y sirve para que el link no se pueda editar: pegar `?r=5` en
 * la URL no prefija nada. Pero el que se GUARDA sale del formulario, porque la
 * página deja cambiarlo —apretar 3 y arrepentirse es normal— y porque tener el
 * token ya prueba que es esa persona: elegir 1 o 5 es su derecho.
 */
export function verificarResena(token: string): PayloadResena | null {
  const s = secreto();
  if (!s) return null;
  const i = token.lastIndexOf('.');
  if (i <= 0) return null;
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const esperada = Buffer.from(firma(body, s));
  const recibida = Buffer.from(sig);
  // timingSafeEqual tira si difieren los largos: hay que chequearlo antes.
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as Partial<PayloadResena>;
    if (typeof p.cuentaId !== 'string' || !p.cuentaId) return null;
    if (typeof p.orderId !== 'string' || !p.orderId) return null;
    if (typeof p.productoId !== 'string' || !p.productoId) return null;
    if (typeof p.email !== 'string' || !p.email) return null;
    if (typeof p.rating !== 'number' || !Number.isInteger(p.rating) || p.rating < 1 || p.rating > 5) return null;
    if (typeof p.exp !== 'number' || p.exp <= Date.now()) return null;
    // El nombre de la persona y el del producto pueden faltar sin romper nada: la
    // página pregunta el primero y el segundo sólo decora. Los demás DECIDEN, y
    // por eso arriba se exigen.
    return {
      ...p,
      nombre: typeof p.nombre === 'string' ? p.nombre : '',
      producto: typeof p.producto === 'string' ? p.producto : '',
    } as PayloadResena;
  } catch {
    return null;
  }
}
