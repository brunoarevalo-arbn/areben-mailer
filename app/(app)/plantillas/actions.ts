"use server";

import { prisma } from "@/lib/prisma";
import { autorizar, chequear } from "@/lib/auth";
import { presetDe } from "@/lib/plantillas/presets";
import { getRemitenteEnvio } from "@/lib/remitentes";
import {
  automationDelTrigger,
  ESPERA_SCHEMA_HORAS,
  esTrigger,
  nacimientoDelMail,
  puedeCrearOtra,
  type Trigger,
} from "@/lib/automations";
import { V_ACTUAL } from "@/lib/email/esquema";
import { veredictoGuardado, type ResultadoGuardado } from "@/lib/documentos";
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
 * Crea una AUTOMATION a partir de una plantilla (prearmada o guardada).
 *
 * El diseño de un mail es el mismo Json para las tres tablas —`Plantilla`,
 * `Campania` y `Automation` guardan un `ContenidoCampania` y se leen con
 * `leerContenido`—, así que esto es una copia, igual que "crear campaña". Lo que
 * cambia son las reglas de las automations, que son las caras:
 *
 * - 🔴 **Una por trigger y por cuenta.** Si ya hay una, redirige a ESA en vez de
 *   insertar. Es la misma guarda de `crearAutomation` y por la misma razón: el
 *   disparador manda todas las que matcheen ⇒ dos son dos mails a la misma
 *   persona. Va en el servidor porque la página puede estar cacheada.
 * - **Nace PAUSADA** (el default del schema). Prender es lo que registra el
 *   webhook en Tiendanube y lo que hace que salgan mails solos: eso se aprieta
 *   a propósito, nunca de arrastre.
 * - El asunto de una plantilla de galería no existe (solo lo traen los presets
 *   de automation), así que se hereda el nombre. Sin asunto no se puede prender.
 */
export async function usarComoAutomation(
  origen: { tipo: "preset" | "plantilla"; id: string },
  trigger: Trigger,
) {
  const { cuenta } = await autorizar("editar");
  // El trigger llega atado desde el server, pero se valida igual: una action es
  // un endpoint público y sus argumentos vienen del navegador.
  if (!esTrigger(trigger)) return;

  const existentes = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id },
    select: { id: true, trigger: true, createdAt: true },
  });
  // Mismo criterio que `crearAutomation`: al tope se va a editar la que hay.
  if (!puedeCrearOtra(existentes, trigger)) {
    const ya = automationDelTrigger(existentes, trigger);
    if (ya) redirect(`/automations/${ya.id}`);
  }
  const orden = existentes.filter((a) => a.trigger === trigger).length + 1;

  let nombre: string;
  let asunto: string;
  let contenido: object;

  if (origen.tipo === "preset") {
    const rem = await getRemitenteEnvio(cuenta.id);
    const preset = presetDe(origen.id, cuenta, rem?.email);
    if (!preset) return;
    nombre = preset.nombre;
    asunto = preset.asunto || preset.nombre;
    contenido = preset.contenido as object;
  } else {
    const p = await prisma.plantilla.findFirst({ where: { id: origen.id, cuentaId: cuenta.id } });
    if (!p) return;
    nombre = p.nombre;
    asunto = p.nombre;
    contenido = p.contenido as object;
  }

  // ⚠️ Una plantilla de galería NO trae espera propia —sólo la traen los presets
  // de automation—, así que el 1º nace con la del schema (1 h), escrita acá para
  // que se vea. Lo que cambia en el 2º de una secuencia es el nombre y la espera,
  // o son dos filas idénticas que salen a la misma hora.
  const nace = nacimientoDelMail(orden, { nombre, esperaHoras: ESPERA_SCHEMA_HORAS });
  const a = await prisma.automation.create({
    data: {
      cuentaId: cuenta.id,
      nombre: nace.nombre,
      trigger,
      esperaHoras: nace.esperaHoras,
      asunto,
      contenido,
    },
  });
  redirect(`/automations/${a.id}`);
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
export async function guardarPlantilla(input: {
  id: string;
  nombre: string;
  contenido: ContenidoCampania;
  version: number;
}): Promise<ResultadoGuardado> {
  const auth = await chequear("editar");
  if (!auth.ok) return { ok: false, error: auth.error ?? "Sin permiso", conflicto: false };
  const cuenta = auth.ctx.cuenta;

  // `updateMany` con el `cuentaId` en el WHERE: un `update` por id dejaría que
  // una cuenta pisara la plantilla de otra si se adivinara el id. Y el
  // `docVersion` es lo que impide que dos personas se pisen entre sí — ver
  // `lib/documentos.ts`.
  const r = await prisma.plantilla.updateMany({
    where: { id: input.id, cuentaId: cuenta.id, docVersion: input.version },
    data: {
      nombre: input.nombre.trim() || "Plantilla sin título",
      // El contenido ENTERO, tal como lo tiene el editor. Enumerar campos a
      // mano es lo que perdía la versión del esquema y los estilos de documento.
      contenido: input.contenido as object,
      docVersion: { increment: 1 },
    },
  });
  if (r.count === 0) {
    const existe = await prisma.plantilla.findFirst({
      where: { id: input.id, cuentaId: cuenta.id },
      select: { id: true },
    });
    return veredictoGuardado(0, Boolean(existe), input.version);
  }
  revalidatePath("/plantillas");
  return veredictoGuardado(r.count, true, input.version + 1);
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
