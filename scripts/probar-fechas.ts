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
//
// 🔴 **Y también con el reloj de la máquina en otro huso**, que es lo único que
// prueba de verdad la mitad de "programar un envío":
//
//   TZ=Asia/Tokyo node --import tsx scripts/probar-fechas.ts
//
// Los dos tienen que dar verde. Si `instanteLocal` se escribiera como
// `new Date(dia + "T" + hora)` —la forma natural y equivocada— el primero pasa y
// el segundo se cae: ahí está todo el sentido de este archivo.

import { ZONA, diaLocal, ultimosDias, desdeUtc, instanteLocal, horaLocal, horaDelDia } from "../lib/fechas";

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

console.log("\nDe 'el 3 a las 19:00' al instante (programar un envío):");

// El caso del día: el T02 se programa para las 19:00 de Argentina.
ok(
  instanteLocal("2026-08-03", "19:00").toISOString() === "2026-08-03T22:00:00.000Z",
  "las 19:00 de Argentina son las 22:00 UTC, corra donde corra este proceso",
);
// El mismo instante del bug de las métricas, ahora al revés.
ok(
  instanteLocal("2026-08-02", "21:30").toISOString() === "2026-08-03T00:30:00.000Z",
  "las 21:30 del 2 caen en el 3 UTC — que es de dónde venía el otro bug",
);
ok(
  instanteLocal("2026-08-03", "00:00").toISOString() === "2026-08-03T03:00:00.000Z",
  "la medianoche local son las 03:00 UTC, no las 00:00",
);

// Ida y vuelta: el día que se eligió es el día que se lee.
for (const [dia, hora] of [
  ["2026-08-03", "19:00"],
  ["2026-01-01", "00:00"],
  ["2026-12-31", "23:59"],
  ["2026-02-28", "12:00"],
] as const) {
  ok(diaLocal(instanteLocal(dia, hora)) === dia, `ida y vuelta: ${dia} ${hora} sigue cayendo en ${dia}`);
}

// Que sea creciente descarta que el corrimiento se aplique al revés (un signo
// invertido igual daría "un instante", pero seis horas para el otro lado).
ok(
  instanteLocal("2026-08-03", "20:00").getTime() - instanteLocal("2026-08-03", "19:00").getTime() === 3_600_000,
  "una hora más tarde es exactamente una hora más tarde",
);

const tira = (dia: string, hora: string) => {
  try {
    instanteLocal(dia, hora);
    return false;
  } catch {
    return true;
  }
};
ok(tira("3/8/2026", "19:00"), "una fecha con otro formato no pasa callada");
ok(tira("2026-08-03", "19"), "una hora sin minutos tampoco");
ok(tira("2026-08-03", ""), "ni una hora vacía");

console.log("\nLa fecha escrita para el panel:");

const t02 = new Date("2026-08-03T22:00:00.000Z");
ok(horaLocal(t02) === "lunes 3 de agosto, 19:00", `se lee como lo diría una persona (dio "${horaLocal(t02)}")`);
ok(
  horaLocal(new Date("2026-08-03T00:30:00.000Z")) === "domingo 2 de agosto, 21:30",
  "y a las 21:30 dice el domingo 2, no el lunes 3",
);

console.log("\nIda y vuelta: lo que el panel muestra vuelve al mismo instante");
// 🔴 Es literalmente lo que hace el bloque de cuenta regresiva: parte el `hasta`
// guardado en los dos inputs (`diaLocal` + `horaDelDia`) y lo vuelve a armar con
// `instanteLocal` en cuanto alguien toca uno. Si el par no cerrara, abrir el
// panel y no tocar nada correría la fecha límite de una promoción.
for (const iso of ["2026-08-03T22:00:00.000Z", "2026-12-25T02:59:00.000Z", "2026-01-01T03:00:00.000Z"]) {
  const d = new Date(iso);
  const vuelta = instanteLocal(diaLocal(d), horaDelDia(d));
  ok(vuelta.getTime() === d.getTime(), `${iso} sobrevive el ida y vuelta (dio ${vuelta.toISOString()})`);
}

console.log();
if (fallas) {
  console.error(`❌ ${fallas} falla${fallas === 1 ? "" : "s"} en el manejo de fechas.\n`);
  process.exit(1);
}
console.log("✅ Las métricas cortan el día donde lo corta el calendario.\n");
