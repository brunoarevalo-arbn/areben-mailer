"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { setActiveCuenta } from "@/lib/session";

/** Cambia la marca activa (selector del sidebar). */
export async function cambiarCuenta(cuentaId: string) {
  const session = await verifySession();
  // Single-operador: el admin puede operar cualquier marca. (Si en el futuro hay
  // usuarios por marca, acá va el chequeo de membresía.)
  if (session.rol !== "ADMIN") return;

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
