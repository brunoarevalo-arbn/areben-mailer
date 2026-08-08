/**
 * Detecta carritos abandonados y les encola el mail. Corre con el cron.
 *
 * ES UN POLLER Y NO UN WEBHOOK porque **Tiendanube no publica ningún evento de
 * checkout**: su lista completa no tiene nada de cart ni de checkout. El código
 * viejo intentaba registrar `checkout/created`, TN lo rechazaba, y un `catch {}`
 * vacío se comía el error — la automation de BDI quedó **activa y sorda, con 0
 * runs desde que se creó**. Ver el comentario de `TRIGGER_EVENT` en
 * `lib/tn/eventos.ts`.
 *
 * Volumen medido el 8-ago-2026 (`scripts/medir-checkouts-tn.ts`): BDI 5,6
 * carritos abandonados por día, Zattia 2,9, Stunned 1,0. El 99% / 92% / 67%
 * acepta marketing. No es un endpoint caliente.
 */
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listarAbandonados, triggerDeCheckout, type CheckoutNormalizado } from "@/lib/tn/checkouts";

export const maxDuration = 60;

/**
 * Cuán viejo puede ser un carrito para que todavía valga escribirle.
 *
 * 🔴 **Esta es una de las dos redes contra el barrido histórico.** `GET
 * /checkouts` devuelve 30 días de historia: en BDI son 163 carritos. Mandarles
 * a todos de golpe un "te olvidaste algo" de hace tres semanas es la peor forma
 * posible de estrenar el canal, y es irreversible.
 */
const VENTANA_HORAS = 24;

/**
 * Piso de la espera, cualquiera sea la que tenga configurada la automation.
 *
 * Un checkout se puede convertir en orden **dentro de las 6 horas** siguientes
 * (dato de la documentación de TN). Escribirle a los diez minutos es escribirle
 * a alguien que todavía está comprando.
 */
const MIN_ESPERA_HORAS = 1;

interface ResumenCuenta {
  marca: string;
  leidos: number;
  nuevos: number;
  sembrados: number;
  encolados: number;
  runs: number;
  sinContacto: number;
  fueraDeVentana: number;
  porCap: number;
  truncado?: boolean;
  /** En dry-run: la automation está pausada, así que esto es una simulación. */
  simulado?: boolean;
  /** Por qué esta cuenta no hizo nada. */
  motivo?: string;
  error?: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  // Con `?dry=1` lee y cuenta, pero no escribe una fila ni encola un run. Es
  // como se corre la primera vez en producción.
  const dry = url.searchParams.get("dry") === "1";

  // 🔴 **El filtro por automation activa NO va acá, y eso es deliberado.**
  //
  // Lo natural sería traer sólo las cuentas con una automation prendida, para no
  // gastar el límite de la API de TN —que se comparte con el monitor y con
  // Resorty— en tiendas que no lo usan. Pero eso abre una carrera que termina
  // en el peor resultado posible: con el filtro, una cuenta pausada nunca se
  // siembra, así que el instante en que alguien prende la automation es también
  // el instante en que el poller ve 30 días de historia **con la siembra ya
  // vencida** y le escribe a 163 personas de una.
  //
  // Sembrar es barato y se hace una sola vez. El filtro se aplica más abajo,
  // dentro de `procesarCuenta`: una cuenta **ya sembrada y sin automation
  // activa** se saltea sin tocar la API de TN, que es el ahorro que importaba.
  const cuentas = await prisma.cuenta.findMany({
    where: { tnStoreId: { not: null }, tnToken: { not: null } },
    select: { id: true, slug: true, tnStoreId: true, tnToken: true },
  });

  const resumen: ResumenCuenta[] = [];
  for (const cuenta of cuentas) {
    resumen.push(await procesarCuenta(cuenta, dry));
  }

  // El procesador de automations toma los runs cuyo `proximoAt` ya pasó. Con
  // esperas de 1 h o más casi nunca hay algo listo en el mismo instante, pero
  // pincharlo no cuesta nada y evita esperar otros 15 minutos cuando sí lo hay.
  // Con `after` para no hacer esperar a quien llamó, igual que `arrancarCola`.
  if (!dry && resumen.some((r) => r.runs > 0)) {
    after(() => pincharProcesador());
  }

  return Response.json({ dry, cuentas: resumen.length, resumen });
}

