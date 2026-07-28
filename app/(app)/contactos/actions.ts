"use server";

import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
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

/** Importa contactos desde un CSV (email[,nombre] por línea) a una lista. */
export async function importarCSV(listaId: string, csv: string) {
  const cuenta = await getCuentaActiva();
  const lineas = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let creados = 0;
  let total = 0;

  for (const linea of lineas) {
    const [emailRaw, ...resto] = linea.split(/[,;\t]/);
    const email = emailRaw?.trim().toLowerCase();
    if (!email || !email.includes("@") || email === "email") continue;
    total++;
    const nombre = resto.join(" ").trim() || null;
    const existe = await prisma.contacto.findUnique({
      where: { cuentaId_email: { cuentaId: cuenta.id, email } },
      select: { id: true },
    });
    const contacto = await prisma.contacto.upsert({
      where: { cuentaId_email: { cuentaId: cuenta.id, email } },
      update: { nombre: nombre ?? undefined },
      create: { cuentaId: cuenta.id, email, nombre, source: "import_csv", tnAcceptsMkt: true },
    });
    if (!existe) creados++;
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
  return { ok: true, creados, total };
}
