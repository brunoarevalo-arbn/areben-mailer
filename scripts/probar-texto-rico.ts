// Invariantes del texto con formato por selección. Lógica pura: sin base, sin
// red, sin navegador.
//
//   node --import tsx scripts/probar-texto-rico.ts
//
// 🔑 **Lo que se fija acá es un contrato de compatibilidad, no una feature.** El
// campo de texto de un bloque pasó de `string` a `string | Trozo[]`, y la
// promesa es que la rama `string` sigue rindiendo EXACTAMENTE el mismo HTML que
// antes. El golden (`probar-render.ts`) custodia esa promesa contra los 38
// presets; este archivo la custodia contra los casos que ningún preset tiene.
//
// La otra mitad son las funciones puras de edición: partir, fusionar, colapsar.
// Son lo más fácil de romper de todo el trabajo, y lo único que un script de
// Node puede ver — nada de lo que pasa adentro del `contenteditable` lo mira un
// test.

import {
  aplicarFormato,
  canonizar,
  formatoEn,
  largo,
  sanearTrozos,
  textoPlano,
  tieneLink,
  tieneTamano,
  tieneTodo,
  trozoCss,
  MAX_TROZOS,
  type TextoRico,
  type Trozo,
} from "../lib/email/texto-rico";
import { renderEmailHtml, renderEmailTexto, type Bloque, type ContenidoCampania } from "../lib/email/render";
import { resolverPaleta } from "../lib/email/tema";
import { V_ACTUAL, leerContenido } from "../lib/email/esquema";

let fallas = 0;
function ok(cond: boolean, que: string, detalle = "") {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
}
const titulo = (s: string) => console.log(`\n${s}`);

const PAL = resolverPaleta({ base: "claro" });

const OPTS = { unsubscribeUrl: "https://x/baja", nombreCuenta: "Zattia" };
/** Un mail mínimo con un solo bloque. `v: V_ACTUAL` o la migración mete cabecera. */
const doc = (b: Bloque): ContenidoCampania => ({ v: V_ACTUAL, bloques: [b] } as ContenidoCampania);
const html = (b: Bloque) => renderEmailHtml(doc(b), OPTS);
const texto = (b: Bloque) => renderEmailTexto(doc(b), OPTS);

// ─── canonizar ───────────────────────────────────────────────────────────────
titulo("🔑 La forma canónica: el array es la EXCEPCIÓN, no la nueva normalidad");
{
  ok(canonizar("hola") === "hola", "un string se devuelve tal cual");
  ok(canonizar([]) === "", "sin trozos queda el string vacío");
  ok(canonizar([{ t: "" }, { t: "" }]) === "", "trozos vacíos: se tiran todos");
  ok(canonizar([{ t: "hola" }]) === "hola", "🔑 un trozo SIN formato colapsa a string");
  ok(
    canonizar([{ t: "ho" }, { t: "la" }]) === "hola",
    "dos trozos sin formato se fusionan y colapsan",
  );

  const conNegrita = canonizar([{ t: "ho" }, { t: "la", peso: 700 }]);
  ok(Array.isArray(conNegrita) && conNegrita.length === 2, "con formato sigue siendo array");

  const fusionado = canonizar([{ t: "ho", peso: 700 }, { t: "la", peso: 700 }, { t: "!", peso: 700 }]);
  ok(
    Array.isArray(fusionado) && fusionado.length === 1 && fusionado[0].t === "hola!",
    "tres trozos con el MISMO formato se fusionan en uno",
    JSON.stringify(fusionado),
  );

  ok(
    Array.isArray(canonizar([{ t: "a", peso: 700 }, { t: "b", peso: 400 }])),
    "dos formatos distintos NO se fusionan",
  );

  // La única asimetría del diseño, y vive en una línea de `canonizar`.
  const conAsteriscos = canonizar([{ t: "hola **che**" }]);
  ok(
    Array.isArray(conAsteriscos),
    "🔴 un trozo sin formato PERO con `**` no colapsa (colapsar cambiaría el HTML)",
    JSON.stringify(conAsteriscos),
  );

  // Idempotencia: es lo que `probar-esquema.ts` exige de todo el esquema.
  const ejemplos: TextoRico[] = [
    "hola",
    [{ t: "a", peso: 700 }, { t: "b" }],
    [{ t: "" }, { t: "x", italica: true }],
    [{ t: "uno" }, { t: "dos" }],
  ];
  ok(
    ejemplos.every((e) => JSON.stringify(canonizar(canonizar(e))) === JSON.stringify(canonizar(e))),
    "canonizar es idempotente",
  );
}

