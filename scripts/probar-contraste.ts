// El aviso de contraste del panel: que el número sea real, que la superficie
// que dice el panel sea la que pinta el mail, y que el aviso no cante donde no
// hay problema.
//
// Correr:  node --import tsx scripts/probar-contraste.ts
//
// 🔴 **Por qué existe.** El 9-ago-2026 el T01 de BDI salió a 501 personas con
// los seis nombres de producto INVISIBLES: el bloque `productos` tenía
// `estilo.cuerpo.color: "$fondo"` guardado a mano —el token del fondo de
// página— y el motor lo dibujó, porque tiene que dibujarlo: un color elegido se
// respeta. Contraste 1.00:1. No había ni un lugar donde eso se viera antes de
// apretar Enviar, y el mail que llegó no tenía forma de arreglarse.
//
// 🔴 **Y el segundo motivo: la primera lectura del contraste del T01 fue FALSA.**
// Se calculó con la luminancia de `tema.ts` (Rec. 709 sobre los canales crudos),
// que sirve para decidir "¿este color es oscuro?" pero no es un ratio. Dio
// "3,09:1, flojo" donde el número real era otro. Un ratio necesita linealizar
// cada canal antes de pesarlo. La sección 1 fija justamente eso, con un caso
// donde las dos fórmulas dan distinto.
import {
  contraste, superficieDe, sobreDeRol, avisarContraste, ratioEnTexto,
  CONTRASTE_FLOJO, CONTRASTE_INVISIBLE,
} from "../lib/email/contraste";
import { revisarContraste, rolesDibujados, invisiblesDe, preguntaAntesDeMandar } from "../lib/email/revisar";
import { presetsPara } from "../lib/plantillas/presets";
import { resolverEstilo, tonosSobre, type Estilos } from "../lib/email/estilos";
import { resolverPaleta, luminancia } from "../lib/email/tema";
import { renderEmailHtml } from "../lib/email/render";
import { V_ACTUAL } from "../lib/email/esquema";
import type { Bloque, ContenidoCampania } from "../lib/email/bloques";

let fallos = 0;
function ok(cond: boolean, que: string, detalle = "") {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    console.log(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
    fallos++;
  }
}

const OPTS = { unsubscribeUrl: "https://x/baja", nombreCuenta: "BDI" };
const html = (bloques: Bloque[], tema?: object, estilos?: Estilos) =>
  renderEmailHtml({ v: V_ACTUAL, bloques, tema, estilos } as unknown as ContenidoCampania, OPTS);

const PAL = resolverPaleta();
const cerca = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

console.log("\n1) El ratio es el de WCAG, con linealización sRGB");
{
  ok(contraste("#ffffff", "#000000") === 21, "blanco sobre negro es 21:1");
  ok(contraste("#ffffff", "#ffffff") === 1, "dos colores iguales dan 1:1");
  ok(contraste("#abc", "#aabbcc") === 1, "el hex de 3 dígitos se expande igual que el de 6");
  ok(contraste("$fondo", "#ffffff") === null, "un token sin resolver no inventa un número");
  ok(contraste("", "#ffffff") === null, "un string vacío no inventa un número");
  ok(contraste("rojo", "#ffffff") === null, "un color que no es hex no inventa un número");

  // El par que caza la regresión: SIN linealizar, el gris medio contra blanco da
  // ~1,9:1 y pasaría el corte de "flojo" por poco; con la linealización puesta
  // da ~3,9:1 y no se avisa. Si alguien reemplaza la cuenta por la de `tema.ts`,
  // este caso se pone rojo — los dos de arriba (iguales, y blanco/negro) NO se
  // mueven con ninguna de las dos fórmulas, que es exactamente por lo que el
  // error de agosto no se notó.
  const r = contraste("#808080", "#ffffff")!;
  ok(cerca(r, 3.95, 0.05), "gris medio sobre blanco: 3,95:1", `dio ${r.toFixed(2)}`);
  const crudo = (1 - luminancia("#808080")) / 1; // la forma vieja, a modo de contraste
  ok(!cerca(r, crudo, 0.5), "el número NO coincide con el de la fórmula sin linealizar");

  ok(ratioEnTexto(1) === "1,00:1", "se escribe con coma, como todo el panel");
}

