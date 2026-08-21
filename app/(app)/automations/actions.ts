"use server";

import { prisma } from "@/lib/prisma";
import { autorizar, chequear, getAuth } from "@/lib/auth";
import { ensureEventoWebhook, TRIGGER_EVENT } from "@/lib/tn/eventos";
import { renderEmailHtml, renderEmailTexto, aplicarMergeTags, type ContenidoCampania } from "@/lib/email/render";
import { conCarrito, muestraDePrueba, urlVueltaDePrueba } from "@/lib/email/prueba";
import { firmarResena, VIDA_MS } from "@/lib/resena-token";
import { RESORTY_URL } from "@/lib/carrito-cupon";
import { leerContenido } from "@/lib/email/esquema";
import { resolverProductosDinamicos } from "@/lib/email/productos-dinamicos";
import { marcaDe, hostDeEnvio } from "@/lib/marca";
import { sendEmail } from "@/lib/email/enviar";
import { estadoEnvioMarca, getRemitenteEnvio, motivoEnTexto } from "@/lib/remitentes";
import {
  automationDelTrigger,
  motivoNoBorrable,
  nacimientoDelMail,
  puedeCrearOtra,
  type Trigger,
} from "@/lib/automations";
import { presetDeTrigger } from "@/lib/plantillas/presets";
import { veredictoGuardado, type ResultadoGuardado } from "@/lib/documentos";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function crearAutomation(trigger: Trigger) {
  const { cuenta } = await autorizar("editar");

  // Cuántas automations admite el trigger lo dice `MAX_POR_TRIGGER`: una para
  // casi todos —el disparador manda TODAS las que matcheen, así que la segunda
  // es un segundo mail a la misma persona, y una bienvenida es una sola vez en
  // la vida del contacto— y DOS para el carrito abandonado, donde ese segundo
  // mail es la secuencia y no el accidente.
  //
  // La guarda va acá y no solo en la tarjeta de `/automations`: la página puede
  // estar desactualizada, o alguien hace doble click. Al llegar al tope redirige
  // a la que ya existe en vez de fallar, que es lo que quien apretó "Crear"
  // venía a hacer. Fue lo que duplicó la bienvenida de Zattia el 31-jul-2026:
  // entrar a la pantalla "a ver cómo era" y apretar el botón.
  const existentes = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger },
    select: { id: true, trigger: true, createdAt: true },
  });
  if (!puedeCrearOtra(existentes, trigger)) {
    const ya = automationDelTrigger(existentes, trigger);
    if (ya) redirect(`/automations/${ya.id}`);
  }

  const rem = await getRemitenteEnvio(cuenta.id);
  const p = presetDeTrigger(trigger, cuenta, rem?.email);
  // El 2º mail de una secuencia no puede nacer con el nombre y la espera del 1º:
  // serían dos filas idénticas a la misma hora.
  const nace = nacimientoDelMail(
    existentes.filter((a) => a.trigger === trigger).length + 1,
    p,
    trigger,
  );
  const a = await prisma.automation.create({
    data: {
      cuentaId: cuenta.id,
      nombre: nace.nombre,
      trigger,
      esperaHoras: nace.esperaHoras,
      asunto: p.asunto,
      // El contenido ENTERO, no `{ bloques }`: el preset ya viene con la versión
      // del esquema, los ids y la cabecera de marca puestos, y enumerar campos a
      // mano es lo que los perdía.
      contenido: p.contenido as object,
    },
  });
  redirect(`/automations/${a.id}`);
}

/**
 * Guarda el mail de una automation, **negándose si alguien lo pisó**.
 *
 * `version` es el `docVersion` que el editor leyó al abrir. Va en el WHERE del
 * `updateMany`: si en el medio otra persona guardó, no matchea ninguna fila y no
 * se escribe nada. Ver el porqué entero en `lib/documentos.ts`.
 */
