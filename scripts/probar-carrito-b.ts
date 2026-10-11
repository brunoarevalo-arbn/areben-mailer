// «Carrito v2 · B» (11-oct-2026): los datos calculados del carrito, la franja con
// bloques adentro, el botón doble, las vistas nuevas del carrito y el cupón con
// filete. Puro: sin base y sin red.
//
//   node --import tsx scripts/probar-carrito-b.ts
import { normalizarCheckout, triggerDeCheckout } from "../lib/tn/checkouts.ts";
import { valoresCarrito, prepararCarrito, resolverCarritoEnTexto, resolverTagsCarrito, filasResumen, modeloDe } from "../lib/email/tags-carrito.ts";
import { montoEnvioGratis, cantidadCuotas } from "../lib/email/tienda.ts";
import { renderEmailHtml, renderEmailTexto, aplicarMergeTags } from "../lib/email/render.ts";
import { aplicarCuponDeCarrito, pideCupon } from "../lib/email/cupon-carrito.ts";
import { leerContenido, V_ACTUAL } from "../lib/email/esquema.ts";
import type { Bloque, ProductoEmail } from "../lib/email/bloques.ts";

let fallas = 0;
let total = 0;
const chk = (que: string, ok: boolean, detalle?: unknown) => {
  total++;
  if (!ok) fallas++;
  console.log(`  ${ok ? "✓" : "✗"} ${que}${ok || detalle === undefined ? "" : `\n      ${String(detalle).slice(0, 400)}`}`);
};

const TIENDA = { envioGratis: "$44.000", cuotas: "3 cuotas sin interés" };
const opts = { unsubscribeUrl: "https://x/baja", nombreCuenta: "BDI", tienda: TIENDA };
const prod = (nombre: string, precio: string, variante?: string): ProductoEmail => ({ nombre, precio, imagen: "https://img/x.jpg", url: "https://tienda/p", variante });

console.log("\n1 · El subtotal es de TODAS las líneas, no de las 6 dibujadas");
{
  const products = Array.from({ length: 8 }, (_, i) => ({ name: `CASE ${i}`, price: "10000.00", quantity: i === 0 ? 2 : 1, variant_values: ["iPhone 16"] }));
  const c = normalizarCheckout({ id: 1, total: "1.00", products, abandoned_checkout_url: "https://t/c" });
  chk("dibuja 6 y deja 2 en `restantes`", c.productos.length === 6 && c.restantes === 2);
  chk("subtotal = Σ precio × cantidad de las 8 (90.000)", c.subtotal === 90000, c.subtotal);
  chk("cantidad cuenta unidades (9)", c.cantidad === 9, c.cantidad);
  chk("🔴 no usa el `total` de TN (trae cupón y envío)", c.subtotal !== 1);
  const t = triggerDeCheckout(c);
  chk("viaja al run", t.subtotal === 90000 && t.cantidad === 9);
  const roto = normalizarCheckout({ id: 2, products: [{ name: "A", price: "x" }] });
  chk("un precio ilegible ⇒ subtotal null (no adivina)", roto.subtotal === null);
}

console.log("\n2 · El umbral y las cuotas, leídos del texto de la tienda");
chk("«$44.000» → 44000", montoEnvioGratis(TIENDA) === 44000);
chk("«$44.000,50» → 44000.5", montoEnvioGratis({ envioGratis: "$44.000,50" }) === 44000.5);
chk("«$44.000 en CABA» → null", montoEnvioGratis({ envioGratis: "$44.000 en CABA" }) === null);
chk("«3 cuotas sin interés» → 3", cantidadCuotas(TIENDA) === 3);
chk("«6 cuotas» (sin «sin interés») → null", cantidadCuotas({ cuotas: "6 cuotas" }) === null);

console.log("\n3 · Los tags calculados");
{
  const p = [prod("BROWNIE CASE", "13990", "iPhone 17 Pro"), prod("MOO CASE", "13990", "iPhone 16"), prod("DUA", "1000", "iPhone 17 Pro · ROSA")];
  const borde = (subtotal: number) => valoresCarrito({ productos: p, subtotal, tienda: TIENDA });
  chk("43.999 ⇒ «Te faltan $1 para el envío gratis»", borde(43999).envio === "Te faltan $1 para el envío gratis", borde(43999).envio);
  chk("44.000 ⇒ «Tu pedido ya tiene envío gratis»", borde(44000).envio === "Tu pedido ya tiene envío gratis");
  chk("cuota con centavos (100 / 3 = $33,33)", valoresCarrito({ productos: p, subtotal: 100, tienda: TIENDA }).cuotas === "3 cuotas de $33,33");
  chk("modelos sin repetir y en orden", borde(1).modelos === "iPhone 17 Pro y iPhone 16", borde(1).modelos);
  chk("el modelo se elige entre los valores de la variante", modeloDe(p[2]) === "iPhone 17 Pro");
  chk("líneas en Tipo Título con su modelo", borde(1).lineas?.startsWith("Brownie Case — iPhone 17 Pro\nMoo Case — iPhone 16") === true, borde(1).lineas);
  const sinTienda = valoresCarrito({ productos: p, subtotal: 50000 });
  chk("sin umbral ni cuotas ⇒ sin dato (no inventa)", !sinTienda.envio && !sinTienda.cuotas && sinTienda.total === "$50.000");
  chk("resumen: 4 renglones, el total en negrita", JSON.stringify(filasResumen({ productos: p, subtotal: 50000, cantidad: 3, tienda: TIENDA })) ===
    JSON.stringify([{ etiqueta: "Tu carrito", monto: "3 productos" }, { etiqueta: "Total", monto: "$50.000", fuerte: true }, { etiqueta: "Envío", monto: "Gratis" }, { etiqueta: "En cuotas", monto: "3 × $16.666,67 sin interés" }]));
}

