// La audiencia de una campaña no puede tirar la pantalla del editor.
//
//   node --env-file=.env --import tsx scripts/probar-audiencia.ts
//
// Existe por un bug de verdad (1-ago-2026): una campaña **con A/B y todavía sin
// destino** —el estado natural de un borrador recién creado— rompía
// `/campanias/[id]` entera con "Algo salió mal". La página llama a
// `contactosElegibles` para calcular el holdout del A/B, y ahí el `else` daba por
// hecho que si no hay lista hay segmento: con los dos en null salía
// `findFirst({ where: { id: null } })`, que Prisma rechaza.
//
// Lo peor no era el error sino que **no se podía salir**: el editor no abría, así
// que tampoco se podía elegir el destino que lo habría arreglado.
//
// ⚠️ No escribe nada. El caso sin destino ni siquiera llega a la base — y ese es
// justo el punto, así que la cuenta puede ser inventada.

import { contactosElegibles } from "../lib/campanias";
import { prisma } from "../lib/prisma";

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};

async function main() {
  console.log("\nUna campaña sin destino");
  let r: Awaited<ReturnType<typeof contactosElegibles>> | "revento" = "revento";
  try {
    r = await contactosElegibles("cuenta-que-no-existe", { listaId: null, segmentoId: null });
  } catch (e) {
    console.error(`      ${(e as Error).message.split("\n")[0]}`);
  }
  ok(r !== "revento", "no lanza (si lanza, el editor de un borrador con A/B no abre)");
  ok(Array.isArray(r) && r.length === 0, "devuelve cero elegibles");
  // `null` es "el segmento que pide no existe", que sus llamadores muestran como
  // error. Sin destino no es un error: es un borrador a medio armar.
  ok(r !== null, "y NO devuelve null, que significa otra cosa");

  await prisma.$disconnect();
  console.log(fallas === 0 ? "\n✅ Audiencia OK" : `\n❌ ${fallas} fallas`);
  process.exit(fallas === 0 ? 0 : 1);
}

main();
