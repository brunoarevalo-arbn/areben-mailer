// Los iconos de redes: que se dibujen, y sobre todo que NUNCA se dibuje una
// imagen rota.
//
// El modo de falla que se cubre acá no se ve en desarrollo: un `<img>` con una
// URL que no existe se ve igual que un icono que todavía no cargó, y recién
// aparece como un cuadradito roto en la casilla de otra persona, en un mail que
// ya no se puede corregir.
//
//   node --import tsx scripts/probar-redes.ts
import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { renderEmailHtml } from "../lib/email/render";
import { REDES, redConIcono } from "../lib/email/redes";
import type { Bloque } from "../lib/email/bloques";

let fallos = 0;
function ok(cond: boolean, que: string) {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    console.log(`  ✗ ${que}`);
    fallos++;
  }
}

const HOST = "https://links.zattia.com.ar";
const OPTS = { unsubscribeUrl: "#", nombreCuenta: "Zattia" };
const html = (links: { red: string; url: string }[], assetsBase?: string) =>
  renderEmailHtml({ bloques: [{ tipo: "redes", links } as Bloque] }, { ...OPTS, assetsBase });

console.log("\n1) 🔴 Cada red de la lista TIENE su archivo");
// Es la invariante que hace imposible el cuadradito roto. Si alguien agrega una
// red a REDES y se olvida del PNG, esto se pone rojo el mismo día.
for (const r of REDES) {
  ok(existsSync(`public/redes/${r.slug}.png`), `public/redes/${r.slug}.png existe (${r.nombre})`);
}

console.log("\n1-bis) 🔴 …y los sirve el servidor SIN sesión");
// Costó un 307 en producción: el matcher del proxy solo excluye `_next/static`,
// así que todo lo que vive en `public/` pasa por el chequeo de sesión y rebota
// al login. Un destinatario no tiene sesión ⇒ el icono es una imagen rota para
// el 100% de los que reciben el mail, y ya no se puede corregir.
const proxy = readFileSync("proxy.ts", "utf8");
const prefijos = proxy.slice(proxy.indexOf("PUBLIC_PREFIXES"), proxy.indexOf("export async function proxy"));
// 🔴 **Los DOS directorios**, y por eso el chequeo es un bucle y no una línea.
// El 2-ago-2026 entró el pack de `/iconos/` (el ícono por celda de `columnas`),
// se deployó, y devolvía 307 a `/login` — con este mismo comentario ya escrito
// tres renglones más arriba y con el chequeo de `/redes/` en verde. Un
// directorio nuevo de imágenes de mail se agrega en tres lugares: `public/`, el
// helper que arma la URL, y acá.
for (const dir of ["/redes/", "/iconos/"]) {
  ok(new RegExp(`['"]\\${dir}['"]`.replace("\\/", "\\/")).test(prefijos), `'${dir}' está en PUBLIC_PREFIXES del proxy`);
}

console.log("\n2) Una red conocida sale como icono");
const h1 = html([{ red: "Instagram", url: "https://instagram.com/zattia_co" }], HOST);
ok(h1.includes(`src="${HOST}/redes/instagram.png"`), "el src cuelga del host que se le pasó");
ok(h1.includes('alt="Instagram"'), "lleva alt (Outlook bloquea imágenes: el alt es lo único que se ve)");
ok(/<img[^>]*\bwidth="\d+"[^>]*\bheight="\d+"/.test(h1), "width/height como ATRIBUTOS, no solo en el style (Outlook ignora el CSS)");
ok(h1.includes('href="https://instagram.com/zattia_co"'), "el link sigue estando");

console.log("\n3) El nombre se reconoce escrito de cualquier forma");
// El campo era texto libre antes del selector: en la base ya hay variantes.
for (const v of ["instagram", "INSTAGRAM", " Instagram ", "TikTok", "tiktok", "WhatsApp", "whatsapp"]) {
  ok(!!redConIcono(v), `reconoce "${v}"`);
}

console.log("\n4) 🔴 Lo que no tiene icono NO emite una imagen");
// Threads y no Facebook: Facebook tiene icono desde el 1-ago-2026. El fixture
// tiene que ser una red que de verdad no está en la lista, o esto pasa a probar
// nada — que es peor que no probarlo.
const h2 = html([{ red: "Threads", url: "https://threads.net/@x" }], HOST);
ok(!h2.includes("<img"), "una red sin archivo no emite <img>");
ok(h2.includes("Threads"), "…sale el nombre en texto, que es lo que hacía antes");

const h3 = html([{ red: "Instagram", url: "https://instagram.com/x" }]);
ok(!h3.includes("<img"), "sin assetsBase tampoco emite <img>");
ok(h3.includes("Instagram"), "…también cae al texto");

const h4 = html([{ red: "Instagram", url: "https://instagram.com/x" }], "   ");
ok(!h4.includes("<img"), "un assetsBase en blanco no emite <img>");

console.log("\n5) Sin URL la red no se dibuja");
const h5 = html([{ red: "Instagram", url: "" }], HOST);
ok(!h5.includes("<img"), "sin URL no hay icono");
ok(!h5.includes("instagram.com"), "sin URL no hay link");

console.log("\n6) Ningún src queda relativo ni a medio armar");
// Un src relativo no resuelve en un cliente de mail: no hay página base.
const todos = html(REDES.map((r) => ({ red: r.nombre, url: "https://x.com/y" })), HOST);
const srcs = [...todos.matchAll(/<img[^>]*src="([^"]*)"/g)].map((m) => m[1]);
ok(srcs.length === REDES.length, `dibuja los ${REDES.length} iconos`);
ok(srcs.every((s) => s.startsWith("https://")), "todos los src son absolutos y https");
ok(!srcs.some((s) => s.includes("//redes")), "ninguno quedó con doble barra");

// Va al final y en una función porque necesita `await` (tsx compila este script
// a CJS y no admite await de nivel superior).
async function transparenciaReal() {
  console.log("\n7) 🔴 Los archivos tienen transparencia DE VERDAD");
  // Los PNG de banco de imágenes traen el damero DIBUJADO en gris en vez de un
  // canal alfa. Sobre la tarjeta blanca de Zattia se ve idéntico, y aparece como
  // un cuadrado sucio en cualquier marca con otro fondo — o sea, se descubre en
  // el mail de OTRO comerciante. Pasó con Instagram y TikTok el 31-jul-2026.
  //
  // ⚠️ `metadata().hasAlpha` MIENTE con los PNG de paleta: devuelve `false` con
  // la transparencia intacta. La única prueba que no miente es componer el icono
  // sobre un color y mirar una esquina.
  for (const r of REDES) {
    const p = `public/redes/${r.slug}.png`;
    if (!existsSync(p)) continue;
    const compuesto = await sharp({
      create: { width: 96, height: 96, channels: 3, background: { r: 255, g: 0, b: 255 } },
    })
      .composite([{ input: await sharp(p).resize(96, 96).toBuffer() }])
      .raw()
      .toBuffer();
    ok(
      compuesto[0] === 255 && compuesto[1] === 0 && compuesto[2] === 255,
      `${r.slug}.png: la esquina es transparente, no un fondo pegado`,
    );
  }
}

transparenciaReal().then(() => {
  console.log(fallos === 0 ? "\n✅ Todo verde\n" : `\n❌ ${fallos} fallo(s)\n`);
  process.exit(fallos === 0 ? 0 : 1);
});
