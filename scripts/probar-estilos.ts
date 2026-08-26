// Invariantes de la cascada de estilos. Lógica pura: sin base, sin red.
//
//   node --import tsx scripts/probar-estilos.ts

import { resolverEstilo, extra, estiloCupon, padCss, aireCss, aireElegido, propsDeRol, ESTILO_CUPON_COMPACTO, TAMANOS_BOTON, type Estilos } from "../lib/email/estilos";
import type { TipoBloque } from "../lib/email/bloques";
import { renderEmailHtml } from "../lib/email/render";
import { resolverPaleta } from "../lib/email/tema";

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};
const titulo = (s: string) => console.log(`\n${s}`);

const PAL = resolverPaleta({});

// ─── El orden de las capas ───────────────────────────────────────────────────
titulo("Bloque > documento > tipo > base");
{
  const base = resolverEstilo("titulo", "titulo", { pal: PAL });
  ok(base.tamano === 26, "sin nada: el base (26px)", `salió ${base.tamano}`);

  const porTipo = resolverEstilo("hero", "titulo", { pal: PAL });
  ok(porTipo.tamano === 30, "el hero pisa al base (30px)", `salió ${porTipo.tamano}`);

  const doc: Estilos = { titulo: { tamano: 40 } };
  ok(resolverEstilo("hero", "titulo", { pal: PAL, doc }).tamano === 40, "el documento pisa al tipo");

  const propio: Estilos = { titulo: { tamano: 44 } };
  ok(resolverEstilo("hero", "titulo", { pal: PAL, doc, propio }).tamano === 44, "el bloque pisa al documento");

  // Y lo que el bloque NO dice sigue viniendo de abajo: si el merge fuera por
  // objeto en vez de por campo, poner el tamaño borraría la interlínea.
  const e = resolverEstilo("hero", "titulo", { pal: PAL, doc, propio });
  ok(e.interlinea === 1.2, "lo que nadie tocó sigue bajando del tipo", `interlínea ${e.interlinea}`);
}

// ─── El argumento de venta del SaaS ──────────────────────────────────────────
titulo("Un token se repinta cuando cambia la marca; un hex no");
{
  const contenido = {
    bloques: [
      { id: "a", tipo: "boton", texto: "Token", url: "#", estilo: { boton: { fondo: "$acento" } } },
      { id: "b", tipo: "boton", texto: "Clavado", url: "#", estilo: { boton: { fondo: "#ff0000" } } },
    ],
  } as never;
  const opts = { unsubscribeUrl: "#", nombreCuenta: "X" };

  const ambar = renderEmailHtml(contenido, { ...opts, temaMarca: { acento: "#f59e0b" } });
  const azul = renderEmailHtml(contenido, { ...opts, temaMarca: { acento: "#2d9ff7" } });

  ok(ambar.includes("#f59e0b") && !ambar.includes("#2d9ff7"), "con la marca ámbar, el token sale ámbar");
  ok(azul.includes("#2d9ff7") && !azul.includes("#f59e0b"), "cambia la marca y el token se repinta solo");
  ok(ambar.includes("#ff0000") && azul.includes("#ff0000"), "el hex elegido a mano NO se mueve");
}

// ─── Nada del Json llega crudo al HTML ───────────────────────────────────────
titulo("Un color inválido no se escapa del atributo style");
{
  // `esc()` no escapa comillas, así que un color con una comilla se saldría del
  // `style="…"` y podría inyectar atributos. El iframe del preview hereda el
  // origen del panel: eso sería XSS almacenado.
  const veneno = '#fff" onmouseover="alert(1)';
  const html = renderEmailHtml(
    { bloques: [{ id: "a", tipo: "titulo", texto: "T", estilo: { titulo: { color: veneno } } }] } as never,
    { unsubscribeUrl: "#", nombreCuenta: "X" },
  );
  ok(!html.includes("onmouseover"), "⛔ el veneno no aparece en el HTML");
  ok(html.includes(`color:${PAL.texto}`), "y el título cae al color del tema");
}

// ─── Clamps ──────────────────────────────────────────────────────────────────
titulo("Los clamps atajan los bordes");
{
  const c = (e: Estilos) => resolverEstilo("titulo", "titulo", { pal: PAL, propio: e });
  // El saneo del esquema es el que acota; acá se verifica que un valor ya
  // saneado pasa derecho y que el resolvedor no lo vuelve a tocar.
  ok(c({ titulo: { tamano: 48 } }).tamano === 48, "48px pasa (es el tope)");
  ok(c({ titulo: { padX: 64 } }).padX === 64, "64px de padding pasa (es el tope)");
}