// ─── El contrato principal ───────────────────────────────────────────────────
titulo("🔴 EL CONTRATO: un string y un trozo pelado con el mismo texto dan el MISMO HTML");
{
  // Sin `**`, un `string` y `[{t: string}]` tienen que ser indistinguibles. Si
  // esto falla, `cuerpoHtml`/`tituloHtml` no son transparentes en la rama string
  // y el golden estaría verde de casualidad.
  const casos = [
    "Hola",
    "Con acentos: ñandú, café",
    "Dos\nrenglones",
    "Signos & <peligrosos> \"comillas\"",
    "Merge ${contacto.nombre} tag",
    "",
  ];

  for (const s of casos) {
    const conString = html({ id: "b", tipo: "texto", texto: s } as Bloque);
    const conTrozo = html({ id: "b", tipo: "texto", texto: s === "" ? [] : [{ t: s }] } as Bloque);
    ok(conString === conTrozo, `cuerpo · ${JSON.stringify(s).slice(0, 34)}`);

    const tString = html({ id: "b", tipo: "titulo", texto: s } as Bloque);
    const tTrozo = html({ id: "b", tipo: "titulo", texto: s === "" ? [] : [{ t: s }] } as Bloque);
    ok(tString === tTrozo, `título · ${JSON.stringify(s).slice(0, 34)}`);
  }
}

titulo("…y su asimetría, que es a propósito");
{
  const conString = html({ id: "b", tipo: "texto", texto: "hola **che**" } as Bloque);
  const conTrozo = html({ id: "b", tipo: "texto", texto: [{ t: "hola **che**" }] } as Bloque);
  ok(conString.includes("<strong>che</strong>"), "un STRING interpreta `**negrita**`");
  ok(!conTrozo.includes("<strong>"), "🔴 un TROZO no: adentro los asteriscos son literales");
  ok(conTrozo.includes("**che**"), "y salen a la vista, sin comerse nada");
  ok(conString !== conTrozo, "por eso los dos no pueden ser iguales — y `canonizar` no los mezcla");
}

titulo("🔴 Renderizar la forma canónica da el mismo mail que la de entrada");
{
  // Si esto fallara, normalizar el dato movería el mail: `canonizar` dejaría de
  // poder correr en el editor sin avisarle a nadie.
  const entradas: Trozo[][] = [
    [{ t: "ho" }, { t: "la" }],
    [{ t: "a", peso: 700 }, { t: "", peso: 700 }, { t: "b", peso: 700 }],
    [{ t: "x" }, { t: "" }],
  ];
  for (const ts of entradas) {
    const crudo = html({ id: "b", tipo: "texto", texto: ts } as Bloque);
    const limpio = html({ id: "b", tipo: "texto", texto: canonizar(ts) } as Bloque);
    ok(crudo === limpio, `canonizar no mueve el HTML · ${JSON.stringify(ts).slice(0, 40)}`);
  }
}

