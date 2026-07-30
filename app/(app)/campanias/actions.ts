"use server";

import { prisma } from "@/lib/prisma";
import { autorizar, chequear } from "@/lib/auth";
import { renderEmailHtml, renderEmailTexto, aplicarMergeTags, type ContenidoCampania } from "@/lib/email/render";
import { leerContenido } from "@/lib/email/esquema";
import { resolverProductosDinamicos } from "@/lib/email/productos-dinamicos";
import { marcaDe } from "@/lib/marca";
import { sendEmail } from "@/lib/email/enviar";
import { getRemitenteEnvio } from "@/lib/remitentes";
import { contactosElegibles, crearEnvios } from "@/lib/campanias";
import { arrancarCola } from "@/lib/email/cola";
import { after } from "next/server";
import {
  destinatarioPermitido,
  modoEnvio,
  MSG_ENVIO_BLOQUEADO,
  MSG_SIN_REMITENTE,
} from "@/lib/email/proveedor";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function crearCampania() {
  const { cuenta } = await autorizar("editar");
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
  const auth = await chequear("editar");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

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
  // El envío a la lista completa es la acción más cara de la app: no se deshace
  // y una lista mal armada quema la reputación del dominio. Solo ADMIN.
  const auth = await chequear("enviar");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

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

  // Sin remitente propio no se manda, y se avisa ACÁ: llegar a `armarFrom` con
  // 5.000 envíos ya encolados sería descubrirlo cuando la campaña está en curso.
  const remitente = await getRemitenteEnvio(cuenta.id);
  if (!remitente)
    return { ok: false, error: `${cuenta.nombre}: ${MSG_SIN_REMITENTE}` };

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
    await crearEnvios(cuenta.id, id, muestra.slice(0, mitad), "A");
    await crearEnvios(cuenta.id, id, muestra.slice(mitad), "B");
    await prisma.campania.update({ where: { id }, data: { estado: "ENVIANDO" } });
    const total = await prisma.envio.count({ where: { campaniaId: id } });
    after(() => arrancarCola());
    return { ok: true, total, esTest: true, modo, omitidos };
  }

  // Envío normal (sin A/B).
  await crearEnvios(cuenta.id, id, contactos, null);
  await prisma.campania.update({ where: { id }, data: { estado: "ENVIANDO" } });
  const total = await prisma.envio.count({ where: { campaniaId: id } });
  after(() => arrancarCola());
  return { ok: true, total, modo, omitidos };
}

/** Promueve el asunto ganador al resto de la lista (holdout). Manual. */
export async function promoverGanador(id: string, ganador: "A" | "B") {
  // Manda al holdout, que es todo el resto de la lista: mismo peso que enviar.
  const auth = await chequear("enviar");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

  const campania = await prisma.campania.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!campania) return { ok: false, error: "Campaña no encontrada" };
  if (campania.abTestPct == null) return { ok: false, error: "La campaña no es A/B" };
  if (campania.abGanador) return { ok: false, error: "El ganador ya fue promovido" };
  if (ganador !== "A" && ganador !== "B") return { ok: false, error: "Ganador inválido" };
  const modo = modoEnvio();
  if (modo === "bloqueado") return { ok: false, error: MSG_ENVIO_BLOQUEADO };
  // Promover manda al holdout entero: mismo chequeo que enviar.
  if (!(await getRemitenteEnvio(cuenta.id)))
    return { ok: false, error: `${cuenta.nombre}: ${MSG_SIN_REMITENTE}` };

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

  await crearEnvios(cuenta.id, id, resto, ganador);
  await prisma.campania.update({
    where: { id },
    data: { abGanador: ganador, abResueltoAt: new Date(), estado: "ENVIANDO" },
  });
  after(() => arrancarCola());
  revalidatePath(`/campanias/${id}`);
  return { ok: true, total: resto.length };
}

export async function guardarComoPlantilla(nombre: string, contenido: ContenidoCampania) {
  const auth = await chequear("editar");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

  await prisma.plantilla.create({
    data: { cuentaId: cuenta.id, nombre: nombre || "Plantilla", contenido: contenido as object },
  });
  return { ok: true };
}

export async function enviarPrueba(id: string, emailDestino: string) {
  const auth = await chequear("probar");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { cuenta, email: emailSesion, nombre, rol } = auth.ctx;

  // 🛑 El destinatario NO se toma del cliente salvo que sea ADMIN. Aceptar
  // cualquier dirección convertía el panel en "mandá el HTML que quieras, desde
  // un dominio verificado, a quien quieras" — un canal de phishing con la
  // reputación de la marca de garantía. El ADMIN lo necesita de verdad: probar
  // en Gmail, Outlook y Yahoo es la única forma de ver cómo lo clasifica cada
  // filtro de spam.
  const destino = rol === "ADMIN" ? emailDestino : emailSesion;

  const campania = await prisma.campania.findFirst({
    where: { id, cuentaId: cuenta.id },
  });
  if (!campania) return { ok: false, error: "Campaña no encontrada" };
  if (!campania.asunto) return { ok: false, error: "Falta el asunto" };

  const contenido = leerContenido(campania.contenido);
  // Los productos automáticos se resuelven también en la prueba. Es el momento
  // donde MÁS importa: si el mail de prueba saliera sin el bloque, la conclusión
  // sería "no anda" cuando en el envío real habría salido bien.
  const productosDinamicos = await resolverProductosDinamicos(contenido.bloques, cuenta);
  const opts = {
    preheader: campania.preheader ?? undefined,
    unsubscribeUrl: `${process.env.APP_URL}/baja?token=preview`,
    productosDinamicos,
    // La prueba tiene que salir con el MISMO aspecto que el envío real: mismo
    // tema, mismo logo, mismo pie.
    ...marcaDe(cuenta),
  };
  const destinatario = { nombre: nombre ?? "", email: destino };
  const htmlFinal = aplicarMergeTags(renderEmailHtml(contenido, opts), destinatario);
  // La prueba tiene que salir igual que el envío real, parte de texto incluida:
  // si no, no sirve para juzgar cómo la va a clasificar el filtro de spam.
  const textoFinal = aplicarMergeTags(renderEmailTexto(contenido, opts), destinatario);

  const rem = await getRemitenteEnvio(cuenta.id);
  try {
    const res = await sendEmail({
      to: destino,
      subject: `[PRUEBA] ${campania.asunto}`,
      html: htmlFinal,
      text: textoFinal,
      unsubscribeUrl: `${process.env.APP_URL}/baja?token=preview`,
      fromEmail: rem?.email,
      fromName: rem?.nombre,
      replyTo: rem?.responderA ?? undefined,
    });
    return { ok: true, messageId: res.messageId, destino };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
