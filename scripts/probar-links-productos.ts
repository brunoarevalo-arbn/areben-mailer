// Un producto sin publicar no sale en un mail, y nada más que eso lo frena.
//
// El caso que motivó esto es la PREVENTA: se arma el mail con el producto
// todavía oculto y se publica el día del lanzamiento. Medido el 5-ago-2026
// contra las cuatro tiendas: la ficha de un producto oculto en Tiendanube
// devuelve **404**, así que sin este chequeo el mail lleva a miles de personas a
// una página que no existe.
//
//   node --import tsx scripts/probar-links-productos.ts

import {
  esDeLaTienda,
  linksRotos,
  motivoLinksRotos,
  nombresPorUrl,
  urlsDeProductos,
} from "../lib/email/links-productos";
import type { Bloque } from "../lib/email/bloques";

let fallos = 0;
function ok(cond: boolean, que: string) {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    console.log(`  ✗ ${que}`);
    fallos++;
  }
}

const prod = (nombre: string, url: string) => ({ nombre, precio: "1000", imagen: "https://x/1.jpg", url });

console.log("\n1) De qué bloques salen las URLs");
const doc = [
  { tipo: "productos", id: "a", items: [prod("Uno", "https://t.com/p/1"), prod("Dos", "https://t.com/p/2")] },
  // 🔴 El bloque dinámico NO aporta: no guarda productos, los pregunta al
  // enviar y con `published:"true"`, así que lo que trae ya está publicado por
  // construcción. Chequearlo sería inventar un freno sobre datos que no existen.
  { tipo: "productos-dinamicos", id: "b", fuente: "destacados" },
  { tipo: "titulo", id: "c", texto: "Hola" },
] as unknown as Bloque[];
const urls = urlsDeProductos(doc);
ok(urls.length === 2, `saca las 2 URLs del bloque de productos elegidos (dio ${urls.length})`);
ok(!urls.some((u) => u.includes("dinamic")), "el bloque dinámico no aporta ninguna");

const repetidos = urlsDeProductos([
  { tipo: "productos", id: "a", items: [prod("Uno", "https://t.com/p/1")] },
  { tipo: "productos", id: "b", items: [prod("Uno otra vez", "https://t.com/p/1")] },
] as unknown as Bloque[]);
ok(repetidos.length === 1, "el mismo producto en dos bloques se pregunta una sola vez");

const sucios = urlsDeProductos([
  { tipo: "productos", id: "a", items: [prod("Sin url", ""), prod("Almohadilla", "#"), prod("Ok", "https://t.com/p/9")] },
] as unknown as Bloque[]);
ok(sucios.length === 1 && sucios[0].endsWith("/9"), "descarta la URL vacía y el `#`");

console.log("\n2) 🔴 Sólo se visitan URLs de la propia tienda");
// Sin esto es un SSRF de manual: la lista sale de un Json que escribió una
// persona, y el servidor visitaría lo que sea que ahí diga.
ok(esDeLaTienda("https://zattia.com.ar/productos/x/", "https://zattia.com.ar"), "la tienda, sí");
ok(esDeLaTienda("https://www.stunned.com.ar/productos/x/", "https://stunned.com.ar"), "con `www.` también (TN devuelve las dos formas)");
ok(esDeLaTienda("https://stunned.com.ar/productos/x/", "https://www.stunned.com.ar"), "…y al revés");
ok(!esDeLaTienda("http://169.254.169.254/latest/meta-data/", "https://zattia.com.ar"), "⛔ la metadata de la nube, NO");
ok(!esDeLaTienda("https://otra-tienda.com/p/1", "https://zattia.com.ar"), "⛔ otro dominio, NO");
ok(!esDeLaTienda("https://zattia.com.ar.malo.com/p/1", "https://zattia.com.ar"), "⛔ un sufijo que empieza igual, NO");
ok(!esDeLaTienda("no es una url", "https://zattia.com.ar"), "⛔ basura, NO");
ok(!esDeLaTienda("https://zattia.com.ar/p/1", undefined), "⛔ sin tienda cargada no se visita nada");

async function bloque3() {
console.log("\n3) 🔴 Frena con 404, y con NADA más");
// Un timeout o un 500 son estados transitorios: frenar por ellos deja una
// campaña esperando por algo que no es del contenido. Un 404 no es transitorio.
const fetchOriginal = globalThis.fetch;
const responder = (mapa: Record<string, number | "explota">) => {
  globalThis.fetch = (async (u: string | URL) => {
    const v = mapa[String(u)];
    if (v === "explota") throw new Error("ETIMEDOUT");
    return new Response(null, { status: v ?? 200 });
  }) as typeof fetch;
};

responder({ "https://t.com/a": 404, "https://t.com/b": 200 });
let r = await linksRotos(["https://t.com/a", "https://t.com/b"]);
ok(r.length === 1 && r[0] === "https://t.com/a", "el 404 se marca roto y el 200 no");

responder({ "https://t.com/a": 410 });
ok((await linksRotos(["https://t.com/a"])).length === 1, "el 410 (borrado) también");

responder({ "https://t.com/a": 500 });
ok((await linksRotos(["https://t.com/a"])).length === 0, "un 500 NO frena: la tienda caída no es el contenido");

responder({ "https://t.com/a": "explota" });
ok((await linksRotos(["https://t.com/a"])).length === 0, "un timeout NO frena");

responder({ "https://t.com/a": 403 });
ok((await linksRotos(["https://t.com/a"])).length === 0, "un 403 NO frena");

// Más que el tope de concurrencia, para ejercitar el loop por tandas.
responder(Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`https://t.com/${i}`, i % 3 === 0 ? 404 : 200])));
r = await linksRotos(Array.from({ length: 9 }, (_, i) => `https://t.com/${i}`));
ok(r.length === 3, `con 9 URLs (más que la tanda de 4) encuentra las 3 rotas — dio ${r.length}`);

globalThis.fetch = fetchOriginal;
}

async function main() {
await bloque3();
console.log("\n4) El aviso nombra el producto, no el link");
const nombres = nombresPorUrl(doc);
ok(motivoLinksRotos(["https://t.com/p/1"], nombres).includes("«Uno»"), "uno solo: dice su nombre");
const dos = motivoLinksRotos(["https://t.com/p/1", "https://t.com/p/2"], nombres);
ok(dos.includes("Uno") && dos.includes("Dos"), "dos: los nombra a los dos");
ok(!dos.includes("https://"), "…y no escupe la URL");
ok(
  motivoLinksRotos(["https://t.com/desconocido"], nombres).includes("https://t.com/desconocido"),
  "si no conoce el nombre cae a la URL en vez de decir «undefined»",
);

console.log(fallos === 0 ? "\n✅ Todo verde\n" : `\n❌ ${fallos} fallo(s)\n`);
  process.exit(fallos === 0 ? 0 : 1);
}
main();
