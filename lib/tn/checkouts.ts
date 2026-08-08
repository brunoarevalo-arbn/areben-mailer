/**
 * Carritos abandonados de Tiendanube.
 *
 * 🔴 **No hay webhook de checkout.** La lista de eventos de TN no tiene ninguno
 * de cart ni de checkout: sólo app, category, customer, order, product,
 * product_variant, domain, subscription, fulfillment y location. El código que
 * intentaba registrar `checkout/created` fallaba en silencio (ver el comentario
 * de `TRIGGER_EVENT` en `./eventos.ts`). Por eso la ingesta es un **poller**
 * sobre `GET /checkouts`, en `app/api/carritos/detectar/route.ts`.
 *
 * Medido el 8-ago-2026 con `scripts/medir-checkouts-tn.ts`, contra las 4
 * tiendas:
 *
 *   - `GET /checkouts` devuelve **200** con el token del mailer (app 37222).
 *     ⚠️ Con el de Resorty (37985) devolvería 403: le falta `read_orders`.
 *   - `since_id` se respeta ⇒ sirve de cursor.
 *   - BDI 5,6 carritos abandonados por día · Zattia 2,9 · Stunned 1,0.
 *   - **El 100% trae mail Y teléfono.** El checkout abandonado nace recién en
 *     el paso 2, cuando la persona ya cargó los datos.
 *   - 🔑 **El listado ya viene filtrado**: los 244 checkouts leídos entre las
 *     tres tiendas tenían `completed_at` nulo. Un carrito que se convierte en
 *     orden **desaparece** de `GET /checkouts`. De ahí `estadoDeCheckout()`.
 */
import { tnGet } from "./client";
import type { ProductoEmail } from "@/lib/email/bloques";

/**
 * Cuántos productos del carrito entran en el mail.
 *
 * Medido contra los checkouts reales de BDI: de 30 carritos, uno solo pasa de 4
 * productos y el más grande tiene 8. Con 6 entra casi todo, y lo que se recorta
 * se avisa con "y N más" en vez de desaparecer.
 */
export const TOPE_CARRITO = 6;

/** Cuántos checkouts pide por página. El máximo que acepta TN. */
const POR_PAGINA = 200;

/**
 * Tope de páginas por tienda y por corrida.
 *
 * Con 5,6 carritos por día en la tienda más grande, 20 páginas son 4.000
 * checkouts: mucho más de lo que puede haber. Está para que un bug de paginado
 * no se lleve puesto el límite de la API de TN, que se comparte con el monitor
 * y con Resorty.
 */
const MAX_PAGINAS = 20;

/**
 * Los campos que pedimos. `fields` acota lo que viaja y lo que queda en un log
 * (el checkout entero tiene **96 claves**).
 *
 * ⛔ No se piden `shipping_*` ni `billing_*`: son la dirección de una persona y
 * no los necesitamos para mandar un mail. Mismo criterio que `./ordenes.ts`.
 *
 * 🔴 **`customer` NO se puede sacar, aunque parezca que no lo usamos casi.**
 * Aislado el 8-ago-2026 contra la API real: `contact_accepts_marketing` sólo es
 * un `fields` válido **si en la misma lista va `customer`**. Sin él, TN no
 * devuelve el campo vacío: devuelve **422 y no devuelve NADA**.
 *
 *     fields=id,contact_accepts_marketing                  → 422
 *     fields=contact_email,contact_accepts_marketing       → 422
 *     fields=contact_identification,contact_accepts_marketing → 422
 *     fields=customer,contact_accepts_marketing            → 200 ✅
 *
 * Es un acoplamiento que la documentación de TN no menciona, y el modo de falla
 * es el peor posible: se cae la lectura entera del poller, no un dato. Lo fija
 * `scripts/verificar-checkouts-tn.ts`, que hay que correr cuando se toca esta
 * constante.
 */
const FIELDS =
  "id,contact_email,contact_name,contact_phone,contact_identification," +
  "completed_at,created_at,total,products,abandoned_checkout_url,customer,contact_accepts_marketing";

interface TnProducto {
  name?: string;
  name_without_variants?: string | null;
  price?: string;
  compare_at_price?: string;
  image?: string | { src?: string };
  quantity?: number;
  variant_values?: string[];
}

/** La forma cruda que devuelve TN. */
export interface TnCheckout {
  id?: number;
  contact_email?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_accepts_marketing?: boolean;
  customer?: { id?: number } | null;
  completed_at?: string | null;
  created_at?: string | null;
  total?: string | number | null;
  products?: TnProducto[] | null;
  abandoned_checkout_url?: string | null;
}

/** Un carrito abandonado, ya en los términos del mailer. */
export interface CheckoutNormalizado {
  tnCheckoutId: string;
  /** En minúsculas. `null` si el checkout no llegó a tener mail. */
  email: string | null;
  nombre: string | null;
  /** Crudo, como lo devuelve TN. Normalizarlo a E.164 es de la Parte B. */
  telefono: string | null;
  tnCustomerId: string | null;
  acceptsMkt: boolean;
  total: number | null;
  abandonedUrl: string;
  creadoEnTnAt: Date | null;
  completedAt: Date | null;
  /** Los primeros `TOPE_CARRITO`, listos para el bloque `carrito` del mail. */
  productos: ProductoEmail[];
  /** Cuántos quedaron afuera del tope. */
  restantes: number;
}

/** Lo que se guarda en `AutomationRun.triggerData` para un carrito. */
export interface TriggerCarrito {
  checkoutId: string;
  abandonedUrl: string;
  productos: ProductoEmail[];
  restantes: number;
}

