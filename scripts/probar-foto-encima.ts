// Una foto con títulos, textos y BOTONES encima: el bloque `foto-encima`.
//
//   node --import tsx scripts/probar-foto-encima.ts
//
// 🔴 **Por qué existe la feature**: el motor podía poner texto sobre una foto
// —`hero`/`seccion` con `fondoImagen`— pero en un solo lugar y en un solo orden
// (título, bajada, botón, apilados y centrados). Poner un botón en una esquina, o
// dos, no era expresable. Y no se resuelve con capas: **un mail no puede
// superponer nada** (`position` lo borra Gmail y lo ignora Outlook), así que lo de
// encima se dibuja como una TABLA adentro de la banda.
//
// Las cuatro invariantes que este archivo cuida, y ninguna es "que ande":
//
//   1. 🔴 **El condicional de Outlook no se cierra antes de tiempo.** El interior
//      de la banda se inserta dentro de un `<!--[if mso]>`, y el primer `-->` que
//      aparezca ahí adentro lo CIERRA: el VML del botón —que trae sus propios
//      comentarios— dejaría el resto a la vista. El oráculo no es que el HTML
//      "tenga" el botón: es que **el HTML sin comentarios no tenga una sola
//      etiqueta VML**, porque eso es exactamente lo que ve un navegador.
//   2. **La banda mide lo que dice medir.** `arriba` más los altos de las filas
//      tiene que dar el alto de la banda, o la foto de fondo sale cortada o sobra
//      color abajo. Outlook mide filas y no mide texto: el número es todo.
//   3. **Nada se pisa.** Dos elementos montados no pueden salir como celdas que
//      sumen más de 100: en Outlook eso desborda la banda y se lleva el mail.
//      Salen corridos, que es lo que una tabla sí puede dibujar.
//   4. **La versión de texto no queda vacía.** Un mail cuyo protagonista es una
//      foto con su CTA encima, sin `text/plain`, es la señal de spam clásica — y
//      es de ahí que el buzón saca el preview.
import { renderEmailHtml, renderEmailTexto } from "../lib/email/render";
import { armarPlano, MAX_ELEMENTOS } from "../lib/email/encima";
import { leerContenido, V_ACTUAL } from "../lib/email/esquema";
import type { Bloque, ContenidoCampania, ElementoEncima } from "../lib/email/bloques";

let fallos = 0;
function ok(cond: boolean, que: string, detalle = "") {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    console.log(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
    fallos++;
  }
}

const OPTS = { unsubscribeUrl: "https://x/baja", nombreCuenta: "BDI" };
// `V_ACTUAL` y no un documento pelado: sin `v`, `leerContenido` migra y le
// materializa un encabezado, y estaríamos midiendo otro mail.
const doc = (bloques: Bloque[]): ContenidoCampania => ({ v: V_ACTUAL, bloques } as ContenidoCampania);
const html = (bloques: Bloque[]) => renderEmailHtml(doc(bloques), OPTS);
const texto = (bloques: Bloque[]) => renderEmailTexto(doc(bloques), OPTS);

const FOTO = "https://ejemplo.test/portada.jpg";
const DESTINO = "https://bdiaccesorios.com.ar/girlhood/";

const bloque = (elementos: Partial<ElementoEncima>[], extra: Record<string, unknown> = {}): Bloque =>
  ({
    tipo: "foto-encima",
    foto: FOTO,
    alto: 400,
    bg: "#111111",
    velo: 40,
    elementos: elementos.map((el, i) => ({ id: `e${i}`, clase: "texto", texto: "Algo", x: 0, y: 0, ...el })),
    ...extra,
  }) as Bloque;

/** El HTML sin los comentarios condicionales: lo que un navegador ve de verdad. */
const sinComentarios = (h: string) => h.replace(/<!--[\s\S]*?-->/g, "");

console.log("\n1) El plano: la banda mide lo que dice medir");
{
  const plano = armarPlano(
    [
      { id: "a", clase: "titulo", texto: "T", x: 5, y: 10 },
      { id: "b", clase: "boton", texto: "B", x: 5, y: 70 },
    ],
    400,
  );
  const suma = plano.arriba + plano.filas.reduce((n, f) => n + f.alto, 0);
  ok(suma === 400, "arriba + los altos de las filas dan el alto de la banda", `dio ${suma}`);
  ok(plano.arriba === 40, "el aire de arriba sale del `y` del primero (10% de 400)", `dio ${plano.arriba}`);
  ok(plano.filas.length === 2, "dos alturas distintas ⇒ dos filas", `dio ${plano.filas.length}`);
  // La primera fila termina donde arranca la segunda: 280 - 40.
  ok(plano.filas[0].alto === 240, "la fila de arriba llega hasta la de abajo", `dio ${plano.filas[0].alto}`);
}