console.log("\n2) La superficie que dice el panel es la que pinta el mail");
{
  // Cada uno de los cinco bloques con fondo propio, renderizado de verdad: lo
  // que `superficieDe` devuelve tiene que aparecer como `background` en el HTML.
  const casos = [
    { que: "hero con bg propio", b: { tipo: "hero", imagen: "", titulo: "T", subtitulo: "S", botonTexto: "", botonUrl: "", bg: "#123456" }, esperado: "#123456" },
    { que: "hero sin bg cae en la tarjeta", b: { tipo: "hero", imagen: "", titulo: "T", subtitulo: "", botonTexto: "", botonUrl: "" }, esperado: PAL.tarjeta },
    { que: "seccion sin bg cae en su color propio", b: { tipo: "seccion", titulo: "T", texto: "", botonTexto: "", botonUrl: "" }, esperado: PAL.seccion },
    { que: "cupon cae en el fondo de cupón", b: { tipo: "cupon", texto: "x", codigo: "MAILBDI", botonTexto: "", botonUrl: "" }, esperado: PAL.cuponFondo },
  ] as const;

  for (const c of casos) {
    const b = c.b as unknown as Bloque;
    const caja = resolverEstilo(b.tipo, "caja", { pal: PAL, propio: b.estilo });
    const dice = superficieDe(b.tipo, caja, PAL, "bg" in c.b ? c.b.bg : undefined);
    ok(dice.toLowerCase() === c.esperado.toLowerCase(), `${c.que}: ${c.esperado}`, `dijo ${dice}`);
    ok(html([b]).includes(`background:${dice}`), `${c.que}: el HTML lo pinta de verdad`);
  }

  // El encabezado es la excepción entera: se dibuja FUERA de la tarjeta.
  const enc = { tipo: "encabezado", texto: "BDI" } as unknown as Bloque;
  const cajaEnc = resolverEstilo("encabezado", "caja", { pal: PAL });
  ok(superficieDe("encabezado", cajaEnc, PAL) === PAL.fondo, "el encabezado se apoya en el fondo de PÁGINA, no en la tarjeta");
  ok(PAL.fondo !== PAL.tarjeta, "…y en el tema por defecto los dos colores son distintos, así que la distinción se nota");

  // Un bloque cualquiera se apoya en la tarjeta, y su `caja.fondo` NO cuenta:
  // el panel ni lo ofrece y el renderer no lo pinta. Medirlo contra un fondo que
  // el mail no dibuja sería avisar por algo que no pasa.
  const cajaFalsa = resolverEstilo("texto", "caja", { pal: PAL, propio: { caja: { fondo: "#ff0000" } } });
  ok(superficieDe("texto", cajaFalsa, PAL) === PAL.tarjeta, "un `caja.fondo` que el mail no pinta no mueve la superficie");
  ok(!html([enc]).includes("background:#ff0000"), "…control: ese fondo no aparece en el HTML");
}

console.log("\n3) `sobreDeRol` promete exactamente lo que el renderer recalcula");
{
  // Un fondo casi negro dentro de un mail claro: los roles que el renderer
  // recalcula tienen que salir con los tonos de `tonosSobre`, y los que no,
  // con los de la paleta. Es la tabla `ROLES_SOBRE` puesta a prueba contra el
  // HTML real, que es lo único que no se puede falsear.
  const OSCURO = "#101010";
  const t = tonosSobre(OSCURO);

  const hero = { tipo: "hero", imagen: "", titulo: "T", subtitulo: "S", botonTexto: "Ir", botonUrl: "https://x", bg: OSCURO } as unknown as Bloque;
  const h = html([hero]);
  ok(h.includes(`color:${t.texto}`), "hero: el título se recalcula contra el bg");
  ok(h.includes(`color:${t.medio}`), "hero: la bajada se recalcula contra el bg");
  // El botón NO: trae su propio fondo, así que su texto sale de `$sobreAcento`.
  ok(h.includes(`color:${PAL.sobreAcento}`), "hero: el BOTÓN no se recalcula — tiene fondo propio");

  const cajaHero = resolverEstilo("hero", "caja", { pal: PAL });
  ok(sobreDeRol("hero", "titulo", cajaHero, PAL, OSCURO) === OSCURO, "sobreDeRol: hero/titulo sí");
  ok(sobreDeRol("hero", "boton", cajaHero, PAL, OSCURO) === undefined, "sobreDeRol: hero/boton no");
  ok(sobreDeRol("texto", "cuerpo", cajaHero, PAL) === undefined, "sobreDeRol: un bloque de cuerpo no se recalcula nunca");

  // El cupón recalcula el TEXTO pero no el código: ése va en `$cuponTexto`, que
  // es un color de marca y no un tono derivado.
  const cajaCupon = resolverEstilo("cupon", "caja", { pal: PAL });
  ok(sobreDeRol("cupon", "cuerpo", cajaCupon, PAL) === PAL.cuponFondo, "sobreDeRol: cupon/cuerpo sí");
  ok(sobreDeRol("cupon", "titulo", cajaCupon, PAL) === undefined, "sobreDeRol: cupon/titulo (el código) no");
  ok(html([{ tipo: "cupon", texto: "x", codigo: "MAILBDI", botonTexto: "", botonUrl: "" } as unknown as Bloque]).includes(`color:${PAL.cuponTexto}`), "…y el HTML confirma que el código sale en el color de marca");

  // El menú sólo es una banda cuando alguien le eligió fondo.
  const menuPelado = resolverEstilo("menu", "caja", { pal: PAL });
  const menuBanda = resolverEstilo("menu", "caja", { pal: PAL, propio: { caja: { fondo: OSCURO } } });
  ok(sobreDeRol("menu", "cuerpo", menuPelado, PAL) === undefined, "sobreDeRol: menú sin fondo elegido, no");
  ok(sobreDeRol("menu", "cuerpo", menuBanda, PAL) === OSCURO, "sobreDeRol: menú con fondo elegido, sí");
}

