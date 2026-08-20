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

/**
 * Un producto tal como viene adentro de una orden de Tiendanube.
 *
 * ⚠️ **Es la misma forma que traen los productos de un checkout** —`name`,
 * `name_without_variants`, `price`, `image`, `quantity`, `variant_values`—, que
 * es lo que deja reusar el mapeo y el bloque `carrito` del motor. Lo que NO
 * trae es la ficha del producto: el link hay que ir a buscarlo.
 */
interface ProductoDeTn {
  product_id?: number | string;
  name?: string;
  name_without_variants?: string | null;
  price?: string;
  compare_at_price?: string;
  image?: string | { src?: string };
  quantity?: number;
  variant_values?: string[];
}

/**
 * Los productos de una orden, con el link a su ficha, listos para el bloque
 * `carrito`.
 *
 * 🔴 **La ficha se pide producto por producto** (`GET /products/{id}`), y no con
 * un `ids=1,2,3`: ese filtro no está verificado contra la API real, y si TN lo
 * ignorara devolvería la primera página del catálogo — de la que los productos
 * que buscamos podrían faltar, dejando links caídos **sin un solo error**. Un
 * `GET` de un recurso por id es la forma que este archivo ya usa tres veces.
 * Son como mucho `TOPE_CARRITO` llamadas, una vez por orden pagada.
 *
 * ⚠️ **Un producto sin ficha se cae del mail, no sale sin link.** El bloque
 * `carrito` dibuja cada línea como un ancla; una con `#` es una promesa rota en
 * una casilla. Y si se caen todos, el bloque desaparece solo (lo hace el
 * renderer) y el mail sale igual con su texto y su botón: nunca se frena por
 * esto.
 *
 * ⚠️ Y por lo mismo devuelve `[]` ante cualquier fallo de TN en vez de tirar: el
 * webhook está creando el run de una automation, y perder el run entero porque
 * no se pudo resolver una URL sería cambiar un mail incompleto por ninguno.
 */
async function productosDeOrden(
  todos: ProductoDeTn[],
  storeId: string,
  token: string,
): Promise<object[]> {
  const elegidos = todos.slice(0, TOPE_CARRITO);
  const salida: object[] = [];
  for (const p of elegidos) {
    if (p.product_id == null) continue;
    let url = "";
    try {
      const { data } = await tnGet<{ canonical_url?: string }>(
        storeId, token, `products/${p.product_id}`,
      );
      url = data.canonical_url ?? "";
    } catch {
      continue;
    }
    if (!url) continue;
    salida.push({
      // Mismo criterio que el carrito: `name` viene con la variante pegada y la
      // variante va en su propio renglón. `name_without_variants` es **null** en
      // los productos sin variantes, de ahí el fallback.
      nombre: p.name_without_variants || p.name || "",
      variante: p.variant_values?.length ? p.variant_values.join(" · ") : undefined,
      cantidad: typeof p.quantity === "number" ? p.quantity : undefined,
      precio: p.compare_at_price && p.compare_at_price !== p.price ? p.compare_at_price : p.price ?? "",
      precioPromo: p.compare_at_price && p.compare_at_price !== p.price ? p.price : undefined,
      imagen: typeof p.image === "string" ? p.image : p.image?.src ?? "",
      // 🔑 `?resena=1` es lo que hace que la ficha abra el formulario de
      // opiniones y lo traiga a la vista (lo lee `montarResenas` en el widget de
      // Resorty). Sin eso, el mail deja a la persona en una página larga donde
      // el botón de opinar está abajo de todo: se pide la reseña y no se dice
      // dónde.
      // ⚠️ Con `&` si la URL de TN ya trae query. Hoy `canonical_url` no trae,
      // pero armar links pegando "?" a ciegas es cómo se rompe uno el día que sí.
      url: url + (url.includes("?") ? "&" : "?") + "resena=1",
    });
  }
  return salida;
}

// Resuelve datos del contacto según el evento.
async function resolver(event: string, recursoId: string, storeId: string, token: string): Promise<Resuelto | null> {
  try {
    if (event === "customer/created") {
      const { data } = await tnGet<Persona>(storeId, token, `customers/${recursoId}`);
      if (!data.email) return null;
      return { email: data.email.toLowerCase(), nombre: data.name ?? null, tnCustomerId: data.id?.toString() ?? null, acceptsMkt: data.accepts_marketing === true, triggerData: {} };
    }
    if (event === "order/paid") {
      const { data } = await tnGet<{ customer?: Persona; products?: ProductoDeTn[] }>(
        storeId, token, `orders/${recursoId}`,
      );
      const c = data.customer;
      if (!c?.email) return null;
      // Lo que compró, para el pedido de reseña: sin los productos, ese mail sólo
      // puede decir "contanos qué te pareció" sin decir de QUÉ, y el link tiene
      // que llegar a la ficha, que es donde vive el formulario de opiniones.
      // ⚠️ `COMPRA` (el agradecimiento) recibe lo mismo y no lo usa: su preset no
      // trae bloque `carrito`, así que no se dibuja. Un `triggerData` más rico no
      // cambia un mail que no lo pide.
      const todos = data.products ?? [];
      const productos = await productosDeOrden(todos, storeId, token);
      return {
        email: c.email.toLowerCase(),
        nombre: c.name ?? null,
        tnCustomerId: c.id?.toString() ?? null,
        acceptsMkt: c.accepts_marketing === true,
        triggerData: {
          orderId: recursoId,
          productos,
          // 🔴 **Siempre 0, y no `todos.length - productos.length`.** El bloque
          // `carrito` dibuja los que faltan como «y N productos más:
          // ${cart.url}», y ese placeholder lo reemplaza el procesador **sólo
          // para el carrito abandonado** — en un pedido de reseña saldría el
          // literal `${cart.url}` a una casilla de verdad. Y aunque se
          // reemplazara, no hay a dónde mandar: «el resto de lo que compraste»
          // no es una página. Un producto cuya ficha TN no devuelve no se puede
          // mostrar acá, y decir que existe sin poder llevar a él no ayuda a
          // nadie. (El procesador además ya no deja escapar el literal; esto es
          // la primera de las dos redes.)
          restantes: 0,
        },
      };
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

  // ⚠️ Un evento puede despertar VARIOS triggers: `order/paid` despierta el
  // agradecimiento (`COMPRA`) y el pedido de reseña (`RESENA`), que es el mismo
  // hecho con otra espera y otro mail. Antes esto era un solo trigger y el otro
  // se perdía en silencio; ver el comentario de `EVENT_TRIGGER`.
  const triggers = EVENT_TRIGGER[event];
  if (!triggers?.length) return new Response("ok", { status: 200 });

  const cuenta = await prisma.cuenta.findUnique({ where: { tnStoreId: storeId } });
  if (!cuenta?.tnToken) return new Response("ok", { status: 200 });

  const automations = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger: { in: triggers as never[] }, estado: "ACTIVO" },
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
