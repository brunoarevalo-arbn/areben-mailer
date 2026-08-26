// Los datos de la tienda en UN lugar: `${tienda.envioGratis}` en vez del número
// escrito a mano adentro de cada mail.
//
//   node --import tsx scripts/probar-tienda.ts
//
// Cuatro cosas que tienen que ser ciertas para que esto sirva de algo:
//
//   1. **El número NO está adentro del Json.** El mismo documento sale con
//      $44.000 en BDI y con lo de Zattia en Zattia. Ése es el punto entero: hasta
//      el 22-ago-2026 el umbral estaba copiado en once documentos de BDI y los
//      once decían $50.000, seis mil pesos por encima del real, en una Bienvenida
//      que estaba ACTIVA.
//   2. **Un tag sin dato NUNCA sale crudo a una casilla.** Es el modo de falla
//      obvio de todo esto y el que el plan pidió atar con un ensayo. No sale el
//      tag, y tampoco sale la frase mutilada ("En compras mayores a ").
//   3. **La celda sigue existiendo.** Una barra de tres celdas con una vacía
//      queda coja: sin dato se cae el renglón del número, no la celda.
//   4. **El text/plain resuelve igual que el HTML.** Si sólo resolviera uno, el
//      mail saldría con el número en una mitad y con el tag en la otra — y la
//      que leen los filtros de spam es la de texto.
//
// ⚠️ El oráculo del punto 2 es **el HTML renderizado**, no la función que
// reemplaza: si mañana alguien agrega un campo de texto que el recorrido no
// toca, la función sigue en verde y el mail sale con el tag adentro.

import { leerTienda, resolverTienda, tagsSinDato, CAMPOS_TIENDA, type Tienda } from "../lib/email/tienda";
import { leerConfigCuenta, marcaDe } from "../lib/marca";
import { renderEmailHtml, renderEmailTexto, aplicarMergeTags, primerNombre } from "../lib/email/render";
import type { Bloque, ContenidoCampania } from "../lib/email/render";
import { presetsPara } from "../lib/plantillas/presets";

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};
const titulo = (s: string) => console.log(`\n${s}`);

const APP = "https://areben-mailer.vercel.app";
const BAJA = "https://ejemplo.com/baja?token=abc";

/** Los datos reales de BDI, confirmados por Bruno el 22-ago-2026. */
const BDI: Tienda = {
  envioGratis: "$44.000",
  cuotas: "3 cuotas sin interés",
  plazoCambio: "30 días desde que lo recibís",
  plazoDespacho: "24 h hábiles",
  local: "Santa Fe 1671, Rosario",
};

/** La barra de garantías tal cual la escribió `completar-secuencia-carrito.ts`,
 *  pero con los tags en lugar de los números. */
const barra = (): Bloque =>
  ({
    id: "garantias",
    tipo: "columnas",
    variante: "textos",
    movil: "fila",
    celdas: [
      { url: "", imagen: "", icono: "envio", titulo: "Envíos gratis", texto: "En compras mayores a ${tienda.envioGratis}" },
      { url: "", imagen: "", icono: "tarjeta", titulo: "Cuotas sin interés", texto: "${tienda.cuotas}" },
      { url: "", imagen: "", icono: "cambios", titulo: "Cambios y devoluciones", texto: "${tienda.plazoCambio}" },
    ],
  }) as unknown as Bloque;

/** Un párrafo de texto RICO con el tag en un trozo del medio, como el de reseña. */
const parrafoRico = (): Bloque =>
  ({
    id: "cambios",
    tipo: "texto",
    align: "center",
    texto: [
      { t: "Tenés " },
      { t: "${tienda.plazoCambio}" },
      { t: " para cambiarlo: ", }, 
      { t: "escribinos", url: "https://wa.me/5493411111111", subrayado: true },
    ],
  }) as unknown as Bloque;

const doc = (bloques: Bloque[]): ContenidoCampania => ({ bloques } as ContenidoCampania);

