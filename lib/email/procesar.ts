import { prisma } from "@/lib/prisma";
import { renderEmailHtml, renderEmailTexto, aplicarMergeTags } from "@/lib/email/render";
import { leerContenido } from "./esquema";
import { resolverProductosDinamicos } from "./productos-dinamicos";
import { marcaDe, hostDeEnvio } from "@/lib/marca";
import { inyectarTracking } from "@/lib/email/tracking";
import { sendEmail, esThrottle } from "@/lib/email/enviar";
import { destinatarioPermitido, modoEnvio, MSG_SIN_REMITENTE } from "@/lib/email/proveedor";
import { getRemitenteEnvio } from "@/lib/remitentes";

const BATCH = 20;

export interface ResultadoLote {
  enviados: number;
  fallidos: number;
  restantes: number;
  throttled: boolean;
  /**
   * Motivo por el que el lote no pudo ni empezar. Distinto de `throttled`: acá
   * no hay nada que esperar, hace falta que una persona arregle algo. Los
   * envíos quedan ENCOLADO y salen solos cuando se arregla.
   */
  bloqueado?: string;
}

/**
 * Manda un lote de los envíos ENCOLADO de una campaña y persiste el `sesMessageId`
 * de cada uno — la única llave que después casa el rebote/queja con el envío.
 *
 * Devuelve null si la campaña no existe (el 404 lo decide el llamador).
 */
export async function procesarLote(campaniaId: string): Promise<ResultadoLote | null> {
  const campania = await prisma.campania.findUnique({
    where: { id: campaniaId },
    include: { cuenta: true },
  });
  if (!campania) return null;

  // 🔴 Los links del MAIL cuelgan del dominio de la marca; el resto de la app
  // sigue en `APP_URL`. No son la misma cosa: `arrancarCola` (el fetch del
  // servidor a sí mismo) y la URL que se le registra a Tiendanube tienen que
  // seguir apuntando al dominio del proyecto o se rompen el motor y el webhook.
  const appUrl = hostDeEnvio(campania.cuenta, process.env.APP_URL ?? "");
  const contenido = leerContenido(campania.contenido);

  // Sin remitente propio la marca no manda (ver `armarFrom`). Se corta ACÁ,
  // antes del loop, y NO se marca nada FALLIDO: `FALLIDO` es terminal y sin
  // reintento, así que quemaría a los 500 de un tramo por un dato que se carga
  // en diez segundos. Todo queda ENCOLADO y el cron los manda solo cuando el
  // remitente exista.
  const rem = await getRemitenteEnvio(campania.cuentaId);
  if (!rem) {
    console.log(JSON.stringify({ ev: "lote-bloqueado", motivo: "sin-remitente", campaniaId }));
    const restantes = await prisma.envio.count({ where: { campaniaId, estado: "ENCOLADO" } });
    return { enviados: 0, fallidos: 0, restantes, throttled: false, bloqueado: MSG_SIN_REMITENTE };
  }

  // Los productos automáticos se resuelven ACÁ, **antes** del loop: una vez por
  // lote de 20 y no una vez por destinatario. Adentro del loop, los 16.800
  // contactos de BDI serían 16.800 llamadas a la API de Tiendanube, contra un
  // límite que se comparte con el monitor y con Resorty.
  const productosDinamicos = await resolverProductosDinamicos(contenido.bloques, campania.cuenta);

  const envios = await prisma.envio.findMany({
    where: { campaniaId, estado: "ENCOLADO" },
    take: BATCH,
    include: { contacto: true },
  });

  let enviados = 0;
  let fallidos = 0;
  let throttled = false;

  for (const envio of envios) {
    // Red de seguridad del modo ensayo. Va acá, pegado al envío, y no solo al
    // encolar: si un `Envio` llegó hasta este punto apuntando a alguien que no
    // está habilitado, se corta acá. Queda FALLIDO (que es la verdad: no se
    // mandó) y con estado terminal, para que la cola no gire para siempre
    // esperando que baje `restantes`.
    if (!destinatarioPermitido(envio.contacto.email)) {
      console.log(
        JSON.stringify({
          ev: "envio-bloqueado",
          modo: modoEnvio(),
          envioId: envio.id,
          campaniaId,
        }),
      );
      await prisma.envio.update({ where: { id: envio.id }, data: { estado: "FALLIDO" } });
      fallidos++;
      continue;
    }

    const unsubUrl = `${appUrl}/baja?e=${envio.id}`;
    const opts = {
      preheader: campania.preheader ?? undefined,
      unsubscribeUrl: unsubUrl,
      productosDinamicos,
      // Los iconos de `redes` salen del mismo host que los links, no de una
      // constante: un mail de Zattia trae sus iconos de links.zattia.com.ar.
      assetsBase: appUrl,
      ...marcaDe(campania.cuenta),
    };
    let html = renderEmailHtml(contenido, opts);
    html = aplicarMergeTags(html, envio.contacto);
    html = inyectarTracking(html, envio.id, appUrl);
    // Parte text/plain: un mail solo-HTML es señal de spam, sobre todo en Outlook.
    const texto = aplicarMergeTags(renderEmailTexto(contenido, opts), envio.contacto);

    const asuntoEnvio =
      envio.variante === "B" ? campania.asuntoB ?? campania.asunto! : campania.asunto!;
    try {
      const res = await sendEmail({
        to: envio.contacto.email,
        subject: asuntoEnvio,
        html,
        text: texto,
        unsubscribeUrl: unsubUrl,
        fromEmail: rem.email,
        fromName: rem.nombre,
        replyTo: rem.responderA ?? undefined,
      });
      await prisma.envio.update({
        where: { id: envio.id },
        data: { estado: "ENVIADO", sesMessageId: res.messageId, enviadoAt: new Date() },
      });
      enviados++;
    } catch (e) {
      if (esThrottle(e)) {
        // rate limit: dejamos el envío ENCOLADO para el próximo lote
        throttled = true;
        break;
      }
      await prisma.envio.update({ where: { id: envio.id }, data: { estado: "FALLIDO" } });
      fallidos++;
    }
  }

  const restantes = await prisma.envio.count({ where: { campaniaId, estado: "ENCOLADO" } });
  if (restantes === 0 && !throttled) {
    // En A/B, tras enviar el test la campaña queda ENVIANDO esperando que se
    // promueva el ganador — no se marca ENVIADA hasta que se manda el resto.
    const esperandoGanador = campania.abTestPct != null && campania.abGanador == null;
    if (!esperandoGanador) {
      await prisma.campania.update({
        where: { id: campaniaId },
        data: { estado: "ENVIADA", enviadaAt: new Date() },
      });
    }
  }

  return { enviados, fallidos, restantes, throttled };
}
