// El puente al endpoint de Resorty que acuña el cupón del carrito abandonado.
//
// 🔴 **La creación del cupón NO se duplica de este lado.** `crearCupon` de
// Resorty (`lib/tn/tienda.ts`) tiene cinco trampas de la API de Tiendanube ya
// pagadas —la hora LOCAL de la tienda, el 422 de `max_uses_per_client` +
// `first_consumer_purchase`, el vencimiento que hay que releer de lo que TN
// confirma, que `end_date` es por día, y el prefijo del código por tienda—. Una
// segunda copia acá se va a portar distinto el día que TN cambie algo, y la
// diferencia se va a ver en un cupón que un cliente no puede usar. Además el dato
// de "¿qué descuento ya tiene esta persona?" vive en `PopupEvento`, que es tabla
// de Resorty.
//
// ⚠️ Este archivo NO es puro (hace red): lo que decide qué pasa con el bloque
// vive en `lib/email/cupon-carrito.ts`, que sí lo es y tiene su ensayo.
import type { CuponEmitido } from "./email/cupon-carrito";

/**
 * Dónde vive Resorty. Uso servidor-a-servidor, nunca para armar un link que vea
 * alguien — es la contracara de `MAILER_URL` en `lib/mailer.ts` de aquel repo.
 */
export const RESORTY_URL = process.env.RESORTY_URL ?? "https://resorty.arebensrl.com";

/**
 * Pide el cupón de este carrito. **Nunca tira**: un `null` es "el mail sale sin
 * bloque `cupon`", que es un mail entero y correcto.
 *
 * 🔴 El `null` no distingue el fallo del "no corresponde" a propósito. Los cuatro
 * motivos —apagado, sin tienda, el escalado no mejora, TN falló— terminan en la
 * misma acción, y darle ramas distintas al llamador invita a que alguna termine
 * mandando el código del preset. El motivo queda en el log, que es donde se lo
 * busca.
 */
export async function pedirCuponDeCarrito(
  cuentaId: string,
  email: string,
  checkoutId: string,
): Promise<CuponEmitido | null> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  try {
    // ⚠️ Con timeout, al revés que el pinchazo de Resorty al procesador: acá SÍ
    // hay alguien esperando —el lote de 30 runs tiene 60 s de `maxDuration`— y
    // una tienda que no contesta no puede quedarse con la corrida entera.
    const res = await fetch(`${RESORTY_URL}/api/carrito/cupon`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: JSON.stringify({ cuentaId, email, checkoutId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("cupón de carrito: Resorty contestó", res.status);
      return null;
    }
    const j = (await res.json()) as {
      ok?: boolean; codigo?: string; valor?: number; vence?: string | null;
      minCompra?: number; motivo?: string;
    };
    if (!j.ok || !j.codigo || typeof j.valor !== "number") {
      if (j.motivo && j.motivo !== "apagado") console.warn("cupón de carrito: sin cupón", j.motivo);
      return null;
    }
    return { codigo: j.codigo, valor: j.valor, vence: j.vence ?? null, minCompra: j.minCompra ?? 0 };
  } catch (e) {
    console.error("cupón de carrito: no se pudo pedir", e);
    return null;
  }
}
