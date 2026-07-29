import { prisma } from "@/lib/prisma";
import { renderEmailHtml, renderEmailTexto, aplicarMergeTags, type ProductoEmail } from "@/lib/email/render";
import { leerContenido } from "@/lib/email/esquema";
import { resolverProductosDinamicos } from "@/lib/email/productos-dinamicos";
import { sendEmail } from "@/lib/email/enviar";
import { destinatarioPermitido } from "@/lib/email/proveedor";
import { inyectarTracking } from "@/lib/email/tracking";
import { getRemitenteEnvio } from "@/lib/remitentes";
import { tnGet } from "@/lib/tn/client";
import { marcaDe } from "@/lib/marca";

export const maxDuration = 60;
const BATCH = 30;

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  const appUrl = process.env.APP_URL ?? "";

  const runs = await prisma.automationRun.findMany({
    where: { estado: "PENDIENTE", proximoAt: { lte: new Date() } },
    take: BATCH,
    include: { automation: { include: { cuenta: true } }, contacto: true },
  });

  let enviados = 0, saltados = 0, fallidos = 0;

  for (const run of runs) {
    const { automation, contacto } = run;
    // Consentimiento + estado
    if (contacto.estado !== "ACTIVO" || !contacto.tnAcceptsMkt || automation.estado !== "ACTIVO" || !automation.asunto) {
      await prisma.automationRun.update({ where: { id: run.id }, data: { estado: "SALTADO" } });
      saltados++;
      continue;
    }

    const td = run.triggerData as {
      checkoutId?: string; abandonedUrl?: string; productos?: ProductoEmail[]; restantes?: number;
    };
    const esCarrito = automation.trigger === "CARRITO_ABANDONADO";

    // Carrito abandonado: si ya completó la compra, no enviamos.
    if (esCarrito && td.checkoutId && automation.cuenta.tnStoreId && automation.cuenta.tnToken) {
      try {
        const { data } = await tnGet<{ completed_at?: string | null }>(
          automation.cuenta.tnStoreId, automation.cuenta.tnToken, `checkouts/${td.checkoutId}`,
        );
        if (data.completed_at) {
          await prisma.automationRun.update({ where: { id: run.id }, data: { estado: "SALTADO" } });
          saltados++;
          continue;
        }
      } catch { /* si no se puede verificar, seguimos con el envío */ }
    }

    const contenido = leerContenido(automation.contenido);
    let bloques = [...(contenido?.bloques ?? [])];

    // Carrito: los productos que dejó, en el lugar del diseño donde van.
    //
    // Si la automation tiene un bloque `carrito`, se rellena AHÍ — así el autor
    // puede ponerlo entre un título "Tu carrito" y el botón, en vez de que caiga
    // siempre al final. Si no lo tiene, se appendea como antes: las 3 automations
    // que ya existen no declaran el bloque y tienen que seguir mostrando los
    // productos.
    //
    // Lo que cambia en ese caso es el DIBUJO, no la posición: antes se appendeaba
    // una grilla de tarjetas (`productos`) y ahora van las líneas de carrito. Es
    // una mejora, no una ruptura — ninguna de las tres llegó a mandar un carrito
    // real todavía, y una grilla nunca fue la forma de decir "esto dejaste".
    if (esCarrito && td.productos?.length) {
      const tieneBloque = bloques.some((b) => b.tipo === "carrito");
      if (tieneBloque) {
        bloques = bloques.map((b) =>
          b.tipo === "carrito" ? { ...b, items: td.productos!, restantes: td.restantes ?? 0 } : b,
        );
      } else {
        bloques.push({ tipo: "carrito", items: td.productos, restantes: td.restantes ?? 0 });
      }
    }

    // Productos automáticos: lo mismo que hace la cola de campañas, pero acá el
    // caché de `resolverProductosDinamicos` pesa más todavía. Este cron corre
    // cada 15 minutos sobre hasta 30 runs, y varios suelen ser de la misma
    // automation de la misma cuenta: sin caché sería una llamada a TN por run.
    //
    // ⚠️ A diferencia del `carrito`, esto NO se mete adentro de los bloques:
    // viaja por `opts` y por eso no puede terminar guardado en el documento.
    const productosDinamicos = await resolverProductosDinamicos(bloques, automation.cuenta);

    // Con el gate cerrado —o en ensayo, si este contacto no está habilitado— no
    // mandamos nada de verdad, pero dejamos correr el flujo igual: así se ve que
    // la automation dispara cuando tiene que disparar, sin molestar a nadie.
    // No se crea Envio: un mail que no salió no debe ensuciar las métricas.
    if (!destinatarioPermitido(contacto.email)) {
      await prisma.automationRun.update({ where: { id: run.id }, data: { estado: "ENVIADO", sesMessageId: "dry-run" } });
      enviados++;
      continue;
    }

    // El Envio se crea ANTES de renderizar porque su id es lo que hace medible
    // al mail: el pixel de apertura y los links de click cuelgan de él. Sin esto
    // la automation manda a ciegas y no se sabe si sirve.
    const envio = await prisma.envio.upsert({
      where: { automationRunId: run.id },
      update: {},
      create: { cuentaId: automation.cuentaId, contactoId: contacto.id, automationRunId: run.id },
    });

    const unsubUrl = `${appUrl}/baja?c=${contacto.id}`;
    const opts = {
      preheader: automation.preheader ?? undefined,
      unsubscribeUrl: unsubUrl,
      productosDinamicos,
      ...marcaDe(automation.cuenta),
    };
    // Se pasa el contenido ENTERO con los bloques pisados, no `{ bloques, tema }`.
    //
    // Enumerar los campos a mano hacía que cada cosa nueva del contenido —el tema
    // lo fue, los estilos de documento lo son— se perdiera **solo en el envío**:
    // el preview del editor la mostraba y el mail salía sin ella. Un bug que solo
    // se ve en el correo que ya se mandó.
    let html = renderEmailHtml({ ...contenido, bloques }, opts);
    html = aplicarMergeTags(html, contacto);
    if (esCarrito) html = html.replaceAll("${cart.url}", td.abandonedUrl ?? "#");
    // El tracking va al final: sobre el HTML ya resuelto, para que envuelva
    // también los links que salieron de los merge tags y del carrito.
    if (appUrl) html = inyectarTracking(html, envio.id, appUrl);
    // Parte text/plain: un mail solo-HTML es señal de spam, sobre todo en Outlook.
    let texto = aplicarMergeTags(renderEmailTexto({ ...contenido, bloques }, opts), contacto);
    if (esCarrito) texto = texto.replaceAll("${cart.url}", td.abandonedUrl ?? "#");

    const rem = await getRemitenteEnvio(automation.cuentaId);
    try {
      const res = await sendEmail({
        to: contacto.email,
        subject: automation.asunto,
        html,
        text: texto,
        unsubscribeUrl: unsubUrl,
        fromEmail: rem?.email,
        fromName: rem?.nombre,
        replyTo: rem?.responderA ?? undefined,
      });
      await prisma.$transaction([
        prisma.automationRun.update({ where: { id: run.id }, data: { estado: "ENVIADO", sesMessageId: res.messageId } }),
        prisma.envio.update({
          where: { id: envio.id },
          data: { estado: "ENVIADO", sesMessageId: res.messageId, enviadoAt: new Date() },
        }),
      ]);
      enviados++;
    } catch {
      await prisma.$transaction([
        prisma.automationRun.update({ where: { id: run.id }, data: { estado: "FALLIDO" } }),
        prisma.envio.update({ where: { id: envio.id }, data: { estado: "FALLIDO" } }),
      ]);
      fallidos++;
    }
  }

  const pendientes = await prisma.automationRun.count({ where: { estado: "PENDIENTE", proximoAt: { lte: new Date() } } });
  return Response.json({ procesados: runs.length, enviados, saltados, fallidos, pendientes });
}
