"use server";

import { prisma } from "@/lib/prisma";
import { autorizar, chequear } from "@/lib/auth";
import { presetDe } from "@/lib/plantillas/presets";
import { getRemitenteEnvio } from "@/lib/remitentes";
import { V_ACTUAL } from "@/lib/email/esquema";
import { nuevoBloque, type ContenidoCampania } from "@/lib/email/render";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Crea una campaña nueva a partir de una plantilla PREARMADA (de código). */
export async function usarPreset(presetId: string) {
  const { cuenta } = await autorizar("editar");
  // El remitente es el fallback del sitio de la tienda para las cuentas sin
  // `config.url`. Sin esto los botones del preset salen vacíos, que es el bug
  // que tenía toda la galería.
  const rem = await getRemitenteEnvio(cuenta.id);
  const preset = presetDe(presetId, cuenta, rem?.email);
  if (!preset) return;
  const campania = await prisma.campania.create({
    data: {
      cuentaId: cuenta.id,
      nombre: preset.nombre,
      // El asunto solo lo traen los de automation; en una campaña se escribe.
      asunto: preset.asunto || null,
      contenido: preset.contenido as object,
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

/**
 * Una plantilla nueva, en blanco, y derecho al editor.
 *
 * Hasta acá una plantilla solo podía nacer desde una campaña ("guardar como
 * plantilla"): para armar un diseño reusable había que crear una campaña que no
 * se iba a mandar nunca y dejarla ahí.
 */
export async function crearPlantilla() {
  const { cuenta } = await autorizar("editar");
  const p = await prisma.plantilla.create({
    data: {
      cuentaId: cuenta.id,
      nombre: "Plantilla sin título",
      // Nace con un título adentro y no vacía: el editor sin ningún bloque
      // muestra una pantalla en blanco que no dice qué hacer.
      contenido: { v: V_ACTUAL, bloques: [nuevoBloque("encabezado"), nuevoBloque("titulo")] } as object,
    },
  });
  redirect(`/plantillas/${p.id}`);
}

/** Guarda el diseño de una plantilla ya existente (desde su editor). */
export async function guardarPlantilla(input: { id: string; nombre: string; contenido: ContenidoCampania }) {
  const auth = await chequear("editar");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

  // `updateMany` con el `cuentaId` en el WHERE: un `update` por id dejaría que
  // una cuenta pisara la plantilla de otra si se adivinara el id.
  const r = await prisma.plantilla.updateMany({
    where: { id: input.id, cuentaId: cuenta.id },
    data: {
      nombre: input.nombre.trim() || "Plantilla sin título",
      // El contenido ENTERO, tal como lo tiene el editor. Enumerar campos a
      // mano es lo que perdía la versión del esquema y los estilos de documento.
      contenido: input.contenido as object,
    },
  });
  if (r.count === 0) return { ok: false, error: "No se encontró la plantilla" };
  revalidatePath("/plantillas");
  return { ok: true };
}

/** Copia una plantilla para partir de ella sin tocar la original. */
export async function duplicarPlantilla(id: string) {
  const { cuenta } = await autorizar("editar");
  const p = await prisma.plantilla.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!p) return;
  const copia = await prisma.plantilla.create({
    data: {
      cuentaId: cuenta.id,
      nombre: `${p.nombre} (copia)`,
      // El Json tal cual: los ids de bloque son únicos DENTRO de un documento,
      // así que dos plantillas pueden compartirlos sin molestarse.
      contenido: p.contenido as object,
    },
  });
  redirect(`/plantillas/${copia.id}`);
}

export async function eliminarPlantilla(id: string) {
  const { cuenta } = await autorizar("editar");
  await prisma.plantilla.deleteMany({ where: { id, cuentaId: cuenta.id } });
  revalidatePath("/plantillas");
}
