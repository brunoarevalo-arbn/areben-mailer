// De dónde cuelgan los links de un mail.
//
// Lo que se custodia acá no es una preferencia estética: un dominio mal
// resuelto no rompe una imagen, rompe TODOS los links del mail —el de baja
// incluido— en correos que ya están en casillas ajenas y no se pueden
// corregir. Todo lo de abajo es puro: sin base, sin red.
//
//   node --import tsx scripts/probar-tracking.ts
import { normalizarDominioEnvio, hostDeEnvio, marcaDe, leerConfigCuenta } from "../lib/marca";
import { inyectarTracking } from "../lib/email/tracking";

let fallos = 0;
function ok(cond: boolean, que: string) {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    console.log(`  ✗ ${que}`);
    fallos++;
  }
}

const APP = "https://areben-mailer.vercel.app";
const cuentaCon = (dominioEnvio?: unknown) => ({
  nombre: "Zattia",
  config: dominioEnvio === undefined ? {} : { dominioEnvio },
});

console.log("\n1) El default no cambió: sin dominio propio, todo sale como salía");
// La invariante que hace que esto se pueda deployar sin mover un solo mail.
ok(hostDeEnvio(cuentaCon(), APP) === APP, "sin la clave, se usa APP_URL tal cual");
ok(hostDeEnvio({ nombre: "x", config: null }, APP) === APP, "config null → APP_URL");
ok(hostDeEnvio({ nombre: "x", config: "basura" }, APP) === APP, "config que no es objeto → APP_URL");
ok(hostDeEnvio(cuentaCon(""), APP) === APP, "dominio vacío → APP_URL");

console.log("\n2) Se acepta lo que una persona escribe");
ok(normalizarDominioEnvio("links.zattia.com.ar") === "https://links.zattia.com.ar", "hostname pelado → https");
ok(normalizarDominioEnvio("https://links.zattia.com.ar") === "https://links.zattia.com.ar", "con https ya puesto");
ok(normalizarDominioEnvio("https://links.zattia.com.ar/") === "https://links.zattia.com.ar", "sin barra final");
ok(normalizarDominioEnvio("  LINKS.Zattia.com.AR  ") === "https://links.zattia.com.ar", "espacios y mayúsculas");

console.log("\n3) Se rechaza todo lo que podría emitir un link roto");
// Cada uno de estos, guardado, es una campaña entera con los links muertos.
const basura: [string, unknown][] = [
  ["http:// (no se 'arregla' a https)", "http://links.zattia.com.ar"],
  ["con path", "links.zattia.com.ar/algo"],
  ["con query", "links.zattia.com.ar?a=1"],
  ["con puerto", "links.zattia.com.ar:3000"],
  ["con espacio en el medio", "links zattia.com.ar"],
  ["con credenciales", "user@links.zattia.com.ar"],
  ["sin punto (no es dominio público)", "localhost"],
  ["comilla (se escaparía del href)", 'links.zattia.com.ar"'],
  ["javascript:", "javascript:alert(1)"],
  ["no es string", 12345],
  ["guion al final de una etiqueta", "links-.zattia.com.ar"],
];
for (const [que, v] of basura) ok(normalizarDominioEnvio(v) === undefined, `rechaza ${que}`);
ok(hostDeEnvio(cuentaCon("links.zattia.com.ar/algo"), APP) === APP, "un valor inválido en la base cae al fallback, no se emite");

console.log("\n4) El dominio propio se usa en los dos lugares del mail");
const html = `<html><body><a href="https://zattia.com.ar/new-in/">NEW IN</a><a href="${APP}/baja?e=E1">Baja</a></body></html>`;
const conTracking = inyectarTracking(html, "E1", "https://links.zattia.com.ar");
ok(conTracking.includes("https://links.zattia.com.ar/api/track/click/E1"), "el redirect de clicks cuelga del dominio propio");
ok(conTracking.includes('src="https://links.zattia.com.ar/api/track/open/E1"'), "el pixel de apertura también");
ok(!conTracking.includes(`${APP}/api/track/`), "no queda ningún resto del dominio de la app");

console.log("\n5) El link de baja NO se reescribe por el tracking");
// Ya era invariante; se re-fija porque ahora el `/baja` viene armado con el
// dominio de la marca y una regex distraída lo envolvería en un redirect.
ok(conTracking.includes(`href="${APP}/baja?e=E1"`), "el /baja pasa intacto por inyectarTracking");

console.log("\n6) El dominio no es marca: no viaja al renderer");
const m = marcaDe(cuentaCon("links.zattia.com.ar")) as Record<string, unknown>;
ok(!("dominioEnvio" in m), "marcaDe() no lo expone (no se dibuja, no es un RenderOpt)");
ok(JSON.stringify(m).includes("Zattia"), "…pero marcaDe() sigue devolviendo la marca");

console.log("\n7) Guardarlo no pisa el resto del config");
const c = leerConfigCuenta({ tema: { acento: "#000000" }, logo: "https://x/y.png", dominioEnvio: "links.zattia.com.ar" });
ok(c.dominioEnvio === "https://links.zattia.com.ar", "se lee normalizado");
ok(c.logo === "https://x/y.png", "el logo sigue ahí");
ok(!!c.tema, "el tema sigue ahí");

console.log(fallos === 0 ? "\n✅ Todo verde\n" : `\n❌ ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