const render = (c: ContenidoCampania, tienda?: Tienda) =>
  renderEmailHtml(c, { unsubscribeUrl: BAJA, nombreCuenta: "BDI", tienda });
const texto = (c: ContenidoCampania, tienda?: Tienda) =>
  renderEmailTexto(c, { unsubscribeUrl: BAJA, nombreCuenta: "BDI", tienda });

// ─── El dato vive en la cuenta, no en el documento ───────────────────────────
titulo("El número sale de la cuenta y no del Json");
{
  const d = doc([barra()]);
  const antes = JSON.stringify(d);

  const bdi = render(d, BDI);
  ok(bdi.includes("En compras mayores a $44.000"), "el umbral de BDI entra al HTML");
  ok(bdi.includes("3 cuotas sin interés"), "las cuotas entran al HTML");

  const otra = render(d, { envioGratis: "$99.999", cuotas: "6 cuotas", plazoCambio: "15 días" });
  ok(otra.includes("En compras mayores a $99.999"), "el MISMO documento sale con el número de la otra marca");
  ok(!otra.includes("$44.000"), "…y sin rastro del de BDI");

  ok(JSON.stringify(d) === antes, "🔴 el documento NO se modifica al renderizar (el Json no lleva el número adentro)");
}

// ─── El modo de falla obvio: un tag sin dato ─────────────────────────────────
titulo("Un tag sin dato no llega a una casilla");
{
  const d = doc([barra()]);
  const html = render(d, {});

  ok(!html.includes("${tienda."), "🔴 no sale NI UN tag crudo en el HTML", (/\$\{tienda\.[a-z]+\}/i.exec(html) ?? [])[0] ?? "");
  ok(!html.includes("En compras mayores a"), "tampoco sale la frase mutilada sin el número");
  ok(html.includes("Envíos gratis"), "🔑 la celda sobrevive con su título: la barra no queda coja");
  ok(html.includes("Cambios y devoluciones"), "…las tres celdas siguen ahí");

  const t = texto(d, {});
  ok(!t.includes("${tienda."), "no sale ni un tag crudo en el text/plain");

  // Una clave que no existe cae por el mismo lado que una sin dato.
  const inventado = render(doc([{ id: "x", tipo: "texto", align: "left", texto: "Hola ${tienda.pepe} chau" } as unknown as Bloque]), BDI);
  ok(!inventado.includes("${tienda."), "una clave inventada tampoco sale cruda");
  ok(!inventado.includes("Hola"), "…y se lleva el renglón entero, no deja media frase");
}

// ─── Texto rico: se cae el trozo, no el bloque ───────────────────────────────
titulo("En un texto con formato se cae el TROZO");
{
  const d = doc([parrafoRico()]);
  const con = render(d, BDI);
  ok(con.includes("Tenés 30 días desde que lo recibís para cambiarlo"), "con dato, la frase queda entera");

  const sin = render(d, {});
  ok(!sin.includes("${tienda."), "🔴 sin dato no sale el tag crudo");
  ok(sin.includes("escribinos"), "el link del final sobrevive: no se cae el bloque entero");
  // ⚠️ El patrón mira el `<a …>` CON su apertura: un `>\s*</a>` pelado matchea
  // el cierre de cualquier etiqueta anidada (`</span></a>`) y da rojo de mentira.
  ok(!/<a\b[^>]*>\s*<\/a>/.test(sin), "no queda ningún <a> vacío");
}

// ─── El text/plain resuelve lo mismo que el HTML ─────────────────────────────
titulo("Las dos partes del mail dicen lo mismo");
{
  const d = doc([barra(), parrafoRico()]);
  const t = texto(d, BDI);
  ok(t.includes("$44.000"), "el umbral está en el text/plain");
  ok(t.includes("30 días desde que lo recibís"), "el plazo de cambio también");
}

