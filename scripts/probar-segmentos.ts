// Los segmentos: qué gente entra y —sobre todo— qué gente NO tiene que entrar.
//
//   node --env-file=.env --import tsx scripts/probar-segmentos.ts
//
// 🔴 Un segmento es un destino de campaña, así que un error acá no es un número
// mal en una pantalla: es un mail que le llega a quien no correspondía y que ya
// no se puede sacar de su casilla. Las dos secciones que importan son la 2 —el
// agujero del "no lo hizo"— y la 4, que verifica contra la base de verdad.
//
// ⚠️ Toca producción SOLO LEYENDO (cuenta contactos). No escribe nada.
import { prisma } from "../lib/prisma";
import { reglasToWhere, CAMPOS, type Reglas } from "../lib/segmentos";

let fallos = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    console.log(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
    fallos++;
  }
};
const una = (campo: string, op: string, valor: unknown): Reglas =>
  ({ op: "AND", condiciones: [{ campo, op, valor }] }) as Reglas;
const json = (r: Reglas) => JSON.stringify(reglasToWhere(r));

console.log("\n1) Enganche: 'sí lo hizo' mira la marca adentro de la ventana");
for (const [campo, marca] of [["clickeo", "clickAt"], ["abrio", "abiertoAt"]] as const) {
  const w = json(una(campo, "si", 30));
  ok(w.includes('"some"') && w.includes(marca), `${campo} sí → envios.some.${marca}`);
  ok(w.includes('"gte"'), `${campo} sí → acotado por fecha, no "alguna vez"`, w);
}

console.log("\n2) 🔴 'NO lo hizo' significa RECIBIÓ y no lo hizo");
// El agujero: escrito como un `none` pelado, entra todo el que nunca recibió
// nada —el que se anotó ayer, el que está en un tramo que todavía no salió— y
// el mail de reactivación le pega a gente que jamás supo de la marca.
for (const campo of ["clickeo", "abrio"] as const) {
  const w = json(una(campo, "no", 90));
  ok(w.includes('"none"'), `${campo} no → usa none`);
  ok(w.includes("enviadoAt"), `${campo} no → EXIGE haber recibido algo en la ventana`, w);
  // ⚠️ `reglasToWhere` envuelve la lista de condiciones en su propio `AND`, así
  // que la condición de enganche es el PRIMER elemento de ese array, no el
  // array. Mirar el envoltorio da 1 y no prueba nada.
  const envoltorio = (reglasToWhere(una(campo, "no", 90)) as { AND?: unknown[] }).AND ?? [];
  const cond = (envoltorio[0] as { AND?: unknown[] })?.AND;
  ok(Array.isArray(cond) && cond.length === 2, `${campo} no → son DOS condiciones (recibió + no lo hizo)`);
}

console.log("\n2 bis) 🔴 'recibio' es la MISMA forma con el sentido OPUESTO");
// El riesgo de este campo no es que no ande: es que alguien lo lea al lado de
// `abrio` y lo "empareje" agregándole el `some enviadoAt`. Eso lo rompe en
// silencio — el segmento pasaría a excluir justo a la gente a la que se le
// quiere escribir, y como sigue devolviendo contactos, nadie lo notaría hasta
// mirar por qué el ramp no avanza.
{
  const si = json(una("recibio", "si", 30));
  ok(si.includes('"some"') && si.includes("enviadoAt"), "recibio sí → envios.some.enviadoAt");
  ok(si.includes('"gte"'), "recibio sí → acotado por fecha", si);

  const no = reglasToWhere(una("recibio", "no", 30));
  const cond = ((no as { AND?: unknown[] }).AND ?? [])[0] as Record<string, unknown>;
  ok(JSON.stringify(cond).includes('"none"'), "recibio no → usa none");
  // La afirmación que importa: UNA sola condición, no dos.
  ok(
    !!cond?.envios && Object.keys(cond).length === 1 && !("AND" in cond),
    "recibio no → es UNA sola condición: NO exige haber recibido algo",
    JSON.stringify(cond),
  );
  // Y la contracara, para que quede claro que la asimetría es a propósito:
  const abrioNo = ((reglasToWhere(una("abrio", "no", 30)) as { AND?: unknown[] }).AND ?? [])[0] as { AND?: unknown[] };
  ok(Array.isArray(abrioNo?.AND) && abrioNo.AND.length === 2, "y 'abrio no' SIGUE siendo dos condiciones");
}