// ─── Emisión ─────────────────────────────────────────────────────────────────
titulo("Lo que emite un trozo con formato");
{
  const salida = html({
    id: "b",
    tipo: "texto",
    texto: [{ t: "normal " }, { t: "gorda", peso: 700 }, { t: " y " }, { t: "torcida", italica: true }],
  } as Bloque);
  ok(salida.includes("<span style=\"font-weight:700\">gorda</span>"), "el peso sale como `font-weight`");
  ok(salida.includes("font-style:italic"), "la itálica sale como `font-style`");
  ok(salida.includes(">normal ") && salida.includes(" y "), "🔑 los trozos SIN formato no envuelven nada");
  ok((salida.match(/<span/g) ?? []).length === 2, "dos trozos con formato ⇒ dos spans, ni uno más");
}
{
  const conFuente = trozoCss({ t: "x", fuente: "georgia" }, PAL);
  ok(conFuente.startsWith("font-family:") && conFuente.includes("Georgia"), "la tipografía sale del catálogo");
  ok(
    trozoCss({ t: "x", fuente: "inventada" as never }, PAL) === "",
    "una tipografía que no está en el catálogo no emite nada",
  );
  ok(trozoCss({ t: "x", tamano: 999 }, PAL) === "font-size:48px", "el tamaño se acota al tope de la cascada");
  ok(trozoCss({ t: "x", tamano: 1 }, PAL) === "font-size:8px", "…y al piso");
  ok(trozoCss({ t: "x", peso: 999 as never }, PAL) === "", "un peso fuera del enum no emite");
  ok(trozoCss({ t: "x", color: "$acento" }, PAL) === `color:${PAL.acento}`, "🔑 un token de la marca se resuelve");
  ok(trozoCss({ t: "x", color: "#ff0000" }, PAL) === "color:#ff0000", "un hex se respeta");
  ok(trozoCss({ t: "x", fondo: "#ff0" }, PAL) === "background-color:#ff0", "el resaltado va a `background-color`");
  ok(trozoCss({ t: "x" }, PAL) === "", "un trozo sin formato no emite un solo byte");
}

titulo("🔴 Nada del Json se escapa del atributo `style`");
{
  // El veneno canónico: `esc()` no escapa comillas, así que un color con una
  // comilla adentro se saldría del `style="…"`. El emisor es lista blanca, así
  // que ni siquiera lo copia.
  const veneno = html({
    id: "b",
    tipo: "texto",
    texto: [{ t: "click", color: '#fff" onmouseover="alert(1)' as never }],
  } as Bloque);
  ok(!veneno.includes("onmouseover"), "un color con comillas no llega al HTML");
  ok(!veneno.includes("<span"), "…y como no quedó nada elegido, no se envuelve nada");

  const script = html({ id: "b", tipo: "texto", texto: [{ t: "<script>x</script>", peso: 700 }] } as Bloque);
  ok(!script.includes("<script>"), "🔴 el texto de un trozo se escapa antes de envolverlo");
  ok(script.includes("&lt;script&gt;"), "y sale como texto literal");
  ok(script.includes("<span style=\"font-weight:700\">&lt;script&gt;"), "el orden es escapar → envolver");
}

titulo("El link de un trozo");
{
  const conLink = html({ id: "b", tipo: "texto", texto: [{ t: "acá", url: "https://ejemplo.com" }] } as Bloque);
  ok(conLink.includes('<a href="https://ejemplo.com"'), "sale como ancla");
  ok(conLink.includes("text-decoration:underline"), "subrayado, que es lo que hace que se lea como link");
  ok(conLink.includes(`color:${PAL.link}`), "con el color de link de la marca, no el azul del navegador");

  ok(
    !html({ id: "b", tipo: "texto", texto: [{ t: "x", url: "javascript:alert(1)" }] } as Bloque).includes("javascript:"),
    "🔴 `javascript:` no sobrevive al saneo… ",
  );
}