console.log("\n4) El caso del T01: `cuerpo.color: \"$fondo\"` en una grilla de productos");
{
  // El bloque tal cual salió, con el tema de BDI (fondo de página blanco, que es
  // lo que lo volvía idéntico a la tarjeta).
  const TEMA = { fondo: "#ffffff" };
  const pal = resolverPaleta(TEMA);
  // Las DOS capas, como estaban de verdad: el mail entero declaraba su gris de
  // cuerpo y el bloque lo pisaba con el token del fondo. Que la capa de
  // documento esté puesta es lo que hace que el "después" del arreglo sea el
  // 8,86:1 que se midió el 9-ago, y no el gris de fábrica del motor.
  const DOC: Estilos = { cuerpo: { color: "#4a4a4a" } };
  const estilo: Estilos = { cuerpo: { color: "$fondo" } };
  const grilla = {
    tipo: "productos",
    estilo,
    items: [{ nombre: "SHINY CASE", url: "https://t.test/p/1", imagen: "https://t.test/i/1.jpg", precio: "14990.00" }],
    precioOculto: true,
  } as unknown as Bloque;

  const ctx = { pal, doc: DOC, propio: estilo };
  const caja = resolverEstilo("productos", "caja", ctx);
  const e = resolverEstilo("productos", "cuerpo", ctx);
  const fondo = superficieDe("productos", caja, pal);
  const r = contraste(e.color, fondo)!;

  ok(cerca(r, 1, 0.001), "el contraste del nombre contra su fondo es 1,00:1", `dio ${r.toFixed(2)}`);
  const aviso = avisarContraste(e.color, fondo, e.elegidas.has("color") || e.elegidas.has("fondo"));
  ok(aviso?.nivel === "invisible", "el panel lo marca como INVISIBLE");

  // Y que el mail de verdad lo dibujaba así, que es lo que pasó.
  ok(html([grilla], TEMA, DOC).includes(`color:${pal.fondo}`), "el HTML sale con el nombre del color del fondo — el bug, reproducido");

  // El arreglo es BORRAR la clave del BLOQUE, no poner un hex: ausente =
  // heredar, y lo que se hereda es el gris que el documento ya declaraba.
  const sano = resolverEstilo("productos", "cuerpo", { pal, doc: DOC });
  const rSano = contraste(sano.color, fondo)!;
  ok(cerca(rSano, 8.86, 0.05), "borrando la clave el nombre vuelve a 8,86:1", `dio ${rSano.toFixed(2)}`);
  ok(avisarContraste(sano.color, fondo, sano.elegidas.has("color")) === null, "…y el aviso se apaga solo");
}

