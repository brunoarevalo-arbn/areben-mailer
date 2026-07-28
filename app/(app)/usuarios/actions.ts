"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { autorizar, chequear, getAuth } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { Rol } from "@/lib/permisos";

// Administración del equipo. Todo acá adentro exige el permiso 'usuarios'
// (solo ADMIN), salvo cambiarMiPassword, que es de cualquiera sobre sí mismo.
//
// Las guardas de este archivo son las fáciles de olvidar y caras de omitir:
// dejar la cuenta sin ningún ADMIN activo, o que alguien se degrade a sí mismo,
// deja la marca sin quién administre y sin forma de volver desde la app.

const ROLES_VALIDOS: Rol[] = ["ADMIN", "EDITOR", "VIEWER"];

/** Contraseña temporal legible, para dictarla o pegarla en un chat. */
function passwordTemporal(): string {
  return randomBytes(9).toString("base64url");
}

/**
 * Cuántos ADMIN activos quedarían en la cuenta si `excluido` dejara de serlo.
 * Se usa antes de degradar, desactivar o borrar.
 */
async function adminsActivosSalvo(cuentaId: string, excluido: string): Promise<number> {
  return prisma.usuario.count({
    where: { cuentaId, rol: "ADMIN", activo: true, id: { not: excluido } },
  });
}

export async function crearUsuario(input: {
  email: string;
  nombre: string;
  rol: Rol;
  interno: boolean;
}) {
  const auth = await chequear("usuarios");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { cuenta, interno: actorInterno } = auth.ctx;

  const email = input.email.trim().toLowerCase();
  const nombre = input.nombre.trim();
  if (!email.includes("@")) return { ok: false, error: "Email inválido" };
  if (!ROLES_VALIDOS.includes(input.rol)) return { ok: false, error: "Rol inválido" };

  // Un admin de comerciante no puede fabricarse un usuario que vea todas las
  // marcas: `interno` solo lo puede otorgar alguien que ya lo tiene.
  const interno = input.interno && actorInterno;

  const yaEnEstaCuenta = await prisma.usuario.findFirst({
    where: { cuentaId: cuenta.id, email },
    select: { id: true },
  });
  if (yaEnEstaCuenta) return { ok: false, error: "Ya existe un usuario con ese email en esta marca" };

  // No hay unique global sobre email (rompería el alta por OAuth de Tiendanube),
  // así que el caso se valida acá: con el mismo mail en dos marcas, el login no
  // podría decidir a cuál entrar.
  const enOtraCuenta = await prisma.usuario.findFirst({
    where: { email, cuentaId: { not: cuenta.id } },
    select: { id: true },
  });
  if (enOtraCuenta) {
    return {
      ok: false,
      error: "Ese email ya se usa en otra marca. Si es la misma persona, marcala como interna allá en vez de crearla acá.",
    };
  }

  const temporal = passwordTemporal();
  await prisma.usuario.create({
    data: {
      cuentaId: cuenta.id,
      email,
      nombre: nombre || null,
      rol: input.rol,
      interno,
      passwordHash: await hashPassword(temporal),
    },
  });

  revalidatePath("/usuarios");
  // La temporal se devuelve UNA vez y no se guarda en claro en ningún lado.
  return { ok: true, passwordTemporal: temporal };
}

export async function cambiarRol(id: string, rol: Rol) {
  const auth = await chequear("usuarios");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { cuenta, userId } = auth.ctx;

  if (!ROLES_VALIDOS.includes(rol)) return { ok: false, error: "Rol inválido" };
  // Degradarte a vos mismo te deja sin la sección desde la cual volver.
  if (id === userId) return { ok: false, error: "No podés cambiarte el rol a vos mismo" };

  const usuario = await prisma.usuario.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!usuario) return { ok: false, error: "Usuario no encontrado" };

  if (usuario.rol === "ADMIN" && rol !== "ADMIN") {
    if ((await adminsActivosSalvo(cuenta.id, id)) === 0) {
      return { ok: false, error: "Es el único administrador activo de la marca" };
    }
  }

  await prisma.usuario.update({ where: { id }, data: { rol } });
  revalidatePath("/usuarios");
  return { ok: true };
}

export async function toggleActivo(id: string) {
  const auth = await chequear("usuarios");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { cuenta, userId } = auth.ctx;

  if (id === userId) return { ok: false, error: "No podés desactivarte a vos mismo" };

  const usuario = await prisma.usuario.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!usuario) return { ok: false, error: "Usuario no encontrado" };

  if (usuario.activo && usuario.rol === "ADMIN") {
    if ((await adminsActivosSalvo(cuenta.id, id)) === 0) {
      return { ok: false, error: "Es el único administrador activo de la marca" };
    }
  }

  await prisma.usuario.update({ where: { id }, data: { activo: !usuario.activo } });
  revalidatePath("/usuarios");
  // Desactivar corta la sesión en el próximo request: getAuth chequea `activo`.
  return { ok: true, activo: !usuario.activo };
}

export async function resetearPassword(id: string) {
  const auth = await chequear("usuarios");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { cuenta } = auth.ctx;

  const usuario = await prisma.usuario.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!usuario) return { ok: false, error: "Usuario no encontrado" };

  const temporal = passwordTemporal();
  await prisma.usuario.update({ where: { id }, data: { passwordHash: await hashPassword(temporal) } });
  revalidatePath("/usuarios");
  return { ok: true, passwordTemporal: temporal };
}

export async function toggleInterno(id: string) {
  const auth = await chequear("usuarios");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { cuenta, userId, interno: actorInterno } = auth.ctx;

  // Solo alguien que ya opera varias marcas puede habilitar a otro a hacerlo.
  if (!actorInterno) return { ok: false, error: "No podés otorgar acceso a otras marcas" };
  if (id === userId) return { ok: false, error: "No podés cambiarte esto a vos mismo" };

  const usuario = await prisma.usuario.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!usuario) return { ok: false, error: "Usuario no encontrado" };

  await prisma.usuario.update({ where: { id }, data: { interno: !usuario.interno } });
  revalidatePath("/usuarios");
  return { ok: true, interno: !usuario.interno };
}

export async function eliminarUsuario(id: string) {
  const auth = await chequear("usuarios");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { cuenta, userId } = auth.ctx;

  if (id === userId) return { ok: false, error: "No podés eliminarte a vos mismo" };

  const usuario = await prisma.usuario.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!usuario) return { ok: false, error: "Usuario no encontrado" };

  if (usuario.rol === "ADMIN" && usuario.activo) {
    if ((await adminsActivosSalvo(cuenta.id, id)) === 0) {
      return { ok: false, error: "Es el único administrador activo de la marca" };
    }
  }

  await prisma.usuario.delete({ where: { id } });
  revalidatePath("/usuarios");
  return { ok: true };
}

/**
 * Cambio de contraseña propia. Permiso 'ver': lo necesita cualquiera, y sobre
 * todo quien entró con una temporal — sin esto esa contraseña vive para siempre.
 */
export async function cambiarMiPassword(actual: string, nueva: string) {
  const { userId } = await autorizar("ver");

  if (nueva.length < 8) return { ok: false, error: "La contraseña nueva necesita al menos 8 caracteres" };

  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!usuario) return { ok: false, error: "Usuario no encontrado" };
  if (!(await verifyPassword(actual, usuario.passwordHash))) {
    return { ok: false, error: "La contraseña actual no coincide" };
  }

  await prisma.usuario.update({ where: { id: userId }, data: { passwordHash: await hashPassword(nueva) } });
  return { ok: true };
}