console.log("\n3) Lo que no se entiende no filtra (nunca 'todos')");
// Un where vacío como destino de campaña es la lista entera. Ante la duda, la
// condición se descarta — pero entonces el segmento tiene que quedar en nada,
// no en todos: por eso se verifica que una regla sola inválida dé `{}` y que la
// UI no ofrezca operadores que el motor no sabe traducir.
ok(json(una("clickeo", "si", "no-es-un-numero")) === "{}", "un valor basura no genera filtro");
ok(json(una("clickeo", "vaya-a-saber", 30)) === "{}", "un operador inventado no genera filtro");
for (const c of CAMPOS) {
  for (const o of c.ops) {
    const w = reglasToWhere(una(c.campo, o.op, c.tipo === "bool" ? true : c.tipo === "estado" ? "ACTIVO" : 30));
    ok(Object.keys(w).length > 0, `la UI ofrece ${c.campo}/${o.op} y el motor lo traduce`);
  }
}

/**
 * La parte que toca la base va adentro de `main()`: `tsx` compila `scripts/`
 * como CJS y ahí el `await` de nivel superior no existe. Es la misma forma que
 * usan `tn-import-orders.ts` y los demás.
 */
async function main() {
  console.log("\n4) Contra la base de verdad (Zattia, solo lectura)");
  const CID = "cmrwol9i30000xyysa2g53u9q";
  const cuantos = (r: Reglas) => prisma.contacto.count({ where: { cuentaId: CID, ...reglasToWhere(r) } });
  const recibieron = await prisma.contacto.count({
    where: { cuentaId: CID, envios: { some: { enviadoAt: { gte: new Date(Date.now() - 90 * 864e5) } } } },
  });
  const clickSi = await cuantos(una("clickeo", "si", 90));
  const clickNo = await cuantos(una("clickeo", "no", 90));
  console.log(`     recibieron algo en 90d: ${recibieron} · clickearon: ${clickSi} · no clickearon: ${clickNo}`);
  ok(clickSi + clickNo === recibieron, "los que sí + los que no dan EXACTO los que recibieron", `${clickSi}+${clickNo} ≠ ${recibieron}`);
  const enLaBase = await prisma.contacto.count({ where: { cuentaId: CID } });
  ok(clickNo < enLaBase, "el 'no clickeó' NO es toda la base");
  // La prueba del agujero, medida: hay gente sin ningún envío, y no tiene que
  // aparecer en el "no clickeó".
  const sinEnvios = await prisma.contacto.count({ where: { cuentaId: CID, envios: { none: {} } } });
  console.log(`     contactos sin ningún envío: ${sinEnvios} de ${enLaBase}`);
  ok(sinEnvios > 0, "hay gente que nunca recibió nada (si no, esta prueba no prueba nada)");
  ok(clickNo <= recibieron, "y ninguno de ellos entra en el 'no clickeó'");

  // 🔴 La contracara medida: en `recibio` esa misma gente SÍ tiene que entrar.
  // Es el caso de uso entero — "mandale a los que todavía no recibieron nada".
  const recSi = await cuantos(una("recibio", "si", 90));
  const recNo = await cuantos(una("recibio", "no", 90));
  console.log(`     recibio sí: ${recSi} · recibio no: ${recNo} · en la base: ${enLaBase}`);
  ok(recSi + recNo === enLaBase, "recibio sí + no = TODA la base (nadie queda afuera)", `${recSi}+${recNo} ≠ ${enLaBase}`);
  ok(recNo >= sinEnvios, "los que nunca recibieron nada entran en el 'no recibió'", `${recNo} < ${sinEnvios}`);
  ok(recSi === recibieron, "y el 'sí recibió' coincide con la cuenta directa", `${recSi} ≠ ${recibieron}`);

  console.log(fallos === 0 ? "\n✅ Segmentos OK" : `\n❌ ${fallos} fallo(s)`);
}

main()
  .catch((e) => {
    console.error("\n❌", e.message);
    fallos++;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(fallos === 0 ? 0 : 1);
  });
