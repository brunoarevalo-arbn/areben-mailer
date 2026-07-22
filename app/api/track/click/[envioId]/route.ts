import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ envioId: string }> }) {
  const { envioId } = await params;
  const url = new URL(req.url).searchParams.get("u");
  const destino = url && /^https?:\/\//i.test(url) ? url : "https://bdiaccesorios.com.ar";

  try {
    await prisma.$transaction([
      prisma.envio.update({
        where: { id: envioId },
        data: { clickAt: new Date(), estado: "CLICK" },
      }),
      prisma.evento.create({ data: { envioId, tipo: "CLICK", url: destino } }),
    ]);
  } catch {
    /* si el envío no existe, redirigimos igual */
  }

  return Response.redirect(destino, 302);
}
