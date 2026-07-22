import { prisma } from "@/lib/prisma";

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(_req: Request, { params }: { params: Promise<{ envioId: string }> }) {
  const { envioId } = await params;
  try {
    const envio = await prisma.envio.findUnique({ where: { id: envioId } });
    if (envio && !envio.abiertoAt) {
      await prisma.$transaction([
        prisma.envio.update({
          where: { id: envioId },
          data: {
            abiertoAt: new Date(),
            estado: envio.estado === "CLICK" ? "CLICK" : "ABIERTO",
          },
        }),
        prisma.evento.create({ data: { envioId, tipo: "OPEN" } }),
      ]);
    }
  } catch {
    /* nunca romper el pixel */
  }

  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}