// ─── La puerta de entrada: config → marcaDe → render ─────────────────────────
titulo("El camino completo, desde Cuenta.config");
{
  const cuenta = { nombre: "BDI", config: { logo: "https://cdn/bdi.png", tienda: BDI } };
  const marca = marcaDe(cuenta, APP);
  ok(marca.tienda?.envioGratis === "$44.000", "marcaDe() lleva los datos adentro de la marca");

  const html = renderEmailHtml(doc([barra()]), { unsubscribeUrl: BAJA, ...marca });
  ok(html.includes("$44.000"), "🔑 un call site que hace {...marcaDe(cuenta)} no tiene que acordarse de nada");

  // Traer la marca de TN no puede pisar esto: TN no sabe nada de estos datos.
  const leido = leerConfigCuenta({ tienda: BDI, tema: { idioma: "es" } });
  ok(leido.tienda?.cuotas === "3 cuotas sin interés", "leerConfigCuenta lo devuelve");
}

// ─── Validación al leer ──────────────────────────────────────────────────────
titulo("Lo que se guarda no se cree");
{
  ok(leerTienda(undefined) === undefined, "sin config no hay datos");
  ok(leerTienda({}) === undefined, "un objeto vacío es lo mismo que no tener nada");
  ok(leerTienda({ envioGratis: "   " }) === undefined, "un campo en blanco no cuenta como cargado");
  ok(leerTienda({ envioGratis: 44000 }) === undefined, "un número no es un texto: se descarta");
  ok(leerTienda({ pepe: "hola" }) === undefined, "una clave que no está en la lista no entra");
  const largo = leerTienda({ envioGratis: "x".repeat(500) });
  const max = CAMPOS_TIENDA.find((c) => c.clave === "envioGratis")!.max;
  ok(largo?.envioGratis?.length === max, `el texto se corta en el máximo del campo (${max})`);
}

// ─── El reporte de lo que falta ──────────────────────────────────────────────
titulo("Qué le falta a este documento");
{
  const d = doc([barra(), parrafoRico()]);
  ok(tagsSinDato(d, BDI).length === 0, "con todo cargado no falta nada");
  const faltan = tagsSinDato(d, { envioGratis: "$44.000" });
  ok(faltan.join(",") === "cuotas,plazoCambio", "nombra exactamente las claves sin dato", faltan.join(","));
  ok(tagsSinDato(d, undefined).length === 3, "sin datos ninguno, las tres");
}

// ─── Un documento sin tags no paga nada ──────────────────────────────────────
titulo("Un mail que no usa tags");
{
  const d = doc([{ id: "t", tipo: "titulo", align: "left", texto: "Hola" } as unknown as Bloque]);
  ok(resolverTienda(d, BDI) === d, "🔑 se devuelve el MISMO objeto: sin tags no se copia el árbol");
  ok(render(d, BDI).includes("Hola"), "…y el mail sale igual que siempre");
}

