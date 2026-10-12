// El carrito «de tienda» de Zattia (12-oct-2026). Lógica pura: sin base, sin red.
//
//   node --import tsx scripts/probar-carrito-zattia.ts
//
// Lo que fija:
//   1. `${cart.retiro}` SÓLO habla si eligió retirar en el local. En Zattia el
//      envío no se nombra nunca por el carrito (Bruno, 12-oct: ⛔ «te faltan $X»):
//      con un carrito mediano de $26.990 contra un umbral de $150.000, la frase
//      le diría a casi todos que le falta mucho.
//   2. `${cart.entrega}` / `${cart.entregaDetalle}`: la tercera celda de las
//      garantías pasa de «ENVÍO GRATIS · desde $150.000» a «RETIRO · en el local».
//   3. La vista `tienda`: una fila por prenda con la foto 4:5, nombre, variante y
//      precio APILADOS (sin columna de precio a la derecha), y abajo el renglón
//      «N PRODUCTOS ····· $total» con su filete. ⛔ Sin `m-col`: no se apila.
//   4. La vista `galeria`: hasta tres fotos 4:5 (100 × 125) en fila con el nombre, la
//      variante y el precio DEBAJO de cada una, y «+ n más» si hay más.
import { valoresCarrito, prepararCarrito } from "../lib/email/tags-carrito.ts";
import { renderEmailHtml, renderEmailTexto } from "../lib/email/render.ts";
import { V_ACTUAL } from "../lib/email/esquema.ts";
import type { Bloque, ProductoEmail } from "../lib/email/bloques.ts";

let fallas = 0;
const ok = (cond: boolean, que: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${que}`);
  if (!cond) fallas++;
};
const titulo = (s: string) => console.log(`\n${s}`);

const TIENDA = { envioGratis: "$150.000", plazoDespacho: "24 h hábiles", local: "Santa Fe 1435, Rosario", plazoCambio: "30 días" };
const p = (n: string, precio: string, promo?: string, variante?: string): ProductoEmail => ({
  nombre: n, precio, ...(promo ? { precioPromo: promo } : {}), ...(variante ? { variante } : {}),
  imagen: `https://cdn/${n.replace(/\s/g, "-")}.jpg`, url: `https://zattia.com.ar/${n.replace(/\s/g, "-")}`,
});
const TRES = [p("TOP JARA", "16990", "9990", "NEGRO"), p("TOP RISE", "14490", "6690", "Blanco"), p("TOP SAHARA", "19990", "9990", "CHOCOLATE")];
const CUATRO = [...TRES, p("BLUSA DAISY", "37490")];

// ─── 1 y 2. Los tags nuevos ──────────────────────────────────────────────────
titulo("`${cart.retiro}` y `${cart.entrega…}`");
{
  const domicilio = valoresCarrito({ productos: TRES, subtotal: 26670, tienda: TIENDA });
  const retira = valoresCarrito({ productos: TRES, subtotal: 26670, retiroEnLocal: true, tienda: TIENDA });
  ok(domicilio.retiro === undefined, "a domicilio, `retiro` no tiene dato (la frase se cae)");
  ok(retira.retiro === "Lo retirás por el local en 24 h hábiles", "retiro en el local: «Lo retirás por el local en 24 h hábiles»");
  ok(domicilio.entrega === "Envío gratis" && domicilio.entregaDetalle === "desde $150.000", "a domicilio: ENVÍO GRATIS · desde $150.000");
  ok(retira.entrega === "Retiro" && retira.entregaDetalle === "en el local, Santa Fe 1435, Rosario", "retira: RETIRO · en el local, Santa Fe 1435, Rosario");
  ok(!/falta/i.test(JSON.stringify([domicilio.retiro, domicilio.entrega, domicilio.entregaDetalle])), "ninguno de los tres dice «te faltan»");
  const sinTienda = valoresCarrito({ productos: TRES, subtotal: 26670 });
  ok(sinTienda.entrega === undefined && sinTienda.entregaDetalle === undefined, "sin umbral cargado, la celda de envío no promete nada");
  const retiraSinLocal = valoresCarrito({ productos: TRES, retiroEnLocal: true, tienda: { plazoDespacho: "24 h hábiles" } });
  ok(retiraSinLocal.entrega === "Retiro" && retiraSinLocal.entregaDetalle === "en el local", "retira sin domicilio cargado: «en el local» a secas");
}