// ─── Legibilidad contextual ──────────────────────────────────────────────────
titulo("El texto se decide por el fondo REAL del bloque");
{
  // Una sección clara dentro de un mail oscuro. Si el texto heredara la paleta
  // del tema saldría casi blanco sobre casi blanco.
  const html = renderEmailHtml(
    {
      tema: { base: "oscuro" },
      bloques: [{ id: "a", tipo: "seccion", bg: "#ffffff", titulo: "Se lee?", texto: "Sí", botonTexto: "", botonUrl: "" }],
    } as never,
    { unsubscribeUrl: "#", nombreCuenta: "X" },
  );
  ok(html.includes("color:#171717"), "sobre fondo blanco el título sale oscuro");
  ok(!html.includes("color:#fafafa;"), "no hereda el texto claro del tema oscuro");
}
{
  // Y al revés: si alguien ELIGIÓ el color, se respeta aunque quede feo. Es su
  // mail; la corrección automática es para lo que nadie tocó.
  const html = renderEmailHtml(
    {
      bloques: [{
        id: "a", tipo: "seccion", bg: "#ffffff", titulo: "T", texto: "", botonTexto: "", botonUrl: "",
        estilo: { titulo: { color: "#ffffff" } },
      }],
    } as never,
    { unsubscribeUrl: "#", nombreCuenta: "X" },
  );
  ok(html.includes("color:#ffffff"), "un color elegido a mano no se corrige solo");
}

// ─── extra(): solo lo elegido ────────────────────────────────────────────────
titulo("extra() emite lo elegido, no el base");
{
  const sinNada = resolverEstilo("cupon", "cuerpo", { pal: PAL });
  ok(extra(sinNada, ["tamano", "color"]) === "", "sin estilos propios no agrega nada", extra(sinNada, ["tamano", "color"]));

  const conPeso = resolverEstilo("cupon", "cuerpo", { pal: PAL, propio: { cuerpo: { peso: 700 } } });
  ok(extra(conPeso, ["tamano", "color"]) === ";font-weight:700", "el peso elegido sí sale", extra(conPeso, ["tamano", "color"]));

  const dup = resolverEstilo("titulo", "titulo", { pal: PAL, propio: { titulo: { tamano: 40 } } });
  ok(!extra(dup, ["tamano"]).includes("font-size"), "lo que la plantilla ya escribió no se duplica");

  const falso = resolverEstilo("titulo", "titulo", { pal: PAL, propio: { titulo: { mayusculas: false } } });
  ok(!extra(falso).includes("uppercase"), "un `false` no emite nada");

  // 🔴 El caso que motivó los tres estados (4-ago-2026), y el que hay que
  // mirar si algún día alguien quiere volver a tirar el `false` en el saneo.
  //
  // La plantilla prende las mayúsculas para TODO el mail (capa de documento) y
  // un bloque las apaga. Mientras el `false` se descartaba, el bloque escribía
  // "heredar" y el documento ganaba: se escribía en minúscula y salía en
  // mayúscula igual, sin forma de arreglarlo desde el editor.
  const apagaAlDoc = resolverEstilo("titulo", "titulo", {
    pal: PAL,
    doc: { titulo: { mayusculas: true } },
    propio: { titulo: { mayusculas: false } },
  });
  ok(!extra(apagaAlDoc).includes("uppercase"), "un `false` del bloque APAGA el `true` del documento");

  // Y la contracara: sin el `false`, el documento sigue mandando.
  const heredaDelDoc = resolverEstilo("titulo", "titulo", { pal: PAL, doc: { titulo: { mayusculas: true } } });
  ok(extra(heredaDelDoc).includes("uppercase"), "sin decir nada, el bloque hereda el `true` del documento");
}

// ─── El padding simétrico se escribe corto ───────────────────────────────────
titulo("padding:32px, no padding:32px 32px");
{
  const html = renderEmailHtml(
    { bloques: [{ id: "a", tipo: "seccion", bg: "#eee", titulo: "T", texto: "", botonTexto: "", botonUrl: "" }] } as never,
    { unsubscribeUrl: "#", nombreCuenta: "X" },
  );
  ok(html.includes("padding:32px;"), "los dos lados iguales van en un solo valor");

  // 🔑 El mismo colapso, a nivel unidad. Está acá y no sólo en el golden porque
  // romperlo mueve los 38 presets de una: el golden lo caza —medido, 88
  // diferencias— pero recién después de renderizar todo, y estas tres líneas lo
  // dicen en 40 ms. El tercer valor entra SÓLO si los lados difieren de verdad.
  ok(padCss(32, 32, 32) === "padding:32px", "padCss: tres iguales siguen siendo uno", padCss(32, 32, 32));
  ok(padCss(10, 32, 10) === "padding:10px 32px", "padCss: arriba === abajo va en dos valores", padCss(10, 32, 10));
  ok(padCss(10, 32, 20) === "padding:10px 32px 20px", "padCss: lados distintos van en tres", padCss(10, 32, 20));

  // Y los cinco `margin` cableados del motor, que `aireCss` tiene que escribir
  // exactamente como estaban escritos a mano antes del 26-ago-2026.
  for (const [a, b, esperado] of [
    [16, 16, "16px 0"], [0, 16, "0 0 16px"], [8, 20, "8px 0 20px"],
    [24, 24, "24px 0"], [8, 16, "8px 0 16px"], [0, 0, "0"],
  ] as [number, number, string][]) {
    ok(aireCss(a, b) === esperado, `aireCss(${a},${b}) === "${esperado}"`, aireCss(a, b));
  }
}

