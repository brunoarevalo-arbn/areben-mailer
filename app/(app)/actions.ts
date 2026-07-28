"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { setActiveCuenta } from "@/lib/session";

/** Cambia la marca activa (selector del sidebar). */
export async function cambiarCuenta(cuentaId: string) {
  // Lo que habilita operar varias marcas es `interno`, no el rol: son cosas
  // distintas. Antes se pedían las dos, y eso hacía imposible tener un editor
  // del equipo que trabajara en BDI, Zattia y Stunned — que es justo el caso
  // para el que existe el selector. El rol se sigue aplicando dentro de cada
  // marca: entrar no es lo mismo que poder enviar.
  const { interno } = await getAuth();
  if (!interno) return;

  const existe = await prisma.cuenta.findUnique({
    where: { id: cuentaId },
    select: { id: true },
  });
  if (!existe) return;

  const ok = await setActiveCuenta(cuentaId);
  if (!ok) return;

  revalidatePath("/", "layout");
  redirect("/");
}
