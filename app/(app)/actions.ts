"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { setActiveCuenta } from "@/lib/session";

/** Cambia la marca activa (selector del sidebar). */
export async function cambiarCuenta(cuentaId: string) {
  const session = await verifySession();
  if (session.rol !== "ADMIN") return;

  // Solo el equipo de Areben opera varias marcas. Un usuario de comerciante que
  // llame a esta action no puede saltar a la cuenta de otra tienda.
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.userId as string },
    select: { interno: true },
  });
  if (!usuario?.interno) return;

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