// ─── 3. La vista `tienda` ────────────────────────────────────────────────────
const doc = (bloques: Bloque[]) => ({ v: V_ACTUAL, bloques });
const OPTS = { unsubscribeUrl: "#", nombreCuenta: "Zattia", tienda: TIENDA };
const carrito = (vista: "tienda" | "galeria", items: ProductoEmail[], restantes = 0): Bloque =>
  ({ id: "c", tipo: "carrito", vista, items, restantes } as Bloque);

titulo("La vista `tienda`");
{
  const bloques = prepararCarrito([carrito("tienda", TRES)], { productos: TRES, subtotal: 26670, cantidad: 3, tienda: TIENDA });
  const html = renderEmailHtml(doc(bloques), OPTS);
  ok(/width="96" height="120"/.test(html), "la foto es 4:5 (96 × 120)");
  ok(TRES.every((x) => html.includes(x.nombre)), "salen las tres prendas");
  ok(html.includes("NEGRO") && html.includes("CHOCOLATE"), "sale la variante");
  ok(/line-through[^>]*>\$16\.990/.test(html) && html.includes("$9.990"), "el precio tachado y el de oferta");
  ok(!/<td width="22%"/.test(html), "sin la columna de precio a la derecha (va apilado debajo del nombre)");
  ok(html.includes("3 PRODUCTOS") && html.includes("$26.670"), "el renglón «3 PRODUCTOS · $26.670»");
  const fila = html.slice(html.indexOf("3 PRODUCTOS") - 400, html.indexOf("3 PRODUCTOS"));
  ok(/border-top:1px solid/.test(fila), "con su filete arriba");
  const cuerpo = html.slice(html.indexOf("TOP JARA") - 3000, html.indexOf("$26.670"));
  ok(!cuerpo.includes("m-col"), "⛔ ninguna celda del carrito se apila en el celular");
  const sinTotal = renderEmailHtml(doc(prepararCarrito([carrito("tienda", TRES)], { productos: TRES, tienda: TIENDA })), OPTS);
  ok(sinTotal.includes("3 PRODUCTOS") && !sinTotal.includes("$26.670"), "sin subtotal, el renglón dice la cantidad y no inventa un total");
  const texto = renderEmailTexto(doc(bloques), OPTS);
  ok(TRES.every((x) => texto.includes(x.nombre)), "el text/plain nombra las tres");
}

// ─── 4. La vista `galeria` ───────────────────────────────────────────────────
titulo("La vista `galeria`");
{
  const html = renderEmailHtml(doc([carrito("galeria", CUATRO, 2)]), OPTS);
  ok((html.match(/width="100" height="125"/g) ?? []).length === 3, "tres fotos 4:5 (100 × 125), no cuatro");
  ok(!/height:auto/.test(html.slice(html.indexOf("TOP JARA") - 3000, html.indexOf("productos más"))), "con alto FIJO: cada foto de TN trae su proporción y la fila sale despareja");
  ok(TRES.every((x) => html.includes(x.nombre)) && !html.includes("BLUSA DAISY"), "con el nombre de las tres que se ven");
  ok(html.includes("NEGRO") && /line-through[^>]*>\$16\.990/.test(html), "y su variante y precio debajo");
  ok(html.includes("+ 3 productos más"), "«+ 3 productos más» (la cuarta + las 2 recortadas)");
  const cuerpo = html.slice(html.indexOf("TOP JARA") - 3000, html.indexOf("productos más"));
  ok(!cuerpo.includes("m-col"), "⛔ no se apila en el celular");
  const una = renderEmailHtml(doc([carrito("galeria", [TRES[0]])]), OPTS);
  ok(una.includes("TOP JARA") && !una.includes("productos más"), "con una sola prenda, sin «más»");
}

// ─── El carrito vacío sigue sin dibujarse ────────────────────────────────────
titulo("Sin prendas no hay bloque");
{
  for (const v of ["tienda", "galeria"] as const) {
    const html = renderEmailHtml(doc([carrito(v, [])]), OPTS);
    ok(!html.includes("PRODUCTOS") && !html.includes("<img src=\"https://cdn"), `vista ${v} vacía: nada`);
  }
}

if (fallas) { console.error(`\n${fallas} falla(s)`); process.exit(1); }
console.log("\nTodo bien.");
