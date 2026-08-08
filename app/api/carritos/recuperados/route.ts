/**
 * Le pregunta a Tiendanube cuáles de los carritos que encolamos terminaron en
 * compra, y los marca `RECUPERADO`. Corre con el cron.
 *
 * POR QUÉ EXISTE. `RECUPERADO` estaba en el enum desde la Tanda 1 y el plan lo
 * llama *"la única métrica que después justifica (o no) pagar por mensaje"* —
 * pero **nadie lo escribía**. Sin esto, la puerta de decisión de las dos semanas
 * (¿cuántos carritos recupera el mail?) no se puede contestar, y la casilla del
 * panel de Resorty tiene que mostrar "—" en vez de un número.
 *
 * 🔑 **`RECUPERADO` acá significa "terminó comprando", NO "lo recuperó el mail".**
 * La atribución se hace al LEER, cruzando contra `Envio.enviadoAt`: un carrito que
 * se compró antes de que el mail saliera tiene su run en `SALTADO` y ningún envío,
 * así que no cuenta como recuperado por nosotros. Se guarda el **hecho** y se
 * deriva la **interpretación** — al revés, un solo campo tendría que decidir la
 * atribución en el momento de escribir, y cambiar de criterio después obligaría a
 * reescribir historia que ya no se puede volver a medir.
 *
 * ⚠️ Y por eso el barrido **no mira si la automation está activa**: los carritos
 * ya encolados merecen resolverse aunque después se haya apagado el mail.
 */
import { prisma } from "@/lib/prisma";
import { estadoDeCheckout } from "@/lib/tn/checkouts";
import { cuentaViva, decidirCarrito, TOLERANCIA_FALLOS } from "@/lib/carritos";

export const maxDuration = 60;

/**
 * Hasta cuándo tiene sentido preguntar por un carrito.
 *
 * 🔴 **Primero, es de SIGNIFICADO**: una compra tres semanas después del abandono
 * no la recuperó el mail, y contarla infla justo el número del que cuelga la
 * decisión de pagarle a Meta por mensaje. Siete días es holgado contra una
 * espera de 3 h.
 *
 * 🔴 **Y además es lo que hace SEGURO leer el 404 como "compró".** Un checkout
 * que se convierte en orden desaparece de TN, así que `estadoDeCheckout` mapea
 * 404 → completado — pero un checkout **purgado** devuelve exactamente lo mismo,
 * y TN los conserva **30 días accesibles y los borra a los 90**. Con la ventana
 * en 7 días la purga no puede alcanzar a ninguno de los que consultamos; con la
 * ventana en 30 o más, la caducidad se contaría como recuperación y el número
 * mejoraría solo con el tiempo, sin que nadie compre nada.
 *
 * ⚠️ **Subir esta constante sin más rompe eso.** Si algún día hay que ampliar la
 * ventana, primero hay que distinguir el 404-por-compra del 404-por-purga (hoy
 * son indistinguibles desde la API).
 */
const VENTANA_DIAS = 7;

/**
 * Cada cuánto se le vuelve a preguntar por el MISMO carrito.
 *
 * El cron corre cada 15 minutos y esto no es urgente: para un número que se mira
 * a las dos semanas, enterarse medio día después no cambia ninguna decisión. Lo
 * que sí importa es no gastar el límite de la API de TN, que se comparte con el
 * monitor y con Resorty.
 */
const RECHEQUEO_HORAS = 12;

/** Tope de consultas por corrida. Acota la ráfaga, no la cobertura: lo que no entra va en la siguiente. */
const TOPE = 40;

interface Pendiente {
  id: string;
  cuentaId: string;
  slug: string;
  tnCheckoutId: bigint;
  tnStoreId: string;
  tnToken: string;
}

interface ResumenCuenta {
  marca: string;
  consultados: number;
  recuperados: number;
  siguenAbiertos: number;
  /** TN no contestó. No se marcan como revisados: se reintentan en la próxima corrida. */
  sinRespuesta: number;
  /** La cuenta se dejó para después por acumular fallos seguidos. */
  cortada?: boolean;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!process.env.CRON_SECRET || url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  // Con `?dry=1` dice a cuántos les preguntaría, sin preguntar ni escribir nada.
  // Es la misma puerta que el detector, y por el mismo motivo: hay que poder
  // contestar "¿cuánto trabajo hay?" sin gastar una llamada a TN.
  const dry = url.searchParams.get("dry") === "1";