export async function guardarAutomation(input: {
  id: string;
  nombre: string;
  esperaHoras: number;
  capDias: number;
  asunto: string;
  preheader: string;
  contenido: ContenidoCampania;
  version: number;
}): Promise<ResultadoGuardado> {
  const auth = await chequear("editar");
  if (!auth.ok) return { ok: false, error: auth.error ?? "Sin permiso", conflicto: false };
  const cuenta = auth.ctx.cuenta;

  // `updateMany` y no `update`: `update` tira cuando el WHERE no matchea, y acá
  // "no matcheó" es una respuesta legítima que hay que poder contestar. El
  // `cuentaId` sigue en el WHERE por lo de siempre (multi-tenant).
  const r = await prisma.automation.updateMany({
    where: { id: input.id, cuentaId: cuenta.id, docVersion: input.version },
    data: {
      nombre: input.nombre,
      esperaHoras: input.esperaHoras,
      capDias: input.capDias,
      asunto: input.asunto,
      preheader: input.preheader,
      contenido: input.contenido as object,
      docVersion: { increment: 1 },
    },
  });
  if (r.count === 0) {
    const existe = await prisma.automation.findFirst({
      where: { id: input.id, cuentaId: cuenta.id },
      select: { id: true },
    });
    return veredictoGuardado(0, Boolean(existe), input.version);
  }
  revalidatePath(`/automations/${input.id}`);
  return veredictoGuardado(r.count, true, input.version + 1);
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
  if (nuevoEstado === "ACTIVO") {
    const marcaLista = await estadoEnvioMarca(cuenta.id);
    if (!marcaLista.ok)
      return { ok: false, error: `${cuenta.nombre}: ${motivoEnTexto(marcaLista)}` };
  }

  // ⚠️ `event` puede no existir: `NUEVO_SUSCRIPTOR` no sale de ningún evento de
  // Tiendanube —lo encola quien captura el lead— y sin la guarda esto le pediría
  // a TN un webhook con `event: undefined`. Es la contracara de que ese trigger
  // sea *incapaz* de dispararse desde el webhook: tampoco tiene que darlo de
  // alta.
  const event = TRIGGER_EVENT[a.trigger];
  let avisoWebhook: string | undefined;
  if (nuevoEstado === "ACTIVO" && event && cuenta.tnStoreId && cuenta.tnToken) {
    const r = await ensureEventoWebhook(
      cuenta.tnStoreId,
      cuenta.tnToken,
      process.env.APP_URL ?? "",
      event,
    );
    // 🔴 Antes esto era un `.catch(() => {})`. Ese silencio dejó a la automation
    // de carrito abandonado de BDI **activa y sorda durante semanas**, con 0
    // runs, porque el evento que pedía no existe en la API de TN. Ahora el
    // motivo sube a la pantalla.
    //
    // Se avisa pero **no se frena el toggle**: hay triggers que además se
    // disparan por otros caminos (un lead de pop-up encola runs sin pasar por
    // Tiendanube), así que dejar la automation apagada por un webhook que falló
    // rompería el camino que sí funciona.
    if (!r.ok) avisoWebhook = r.motivo;
  }

  await prisma.automation.update({ where: { id }, data: { estado: nuevoEstado } });
  revalidatePath("/automations");
  revalidatePath(`/automations/${id}`);
  return { ok: true, estado: nuevoEstado, aviso: avisoWebhook };
}

/**
 * Borra una automation que nunca mandó nada.
 *
 * Las guardas son las de `motivoNoBorrable` —las mismas tres que ya tenía
 * `scripts/borrar-automation.ts`, ahora compartidas— y se chequean **acá**, en
 * el servidor: la lista puede estar cacheada y el botón puede llegar de un doble
 * click. Devuelve `{ok,error}` porque en producción Next redacta los mensajes de
 * las excepciones y el motivo es justamente lo que hay que leer.
 */