function fecha(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Traduce un checkout de TN a los términos del mailer. **Pura**: no toca la red
 * ni la base, así que un script la puede ejercitar con un JSON fijo.
 *
 * Es la única definición de "cómo se ve un carrito". Antes vivía inline en
 * `app/api/tn/eventos/route.ts`; dos copias serían dos carritos que se dibujan
 * distinto en el mail.
 */
export function normalizarCheckout(data: TnCheckout): CheckoutNormalizado {
  const url = data.abandoned_checkout_url ?? "";
  const todos = data.products ?? [];

  const productos: ProductoEmail[] = todos.slice(0, TOPE_CARRITO).map((p) => ({
    // `name` viene con la variante pegada — "MAGSAFE CASE (iPhone 17 Pro Max,
    // ROSA)" — y la variante va en su propio renglón, así que usamos el nombre
    // limpio. Ojo: `name_without_variants` es **null** en los productos sin
    // variantes (verificado contra el checkout de BDI), de ahí el fallback.
    nombre: p.name_without_variants || p.name || "",
    variante: p.variant_values?.length ? p.variant_values.join(" · ") : undefined,
    cantidad: typeof p.quantity === "number" ? p.quantity : undefined,
    precio: p.compare_at_price && p.compare_at_price !== p.price ? p.compare_at_price : p.price ?? "",
    precioPromo: p.compare_at_price && p.compare_at_price !== p.price ? p.price : undefined,
    imagen: typeof p.image === "string" ? p.image : p.image?.src ?? "",
    url: url || "#",
  }));

  const tel = data.contact_phone?.trim();

  return {
    tnCheckoutId: String(data.id ?? ""),
    email: data.contact_email?.trim().toLowerCase() || null,
    nombre: data.contact_name?.trim() || null,
    telefono: tel || null,
    tnCustomerId: data.customer?.id?.toString() ?? null,
    acceptsMkt: data.contact_accepts_marketing === true,
    total: num(data.total),
    abandonedUrl: url,
    creadoEnTnAt: fecha(data.created_at),
    completedAt: fecha(data.completed_at),
    productos,
    // Se dice cuántos quedaron afuera: esconderlo hace creer que el carrito era
    // más chico de lo que fue.
    restantes: Math.max(0, todos.length - productos.length),
  };
}

/** Lo que el mail necesita del carrito, para `AutomationRun.triggerData`. */
export function triggerDeCheckout(c: CheckoutNormalizado): TriggerCarrito {
  return {
    checkoutId: c.tnCheckoutId,
    abandonedUrl: c.abandonedUrl,
    productos: c.productos,
    restantes: c.restantes,
  };
}

/**
 * Lista los carritos abandonados de una tienda, paginando.
 *
 * `desdeId` es el cursor: TN devuelve sólo los de id mayor. Sale de
 * `MAX(tnCheckoutId)` de `CarritoVisto` — derivado del estado y no guardado
 * aparte, así no se puede desincronizar.
 */
export async function listarAbandonados(
  storeId: string,
  token: string,
  desdeId?: string | null,
): Promise<{ checkouts: CheckoutNormalizado[]; truncado: boolean }> {
  const out: CheckoutNormalizado[] = [];
  let truncado = false;

  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const params: Record<string, string | number> = {
      per_page: POR_PAGINA,
      page: pagina,
      fields: FIELDS,
    };
    if (desdeId) params.since_id = desdeId;

    const { data } = await tnGet<TnCheckout[]>(storeId, token, "checkouts", params);
    const lote = Array.isArray(data) ? data : [];
    for (const x of lote) {
      const c = normalizarCheckout(x);
      if (c.tnCheckoutId) out.push(c);
    }
    if (lote.length < POR_PAGINA) return { checkouts: out, truncado };
    if (pagina === MAX_PAGINAS) truncado = true;
  }

  return { checkouts: out, truncado };
}

/**
 * En qué estado está un carrito, justo antes de escribirle.
 *
 * 🔴 **Esto es lo que impide mandarle un "te olvidaste el carrito" a alguien que
 * ya compró**, y no es un detalle de prolijidad: el mail se manda una hora o un
 * día después de detectar el carrito, y en el medio la persona pudo haber
 * terminado la compra.
 *
 * Los tres estados son distintos a propósito:
 *
 *   - `abierto`     — sigue sin comprar. Es el único que habilita el envío.
 *   - `completado`  — compró. Se marca el run `SALTADO`.
 *   - `desconocido` — TN no contestó, o contestó algo que no entendemos. **No
 *     es lo mismo que "abierto".** Quien llama decide: para mail, seguir es
 *     tolerable; para un canal que se paga, no.
 *
 * ⚠️ El 404 cuenta como `completado`, no como `desconocido`. Medido el
 * 8-ago-2026: el listado de `GET /checkouts` devuelve **sólo** los no
 * completados, así que un checkout que desaparece del listado es uno que se
 * convirtió en orden. Si TN además lo borra del endpoint individual, un 404 es
 * la señal de que ya no es un carrito abandonado. Preferimos no mandar de más.
 */
export async function estadoDeCheckout(
  storeId: string,
  token: string,
  checkoutId: string,
): Promise<{ estado: "abierto" | "completado" | "desconocido"; checkout?: CheckoutNormalizado }> {
  try {
    const { data } = await tnGet<TnCheckout>(storeId, token, `checkouts/${checkoutId}`, {
      fields: FIELDS,
    });
    const c = normalizarCheckout(data);
    return { estado: c.completedAt ? "completado" : "abierto", checkout: c };
  } catch (e) {
    if (esNoEncontrado(e)) return { estado: "completado" };
    return { estado: "desconocido" };
  }
}

/** `tnGet` tira un Error con el status adentro del mensaje; acá se lee. */
export function esNoEncontrado(e: unknown): boolean {
  return /→ 404:/.test(String(e instanceof Error ? e.message : e));
}