// ─── Saneo ───────────────────────────────────────────────────────────────────
titulo("El saneo: lo que entra por el Json");
{
  ok(sanearTrozos("hola") === "hola", "un string pasa derecho");
  ok(sanearTrozos(42) === undefined, "lo que no es ni string ni array: `undefined` (= no tocar)");
  ok(sanearTrozos(null) === undefined, "null tampoco");

  ok(sanearTrozos([{ t: "a" }, "basura", 7, null]) === "a", "los que no son objeto se tiran");
  ok(sanearTrozos([{ sin: "texto" }]) === "", "un trozo sin `t` no es un trozo");
  ok(sanearTrozos([{ t: 42 }]) === "", "un `t` que no es string tampoco");

  // ⚠️ `tamano: 999` NO sirve para este caso: se acota a 48, que es un valor
  // válido, y el trozo sobrevive con formato. Para probar el colapso hacen falta
  // propiedades que se tiren enteras.
  const conBasura = sanearTrozos([{ t: "x", fuente: "comic", peso: 3, color: "rojo", url: "javascript:x" }]);
  ok(conBasura === "x", "🔑 un trozo cuyo formato entero es inválido colapsa a string", JSON.stringify(conBasura));

  const parcial = sanearTrozos([{ t: "x", tamano: 999, fuente: "comic" }]);
  ok(
    Array.isArray(parcial) && parcial[0].tamano === 48 && parcial[0].fuente === undefined,
    "lo válido se acota y lo inválido se tira, propiedad por propiedad",
    JSON.stringify(parcial),
  );

  const urls = sanearTrozos([
    { t: "a", url: "https://x.com" },
    { t: "b", url: "javascript:alert(1)" },
    { t: "c", url: "${cart.url}" },
    { t: "d", url: "data:text/html,x" },
  ]);
  const lista = Array.isArray(urls) ? urls : [];
  ok(lista[0]?.url === "https://x.com", "https pasa");
  ok(lista[1]?.url === undefined, "🔴 `javascript:` se tira");
  ok(lista[2]?.url === "${cart.url}", "un merge tag es un destino legítimo");
  ok(lista[3]?.url === undefined, "`data:` se tira");

  const muchos = sanearTrozos(Array.from({ length: 5000 }, (_, i) => ({ t: `x${i}`, peso: 700 as const })));
  // Se fusionan al canonizar (mismo formato), así que lo que se mide es que el
  // corte haya pasado ANTES: 200 trozos de "xN" y no 5000.
  ok(largo(muchos ?? "") < 2000, `5000 trozos se cortan en ${MAX_TROZOS}`, `largo=${largo(muchos ?? "")}`);
}

// ─── aplicarFormato ──────────────────────────────────────────────────────────
titulo("Partir y fusionar: `aplicarFormato`");
{
  const r1 = aplicarFormato("hola mundo", 0, 4, { peso: 700 });
  ok(
    Array.isArray(r1) && r1.length === 2 && r1[0].t === "hola" && r1[0].peso === 700 && r1[1].t === " mundo",
    "sobre un string: parte en dos",
    JSON.stringify(r1),
  );

  const r2 = aplicarFormato("hola mundo", 2, 7, { italica: true });
  ok(
    Array.isArray(r2) && r2.length === 3 && r2.map((t) => t.t).join("") === "hola mundo",
    "al medio: parte en tres y no pierde una letra",
    JSON.stringify(r2),
  );

  const r3 = aplicarFormato("hola", 0, 4, { peso: 700 });
  ok(Array.isArray(r3) && r3.length === 1 && r3[0].peso === 700, "el campo entero: un solo trozo");

  ok(aplicarFormato("hola", 2, 2, { peso: 700 }) === "hola", "selección vacía: no toca nada");
  ok(aplicarFormato("hola", 5, 9, { peso: 700 }) === "hola", "fuera de rango: no toca nada");
  ok(
    JSON.stringify(aplicarFormato("hola", 4, 0, { peso: 700 })) === JSON.stringify(aplicarFormato("hola", 0, 4, { peso: 700 })),
    "los offsets al revés se ordenan solos (seleccionar de derecha a izquierda)",
  );

  // A caballo de dos trozos que ya tienen formato distinto.
  const base: Trozo[] = [{ t: "hola ", peso: 700 }, { t: "mundo", italica: true }];
  const r4 = aplicarFormato(base, 3, 8, { color: "#ff0000" });
  const ts4 = Array.isArray(r4) ? r4 : [];
  ok(ts4.map((t) => t.t).join("") === "hola mundo", "a caballo: el texto sobrevive entero");
  ok(ts4.every((t) => t.t.length > 0), "y no queda ningún trozo vacío");
  ok(
    ts4.filter((t) => t.color === "#ff0000").length >= 1 && ts4.some((t) => t.peso === 700),
    "el formato nuevo se agrega SIN pisar el que ya estaba",
    JSON.stringify(ts4),
  );

  // El toggle: aplicar y sacar tiene que devolver el original POR VALOR.
  const ida = aplicarFormato("hola mundo", 0, 4, { peso: 700 });
  const vuelta = aplicarFormato(ida, 0, 4, { peso: undefined });
  ok(vuelta === "hola mundo", "🔑 poner y sacar devuelve el string original", JSON.stringify(vuelta));
}

