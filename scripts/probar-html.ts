// Invariantes del HTML que sale al mail. Lógica pura: sin base, sin red.
//
//   node --import tsx scripts/probar-html.ts

import { renderEmailHtml, renderEmailTexto, nuevoBloque, TIPOS_BLOQUE, type Bloque } from "../lib/email/render";
import { claveProductos } from "../lib/email/bloques";
import { inyectarTracking } from "../lib/email/tracking";
import { CLASES } from "../lib/email/shell";
import { V_ACTUAL } from "../lib/email/esquema";
import { presetsPara } from "../lib/plantillas/presets";

/** Una cuenta de mentira para instanciar los presets. */
const CUENTA = { nombre: "Marca de prueba", config: { url: "https://ejemplo.com" } };
import type { ContenidoCampania } from "../lib/email/render";

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};
const titulo = (s: string) => console.log(`\n${s}`);

const OPTS = { unsubscribeUrl: "https://x.com/baja?t=1", nombreCuenta: "Marca", direccionPostal: "Calle 1" };
const render = (c: unknown) => renderEmailHtml(c as ContenidoCampania, OPTS);

// Un mail con todos los tipos de bloque adentro, para barrer de una.
const TODO = render({ bloques: TIPOS_BLOQUE.map((t) => nuevoBloque(t)) });

