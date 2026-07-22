import { prisma } from "@/lib/prisma";
import { renderEmailHtml, aplicarMergeTags, type ContenidoCampania } from "@/lib/email/render";
import { sendEmail } from "@/lib/ses/client";

export const maxDuration = 60;
const BATCH = 30;

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  const appUrl = process.env.APP_URL ?? "";
  const sandbox = process.env.SES_SANDBOX !== "false";

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

    const unsubUrl = `${appUrl}/baja?c=${contacto.id}`;
    let html = renderEmailHtml(automation.contenido as unknown as ContenidoCampania, {
      preheader: automation.preheader ?? undefined,
      unsubscribeUrl: unsubUrl,
      nombreCuenta: automation.cuenta.nombre,
    });
    html = aplicarMergeTags(html, contacto);

    if (sandbox) {
      // No enviamos de verdad hasta salir del sandbox; marcamos el flujo como OK.
      await prisma.automationRun.update({ where: { id: run.id }, data: { estado: "ENVIADO", sesMessageId: "sandbox-dryrun" } });
      enviados++;
      continue;
    }

    try {
      const res = await sendEmail({ to: contacto.email, subject: automation.asunto, html, unsubscribeUrl: unsubUrl });
      await prisma.automationRun.update({ where: { id: run.id }, data: { estado: "ENVIADO", sesMessageId: res.messageId } });
      enviados++;
    } catch {
      await prisma.automationRun.update({ where: { id: run.id }, data: { estado: "FALLIDO" } });
      fallidos++;
    }
  }

  const pendientes = await prisma.automationRun.count({ where: { estado: "PENDIENTE", proximoAt: { lte: new Date() } } });
  return Response.json({ procesados: runs.length, enviados, saltados, fallidos, pendientes });
}