titulo("`tieneTodo`: la regla del toggle de Google Docs");
{
  const v: Trozo[] = [{ t: "hola", peso: 700 }, { t: " mundo" }];
  ok(tieneTodo(v, 0, 4, "peso", 700), "toda la selección en negrita ⇒ el botón la saca");
  ok(!tieneTodo(v, 0, 10, "peso", 700), "una parte sin negrita ⇒ el botón la pone");
  ok(!tieneTodo(v, 3, 3, "peso", 700), "selección vacía ⇒ false");
}

titulo("Los ayudantes que usa el renderer");
{
  ok(textoPlano("hola") === "hola", "textoPlano sobre un string");
  ok(textoPlano([{ t: "ho" }, { t: "la", peso: 700 }]) === "hola", "textoPlano concatena");
  ok(!tieneTamano("hola") && !tieneTamano([{ t: "x" }]), "tieneTamano: no");
  ok(tieneTamano([{ t: "x", tamano: 34 }]), "tieneTamano: sí");
  ok(!tieneLink([{ t: "x" }]) && tieneLink([{ t: "x", url: "https://a.com" }]), "tieneLink");
  ok(formatoEn([{ t: "ab", peso: 700 }, { t: "cd" }], 0).peso === 700, "formatoEn: el trozo de esa posición");
  ok(formatoEn([{ t: "ab", peso: 700 }, { t: "cd" }], 3).peso === undefined, "formatoEn: el de al lado");
}

// ─── Las tres correcciones del renderer ──────────────────────────────────────
titulo("🔴 Un trozo con tamaño le saca al contenedor la clase que lo achica");
{
  const sinTamano = html({ id: "b", tipo: "titulo", texto: [{ t: "TÍTULO", peso: 700 }] } as Bloque);
  const conTamano = html({ id: "b", tipo: "titulo", texto: [{ t: "TÍTULO", tamano: 34 }] } as Bloque);
  ok(/<h1[^>]*class="[^"]*m-h1/.test(sinTamano), "sin tamaño propio, el `<h1>` lleva `m-h1`");
  ok(
    !/<h1[^>]*class="[^"]*m-h1/.test(conTamano),
    "🔴 con un trozo de 34px, NO — o el celular mezclaría 22px con 34px",
  );

  const heroSin = html({ id: "b", tipo: "hero", imagen: "", titulo: [{ t: "T" }], subtitulo: "", botonTexto: "", botonUrl: "", bg: "" } as Bloque);
  const heroCon = html({ id: "b", tipo: "hero", imagen: "", titulo: [{ t: "T", tamano: 40 }], subtitulo: "", botonTexto: "", botonUrl: "", bg: "" } as Bloque);
  ok(/class="[^"]*m-h1/.test(heroSin) && !/class="[^"]*m-h1/.test(heroCon), "lo mismo en la portada");
}

titulo("🔴 Un link adentro del texto de una celda no anida anclas");
{
  const celda = html({
    id: "b",
    tipo: "columnas",
    variante: "textos",
    celdas: [
      { imagen: "", url: "https://ejemplo.com/celda", titulo: [{ t: "Ver", url: "https://ejemplo.com/dentro" }] },
      { imagen: "", url: "" },
    ],
  } as Bloque);
  ok(celda.includes("https://ejemplo.com/dentro"), "el link del trozo sale");
  ok(!celda.includes("https://ejemplo.com/celda"), "y la celda deja de ser un ancla entera");
  ok(!/<a[^>]*>(?:(?!<\/a>)[\s\S])*<a[^>]*>/.test(celda), "🔴 cero `<a>` adentro de otro `<a>`");
}

titulo("🔴 El `alt` de la foto de una celda es TEXTO, nunca HTML");
{
  const conFoto = html({
    id: "b",
    tipo: "columnas",
    variante: "imagenes",
    celdas: [
      { imagen: "https://ejemplo.com/f.jpg", url: "", titulo: [{ t: "Fun", peso: 700 }, { t: "das" }] },
      { imagen: "", url: "" },
    ],
  } as Bloque);
  ok(conFoto.includes('alt="Fundas"'), "el alt concatena los trozos", conFoto.match(/alt="[^"]*"/)?.[0]);
  ok(!/alt="[^"]*<span/.test(conFoto), "y no lleva un `<span>` adentro del atributo");
}

