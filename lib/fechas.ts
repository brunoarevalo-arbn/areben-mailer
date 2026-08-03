/**
 * El día del calendario, que NO es el día UTC.
 *
 * 🔴 Hasta el 3-ago-2026 las métricas se agrupaban con `date_trunc('day', …)` a
 * secas sobre columnas `timestamp` que guardan UTC, y la serie de días se
 * armaba con `getUTCDate()`. Con Argentina en UTC-3 eso significa que **a las
 * 21:00 el panel ya estrena el día siguiente**: lo que se manda de 21 a 24 se
 * cuenta en un día que para quien mira todavía no empezó. Bruno lo vio la
 * misma noche del primer masivo de Zattia — el gráfico marcaba el 3 de agosto
 * siendo el 2.
 *
 * Este archivo es **el único lugar** donde vive la zona. Es puro (lo importan el
 * servidor y el cliente): nada de `process.env` ni de Prisma acá.
 *
 * ⚠️ **La zona es del NEGOCIO, no del navegador.** Tentaba resolverlo con la
 * zona local de quien mira, pero entonces el mismo número da distinto según
 * desde dónde se abra el panel, y "cuántos mails salieron ayer" es un dato de la
 * operación, no del que pregunta. Con la zona fija, el servidor y el cliente
 * dibujan la misma fecha siempre.
 *
 * 📌 El día que haya un comerciante fuera de Argentina, `ZONA` pasa a salir de
 * `Cuenta.config` y **este archivo es lo único que hay que tocar**: nadie más
 * escribe un nombre de zona ni un `date_trunc` a mano.
 */
export const ZONA = "America/Argentina/Buenos_Aires";

/**
 * El día del calendario de un instante, en la zona del negocio. `YYYY-MM-DD`.
 *
 * `en-CA` no es un capricho: es el único locale que formatea ISO derecho
 * (`2026-08-02`), así que no hay que reordenar partes a mano.
 */
const FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const diaLocal = (instante: Date): string => FMT.format(instante);

/**
 * Los últimos `n` días del calendario local, del más viejo al más nuevo, con
 * **hoy** al final.
 *
 * `ahora` entra por parámetro para que se pueda probar sin esperar a las nueve
 * de la noche: `scripts/probar-fechas.ts` le pasa el instante exacto del bug.
 */
export function ultimosDias(n: number, ahora: Date = new Date()): string[] {
  const [y, m, d] = diaLocal(ahora).split("-").map(Number);
  const dias: string[] = [];
  for (let k = n - 1; k >= 0; k--) {
    // Aritmética de calendario sobre la fecha LOCAL, hecha en UTC: acá no hay
    // hora ni zona, solo "el día anterior a este". `Date.UTC` normaliza los
    // desbordes de mes y año solo.
    dias.push(new Date(Date.UTC(y, m - 1, d - k)).toISOString().slice(0, 10));
  }
  return dias;
}

/**
 * El piso del filtro SQL para una serie que arranca en el día local `iso`.
 *
 * ⚠️ **Va un día ANTES a propósito.** La medianoche local de ese día cae en el
 * día UTC anterior o en el siguiente según la zona, y como el filtro compara
 * contra la columna cruda —que está en UTC— pedir justo `isoT00:00Z` comería el
 * arranque del gráfico en cualquier zona al este de Greenwich. Traer de más no
 * ensucia nada: lo que caiga fuera de la lista de días se descarta al mapear.
 */
export function desdeUtc(iso: string): Date {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}
