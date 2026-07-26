import { prisma } from "@/lib/prisma";
import { reglasToWhere, type Reglas } from "@/lib/segmentos";

/**
 * Contactos elegibles de una campaña: del destino (lista o segmento),
 * activos y que aceptan marketing. Devuelve null si el segmento no existe.
 */
export async function contactosElegibles(
  cuentaId: string,
  campania: { listaId: string | null; segmentoId: string | null }
): Promise<{ id: string; email: string }[] | null> {
  let destinoWhere;
  if (campania.listaId) {
    destinoWhere = { listas: { some: { listaId: campania.listaId } } };
  } else {
    const seg = await prisma.segmento.findFirst({ where: { id: campania.segmentoId!, cuentaId } });
    if (!seg) return null;
    destinoWhere = reglasToWhere(seg.reglas as unknown as Reglas);
  }
  return prisma.contacto.findMany({
    where: { cuentaId, estado: "ACTIVO", tnAcceptsMkt: true, ...destinoWhere },
    select: { id: true, email: true },
  });
}

/** Crea envíos ENCOLADO para una lista de contactos con una variante dada. */
export async function crearEnvios(
  campaniaId: string,
  contactos: { id: string }[],
  variante: string | null,
) {
  const CHUNK = 1000;
  for (let i = 0; i < contactos.length; i += CHUNK) {
    await prisma.envio.createMany({
      data: contactos.slice(i, i + CHUNK).map((c) => ({ campaniaId, contactoId: c.id, variante })),
      skipDuplicates: true,
    });
  }
}
