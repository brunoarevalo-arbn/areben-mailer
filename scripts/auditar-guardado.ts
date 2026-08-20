// Auditoría estática del guardado con conflicto. Sin base, sin red.
//
//   node --import tsx scripts/auditar-guardado.ts
//
// 🔴 QUÉ CUSTODIA. La detección de conflicto tiene DOS mitades, y con una sola
// el arreglo es peor que el problema:
//
//  1. **El servidor se niega** si el documento cambió (`docVersion` en el WHERE
//     del `updateMany`, `+1` en el data). Si alguien saca esa condición, todo
//     vuelve a pisarse y ningún test de pantalla se entera.
//  2. **Quien llama FRENA cuando el guardado no escribió.** Los editores guardan
//     antes de mandar una prueba, de enviar, de programar, de activar y de crear
//     una campaña desde una plantilla. Un `await guardarX(...)` cuyo resultado se
//     tira —que es como estaban los diez call sites hasta el 20-ago-2026—
//     manda **el mail viejo** después de un guardado rechazado: el accidente que
//     todo esto viene a evitar, al revés.
//
// La regla que se chequea para (2) es sintáctica y por eso es chequeable: una
// sentencia que EMPIEZA con `await guardarX(` o con `guardarX(` está tirando el
// resultado. La forma correcta pasa por `guardarDoc(...)` de
// `components/useGuardadoDoc.ts`, que devuelve un booleano.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = join(import.meta.dirname, "..");
const ACTIONS = [
  { archivo: "app/(app)/campanias/actions.ts", fn: "guardarCampania", modelo: "campania" },
  { archivo: "app/(app)/automations/actions.ts", fn: "guardarAutomation", modelo: "automation" },
  { archivo: "app/(app)/plantillas/actions.ts", fn: "guardarPlantilla", modelo: "plantilla" },
];

const errores: string[] = [];
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else { errores.push(que); console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`); }
};

// ── 1. El servidor se niega ─────────────────────────────────────────────────
console.log("\nEl guardado del servidor lleva la condición de versión");
for (const a of ACTIONS) {
  const src = readFileSync(join(RAIZ, a.archivo), "utf8");
  const i = src.indexOf(`export async function ${a.fn}`);
  ok(i >= 0, `${a.fn}: existe`);
  if (i < 0) continue;
  // El cuerpo de la función, hasta la próxima declaración exportada.
  const j = src.indexOf("\nexport ", i + 1);
  const cuerpo = src.slice(i, j < 0 ? undefined : j);
  ok(
    /docVersion:\s*input\.version/.test(cuerpo),
    `${a.fn}: el WHERE compara \`docVersion\` con la versión que mandó el editor`,
    "sin esto el update matchea siempre y vuelve a pisar lo que haya",
  );
  ok(
    /docVersion:\s*\{\s*increment:\s*1\s*\}/.test(cuerpo),
    `${a.fn}: el data incrementa \`docVersion\``,
    "sin esto la versión nunca avanza y dos pantallas viejas se siguen pisando",
  );
  ok(
    /updateMany\(/.test(cuerpo),
    `${a.fn}: usa updateMany`,
    "`update` tira cuando el WHERE no matchea, y acá 'no matcheó' es una respuesta que hay que poder contestar",
  );
  ok(
    /veredictoGuardado\(/.test(cuerpo),
    `${a.fn}: contesta con \`veredictoGuardado\``,
    "el mensaje y la distinción conflicto/borrado viven en un solo lugar",
  );
}

// ── 2. Nadie tira el resultado ──────────────────────────────────────────────
console.log("\nNingún llamador tira el resultado del guardado");
const FUNCS = ACTIONS.map((a) => a.fn);
const RE = new RegExp(`^\\s*(await\\s+)?(${FUNCS.join("|")})\\s*\\(`);

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next" || e === ".git") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...archivos(p));
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

const sospechosos: string[] = [];
for (const p of [...archivos(join(RAIZ, "components")), ...archivos(join(RAIZ, "app"))]) {
  // Las actions se declaran a sí mismas: no son llamadas.
  if (ACTIONS.some((a) => p.endsWith(a.archivo.replace(/\//g, "/")))) continue;
  const lineas = readFileSync(p, "utf8").split("\n");
  lineas.forEach((l, n) => {
    if (RE.test(l)) sospechosos.push(`${relative(RAIZ, p)}:${n + 1}  ${l.trim().slice(0, 90)}`);
  });
}
ok(
  sospechosos.length === 0,
  "ninguna sentencia empieza con `await guardarX(` (resultado descartado)",
  sospechosos.join("\n      "),
);

// ── 3. El hook sigue siendo la única puerta ─────────────────────────────────
console.log("\nEl hook contesta un booleano y corta");
{
  const hook = readFileSync(join(RAIZ, "components/useGuardadoDoc.ts"), "utf8");
  ok(/Promise<boolean>/.test(hook), "`guardarDoc` devuelve un booleano");
  ok(/setVersion\(r\.version\)/.test(hook), "y al escribir se queda con la versión nueva");
  ok(/return false/.test(hook) && /return true/.test(hook), "contesta las dos puntas");
}

console.log(errores.length === 0 ? "\n✅ Todo en verde" : `\n❌ ${errores.length} hallazgos`);
process.exit(errores.length === 0 ? 0 : 1);
