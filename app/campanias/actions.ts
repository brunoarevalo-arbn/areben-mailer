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

/** Encola una campaña: crea los Envío para los contactos elegibles y la pone ENVIANDO. */
export async function enviarCampania(id: string) {
  const cuenta = await getCuentaActiva();
  const campania = await prisma.campania.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!campania) return { ok: false, error: "Campaña no encontrada" };
  if (!campania.asunto) return { ok: false, error: "Falta el asunto" };
  if (!campania.listaId) return { ok: false, error: "Falta la lista destino" };
  if (campania.estado === "ENVIANDO" || campania.estado === "ENVIADA")
    return { ok: false, error: "La campaña ya fue enviada" };

  // Guard: mientras SES esté en sandbox, no dejamos enviar a la lista real
  // (los destinos no verificados fallarían y perjudicarían la salida del sandbox).
  if (process.env.SES_SANDBOX !== "false")
    return { ok: false, error: "SES en sandbox: usá 'Enviar prueba'. El envío a la lista se habilita al aprobar producción." };

  // Elegibles: en la lista, activos y que aceptan marketing (consentimiento).
  const contactos = await prisma.contacto.findMany({
    where: {
      cuentaId: cuenta.id,
      estado: "ACTIVO",
      tnAcceptsMkt: true,
      listas: { some: { listaId: campania.listaId } },
    },
    select: { id: true },
  });
  if (contactos.length === 0) return { ok: false, error: "No hay contactos elegibles" };

  // Crear los envíos en lote (idempotente por campaña+contacto).
  const CHUNK = 1000;
  for (let i = 0; i < contactos.length; i += CHUNK) {
    await prisma.envio.createMany({
      data: contactos.slice(i, i + CHUNK).map((c) => ({ campaniaId: id, contactoId: c.id })),
      skipDuplicates: true,
    });
  }
  await prisma.campania.update({ where: { id }, data: { estado: "ENVIANDO" } });

  const total = await prisma.envio.count({ where: { campaniaId: id } });
  return { ok: true, total };
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