console.log("\n5) El aviso no canta donde no hay nadie a quien avisarle");
{
  // 🔑 La regla que hace que el cartel valga lo que cuesta mirarlo: sólo se avisa
  // sobre un color que ELIGIÓ una persona. El gris tenue de los detalles mide
  // 2,3:1 contra blanco y está en las 38 plantillas propias; si el panel se
  // pusiera amarillo con eso, en dos días nadie lo lee.
  const tenue = resolverEstilo("productos", "nota", { pal: PAL });
  const rTenue = contraste(tenue.color, PAL.tarjeta)!;
  ok(rTenue < CONTRASTE_FLOJO, "el gris de los detalles está por debajo del corte…", `${rTenue.toFixed(2)}:1`);
  ok(avisarContraste(tenue.color, PAL.tarjeta, false) === null, "…y NO se avisa, porque no lo eligió nadie");

  // 🔴 El botón al que le cambian el FONDO y le dejan el texto en automático.
  // `$sobreAcento` se calcula contra el **acento de la marca**, no contra el
  // fondo que acaban de elegir: con un acento oscuro el texto sale blanco, y
  // sobre un fondo amarillo ese blanco desaparece. El color no lo tocó nadie, y
  // por eso el aviso NO puede colgar sólo de "¿eligieron el color?".
  const palAzul = resolverPaleta({ acento: "#1d4ed8" });
  ok(palAzul.sobreAcento === "#ffffff", "acento oscuro ⇒ el texto del botón es blanco");
  const boton = resolverEstilo("boton", "boton", { pal: palAzul, propio: { boton: { fondo: "#fde047" } } });
  const rBoton = contraste(boton.color, boton.fondo!)!;
  ok(boton.elegidas.has("color") === false, "el color del botón sigue en automático");
  ok(rBoton < CONTRASTE_INVISIBLE, "…y el par queda ilegible", `${rBoton.toFixed(2)}:1`);
  ok(
    avisarContraste(boton.color, boton.fondo!, boton.elegidas.has("color") || boton.elegidas.has("fondo"))?.nivel === "invisible",
    "el aviso salta igual: alcanza con que hayan elegido el FONDO",
  );

  // Y un color elegido que se lee bien no dispara nada.
  ok(avisarContraste("#171717", "#ffffff", true) === null, "un color elegido y legible no avisa");
  ok(avisarContraste("#767676", "#ffffff", true) === null, "4,55:1 tampoco: la vara no es WCAG AA");
  ok(avisarContraste("#999999", "#ffffff", true)?.nivel === "flojo", "2,85:1 avisa como «flojo», no como invisible");
}