// ─── Paso 4: el mail nuevo nace con la barra ─────────────────────────────────
titulo("Un mail nuevo nace con la barra puesta");
{
  const conDatos = presetsPara({ nombre: "BDI", config: { url: "https://bdi.com.ar", tienda: BDI } });
  const sinDatos = presetsPara({ nombre: "Marca Nueva", config: { url: "https://nueva.com" } });
  ok(conDatos.length === sinDatos.length, "la misma cantidad de plantillas en los dos casos");

  const barra = (p: { contenido: ContenidoCampania }) =>
    (p.contenido.bloques ?? []).filter(
      (b) => b.tipo === "columnas" && (b as { variante?: string }).variante === "textos",
    );

  // 🔴 Lo que NO puede pasar: una tienda que no cargó nada nace prometiendo
  // envío gratis. Es el bloque `cupon` de nuevo — el bloque se borra, la
  // promesa no.
  const conTags = conDatos.filter((p) => JSON.stringify(p.contenido).includes("${tienda."));
  ok(conTags.length > 0, `las plantillas nacen con tags (${conTags.length} de ${conDatos.length})`);
  ok(
    !JSON.stringify(sinDatos).includes("${tienda."),
    "🔴 una cuenta SIN datos cargados no nace con ni un tag ni una promesa de más",
  );

  // 🔑 El invariante NO es "una sola barra": dos presets tienen dos filas de
  // texto propias a propósito ("Cupón y porcentajes" pone los porcentajes en una
  // y los beneficios en otra). Lo que se exige es que la barra de la marca
  // aparezca SOLO donde no había ninguna.
  const mal = conDatos
    .map((p, i) => {
      const antes = barra(sinDatos[i]).length;
      const esperado = antes === 0 ? 1 : antes;
      return barra(p).length === esperado ? null : `${p.nombre}: ${antes} → ${barra(p).length} (esperado ${esperado})`;
    })
    .filter(Boolean);
  ok(mal.length === 0, "la barra de la marca se agrega SOLO donde no había ninguna", mal.join(" · "));

  // El que ya traía una barra escrita adentro se queda con la suya y nada más.
  const yaTenia = conDatos.filter((p, i) => barra(sinDatos[i]).length > 0);
  ok(
    yaTenia.every((p) => !JSON.stringify(barra(p)).includes("${tienda.")),
    `los ${yaTenia.length} presets con barra propia no reciben la de la marca`,
  );

  // Y la barra que nace, renderizada, dice los números de la cuenta.
  const conBarra = conDatos.find((p) => JSON.stringify(barra(p)).includes("${tienda.envioGratis}"));
  ok(!!conBarra, "al menos una nace con la barra de la marca");
  if (conBarra) {
    const html = renderEmailHtml(conBarra.contenido, { unsubscribeUrl: BAJA, nombreCuenta: "BDI", tienda: BDI });
    ok(html.includes("En compras mayores a $44.000"), "…y renderiza el umbral real");
    ok(!html.includes("${tienda."), "…sin dejar ni un tag crudo");
  }
}

// ─── El saludo usa un NOMBRE, no un nombre y apellido ────────────────────────
//
// 🔴 Medido el 26-ago-2026: 16.660 de los 16.842 contactos de BDI con nombre
// cargado (99%) tienen un espacio adentro. "Hola ${contacto.nombre}" le llega a
// casi todo el mundo como "Hola Luana Sotelo".
titulo("${contacto.primerNombre}");
{
  ok(primerNombre("Luana Sotelo") === "Luana", "se queda con el primer token");
  ok(primerNombre("Martin Miguel Boubila") === "Martin", "y con UNO solo, no adivina compuestos");
  ok(primerNombre("  Elian   Peña ") === "Elian", "aguanta espacios de más");
  ok(primerNombre("Ian") === "Ian", "un nombre suelto queda igual");
  // ⚠️ Sin nombre devuelve vacío, igual que `${contacto.nombre}`: el saludo
  // tiene que estar escrito para funcionar vacío en los dos casos.
  ok(primerNombre(null) === "" && primerNombre("") === "", "sin nombre, vacío");

  const html = 'Hola ${contacto.primerNombre}, tu compra ${contacto.nombre} <${contacto.email}>';
  const sale = aplicarMergeTags(html, { nombre: "Luana Sotelo", email: "l@x.com" });
  ok(sale === "Hola Luana, tu compra Luana Sotelo <l@x.com>", "los tres tags conviven", sale);
  // 🔴 El tag largo no puede quedar a medias: un `${contacto.nombre}` que se
  // reemplaza ANTES dejaría `${contacto.primerLuana Sotelo}` en la casilla.
  ok(!sale.includes("${contacto."), "y no queda ningún tag mordido");
}

console.log(fallas === 0 ? "\n✅ Datos de tienda OK\n" : `\n❌ ${fallas} fallas\n`);
process.exit(fallas === 0 ? 0 : 1);
