import { prisma } from "@/lib/prisma";
import { autorizarApi } from "@/lib/auth";

// Progreso de una campaña en curso. Solo lee: el envío lo maneja la cola del
// servidor, el editor únicamente mira.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // autorizarApi y no autorizar: un redirect acá sería un 307 que fetch sigue
  // hasta el HTML de /login, y el polling del editor reventaría en res.json().
  const auth = await autorizarApi("ver");
  if (auth instanceof Response) return auth;

  // Filtrado por cuenta: antes era findUnique({ id }) pelado, así que con un id
  // ajeno se leían las métricas de otra marca. 404 y no 403, para no confirmarle
  // a quien sondea que ese id existe.
  const campania = await prisma.campania.findFirst({
    where: { id, cuentaId: auth.cuenta.id },
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
