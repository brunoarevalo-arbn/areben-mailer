"use server";

import { prisma } from "@/lib/prisma";
import { chequear } from "@/lib/auth";
import { importCustomersIncremental } from "@/lib/tn/import";
import { revalidatePath } from "next/cache";

/** Sincroniza contactos nuevos/cambiados desde TN (incremental). */
export async function sincronizarContactosTN() {
  // Toca la integración con Tiendanube y reescribe la audiencia entera: ADMIN.
  const auth = await chequear("integrar");
  if (!auth.ok) return { ok: false, error: auth.error, nuevos: 0, actualizados: 0 };
  const cuenta = auth.ctx.cuenta;

  if (!cuenta.tnStoreId || !cuenta.tnToken)
    return { ok: false, error: "TN no conectada", nuevos: 0, actualizados: 0 };

  const config = (cuenta.config as Record<string, unknown>) ?? {};
  const since = config.lastSyncContactos ? new Date(config.lastSyncContactos as string) : undefined;

  try {
    const r = await importCustomersIncremental(cuenta.id, cuenta.tnStoreId, cuenta.tnToken, since);
    await prisma.cuenta.update({
      where: { id: cuenta.id },
      data: { config: { ...config, lastSyncContactos: new Date().toISOString() } },
    });
    revalidatePath("/contactos");
    return { ok: true, error: "", ...r };
  } catch (e) {
    return { ok: false, error: (e as Error).message, nuevos: 0, actualizados: 0 };
  }
}

/**
 * Lo que alguien firma al declarar que una lista importada es suya.
 *
 * `origen` es texto libre a propósito: lo que hace falta el día que AWS
 * pregunta no es un enum, es la frase que explica de dónde salió esa gente
 * ("los que se anotaron en el local durante 2025").
 */
export interface DeclaracionConsentimiento {
  origen: string;
}

/**
 * Importa contactos desde un CSV (email[,nombre] por línea) a una lista.
 *
 * 🔴 **Sin declaración explícita, lo importado NO puede recibir un mail.** Hasta
 * el 2-ago-2026 acá había un `tnAcceptsMkt: true` fijo: cualquier archivo que se
 * pegara en el textarea se auto-declaraba consentido y entraba a la audiencia.
 * Es por donde entra una lista comprada, y la cuenta de SES es **una sola para
 * todas las marcas** — el que la quema se lleva puestas a las demás.
 *
 * Sin declaración el contacto igual se guarda, pero apagado (`tnAcceptsMkt`
 * false ⇒ afuera de `MANDABLE`) y con `source` propio, así se sabe de qué
 * archivo salió. **Prenderlo es volver a pasarlo por acá con la declaración**:
 * no hay ningún toggle masivo, que sería este mismo agujero con otra puerta.
 *
 * ⚠️ **El `estado` no se toca nunca.** Quien se dio de baja, rebotó o se quejó
 * sigue suprimido aunque venga declarado en el archivo: esa vía es de un solo
 * sentido (`lib/contactos/importar.ts`). Lo que la declaración puede mover es el
 * consentimiento de marketing, no una baja.
 *
 * Pide `integrar` (ADMIN) y no `editar`: quien firma esto compromete la
 * reputación de envío de todas las marcas del proyecto.
 */
export async function importarCSV(
  listaId: string,
  csv: string,
  declaracion: DeclaracionConsentimiento | null,
) {
  const auth = await chequear("integrar");
  if (!auth.ok) return { ok: false as const, error: auth.error, creados: 0, total: 0 };
  const cuenta = auth.ctx.cuenta;

  const origen = (declaracion?.origen ?? "").trim().slice(0, 200);
  if (declaracion && origen.length < 3) {
    return {
      ok: false as const,
      error: "Contá de dónde salió esta lista (ej: “se anotaron en el local durante 2025”).",
      creados: 0,
      total: 0,
    };
  }
  const declarado = Boolean(declaracion);

  // Queda pegado al contacto, no en un log que nadie va a leer: es la respuesta
  // a "¿de dónde sacaste este mail?" el día que la pregunta llega.
  const consentimiento = declarado
    ? {
        origen,
        fecha: new Date().toISOString(),
        por: auth.ctx.email,
      }
    : null;

  const lineas = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let creados = 0;
  let total = 0;
  let apagados = 0;

  for (const linea of lineas) {
    const [emailRaw, ...resto] = linea.split(/[,;\t]/);
    const email = emailRaw?.trim().toLowerCase();
    if (!email || !email.includes("@") || email === "email") continue;
    total++;
    const nombre = resto.join(" ").trim() || null;
    const existe = await prisma.contacto.findUnique({
      where: { cuentaId_email: { cuentaId: cuenta.id, email } },
      select: { id: true, custom: true },
    });

    // Sin declaración, a un contacto que ya estaba no se le toca el
    // consentimiento: el archivo no dice nada nuevo sobre él.
    const update = declarado
      ? {
          nombre: nombre ?? undefined,
          tnAcceptsMkt: true,
          custom: {
            ...((existe?.custom as Record<string, unknown>) ?? {}),
            consentimiento,
          },
        }
      : { nombre: nombre ?? undefined };

    const contacto = await prisma.contacto.upsert({
      where: { cuentaId_email: { cuentaId: cuenta.id, email } },
      update,
      create: {
        cuentaId: cuenta.id,
        email,
        nombre,
        source: declarado ? "import_csv" : "import_csv_sin_declarar",
        tnAcceptsMkt: declarado,
        custom: consentimiento ? { consentimiento } : {},
      },
    });
    if (!existe) creados++;
    if (!declarado) apagados++;
    if (listaId) {
      await prisma.contactoLista.upsert({
        where: { contactoId_listaId: { contactoId: contacto.id, listaId } },
        update: {},
        create: { contactoId: contacto.id, listaId },
      });
    }
  }
  revalidatePath("/contactos");
  revalidatePath("/listas");
  return { ok: true as const, error: "", creados, total, apagados: declarado ? 0 : apagados };
}