console.log("\n3b · Quien retira en el local no escucha del envío gratis");
{
  const base = { id: 1, products: [{ name: "A", price: "50000.00", variant_values: ["iPhone 16"] }] };
  const local = normalizarCheckout({ ...base, shipping_pickup_type: "pickup", shipping_option_code: "01KS2JJ53SJ8HCFJ2J0QQ4JK1X" });
  const correo = normalizarCheckout({ ...base, shipping_pickup_type: "pickup", shipping_option_code: "ne-correo-arg-clasico-sucursal" });
  const casa = normalizarCheckout({ ...base, shipping_pickup_type: "ship", shipping_option_code: "table_5943722" });
  chk("retiro en el LOCAL (código propio) ⇒ retiroEnLocal", local.retiroEnLocal && triggerDeCheckout(local).retiroEnLocal === true);
  chk("🔴 «Punto de retiro» del correo (`ne-…`) NO es el local", !correo.retiroEnLocal);
  chk("a domicilio NO es el local", !casa.retiroEnLocal);
  const t = { ...TIENDA, plazoDespacho: "24 h hábiles" };
  const v = valoresCarrito({ productos: local.productos, subtotal: 50000, retiroEnLocal: true, tienda: t });
  chk("la frase habla del retiro, con el plazo de la tienda", v.envio === "Lo retirás por el local en 24 h hábiles", v.envio);
  chk("⛔ ni «envío gratis» ni «listo»", !/env[ií]o gratis|listo/i.test(`${v.envio} ${v.envioCorto}`));
  chk("el resumen dice «Retiro»", filasResumen({ subtotal: 50000, cantidad: 1, retiroEnLocal: true, tienda: t }).some((f) => f.etiqueta === "Retiro" && f.monto === "En el local, en 24 h hábiles"));
}

console.log("\n4 · Un tag sin dato se lleva su frase, y nunca sale crudo");
{
  const bloques: Bloque[] = [
    { id: "a", tipo: "texto", texto: "Son **${cart.total}**, en ${cart.cuotas}." },
    { id: "b", tipo: "texto", texto: [{ t: "Hola " }, { t: "${cart.envio}" }] },
    { id: "c", tipo: "boton", texto: "Ir", url: "${cart.url}" },
  ];
  const r = prepararCarrito(bloques, { productos: [], subtotal: 50000 });
  const t0 = (r[0] as { texto: string }).texto;
  const t1 = (r[1] as { texto: { t: string }[] }).texto;
  chk("frase con un tag sin dato ⇒ vacía", t0 === "", t0);
  chk("trozo con un tag sin dato ⇒ se cae el trozo", Array.isArray(t1) && t1.length === 1 && t1[0].t === "Hola ", JSON.stringify(t1));
  chk("`${cart.url}` se deja para después", (r[2] as { url: string }).url === "${cart.url}");
  chk("el barrido final borra cualquier `${cart.x}`", resolverTagsCarrito("a ${cart.pepe} b", { url: "u" }, "html") === "a  b");
  chk("preheader sin dato ⇒ no sale", resolverCarritoEnTexto("${cart.envio}", { productos: [] }) === undefined);
}

console.log("\n5 · El saludo que funciona vacío");
chk("con nombre: «Hola Luana,»", aplicarMergeTags("${contacto.saludo}", { nombre: "Luana Sotelo", email: "x" }) === "Hola Luana,");
chk("sin nombre: «Hola,» (no «Hola ,»)", aplicarMergeTags("${contacto.saludo}", { nombre: "", email: "x" }) === "Hola,");

