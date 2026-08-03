"use server";

import { prisma } from "@/lib/prisma";
import { autorizar, chequear } from "@/lib/auth";
import { reglasToWhere, type Reglas } from "@/lib/segmentos";
import { MANDABLE } from "@/lib/campanias";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function crearSegmento() {
  const { cuenta } = await autorizar("editar");
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
  const auth = await chequear("editar");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

  await prisma.segmento.update({
    where: { id, cuentaId: cuenta.id },
    data: { nombre, reglas: reglas as object },
  });
  revalidatePath("/segmentos");
  return { ok: true };
}

/**
 * Cuenta cuántos contactos MANDABLES matchean las reglas — para el preview en vivo.
 *
 * 🔴 Va `MANDABLE` y no `estado: "ACTIVO"` a secas. El número que muestra el
 * builder es el que la persona usa para decidir a quién le manda, así que tiene
 * que ser el mismo que después arma `contactosElegibles`, que suma
 * `tnAcceptsMkt: true`. Con solo el estado, un segmento de BDI decía ~21.000 y
 * el motor mandaba 18.554 sin explicar la diferencia — el mismo agujero que el
 * comentario de `MANDABLE` pide no abrir con los tramos.
 */
export async function contarSegmento(reglas: Reglas) {
  const { cuenta } = await autorizar("ver");
  const count = await prisma.contacto.count({
    where: { cuentaId: cuenta.id, ...MANDABLE, ...reglasToWhere(reglas) },
  });
  return count;
}
