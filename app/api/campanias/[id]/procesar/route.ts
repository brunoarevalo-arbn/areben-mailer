import { prisma } from "@/lib/prisma";
import { renderEmailHtml, aplicarMergeTags, type ContenidoCampania } from "@/lib/email/render";
import { inyectarTracking } from "@/lib/email/tracking";
import { sendEmail } from "@/lib/ses/client";
import { getRemitenteEnvio } from "@/lib/remitentes";

export const maxDuration = 60;

const BATCH = 20;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campania = await prisma.campania.findUnique({ where: { id }, include: { cuenta: true } });
  if (!campania) return Response.json({ error: "no existe" }, { status: 404 });

  const appUrl = process.env.APP_URL ?? "";
  const contenido = campania.contenido as unknown as ContenidoCampania;
  const rem = await getRemitenteEnvio(campania.cuentaId);

  const envios = await prisma.envio.findMany({
    where: { campaniaId: id, estado: "ENCOLADO" },
    take: BATCH,
    include: { contacto: true },
  });

  let enviados = 0;
  let fallidos = 0;
  let throttled = false;

  for (const envio of envios) {
    const unsubUrl = `${appUrl}/baja?e=${envio.id}`;
    let html = renderEmailHtml(contenido, {
      preheader: campania.preheader ?? undefined,
      unsubscribeUrl: unsubUrl,
      nombreCuenta: campania.cuenta.nombre,
    });
    html = aplicarMergeTags(html, envio.contacto);
    html = inyectarTracking(html, envio.id, appUrl);

    try {
      const res = await sendEmail({
        to: envio.contacto.email,
        subject: campania.asunto!,
        html,
        unsubscribeUrl: unsubUrl,
        fromEmail: rem?.email,
        fromName: rem?.nombre,
        replyTo: rem?.responderA ?? undefined,
      });
      await prisma.envio.update({
        where: { id: envio.id },
        data: { estado: "ENVIADO", sesMessageId: res.messageId, enviadoAt: new Date() },
      });
      enviados++;
    } catch (e) {
      const name = (e as Error).name || "";
      if (/throttl|TooManyRequests|Limit/i.test(name)) {
        // rate limit: dejamos el envío ENCOLADO para el próximo lote
        throttled = true;
        break;
      }
      await prisma.envio.update({ where: { id: envio.id }, data: { estado: "FALLIDO" } });
      fallidos++;
    }
  }

  const restantes = await prisma.envio.count({ where: { campaniaId: id, estado: "ENCOLADO" } });
  if (restantes === 0 && !throttled) {
    await prisma.campania.update({
      where: { id },
      data: { estado: "ENVIADA", enviadaAt: new Date() },
    });
  }

  return Response.json({ enviados, fallidos, restantes, throttled });
}
