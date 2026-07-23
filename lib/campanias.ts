import { prisma } from "@/lib/prisma";
import { reglasToWhere, type Reglas } from "@/lib/segmentos";

/**
 * Contactos elegibles de una campaña: del destino (lista o segmento),
 * activos y que aceptan marketing. Devuelve null si el segmento no existe.
 */
export async function contactosElegibles(
  cuentaId: string,
  campania: { listaId: string | null; segmentoId: string | null }
): Promise<{ id: string }[] | null> {
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
    select: { id: true },
  });
}
