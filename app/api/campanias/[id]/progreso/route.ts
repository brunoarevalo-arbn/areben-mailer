import { prisma } from "@/lib/prisma";

// Progreso de una campaña en curso. Solo lee: el envío lo maneja la cola del
// servidor, el editor únicamente mira. Ruta protegida por sesión (el proxy no
// la lista como pública).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const campania = await prisma.campania.findUnique({
    where: { id },
    select: { estado: true, procesandoHasta: true },
  });
  if (!campania) return Response.json({ error: "no existe" }, { status: 404 });

  const porEstado = await prisma.envio.groupBy({
    by: ["estado"],
    where: { campaniaId: id },
    _count: true,
  });

  const cuenta = (estados: string[]) =>
    porEstado.filter((g) => estados.includes(g.estado)).reduce((a, g) => a + g._count, 0);

  const encolados = cuenta(["ENCOLADO"]);
  const fallidos = cuenta(["FALLIDO"]);
  const total = porEstado.reduce((a, g) => a + g._count, 0);

  return Response.json({
    estado: campania.estado,
    total,
    // Todo lo que ya salió: ENVIADO y cualquier estado posterior (aperturas,
    // clicks, rebotes) implica que el mail se mandó.
    enviados: total - encolados - fallidos,
    encolados,
    fallidos,
    // Si hay lease vigente, hay un worker mandando ahora mismo.
    activo: !!campania.procesandoHasta && campania.procesandoHasta > new Date(),
  });
}
