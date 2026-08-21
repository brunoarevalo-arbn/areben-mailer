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
import { REDES, redConIcono, SIMPLE_CON_CLARO } from "../lib/email/redes";
import type { Bloque } from "../lib/email/bloques";
import { urlRegresiva } from "../lib/email/regresiva";

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
// ⚠️ Son CUATRO archivos por red desde el 5-ago-2026 —el de la pastilla, el del
// símbolo solo y las dos variantes plenas—, más un quinto en las dos de
// `SIMPLE_CON_CLARO`. El bloque puede pedir cualquiera y la que falte es un
// cuadradito roto en la casilla de otra persona, exactamente igual.
for (const r of REDES) {
  const sufijos = ["", "-simple", "-claro", "-oscuro"];
  if (SIMPLE_CON_CLARO.includes(r.slug)) sufijos.push("-simple-claro");
  for (const suf of sufijos) {
    ok(existsSync(`public/redes/${r.slug}${suf}.png`), `public/redes/${r.slug}${suf}.png existe (${r.nombre})`);
  }
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
const declarados = [...prefijos.matchAll(/'([^']+)'/g)].map((m) => m[1]);

// 🔴 **El chequeo NO nombra los directorios a mano, y esa es toda la lección.**
// Hasta el 21-ago-2026 acá había una lista literal `["/redes/", "/iconos/"]`, y
// ese día las estrellas del mail de reseña se deployaron con `/estrellas/`
// afuera de `PUBLIC_PREFIXES`: **307 a `/login`** en producción, con este chequeo
// en verde mirando otros dos directorios. Fue la TERCERA vez que pasa lo mismo.
//
// Ahora la lista sale del **HTML renderizado**: se dibuja un mail por cada bloque
// que sabe pedir un asset propio, se junta todo `src` que apunte a `assetsBase` y
// se exige que un prefijo lo cubra. Un directorio nuevo entra solo al oráculo el
// día que el renderer lo emite.
const CON_ASSETS: Array<{ nombre: string; bloques: Bloque[]; muestra?: boolean }> = [
  { nombre: "redes", bloques: [{ tipo: "redes", iconos: "pleno", links: [{ red: "Instagram", url: "https://x/y" }] } as Bloque] },
  {
    nombre: "columnas con ícono",
    bloques: [{ tipo: "columnas", variante: "iconos", celdas: [{ icono: "envio", titulo: "Envío", texto: "" }] } as unknown as Bloque],
  },
  // Las estrellas del pedido de reseña. `muestra` prende el carrito de ejemplo,
  // que es el único camino por el que este bloque dibuja algo sin un run real.
  { nombre: "estrellas del mail de reseña", bloques: [{ tipo: "carrito", modo: "resena" } as Bloque], muestra: true },
];

const dirsVistos = new Set<string>();
for (const caso of CON_ASSETS) {
  const h = renderEmailHtml({ bloques: caso.bloques }, { ...OPTS, assetsBase: HOST, muestraCarrito: caso.muestra });
  const srcs = [...h.matchAll(/src="([^"]+)"/g)].map((m) => m[1]).filter((u) => u.startsWith(HOST));
  ok(srcs.length > 0, `${caso.nombre}: emite al menos un asset propio (si no, este caso no prueba nada)`);
  // Deduplicado: cinco estrellas son cinco `src` al mismo archivo, y repetir la
  // misma comprobación cinco veces sólo hace ruido en la salida.
  for (const camino of new Set(srcs.map((u) => new URL(u).pathname))) {
    dirsVistos.add(camino);
    ok(
      declarados.some((pref) => camino.startsWith(pref)),
      `${caso.nombre}: ${camino} lo cubre un prefijo público del proxy`,
    );
  }
}
ok(dirsVistos.size > 0, "el barrido encontró assets que revisar");

console.log("\n1-ter) 🔴 …y el PNG de la cuenta regresiva también");
// Misma trampa que `/iconos/` y con la misma consecuencia, pero peor: acá lo que
// rebota al login no es un ícono de 24px al pie, es el bloque entero. Un 307 y
// la cuenta regresiva es un cuadradito roto en el medio del mail.
//
// 🔑 **No se compara contra un string escrito a mano**: se le pide la URL a
// `urlRegresiva` —la misma función que usa el renderer— y se pregunta si ALGÚN
// prefijo del proxy la cubre. Así, renombrar la ruta pone esto en rojo el mismo
// día en vez de dejar el chequeo verde mirando un camino que ya no existe.
const camino = new URL(
  urlRegresiva("https://links.zattia.com.ar", {
    hasta: "2026-12-24T23:59:00.000Z",
    ancho: 536,
    etiquetas: ["DÍAS", "HORAS", "MIN"],
    fin: "¡TERMINÓ!",
    bg: "#111111",
    tinta: "#ffffff",
    rotulo: "#ffffffb3",
  }),
).pathname;
ok(
  declarados.some((p) => camino.startsWith(p)),
  `el camino del PNG (${camino}) lo cubre un prefijo público del proxy`,
);

console.log("\n2) Una red conocida sale como icono");
const h1 = html([{ red: "Instagram", url: "https://instagram.com/zattia_co" }], HOST);
ok(h1.includes(`src="${HOST}/redes/instagram.png"`), "el src cuelga del host que se le pasó");
ok(h1.includes('alt="Instagram"'), "lleva alt (Outlook bloquea imágenes: el alt es lo único que se ve)");
ok(/<img[^>]*\bwidth="\d+"[^>]*\bheight="\d+"/.test(h1), "width/height como ATRIBUTOS, no solo en el style (Outlook ignora el CSS)");
ok(h1.includes('href="https://instagram.com/zattia_co"'), "el link sigue estando");

console.log("\n2-bis) 🔴 `pleno` elige la tinta por el FONDO, no por quien arma el mail");
// El sufijo es el color de la TINTA: `-claro` va sobre fondo oscuro. Invertirlo
// deja un icono blanco sobre fondo blanco, que no falla — desaparece.
const plenoClaro = renderEmailHtml(
  { bloques: [{ tipo: "redes", iconos: "pleno", links: [{ red: "Instagram", url: "https://x/y" }] } as Bloque] },
  { ...OPTS, assetsBase: HOST },
);
ok(plenoClaro.includes("/redes/instagram-oscuro.png"), "sobre el tema claro va la tinta OSCURA");
const plenoOscuro = renderEmailHtml(
  {
    bloques: [{ tipo: "redes", iconos: "pleno", links: [{ red: "Instagram", url: "https://x/y" }] } as Bloque],
    tema: { fondo: "#0b0b0b", fondoContenido: "#141414" },
  } as never,
  { ...OPTS, assetsBase: HOST },
);
ok(plenoOscuro.includes("/redes/instagram-claro.png"), "sobre un tema oscuro va la tinta CLARA");
// Ausente = como salió siempre. Es lo que impide que un default nuevo le cambie
// el cierre a toda campaña y plantilla ya guardada.
ok(h1.includes("/redes/instagram.png"), "sin `iconos`, el de color de siempre");

console.log("\n2-quater) 🔴 `simple` sólo cambia de archivo en las dos que lo necesitan");
// El símbolo de TikTok y el de X son NEGROS: sobre un mail oscuro el TikTok deja
// sólo el halo cian y rosa, y la X no deja nada. El resto trae su propio color y
// **no** tiene que cambiar de archivo — si lo hiciera, sería un 404.
const simple = (red: string, oscuro: boolean) =>
  renderEmailHtml(
    {
      bloques: [{ tipo: "redes", iconos: "simple", links: [{ red, url: "https://x/y" }] } as Bloque],
      ...(oscuro ? { tema: { fondo: "#0b0b0b", fondoContenido: "#141414" } } : {}),
    } as never,
    { ...OPTS, assetsBase: HOST },
  );
ok(simple("TikTok", false).includes("/redes/tiktok-simple.png"), "TikTok sobre claro: el símbolo negro");
ok(simple("TikTok", true).includes("/redes/tiktok-simple-claro.png"), "TikTok sobre oscuro: la versión clara");
ok(simple("X", true).includes("/redes/x-simple-claro.png"), "X sobre oscuro: la versión clara");
ok(simple("WhatsApp", true).includes("/redes/whatsapp-simple.png"), "WhatsApp sobre oscuro: el MISMO archivo (ya trae color)");
ok(simple("Facebook", true).includes("/redes/facebook-simple.png"), "Facebook sobre oscuro: el MISMO archivo");

console.log("\n2-ter) 🔴 Un sitio web tiene icono y no sale como «Otra»");
// Era el agujero de la lista: la única salida para la web propia era la opción
// "Otra (sin icono)", y el mail salía con la palabra «Otra» en texto.
const hWeb = html([{ red: "Sitio web", url: "https://zattia.com.ar" }], HOST);
ok(hWeb.includes("/redes/web.png"), "«Sitio web» dibuja su icono");
ok(!hWeb.includes(">Otra<"), "no queda ningún «Otra» de texto");

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
