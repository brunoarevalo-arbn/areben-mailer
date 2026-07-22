"use server";

import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { reglasToWhere, type Reglas } from "@/lib/segmentos";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function crearSegmento() {
  const cuenta = await getCuentaActiva();
  const seg = await prisma.segmento.create({
    data: {
      cuentaId: cuenta.id,
      nombre: "Segmento sin título",
      reglas: { op: "AND", condiciones: [] },
    },
  });
  redirect(`/segmentos/${seg.id}`);
}

export async function guardarSegmento(id: string, nombre: string, reglas: Reglas) {
  const cuenta = await getCuentaActiva();
  await prisma.segmento.update({
    where: { id, cuentaId: cuenta.id },
    data: { nombre, reglas: reglas as object },
  });
  revalidatePath("/segmentos");
  return { ok: true };
}

/** Cuenta cuántos contactos (activos) matchean las reglas — para el preview en vivo. */
export async function contarSegmento(reglas: Reglas) {
  const cuenta = await getCuentaActiva();
  const count = await prisma.contacto.count({
    where: { cuentaId: cuenta.id, estado: "ACTIVO", ...reglasToWhere(reglas) },
  });
  return count;
}