console.log("\n2) 🔑 Dos cosas a la MISMA altura son UNA fila, no dos");
{
  // 40 y 42: arrastrando con el dedo nadie clava dos veces el mismo número, y sin
  // la tolerancia esto abriría una fila de 2% de alto con el texto desbordándola.
  const plano = armarPlano(
    [
      { id: "a", clase: "boton", texto: "Uno", x: 5, y: 40 },
      { id: "b", clase: "boton", texto: "Dos", x: 55, y: 42 },
    ],
    400,
  );
  ok(plano.filas.length === 1, "40 y 42 caen en la misma fila", `dio ${plano.filas.length}`);
  const conEl = plano.filas[0]?.celdas.filter((c) => c.el) ?? [];
  ok(conEl.length === 2, "y los dos están, uno al lado del otro", `dio ${conEl.length}`);
  // Separados de verdad: dos filas.
  const lejos = armarPlano(
    [
      { id: "a", clase: "boton", texto: "Uno", x: 5, y: 40 },
      { id: "b", clase: "boton", texto: "Dos", x: 55, y: 60 },
    ],
    400,
  );
  ok(lejos.filas.length === 2, "40 y 60 son dos filas", `dio ${lejos.filas.length}`);
}

console.log("\n3) 🔴 Nada se pisa: las celdas de una fila suman 100 SIEMPRE");
{
  const casos: { que: string; els: Partial<ElementoEncima>[] }[] = [
    { que: "uno solo, sin ancho", els: [{ x: 20, y: 50 }] },
    { que: "dos separados", els: [{ x: 0, y: 50, ancho: 40 }, { x: 50, y: 50, ancho: 40 }] },
    // El caso que importa: el segundo arranca ADENTRO del primero.
    { que: "montados: el segundo arranca dentro del primero", els: [{ x: 10, y: 50, ancho: 60 }, { x: 30, y: 50, ancho: 60 }] },
    { que: "los dos en el mismo x", els: [{ x: 40, y: 50 }, { x: 40, y: 50 }] },
    { que: "uno pegado al borde derecho", els: [{ x: 100, y: 50 }] },
    { que: "anchos imposibles", els: [{ x: 0, y: 50, ancho: 100 }, { x: 5, y: 50, ancho: 100 }] },
  ];
  for (const { que, els } of casos) {
    const plano = armarPlano(
      els.map((el, i) => ({ id: `e${i}`, clase: "texto", texto: "x", x: 0, y: 0, ...el }) as ElementoEncima),
      400,
    );
    for (const f of plano.filas) {
      const suma = f.celdas.reduce((n, c) => n + c.pct, 0);
      ok(suma === 100, `${que}: la fila suma 100`, `sumó ${suma} en ${f.celdas.map((c) => c.pct).join("+")}`);
    }
  }
}

console.log("\n4) Un elemento SIN texto no ocupa lugar (es como se lo saca sin borrarlo)");
{
  const plano = armarPlano(
    [
      { id: "a", clase: "titulo", texto: "   ", x: 5, y: 10 },
      { id: "b", clase: "titulo", texto: "Sí", x: 5, y: 60 },
    ],
    400,
  );
  ok(plano.filas.length === 1, "queda una sola fila", `dio ${plano.filas.length}`);
  ok(plano.arriba === 240, "y el aire de arriba es el del que SÍ tiene texto", `dio ${plano.arriba}`);
  ok(armarPlano([], 400).filas.length === 0, "sin elementos, no hay filas");
}

