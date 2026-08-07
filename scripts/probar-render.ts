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
import { claveProductos, type Bloque } from "../lib/email/bloques";
import { renderEmailHtml, renderEmailTexto, type ContenidoCampania } from "../lib/email/render";
import { ESTILO_CUPON_COMPACTO } from "../lib/email/estilos";
import { presetsPara } from "../lib/plantillas/presets";

/** Una cuenta de mentira para instanciar los presets. */
const CUENTA = { nombre: "Marca de prueba", config: { url: "https://ejemplo.com" } };

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

/**
 * Las dos formas del cupón, y las tres van ENTERAS por el mismo motivo que
 * `SIMPLE`: acá lo que se vigila son márgenes de un dígito, y un hash distinto
 * no dice cuál se movió.
 *
 * 🔑 La tercera es la que importa de verdad: una compacta **sin botón**, que es
 * donde los huecos internos colapsan a 0. La de siempre no colapsa nada —deja el
 * margen muerto aunque no haya nada abajo— y esa diferencia entre las dos es
 * justo lo que hay que poder ver moverse.
 */
const CUPONES = {
  bloques: [
    { tipo: "cupon", texto: "Usá este código en el checkout", codigo: "DESCUENTO10", botonTexto: "Comprar", botonUrl: "https://ejemplo.com" },
    { tipo: "cupon", variante: "compacta", texto: "Usá este código en el checkout", codigo: "DESCUENTO10", botonTexto: "Comprar", botonUrl: "https://ejemplo.com", estilo: ESTILO_CUPON_COMPACTO },
    { tipo: "cupon", variante: "compacta", texto: "Usá este código en el checkout", codigo: "DESCUENTO10", botonTexto: "", botonUrl: "", estilo: ESTILO_CUPON_COMPACTO },
  ],
} as unknown as ContenidoCampania;

/**
 * Dos productos de mentira para llenar TODA grilla dinámica del documento.
 *
 * 🔴 Sin esto el golden no ve la grilla, que es el bloque más grande de la
 * galería: `productos-dinamicos` **no dibuja nada** cuando no le llegan
 * productos —a propósito, para no mandar un hueco— y los productos viajan por
 * `opts`, no adentro del bloque. Medido el 2-ago-2026: el botón por tarjeta y la
 * alineación de la tarjeta se agregaron y el golden pasó en verde sin haberlos
 * dibujado una sola vez.
 *
 * Van dos y no seis: alcanza para una fila completa de la grilla de a dos y
 * para una incompleta en la de a tres, que son los dos caminos del `for`.
 */
const PRODUCTOS = [
  { nombre: "Producto uno", precio: "24990", precioPromo: "19990", imagen: "https://ejemplo.com/1.jpg", url: "https://ejemplo.com/p/1" },
  { nombre: "Producto dos", precio: "33990", imagen: "https://ejemplo.com/2.jpg", url: "https://ejemplo.com/p/2" },
];

/** El mapa `claveProductos(bloque) → productos` que espera `RenderOpts`. */
function conProductos(c: ContenidoCampania): Record<string, typeof PRODUCTOS> {
  const mapa: Record<string, typeof PRODUCTOS> = {};
  for (const b of c.bloques as Bloque[]) {
    if (b.tipo === "productos-dinamicos") mapa[claveProductos(b)] = PRODUCTOS;
  }
  return mapa;
}

function capturarTodo(): Record<string, string> {
  const out: Record<string, string> = {};
  out["simple.html"] = renderEmailHtml(SIMPLE, OPTS);
  out["simple.texto"] = renderEmailTexto(SIMPLE, OPTS);
  out["cupones.html"] = renderEmailHtml(CUPONES, OPTS);

  for (const p of presetsPara(CUENTA)) {
    const c = p.contenido;
    const opts = { ...OPTS, productosDinamicos: conProductos(c) };
    out[`${p.id}.html`] = sha(renderEmailHtml(c, opts));
    out[`${p.id}.texto`] = sha(renderEmailTexto(c, opts));
    // Con la muestra prendida: es lo que ve el editor, y es el camino donde el
    // carrito se dibuja. Sin esto, un cambio en el carrito no lo agarra nadie.
    out[`${p.id}.html.muestra`] = sha(renderEmailHtml(c, { ...opts, muestraCarrito: true }));
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

/** Los que se guardan enteros: cuando se mueven, el diff tiene que decir dónde. */
const ENTEROS = ["simple.html", "simple.texto", "cupones.html"] as const;

for (const clave of Object.keys(esperado)) {
  if ((ENTEROS as readonly string[]).includes(clave)) continue;
  ok(actual[clave] === esperado[clave], clave, `esperaba ${esperado[clave]}, salió ${actual[clave]}`);
}

for (const clave of ENTEROS) {
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
