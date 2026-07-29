// El mail no cambió sin que nadie lo pidiera.
//
//   node --import tsx scripts/probar-render.ts              # comparar
//   node --import tsx scripts/probar-render.ts --capturar   # bendecir el golden
//
// Existe por una razón puntual: cuando los bloques dejaron de hardcodear sus
// estilos y pasaron a la cascada, todo el aspecto quedó a merced de que el motor
// reprodujera exacto lo que antes estaba inline. Un error ahí no explota: cambia
// en silencio las 5 prearmadas y toda campaña guardada.
//
// ⚠️ `--capturar` se corre **a propósito y mirando el diff**, nunca "para que
// pase". Si el HTML cambió y el cambio es el que buscabas, se bendice y se
// commitea el golden junto con el cambio, así el diff del commit muestra qué se
// movió en el mail.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { renderEmailHtml, renderEmailTexto, type ContenidoCampania } from "../lib/email/render";
import { PRESETS } from "../lib/plantillas/presets";

const GOLDEN = join(import.meta.dirname, "fixtures", "render-golden.json");
const capturar = process.argv.includes("--capturar");

const OPTS = {
  unsubscribeUrl: "https://ejemplo.com/baja?token=abc",
  nombreCuenta: "Marca de Prueba",
  direccionPostal: "Calle Falsa 123, CABA",
  preheader: "Un preheader de prueba",
};

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

/**
 * El caso simple va ENTERO y no hasheado: cuando algo se rompe, un hash distinto
 * dice que cambió y nada más. El HTML completo dice qué.
 */
const SIMPLE = {
  bloques: [
    { tipo: "titulo", texto: "Hola", align: "left" },
    { tipo: "texto", texto: "Un párrafo\ncon salto.", align: "left" },
    { tipo: "boton", texto: "Comprar", url: "https://ejemplo.com", align: "left", full: false },
  ],
} as unknown as ContenidoCampania;

function capturarTodo(): Record<string, string> {
  const out: Record<string, string> = {};
  out["simple.html"] = renderEmailHtml(SIMPLE, OPTS);
  out["simple.texto"] = renderEmailTexto(SIMPLE, OPTS);

  for (const p of PRESETS) {
    const c = { bloques: p.bloques, tema: p.tema } as ContenidoCampania;
    out[`${p.id}.html`] = sha(renderEmailHtml(c, OPTS));
    out[`${p.id}.texto`] = sha(renderEmailTexto(c, OPTS));
    // Con la muestra prendida: es lo que ve el editor, y es el camino donde el
    // carrito se dibuja. Sin esto, un cambio en el carrito no lo agarra nadie.
    out[`${p.id}.html.muestra`] = sha(renderEmailHtml(c, { ...OPTS, muestraCarrito: true }));
  }
  return out;
}

const actual = capturarTodo();

if (capturar) {
  mkdirSync(dirname(GOLDEN), { recursive: true });
  writeFileSync(GOLDEN, JSON.stringify(actual, null, 2) + "\n");
  console.log(`\n📌 Golden bendecido: ${Object.keys(actual).length} entradas`);
  console.log("   Revisá el diff antes de commitearlo.\n");
  process.exit(0);
}

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};

console.log("\nEl HTML no se movió");

if (!existsSync(GOLDEN)) {
  console.error(`\n❌ No hay golden. Corré: node --import tsx scripts/probar-render.ts --capturar\n`);
  process.exit(1);
}

const esperado: Record<string, string> = JSON.parse(readFileSync(GOLDEN, "utf8"));

for (const clave of Object.keys(esperado)) {
  if (clave === "simple.html" || clave === "simple.texto") continue;
  ok(actual[clave] === esperado[clave], clave, `esperaba ${esperado[clave]}, salió ${actual[clave]}`);
}

for (const clave of ["simple.html", "simple.texto"] as const) {
  const igual = actual[clave] === esperado[clave];
  ok(igual, clave);
  if (!igual) {
    // Primera línea que difiere: alcanza para ver qué se movió sin volcar 4 KB.
    const a = (esperado[clave] ?? "").split("\n");
    const b = (actual[clave] ?? "").split("\n");
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        console.error(`      línea ${i + 1}\n      - ${a[i] ?? "(nada)"}\n      + ${b[i] ?? "(nada)"}`);
        break;
      }
    }
  }
}

const sobrantes = Object.keys(actual).filter((k) => !(k in esperado));
ok(sobrantes.length === 0, "no hay entradas sin bendecir", sobrantes.join(", "));

console.log(
  fallas === 0
    ? "\n✅ El mail salió igual\n"
    : `\n❌ ${fallas} diferencias. Si son las que buscabas: --capturar\n`,
);
process.exit(fallas === 0 ? 0 : 1);
