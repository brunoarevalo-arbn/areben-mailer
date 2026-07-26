"use server";

import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { renderEmailHtml, aplicarMergeTags, type ContenidoCampania } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/enviar";
import { getRemitenteEnvio } from "@/lib/remitentes";
import { contactosElegibles, crearEnvios } from "@/lib/campanias";
import { arrancarCola } from "@/lib/email/cola";
import { destinatarioPermitido, modoEnvio, MSG_ENVIO_BLOQUEADO } from "@/lib/email/proveedor";
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
  /** "lista:<id>" | "seg:<id>" | "" */
  destino: string;
  contenido: ContenidoCampania;
  /** A/B de asunto: asuntoB vacío o abTestPct null = sin A/B. */
  asuntoB?: string;
  abTestPct?: number | null;
}

function parseDestino(destino: string): { listaId: string | null; segmentoId: string | null } {
  if (destino.startsWith("lista:")) return { listaId: destino.slice(6), segmentoId: null };
  if (destino.startsWith("seg:")) return { listaId: null, segmentoId: destino.slice(4) };
  return { listaId: null, segmentoId: null };
}

export async function guardarCampania(input: GuardarInput) {
  const cuenta = await getCuentaActiva();
  const { listaId, segmentoId } = parseDestino(input.destino);
  const asuntoB = input.asuntoB?.trim() || null;
  // Solo hay A/B si hay asuntoB y un porcentaje válido.
  const abTestPct = asuntoB && input.abTestPct ? input.abTestPct : null;
  await prisma.campania.update({
    where: { id: input.id, cuentaId: cuenta.id },
    data: {
      nombre: input.nombre,
      asunto: input.asunto,
      preheader: input.preheader,
      listaId,
      segmentoId,
      contenido: input.contenido as object,
      asuntoB: abTestPct ? asuntoB : null,
      abTestPct,
    },
  });
  revalidatePath(`/campanias/${input.id}`);
  return { ok: true };
}

/** Fisher-Yates in-place. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Encola una campaña: crea los Envío para los contactos elegibles y la pone ENVIANDO. */
export async function enviarCampania(id: string) {
  const cuenta = await getCuentaActiva();
  const campania = await prisma.campania.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!campania) return { ok: false, error: "Campaña no encontrada" };
  if (!campania.asunto) return { ok: false, error: "Falta el asunto" };
  if (!campania.listaId && !campania.segmentoId) return { ok: false, error: "Falta el destino (lista o segmento)" };
  if (campania.estado === "ENVIANDO" || campania.estado === "ENVIADA")
    return { ok: false, error: "La campaña ya fue enviada" };

  // Guard: mientras el proveedor no esté aprobado para producción no dejamos
  // enviar a la lista real (los destinos no verificados rebotarían en masa).
  const modo = modoEnvio();
  if (modo === "bloqueado")
    return { ok: false, error: `${MSG_ENVIO_BLOQUEADO} Mientras tanto usá "Enviar prueba".` };

  const esAB = campania.abTestPct != null;
  if (esAB && !campania.asuntoB) return { ok: false, error: "Falta el asunto B" };

  const todos = await contactosElegibles(cuenta.id, campania);
  if (todos === null) return { ok: false, error: "Segmento no encontrado" };
  if (todos.length === 0) return { ok: false, error: "No hay contactos elegibles" };

  // En ensayo recortamos acá para no crear miles de Envío que nacen condenados.
  // El corte que de verdad protege está en procesarLote, pegado al envío.
  const contactos = modo === "ensayo" ? todos.filter((c) => destinatarioPermitido(c.email)) : todos;
  const omitidos = todos.length - contactos.length;
  if (contactos.length === 0)
    return {
      ok: false,
      error: `Modo ensayo: ninguno de los ${todos.length} contactos elegibles está en ENVIO_ENSAYO.`,
    };

  if (esAB) {
    // Test A/B: mandar A y B a una muestra; el resto espera al ganador.
    const pct = campania.abTestPct!;
    // Muestra total (mín. 2 para que haya al menos 1 por variante), sin pasar el total.
    const testTotal = Math.min(contactos.length, Math.max(2, Math.floor((contactos.length * pct) / 100)));
    const muestra = shuffle([...contactos]).slice(0, testTotal);
    const mitad = Math.ceil(muestra.length / 2);
    await crearEnvios(id, muestra.slice(0, mitad), "A");
    await crearEnvios(id, muestra.slice(mitad), "B");
    await prisma.campania.update({ where: { id }, data: { estado: "ENVIANDO" } });
    const total = await prisma.envio.count({ where: { campaniaId: id } });
    arrancarCola();
    return { ok: true, total, esTest: true, modo, omitidos };
  }

  // Envío normal (sin A/B).
  await crearEnvios(id, contactos, null);
  await prisma.campania.update({ where: { id }, data: { estado: "ENVIANDO" } });
  const total = await prisma.envio.count({ where: { campaniaId: id } });
  arrancarCola();
  return { ok: true, total, modo, omitidos };
}

/** Promueve el asunto ganador al resto de la lista (holdout). Manual. */
export async function promoverGanador(id: string, ganador: "A" | "B") {
  const cuenta = await getCuentaActiva();
  const campania = await prisma.campania.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!campania) return { ok: false, error: "Campaña no encontrada" };
  if (campania.abTestPct == null) return { ok: false, error: "La campaña no es A/B" };
  if (campania.abGanador) return { ok: false, error: "El ganador ya fue promovido" };
  if (ganador !== "A" && ganador !== "B") return { ok: false, error: "Ganador inválido" };
  const modo = modoEnvio();
  if (modo === "bloqueado") return { ok: false, error: MSG_ENVIO_BLOQUEADO };

  const todos = await contactosElegibles(cuenta.id, campania);
  if (todos === null) return { ok: false, error: "Segmento no encontrado" };
  const contactos = modo === "ensayo" ? todos.filter((c) => destinatarioPermitido(c.email)) : todos;

  // Excluir a los que ya recibieron el test.
  const yaEnviados = await prisma.envio.findMany({
    where: { campaniaId: id },
    select: { contactoId: true },
  });
  const testSet = new Set(yaEnviados.map((e) => e.contactoId));
  const resto = contactos.filter((c) => !testSet.has(c.id));

  await crearEnvios(id, resto, ganador);
  await prisma.campania.update({
    where: { id },
    data: { abGanador: ganador, abResueltoAt: new Date(), estado: "ENVIANDO" },
  });
  arrancarCola();
  revalidatePath(`/campanias/${id}`);
  return { ok: true, total: resto.length };
}

export async function guardarComoPlantilla(nombre: string, contenido: ContenidoCampania) {
  const cuenta = await getCuentaActiva();
  await prisma.plantilla.create({
    data: { cuentaId: cuenta.id, nombre: nombre || "Plantilla", contenido: contenido as object },
  });
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

  const rem = await getRemitenteEnvio(cuenta.id);
  try {
    const res = await sendEmail({
      to: emailDestino,
      subject: `[PRUEBA] ${campania.asunto}`,
      html: htmlFinal,
      unsubscribeUrl: `${process.env.APP_URL}/baja?token=preview`,
      fromEmail: rem?.email,
      fromName: rem?.nombre,
      replyTo: rem?.responderA ?? undefined,
    });
    return { ok: true, messageId: res.messageId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
