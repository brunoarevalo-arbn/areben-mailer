// El ticket de una venta del local, que manda la Caja del monitor (el POS propio
// de Zattia, plan del 3-oct-2026) cuando la venta queda en Gestión Nube y la
// clienta dejó su mail.
//
//   POST /api/externo/ticket   header `x-ticket-key: <TICKET_KEY>`
//   { marca: "zattia", email, ticket: TicketLocal }   (ver lib/email/ticket.ts)
//
// Hace dos cosas:
//   1. Alta del contacto (`source: "pos"`). 🔴 Si ya existe ⛔ se toca: ni su
//      `estado` —una BAJA, un REBOTADO o un SPAM siguen siéndolo— ni su
//      consentimiento de marketing.
//   2. Encola el run de la automation `TICKET` de la marca, con el ticket en
//      `triggerData`. Uno por venta: el `ventaId` deduplica, así que el monitor
//      puede reintentar sin miedo a mandar dos comprobantes.
//
// 🔑 La llave va en un HEADER, ⛔ en la URL: una URL queda en los logs de Vercel
// y del monitor. Falla CERRADO: sin `TICKET_KEY` cargada, todo es 401.
//
// ⚠️ Sin automation `TICKET` ACTIVA el contacto se da de alta igual y el run ⛔ se
// crea: contesta `encolado: false` con el motivo. El ticket de esa venta ⛔ se
// manda después (prenderla no es retroactivo).
import { createHash, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { leerTicket } from "@/lib/email/ticket";

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function llaveValida(recibida: string | null): boolean {
  const esperada = process.env.TICKET_KEY;
  if (!esperada || !recibida) return false;
  // Se comparan los hashes: `timingSafeEqual` exige largos iguales.
  const a = createHash("sha256").update(esperada).digest();
  const b = createHash("sha256").update(recibida).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!llaveValida(req.headers.get("x-ticket-key"))) return new Response("unauthorized", { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const marca = typeof body.marca === "string" ? body.marca.trim().toLowerCase() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!MAIL.test(email) || email.length > 200) return Response.json({ error: "email inválido" }, { status: 400 });
  const leido = leerTicket(body.ticket);
  if (!leido.ok) return Response.json({ error: leido.error }, { status: 400 });
  const { ticket } = leido;

  const cuenta = await prisma.cuenta.findUnique({ where: { slug: marca }, select: { id: true } });
  if (!cuenta) return Response.json({ error: `marca desconocida: ${marca}` }, { status: 400 });

  const contacto = await prisma.contacto.upsert({
    where: { cuentaId_email: { cuentaId: cuenta.id, email } },
    // 🔴 Vacío a propósito: ver el encabezado.
    update: {},
    create: { cuentaId: cuenta.id, email, source: "pos", tnAcceptsMkt: true },
    select: { id: true, estado: true, source: true },
  });

  const automation = await prisma.automation.findFirst({
    where: { cuentaId: cuenta.id, trigger: "TICKET", estado: "ACTIVO" },
    orderBy: { createdAt: "asc" },
    select: { id: true, esperaHoras: true },
  });
  if (!automation) {
    return Response.json({ contacto: contacto.id, encolado: false, motivo: "la marca no tiene la automation del ticket activa" });
  }

  // Uno por venta. El lock de la transacción serializa dos llamadas con el mismo
  // `ventaId` (la pantalla y el reintento a la vez): sin él, las dos verían que no
  // hay run y crearían uno cada una ⇒ dos comprobantes.
  const r = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"ticket:" + ticket.ventaId}))`;
    const previo = await tx.automationRun.findFirst({
      where: { automationId: automation.id, triggerData: { path: ["ticket", "ventaId"], equals: ticket.ventaId } },
      select: { id: true },
    });
    if (previo) return { runId: previo.id, nuevo: false };
    const run = await tx.automationRun.create({
      data: {
        automationId: automation.id,
        contactoId: contacto.id,
        proximoAt: new Date(Date.now() + automation.esperaHoras * 3600_000),
        triggerData: { origen: "pos", ticket } as object,
      },
      select: { id: true },
    });
    return { runId: run.id, nuevo: true };
  });

  // Que salga ya y no con el cron de 15 minutos: la clienta todavía está en el local.
  if (r.nuevo && automation.esperaHoras === 0) after(() => pincharProcesador());

  return Response.json({ contacto: contacto.id, encolado: r.nuevo, runId: r.runId, ...(r.nuevo ? {} : { motivo: "ya estaba encolado" }) });
}

async function pincharProcesador() {
  const appUrl = process.env.APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!appUrl || !secret) return;
  try {
    await fetch(`${appUrl}/api/automations/procesar?secret=${encodeURIComponent(secret)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(70_000),
    });
  } catch (e) {
    // El cron de 15 minutos lo va a tomar igual. Esto sólo acelera.
    console.error("externo/ticket: no se pudo pinchar el procesador:", e);
  }
}
