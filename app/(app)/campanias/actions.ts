"use server";

import { prisma } from "@/lib/prisma";
import { autorizar, chequear } from "@/lib/auth";
import { renderEmailHtml, renderEmailTexto, aplicarMergeTags, type ContenidoCampania } from "@/lib/email/render";
import { leerContenido } from "@/lib/email/esquema";
import { resolverProductosDinamicos } from "@/lib/email/productos-dinamicos";
import { marcaDe, hostDeEnvio } from "@/lib/marca";
import { sendEmail } from "@/lib/email/enviar";
import { estadoEnvioMarca, getRemitenteEnvio, motivoEnTexto } from "@/lib/remitentes";
import { contactosElegibles, crearEnvios } from "@/lib/campanias";
import { encolarCampania, validarEnvio, type ResultadoEncolar } from "@/lib/email/encolar";
import { instanteLocal, horaLocal } from "@/lib/fechas";
import { arrancarCola } from "@/lib/email/cola";
import { after } from "next/server";
import {
  destinatarioPermitido,
  modoEnvio,
  MSG_ENVIO_BLOQUEADO,
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

/**
 * Encola una campaña: crea los Envío para los contactos elegibles y la pone
 * ENVIANDO.
 *
 * El trabajo vive en `lib/email/encolar.ts` porque **el cron también lo hace**
 * (una campaña programada) y ahí no hay sesión. Acá queda lo único que el cron
 * no puede hacer: preguntar quién está pidiendo.
 */
export async function enviarCampania(id: string): Promise<ResultadoEncolar> {
  // El envío a la lista completa es la acción más cara de la app: no se deshace
  // y una lista mal armada quema la reputación del dominio. Solo ADMIN.
  const auth = await chequear("enviar");
  if (!auth.ok) return { ok: false, error: auth.error };
  return encolarCampania(auth.ctx.cuenta, id);
}

/**
 * Deja una campaña lista para salir sola a una hora. El envío lo dispara después
 * `encolarProgramadas()` desde el cron.
 *
 * Mismo permiso que enviar, y no uno más blando: **programar ES enviar**, solo
 * que más tarde. Un EDITOR que no puede mandar tampoco puede dejar agendado que
 * se mande.
 *
 * 🔑 Corre `validarEnvio` **ahora**, con alguien mirando la pantalla, para que un
 * remitente sin verificar o un gate cerrado no se descubran a las 19:00 con la
 * campaña sin salir.
 */
export async function programarCampania(
  id: string,
  dia: string,
  hora: string,
): Promise<{ ok: true; cuando: string; texto: string } | { ok: false; error: string }> {
  const auth = await chequear("enviar");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

  let cuando: Date;
  try {
    // ⚠️ Por acá, nunca `new Date(dia + "T" + hora)`: eso lo interpreta en la
    // zona del NAVEGADOR y la campaña saldría a otra hora desde otra máquina.
    cuando = instanteLocal(dia, hora);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (cuando.getTime() <= Date.now()) return { ok: false, error: "Esa hora ya pasó" };

  const campania = await prisma.campania.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!campania) return { ok: false, error: "Campaña no encontrada" };
  if (campania.estado === "ENVIANDO" || campania.estado === "ENVIADA")
    return { ok: false, error: "La campaña ya fue enviada" };

  const motivo = await validarEnvio(cuenta, campania);
  if (motivo) return { ok: false, error: motivo };

  await prisma.campania.update({
    where: { id, cuentaId: cuenta.id },
    data: { estado: "PROGRAMADA", programadaAt: cuando },
  });
  revalidatePath(`/campanias/${id}`);
  return { ok: true, cuando: cuando.toISOString(), texto: horaLocal(cuando) };
}

/** Desprograma una campaña: vuelve a BORRADOR y se olvida la hora. */
export async function cancelarProgramacion(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // El mismo permiso que programar, por simetría: partir un eje en dos permisos
  // distintos es una regla que después nadie recuerda.
  const auth = await chequear("enviar");
  if (!auth.ok) return { ok: false, error: auth.error };

  // El estado va en el WHERE y no en un `if` de antes: entre leer y escribir, el
  // cron puede haberla disparado, y eso no se pisa.
  const r = await prisma.campania.updateMany({
    where: { id, cuentaId: auth.ctx.cuenta.id, estado: "PROGRAMADA" },
    data: { estado: "BORRADOR", programadaAt: null },
  });
  if (r.count === 0) return { ok: false, error: "La campaña ya no estaba programada" };
  revalidatePath(`/campanias/${id}`);
  return { ok: true };
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
  const marcaLista = await estadoEnvioMarca(cuenta.id);
  if (!marcaLista.ok)
    return { ok: false, error: `${cuenta.nombre}: ${motivoEnTexto(marcaLista)}` };

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

/**
 * Borra una campaña **en borrador**. Nada más.
 *
 * Existe porque la galería creaba una campaña para cada plantilla que alguien
 * quería mirar y no había forma de sacarlas: `/campanias` se volvía una lista
 * eterna de intentos. Con la vista previa se crean muchas menos, pero las que se
 * crean tienen que poder irse.
 *
 * ⛔ **Una campaña ENVIADA no se borra, y no hay botón que lo ofrezca.** No es
 * por las métricas del home (que también): los rebotes que llegan después
 * matchean por `Envio.sesMessageId`, y esa tabla cuelga en cascada de la
 * campaña. Borrar una que ya salió apaga la supresión de contactos de ese envío
 * — con 6,7% de rebote histórico, eso es la reputación del dominio.
 *
 * El estado va en el WHERE del `deleteMany` y no en un `if` de antes, igual que
 * `eliminarLista` filtra `tipo: "MANUAL"`: entre el chequeo y el borrado hay una
 * query de por medio, y una campaña puede haber arrancado a enviarse ahí.
 */
export async function eliminarCampania(id: string) {
  const auth = await chequear("editar");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

  // Cinturón y tiradores: un BORRADOR con envíos no debería existir —solo
  // `enviarCampania` crea `Envio`, y lo primero que hace es pasar a ENVIANDO—
  // pero si existiera sería un envío en curso a medio marcar, y eso no se toca.
  const envios = await prisma.envio.count({ where: { campaniaId: id, campania: { cuentaId: cuenta.id } } });
  if (envios > 0) return { ok: false, error: "Esta campaña ya tiene envíos: no se borra." };

  const r = await prisma.campania.deleteMany({ where: { id, cuentaId: cuenta.id, estado: "BORRADOR" } });
  if (r.count === 0) return { ok: false, error: "Solo se borran las campañas en borrador." };
  revalidatePath("/campanias");
  return { ok: true };
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
  // Del dominio de la marca, igual que el envío real: la prueba existe para
  // juzgar el mail que va a salir, links incluidos.
  const hostPrueba = hostDeEnvio(cuenta, process.env.APP_URL ?? "");
  const unsubPrueba = `${hostPrueba}/baja?token=preview`;
  const opts = {
    preheader: campania.preheader ?? undefined,
    unsubscribeUrl: unsubPrueba,
    productosDinamicos,
    // La prueba tiene que salir con el MISMO aspecto que el envío real: mismo
    // tema, mismo logo, mismo pie. `assetsBase` viene adentro, del mismo
    // `hostDeEnvio` que arma `hostPrueba`.
    ...marcaDe(cuenta, process.env.APP_URL ?? ""),
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
      unsubscribeUrl: unsubPrueba,
      fromEmail: rem?.email,
      fromName: rem?.nombre,
      replyTo: rem?.responderA ?? undefined,
    });
    return { ok: true, messageId: res.messageId, destino };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
