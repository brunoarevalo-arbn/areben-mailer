import { prisma } from "@/lib/prisma";
import { readTnWebhook } from "@/lib/tn/webhook";
import { tnGet } from "@/lib/tn/client";
import { EVENT_TRIGGER } from "@/lib/tn/eventos";

interface Persona {
  email?: string | null;
  name?: string | null;
  id?: number;
  accepts_marketing?: boolean;
}

interface Resuelto {
  email: string;
  nombre: string | null;
  tnCustomerId: string | null;
  acceptsMkt: boolean;
  triggerData: object;
}

/**
 * Cuántos productos del carrito entran en el mail.
 *
 * Medido contra los checkouts reales de BDI: de 30 carritos, uno solo pasa de 4
 * productos y el más grande tiene 8. Con 6 entra casi todo, y lo que se recorta
 * se avisa con "y N más" en vez de desaparecer.
 */
const TOPE_CARRITO = 6;

// Resuelve datos del contacto según el evento.
async function resolver(event: string, recursoId: string, storeId: string, token: string): Promise<Resuelto | null> {
  try {
    if (event === "customer/created") {
      const { data } = await tnGet<Persona>(storeId, token, `customers/${recursoId}`);
      if (!data.email) return null;
      return { email: data.email.toLowerCase(), nombre: data.name ?? null, tnCustomerId: data.id?.toString() ?? null, acceptsMkt: data.accepts_marketing === true, triggerData: {} };
    }
    if (event === "order/paid") {
      const { data } = await tnGet<{ customer?: Persona }>(storeId, token, `orders/${recursoId}`);
      const c = data.customer;
      if (!c?.email) return null;
      return { email: c.email.toLowerCase(), nombre: c.name ?? null, tnCustomerId: c.id?.toString() ?? null, acceptsMkt: c.accepts_marketing === true, triggerData: { orderId: recursoId } };
    }
    if (event === "checkout/created") {
      const { data } = await tnGet<{
        contact_email?: string; contact_name?: string; customer?: Persona;
        abandoned_checkout_url?: string; contact_accepts_marketing?: boolean;
        products?: {
          name?: string; name_without_variants?: string | null; price?: string;
          compare_at_price?: string; image?: string | { src?: string };
          quantity?: number; variant_values?: string[];
        }[];
      }>(storeId, token, `checkouts/${recursoId}`);
      const email = data.contact_email?.toLowerCase();
      if (!email) return null;
      const todos = data.products ?? [];
      const productos = todos.slice(0, TOPE_CARRITO).map((p) => ({
        // `name` viene con la variante pegada — "MAGSAFE CASE (iPhone 17 Pro Max,
        // ROSA)"— y la variante va en su propio renglón, así que usamos el nombre
        // limpio. Ojo: `name_without_variants` es **null** en los productos sin
        // variantes (verificado contra el checkout de BDI), de ahí el fallback.
        nombre: p.name_without_variants || p.name || "",
        variante: p.variant_values?.length ? p.variant_values.join(" · ") : undefined,
        cantidad: typeof p.quantity === "number" ? p.quantity : undefined,
        precio: p.compare_at_price && p.compare_at_price !== p.price ? p.compare_at_price : p.price ?? "",
        precioPromo: p.compare_at_price && p.compare_at_price !== p.price ? p.price : undefined,
        imagen: typeof p.image === "string" ? p.image : p.image?.src ?? "",
        url: data.abandoned_checkout_url ?? "#",
      }));
      return {
        email,
        nombre: data.contact_name ?? null,
        tnCustomerId: data.customer?.id?.toString() ?? null,
        acceptsMkt: data.contact_accepts_marketing === true,
        triggerData: {
          checkoutId: recursoId,
          abandonedUrl: data.abandoned_checkout_url ?? "",
          productos,
          // Cuántos quedaron afuera del tope. Se muestra: esconderlo hace creer
          // que el carrito era más chico de lo que fue.
          restantes: Math.max(0, todos.length - productos.length),
        },
      };
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(req: Request) {
  const { ok, body } = await readTnWebhook(req);
  if (!ok) return new Response("invalid hmac", { status: 401 });

  const data = body as { store_id?: number; event?: string; id?: number };
  const event = data.event;
  const storeId = data.store_id?.toString();
  const recursoId = data.id?.toString();
  if (!event || !storeId || !recursoId) return new Response("ok", { status: 200 });

  const trigger = EVENT_TRIGGER[event];
  if (!trigger) return new Response("ok", { status: 200 });

  const cuenta = await prisma.cuenta.findUnique({ where: { tnStoreId: storeId } });
  if (!cuenta?.tnToken) return new Response("ok", { status: 200 });

  const automations = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger: trigger as never, estado: "ACTIVO" },
  });
  if (automations.length === 0) return new Response("ok", { status: 200 });

  const persona = await resolver(event, recursoId, storeId, cuenta.tnToken);
  if (!persona) return new Response("ok", { status: 200 });

  const contacto = await prisma.contacto.upsert({
    where: { cuentaId_email: { cuentaId: cuenta.id, email: persona.email } },
    update: { tnCustomerId: persona.tnCustomerId ?? undefined, nombre: persona.nombre ?? undefined },
    create: { cuentaId: cuenta.id, email: persona.email, nombre: persona.nombre, tnCustomerId: persona.tnCustomerId, source: "tiendanube", tnAcceptsMkt: persona.acceptsMkt },
  });

  const now = Date.now();
  for (const a of automations) {
    // Cap: no re-disparar si hubo un run reciente (capDias)
    const desde = new Date(now - a.capDias * 86400000);
    const reciente = await prisma.automationRun.findFirst({
      where: { automationId: a.id, contactoId: contacto.id, createdAt: { gte: desde } },
    });
    if (reciente) continue;
    await prisma.automationRun.create({
      data: {
        automationId: a.id,
        contactoId: contacto.id,
        proximoAt: new Date(now + a.esperaHoras * 3600000),
        triggerData: persona.triggerData,
      },
    });
  }

  return new Response("ok", { status: 200 });
}
