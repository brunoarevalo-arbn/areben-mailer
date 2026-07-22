"use server";

import { prisma } from "@/lib/prisma";

export type SuscribirState = { ok: boolean; error?: string } | undefined;

// Single opt-in: al enviar, el contacto queda suscripto al instante (sin email
// de confirmación). Público (sin sesión) — /f/ está en los PUBLIC_PREFIXES del proxy.
export async function suscribir(
  slug: string,
  _prev: SuscribirState,
  formData: FormData
): Promise<SuscribirState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const nombre = String(formData.get("nombre") ?? "").trim() || null;

  if (!email || !email.includes("@") || email.length > 200) {
    return { ok: false, error: "Ingresá un email válido." };
  }

  const form = await prisma.formulario.findFirst({
    where: { slug, activo: true },
    select: { id: true, cuentaId: true, listaId: true, pedirNombre: true },
  });
  if (!form) return { ok: false, error: "Este formulario no está disponible." };

  const contacto = await prisma.contacto.upsert({
    where: { cuentaId_email: { cuentaId: form.cuentaId, email } },
    update: {
      nombre: form.pedirNombre && nombre ? nombre : undefined,
      tnAcceptsMkt: true,
      estado: "ACTIVO",
    },
    create: {
      cuentaId: form.cuentaId,
      email,
      nombre: form.pedirNombre ? nombre : null,
      source: `formulario:${slug}`,
      tnAcceptsMkt: true,
      estado: "ACTIVO",
    },
  });

  if (form.listaId) {
    await prisma.contactoLista.upsert({
      where: { contactoId_listaId: { contactoId: contacto.id, listaId: form.listaId } },
      update: {},
      create: { contactoId: contacto.id, listaId: form.listaId },
    });
  }

  await prisma.formulario.update({
    where: { id: form.id },
    data: { submits: { increment: 1 } },
  });

  return { ok: true };
}
