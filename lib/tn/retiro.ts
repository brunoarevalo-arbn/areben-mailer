import { tnGet } from "./client";
import { estaCancelada, estaRetirado, type OrdenTnRetiro } from "@/lib/email/pedido";

/**
 * ¿Este aviso de retiro todavía tiene sentido? Lee la orden COMO ESTÁ HOY.
 *
 * Devuelve el motivo para no mandarlo (`retirado` · `cancelado`) o `null`.
 * ⚠️ **TN caído ⇒ `null` (sale)**, la misma regla que el corte de la bienvenida:
 * un recordatorio de más se perdona; un «tu pedido está listo» que no llega es
 * justo el problema que estos mails arreglan.
 */
export async function corteDeRetiro(
  storeId: string | null | undefined,
  token: string | null | undefined,
  orderId: string,
): Promise<"retirado" | "cancelado" | null> {
  if (!storeId || !token) return null;
  try {
    const { data } = await tnGet<OrdenTnRetiro>(storeId, token, `orders/${orderId}`);
    if (estaCancelada(data)) return "cancelado";
    if (estaRetirado(data)) return "retirado";
    return null;
  } catch {
    return null;
  }
}
