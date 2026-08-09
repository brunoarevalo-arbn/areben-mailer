// `precioOculto` apaga el precio en las DOS mitades del mail, no sólo en el HTML.
//
//   node --import tsx scripts/probar-precio-oculto.ts
//
// 🔴 **Por qué existe**: hasta el 9-ago-2026 `precioOculto` sólo lo miraba el
// HTML. La parte `text/plain` —que viaja en cada envío y que es una de las cosas
// que lee el filtro— mandaba los precios igual. Se cazó armando el T02 de BDI,
// cuya grilla los tiene apagados **justo porque están mal cargados**: dos fundas
// del mismo tipo a $14.990 y $1.490, un factor de 10 de diferencia. El mail
// mostraba una cosa y su mitad de texto otra, en la casilla de 838 personas.
//
// 🔑 La invariante no es "que no salga el precio", es **que las dos mitades del
// mail digan lo mismo**. Un dato que se decide ocultar y se filtra por el otro
// lado es peor que no tener la perilla: quien la apaga cree que ya está.
import { renderEmailHtml, renderEmailTexto } from "../lib/email/render";
import { V_ACTUAL } from "../lib/email/esquema";
import { claveProductos, type Bloque, type ContenidoCampania } from "../lib/email/bloques";

let fallos = 0;
function ok(cond: boolean, que: string, detalle = "") {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    console.log(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
    fallos++;
  }
}

const OPTS = { unsubscribeUrl: "https://x/baja", nombreCuenta: "BDI" };
const doc = (bloques: Bloque[]): ContenidoCampania => ({ v: V_ACTUAL, bloques } as ContenidoCampania);
const html = (bloques: Bloque[]) => renderEmailHtml(doc(bloques), OPTS);
const texto = (bloques: Bloque[]) => renderEmailTexto(doc(bloques), OPTS);

const ITEMS = [
  { nombre: "SHINY CASE", url: "https://t.test/p/shiny", imagen: "https://t.test/i/1.jpg", precio: "14990.00" },
  { nombre: "SAM CASE", url: "https://t.test/p/sam", imagen: "https://t.test/i/2.jpg", precio: "1490.00", precioPromo: "990.00" },
];
const PRECIOS = ["$14.990", "$1.490", "$990"];

const grilla = (precioOculto: boolean): Bloque => ({ tipo: "productos", items: ITEMS, precioOculto } as unknown as Bloque);
// La grilla automática es el mismo bloque con la consulta en vez de los items:
// sus productos llegan por `opts`, así que hay que pasarlos por ahí.
//
// ⚠️ La llave se CALCULA con `claveProductos`, no se escribe a mano: es la misma
// función que usa el renderer, así que el día que cambie de forma este ensayo se
// mueve con ella en vez de ponerse rojo por una llave desactualizada. (Escrita a
// mano, el primer intento decía `novedades::2` y la fuente se llama `recientes`.)
const CONSULTA = { fuente: "recientes", n: 2 } as const;
const DIN = { tipo: "productos-dinamicos", ...CONSULTA } as unknown as Bloque;
const optsDin = { ...OPTS, productosDinamicos: { [claveProductos(CONSULTA)]: ITEMS } };

console.log("\n1) Con `precioOculto`, ningún precio en NINGUNA de las dos mitades");
{
  const h = html([grilla(true)]);
  const t = texto([grilla(true)]);
  for (const pr of PRECIOS) {
    ok(!h.includes(pr), `el HTML no dice ${pr}`);
    ok(!t.includes(pr), `el text/plain no dice ${pr}`);
  }
  // Lo que sí tiene que seguir estando: sin esto el ensayo pasaría con la grilla vacía.
  ok(t.includes("SHINY CASE") && t.includes("SAM CASE"), "los productos siguen saliendo en el texto");
  ok(t.includes("https://t.test/p/shiny"), "y con su link");
}

console.log("\n2) Sin `precioOculto` los precios salen, como siempre");
{
  const h = html([grilla(false)]);
  const t = texto([grilla(false)]);
  ok(h.includes("$14.990"), "el HTML dice $14.990");
  ok(t.includes("$14.990"), "el text/plain dice $14.990");
  // Con promo mandan las dos el vigente. El tachado es cosa del HTML.
  ok(t.includes("$990"), "el text/plain usa el precio de promo cuando hay");
  ok(!t.includes("$1.490"), "y no el de lista");
}

console.log("\n3) La grilla automática se porta igual (es el mismo campo)");
{
  const conOculto = renderEmailTexto(doc([{ ...DIN, precioOculto: true } as Bloque]), optsDin);
  const sinOculto = renderEmailTexto(doc([{ ...DIN, precioOculto: false } as Bloque]), optsDin);
  ok(conOculto.includes("SHINY CASE"), "resuelve los productos de `opts`");
  for (const pr of PRECIOS) ok(!conOculto.includes(pr), `con precioOculto, el texto no dice ${pr}`);
  ok(sinOculto.includes("$14.990"), "sin precioOculto, el texto sí");
}

console.log("\n4) El carrito NO se toca: ahí el precio es el asunto del mail");
{
  const carrito = [{ ...ITEMS[0], cantidad: 2 }];
  const t = texto([{ tipo: "carrito", items: carrito } as unknown as Bloque]);
  ok(t.includes("$14.990"), "el carrito abandonado sigue mostrando el precio");
  ok(t.includes("2 u."), "y la cantidad");
}

console.log(fallos === 0 ? "\n✅ todo en verde\n" : `\n❌ ${fallos} fallas\n`);
process.exit(fallos === 0 ? 0 : 1);
