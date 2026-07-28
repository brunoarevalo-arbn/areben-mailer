import { prisma } from "@/lib/prisma";
import { renderEmailHtml, renderEmailTexto, aplicarMergeTags, type ContenidoCampania, type ProductoEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/enviar";
import { destinatarioPermitido } from "@/lib/email/proveedor";
import { inyectarTracking } from "@/lib/email/tracking";
import { getRemitenteEnvio } from "@/lib/remitentes";
import { tnGet } from "@/lib/tn/client";

export const maxDuration = 60;
const BATCH = 30;

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  const appUrl = process.env.APP_URL ?? "";

  const runs = await prisma.automationRun.findMany({
    where: { estado: "PENDIENTE", proximoAt: { lte: new Date() } },
    take: BATCH,
    include: { automation: { include: { cuenta: true } }, contacto: true },
  });

  let enviados = 0, saltados = 0, fallidos = 0;

  for (const run of runs) {
    const { automation, contacto } = run;
    // Consentimiento + estado
    if (contacto.estado !== "ACTIVO" || !contacto.tnAcceptsMkt || automation.estado !== "ACTIVO" || !automation.asunto) {
      await prisma.automationRun.update({ where: { id: run.id }, data: { estado: "SALTADO" } });
      saltados++;
      continue;
    }

    const td = run.triggerData as { checkoutId?: string; abandonedUrl?: string; productos?: ProductoEmail[] };
    const esCarrito = automation.trigger === "CARRITO_ABANDONADO";

    // Carrito abandonado: si ya completó la compra, no enviamos.
    if (esCarrito && td.checkoutId && automation.cuenta.tnStoreId && automation.cuenta.tnToken) {
      try {
        const { data } = await tnGet<{ completed_at?: string | null }>(
          automation.cuenta.tnStoreId, automation.cuenta.tnToken, `checkouts/${td.checkoutId}`,
        );
        if (data.completed_at) {
          await prisma.automationRun.update({ where: { id: run.id }, data: { estado: "SALTADO" } });
          saltados++;
          continue;
        }
      } catch { /* si no se puede verificar, seguimos con el envío */ }
    }

    const contenido = automation.contenido as unknown as ContenidoCampania;
    const bloques = [...(contenido?.bloques ?? [])];
    // Carrito: sumar los productos que dejó como bloque
    if (esCarrito && td.productos?.length) bloques.push({ tipo: "productos", items: td.productos });

    // Con el gate cerrado —o en ensayo, si este contacto no está habilitado— no
    // mandamos nada de verdad, pero dejamos correr el flujo igual: así se ve que
    // la automation dispara cuando tiene que disparar, sin molestar a nadie.
    // No se crea Envio: un mail que no salió no debe ensuciar las métricas.
    if (!destinatarioPermitido(contacto.email)) {
      await prisma.automationRun.update({ where: { id: run.id }, data: { estado: "ENVIADO", sesMessageId: "dry-run" } });
      enviados++;
      continue;
    }

    // El Envio se crea ANTES de renderizar porque su id es lo que hace medible
    // al mail: el pixel de apertura y los links de click cuelgan de él. Sin esto
    // la automation manda a ciegas y no se sabe si sirve.
    const envio = await prisma.envio.upsert({
      where: { automationRunId: run.id },
      update: {},
      create: { cuentaId: automation.cuentaId, contactoId: contacto.id, automationRunId: run.id },
    });

    const unsubUrl = `${appUrl}/baja?c=${contacto.id}`;
    const opts = {
      preheader: automation.preheader ?? undefined,
      unsubscribeUrl: unsubUrl,
      nombreCuenta: automation.cuenta.nombre,
    };
    let html = renderEmailHtml({ bloques }, opts);
    html = aplicarMergeTags(html, contacto);
    if (esCarrito) html = html.replaceAll("${cart.url}", td.abandonedUrl ?? "#");
    // El tracking va al final: sobre el HTML ya resuelto, para que envuelva
    // también los links que salieron de los merge tags y del carrito.
    if (appUrl) html = inyectarTracking(html, envio.id, appUrl);
    // Parte text/plain: un mail solo-HTML es señal de spam, sobre todo en Outlook.
    let texto = aplicarMergeTags(renderEmailTexto({ bloques }, opts), contacto);
    if (esCarrito) texto = texto.replaceAll("${cart.url}", td.abandonedUrl ?? "#");

    const rem = await getRemitenteEnvio(automation.cuentaId);
    try {
      const res = await sendEmail({
        to: contacto.email,
        subject: automation.asunto,
        html,
        text: texto,
        unsubscribeUrl: unsubUrl,
        fromEmail: rem?.email,
        fromName: rem?.nombre,
        replyTo: rem?.responderA ?? undefined,
      });
      await prisma.$transaction([
        prisma.automationRun.update({ where: { id: run.id }, data: { estado: "ENVIADO", sesMessageId: res.messageId } }),
        prisma.envio.update({
          where: { id: envio.id },
          data: { estado: "ENVIADO", sesMessageId: res.messageId, enviadoAt: new Date() },
        }),
      ]);
      enviados++;
    } catch {
      await prisma.$transaction([
        prisma.automationRun.update({ where: { id: run.id }, data: { estado: "FALLIDO" } }),
        prisma.envio.update({ where: { id: envio.id }, data: { estado: "FALLIDO" } }),
      ]);
      fallidos++;
    }
  }

  const pendientes = await prisma.automationRun.count({ where: { estado: "PENDIENTE", proximoAt: { lte: new Date() } } });
  return Response.json({ procesados: runs.length, enviados, saltados, fallidos, pendientes });
}
