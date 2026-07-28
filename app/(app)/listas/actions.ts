"use server";

import { prisma } from "@/lib/prisma";
import { autorizar } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function crearLista(formData: FormData) {
  const nombre = (formData.get("nombre") as string)?.trim();
  if (!nombre) return;
  const { cuenta } = await autorizar("editar");
  await prisma.lista.create({ data: { cuentaId: cuenta.id, nombre, tipo: "MANUAL" } });
  revalidatePath("/listas");
}

export async function eliminarLista(id: string) {
  const { cuenta } = await autorizar("editar");
  // Solo listas manuales (no las de sistema/TN)
  await prisma.lista.deleteMany({ where: { id, cuentaId: cuenta.id, tipo: "MANUAL" } });
  revalidatePath("/listas");
}