console.log("\n6 · La franja: hijos con la paleta de su fondo, y el cupón adentro también se resuelve");
{
  const banda: Bloque = {
    id: "f", tipo: "banda", fondo: "#1b1717", base: "oscuro", acento: "#ffffff",
    bloques: [
      { id: "t", tipo: "titulo", texto: "Adentro" },
      { id: "k", tipo: "cupon", variante: "marco", texto: "Tu código", codigo: "CARRITO10", botonTexto: "", botonUrl: "", fuente: "recordar" },
    ],
  };
  const doc = leerContenido({ v: V_ACTUAL, bloques: [banda] });
  const html = renderEmailHtml(doc, opts);
  chk("pinta el fondo (y `bgcolor` para Outlook)", html.includes('bgcolor="#1b1717"'));
  chk("el título de adentro sale claro sobre negro", /<h1[^>]*color:#(f|e)[0-9a-f]{5}[^>]*>Adentro/i.test(html), html.match(/<h1[^>]*>/)?.[0]);
  chk("pideCupon ve el cupón de adentro", pideCupon(doc.bloques));
  const sin = aplicarCuponDeCarrito(doc.bloques, null);
  chk("sin cupón, el de adentro se BORRA", !JSON.stringify(sin).includes("CARRITO10"));
  const con = aplicarCuponDeCarrito(doc.bloques, { codigo: "BDI-ABC123", valor: 20, vence: "2026-10-18", minCompra: 0 });
  chk("con cupón, el de adentro se REEMPLAZA", JSON.stringify(con).includes("BDI-ABC123") && !JSON.stringify(con).includes("CARRITO10"));
  const texto = renderEmailTexto(doc, opts);
  chk("el texto plano incluye a los hijos", texto.includes("Adentro"));
  const anidada = leerContenido({ v: V_ACTUAL, bloques: [{ ...banda, bloques: [{ ...banda, id: "g" }, { id: "e", tipo: "encabezado" }] }] });
  const hijos = (anidada.bloques.find((b) => b.tipo === "banda") as { bloques: Bloque[] }).bloques;
  chk("⛔ ni bandas adentro de bandas, ni encabezado adentro", hijos.length === 0, JSON.stringify(hijos));
}

console.log("\n7 · El botón doble y Montserrat: sus reglas sólo salen si el mail las usa");
{
  const simple = renderEmailHtml(leerContenido({ v: V_ACTUAL, bloques: [{ id: "b", tipo: "boton", texto: "Uno", url: "https://a" }] }), opts);
  const doble = renderEmailHtml(leerContenido({ v: V_ACTUAL, tema: { fuente: "montserrat" }, bloques: [{ id: "b", tipo: "boton", texto: "Uno", url: "https://a", segundo: { texto: "Dos", url: "https://b" } }] }), opts);
  chk("sin botón doble no hay regla `m-btn2`", !simple.includes("m-btn2"));
  chk("con botón doble: las dos celdas y la regla", (doble.match(/class="m-btn2"/g) ?? []).length === 2 && doble.includes(".m-btn2{"));
  chk("los dos con borde (mismo alto)", (doble.match(/border:2px solid/g) ?? []).length >= 2);
  chk("dos VML, uno por botón", (doble.match(/<v:roundrect/g) ?? []).length === 2);
  chk("el link de Montserrat sólo con esa fuente", doble.includes("fonts.googleapis.com/css2?family=Montserrat") && !simple.includes("fonts.googleapis.com"));
  chk("y escondido de Outlook", /<!--\[if !mso\]><!--><link href="https:\/\/fonts/.test(doble));
  chk("el texto plano lleva los dos destinos", renderEmailTexto(leerContenido({ v: V_ACTUAL, bloques: [{ id: "b", tipo: "boton", texto: "Uno", url: "https://a", segundo: { texto: "Dos", url: "https://b" } }] }), opts).includes("Dos: https://b"));
}

console.log("\n8 · Las vistas del carrito y el cupón con filete");
{
  const items = [prod("BROWNIE CASE", "13990", "iPhone 17 Pro"), prod("MOO CASE", "13990", "iPhone 16")];
  const r = (b: Bloque) => renderEmailHtml(leerContenido({ v: V_ACTUAL, bloques: [b] }), opts);
  chk("por modelo: una pastilla por teléfono", (r({ id: "c", tipo: "carrito", vista: "por-modelo", items }).match(/PARA IPHONE/g) ?? []).length === 2);
  chk("tira: «Brownie Case y 1 producto más»", r({ id: "c", tipo: "carrito", vista: "tira", items }).includes("<strong>Brownie Case</strong> y 1 producto más"));
  chk("resumen sin renglones ⇒ no se dibuja", !r({ id: "c", tipo: "carrito", vista: "resumen", items }).includes("TOTAL"));
  const marco = r({ id: "k", tipo: "cupon", variante: "marco", texto: "Tu código", destacado: "20% OFF", codigo: "BDI-ABC123", botonTexto: "", botonUrl: "", condiciones: "Válido hasta el 18/10" });
  chk("🔴 el cupón con filete va en UNA columna (no ensancha el celular)", !/<td[^>]*>[^<]*20% OFF/.test(marco) && /<div[^>]*font-style:italic[^>]*>20% OFF/.test(marco));
  chk("sin el borde cortado de la caja", !marco.includes("dashed"));
}

console.log(`\n${fallas ? `❌ ${fallas} fallas` : "✅ Todo en verde"} · ${total} comprobaciones\n`);
process.exit(fallas ? 1 : 0);
