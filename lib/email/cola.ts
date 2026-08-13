import { prisma } from "@/lib/prisma";
import { procesarLote } from "@/lib/email/procesar";

// Cola de envío del lado del servidor.
//
// Antes el navegador manejaba el envío: el editor llamaba a /procesar de a 20
// hasta terminar, así que una campaña grande exigía tener la pestaña abierta
// (~1h20m para los 16.825 de BDI) y cerrarla cortaba el envío a la mitad.
//
// Ahora el servidor se encarga. Dos cosas lo mantienen vivo:
//   1. Auto-encadenamiento: cuando una invocación se queda sin tiempo, dispara
//      la siguiente. Es lo que le da velocidad.
//   2. El cron (cada 15 min) como perro guardián: si una cadena se corta —deploy
//      en el medio, timeout duro, error de red— la próxima corrida la retoma.
//
// El lease `Campania.procesandoHasta` es lo que hace que esos dos caminos no se
// pisen: el que lo toma es el único que manda esa campaña.

/** Presupuesto de una invocación. Deja aire para cerrar antes del corte duro. */
const PRESUPUESTO_MS = 45_000;
/** Cuánto dura el arriendo. Más que el presupuesto, para que no venza en pleno lote. */
const LEASE_MS = 120_000;
/** Corte de seguridad por si algo devuelve siempre restantes > 0. */
const MAX_LOTES = 500;
/** Pausa tras un throttle: el rate del sandbox es 1 mail/seg. */
const ESPERA_THROTTLE_MS = 1_100;

export interface ResultadoCola {
  campaniaId: string | null;
  enviados: number;
  fallidos: number;
  restantes: number;
  lotes: number;
  /** true si quedó trabajo pendiente y hay que volver a invocar. */
  continuar: boolean;
  motivo: "sin-trabajo" | "terminada" | "sin-tiempo" | "throttled" | "lease-ajeno" | "bloqueado";
}

/**
 * Toma el lease de una campaña que tenga envíos pendientes. Devuelve su id, o
 * null si no hay trabajo (o si otro worker ya se lo llevó).
 *
 * El `updateMany` condicional es la parte importante: la condición sobre
 * `procesandoHasta` y el update viajan en una sola sentencia, así que dos
 * workers simultáneos no pueden quedarse los dos con la misma campaña — el
 * segundo actualiza 0 filas.
 */
async function tomarCampania(): Promise<string | null> {
  const ahora = new Date();

  const candidatas = await prisma.campania.findMany({
    where: {
      estado: "ENVIANDO",
      OR: [{ procesandoHasta: null }, { procesandoHasta: { lt: ahora } }],
      envios: { some: { estado: "ENCOLADO" } },
    },
    orderBy: { createdAt: "asc" }, // la más vieja primero
    select: { id: true },
    take: 5,
  });

  for (const { id } of candidatas) {
    const res = await prisma.campania.updateMany({
      where: {
        id,
        estado: "ENVIANDO",
        OR: [{ procesandoHasta: null }, { procesandoHasta: { lt: ahora } }],
      },
      data: { procesandoHasta: new Date(Date.now() + LEASE_MS) },
    });
    if (res.count === 1) return id;
    // count === 0 → otro worker se la llevó entre el findMany y el update.
  }
  return null;
}

async function renovarLease(campaniaId: string) {
  await prisma.campania.update({
    where: { id: campaniaId },
    data: { procesandoHasta: new Date(Date.now() + LEASE_MS) },
  });
}

async function soltarLease(campaniaId: string) {
  await prisma.campania.update({
    where: { id: campaniaId },
    data: { procesandoHasta: null },
  });
}

/**
 * Manda lo que entre en el presupuesto de tiempo de una invocación.
 * Suelta el lease siempre, incluso si algo falla.
 */
export async function procesarCola(): Promise<ResultadoCola> {
  const vacio = { enviados: 0, fallidos: 0, restantes: 0, lotes: 0 };

  const campaniaId = await tomarCampania();
  if (!campaniaId) {
    return { campaniaId: null, ...vacio, continuar: false, motivo: "sin-trabajo" };
  }

  const t0 = Date.now();
  let enviados = 0;
  let fallidos = 0;
  let restantes = 0;
  let lotes = 0;
  let motivo: ResultadoCola["motivo"] = "terminada";

  try {
    for (let i = 0; i < MAX_LOTES; i++) {
      const r = await procesarLote(campaniaId);
      if (!r) break; // la campaña se borró en el medio
      lotes++;
      enviados += r.enviados;
      fallidos += r.fallidos;
      restantes = r.restantes;

      if (r.restantes === 0) {
        motivo = "terminada";
        break;
      }
      // Falta algo que solo arregla una persona (hoy: la marca sin remitente).
      // No es `throttled`: esperar no lo resuelve, y reintentar los 45s de
      // presupuesto contra la misma pared es quemar la invocación entera. Los
      // envíos quedan ENCOLADO y el cron los retoma cuando esté cargado.
      if (r.bloqueado) {
        motivo = "bloqueado";
        break;
      }
      if (Date.now() - t0 > PRESUPUESTO_MS) {
        motivo = r.throttled ? "throttled" : "sin-tiempo";
        break;
      }
      if (r.throttled) {
        // El proveedor pidió frenar. Antes cortábamos la invocación entera acá, y
        // eso tiraba los 45s de presupuesto que quedaban: en el sandbox, que
        // limita a 1 mail/seg, el throttle llega siempre y la campaña avanzaba de
        // a 36 envíos por invocación. Ahora esperamos el segundo que pide el rate
        // y seguimos con el presupuesto que quede.
        await new Promise((r) => setTimeout(r, ESPERA_THROTTLE_MS));
      }
      // Lote largo: renovamos para que el lease no venza mientras seguimos.
      if (lotes % 10 === 0) await renovarLease(campaniaId);
    }
  } finally {
    await soltarLease(campaniaId).catch(() => {
      /* si falla, el lease vence solo a los 2 min */
    });
  }

  return { campaniaId, enviados, fallidos, restantes, lotes, continuar: restantes > 0, motivo };
}

