"use server";

import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { renderEmailHtml, aplicarMergeTags, type ContenidoCampania } from "@/lib/email/render";
import { sendEmail } from "@/lib/ses/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function crearCampania() {
  const cuenta = await getCuentaActiva();
  const campania = await prisma.campania.create({
    data: {
      cuentaId: cuenta.id,
      nombre: "Campaña sin título",
      contenido: { bloques: [{ tipo: "titulo", texto: "Hola 👋" }] },
    },
  });
  redirect(`/campanias/${campania.id}`);
}

export interface GuardarInput {
  id: string;
  nombre: string;
  asunto: string;
  preheader: string;
  listaId: string | null;
  contenido: ContenidoCampania;
}

export async function guardarCampania(input: GuardarInput) {
  const cuenta = await getCuentaActiva();
  await prisma.campania.update({
    where: { id: input.id, cuentaId: cuenta.id },
    data: {
      nombre: input.nombre,
      asunto: input.asunto,
      preheader: input.preheader,
      listaId: input.listaId,
      contenido: input.contenido as object,
    },
  });
  revalidatePath(`/campanias/${input.id}`);
  return { ok: true };
}

export async function enviarPrueba(id: string, emailDestino: string) {
  const cuenta = await getCuentaActiva();
  const campania = await prisma.campania.findFirst({
    where: { id, cuentaId: cuenta.id },
  });
  if (!campania) return { ok: false, error: "Campaña no encontrada" };
  if (!campania.asunto) return { ok: false, error: "Falta el asunto" };

  const html = renderEmailHtml(campania.contenido as unknown as ContenidoCampania, {
    preheader: campania.preheader ?? undefined,
    unsubscribeUrl: `${process.env.APP_URL}/baja?token=preview`,
    nombreCuenta: cuenta.nombre,
  });
  const htmlFinal = aplicarMergeTags(html, { nombre: "Bruno", email: emailDestino });

  try {
    const res = await sendEmail({
      to: emailDestino,
      subject: `[PRUEBA] ${campania.asunto}`,
      html: htmlFinal,
      unsubscribeUrl: `${process.env.APP_URL}/baja?token=preview`,
    });
    return { ok: true, messageId: res.messageId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