async function procesarCuenta(
  cuenta: { id: string; slug: string; tnStoreId: string | null; tnToken: string | null },
  dry: boolean,
): Promise<ResumenCuenta> {
  const r: ResumenCuenta = {
    marca: cuenta.slug,
    leidos: 0, nuevos: 0, sembrados: 0, encolados: 0, runs: 0,
    sinContacto: 0, fueraDeVentana: 0, porCap: 0,
  };

  // 🔴 LA SIEMBRA, la red principal contra el barrido histórico. "Primera
  // corrida" se **deriva** de que la cuenta no tenga filas, sin un flag que
  // alguien pueda prender por accidente ni una env que haya que acordarse de
  // sacar.
  const yaVistos = await prisma.carritoVisto.count({ where: { cuentaId: cuenta.id } });
  const sembrando = yaVistos === 0;

  const automations = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger: "CARRITO_ABANDONADO" },
    select: { id: true, esperaHoras: true, capDias: true, asunto: true, estado: true },
  });
  // Una automation sin asunto no puede mandar nada: el procesador la saltea.
  // Encolarle runs sería llenar la tabla de trabajo que nunca se hace.
  const listas = automations.filter((a) => a.asunto);
  const activas = listas.filter((a) => a.estado === "ACTIVO");

  // Una cuenta **ya sembrada y sin automation activa** no se pollea: es el
  // ahorro de API que justificaba filtrar arriba, pero aplicado donde no rompe
  // la siembra. Si todavía no está sembrada, se sigue: sembrar es lo que evita
  // que prender la automation mañana dispare 30 días de historia.
  if (activas.length === 0 && !sembrando) {
    r.motivo = listas.length
      ? "automation pausada (ya sembrada)"
      : "esta marca no tiene automation de carrito abandonado";
    return r;
  }
  if (activas.length === 0) r.simulado = true;

  // En dry-run se simula con las pausadas incluidas: la simulación existe para
  // decidir si conviene prenderlas, y con sólo las activas devolvería un
  // resumen vacío que se lee como "no hay carritos".
  const aEncolar = dry ? listas : activas;

  // El cursor sale de MAX(tnCheckoutId), derivado del estado. Guardarlo aparte
  // sería un dato que se puede desincronizar del que dice a quién ya le
  // escribimos; si la tabla se vacía, se re-lee la ventana y el UNIQUE protege.
  const tope = await prisma.carritoVisto.aggregate({
    where: { cuentaId: cuenta.id },
    _max: { tnCheckoutId: true },
  });
  const desdeId = tope._max.tnCheckoutId?.toString();

  let carritos: CheckoutNormalizado[];
  try {
    const res = await listarAbandonados(cuenta.tnStoreId!, cuenta.tnToken!, desdeId);
    carritos = res.checkouts;
    r.truncado = res.truncado || undefined;
  } catch (e) {
    // No se tira: una tienda que falla no puede dejar sin procesar a las otras.
    r.error = e instanceof Error ? e.message.slice(0, 200) : String(e);
    return r;
  }

  r.leidos = carritos.length;
  const limite = Date.now() - VENTANA_HORAS * 3600_000;

  for (const c of carritos) {
    // El listado ya viene sin los completados (medido: 244 checkouts, ninguno
    // con `completed_at`), pero si TN cambia de opinión no queremos enterarnos
    // por un mail mal mandado.
    if (c.completedAt) continue;

    const viejo = !c.creadoEnTnAt || c.creadoEnTnAt.getTime() < limite;
    const estado = sembrando
      ? "SEMBRADO"
      : viejo
        ? "DESCARTADO"
        : !c.email
          ? "SIN_CONTACTO"
          : "ENCOLADO";

    if (dry) {
      r.nuevos++;
      if (estado === "SEMBRADO") r.sembrados++;
      else if (estado === "DESCARTADO") r.fueraDeVentana++;
      else if (estado === "SIN_CONTACTO") r.sinContacto++;
      else r.encolados++;
      continue;
    }

    // Todo el carrito en una transacción: la fila de `CarritoVisto` y sus runs
    // nacen juntos o no nace ninguno. Si esto se partiera, una función que se
    // muere en el medio dejaría el carrito marcado como visto y sin mail —y el
    // UNIQUE haría que no se reintente nunca.
    try {
      const creados = await prisma.$transaction(async (tx) => {
        // 🔑 LA IDEMPOTENCIA DEL POLLER. `createMany` con `skipDuplicates`
        // devuelve cuántas filas entraron, y sólo se sigue si entró la nuestra.
        // Con esto dos crons simultáneos se reparten el trabajo sin lease: el
        // que pierde la carrera ve 0 y no hace nada.
        const { count } = await tx.carritoVisto.createMany({
          data: [{
            cuentaId: cuenta.id,
            tnCheckoutId: BigInt(c.tnCheckoutId),
            estado,
            email: c.email,
            telefono: c.telefono,
            total: c.total ?? undefined,
            abandonedUrl: c.abandonedUrl,
            creadoEnTnAt: c.creadoEnTnAt ?? undefined,
          }],
          skipDuplicates: true,
        });
        if (count === 0) return null;
        if (estado !== "ENCOLADO") return { runs: 0, estado };

        const contacto = await tx.contacto.upsert({
          where: { cuentaId_email: { cuentaId: cuenta.id, email: c.email! } },
          // ⚠️ El update NO toca `tnAcceptsMkt`. Un checkout no sube el
          // consentimiento de alguien que ya figuraba sin él: mismo criterio
          // que el webhook de TN y que `importarCSV`.
          update: {
            tnCustomerId: c.tnCustomerId ?? undefined,
            nombre: c.nombre ?? undefined,
          },
          create: {
            cuentaId: cuenta.id,
            email: c.email!,
            nombre: c.nombre,
            tnCustomerId: c.tnCustomerId,
            source: "carrito_abandonado",
            tnAcceptsMkt: c.acceptsMkt,
          },
        });

        await tx.carritoVisto.updateMany({
          where: { cuentaId: cuenta.id, tnCheckoutId: BigInt(c.tnCheckoutId) },
          data: { contactoId: contacto.id },
        });

        // El reloj se ancla al ABANDONO, no a la detección. Con el cron cada 15
        // minutos el desfase es chico, pero si el cron se cae dos horas, anclar
        // a la detección mandaría el mail dos horas tarde para todos.
        const base = c.creadoEnTnAt?.getTime() ?? Date.now();
        // El cast es porque `TriggerCarrito` es una interfaz y la columna es
        // Json: Prisma pide un tipo indexable. La forma la fija el tipo, que es
        // el que lee el procesador.
        const triggerData = triggerDeCheckout(c) as unknown as Prisma.InputJsonObject;
        let runs = 0;

        for (const a of aEncolar) {
          const espera = Math.max(a.esperaHoras, MIN_ESPERA_HORAS);
          // El cap mira al CONTACTO, no al carrito: dos carritos abandonados en
          // la misma tarde son una sola persona, y no se le escribe dos veces.
          const reciente = await tx.automationRun.findFirst({
            where: {
              automationId: a.id,
              contactoId: contacto.id,
              createdAt: { gte: new Date(Date.now() - a.capDias * 86400_000) },
            },
            select: { id: true },
          });
          if (reciente) continue;

          await tx.automationRun.create({
            data: {
              automationId: a.id,
              contactoId: contacto.id,
              proximoAt: new Date(base + espera * 3600_000),
              triggerData: { ...triggerData },
            },
          });
          runs++;
        }

        // Si el cap se llevó todos los runs, el carrito no está encolado: está
        // descartado por cap. Decirlo cambia lo que muestra el panel.
        if (runs === 0) {
          await tx.carritoVisto.updateMany({
            where: { cuentaId: cuenta.id, tnCheckoutId: BigInt(c.tnCheckoutId) },
            data: { estado: "DESCARTADO" },
          });
        }
        return { runs, estado };
      });

      if (!creados) continue; // otra corrida se lo llevó
      r.nuevos++;
      if (creados.estado === "SEMBRADO") r.sembrados++;
      else if (creados.estado === "DESCARTADO") r.fueraDeVentana++;
      else if (creados.estado === "SIN_CONTACTO") r.sinContacto++;
      else if (creados.runs === 0) r.porCap++;
      else { r.encolados++; r.runs += creados.runs; }
    } catch (e) {
      console.error(`carritos/detectar ${cuenta.slug} checkout ${c.tnCheckoutId}:`, e);
    }
  }

  return r;
}

/** Le avisa al procesador de automations que hay runs nuevos. */
async function pincharProcesador() {
  const appUrl = process.env.APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!appUrl || !secret) return;
  try {
    await fetch(`${appUrl}/api/automations/procesar?secret=${encodeURIComponent(secret)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(70_000),
    });
  } catch (e) {
    // El cron de 15 minutos los va a tomar igual. Esto sólo acelera.
    console.error("carritos/detectar: no se pudo pinchar el procesador:", e);
  }
}
