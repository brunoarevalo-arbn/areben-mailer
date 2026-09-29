// Las piezas puras de la secuencia de carrito de 4 mails (29-sep-2026).
//
//   node --import tsx scripts/probar-secuencia-4.ts
//
// Lo que custodia, en el orden en que muerde:
//  1. El mail PERSONAL no dibuja lo que no es texto —ni el `carrito` que el
//     procesador agrega solo— en NINGUNA de sus dos mitades, y la baja sale igual.
//  2. `${cart.producto}` nombra lo que se dejó, escapado en el HTML y crudo en el
//     texto, y nunca sale literal.
//  3. El cupón dice de dónde sale, y un bloque sin `fuente` es `emitir`, o sea el
//     3er mail de hoy sin moverse.
//  4. Un vencimiento sólo-fecha se lee tal cual (antes salía un día antes).
//  5. El grupo de control: 0% es nadie, siempre el mismo grupo para el mismo
//     carrito, y ~el % pedido sobre ids correlativos.
import { renderEmailHtml, renderEmailTexto } from "../lib/email/render.ts";
import { leerContenido, V_ACTUAL } from "../lib/email/esquema.ts";
import { fuenteDeCupon, condicionesDe } from "../lib/email/cupon-carrito.ts";
import { nombreDelCarrito, resolverTagsCarrito } from "../lib/email/tags-carrito.ts";
import { grupoDeCarrito } from "../lib/carritos.ts";
import type { Bloque, ProductoEmail } from "../lib/email/bloques.ts";

let ok = 0, mal = 0;
const chk = (nombre: string, cond: unknown, extra = "") => {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { mal++; console.error(`  ✗ ${nombre}${extra ? `\n      ${extra}` : ""}`); }
};
const titulo = (s: string) => console.log(`\n${s}`);

const opts = { unsubscribeUrl: "https://x.test/baja?c=1", nombreCuenta: "BDI Accesorios", direccionPostal: "Santa Fe 1671" };
const productos: ProductoEmail[] = [
  { nombre: "BROWNIE CASE", precio: "13990", imagen: "https://x.test/a.jpg", url: "https://x.test/p/1" },
  { nombre: "Dua <Case>", precio: "14990", imagen: "https://x.test/b.jpg", url: "https://x.test/p/2" },
];

titulo("1 · El mail personal es texto y nada más");
{
  const bloques: Bloque[] = [
    { id: "a", tipo: "encabezado" } as Bloque,
    { id: "b", tipo: "texto", texto: "Hola ${contacto.primerNombre}," },
    { id: "c", tipo: "imagen", url: "https://x.test/foto.jpg", alt: "foto" },
    { id: "d", tipo: "carrito", items: productos },
    { id: "e", tipo: "texto", texto: [{ t: "Volver: " }, { t: "mi carrito", url: "${cart.url}" }] },
    { id: "f", tipo: "cupon", texto: "Tu descuento:", destacado: "10% OFF", codigo: "BDI-ABC123", botonTexto: "", botonUrl: "", condiciones: "Válido hasta el 06/10" },
  ];
  const doc = leerContenido({ v: V_ACTUAL, bloques, formato: "personal" });
  chk("`formato` sobrevive a leerContenido", doc.formato === "personal");
  chk("y un valor inventado no", leerContenido({ v: V_ACTUAL, bloques, formato: "raro" }).formato === undefined);
  // Por el camino lento también (un documento viejo, sin `v`).
  chk("también por el camino lento", leerContenido({ bloques: [{ tipo: "texto", texto: "x" }], formato: "personal" }).formato === "personal");

  const html = renderEmailHtml(doc, opts);
  const texto = renderEmailTexto(doc, opts);
  chk("sin tablas de maquetación", !/<table/i.test(html));
  chk("sin la foto", !html.includes("foto.jpg") && !texto.includes("foto.jpg"));
  chk("sin el carrito (ni en el HTML ni en el texto)", !html.includes("BROWNIE") && !texto.includes("BROWNIE"));
  chk("el texto sí sale", html.includes("Hola ${contacto.primerNombre},"));
  chk("el link al carrito sale como link común", /<a href="\$\{cart\.url\}"[^>]*>mi carrito<\/a>/.test(html), html.slice(0, 600));
  chk("el cupón sale como párrafo con el código", html.includes("10% OFF con el código BDI-ABC123") && texto.includes("BDI-ABC123"));
  chk("la baja sale en el HTML", html.includes(opts.unsubscribeUrl));
  chk("y en el texto", texto.includes(opts.unsubscribeUrl));
  chk("el domicilio sale", html.includes("Santa Fe 1671"));

  const conDiseno = renderEmailHtml({ ...doc, formato: undefined }, opts);
  chk("sin `formato`, el mismo documento es el mail con diseño de siempre", /<table/i.test(conDiseno) && conDiseno.includes("BROWNIE"));
}