// ─── Outlook de escritorio ───────────────────────────────────────────────────
titulo("Outlook de escritorio");
{
  ok(TODO.includes("<o:PixelsPerInch>96</o:PixelsPerInch>"), "PixelsPerInch=96 (si no, todo sale 25% más grande)");
  ok(TODO.includes('xmlns:v="urn:schemas-microsoft-com:vml"'), "el namespace de VML está en el <html>");
  ok(TODO.includes("<table role=\"presentation\" width=\"100%\""), "hay tabla exterior");
  ok(!/<div style="max-width:\d+px;margin:0 auto/.test(TODO), "ya no se centra con un div (Outlook lo ignora)");
  ok(TODO.includes("mso-hide:all"), "hay reglas mso para lo que se oculta");
}

titulo("El botón VML");
{
  const html = render({ bloques: [{ tipo: "boton", texto: "Comprar ahora", url: "https://x.com" }] });
  ok(html.includes("<v:roundrect"), "se dibuja el roundrect");
  ok(html.includes("<w:anchorlock/>"), "lleva anchorlock (si no, el texto no queda clickeable)");
  ok(/arcsize="\d+%"/.test(html), "arcsize va en porcentaje, no en px");
  const arc = Number(html.match(/arcsize="(\d+)%"/)?.[1] ?? 0);
  ok(arc > 0 && arc <= 50, `arcsize dentro de rango (salió ${arc}%)`);

  // El ancla tiene que estar escondida de Outlook o dibuja los dos botones.
  const iVml = html.indexOf("<v:roundrect");
  const iNoMso = html.indexOf("<!--[if !mso]><!-->");
  const iA = html.indexOf("<a href", iVml);
  ok(iNoMso > iVml && iNoMso < iA, "el ancla queda dentro de <!--[if !mso]>");
  ok(html.includes("<!--<![endif]-->"), "y el condicional se cierra");

  const vml = html.slice(iVml, html.indexOf("</v:roundrect>"));
  ok(/width:\d+px/.test(vml) && /height:\d+px/.test(vml), "el VML lleva width y height en px");
}

// ─── El tracking ve los dos botones ──────────────────────────────────────────
titulo("El tracking no se olvida de Outlook");
{
  const html = render({ bloques: [{ tipo: "boton", texto: "Ir", url: "https://tienda.com/p" }] });
  const conT = inyectarTracking(html, "envio123", "https://app.com");
  const tracked = conT.match(/https:\/\/app\.com\/api\/track\/click\/envio123/g) ?? [];
  ok(tracked.length === 2, "se envuelven los DOS links: el <a> y el <v:roundrect>", `envueltos: ${tracked.length}`);
  ok(!conT.includes('href="https://tienda.com/p"'), "no quedó ninguno sin envolver");
  ok(conT.includes("/api/track/open/envio123"), "el pixel de apertura sigue estando");
}
{
  // Lo que NO se toca sigue sin tocarse.
  const html = `<a href="mailto:a@b.com">m</a><a href="#x">a</a><a href="https://x.com/baja?t=1">baja</a>`;
  const conT = inyectarTracking(html, "e", "https://app.com");
  ok(conT.includes('href="mailto:a@b.com"'), "mailto: intacto");
  ok(conT.includes('href="#x"'), "ancla intacta");
  ok(conT.includes('href="https://x.com/baja?t=1"'), "el link de baja NO se trackea");
}

// ─── Responsive ──────────────────────────────────────────────────────────────
titulo("Responsive");
{
  ok(TODO.includes("@media only screen and (max-width:"), "hay media query");
  ok((TODO.match(/<style>/g) ?? []).length === 1, "un solo bloque <style>");

  // Los dos layouts de la grilla en el celular. `movil` ausente = apila, que es
  // como salieron todos los mails hasta el 1-ago-2026: si esto se pusiera en
  // verde con el campo ausente, un default nuevo le habría cambiado el aspecto
  // en el teléfono a toda campaña ya guardada sin que nadie la toque.
  const ITEMS = [
    { nombre: "A", precio: "1000", imagen: "https://x/a.jpg", url: "https://x/a" },
    { nombre: "B", precio: "2000", imagen: "https://x/b.jpg", url: "https://x/b" },
  ];
  const grilla = render({ bloques: [{ tipo: "productos", items: ITEMS }] });
  ok(grilla.includes(`class="${CLASES.col}"`), "sin `movil`, la grilla de productos apila en el celular");

  const grillaDos = render({ bloques: [{ tipo: "productos", items: ITEMS, movil: 2 }] });
  ok(grillaDos.includes(`class="${CLASES.col2}"`), "con `movil:2` la celda lleva la clase de dos por fila");
  ok(!grillaDos.includes(`class="${CLASES.col}"`), "y NO lleva la que apila: con las dos, la grilla se apilaría igual");
  ok(grillaDos.includes(`.${CLASES.col2}{`), "la media query define la regla de dos por fila");
  // El layout de escritorio no cambia en ninguno de los dos: es lo que ve
  // Outlook, que descarta el <style> entero.
  ok((grillaDos.match(/<td width="50%"/g) ?? []).length === 2, "en escritorio siguen siendo dos celdas de la mitad");

  // El bloque dinámico dibuja LA MISMA grilla, así que tiene que respetar
  // `movil` igual. Se le pasan los productos ya resueltos por `opts`, que es por
  // donde viajan de verdad: adentro del bloque no hay items ni puede haberlos.
  const bDin = { tipo: "productos-dinamicos" as const, fuente: "destacados" as const, n: 2, movil: 2 as const };
  const dinamica = renderEmailHtml({ bloques: [bDin] } as ContenidoCampania, {
    ...OPTS,
    productosDinamicos: { [claveProductos(bDin)]: ITEMS },
  });
  ok(dinamica.includes(`class="${CLASES.col2}"`), "el bloque dinámico también respeta `movil`");

  const cols = render({ bloques: [{ tipo: "columnas", celdas: [{ imagen: "https://x/a.jpg", url: "#" }, { imagen: "https://x/b.jpg", url: "#" }] }] });
  ok(cols.includes(`class="${CLASES.col}"`), "sin `movil`, las columnas apilan en el celular");

  // La escotilla: la fila se queda en fila. Mismo mecanismo que la grilla —cuál
  // de las dos clases lleva el `<td>`— y el mismo motivo para fijarlo en las dos
  // direcciones: con las dos clases puestas, apilaría igual.
  const TRES = [
    { titulo: "Envíos gratis", texto: "En tu compra" },
    { titulo: "3 cuotas sin interés", texto: "En todos" },
    { titulo: "Cambios y devoluciones fáciles", texto: "Sin vueltas" },
  ];
  const enFila = render({ bloques: [{ tipo: "columnas", variante: "textos", celdas: TRES, movil: "fila" }] });
  ok(enFila.includes(`class="${CLASES.col2}"`), "con `movil:\"fila\"` la celda lleva la clase que NO apila");
  ok(!enFila.includes(`class="${CLASES.col}"`), "y no lleva la que apila: con las dos, la fila se apilaría igual");
  ok(enFila.includes(`.${CLASES.col2}{`), "la media query define la regla de no apilar");
  // El layout de escritorio es el mismo en los dos casos: es lo que ve Outlook,
  // que descarta el <style> entero. La regla del shell.
  const apilada = render({ bloques: [{ tipo: "columnas", variante: "textos", celdas: TRES }] });
  ok((enFila.match(/<td width="33%"/g) ?? []).length === 3, "en escritorio siguen siendo tres celdas de 33%");
  ok((apilada.match(/<td width="33%"/g) ?? []).length === 3, "y el ancho inline es el MISMO con y sin `movil`");

  // Con tres en fila cada celda queda en ~104px a 375px: un título de 18px en
  // mayúsculas no entra y una palabra más ancha que su <td> descuadra la fila.
  ok(enFila.includes(`class="${CLASES.colTitulo}"`), "con 3 en fila el título se achica en el celular");
  ok(enFila.includes(`class="${CLASES.colTexto}"`), "y el texto también");
  ok(enFila.includes(`.${CLASES.colTitulo}{`), "la media query define el achique");
  ok(!apilada.includes(`class="${CLASES.colTitulo}"`), "apilada no se achica nada: la celda mide todo el ancho");

  // ⚠️ Con un tamaño elegido a mano la media query no se cuelga, o el control
  // del panel sería mentira. Mismo criterio que `m-h1`.
  const elegido = render({
    bloques: [{ tipo: "columnas", variante: "textos", celdas: TRES, movil: "fila", estilo: { titulo: { tamano: 22 } } }],
  });
  ok(!elegido.includes(`class="${CLASES.colTitulo}"`), "con el tamaño elegido a mano, el título no se achica solo");
  ok(elegido.includes(`class="${CLASES.colTexto}"`), "y el del cuerpo, que nadie eligió, sí");

  // Con dos celdas en fila cada una mide ~160px y el título entra como está:
  // achicarlo sería empeorarlo.
  const dosEnFila = render({
    bloques: [{ tipo: "columnas", variante: "textos", celdas: TRES.slice(0, 2), movil: "fila" }],
  });
  ok(dosEnFila.includes(`class="${CLASES.col2}"`), "con dos celdas la fila también puede no apilar");
  ok(!dosEnFila.includes(`class="${CLASES.colTitulo}"`), "pero con dos no se achica el texto");

  // Una fila de cuatro reparte 25% y apila igual. El ancho inline es el de
  // escritorio y la clase solo lo pisa en el celular: la regla del shell.
  const cuatro = render({
    bloques: [
      {
        tipo: "columnas",
        celdas: [1, 2, 3, 4].map((n) => ({ imagen: `https://x/${n}.jpg`, url: "#", titulo: `Cat ${n}` })),
      },
    ],
  });
  ok(cuatro.includes(`width="25%"`), "una fila de cuatro reparte el ancho parejo");
  ok(cuatro.includes("Cat 4"), "la etiqueta de la celda de imagen se dibuja");

  // 🔴 Una celda sin contenido NO reserva lugar: es la diferencia entre "todavía
  // no subí la foto" y "el mail tiene un hueco del 40%".
  const media = render({
    bloques: [
      {
        tipo: "columnas",
        variante: "imagen-texto",
        proporcion: 40,
        celdas: [
          { imagen: "", url: "#" },
          { imagen: "", url: "#", titulo: "El destacado", texto: "Tres renglones." },
        ],
      },
    ],
  });
  ok(media.includes(`width="100%"`), "con la celda de foto vacía, el texto ocupa todo");
  ok(!media.includes(`width="40%"`), "y no queda el hueco reservado de la foto");
  const nada = render({ bloques: [{ tipo: "columnas", celdas: [{ imagen: "", url: "#" }, { imagen: "", url: "#" }] }] });
  ok(!nada.includes("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:8px 0 16px\"><tr>"), "una fila entera vacía no se dibuja");

  // La grilla de tres: el ancho inline es el de escritorio (33%) y en el celular
  // apila. `movil: 2` no puede ganarle — una `<tr>` de tres celdas no se parte
  // en dos filas con CSS, así que el bloque **ignora** el pedido en vez de
  // dibujar tres tarjetas de 125px en un teléfono. Ver `PorFila`.
  const tres = render({ bloques: [{ tipo: "productos", items: ITEMS, movil: 2, porFila: 3 }] });
  ok(tres.includes(`width="33%"`), "la grilla de tres reparte 33% en escritorio");
  ok(tres.includes(`class="${CLASES.col}"`), "con tres por fila el celular apila");
  ok(!tres.includes(`class="${CLASES.col2}"`), "y `movil: 2` no la deja a medio camino");

  // La imagen a sangre sale del contenedor con padding, y no de otra forma: lo
  // que se está fijando es que NO la envuelva `pad()`.
  const sangre = render({ bloques: [{ tipo: "imagen", url: "https://x/hero.jpg", alt: "Portada", sangre: true }] });
  const conMargen = render({ bloques: [{ tipo: "imagen", url: "https://x/hero.jpg", alt: "Portada" }] });
  ok(!sangre.includes(`<div class="${CLASES.pad}" style="padding:0 32px"><img`), "la imagen a sangre no va adentro del padding");
  ok(conMargen.includes(`<div class="${CLASES.pad}" style="padding:0 32px"><img`), "y sin `sangre` sigue yendo adentro, como siempre");
  ok(sangre.includes(`width="100%"`), "la imagen a sangre lleva el ancho como atributo (Outlook ignora max-width)");

  // La banda con foto de fondo es la MISMA en el hero y en la sección: los dos
  // pasan por `bandaConFoto`, y lo que se fija acá es que la sección también
  // traiga el camino VML. Sin él, Outlook dibuja la banda sin fondo y el texto
  // blanco queda sobre blanco.
  const banda = render({
    bloques: [
      { tipo: "seccion", bg: "#101010", titulo: "Nuestra misión", texto: "Cuero ecológico.", botonTexto: "", botonUrl: "", fondoImagen: "https://x/banda.jpg", velo: 55, alto: 240 },
    ],
  });
  ok(banda.includes("<v:rect"), "la sección con foto trae el camino de Outlook");
  ok(banda.includes("linear-gradient("), "y el velo, que es lo que deja leer el texto");
  ok(banda.includes("background-color:#101010"), "con el color de respaldo por si la foto no carga");
}
{
  // La regla que sostiene todo: una clase es SIEMPRE un override, nunca el
  // único lugar donde vive una propiedad. Si un cliente descarta el <style>
  // —Outlook, o Gmail cuando recorta— tiene que ver el layout de escritorio,
  // no uno roto.
  const cuerpo = TODO.slice(TODO.indexOf("<body"));
  const conClase = cuerpo.match(/<[^>]*class="[^"]*"[^>]*>/g) ?? [];
  const sinInline = conClase.filter((t) => !/style="/.test(t) && !/width="/.test(t));
  ok(sinInline.length === 0, "toda etiqueta con clase trae también su valor inline", sinInline.slice(0, 2).join("\n      "));
}
{
  // Un título con tamaño elegido no puede ser pisado por la media query.
  const libre = render({ bloques: [{ tipo: "titulo", texto: "T" }] });
  const elegido = render({ bloques: [{ tipo: "titulo", texto: "T", estilo: { titulo: { tamano: 40 } } }] });
  ok(libre.includes(`class="${CLASES.titulo}"`), "un título por defecto se achica en el celular");
  ok(!elegido.includes(`class="${CLASES.titulo}"`), "un título de 40px elegido a mano NO se achica");
  ok(elegido.includes("font-size:40px"), "y sale con los 40px");
}

// ─── Lo que no puede aparecer ────────────────────────────────────────────────
titulo("Propiedades que los clientes de mail no soportan");
{
  ok(!TODO.includes("position:absolute"), "cero position:absolute (Gmail lo elimina)");
  ok(!/[^-]display:flex|display:grid/.test(TODO), "cero flex y grid");
  ok(!/[^-]float:/.test(TODO), "cero float");
  ok(!TODO.includes("box-shadow"), "cero box-shadow");
  ok(!/\bcalc\(/.test(TODO), "cero calc()");
  ok(!/font-size:\s*\d+(\.\d+)?(rem|em)\b/.test(TODO), "ningún tamaño en rem/em");
}

// ─── Texto con formato por selección ─────────────────────────────────────────
titulo("Los `<span>` del texto rico juegan con las mismas reglas");
{
  // Un mail con los 18 tipos, pero con los 8 campos ricos llenos de trozos de
  // todos los formatos que existen. Es el peor caso posible del emisor.
  const cargado = render({
    bloques: [
      { id: "t1", tipo: "titulo", texto: [{ t: "TÍT", fuente: "georgia", tamano: 34 }, { t: "ULO", italica: true, color: "$acento" }] },
      { id: "t2", tipo: "texto", texto: [{ t: "cuerpo " }, { t: "gordo", peso: 700, fondo: "#ffff00" }, { t: " y ", subrayado: true }, { t: "link", url: "https://ejemplo.com" }] },
      { id: "t3", tipo: "hero", imagen: "", titulo: [{ t: "H", tamano: 40 }], subtitulo: [{ t: "S", italica: true }], botonTexto: "", botonUrl: "", bg: "" },
      { id: "t4", tipo: "seccion", bg: "#faf7f0", titulo: [{ t: "S", peso: 700 }], texto: [{ t: "x", color: "#ff0000" }], botonTexto: "", botonUrl: "" },
      { id: "t5", tipo: "columnas", variante: "textos", celdas: [{ imagen: "", url: "", titulo: [{ t: "A", tamano: 20 }], texto: [{ t: "b", peso: 600 }] }, { imagen: "", url: "" }] },
    ] as Bloque[],
  });

  ok(cargado.includes("<span style="), "los trozos con formato salen como span");
  ok(!cargado.includes("position:absolute"), "cero position");
  ok(!/[^-]display:flex|display:grid/.test(cargado), "cero flex y grid");
  ok(!/\bcalc\(/.test(cargado), "cero calc()");
  ok(!/font-size:\s*\d+(\.\d+)?(rem|em)\b/.test(cargado), "ningún tamaño en rem/em");
  ok(!cargado.includes("box-shadow"), "cero box-shadow");

  // 🔴 Un trozo NO puede emitir una clase. La regla única del shell dice que el
  // inline lleva el valor de escritorio y la clase solo puede ser un override;
  // un `<span class>` sin inline sería lo único de esa propiedad y se perdería
  // en Outlook. Por eso no existe "un trozo que se achica en el celular".
  ok(!/<span[^>]*\sclass=/.test(cargado), "🔴 ningún `<span>` de trozo lleva `class`");

  // 🔴 Un `<a>` adentro de otro `<a>`: cada cliente lo repara distinto y el
  // click termina en cualquier lado. Es el riesgo que trae el link por trozo.
  ok(!/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*?<a\b/.test(cargado), "🔴 cero anclas anidadas");

  // Y la regla del inline sigue valiendo para todo el documento.
  const conClase = cargado.match(/<[a-z][^>]*\sclass="[^"]*"[^>]*>/g) ?? [];
  ok(conClase.every((tag) => tag.includes("style=")), "toda etiqueta con clase sigue trayendo su inline");
}

// ─── Cosas que no se pueden perder ───────────────────────────────────────────
titulo("Lo que no puede faltar nunca");
{
  for (const bloques of [[], TIPOS_BLOQUE.map((t) => nuevoBloque(t))]) {
    const html = render({ bloques });
    ok(html.includes(OPTS.unsubscribeUrl), `el link de baja está (con ${bloques.length} bloques)`);
  }
  ok(TODO.includes("a[x-apple-data-detectors]"), "iOS no pinta de azul la dirección del pie");
}
{
  // Un tipo nuevo que se olvide de `bloqueATexto` tiene que fallar acá, no
  // salir con la parte de texto vacía —que es señal de spam clásica.
  //
  // Se compara contra el mail SIN ese bloque, no contra un separador fijo: el
  // pie ya trae un "—" siempre, así que buscarlo daba verde para cualquier
  // tipo, aportara texto o no.
  // Con `v` puesta: un contenido sin versión pasa por la migración, que le
  // materializa el encabezado, y entonces el bloque `encabezado` no se
  // distinguiría del mail vacío.
  const base = { v: V_ACTUAL, bloques: [] } as unknown as ContenidoCampania;
  const vacio = renderEmailTexto(base, OPTS);
  const sinTexto = TIPOS_BLOQUE.filter((t) => {
    const b = nuevoBloque(t);
    // Los que no aportan texto legible a propósito: recién creados están vacíos.
    // `productos-dinamicos` está acá por lo mismo que `productos` —nace sin nada
    // que decir— y además sus productos ni siquiera viven en el bloque. Que SÍ
    // aporte texto cuando los tiene lo fija `probar-productos-dinamicos.ts`.
    // "menu" nace con links sin URL (mismo motivo que "redes"), y "html" nace
    // sin contenido y además no tiene conversión razonable a texto plano.
    if (["espaciador", "imagen", "carrito", "productos", "productos-dinamicos", "columnas", "video", "redes", "menu", "html"].includes(t)) return false;
    return renderEmailTexto({ ...base, bloques: [b] }, OPTS) === vacio;
  });
  ok(sinTexto.length === 0, "todo tipo con contenido aporta algo a la parte de texto", sinTexto.join(", "));
}

// ─── Peso ────────────────────────────────────────────────────────────────────
titulo("Peso: Gmail recorta a ~102 KB y al recortar TIRA el <style>");
{
  for (const p of presetsPara(CUENTA)) {
    const kb = Buffer.byteLength(render(p.contenido), "utf8") / 1024;
    ok(kb < 80, `${p.id}: ${kb.toFixed(1)} KB (tope 80)`);
  }
  ok(!TODO.includes("data:image"), "cero imágenes en base64");
}

console.log(fallas === 0 ? "\n✅ HTML OK\n" : `\n❌ ${fallas} fallas\n`);
process.exit(fallas === 0 ? 0 : 1);
