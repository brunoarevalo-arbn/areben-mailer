import { tnGet, tnPost } from "./client";

// Mapeo trigger de automation → evento webhook de Tiendanube.
export const TRIGGER_EVENT: Record<string, string> = {
  NUEVO_CLIENTE: "customer/created",
  COMPRA: "order/paid",
  CARRITO_ABANDONADO: "checkout/created",
};

export const EVENT_TRIGGER: Record<string, string> = Object.fromEntries(
  Object.entries(TRIGGER_EVENT).map(([k, v]) => [v, k]),
);

interface TnWebhook {
  id: number;
  event: string;
  url: string;
}

/** Registra (idempotente) el webhook de un evento apuntando a la app. */
export async function ensureEventoWebhook(storeId: string, token: string, appUrl: string, event: string) {
  const url = `${appUrl}/api/tn/eventos`;
  const existentes = await tnGet<TnWebhook[]>(storeId, token, "webhooks")
    .then((r) => (Array.isArray(r.data) ? r.data : []))
    .catch(() => []);
  const ya = existentes.some((w) => w.url === url && w.event === event);
  if (ya) return;
  try {
    await tnPost(storeId, token, "webhooks", { event, url });
  } catch {
    /* si ya existe o falla, seguimos */
  }
}