/** Cuánto esperamos a que el worker siguiente ACUSE la request (no que termine). */
const DISPATCH_MS = 2_500;
/** Cuánto le damos al sucesor para tomar el lease antes de dar la posta por perdida. */
const CONFIRMAR_MS = 1_500;
/** Intentos de pasar la posta. */
const INTENTOS = 3;
/** Techo duro de todo el dispatch: corre en `after()`, después de los 45s del lote. */
const DISPATCH_TOTAL_MS = 11_000;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * ¿Alguien tomó la posta? Se pregunta por el EFECTO —el lease de la campaña—, no
 * por el transporte.
 *
 * 🔴 Ésa es la corrección del 13-ago-2026. Antes se daba por entregada cualquier
 * request que no tirara error, y el `AbortSignal.timeout` hace que un cold start
 * del sucesor sea indistinguible de un despacho exitoso: en los dos casos lo que
 * ves es un abort. El T06 salió con un hueco de 476 s en el medio (1.180 envíos,
 * la cadena muerta, y los 822 restantes esperando al cron) sin que quedara UNA
 * línea de log, porque el `catch` de acá era mudo.
 */
export async function tomaronLaPosta(campaniaId: string): Promise<boolean> {
  const c = await prisma.campania.findUnique({
    where: { id: campaniaId },
    select: { estado: true, procesandoHasta: true },
  });
  if (!c || c.estado !== "ENVIANDO") return true; // terminó: no hay posta que pasar
  return !!c.procesandoHasta && c.procesandoHasta > new Date();
}

/**
 * Dispara una invocación del worker, y se asegura de que haya arrancado.
 *
 * ⚠️ Hay que esperar esta promesa (o pasarla por `after()` de next/server). El
 * `void fetch(...)` que había acá no funcionaba: en serverless la función muere
 * cuando devuelve la respuesta y se lleva puesta la request en vuelo, así que la
 * cadena nunca arrancaba. Se vio en un ensayo de 400 envíos: la invocación
 * devolvía `continuar: true` y después no pasaba nada más.
 *
 * Tampoco esperamos a que el worker TERMINE: sería anidar invocaciones —cada
 * eslabón vivo hasta que termine el siguiente— y toda la cadena moriría junta al
 * llegar al `maxDuration`. Despachamos, cortamos, y confirmamos por el lease.
 *
 * ⚠️ Reintentar es seguro: el `updateMany` condicional de `tomarCampania` hace
 * que dos workers no puedan quedarse con la misma campaña — el de más devuelve
 * `sin-trabajo`. Mandar una invocación al pedo es infinitamente más barato que
 * dejar media campaña parada hasta que pase el cron.
 *
 * @param campaniaId la campaña cuya posta se está pasando. Sin él se despacha a
 *   ciegas (no hay lease que mirar), que es lo que hacen los dos call sites que
 *   arrancan la cola desde cero — ahí todavía no hay nada tomado.
 */
export async function arrancarCola(campaniaId?: string): Promise<void> {
  const appUrl = process.env.APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!appUrl || !secret) {
    console.log(JSON.stringify({ ev: "cadena-cortada", motivo: "sin-APP_URL-o-CRON_SECRET", campaniaId }));
    return; // sin config, el cron es el único motor
  }

  const t0 = Date.now();
  for (let intento = 1; intento <= INTENTOS; intento++) {
    let error: string | null = null;
    try {
      await fetch(`${appUrl}/api/campanias/procesar-cola?secret=${encodeURIComponent(secret)}`, {
        method: "POST",
        headers: { "x-encadenado": "1" },
        signal: AbortSignal.timeout(DISPATCH_MS),
      });
    } catch (e) {
      // Un abort acá es lo NORMAL —el sucesor tarda 45s en contestar— así que no
      // dice nada por sí solo. Se guarda para el log del final y se confirma abajo.
      error = e instanceof Error ? e.name : String(e);
    }

    if (!campaniaId) return; // a ciegas: no hay lease contra el cual confirmar

    await dormir(CONFIRMAR_MS);
    if (await tomaronLaPosta(campaniaId)) {
      if (intento > 1) {
        console.log(JSON.stringify({ ev: "cadena-recuperada", campaniaId, intento, ms: Date.now() - t0 }));
      }
      return;
    }

    if (Date.now() - t0 > DISPATCH_TOTAL_MS || intento === INTENTOS) {
      // Se agotó: los envíos quedan ENCOLADO y los retoma el cron. Lo que cambia
      // es que ahora se SABE, en vez de descubrirlo mirando por qué una campaña
      // tardó ocho minutos de más.
      console.log(
        JSON.stringify({ ev: "cadena-cortada", campaniaId, intentos: intento, ultimoError: error, ms: Date.now() - t0 }),
      );
      return;
    }
  }
}