console.log("\n6) `rolesDibujados` es un espejo del renderer, rol por rol");
{
  /**
   * 🔑 **La verificación que no se puede escribir mal a mano**: se le pinta un
   * rol de magenta y se mira si ese color sale en el HTML. Si `rolesDibujados`
   * dice que sí y el mail no lo dibuja, el aviso del envío sería ruido; si dice
   * que no y el mail lo dibuja, es el T01 otra vez pero mudo. Las dos
   * direcciones se miden acá.
   */
  const MAGENTA = "#ff00ff";
  const ROLES_TEXTO = ["titulo", "subtitulo", "cuerpo", "precio", "nota", "boton"] as const;

  // Un bloque de cada tipo, con contenido de verdad en todos sus campos: es el
  // estado en el que TODOS sus roles dibujan.
  const P = { nombre: "Funda", url: "https://t.test/p", imagen: "https://t.test/i.jpg", precio: "14990", precioPromo: "9990", variante: "Rosa" };
  const LLENOS: Record<string, object> = {
    encabezado: { tipo: "encabezado", texto: "BDI", variante: "texto" },
    titulo: { tipo: "titulo", texto: "Hola" },
    texto: { tipo: "texto", texto: "Un párrafo" },
    boton: { tipo: "boton", texto: "Comprar", url: "https://t.test" },
    productos: { tipo: "productos", items: [P], botonTexto: "Ver" },
    carrito: { tipo: "carrito", items: [P] },
    columnas: { tipo: "columnas", variante: "textos", celdas: [{ titulo: "Envíos", texto: "En 48 h", botonTexto: "Ver", botonUrl: "https://t.test" }] },
    video: { tipo: "video", imagen: "https://t.test/v.jpg", url: "https://t.test" },
    redes: { tipo: "redes", links: [{ red: "instagram", url: "https://ig.test" }] },
    menu: { tipo: "menu", links: [{ texto: "Novedades", url: "https://t.test" }] },
    hero: { tipo: "hero", titulo: "Rebajas", subtitulo: "Hasta 50%", botonTexto: "Ver", botonUrl: "https://t.test" },
    seccion: { tipo: "seccion", titulo: "Envíos", texto: "En 48 h", botonTexto: "Ver", botonUrl: "https://t.test" },
    cupon: { tipo: "cupon", texto: "Llevate", codigo: "BDI10", botonTexto: "Usar", botonUrl: "https://t.test" },
    divisor: { tipo: "divisor" },
    espaciador: { tipo: "espaciador" },
    html: { tipo: "html", contenido: "<p>hola</p>" },
  };
  // Los mismos bloques VACÍOS: el estado en el que el mail no dibuja ni uno.
  // Es la mitad que justifica que esto no sea `ROLES_POR_TIPO`.
  const VACIOS: Record<string, object> = {
    encabezado: { tipo: "encabezado", variante: "logo", logo: "https://t.test/logo.png" },
    titulo: { tipo: "titulo", texto: "" },
    texto: { tipo: "texto", texto: "" },
    boton: { tipo: "boton", texto: "", url: "https://t.test" },
    productos: { tipo: "productos", items: [] },
    columnas: { tipo: "columnas", variante: "textos", celdas: [] },
    video: { tipo: "video", url: "https://t.test" },
    redes: { tipo: "redes", links: [] },
    menu: { tipo: "menu", links: [] },
    hero: { tipo: "hero" },
    seccion: { tipo: "seccion" },
    cupon: { tipo: "cupon" },
  };

  /**
   * ¿Hay CARACTERES pintados de ese color?
   *
   * 🔑 No alcanza con que el color aparezca en el HTML: un `titulo` con el texto
   * vacío igual emite `<h1 style="…color:#ff00ff"></h1>`, y un atributo sobre un
   * nodo sin contenido no lo ve nadie. La pregunta del aviso es "¿hay algo que
   * no se lee?", así que lo que se mide es el texto, no el atributo.
   */
  const pintaTexto = (h: string) =>
    [...h.toLowerCase().matchAll(/#ff00ff[^>]*>([^<]*)</g)].some((m) => m[1].replace(/&nbsp;|\s/g, "") !== "");

  const cruzar = (muestras: Record<string, object>, que: string) => {
    for (const [tipo, base] of Object.entries(muestras)) {
      for (const rol of ROLES_TEXTO) {
        const b = { ...base, estilo: { [rol]: { color: MAGENTA } } } as unknown as Bloque;
        const dice = rolesDibujados(b).includes(rol);
        const pinta = pintaTexto(html([b]));
        ok(dice === pinta, `${que}: ${tipo}/${rol} — dice ${dice ? "sí" : "no"}, el mail ${pinta ? "lo pinta" : "no lo pinta"}`);
      }
    }
  };
  cruzar(LLENOS, "lleno");
  cruzar(VACIOS, "vacío");

  // Los dos casos donde el contenido —y no el tipo— decide, mirados de cerca.
  const grillaPelada = { tipo: "productos", items: [{ nombre: "Funda", url: "https://t.test/p", imagen: "https://t.test/i.jpg", precio: "14990" }] } as unknown as Bloque;
  ok(!rolesDibujados(grillaPelada).includes("nota"), "un producto sin variante ni promo no dibuja NOTA");
  const conCuatro = { ...(LLENOS.productos as object), porFila: 4 } as unknown as Bloque;
  ok(!rolesDibujados(conCuatro).includes("boton"), "con cuatro por fila el botón por tarjeta no viaja, y el rol tampoco");
  const conLogo = { tipo: "encabezado", texto: "BDI" } as unknown as Bloque;
  ok(rolesDibujados(conLogo).length === 1, "sin logo, el encabezado dibuja el nombre…");
  ok(rolesDibujados(conLogo, { logoCuenta: "https://t.test/logo.png" }).length === 0, "…y con el logo de la tienda cargado, no");
}

console.log("\n7) El revisor del documento entero: el T01, y lo que NO tiene que cantar");
{
  const TEMA = { fondo: "#ffffff" };
  const DOC: Estilos = { cuerpo: { color: "#4a4a4a" } };
  const grilla = {
    id: "b1",
    tipo: "productos",
    estilo: { cuerpo: { color: "$fondo" } },
    items: [{ nombre: "SHINY CASE", url: "https://t.test/p/1", imagen: "https://t.test/i/1.jpg", precio: "14990.00" }],
    precioOculto: true,
  } as unknown as Bloque;
  const sano = { id: "b2", tipo: "texto", texto: "Gracias por tu compra" } as unknown as Bloque;
  const doc = (bloques: Bloque[], estilos?: Estilos): ContenidoCampania =>
    ({ v: V_ACTUAL, bloques, tema: TEMA, estilos }) as unknown as ContenidoCampania;

  // El T01 entero, leído como lo lee la pantalla de envío.
  const hs = revisarContraste(doc([sano, grilla], DOC));
  ok(hs.length === 1, "el documento del T01 devuelve UN hallazgo", `dio ${hs.length}`);
  ok(hs[0]?.bloqueId === "b1" && hs[0]?.rol === "cuerpo", "…y es el nombre de producto de la grilla");
  ok(hs[0]?.aviso.nivel === "invisible", "…marcado como invisible");
  ok(hs[0]?.posicion === 2, "…con su lugar en el documento, para poder ir a buscarlo");
  ok(invisiblesDe(hs).length === 1, "y `invisiblesDe` lo separa del resto");

  // Sin el color a mano, el mismo mail no dice nada.
  ok(revisarContraste(doc([sano], DOC)).length === 0, "un documento sano no devuelve nada");

  // 🔴 Un bloque escondido en las DOS vistas no lo ve nadie: no puede frenar un
  // envío. Es la misma regla que ya obedece `renderEmailTexto`.
  const escondida = { ...(grilla as object), estilo: { cuerpo: { color: "$fondo" }, caja: { ocultarMovil: true, ocultarEscritorio: true } } } as unknown as Bloque;
  ok(revisarContraste(doc([escondida], DOC)).length === 0, "un bloque oculto en las dos vistas no avisa");

  // 🔑 La capa de DOCUMENTO aplica a todos los bloques a la vez: sin mirar el
  // contenido, un color de subtítulo elegido ahí cantaría en cada portada del
  // mail, tenga bajada o no.
  const DOC_SUB: Estilos = { subtitulo: { color: "$fondo" } };
  const heroPelado = { id: "h1", tipo: "hero", titulo: "Rebajas" } as unknown as Bloque;
  const heroConBajada = { id: "h2", tipo: "hero", titulo: "Rebajas", subtitulo: "Hasta 50%" } as unknown as Bloque;
  ok(revisarContraste(doc([heroPelado], DOC_SUB)).length === 0, "una portada sin bajada no avisa por el color del subtítulo");
  ok(revisarContraste(doc([heroConBajada], DOC_SUB)).length === 1, "…y la que sí la tiene, avisa");

  // ⛔ Sobre una FOTO no hay ratio que calcular: el color de atrás lo pone la
  // imagen. Callarse es lo correcto; inventar un número, no.
  const heroFoto = { ...(heroConBajada as object), fondoImagen: "https://t.test/f.jpg" } as unknown as Bloque;
  ok(revisarContraste(doc([heroFoto], DOC_SUB)).length === 0, "una banda con foto de fondo no se mide contra su color de respaldo");

  // 🔴 El botón se mide contra SU fondo y no contra la tarjeta: es la única
  // parte del mail que trae la suya puesta. Midiéndolo contra la superficie del
  // bloque, este par —blanco sobre amarillo, con el color del texto en
  // automático— saldría legible y el aviso se perdería.
  const botonAmarillo = { id: "bt", tipo: "boton", texto: "Comprar", url: "https://t.test", estilo: { boton: { fondo: "#fde047" } } } as unknown as Bloque;
  const docBoton = { v: V_ACTUAL, bloques: [botonAmarillo], tema: { acento: "#1d4ed8" } } as unknown as ContenidoCampania;
  const hsBoton = revisarContraste(docBoton);
  ok(hsBoton.length === 1 && hsBoton[0].rol === "boton", "un botón con fondo elegido y texto automático se mide contra ESE fondo");
  ok(hsBoton[0]?.aviso.nivel === "invisible", "…y sale invisible, que es lo que se ve");

  // El otro nivel, que es el que hace que la pantalla pregunte en vez de frenar.
  const flojo = { id: "t1", tipo: "texto", texto: "Letra chica", estilo: { cuerpo: { color: "#999999" } } } as unknown as Bloque;
  const hsFlojo = revisarContraste(doc([flojo]));
  ok(hsFlojo.length === 1 && hsFlojo[0].aviso.nivel === "flojo", "un gris flojo se avisa como flojo");
  ok(invisiblesDe(hsFlojo).length === 0, "…y no cuenta como invisible");

  /**
   * 🔑 **El texto que ve la persona, fijado acá.** Las cuatro puertas de envío y
   * el botón de activar una automation lo arman con esta función, y un `confirm`
   * nativo no lo puede leer ningún script del navegador: si no se fija en un
   * ensayo, no lo verifica nadie.
   */
  ok(preguntaAntesDeMandar(hsFlojo) === null, "un flojo NO interrumpe el envío");
  const pregunta = preguntaAntesDeMandar(hs) ?? "";
  ok(pregunta.includes("Hay un texto que no se ve"), "la pregunta dice qué pasa, en singular");
  ok(pregunta.includes("Productos elegidos — texto (1,00:1)"), "…nombra el bloque, el rol y el número", pregunta);
  ok(pregunta.includes("Va a llegar así a la casilla"), "…y qué significa apretar que sí");
  const dosCiegos = revisarContraste(doc([grilla, { ...(grilla as object), id: "b3" } as unknown as Bloque], DOC));
  ok(preguntaAntesDeMandar(dosCiegos)?.includes("Hay 2 textos que no se ven") === true, "y en plural, cuando son varios");
}

console.log("\n8) Las plantillas propias, medidas: el aviso nace sin ruido");
{
  // 🔑 **Un cartel que aparece siempre no lo lee nadie.** Las plantillas que
  // vienen con la app son lo que más se manda, así que si alguna cantara, el
  // aviso del envío nacería siendo ruido. Es la misma vara que fijó los
  // umbrales en 1,5 y 3 en vez de los 4,5 de WCAG.
  const CUENTA = { nombre: "BDI Accesorios", config: { url: "https://bdiaccesorios.com.ar" } };
  const presets = presetsPara(CUENTA);
  ok(presets.length > 0, `hay ${presets.length} plantillas para revisar`);
  /**
   * ⚠️ **La única plantilla propia que hoy pregunta al mandar.** «Oscura con
   * acento» escribe `boton.color: "#ffffff"` sobre el amarillo `#f8d000` de su
   * acento: 1,49:1, blanco sobre amarillo. **No es un descuido** —el comentario
   * del preset lo dice: el motor calcularía texto oscuro y la referencia (R-019,
   * CUBO co.) lo hace al revés, así que se escribió a mano. Queda anotada acá y
   * no borrada del ensayo: si mañana nace otra, esto se pone rojo.
   */
  const CON_INVISIBLE = new Set(["Oscura con acento"]);
  const flojas: string[] = [];
  for (const p of presets) {
    const hs = revisarContraste(p.contenido);
    // 🔴 **Lo que frena un envío es el INVISIBLE.** Es la condición para que la
    // pregunta de la pantalla de envío signifique algo: si las plantillas de
    // fábrica la dispararan, la respuesta sería "sí, mandá" siempre y en dos
    // semanas nadie la lee.
    const esperado = CON_INVISIBLE.has(p.nombre) ? 1 : 0;
    ok(invisiblesDe(hs).length === esperado, `«${p.nombre}»: ${esperado ? "el invisible conocido, y ninguno más" : "ningún texto invisible"}`, invisiblesDe(hs).map((h) => `${h.etiqueta}/${h.rol} ${ratioEnTexto(h.aviso.ratio)}`).join(" · "));
    if (hs.length) flojas.push(`${p.nombre}: ${hs.map((h) => `${h.etiqueta}/${h.rol} ${ratioEnTexto(h.aviso.ratio)}`).join(" · ")}`);
  }
  // Los "flojos" se cuentan y se muestran, pero no son una falla: son grises
  // elegidos a propósito, y son la razón por la que el cartel del envío nombra
  // sólo lo que no se ve. Si esta lista crece, la vara está mal puesta.
  console.log(`  · ${flojas.length} de ${presets.length} tienen algún texto por debajo del corte:`);
  for (const f of flojas) console.log(`      ${f}`);
}

console.log(fallos === 0 ? "\n✅ todo en verde\n" : `\n❌ ${fallos} fallas\n`);
process.exit(fallos === 0 ? 0 : 1);