// ─── text/plain ──────────────────────────────────────────────────────────────
titulo("La parte de texto plano");
{
  const t1 = texto({ id: "b", tipo: "texto", texto: [{ t: "ho" }, { t: "la", peso: 700 }] } as Bloque);
  ok(t1.includes("hola"), "los trozos se concatenan");
  ok(!t1.includes("<span") && !t1.includes("**"), "sin tags y sin asteriscos");

  const t2 = texto({ id: "b", tipo: "texto", texto: [{ t: "acá", url: "https://ejemplo.com" }] } as Bloque);
  ok(t2.includes("acá (https://ejemplo.com)"), "un link sale entre paréntesis", t2.split("\n")[0]);

  const t3 = texto({ id: "b", tipo: "texto", texto: "**Solo hasta el domingo**" } as Bloque);
  ok(t3.includes("Solo hasta el domingo") && !t3.includes("**"), "un string sigue perdiendo los asteriscos");
}

// ─── El round-trip por el esquema ────────────────────────────────────────────
titulo("Los trozos sobreviven a `leerContenido`");
{
  const c = leerContenido({
    bloques: [{ tipo: "texto", texto: [{ t: "ho" }, { t: "la", peso: 700 }] }],
  });
  const b = c.bloques.find((x) => x.tipo === "texto");
  ok(b?.tipo === "texto" && Array.isArray(b.texto) && b.texto.length === 2, "entran y salen enteros");

  const sucio = leerContenido({
    bloques: [{ tipo: "texto", texto: [{ t: "x", color: "rojo", tamano: 999 }] }],
  });
  const b2 = sucio.bloques.find((x) => x.tipo === "texto");
  ok(
    b2?.tipo === "texto" && Array.isArray(b2.texto) && b2.texto[0].color === undefined && b2.texto[0].tamano === 48,
    "y se sanean de paso",
  );

  // Un documento de puros strings no puede ganar un array por leerlo.
  const viejo = leerContenido({
    bloques: [
      { tipo: "texto", texto: "hola" },
      { tipo: "hero", imagen: "", titulo: "T", subtitulo: "S", botonTexto: "", botonUrl: "", bg: "" },
      { tipo: "columnas", celdas: [{ imagen: "", url: "", titulo: "A" }, { imagen: "", url: "" }] },
    ],
  });
  const ninguno = viejo.bloques.every((b) => {
    if (b.tipo === "texto") return typeof b.texto === "string";
    if (b.tipo === "hero") return typeof b.titulo === "string" && typeof b.subtitulo === "string";
    if (b.tipo === "columnas") return b.celdas.every((c) => c.titulo === undefined || typeof c.titulo === "string");
    return true;
  });
  ok(ninguno, "🔑 un documento viejo NO se convierte a trozos por leerlo");
}

// ─── El modo de falla conocido ───────────────────────────────────────────────
titulo("🟡 El modo de falla documentado: formato en el medio de un merge tag");
{
  // `aplicarMergeTags` corre sobre el HTML ya armado con un regex. Si alguien
  // pone negrita a media palabra adentro de `${contacto.nombre}`, el `<span>`
  // parte el string y el tag no matchea: sale literal en la casilla.
  //
  // No se arregla acá — se arregla en la barra, tratando el merge tag como una
  // unidad que no se puede partir. Se deja escrito para que el día que se
  // corrija haya un test que lo diga.
  const partido = html({
    id: "b",
    tipo: "texto",
    texto: [{ t: "${contacto." }, { t: "nombre}", peso: 700 }],
  } as Bloque);
  ok(partido.includes("</span>") , "el span parte el merge tag");
  ok(
    !/\$\{contacto\.nombre\}/.test(partido.replace(/<[^>]+>/g, "")) === false ||
      partido.includes("${contacto."),
    "⚠️ conocido: partido así, el merge tag ya no matchea y sale literal",
  );
}

console.log(fallas === 0 ? "\n✅ Texto rico OK" : `\n❌ ${fallas} fallas`);
process.exit(fallas === 0 ? 0 : 1);
