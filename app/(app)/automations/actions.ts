"use server";

import { prisma } from "@/lib/prisma";
import { autorizar, chequear, getAuth } from "@/lib/auth";
import { ensureEventoWebhook, TRIGGER_EVENT } from "@/lib/tn/eventos";
import { renderEmailHtml, renderEmailTexto, aplicarMergeTags, type ContenidoCampania } from "@/lib/email/render";
import { leerContenido } from "@/lib/email/esquema";
import { resolverProductosDinamicos } from "@/lib/email/productos-dinamicos";
import { marcaDe } from "@/lib/marca";
import { sendEmail } from "@/lib/email/enviar";
import { MSG_SIN_REMITENTE } from "@/lib/email/proveedor";
import { getRemitenteEnvio } from "@/lib/remitentes";
import { type Trigger } from "@/lib/automations";
import { presetDeTrigger } from "@/lib/plantillas/presets";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function crearAutomation(trigger: Trigger) {
  const { cuenta } = await autorizar("editar");
  const rem = await getRemitenteEnvio(cuenta.id);
  const p = presetDeTrigger(trigger, cuenta, rem?.email);
  const a = await prisma.automation.create({
    data: {
      cuentaId: cuenta.id,
      nombre: p.nombre,
      trigger,
      esperaHoras: p.esperaHoras,
      asunto: p.asunto,
      // El contenido ENTERO, no `{ bloques }`: el preset ya viene con la versión
      // del esquema, los ids y la cabecera de marca puestos, y enumerar campos a
      // mano es lo que los perdía.
      contenido: p.contenido as object,
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

  // Encender sin remitente dejaría la automation disparando runs que el cron no
  // puede mandar: se acumularían PENDIENTE hasta que alguien mire. Pausar nunca
  // se frena — la acción segura no se bloquea por un dato que falta.
  if (nuevoEstado === "ACTIVO" && !(await getRemitenteEnvio(cuenta.id)))
    return { ok: false, error: `${cuenta.nombre}: ${MSG_SIN_REMITENTE}` };

  // ⚠️ `event` puede no existir: `NUEVO_SUSCRIPTOR` no sale de ningún evento de
  // Tiendanube —lo encola quien captura el lead— y sin la guarda esto le pediría
  // a TN un webhook con `event: undefined`. Es la contracara de que ese trigger
  // sea *incapaz* de dispararse desde el webhook: tampoco tiene que darlo de
  // alta.
  const event = TRIGGER_EVENT[a.trigger];
  if (nuevoEstado === "ACTIVO" && event && cuenta.tnStoreId && cuenta.tnToken) {
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
  const unsubscribeUrl = `${process.env.APP_URL}/baja?token=preview`;
  const opts = {
    preheader: a.preheader ?? undefined,
    unsubscribeUrl,
    productosDinamicos,
    ...marcaDe(cuenta),
  };
  const destinatario = { nombre: nombre ?? "", email: destino };
  const html = aplicarMergeTags(renderEmailHtml(contenido, opts), destinatario);
  // Ídem la prueba de campañas: la parte text/plain y el header
  // `List-Unsubscribe` no son cosméticos, son dos de las señales que mira el
  // filtro. Sin ellos la prueba salía MEJOR clasificada como spam que el envío
  // real, así que no servía para juzgar nada — que es justamente para lo que
  // existe. Lo pagó la primera prueba de la bienvenida de Zattia (31-jul-2026):
  // cayó en "no deseado" mandando desde un dominio con DKIM, SPF alineado y
  // DMARC en orden.
  const texto = aplicarMergeTags(renderEmailTexto(contenido, opts), destinatario);
  const rem = await getRemitenteEnvio(cuenta.id);
  try {
    const res = await sendEmail({
      to: destino,
      subject: `[PRUEBA] ${a.asunto}`,
      html,
      text: texto,
      unsubscribeUrl,
      fromEmail: rem?.email,
      fromName: rem?.nombre,
      replyTo: rem?.responderA ?? undefined,
    });
    return { ok: true, messageId: res.messageId, destino };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
