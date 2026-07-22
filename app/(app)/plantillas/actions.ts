"use server";

import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Crea una campaña nueva a partir de una plantilla y abre el editor. */
export async function usarPlantilla(plantillaId: string) {
  const cuenta = await getCuentaActiva();
  const plantilla = await prisma.plantilla.findFirst({ where: { id: plantillaId, cuentaId: cuenta.id } });
  if (!plantilla) return;
  const campania = await prisma.campania.create({
    data: {
      cuentaId: cuenta.id,
      nombre: `${plantilla.nombre} (copia)`,
      contenido: plantilla.contenido as object,
    },
  });
  redirect(`/campanias/${campania.id}`);
}

export async function eliminarPlantilla(id: string) {
  const cuenta = await getCuentaActiva();
  await prisma.plantilla.deleteMany({ where: { id, cuentaId: cuenta.id } });
  revalidatePath("/plantillas");
}
