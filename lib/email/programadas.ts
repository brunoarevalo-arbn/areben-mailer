import { prisma } from "@/lib/prisma";
import { encolarCampania } from "@/lib/email/encolar";
import { horaLocal } from "@/lib/fechas";

/**
 * El disparador de las campañas programadas.
 *
 * Lo llama la ruta del cron **antes** de `procesarCola()`, y ese orden importa:
 * así una campaña que vence a las 19:00 queda `ENVIANDO` y **sale en esa misma
 * invocación**, sin esperar al ciclo siguiente de 15 minutos.
 *
 * ⚠️ No hay endpoint propio a propósito: `/api/campanias/procesar-cola` ya corre
 * cada 15 min y ya está protegida por `CRON_SECRET`. Una ruta más es una función
 * más en Vercel, que se paga y tiene techo de plan.
 */

/**
 * Cuánto tarde puede salir una campaña que no pudo salir a horario.
 *
 * 🔑 Decidido con Bruno el 3-ago-2026. Adentro de la ventana se reintenta cada
 * 15 min —cubre el hipo transitorio: SES que no contesta, un deploy justo
 * encima—; pasada la ventana la campaña se **cancela** en vez de salir a una
 * hora que nadie eligió. Una promo de "hasta hoy" que sale a las 3 de la mañana
 * es peor que una promo que no sale.
 *
 * ⚠️ Se mide contra `programadaAt`, **no** contra el primer intento fallido: la
 * promesa que se hizo al programar fue "sale a las 19, o no sale".
 */
const GRACIA_MS = 2 * 60 * 60 * 1000;

/** Igual que el de la cola: más largo que lo que tarda una invocación. */
const LEASE_MS = 120_000;

export interface ResultadoProgramadas {
  encoladas: number;
  canceladas: number;
  fallidas: number;
  /** Una línea por campaña tocada, para el log del cron. */
  detalle: string[];
}

export async function encolarProgramadas(): Promise<ResultadoProgramadas> {
  const ahora = new Date();
  const r: ResultadoProgramadas = { encoladas: 0, canceladas: 0, fallidas: 0, detalle: [] };

  const vencidas = await prisma.campania.findMany({
    where: {
      estado: "PROGRAMADA",
      programadaAt: { lte: ahora },
      OR: [{ procesandoHasta: null }, { procesandoHasta: { lt: ahora } }],
    },
    orderBy: { programadaAt: "asc" }, // la que vencía hace más rato, primero
    select: { id: true, nombre: true, programadaAt: true, cuenta: { select: { id: true, nombre: true } } },
    take: 5,
  });

  for (const c of vencidas) {
    // Fuera de la ventana de gracia: no sale, y se dice por qué.
    if (c.programadaAt && ahora.getTime() - c.programadaAt.getTime() > GRACIA_MS) {
      const cancelada = await prisma.campania.updateMany({
        where: { id: c.id, estado: "PROGRAMADA" },
        data: { estado: "CANCELADA" },
      });
      if (cancelada.count) {
        r.canceladas++;
        r.detalle.push(`${c.nombre}: CANCELADA — vencía ${horaLocal(c.programadaAt)} y pasó la ventana de 2 h`);
      }
      continue;
    }

    // 🔑 El mismo idioma que `tomarCampania` en `cola.ts`: la condición y el
    // update viajan en una sola sentencia, así que dos workers simultáneos no
    // pueden llevarse la misma campaña — el segundo actualiza 0 filas.
    //
    // Y aunque se colaran los dos, `crearEnvios` va con `skipDuplicates: true`
    // sobre el `@@unique([campaniaId, contactoId])`: nadie recibe dos veces.
    const tomada = await prisma.campania.updateMany({
      where: {
        id: c.id,
        estado: "PROGRAMADA",
        OR: [{ procesandoHasta: null }, { procesandoHasta: { lt: ahora } }],
      },
      data: { procesandoHasta: new Date(Date.now() + LEASE_MS) },
    });
    if (tomada.count !== 1) continue; // otro worker se la llevó

    const res = await encolarCampania(c.cuenta, c.id);
    if (res.ok) {
      r.encoladas++;
      r.detalle.push(`${c.nombre}: ${res.total} envíos encolados`);
      continue;
    }

    // ⛔ El estado NO se toca: sigue PROGRAMADA y se reintenta dentro de 15 min,
    // hasta que se agote la ventana de gracia. Marcarla FALLIDA acá quemaría una
    // campaña entera por un problema que suele durar segundos.
    //
    // El lease sí se suelta, o el reintento se saltearía a sí mismo por dos
    // minutos.
    await prisma.campania.updateMany({
      where: { id: c.id, estado: "PROGRAMADA" },
      data: { procesandoHasta: null },
    });
    r.fallidas++;
    r.detalle.push(`${c.nombre}: no pudo salir (${res.error}) — reintenta en 15 min`);
  }

  return r;
}