titulo("2 · `${cart.producto}`");
{
  chk("uno solo: el nombre, legible", nombreDelCarrito([productos[0]]) === "Brownie Case", nombreDelCarrito([productos[0]]));
  chk("dos: «y 1 producto más»", nombreDelCarrito(productos) === "Brownie Case y 1 producto más", nombreDelCarrito(productos));
  chk("los recortados también cuentan", nombreDelCarrito(productos, 3) === "Brownie Case y 4 productos más", nombreDelCarrito(productos, 3));
  chk("sin productos: «lo que elegiste»", nombreDelCarrito([]) === "lo que elegiste" && nombreDelCarrito(undefined) === "lo que elegiste");
  chk("un nombre en minúsculas se respeta", nombreDelCarrito([{ ...productos[0], nombre: "funda iPhone" }]) === "funda iPhone");
  const c = { url: "https://t.test/c", productos: [productos[1]] };
  const h = resolverTagsCarrito("Dejaste ${cart.producto} en ${cart.url}", c, "html");
  const t = resolverTagsCarrito("Dejaste ${cart.producto} en ${cart.url}", c, "texto");
  chk("en el HTML va escapado", h === "Dejaste Dua &lt;Case&gt; en https://t.test/c", h);
  chk("en el texto va crudo", t === "Dejaste Dua <Case> en https://t.test/c", t);
  chk("no queda ningún tag", !h.includes("${") && !t.includes("${"));
}

titulo("3 · De dónde sale el cupón");
{
  const cupon = (fuente?: "recordar" | "recordar-o-emitir"): Bloque[] => [
    { tipo: "cupon", texto: "x", codigo: "CARRITO10", botonTexto: "", botonUrl: "", ...(fuente ? { fuente } : {}) },
  ];
  chk("sin `fuente` es `emitir` (el 3er mail de hoy, sin moverse)", fuenteDeCupon(cupon()) === "emitir");
  chk("`recordar` viaja", fuenteDeCupon(cupon("recordar")) === "recordar");
  chk("`recordar-o-emitir` viaja", fuenteDeCupon(cupon("recordar-o-emitir")) === "recordar-o-emitir");
  chk("sin bloque cupón, `emitir` (y `pideCupon` ya dijo que no)", fuenteDeCupon([]) === "emitir");
}

titulo("4 · Un vencimiento sólo-fecha se lee tal cual");
{
  const c = condicionesDe({ codigo: "X", valor: 10, vence: "2026-10-06" });
  chk("«2026-10-06» es el 06/10, no el 05/10", c.includes("06/10"), c);
}

titulo("5 · El grupo de control");
{
  chk("0% es nadie", grupoDeCarrito("2078646291", 0) === null);
  chk("un id raro recibe la secuencia", grupoDeCarrito("no-es-un-id", 50) === null);
  chk("el mismo carrito cae siempre en el mismo grupo", grupoDeCarrito("2078646205", 10) === grupoDeCarrito("2078646205", 10));
  let control = 0;
  for (let i = 0; i < 1000; i++) if (grupoDeCarrito(String(2078640000 + i), 10)) control++;
  chk("sobre 1000 ids correlativos, 10% cae al control", control === 100, `${control}`);
}

console.log(`\n${mal === 0 ? "✅ Todo en verde" : `❌ ${mal} fallas`} · ${ok} comprobaciones`);
process.exit(mal === 0 ? 0 : 1);
