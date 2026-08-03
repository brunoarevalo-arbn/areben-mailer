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

// ─────────────────────────────────────────────────────────────
// El camino inverso: de "el 3 de agosto a las 19:00" al instante.
//
// Lo necesita programar un envío. 🔴 Un `<input type="date">` y un
// `<input type="time">` devuelven `"2026-08-03"` y `"19:00"` **sin zona**, y
// `new Date("2026-08-03T19:00")` los interpreta en la zona **del navegador**:
// programar desde una laptop en otro huso mandaría la campaña a otra hora. Es la
// misma confusión que hacía que el panel estrenara el día a las 21:00, del otro
// lado del espejo.
// ─────────────────────────────────────────────────────────────

/**
 * Las partes de un instante **en la zona del negocio**. `h23` es explícito
 * porque con `hour12: false` hay runtimes que devuelven "24" a la medianoche, y
 * eso desborda al rearmar la fecha.
 */
const PARTES = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/**
 * Cuánto está corrida la zona respecto de UTC **en ese instante**, en ms
 * (negativo al oeste: -3 h para Argentina).
 *
 * ⚠️ Se mide, no se cablea. Argentina no usa horario de verano hoy, pero lo usó
 * hasta 2009 y la base ya tiene fechas de esa época; un `-3` clavado es un bug
 * dormido esperando que alguien cambie de opinión o de país.
 */
function corrimiento(instante: Date): number {
  const p: Record<string, string> = {};
  for (const { type, value } of PARTES.formatToParts(instante)) p[type] = value;
  const enZona = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  // `enZona` son las partes locales leídas como si fueran UTC; la diferencia
  // contra el instante real ES el corrimiento.
  return enZona - Math.floor(instante.getTime() / 1000) * 1000;
}

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^\d{2}:\d{2}$/;

/**
 * `("2026-08-03", "19:00")` → el instante UTC de esas 19:00 **en la zona del
 * negocio**. El inverso de `diaLocal`.
 *
 * Cómo: se leen día y hora como si fueran UTC (un tanteo que cae corrido por lo
 * que valga la zona) y se corrige por el corrimiento medido. La **segunda
 * pasada** existe por los saltos de horario: si el tanteo cayó de un lado del
 * salto y el ajustado del otro, el corrimiento bueno es el del ajustado.
 *
 * Tira si el formato no es el que devuelven `<input type="date">` y
 * `<input type="time">`: un instante inválido acá es una campaña que sale a una
 * hora que nadie eligió.
 */
export function instanteLocal(dia: string, hora: string): Date {
  if (!RE_DIA.test(dia)) throw new Error(`Fecha inválida: "${dia}" (se espera AAAA-MM-DD)`);
  if (!RE_HORA.test(hora)) throw new Error(`Hora inválida: "${hora}" (se espera HH:MM)`);

  const tanteo = new Date(`${dia}T${hora}:00.000Z`);
  if (Number.isNaN(tanteo.getTime())) throw new Error(`Fecha inválida: "${dia} ${hora}"`);

  const corr = corrimiento(tanteo);
  const ajustado = new Date(tanteo.getTime() - corr);
  const corr2 = corrimiento(ajustado);
  return corr2 === corr ? ajustado : new Date(tanteo.getTime() - corr2);
}

const FMT_DIA_LARGO = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const FMT_HORA = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Un instante escrito como lo diría una persona: `lunes 3 de agosto, 19:00`.
 *
 * Se arma **por partes** y no con un formato combinado: el separador que mete
 * cada versión de ICU entre el día de la semana y el resto cambia, y esto se
 * dibuja en el servidor y en el cliente — dos strings distintos serían un
 * mismatch de hidratación.
 */
export function horaLocal(instante: Date): string {
  const partes: Record<string, string> = {};
  for (const { type, value } of FMT_DIA_LARGO.formatToParts(instante)) partes[type] = value;
  const { weekday = "", day = "", month = "" } = partes;
  return `${weekday} ${day} de ${month}, ${FMT_HORA.format(instante)}`;
}
