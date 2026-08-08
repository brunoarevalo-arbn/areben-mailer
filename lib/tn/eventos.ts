import { tnGet, tnPost } from "./client";

/**
 * Mapeo trigger de automation → evento webhook de Tiendanube.
 *
 * 🔴 **`CARRITO_ABANDONADO` NO está acá, y no es un olvido.** Tiendanube **no
 * publica ningún evento de checkout ni de cart**: su lista completa es app,
 * category, customer, order, product, product_variant, domain,
 * order_custom_field, product_variant_custom_field, subscription, fulfillment,
 * fulfillment_order y location. Hasta el 8-ago-2026 este mapa decía
 * `CARRITO_ABANDONADO: "checkout/created"`, y como `ensureEventoWebhook` tragaba
 * el error con un `catch {}` vacío, prender la automation **la dejaba ACTIVA y
 * sorda** sin que nadie se enterara. Verificado con `GET /webhooks` en las 4
 * tiendas: no había un solo webhook de checkout registrado, y la automation de
 * BDI llevaba **0 runs desde que se creó**.
 *
 * La ingesta de carritos es un **poller** sobre `GET /checkouts`
 * (`app/api/carritos/detectar/route.ts` + `lib/tn/checkouts.ts`).
 *
 * Sacarlo de acá no es cosmético: es lo que vuelve al trigger **incapaz** de
 * pedirle a TN un webhook que no existe, sin que haya que filtrar en ningún
 * lado. Mismo patrón —y mismo motivo— que `NUEVO_SUSCRIPTOR`, que tampoco tiene
 * evento y por eso tampoco figura.
 */
export const TRIGGER_EVENT: Record<string, string> = {
  NUEVO_CLIENTE: "customer/created",
  COMPRA: "order/paid",
};

export const EVENT_TRIGGER: Record<string, string> = Object.fromEntries(
  Object.entries(TRIGGER_EVENT).map(([k, v]) => [v, k]),
);

interface TnWebhook {
  id: number;
  event: string;
  url: string;
}

/** Qué pasó al intentar registrar el webhook. `motivo` sólo viene si falló. */
export interface ResultadoWebhook {
  ok: boolean;
  /** Texto para mostrarle a una persona, no un stack. */
  motivo?: string;
}

/**
 * Registra (idempotente) el webhook de un evento apuntando a la app.
 *
 * 🔴 **Devuelve el resultado en vez de tragárselo.** La versión anterior tenía
 * un `catch {}` vacío, y ese silencio es exactamente lo que dejó a la automation
 * de carrito abandonado de BDI activa y muda durante semanas. Una automation que
 * se ve encendida y no puede escuchar es peor que una que falla al prenderse:
 * nadie va a buscar el problema.
 *
 * No tira: quien llama decide qué hacer. Hoy `toggleAutomation` lo muestra en
 * pantalla y **igual deja la automation activa** — algunos triggers se disparan
 * también por otros caminos (un lead de pop-up encola runs sin pasar por TN), y
 * apagar la automation por un webhook que falló sería romper el camino que sí
 * funciona.
 */
export async function ensureEventoWebhook(
  storeId: string,
  token: string,
  appUrl: string,
  event: string,
): Promise<ResultadoWebhook> {
  const url = `${appUrl}/api/tn/eventos`;

  let existentes: TnWebhook[];
  try {
    const r = await tnGet<TnWebhook[]>(storeId, token, "webhooks");
    existentes = Array.isArray(r.data) ? r.data : [];
  } catch (e) {
    return { ok: false, motivo: `No se pudo leer los webhooks de la tienda: ${detalle(e)}` };
  }

  if (existentes.some((w) => w.url === url && w.event === event)) return { ok: true };

  try {
    await tnPost(storeId, token, "webhooks", { event, url });
    return { ok: true };
  } catch (e) {
    // El 422 de TN es "ese evento no existe" o "ya lo tenés". Lo segundo ya
    // quedó descartado arriba, así que acá casi siempre es lo primero — y es la
    // falla que importa nombrar.
    const d = detalle(e);
    if (/422/.test(d)) {
      return {
        ok: false,
        motivo: `Tiendanube rechazó el evento "${event}" (422). Ese evento no existe en su API, así que esta automation no se va a disparar sola.`,
      };
    }
    return { ok: false, motivo: `Tiendanube no aceptó el webhook de "${event}": ${d}` };
  }
}

function detalle(e: unknown): string {
  const m = String(e instanceof Error ? e.message : e);
  return m.length > 200 ? `${m.slice(0, 200)}…` : m;
}
