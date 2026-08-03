// ¿El día que muestran las métricas es el día del calendario, y no el día UTC?
//
// 🔴 El bug que motiva este script: la serie del panel se armaba con
// `getUTCDate()` y se agrupaba con `date_trunc('day', …)` sobre columnas que
// guardan UTC. Con Argentina en UTC-3 eso hace que **a las 21:00 el gráfico ya
// estrene el día siguiente**: Bruno lo vio la noche del primer masivo de Zattia,
// el panel marcaba el 3 de agosto siendo todavía el 2.
//
// Es puro: no toca la base ni la red.
//
//   node --import tsx scripts/probar-fechas.ts

import { ZONA, diaLocal, ultimosDias, desdeUtc } from "../lib/fechas";

let fallas = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    fallas++;
    console.error(`  ✗ ${msg}`);
  }
};

console.log("\nEl día local no es el día UTC:");

// 2-ago-2026, 21:30 de Argentina = 3-ago 00:30 UTC. El instante exacto del bug.
const laNocheDelT01 = new Date("2026-08-03T00:30:00.000Z");
ok(diaLocal(laNocheDelT01) === "2026-08-02", "21:30 de un 2 de agosto sigue siendo el 2, no el 3");
ok(
  laNocheDelT01.toISOString().slice(0, 10) === "2026-08-03",
  "…y en UTC ese mismo instante YA es el 3 (que es de dónde salía el error)",
);

// Las 20:13, cuando salió el T01: mismo día en las dos zonas. La serie no se
// mueve para los envíos de la tarde — solo para los de después de las 21.
ok(diaLocal(new Date("2026-08-02T23:13:00.000Z")) === "2026-08-02", "las 20:13 caen en el 2 igual que antes");

// La otra punta: 00:30 de Argentina es todavía el día anterior en... no, es el
// mismo. Lo que importa es que la medianoche local YA cambió de día local
// aunque en UTC falten 3 horas para cambiar.
ok(diaLocal(new Date("2026-08-03T03:00:00.000Z")) === "2026-08-03", "a la medianoche local arranca el día nuevo");
ok(diaLocal(new Date("2026-08-03T02:59:00.000Z")) === "2026-08-02", "un minuto antes, sigue siendo el día viejo");

console.log("\nLa serie de días:");

const dias = ultimosDias(30, laNocheDelT01);
ok(dias.length === 30, "son 30 días");
ok(dias[29] === "2026-08-02", "el último es HOY en local (2-ago), no mañana en UTC");
ok(dias[0] === "2026-07-04", "el primero es 29 días antes");
ok(
  dias.every((d, i) => i === 0 || d > dias[i - 1]),
  "van del más viejo al más nuevo, sin repetidos",
);
ok(new Set(dias).size === 30, "no hay días duplicados");

// Cruce de mes y de año, que es donde la aritmética a mano se rompe.
ok(ultimosDias(3, new Date("2026-03-02T12:00:00.000Z"))[0] === "2026-02-28", "cruza un fin de mes");
ok(ultimosDias(3, new Date("2026-01-02T12:00:00.000Z"))[0] === "2025-12-31", "cruza un fin de año");

console.log("\nEl piso del filtro SQL:");

const desde = desdeUtc("2026-07-04");
ok(desde.toISOString() === "2026-07-03T00:00:00.000Z", "va un día antes del primer día local");
ok(
  desde < new Date("2026-07-04T03:00:00.000Z"),
  "…y por lo tanto es anterior a la medianoche local de ese día, que es lo único que tiene que garantizar",
);

console.log("\nLa zona:");
ok(ZONA === "America/Argentina/Buenos_Aires", "es la del negocio y vive en un solo archivo");
// ⚠️ No se compara contra `resolvedOptions().timeZone`: Node canoniza el nombre
// al alias viejo (`America/Buenos_Aires`) y la igualdad falla con la zona
// perfectamente reconocida. Lo que importa es que el runtime la ENTIENDA, y eso
// se prueba midiendo el corrimiento. Va por nombre IANA y no por un `-03:00`
// cableado porque un offset fijo es una bomba de horario de verano: Argentina no
// lo usa hoy, pero lo usó hasta 2009 y ese dato histórico ya está en la base.
const mediodiaUtc = new Date("2026-08-02T12:00:00.000Z");
ok(diaLocal(mediodiaUtc) === "2026-08-02", "el runtime la entiende y no la ignora en silencio");
ok(diaLocal(new Date("2026-08-02T02:00:00.000Z")) === "2026-08-01", "el corrimiento es real: 23:00 del día anterior");

console.log();
if (fallas) {
  console.error(`❌ ${fallas} falla${fallas === 1 ? "" : "s"} en el manejo de fechas.\n`);
  process.exit(1);
}
console.log("✅ Las métricas cortan el día donde lo corta el calendario.\n");
