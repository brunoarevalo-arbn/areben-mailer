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

console.log(fallos === 0 ? "\n✅ todo en verde\n" : `\n❌ ${fallos} fallas\n`);
process.exit(fallos === 0 ? 0 : 1);