// ─── El margen partido es SOLO de la caja ────────────────────────────────────
//
// 🔴 Lo destapó abrir el panel en el navegador: el control compuesto se colgaba
// del NOMBRE de la propiedad, y el rol `boton` también tiene `padY` —ahí es el
// relleno interior del botón—, así que le aparecía el candado y escribía dos
// claves que el emisor del botón no lee nunca. Perilla muerta.
//
// ⛔ Y no es que falte cablearlo: el botón de Outlook es un `<v:roundrect>` que
// expresa su caja con UN `height` (`shell.ts`), así que un relleno asimétrico no
// se puede representar. Partirlo sería una perilla que miente justo en el
// cliente donde más se nota.
titulo("el margen por lado no llega al rol `boton`");
{
  const conBoton: TipoBloque[] = ["boton", "cupon", "hero", "seccion", "columnas"];
  for (const t of conBoton) {
    const props = propsDeRol(t, "boton");
    if (!props.length) continue;
    ok(
      !props.includes("padArriba") && !props.includes("padAbajo"),
      `${t} · el rol boton NO ofrece los lados sueltos`,
      props.join(","),
    );
    ok(props.includes("padY"), `${t} · pero sí sigue ofreciendo el relleno de a dos`);
  }
  // La contracara: donde SÍ tiene que estar, está — y los dos juntos, nunca uno.
  for (const t of ["titulo", "texto", "hero", "seccion", "cupon", "divisor", "menu", "encabezado", "mosaico"] as TipoBloque[]) {
    const props = propsDeRol(t, "caja");
    ok(
      props.includes("padArriba") === props.includes("padAbajo"),
      `${t} · la caja ofrece los DOS lados o ninguno`,
      props.join(","),
    );
  }
}

// ─── El aire vertical elegido pliega las capas EN ORDEN ──────────────────────
titulo("aireElegido respeta el orden de la cascada");
{
  ok(
    JSON.stringify(aireElegido([{ padArriba: 8 }, { padY: 30 }])) === JSON.stringify({ arriba: 30, abajo: 30 }),
    "la forma corta de la capa de arriba gana de los DOS lados",
    JSON.stringify(aireElegido([{ padArriba: 8 }, { padY: 30 }])),
  );
  ok(
    JSON.stringify(aireElegido([{ padY: 20, padAbajo: 0 }])) === JSON.stringify({ arriba: 20, abajo: 0 }),
    "adentro de UNA capa, el lado fino le gana a la forma corta",
    JSON.stringify(aireElegido([{ padY: 20, padAbajo: 0 }])),
  );
  // 🔴 "Ausente ≠ 0" también acá: sin esto, un margen de fábrica apagaría el
  // cableado de todos los bloques y las 38 plantillas saldrían pegadas.
  ok(JSON.stringify(aireElegido([undefined, {}])) === "{}", "sin elegir nada no hay ningún lado");
  ok(
    JSON.stringify(aireElegido([{ padY: 0 }])) === JSON.stringify({ arriba: 0, abajo: 0 }),
    "un 0 elegido SÍ está",
  );
}

