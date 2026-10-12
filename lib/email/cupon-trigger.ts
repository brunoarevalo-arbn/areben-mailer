// El cupón que el visitante ganó en el pop-up entra al mail de bienvenida.
//
// ⚠️ Puro: sin prisma, sin red. Vive aparte del procesador de automations para
// poder fijarlo con un script (`scripts/probar-bienvenida.ts`), que es la única
// forma de probar esto sin mandarle un mail a alguien.
//
// El mecanismo es el mismo que ya usa `carrito`: el run trae el dato del evento
// y se pisa el bloque justo antes de renderizar. La diferencia es que acá hay un
// caso que ELIMINA el bloque, y esa es la razón de fondo del archivo.
import { mapearBloques, type Bloque } from "./bloques";
import { resolverTagsEnDoc } from "./tienda";

/** Lo que `areben-popups` deja en `AutomationRun.triggerData` (ver `lib/mailer.ts` de ese repo). */
export interface TriggerPopup {
  /**
   * De qué superficie de captura vino: `"popup"` (Resorty) y, cuando existan,
   * `"formulario"` y las que sigan. **Ausente = webhook de Tiendanube.**
   *
   * 🔴 Lo que se pregunta es si HAY `origen`, nunca si vale `"popup"`: con el
   * literal hardcodeado, un lead de formulario caería en la rama del webhook y
   * saldría con el placeholder de la plantilla.
   */
  origen?: string;
  campaniaId?: string;
  cupon?: string | null;
  vence?: string | null;
  condiciones?: string | null;
  /** Lo que el visitante vio girar en la ruleta: "15% OFF", "Envío gratis". */
  prizeLabel?: string | null;
}

/**
 * Devuelve los bloques con el bloque `cupon` resuelto contra el run.
 *
 * Tres caminos, y el del medio es el que importa:
 *
 * 1. Run del webhook de TN (**sin `origen`**) → **no se toca nada**. El que
 *    escribió un código estático a mano lo sigue viendo. Compatibilidad hacia
 *    atrás.
 * 2. Lead de una captura nuestra **sin** cupón (el backfill de los históricos, o
 *    un `crearCupon` que falló) → **se elimina el bloque**. 🔴 Dejar el
 *    placeholder del preset —`BIENVENIDA10`— sería mandarle a un cliente un
 *    código que no existe en Tiendanube: lo tipea en el checkout, no anda, y el
 *    mail queda peor que si no hubiera traído cupón.
 * 3. Lead de una captura nuestra con cupón → se pisa el código y el texto.
 *
 * La pregunta es **"¿vino de una captura nuestra?"** (hay `origen`), no "¿vino
 * de un pop-up?". Todo lo que capturamos pasa por acá con su `origen` puesto, y
 * lo único sin `origen` es Tiendanube.
 *
 * El `texto` se pisa con `prizeLabel` cuando vino, porque es **lo que la persona
 * realmente vio ganar**: en una ruleta el texto del bloque ("10% en tu primera
 * compra") puede no tener nada que ver con el premio que salió.
 */
export function aplicarCuponDelTrigger(bloques: Bloque[], td: TriggerPopup): Bloque[] {
  // Los `${cupon.…}` se resuelven SIEMPRE, también en un run del webhook de TN:
  // sin `vence` la oración que los lleva se cae, nunca sale el tag crudo.
  bloques = resolverCuponEnDoc(bloques, td.vence);
  if (!td.origen) return bloques;
  if (!td.cupon) return mapearBloques(bloques, (b) => (b.tipo === "cupon" ? null : b));

  const codigo = td.cupon;
  return mapearBloques(bloques, (b) => {
    if (b.tipo !== "cupon") return b;
    const premio = td.prizeLabel?.trim();
    // 🔑 Un bloque que DECLARA `destacado` (la clave, aunque esté vacía) tiene un
    // lugar propio para el premio: ahí va, y el `texto` queda como rótulo. Sin
    // esto el mail personal salía «15% OFF BDI-…» (11-oct-2026). Un bloque sin la
    // clave —la bienvenida ACTIVA— sigue como siempre: el premio pisa el texto.
    if ("destacado" in b) {
      const condiciones = [b.condiciones?.trim(), td.condiciones?.trim()].filter(Boolean).join(" · ");
      return { ...b, codigo, destacado: premio || b.destacado, ...(condiciones ? { condiciones } : {}) };
    }
    // Las condiciones se agregan, no reemplazan: son la letra chica del premio
    // ("Válido 24 h", "Compra mínima $20.000"), no su descripción.
    const texto = [premio || b.texto, td.condiciones?.trim()].filter(Boolean).join(" · ");
    return { ...b, codigo, texto };
  });
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/**
 * Los tags del vencimiento: `${cupon.vence}` → «18/10» y `${cupon.venceLargo}` →
 * «el domingo 18/10». `vence` viene SÓLO FECHA («2026-10-18», como lo guarda el
 * pop-up y como TN entiende `end_date`): se lee tal cual, sin pasar por `Date`
 * local — la medianoche UTC en Argentina es el día ANTERIOR (ver `condicionesDe`).
 * Cualquier otra forma da `{}` y la oración que lo usa se cae.
 */
export function valoresCupon(vence?: string | null): { vence?: string; venceLargo?: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(vence?.trim() ?? "");
  if (!m) return {};
  const corto = `${m[3]}/${m[2]}`;
  const dia = DIAS[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
  return { vence: corto, venceLargo: `el ${dia} ${corto}` };
}

const RE_CUPON = /\$\{cupon\.([a-zA-Z]+)\}/g;

/** El documento (o la lista de bloques) con los `${cupon.…}` resueltos. */
export function resolverCuponEnDoc<T>(contenido: T, vence?: string | null): T {
  const v = valoresCupon(vence) as Record<string, string | undefined>;
  return resolverTagsEnDoc(contenido, "${cupon.", RE_CUPON, (k) => v[k]);
}
