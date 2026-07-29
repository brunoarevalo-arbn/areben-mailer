"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { autorizar, chequear } from "@/lib/auth";
import { getIdentityStatus } from "@/lib/email/proveedores/ses";
import type { Tema } from "@/lib/email/tema";

export async function crearRemitente(input: {
  nombre: string;
  email: string;
  responderA: string;
}) {
  const auth = await chequear("remitentes");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

  const email = input.email.trim().toLowerCase();
  const nombre = input.nombre.trim();
  if (!email.includes("@")) return { ok: false, error: "Email inválido" };
  if (!nombre) return { ok: false, error: "Falta el nombre" };

  const dominio = email.split("@")[1];
  const yaHay = await prisma.remitente.count({ where: { cuentaId: cuenta.id } });

  try {
    await prisma.remitente.create({
      data: {
        cuentaId: cuenta.id,
        nombre,
        email,
        responderA: input.responderA.trim() || null,
        dominio,
        esPrincipal: yaHay === 0, // el primero queda principal
      },
    });
  } catch {
    return { ok: false, error: "Ese email ya existe como remitente" };
  }
  revalidatePath("/remitentes");
  return { ok: true };
}

export async function eliminarRemitente(id: string): Promise<void> {
  const { cuenta } = await autorizar("remitentes");
  await prisma.remitente.deleteMany({ where: { id, cuentaId: cuenta.id } });
  revalidatePath("/remitentes");
}

export async function hacerPrincipal(id: string) {
  const auth = await chequear("remitentes");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

  const rem = await prisma.remitente.findFirst({
    where: { id, cuentaId: cuenta.id },
    select: { id: true },
  });
  if (!rem) return { ok: false };
  await prisma.$transaction([
    prisma.remitente.updateMany({
      where: { cuentaId: cuenta.id },
      data: { esPrincipal: false },
    }),
    prisma.remitente.update({ where: { id }, data: { esPrincipal: true } }),
  ]);
  revalidatePath("/remitentes");
  return { ok: true };
}

/** Consulta SES el estado de verificación del dominio del remitente. */
export async function verificarRemitente(id: string) {
  const auth = await chequear("remitentes");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

  const rem = await prisma.remitente.findFirst({
    where: { id, cuentaId: cuenta.id },
    select: { id: true, dominio: true },
  });
  if (!rem) return { ok: false, error: "No encontrado" };

  const estado = await getIdentityStatus(rem.dominio);
  await prisma.remitente.update({ where: { id }, data: { estado } });
  revalidatePath("/remitentes");
  return { ok: true, estado };
}

/**
 * Aspecto por defecto de los mails de la marca.
 *
 * Se guarda dentro de `Cuenta.config`, que ya es Json y ya se lee así para
 * `config.url`. Sin columna nueva a propósito: la base se comparte con popups y
 * `prisma db push` está prohibido.
 *
 * ⚠️ Se hace merge sobre el config existente. Un `update` con `{ tema }` pelado
 * borraría `config.url`, y con eso los presets de las automations se quedarían
 * sin el link a la tienda.
 */
export async function guardarTemaMarca(tema: Tema | null) {
  const chk = await chequear("remitentes");
  if (!chk.ok) return chk;
  const { cuenta } = chk.ctx;

  const config = (cuenta.config as Prisma.JsonObject) ?? {};
  const nuevo: Prisma.JsonObject = { ...config };
  if (tema && Object.values(tema).some((v) => v !== undefined && v !== "")) {
    nuevo.tema = tema as Prisma.JsonObject;
  } else {
    delete nuevo.tema;
  }

  await prisma.cuenta.update({ where: { id: cuenta.id }, data: { config: nuevo } });
  revalidatePath("/remitentes");
  return { ok: true as const };
}
