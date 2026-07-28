"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { autorizar, chequear } from "@/lib/auth";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // saca acentos
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "formulario"
  );
}

/** Genera un slug único dentro de la cuenta. */
async function slugUnico(cuentaId: string, base: string): Promise<string> {
  const raw = slugify(base);
  let slug = raw;
  let n = 1;
  while (
    await prisma.formulario.findUnique({
      where: { cuentaId_slug: { cuentaId, slug } },
      select: { id: true },
    })
  ) {
    n += 1;
    slug = `${raw}-${n}`;
  }
  return slug;
}

export async function crearFormulario() {
  const { cuenta } = await autorizar("editar");
  const nombre = "Formulario sin título";
  const slug = await slugUnico(cuenta.id, `form-${Date.now().toString(36)}`);
  const form = await prisma.formulario.create({
    data: { cuentaId: cuenta.id, nombre, slug },
  });
  redirect(`/formularios/${form.id}`);
}

export async function guardarFormulario(input: {
  id: string;
  nombre: string;
  titulo: string;
  descripcion: string;
  botonTexto: string;
  exitoMensaje: string;
  pedirNombre: boolean;
  listaId: string; // "" = ninguna
  activo: boolean;
}) {
  const auth = await chequear("editar");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

  // Aseguramos que el formulario es de esta cuenta.
  const form = await prisma.formulario.findFirst({
    where: { id: input.id, cuentaId: cuenta.id },
    select: { id: true },
  });
  if (!form) return { ok: false, error: "No encontrado" };

  await prisma.formulario.update({
    where: { id: input.id },
    data: {
      nombre: input.nombre.trim() || "Formulario sin título",
      titulo: input.titulo.trim() || "Suscribite a nuestro newsletter",
      descripcion: input.descripcion.trim() || null,
      botonTexto: input.botonTexto.trim() || "Suscribirme",
      exitoMensaje: input.exitoMensaje.trim() || "¡Listo! Gracias por suscribirte.",
      pedirNombre: input.pedirNombre,
      listaId: input.listaId || null,
      activo: input.activo,
    },
  });
  revalidatePath("/formularios");
  revalidatePath(`/formularios/${input.id}`);
  return { ok: true };
}

export async function eliminarFormulario(id: string) {
  const { cuenta } = await autorizar("editar");
  await prisma.formulario.deleteMany({ where: { id, cuentaId: cuenta.id } });
  revalidatePath("/formularios");
  redirect("/formularios");
}