console.log("\n5) 🔴 El condicional de Outlook NO se cierra antes de tiempo");
{
  // Dos botones: es el caso que obligó a partir el interior en dos ramas. Con una
  // sola cadena compartida, el `-->` del primer botón cierra el `<!--[if mso]>` y
  // el VML del segundo sale a la vista en Gmail.
  const h = html([
    bloque([
      { clase: "boton", texto: "Ver mujer", url: DESTINO, x: 5, y: 70, ancho: 40 },
      { clase: "boton", texto: "Ver hombre", url: DESTINO, x: 50, y: 70, ancho: 40 },
    ]),
  ]);
  const visible = sinComentarios(h);
  ok(!/<v:/.test(visible), "el HTML que ve un navegador no tiene NI UNA etiqueta VML", `quedó: ${/<v:[^>]*>/.exec(visible)?.[0] ?? ""}`);
  ok(!visible.includes("<![endif]"), "ni un `<![endif]` suelto");
  // Los dos caminos existen, cada uno en su rama.
  ok((h.match(/<v:roundrect/g) ?? []).length === 2, "Outlook recibe los DOS botones en VML");
  ok((visible.match(/>Ver mujer<|>Ver hombre</g) ?? []).length === 2, "y el resto de los clientes recibe los dos anclas");
  // La misma regla de `probar-banda-link`: jamás un `<a>` adentro de otro.
  ok(!/<a[^>]*>(?:(?!<\/a>)[\s\S])*<a/.test(visible), "ningún `<a>` adentro de otro");
  // Balance de comentarios condicionales: cada apertura tiene su cierre.
  const abre = (h.match(/<!--\[if/g) ?? []).length;
  const cierra = (h.match(/<!\[endif\]-->/g) ?? []).length;
  ok(abre === cierra, `los condicionales cierran (${abre} abren, ${cierra} cierran)`);
}

console.log("\n6) La banda: la foto va de fondo y el alto se acota");
{
  const h = html([bloque([{ clase: "titulo", texto: "Girlhood", x: 8, y: 60 }])]);
  ok(h.includes(`url(${FOTO})`), "la foto va como background-image");
  ok(/<v:fill[^>]*type="frame"/.test(h), "y Outlook la recibe por <v:fill>");
  ok(h.includes("min-height:400px"), "la banda mide el alto pedido");
  ok(/height="\d+"/.test(h), "las filas llevan el alto en el atributo `height` (Outlook mide filas)");
  // El velo pinta el color encima de la foto para que el texto se lea.
  ok(h.includes("linear-gradient(rgba(17,17,17,0.40)"), "el velo pinta el color de `bg` encima");
  const alto = (b: unknown) => /min-height:(\d+)px/.exec(html([b as Bloque]))?.[1];
  ok(alto(bloque([{ texto: "x", y: 50 }], { alto: 5000 })) === "600", "un alto de 5000 se acota a 600");
  ok(alto(bloque([{ texto: "x", y: 50 }], { alto: 10 })) === "120", "y uno de 10 sube a 120");
}

console.log("\n7) Sin foto no se dibuja nada (un hueco es peor que nada)");
{
  const h = html([bloque([{ clase: "titulo", texto: "Girlhood", x: 8, y: 60 }], { foto: "" })]);
  ok(!h.includes("Girlhood"), "sin foto, el bloque no aporta ni su título");
  ok(!h.includes("background-image"), "ni la banda");
}

console.log("\n8) 🔴 La versión de texto no queda vacía, y el link sale");
{
  const t = texto([
    bloque([
      { clase: "titulo", texto: "Girlhood Collection", x: 5, y: 20 },
      { clase: "texto", texto: "Hasta el **domingo**", x: 5, y: 45 },
      { clase: "boton", texto: "Ver la colección", url: DESTINO, x: 5, y: 75, ancho: 40 },
    ]),
  ]);
  ok(t.includes("Girlhood Collection"), "el título está");
  ok(t.includes(`Ver la colección: ${DESTINO}`), "el botón sale como texto + URL");
  // El orden es el vertical, que es lo único que sobrevive de la ubicación.
  ok(t.indexOf("Girlhood") < t.indexOf("Ver la colección"), "en el orden de arriba para abajo");
  // El texto SÍ interpreta `**`, el título NO: la versión de texto tiene que
  // decir lo mismo que el mail, no lo mismo que el otro campo.
  ok(t.includes("Hasta el domingo"), "al texto se le borran los asteriscos, como en el HTML");
}

console.log("\n9) El saneo: lo que entra amontonado queda GUARDADO sano");
{
  // 🔴 **Sin `v` a propósito.** Con `v: V_ACTUAL` este documento entraría por el
  // camino rápido de `esActual()`, que NO sanea, y las cinco aserciones de abajo
  // darían rojo midiendo un saneo que nunca corrió. La red del camino rápido es
  // otra y se mide en §10: el renderer.
  const sucio = {
    bloques: [
      {
        tipo: "foto-encima",
        foto: FOTO,
        bg: "#000000",
        elementos: [
          { clase: "inventada", texto: "Cae a texto", x: -50, y: 300 },
          { clase: "boton", texto: "Ok", url: "javascript:alert(1)", x: 10, y: 20, ancho: "ancho" },
          "no soy un objeto",
          ...Array.from({ length: 20 }, (_, i) => ({ clase: "texto", texto: `de más ${i}`, x: 1, y: 1 })),
        ],
      },
    ],
  };
  const c = leerContenido(sucio);
  // Un documento sin `v` se MIGRA, y la migración le materializa un encabezado
  // adelante: el bloque se busca por tipo, no por posición.
  const b = c.bloques.find((x) => x.tipo === "foto-encima") as Extract<Bloque, { tipo: "foto-encima" }>;
  ok(b.elementos.length === MAX_ELEMENTOS, `la lista se corta en ${MAX_ELEMENTOS}`, `quedaron ${b.elementos.length}`);
  ok(b.elementos[0].clase === "texto", "una clase inventada cae a `texto` (la que no promete nada)");
  ok(b.elementos[0].x === 0 && b.elementos[0].y === 100, "las coordenadas quedan en rango", JSON.stringify(b.elementos[0]));
  ok(b.elementos.every((el) => !!el.id), "todos salen con id propio");
  ok(b.elementos[1].ancho === undefined, "un `ancho` ilegible se BORRA (caer a 100 taparía a los de al lado)");
  // El esquema no filtra la URL: el filtro es del emisor, porque `esActual()`
  // saltea el saneo de los documentos ya guardados. Misma doctrina que el
  // `enlace` del bloque `imagen`.
  const h = renderEmailHtml(c, OPTS);
  ok(!h.includes("javascript:"), "🔴 y el `javascript:` no llega al HTML (lo frena `sanearUrl` al emitir)");
}

console.log("\n10) 🔑 El camino RÁPIDO no sanea: la red de abajo es el renderer");
{
  // El mismo Json amontonado, pero con el `v` puesto: `esActual()` lo deja pasar
  // sin tocarlo (es la doctrina de `esquema.ts`, no un olvido). O sea que lo único
  // que impide que un documento así rompa el mail es lo que hace el renderer, y
  // eso es lo que se mide acá — no que el saneo lo haya arreglado.
  const sucio = {
    v: V_ACTUAL,
    bloques: [
      {
        tipo: "foto-encima",
        foto: FOTO,
        alto: 9999,
        bg: "#000000",
        elementos: [
          { clase: "boton", texto: "Ok", url: "javascript:alert(1)", x: 10, y: 20, ancho: 90 },
          { clase: "boton", texto: "Dos", url: DESTINO, x: 12, y: 21, ancho: 90 },
          { clase: "texto", texto: "Tres", x: "no soy un número", y: 21 },
        ],
      },
    ],
  };
  const h = renderEmailHtml(sucio as unknown as ContenidoCampania, OPTS);
  const visible = sinComentarios(h);
  ok(!h.includes("javascript:"), "el `javascript:` no sale ni por el camino rápido");
  ok(!/<v:/.test(visible), "el VML sigue escondido del navegador");
  // 🔴 La aserción que de verdad importa: una fila cuyas celdas sumen más de 100
  // desborda la banda en Outlook y se lleva el resto del mail.
  const filas = [...visible.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map((m) => [...m[1].matchAll(/width="(\d+)%"/g)].map((w) => Number(w[1])))
    .filter((ws) => ws.length > 0);
  ok(filas.length > 0, "hay filas con ancho que mirar", `filas: ${filas.length}`);
  for (const ws of filas) {
    const suma = ws.reduce((a, n) => a + n, 0);
    ok(suma === 100, `la fila del HTML suma 100 (${ws.join("+")})`, `sumó ${suma}`);
  }
  ok(h.includes("min-height:600px"), "y el alto imposible salió acotado a 600");
}

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ La foto con cosas encima sale como se pidió");
process.exit(fallos ? 1 : 0);
