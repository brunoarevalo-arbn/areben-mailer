"use server";

import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { ensureEventoWebhook, TRIGGER_EVENT } from "@/lib/tn/eventos";
import { renderEmailHtml, aplicarMergeTags, type ContenidoCampania } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/enviar";
import { getRemitenteEnvio } from "@/lib/remitentes";
import { PRESETS, type Trigger } from "@/lib/automations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function crearAutomation(trigger: Trigger) {
  const cuenta = await getCuentaActiva();
  const p = PRESETS[trigger];
  const a = await prisma.automation.create({
    data: {
      cuentaId: cuenta.id,
      nombre: p.nombre,
      trigger,
      esperaHoras: p.esperaHoras,
      asunto: p.asunto,
      contenido: { bloques: p.bloques },
    },
  });
  redirect(`/automations/${a.id}`);
}

export async function guardarAutomation(input: {
  id: string;
  nombre: string;
  esperaHoras: number;
  capDias: number;
  asunto: string;
  preheader: string;
  contenido: ContenidoCampania;
}) {
  const cuenta = await getCuentaActiva();
  await prisma.automation.update({
    where: { id: input.id, cuentaId: cuenta.id },
    data: {
      nombre: input.nombre,
      esperaHoras: input.esperaHoras,
      capDias: input.capDias,
      asunto: input.asunto,
      preheader: input.preheader,
      contenido: input.contenido as object,
    },
  });
  revalidatePath(`/automations/${input.id}`);
  return { ok: true };
}

export async function toggleAutomation(id: string) {
  const cuenta = await getCuentaActiva();
  const a = await prisma.automation.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!a) return { ok: false };
  const nuevoEstado = a.estado === "ACTIVO" ? "PAUSADO" : "ACTIVO";

  if (nuevoEstado === "ACTIVO" && cuenta.tnStoreId && cuenta.tnToken) {
    const event = TRIGGER_EVENT[a.trigger];
    await ensureEventoWebhook(cuenta.tnStoreId, cuenta.tnToken, process.env.APP_URL ?? "", event).catch(() => {});
  }

  await prisma.automation.update({ where: { id }, data: { estado: nuevoEstado } });
  revalidatePath("/automations");
  revalidatePath(`/automations/${id}`);
  return { ok: true, estado: nuevoEstado };
}

export async function enviarPruebaAutomation(id: string, email: string) {
  const cuenta = await getCuentaActiva();
  const a = await prisma.automation.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!a?.asunto) return { ok: false, error: "Falta el asunto" };
  const html = aplicarMergeTags(
    renderEmailHtml(a.contenido as unknown as ContenidoCampania, {
      preheader: a.preheader ?? undefined,
      unsubscribeUrl: `${process.env.APP_URL}/baja?token=preview`,
      nombreCuenta: cuenta.nombre,
    }),
    { nombre: "Bruno", email },
  );
  const rem = await getRemitenteEnvio(cuenta.id);
  try {
    const res = await sendEmail({
      to: email,
      subject: `[PRUEBA] ${a.asunto}`,
      html,
      fromEmail: rem?.email,
      fromName: rem?.nombre,
      replyTo: rem?.responderA ?? undefined,
    });
    return { ok: true, messageId: res.messageId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