// ─── Las dos formas del cupón ────────────────────────────────────────────────
//
// 🔑 La invariante que importa es el VIAJE DE IDA Y VUELTA. La variante compacta
// escribe siete claves en el bloque en vez de vivir en una capa propia de la
// cascada, así que lo único que la hace segura es que volver a "caja" las saque
// TODAS: si quedara una sola colgada, el cupón de siempre saldría distinto según
// si alguien probó la otra forma o no, y nadie lo relacionaría jamás.
titulo("El cupón compacto se escribe y se borra entero");
{
  const compacta = estiloCupon(undefined, "compacta");
  ok(compacta?.caja?.padY === 14, "compacta: achata la caja", JSON.stringify(compacta?.caja));
  ok(compacta?.caja?.bordeEstilo === "solid", "compacta: el borde deja de ser cortado");
  ok(compacta?.titulo?.tamano === 20, "compacta: el código se achica");
  ok(compacta?.boton?.padX === 20, "compacta: el botón acompaña");

  ok(estiloCupon(compacta, "caja") === undefined, "volver a caja no deja NADA colgado", JSON.stringify(estiloCupon(compacta, "caja")));

  // Y lo que la persona eligió aparte sobrevive al viaje: la variante administra
  // sus siete claves y ninguna más.
  const propio: Estilos = { caja: { fondo: "#ff0000" }, titulo: { fuente: "georgia" } };
  const ida = estiloCupon(propio, "compacta");
  ok(ida?.caja?.fondo === "#ff0000", "el fondo elegido a mano sobrevive la ida");
  const vuelta = estiloCupon(ida, "caja");
  ok(JSON.stringify(vuelta) === JSON.stringify(propio), "ida y vuelta devuelve el bloque IGUAL", JSON.stringify(vuelta));
}

titulo("La variante compacta achata de verdad");
{
  const cupon = (extra: Record<string, unknown>) =>
    renderEmailHtml(
      { bloques: [{ id: "a", tipo: "cupon", texto: "T", codigo: "ABC", botonTexto: "", botonUrl: "", ...extra }] } as never,
      { unsubscribeUrl: "#", nombreCuenta: "X" },
    );

  // Los tres márgenes que ninguna perilla alcanza: son la única razón por la que
  // la variante existe. Sin esto, `estiloCupon` sería un preset de estilo y ya.
  const caja = cupon({});
  ok(caja.includes("margin-bottom:14px"), "caja: el hueco del código sigue en 14");
  ok(caja.includes("margin:8px 0 16px"), "caja: la caja sigue separando con 16");

  const comp = cupon({ variante: "compacta", estilo: ESTILO_CUPON_COMPACTO });
  ok(comp.includes("margin-bottom:4px"), "compacta: el hueco del texto baja a 4");
  ok(comp.includes("margin-bottom:0px"), "compacta: sin botón, el hueco del código COLAPSA");
  ok(comp.includes("margin:8px 0 10px"), "compacta: la caja separa con 10");
  ok(comp.includes("border:1px solid"), "compacta: el borde fino llega al HTML");
}

// ─── Los tres tamaños de botón ───────────────────────────────────────────────
//
// Misma doctrina que `probar-panel-estilo.ts`: un atajo que no mueve el mail es
// una perilla desconectada, la peor clase de bug de UI porque no falla, no pasa
// nada. Y los tres tienen que dar HTML DISTINTO entre sí, no solo distinto del
// automático.
titulo("Chico, Mediano y Grande dan tres botones distintos");
{
  const conTamano = (valores?: Record<string, number>) =>
    renderEmailHtml(
      { bloques: [{ id: "a", tipo: "boton", texto: "Ir", url: "https://e.com", align: "left", full: false, estilo: valores ? { boton: valores } : undefined }] } as never,
      { unsubscribeUrl: "#", nombreCuenta: "X" },
    );

  const salidas = new Map<string, string>();
  salidas.set("auto", conTamano());
  for (const t of TAMANOS_BOTON) salidas.set(t.clave, conTamano(t.valores));

  for (const t of TAMANOS_BOTON) {
    ok(salidas.get(t.clave) !== salidas.get("auto") || t.clave === "mediano", `${t.clave}: mueve el mail`);
  }
  ok(new Set(salidas.values()).size === 3, "los tres tamaños son tres botones distintos", `salieron ${new Set(salidas.values()).size} variantes`);

  // 🔴 Y el que documenta por qué "Mediano" y "Automático" son dos opciones y no
  // una: en un bloque suelto coinciden, pero adentro de una columna el
  // automático es 14/18/10 y elegir Mediano AGRANDA el botón.
  const enColumna = (valores?: Record<string, number>) =>
    renderEmailHtml(
      {
        bloques: [
          {
            id: "a", tipo: "columnas", celdas: [{ imagen: "", titulo: "T", texto: "", url: "", botonTexto: "Ir", botonUrl: "https://e.com" }],
            estilo: valores ? { boton: valores } : undefined,
          },
        ],
      } as never,
      { unsubscribeUrl: "#", nombreCuenta: "X" },
    );
  const medianoEnColumna = TAMANOS_BOTON.find((t) => t.clave === "mediano")!.valores;
  ok(enColumna() !== enColumna(medianoEnColumna), "en columnas, Mediano NO es lo mismo que Automático");
}

console.log(fallas === 0 ? "\n✅ Estilos OK\n" : `\n❌ ${fallas} fallas\n`);
process.exit(fallas === 0 ? 0 : 1);