export async function eliminarAutomation(id: string) {
  const auth = await chequear("editar");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

  const a = await prisma.automation.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!a) return { ok: false, error: "No se encontró la automation" };

  const [runs, envios] = await Promise.all([
    prisma.automationRun.count({ where: { automationId: id } }),
    prisma.envio.count({ where: { automationRun: { automationId: id } } }),
  ]);
  const motivo = motivoNoBorrable(a, runs, envios);
  if (motivo) return { ok: false, error: motivo };

  // El `cuentaId` va en el WHERE igual que en el `findFirst`: entre los dos pasa
  // el tiempo de dos queries, y el borrado es lo que no se deshace.
  await prisma.automation.deleteMany({ where: { id, cuentaId: cuenta.id } });
  revalidatePath("/automations");
  return { ok: true };
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
  // Ídem campañas: la prueba resuelve los productos automáticos.
  const productosDinamicos = await resolverProductosDinamicos(contenido.bloques, cuenta);

  // La prueba tiene que colgar del mismo dominio que el envío real: si no, se
  // estaría juzgando un mail con otros links que el que va a salir.
  const hostPrueba = hostDeEnvio(cuenta, process.env.APP_URL ?? "");
  const unsubscribeUrl = `${hostPrueba}/baja?token=preview`;
  const opts = {
    preheader: a.preheader ?? undefined,
    unsubscribeUrl,
    productosDinamicos,
    ...marcaDe(cuenta, process.env.APP_URL ?? ""),
  };

  // 🔴 **`${cart.url}` se reemplaza también en la prueba.** Sin esto la prueba del
  // carrito abandonado llegaba con el literal `${cart.url}` en el `href` del
  // botón —medido el 21-ago-2026—: un botón que no lleva a ningún lado, en el
  // único mail que existe para juzgar cómo va a quedar. Mismo orden de destinos
  // que el procesador; acá no hay carrito, así que va la tienda.
  //
  // Va acá arriba porque es también el destino de las LÍNEAS de la muestra: sin
  // ficha real que ofrecer, un producto de ejemplo tiene que llevar a la tienda y
  // no a `"#"`.
  const urlVuelta = urlVueltaDePrueba(opts.urlCuenta);

  // 🔴 **Y el `carrito` TAMBIÉN, con la muestra.** Hasta el 21-ago-2026 acá decía
  // «en una prueba no hay carrito abandonado que mostrar», y era cierto cuando el
  // bloque sólo dibujaba eso. Dejó de serlo: el **pedido de reseña** usa el mismo
  // bloque, y ahí adentro viven las estrellas — o sea que la prueba llegaba sin
  // lo único concreto que ese mail tiene, y sin la parte que hay que mirar en
  // Gmail y en Outlook. Un `carrito` sin items no se dibuja, así que no salía
  // nada y no había ningún error: el mail parecía terminado.
  //
  // 🔑 Se rellena el bloque **acá y no con `muestraCarrito`** porque la prueba
  // tiene que recorrer el MISMO camino que el envío real (el procesador también
  // le mete los items al bloque). Con la opción del renderer, la prueba probaría
  // una rama que ningún envío usa.
  const items =
    a.trigger === "RESENA"
      ? muestraDePrueba(urlVuelta, (productoId, producto, rating) => {
          const t = firmarResena({
            cuentaId: cuenta.id,
            // Una orden que no existe y que se ve que es de prueba. Si alguien
            // llega a publicar desde acá, queda `pendiente` y se rechaza en un
            // click, como cualquier otra.
            orderId: `PRUEBA-${a.id}`,
            productoId,
            producto,
            email: destino,
            nombre: nombre ?? "",
            rating,
            exp: Date.now() + VIDA_MS,
          });
          return t && `${RESORTY_URL}/opinar/${t}`;
        })
      : a.trigger === "CARRITO_ABANDONADO"
        ? muestraDePrueba(urlVuelta)
        : [];
  const bloques = conCarrito(contenido.bloques, items);

  const destinatario = { nombre: nombre ?? "", email: destino };
  const doc = { ...contenido, bloques };
  const html = aplicarMergeTags(renderEmailHtml(doc, opts), destinatario).replaceAll(
    "${cart.url}",
    urlVuelta,
  );
  // Ídem la prueba de campañas: la parte text/plain y el header
  // `List-Unsubscribe` no son cosméticos, son dos de las señales que mira el
  // filtro. Sin ellos la prueba salía MEJOR clasificada como spam que el envío
  // real, así que no servía para juzgar nada — que es justamente para lo que
  // existe. Lo pagó la primera prueba de la bienvenida de Zattia (31-jul-2026):
  // cayó en "no deseado" mandando desde un dominio con DKIM, SPF alineado y
  // DMARC en orden.
  const texto = aplicarMergeTags(renderEmailTexto(doc, opts), destinatario).replaceAll(
    "${cart.url}",
    urlVuelta,
  );
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
