import { prisma } from "@/lib/prisma";
import { readTnWebhook } from "@/lib/tn/webhook";
import { tnGet } from "@/lib/tn/client";
import { EVENT_TRIGGER } from "@/lib/tn/eventos";

interface Persona {
  email?: string | null;
  name?: string | null;
  id?: number;
}

// Resuelve email/nombre/tnId del contacto según el evento.
async function resolver(
  event: string,
  recursoId: string,
  storeId: string,
  token: string,
): Promise<{ email: string; nombre: string | null; tnCustomerId: string | null; triggerData: object } | null> {
  try {
    if (event === "customer/created") {
      const { data } = await tnGet<Persona>(storeId, token, `customers/${recursoId}`);
      if (!data.email) return null;
      return { email: data.email.toLowerCase(), nombre: data.name ?? null, tnCustomerId: data.id?.toString() ?? null, triggerData: {} };
    }
    if (event === "order/paid") {
      const { data } = await tnGet<{ customer?: Persona }>(storeId, token, `orders/${recursoId}`);
      const c = data.customer;
      if (!c?.email) return null;
      return { email: c.email.toLowerCase(), nombre: c.name ?? null, tnCustomerId: c.id?.toString() ?? null, triggerData: { orderId: recursoId } };
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
    create: { cuentaId: cuenta.id, email: persona.email, nombre: persona.nombre, tnCustomerId: persona.tnCustomerId, source: "tiendanube", tnAcceptsMkt: true },
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
