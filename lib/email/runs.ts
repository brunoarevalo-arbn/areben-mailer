import { prisma } from "@/lib/prisma";

// El arriendo de un `AutomationRun`: quién se lo lleva es el único que le manda
// el mail.
//
// 🔴 POR QUÉ EXISTE. `/api/automations/procesar` leía los runs `PENDIENTE` con
// un `findMany` y recién los marcaba `ENVIADO` **después** de mandar. Entre esas
// dos cosas hay una llamada a SES: dos invocaciones simultáneas se llevaban los
// mismos 30 runs y le mandaban el mail **dos veces a la misma persona**. El bug
// estaba dormido porque el único que llamaba a ese endpoint era el cron, que
// corre solo. Deja de estarlo en cuanto Resorty lo pincha en cada lead.
//
// Es el mismo mecanismo que `Campania.procesandoHasta` (ver `cola.ts`), con una
// diferencia: allá se arrienda **una campaña** y acá **un lote de runs**, así que
// el claim es una sola sentencia con `FOR UPDATE SKIP LOCKED` en vez de un
// `updateMany` por candidato. Con 30 runs, treinta viajes a la base para tomar
// el lote costaría más que mandar los mails.

/**
 * Cuánto dura el arriendo. Más que el `maxDuration` de 60 s del endpoint: si
 * venciera en pleno lote, otra invocación agarraría un run que se está mandando
 * ahora mismo — que es exactamente lo que esto viene a impedir.
 */
export const LEASE_RUN_SEG = 300;

/**
 * Se lleva hasta `limite` runs listos para mandar y devuelve sus ids.
 *
 * Todo pasa en una sentencia a propósito. `FOR UPDATE SKIP LOCKED` hace que dos
 * invocaciones simultáneas se repartan el trabajo en vez de pelearse por él: la
 * segunda **saltea** las filas que la primera está tomando en vez de esperarlas,
 * así que ninguna de las dos se bloquea y ninguna se lleva un run ajeno.
 *
 * ⚠️ Las comparaciones van contra `timezone('UTC', now())` y no contra `now()`.
 * `proximoAt` y `procesandoHasta` son `timestamp` **sin** zona y Prisma guarda
 * UTC ahí; comparar con un `timestamptz` deja el resultado a merced del TimeZone
 * de la sesión, que no es nuestro. Hoy Neon responde en GMT y daría igual — es
 * justo el tipo de cosa que anda hasta el día que cambia sola.
 *
 * ⚠️ No filtra por `automation.estado`: un run de una automation pausada se toma
 * igual y el procesador lo marca `SALTADO`. Filtrarlo acá lo dejaría `PENDIENTE`
 * para siempre, tomándose el trabajo de leerlo en cada corrida y sin resolverse
 * nunca.
 */
export async function tomarRuns(limite: number): Promise<string[]> {
  const filas = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "AutomationRun"
    SET "procesandoHasta" = timezone('UTC', now()) + (CAST(${LEASE_RUN_SEG} AS int) * INTERVAL '1 second')
    WHERE id IN (
      SELECT id FROM "AutomationRun"
      WHERE estado = 'PENDIENTE'
        AND "proximoAt" <= timezone('UTC', now())
        AND ("procesandoHasta" IS NULL OR "procesandoHasta" < timezone('UTC', now()))
      ORDER BY "proximoAt" ASC
      LIMIT ${limite}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  return filas.map((f) => f.id);
}

/**
 * Suelta el arriendo de un run que quedó `PENDIENTE` a propósito.
 *
 * Hoy hay un solo caso: la marca no tiene remitente cargado, y el run se deja
 * pendiente en vez de quemarlo (una bienvenida es una sola vez en la vida del
 * contacto). Sin soltarlo, ese run se queda invisible los 5 minutos del lease
 * aunque el dato que le falta se cargue en el segundo siguiente.
 *
 * Los otros caminos no lo necesitan: `ENVIADO`, `SALTADO` y `FALLIDO` ya no
 * matchean el `estado = 'PENDIENTE'` del claim, así que el lease les sobra.
 */
export async function soltarRun(id: string): Promise<void> {
  await prisma.automationRun.update({ where: { id }, data: { procesandoHasta: null } });
}