  // 🔑 La ventana se mide contra `creadoEnTnAt` (cuándo lo abandonaron) y no
  // contra `createdAt` (cuándo lo vimos). Son cosas distintas: los 244 carritos
  // de la siembra se detectaron todos el mismo minuto y abarcan 30 días.
  //
  // ⚠️ `NULLS FIRST` explícito: en Postgres un `ASC` deja los NULL al final, y
  // los nunca revisados son justamente los que tienen que ir primero.
  const desde = new Date(Date.now() - VENTANA_DIAS * 86400_000);
  const limite = new Date(Date.now() - RECHEQUEO_HORAS * 3600_000);

  const pendientes = await prisma.$queryRaw<Pendiente[]>`
    SELECT v.id, v."cuentaId", c.slug, v."tnCheckoutId",
           c."tnStoreId" AS "tnStoreId", c."tnToken" AS "tnToken"
    FROM "CarritoVisto" v
    JOIN "Cuenta" c ON c.id = v."cuentaId"
    WHERE v.estado = 'ENCOLADO'
      AND v."creadoEnTnAt" >= ${desde}
      AND (v."revisadoAt" IS NULL OR v."revisadoAt" < ${limite})
      AND c."tnStoreId" IS NOT NULL AND c."tnToken" IS NOT NULL
    ORDER BY v."revisadoAt" ASC NULLS FIRST, v."creadoEnTnAt" ASC
    LIMIT ${TOPE}`;

  if (dry) {
    return Response.json({
      dry: true,
      pendientes: pendientes.length,
      tope: TOPE,
      ventanaDias: VENTANA_DIAS,
      rechequeoHoras: RECHEQUEO_HORAS,
    });
  }

  const porMarca = new Map<string, ResumenCuenta>();
  const fallosSeguidos = new Map<string, number>();

  for (const p of pendientes) {
    const r = porMarca.get(p.slug) ?? {
      marca: p.slug, consultados: 0, recuperados: 0, siguenAbiertos: 0, sinRespuesta: 0,
    };
    porMarca.set(p.slug, r);

    // La cuenta ya acumuló sus fallos: el resto de sus carritos quedan sin tocar
    // y sin `revisadoAt`, así que la próxima corrida los toma desde el principio.
    if (!cuentaViva(fallosSeguidos.get(p.cuentaId) ?? 0)) {
      r.cortada = true;
      continue;
    }

    const { estado, checkout } = await estadoDeCheckout(
      p.tnStoreId,
      p.tnToken,
      p.tnCheckoutId.toString(),
    );
    r.consultados++;

    // Todo lo que se decide vive en `decidirCarrito`; acá sólo se escribe. Las
    // tres reglas y por qué invertirlas no rompe nada están en `lib/carritos.ts`.
    const escritura = decidirCarrito(estado, checkout?.completedAt, new Date());

    if (!escritura) {
      r.sinRespuesta++;
      fallosSeguidos.set(p.cuentaId, (fallosSeguidos.get(p.cuentaId) ?? 0) + 1);
      continue;
    }
    fallosSeguidos.set(p.cuentaId, 0);

    await prisma.carritoVisto.updateMany({ where: { id: p.id }, data: escritura });
    if (escritura.estado === "RECUPERADO") r.recuperados++;
    else r.siguenAbiertos++;
  }

  const resumen = [...porMarca.values()];
  return Response.json({
    dry: false,
    pendientes: pendientes.length,
    // Si esto viene siempre pegado al tope, el barrido está atrasado y hay que
    // subir `TOPE` o bajar `RECHEQUEO_HORAS`. Se dice acá para que se vea en el
    // log del cron y no haya que salir a deducirlo.
    tope: TOPE,
    tolerancia: TOLERANCIA_FALLOS,
    resumen,
  });
}
