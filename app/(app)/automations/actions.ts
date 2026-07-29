"use server";

import { prisma } from "@/lib/prisma";
import { autorizar, chequear, getAuth } from "@/lib/auth";
import { ensureEventoWebhook, TRIGGER_EVENT } from "@/lib/tn/eventos";
import { renderEmailHtml, aplicarMergeTags, type ContenidoCampania } from "@/lib/email/render";
import { leerContenido } from "@/lib/email/esquema";
import { resolverProductosDinamicos } from "@/lib/email/productos-dinamicos";
import { marcaDe } from "@/lib/marca";
import { sendEmail } from "@/lib/email/enviar";
import { getRemitenteEnvio } from "@/lib/remitentes";
import { presetsPara, urlTiendaDe, type Trigger } from "@/lib/automations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function crearAutomation(trigger: Trigger) {
  const { cuenta } = await autorizar("editar");
  const rem = await getRemitenteEnvio(cuenta.id);
  const p = presetsPara(cuenta.nombre, urlTiendaDe(cuenta, rem?.email))[trigger];
  const a = await prisma.automation.create({
    data: {
      cuentaId: cuenta.id,
      nombre: p.nombre,
      trigger,
      esperaHoras: p.esperaHoras,
      asunto: p.asunto,
      contenido: { bloques: p.bloques } as object,
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
  const auth = await chequear("editar");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

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
  // getAuth y no autorizar(): acá primero hay que saber hacia dónde va el
  // toggle, porque de eso depende qué permiso pedir. getAuth ya valida sesión y
  // cuenta, y está memoizada, así que el chequeo de abajo no cuesta otra query.
  const { cuenta } = await getAuth();
  const a = await prisma.automation.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!a) return { ok: false };
  const nuevoEstado = a.estado === "ACTIVO" ? "PAUSADO" : "ACTIVO";

  // Asimétrico a propósito. Encender registra un webhook en Tiendanube y
  // habilita mails que salen solos, para siempre, sin que nadie apriete nada:
  // eso es "enviar". Pausar es la acción segura, y ante un problema ("el link
  // del carrito está mal") conviene que un editor pueda frenarla sin esperar a
  // que aparezca un admin.
  const auth = await chequear(nuevoEstado === "ACTIVO" ? "enviar" : "editar");
  if (!auth.ok) return { ok: false, error: auth.error };

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
  const auth = await chequear("probar");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { cuenta, email: emailSesion, nombre, rol } = auth.ctx;

  // Mismo criterio que enviarPrueba de campañas: el destinatario sale de la
  // sesión, no del cliente, salvo que sea ADMIN.
  const destino = rol === "ADMIN" ? email : emailSesion;

  const a = await prisma.automation.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!a?.asunto) return { ok: false, error: "Falta el asunto" };
  const contenido = leerContenido(a.contenido);
  // Ídem campañas: la prueba resuelve los productos automáticos. El `carrito`
  // no, y está bien — en una prueba no hay carrito abandonado que mostrar.
  const productosDinamicos = await resolverProductosDinamicos(contenido.bloques, cuenta);
  const html = aplicarMergeTags(
    renderEmailHtml(contenido, {
      preheader: a.preheader ?? undefined,
      unsubscribeUrl: `${process.env.APP_URL}/baja?token=preview`,
      productosDinamicos,
      ...marcaDe(cuenta),
    }),
    { nombre: nombre ?? "", email: destino },
  );
  const rem = await getRemitenteEnvio(cuenta.id);
  try {
    const res = await sendEmail({
      to: destino,
      subject: `[PRUEBA] ${a.asunto}`,
      html,
      fromEmail: rem?.email,
      fromName: rem?.nombre,
      replyTo: rem?.responderA ?? undefined,
    });
    return { ok: true, messageId: res.messageId, destino };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
