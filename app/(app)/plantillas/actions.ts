"use server";

import { prisma } from "@/lib/prisma";
import { autorizar } from "@/lib/auth";
import { getPreset } from "@/lib/plantillas/presets";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Crea una campaña nueva a partir de una plantilla PREARMADA (de código). */
export async function usarPreset(presetId: string) {
  const { cuenta } = await autorizar("editar");
  const preset = getPreset(presetId);
  if (!preset) return;
  const campania = await prisma.campania.create({
    data: {
      cuentaId: cuenta.id,
      nombre: preset.nombre,
      contenido: { bloques: preset.bloques } as object,
    },
  });
  redirect(`/campanias/${campania.id}`);
}

/** Crea una campaña nueva a partir de una plantilla y abre el editor. */
export async function usarPlantilla(plantillaId: string) {
  const { cuenta } = await autorizar("editar");
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
  const { cuenta } = await autorizar("editar");
  await prisma.plantilla.deleteMany({ where: { id, cuentaId: cuenta.id } });
  revalidatePath("/plantillas");
}
