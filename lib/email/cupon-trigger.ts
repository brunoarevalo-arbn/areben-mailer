// El cupón que el visitante ganó en el pop-up entra al mail de bienvenida.
//
// ⚠️ Puro: sin prisma, sin red. Vive aparte del procesador de automations para
// poder fijarlo con un script (`scripts/probar-bienvenida.ts`), que es la única
// forma de probar esto sin mandarle un mail a alguien.
//
// El mecanismo es el mismo que ya usa `carrito`: el run trae el dato del evento
// y se pisa el bloque justo antes de renderizar. La diferencia es que acá hay un
// caso que ELIMINA el bloque, y esa es la razón de fondo del archivo.
import type { Bloque } from "./bloques";

/** Lo que `areben-popups` deja en `AutomationRun.triggerData` (ver `lib/mailer.ts` de ese repo). */
export interface TriggerPopup {
  /** `"popup"` solo cuando el run lo encoló Resorty. Ausente = webhook de Tiendanube. */
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
 * 1. Run del webhook de TN (sin `origen`) → **no se toca nada**. El que escribió
 *    un código estático a mano lo sigue viendo. Compatibilidad hacia atrás.
 * 2. Lead de pop-up **sin** cupón (el backfill de los históricos, o un
 *    `crearCupon` que falló) → **se elimina el bloque**. 🔴 Dejar el placeholder
 *    del preset —`BIENVENIDA10`— sería mandarle a un cliente un código que no
 *    existe en Tiendanube: lo tipea en el checkout, no anda, y el mail queda
 *    peor que si no hubiera traído cupón.
 * 3. Lead de pop-up con cupón → se pisa el código y el texto.
 *
 * El `texto` se pisa con `prizeLabel` cuando vino, porque es **lo que la persona
 * realmente vio ganar**: en una ruleta el texto del bloque ("10% en tu primera
 * compra") puede no tener nada que ver con el premio que salió.
 */
export function aplicarCuponDelTrigger(bloques: Bloque[], td: TriggerPopup): Bloque[] {
  if (td.origen !== "popup") return bloques;
  if (!td.cupon) return bloques.filter((b) => b.tipo !== "cupon");

  const codigo = td.cupon;
  return bloques.map((b) => {
    if (b.tipo !== "cupon") return b;
    // Las condiciones se agregan, no reemplazan: son la letra chica del premio
    // ("Válido 24 h", "Compra mínima $20.000"), no su descripción.
    const texto = [td.prizeLabel?.trim() || b.texto, td.condiciones?.trim()].filter(Boolean).join(" · ");
    return { ...b, codigo, texto };
  });
}
