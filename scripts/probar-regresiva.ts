// La CUENTA REGRESIVA: el bloque `regresiva` y el PNG que lo dibuja.
//
//   node --import tsx scripts/probar-regresiva.ts
//
// 🔴 **Por qué existe la feature**: el HTML de un mail se congela cuando se
// manda. Lo único que un cliente de mail vuelve a pedir al abrirlo es una
// imagen, así que un contador que de verdad cuente sólo se puede hacer con un
// endpoint que dibuje un PNG por apertura. Es la única parte del motor de diseño
// con un servicio atrás, y por eso es la que más formas tiene de fallar callada.
//
// Las invariantes que este archivo cuida, y ninguna es "que ande":
//
//   1. 🔴 **El PNG mide EXACTAMENTE lo que el `<img>` declara.** El `<img>` se
//      escribe el día del envío y el PNG se dibuja horas después, en otro
//      proceso: si los dos números no salen del mismo cálculo, el cliente de mail
//      estira la imagen en la casilla de otra persona y no hay arreglo posible.
//      Se mide leyendo el ANCHO Y EL ALTO DE LOS BYTES DEL PNG, no confiando en
//      lo que la función dice que va a dibujar.
//   2. 🔴 **La pantalla de "ya terminó" mide lo mismo que la cuenta corriendo.**
//      Es el mismo `<img>` con las mismas medidas declaradas: si la de cierre
//      fuera más baja, se dibujaría estirada al alto de la otra. Un mail se abre
//      tarde — es el caso normal, no el raro.
//   3. 🔴 **La ruta NO toca Postgres.** La base está compartida con Resorty y al
//      filo de los 100 CU-h de Neon: una escritura por apertura sobre 16.800
//      contactos la voltea.
//   4. 🔴 **El `alt` no lleva números.** Se escribe al enviar y no cambia nunca
//      más: "faltan 2 días" es una mentira con una hora de vencimiento. Lo que va
//      es la fecha límite, que es verdad para siempre.
//   5. 🔴 **La fecha escrita sale SIEMPRE**, en el HTML y en el `text/plain`. Es
//      lo único de este bloque que sobrevive a las imágenes apagadas, que es el
//      default de Outlook de escritorio.
//   6. **Lo que entra por la URL se sanea.** La ruta es pública y sin sesión
//      —tiene que serlo—, así que cualquiera le arma una query.
import { readFileSync } from "node:fs";
// Ya lo usa `probar-redes.ts`: viene con Next como opcional y sólo lo importan
// los ensayos, nunca la app.
import sharp from "sharp";
import { renderEmailHtml, renderEmailTexto } from "../lib/email/render";
import { GET } from "../app/api/regresiva/route";
import {
  ANCHO_MAX,
  ANCHO_MIN,
  ESCALA,
  ETIQUETAS_BASE,
  FIN_BASE,
  MAX_ETIQUETA,
  MAX_FIN,
  colorValido,
  cuerpoFin,
  dosDigitos,
  escalar,
  etiquetasDe,
  instante,
  leerParams,
  lineaRegresiva,
  medidas,
  restante,
  tenue,
  urlRegresiva,
  type ParamsRegresiva,
} from "../lib/email/regresiva";
import { leerContenido, V_ACTUAL } from "../lib/email/esquema";
import type { Bloque, ContenidoCampania } from "../lib/email/bloques";

let fallos = 0;
function ok(cond: boolean, que: string, detalle = "") {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    console.log(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
    fallos++;
  }
}
const titulo = (t: string) => console.log(`\n${t}`);

const HOST = "https://links.zattia.com.ar";
const HASTA = new Date("2026-12-24T23:59:00.000Z");
const OPTS = { unsubscribeUrl: "#", nombreCuenta: "Zattia", assetsBase: HOST };
const bloque = (extra: Record<string, unknown> = {}): Bloque =>
  ({ tipo: "regresiva", hasta: HASTA.toISOString(), ...extra }) as unknown as Bloque;
const html = (b: Bloque, opts: Record<string, unknown> = {}) =>
  renderEmailHtml({ v: V_ACTUAL, bloques: [b] } as unknown as ContenidoCampania, { ...OPTS, ...opts });

// El cuerpo va adentro de una función porque la sección 3 le pide el PNG a la
// ruta de verdad, y eso es asíncrono: `node --import tsx` compila a CJS, donde
// un `await` de primer nivel no existe.
async function main() {
// ─────────────────────────────────────────────────────────────────────────────
titulo("1) La aritmética: cuánto falta");
{
  const en = (ms: number) => restante(new Date(HASTA.getTime()), new Date(HASTA.getTime() - ms));
  const m = 60_000;
  const h = 60 * m;
  const d = 24 * h;

  const dos = en(2 * d + 14 * h + 37 * m);
  ok(!dos.terminado && dos.dias === 2 && dos.horas === 14 && dos.minutos === 37, "2 d 14 h 37 min salen enteros", JSON.stringify(dos));

  // 🔴 Las horas y los minutos son el RESTO, no el total. Un `Math.floor(ms/3600000)`
  // pelado en la casilla del medio dibujaría "62 horas" al lado de "2 días".
  ok(en(3 * d).horas === 0 && en(3 * d).minutos === 0, "tres días justos son 3 / 00 / 00");
  ok(en(25 * h).dias === 1 && en(25 * h).horas === 1, "25 horas son 1 día y 1 hora, no 25 horas");

  // La fecha ya pasó ⇒ la pantalla de cierre. El `<=` importa: en el instante
  // exacto la promoción ya terminó, y dibujar 00/00/00 ahí se lee como roto.
  ok(restante(HASTA, HASTA).terminado, "en el instante exacto ya terminó");
  ok(restante(HASTA, new Date(HASTA.getTime() + 1)).terminado, "un milisegundo después, también");
  ok(!en(1).terminado, "un milisegundo antes, NO terminó");

  // ⚠️ El último minuto dibuja 00/00/00 sin estar terminado, y es correcto:
  // falta menos de un minuto. Lo que este caso fija es que NO se lo confunda con
  // la pantalla de cierre, que dice otra cosa.
  const ultimo = en(30_000);
  ok(!ultimo.terminado && ultimo.dias + ultimo.horas + ultimo.minutos === 0, "a 30 segundos: todo en cero pero NO terminado");

  // Una cuenta a seis meses. Recortar a dos dígitos mostraría "23" donde faltan
  // 123 días: un número mentido, no un número feo.
  ok(dosDigitos(en(123 * d).dias) === "123", "123 días se dibujan con tres dígitos");
  ok(dosDigitos(7) === "07" && dosDigitos(0) === "00", "y un dígito se rellena a dos");
}

// ─────────────────────────────────────────────────────────────────────────────
titulo("2) Las medidas embaldosan y son ENTERAS");
{
  for (const ancho of [ANCHO_MIN, 320, 536, 600]) {
    const m = medidas(ancho);
    const suma = m.casillas.reduce((a, b) => a + b, 0);
    // 🔴 Mismo motivo que en `mosaico`: tres casillas de un tercio redondeadas
    // por separado suman un píxel de más o de menos, y ese píxel es la
    // diferencia entre las casillas y el borde del PNG.
    ok(suma === m.ancho - 2 * m.hueco, `a ${ancho}px las tres casillas suman el ancho útil exacto`, `${m.casillas.join("+")} = ${suma}`);
    ok(
      Object.values(m).flat().every((v) => Number.isInteger(v)),
      `a ${ancho}px todas las medidas son enteras`,
      JSON.stringify(m),
    );
  }
  ok(medidas(50).ancho === ANCHO_MIN && medidas(9000).ancho === ANCHO_MAX, "el ancho se acota a lo dibujable");

  // 🔴 La invariante de la escala: el doble de un entero es un entero. Si alguna
  // medida se calculara a partir del ancho YA escalado, el redondeo se movería y
  // el PNG dejaría de medir el doble de lo que el `<img>` declara.
  const base = medidas(536);
  const doble = escalar(base, ESCALA);
  ok(
    (Object.keys(base) as (keyof typeof base)[]).every((k) => {
      const a = base[k];
      const b = doble[k];
      return Array.isArray(a) ? a.every((v, i) => (b as number[])[i] === v * ESCALA) : b === (a as number) * ESCALA;
    }),
    "escalar es una multiplicación exacta, medida por medida",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
titulo("3) 🔴 El PNG mide lo que el `<img>` declara — leído de los BYTES");
{
  /** Ancho y alto de un PNG, del IHDR: los dos enteros de 32 bits del offset 16. */
  const tamanoPng = (b: Buffer) => ({ ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) });
  const pedir = async (hasta: Date, ancho = 536) => {
    const p: ParamsRegresiva = {
      hasta: hasta.toISOString(),
      ancho,
      etiquetas: [...ETIQUETAS_BASE] as [string, string, string],
      fin: FIN_BASE,
      bg: "#111111",
      tinta: "#ffffff",
      rotulo: tenue("#ffffff"),
    };
    const res = await GET(new Request(urlRegresiva("https://mailer.local", p)));
    return { res, buf: Buffer.from(await res.arrayBuffer()) };
  };

  const corriendo = await pedir(new Date(Date.now() + 3 * 86_400_000));
  const declarado = escalar(medidas(536), ESCALA);
  ok(corriendo.res.status === 200, "la ruta contesta 200");
  ok(corriendo.res.headers.get("content-type") === "image/png", "y contesta un PNG");
  // El oráculo no es "la función devolvió algo": es el ancho y el alto que un
  // cliente de mail va a leer de esos bytes.
  const medido = tamanoPng(corriendo.buf);
  ok(
    medido.ancho === declarado.ancho && medido.alto === declarado.alto,
    "el PNG mide exactamente lo declarado × la escala",
    `PNG ${medido.ancho}×${medido.alto} vs esperado ${declarado.ancho}×${declarado.alto}`,
  );

  // 🔴 Y la pantalla de cierre ocupa el MISMO lienzo. El `<img>` ya salió con un
  // alto escrito: una imagen de cierre más baja se dibuja estirada.
  const termino = await pedir(new Date(Date.now() - 86_400_000));
  const medidoFin = tamanoPng(termino.buf);
  ok(
    medidoFin.ancho === medido.ancho && medidoFin.alto === medido.alto,
    "el PNG de «ya terminó» mide igual que el de la cuenta corriendo",
    `${medidoFin.ancho}×${medidoFin.alto} vs ${medido.ancho}×${medido.alto}`,
  );
  // …y no es el mismo dibujo: si lo fuera, el caso de arriba pasaría por la
  // razón equivocada.
  ok(!termino.buf.equals(corriendo.buf), "…y no es la misma imagen: dibuja otra cosa");

  // 🔴 Y **el dibujo LLENA el lienzo**, que es una pregunta distinta de cuánto
  // mide el archivo: `ImageResponse` recorta al tamaño que se le pide, así que
  // una caja 10 px más baja sale igual de grande y con una franja transparente
  // abajo. En un mail eso no se ve en el preview —el fondo del editor es blanco—
  // y sí en una casilla con tema oscuro. Por eso el oráculo son los PÍXELES.
  const abajoAlMedio = async (buf: Buffer) => {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const x = Math.floor(info.width / 2);
    const y = info.height - 2;
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const [, , , alfaCorriendo] = await abajoAlMedio(corriendo.buf);
  const [rf, gf, bf, alfaFin] = await abajoAlMedio(termino.buf);
  ok(alfaCorriendo === 255, "la cuenta corriendo llega hasta el borde de abajo", `alfa ${alfaCorriendo}`);
  ok(alfaFin === 255, "y la pantalla de cierre también", `alfa ${alfaFin}`);
  // #111111 es el fondo que se pidió: no alcanza con que haya algo pintado, el
  // píxel de abajo tiene que ser la CASILLA y no un resto de otra cosa.
  ok(rf === 0x11 && gf === 0x11 && bf === 0x11, "…y lo que llega abajo es la casilla, no otro color", `rgb(${rf},${gf},${bf})`);

  // 🔴 **El texto de cierre no se sale del lienzo.** Lo escribe quien arma el
  // mail y puede tener `MAX_FIN` caracteres: al cuerpo de un número de dos
  // dígitos, "¡ÚLTIMA CHANCE, SE ACABÓ TODO!" mide el triple que el PNG y satori
  // lo recorta. El oráculo son los PÍXELES de los bordes: si hay tinta pegada al
  // borde, el texto se salió.
  const largo = "¡ÚLTIMA CHANCE, SE ACABÓ HOY!".slice(0, MAX_FIN);
  const conTextoLargo = await GET(
    new Request(
      urlRegresiva("https://mailer.local", {
        hasta: new Date(Date.now() - 1000).toISOString(),
        ancho: 536,
        etiquetas: [...ETIQUETAS_BASE] as [string, string, string],
        fin: largo,
        bg: "#111111",
        tinta: "#ffffff",
        rotulo: tenue("#ffffff"),
      }),
    ),
  );
  const bufLargo = Buffer.from(await conTextoLargo.arrayBuffer());
  const { data: px, info } = await sharp(bufLargo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  /** ¿Hay algún píxel claro en esa columna? La tinta es blanca, la casilla #111. */
  const columnaConTinta = (x: number) => {
    for (let y = 0; y < info.height; y++) {
      if (px[(y * info.width + x) * info.channels] > 0x80) return true;
    }
    return false;
  };
  ok(
    !columnaConTinta(3) && !columnaConTinta(info.width - 4),
    "un texto de cierre largo NO toca los bordes del PNG",
    `${largo} (${largo.length} caracteres)`,
  );
  // …y sigue habiendo texto: si no dibujara nada, el caso de arriba pasaría por
  // la razón equivocada.
  ok(columnaConTinta(Math.floor(info.width / 2)), "…y sigue dibujando el texto");

  // El cálculo, en frío: a más caracteres, menos cuerpo, y nunca más que el del
  // número (un "YA" no se dibuja gigante sólo porque entra).
  const mm = medidas(536);
  ok(cuerpoFin(mm, "YA") === mm.numero, "un texto corto usa el cuerpo del número");
  ok(cuerpoFin(mm, "X".repeat(MAX_FIN)) < mm.numero, "uno largo baja de cuerpo");
  ok(
    cuerpoFin(mm, "X".repeat(MAX_FIN)) * MAX_FIN * 0.62 <= mm.ancho,
    "…lo suficiente como para entrar en el ancho",
  );

  // 🔴 `no-store` es lo que hace que la cuenta sea una cuenta. Sin él la CDN de
  // Vercel devuelve el mismo PNG a todos los que abran el mail después.
  ok(
    (corriendo.res.headers.get("cache-control") ?? "").includes("no-store"),
    "sale con `no-store`",
    corriendo.res.headers.get("cache-control") ?? "(sin header)",
  );

  // El ancho pedido manda: dos anchos distintos son dos PNG de distinto tamaño.
  const angosto = await pedir(new Date(Date.now() + 86_400_000), 320);
  const esperado320 = escalar(medidas(320), ESCALA);
  ok(tamanoPng(angosto.buf).ancho === esperado320.ancho, "un ancho distinto da un PNG distinto");

  // Sin fecha no hay nada que contar: 400, no un PNG que diga NaN.
  const sinFecha = await GET(new Request("https://mailer.local/api/regresiva"));
  ok(sinFecha.status === 400, "sin `hasta` contesta 400 y no dibuja nada");
}

// ─────────────────────────────────────────────────────────────────────────────
titulo("4) 🔴 La ruta no toca la base");
{
  // Neon está al filo de los 100 CU-h y la base es compartida con Resorty: una
  // escritura por apertura sobre 16.800 contactos la voltea. El chequeo es sobre
  // el TEXTO del archivo y no sobre lo que la ruta hizo en una corrida: importar
  // prisma alcanza para que un `await` de mañana lo use sin que nadie lo note.
  const fuente = readFileSync("app/api/regresiva/route.ts", "utf8");
  ok(!/from "@\/lib\/prisma"|from "@prisma/.test(fuente), "no importa prisma");
  ok(!/\bprisma\./.test(fuente), "y no lo usa por ningún otro camino");
}

// ─────────────────────────────────────────────────────────────────────────────
titulo("5) El `<img>` del mail: medidas declaradas, y el `alt` sin números");
{
  const h = html(bloque());
  const m = medidas(536);
  const img = h.match(/<img[^>]*api\/regresiva[^>]*>/)?.[0] ?? "";
  ok(!!img, "el bloque emite su `<img>`");
  // Outlook de escritorio no escala por CSS: sin los atributos dibujaría el PNG
  // a su tamaño real, que es el doble.
  ok(img.includes(`width="${m.ancho}"`) && img.includes(`height="${m.alto}"`), "declara width y height como ATRIBUTOS", img);
  ok(img.includes("height:auto"), "y `height:auto` en el style, para que al achicarse no salga aplastado");

  // 🔴 El `alt` se escribe al enviar y no cambia nunca más. Un número adentro
  // queda congelado en el instante del envío y miente en cuanto pasa una hora.
  const alt = img.match(/alt="([^"]*)"/)?.[1] ?? "";
  ok(alt === lineaRegresiva(HASTA), "el alt ES la fecha límite, palabra por palabra", alt);
  // 🔑 El oráculo de que el alt no puede envejecer no es leerlo: es que el
  // renderer **no tenga cómo saber cuánto falta**. `restante` es la única puerta
  // por la que un número de la cuenta puede entrar al HTML, y el renderer no la
  // usa ni la importa. Un `alt` con "faltan 2 días" tendría que llamarla.
  const fuenteRender = readFileSync("lib/email/render.ts", "utf8");
  ok(!/\brestante\b/.test(fuenteRender), "…y el renderer no llama a `restante`: no tiene reloj");

  // El host sale de `assetsBase`, que es el mismo del que cuelgan los links del
  // mail. Un src relativo lo resuelve el cliente contra `mail.google.com`.
  ok(img.includes(`src="${HOST}/api/regresiva?`), "el src cuelga del host de envío y es absoluto");

  // Sin `assetsBase` no hay URL absoluta posible ⇒ no se dibuja el `<img>`, pero
  // el bloque NO desaparece: queda la fecha escrita.
  const sinBase = html(bloque(), { assetsBase: "" });
  ok(!sinBase.includes("api/regresiva"), "sin assetsBase no se emite ningún `<img>`");
  ok(sinBase.includes("diciembre"), "…pero la fecha escrita sigue estando");

  // Sin fecha el bloque no existe, igual que `imagen` sin `url`.
  const sinFecha = html({ tipo: "regresiva", hasta: "" } as unknown as Bloque);
  ok(!sinFecha.includes("api/regresiva"), "sin `hasta` no dibuja nada");
}

// ─────────────────────────────────────────────────────────────────────────────
titulo("6) 🔴 La fecha escrita: en el HTML y en el `text/plain`");
{
  const texto = renderEmailTexto(
    { v: V_ACTUAL, bloques: [bloque()] } as unknown as ContenidoCampania,
    OPTS,
  );
  const linea = lineaRegresiva(HASTA);
  ok(texto.includes(linea), "la versión de texto lleva la fecha límite", `esperaba "${linea}"`);
  // Sin números por el mismo motivo que el `alt`: el `text/plain` viaja en cada
  // envío y se escribe una sola vez.
  ok(!/faltan?\s*\d/i.test(texto), "…y no dice cuánto falta");
  ok(html(bloque()).includes(linea), "y el HTML dibuja la misma línea, no una parecida");

  // ⚠️ El formato sale de `horaLocal`, en la zona del NEGOCIO. Con la zona del
  // servidor (UTC en Vercel) esta fecha diría "25 de diciembre, 02:59".
  ok(linea.includes("24 de diciembre") && linea.includes("20:59"), "la hora es la de Argentina, no la de UTC", linea);
}

// ─────────────────────────────────────────────────────────────────────────────
titulo("7) Lo que entra por la URL se sanea (la ruta es pública)");
{
  const q = (s: string) => leerParams(new URLSearchParams(s));
  ok(q("") === undefined && q("hasta=cualquiera") === undefined, "sin un instante legible no hay params");

  const largo = "X".repeat(200);
  const p = q(`hasta=${HASTA.toISOString()}&e=${largo}|${largo}|${largo}&fin=${largo}&bg=javascript:alert(1)&a=9999`)!;
  ok(p.etiquetas.every((e) => e.length === MAX_ETIQUETA), "las etiquetas se recortan");
  ok(p.fin.length === MAX_FIN, "el texto de cierre también");
  ok(p.ancho === ANCHO_MAX, "el ancho se acota");
  // 🔴 Un color entra por la query y termina adentro del `style` que dibuja
  // satori: lista blanca, no confianza.
  ok(p.bg === "#111111", "un color basura cae al de fábrica", p.bg);
  ok(colorValido("#abc", "x") === "#abc" && colorValido("#aabbccdd", "x") === "#aabbccdd", "hex de 3, 6 y 8 sí valen");
  ok(colorValido("red", "x") === "x" && colorValido("#12345", "x") === "x", "un nombre de color o un hex trunco, no");

  // Vacías vuelven a las de fábrica en vez de dejar tres casillas sin rótulo.
  const vacias = q(`hasta=${HASTA.toISOString()}&e=||`)!;
  ok(vacias.etiquetas.join("/") === ETIQUETAS_BASE.join("/"), "una etiqueta vacía cae a la de fábrica");
  ok(etiquetasDe(["", "  ", "SEG"]).join("/") === `${ETIQUETAS_BASE[0]}/${ETIQUETAS_BASE[1]}/SEG`, "…y lo mismo del lado del bloque");

  // 🔑 Ida y vuelta: lo que el renderer escribe es exactamente lo que la ruta lee.
  // Es lo que hace que cambiar un parámetro no se pierda callado en el medio.
  const original: ParamsRegresiva = {
    hasta: HASTA.toISOString(),
    ancho: 480,
    etiquetas: ["D", "H", "M"],
    fin: "SE ACABÓ",
    bg: "#18a8e8",
    tinta: "#ffffff",
    rotulo: "#ffffffb3",
  };
  const vuelta = leerParams(new URL(urlRegresiva(HOST, original)).searchParams);
  ok(JSON.stringify(vuelta) === JSON.stringify(original), "los parámetros vuelven idénticos", JSON.stringify(vuelta));
}

// ─────────────────────────────────────────────────────────────────────────────
titulo("8) El documento queda GUARDADO sano");
{
  // ⚠️ **Sin `v`, a propósito.** `esActual()` deja pasar los documentos ya
  // guardados por el camino rápido SIN re-sanear, así que un fixture con la
  // versión puesta probaría el camino que no corre. Y se busca por tipo porque
  // la migración de un documento sin versión materializa un `encabezado` que
  // queda primero en la lista.
  const leer = (b: Record<string, unknown>) =>
    (leerContenido({ bloques: [{ tipo: "regresiva", ...b }] }).bloques.find((x) => x.tipo === "regresiva") ??
      {}) as unknown as Record<string, unknown>;

  // 🔴 Una fecha ilegible se BORRA y el bloque deja de dibujarse. Caer a "ahora"
  // sería una cuenta regresiva corriendo hacia una fecha que nadie eligió, y eso
  // llega a la casilla igual de bien que la buena.
  ok(leer({ hasta: "el domingo" }).hasta === "", "una fecha ilegible se borra");
  ok(leer({ hasta: HASTA.toISOString() }).hasta === HASTA.toISOString(), "una buena queda en ISO");
  ok(leer({ hasta: "2026-12-24T23:59:00Z" }).hasta === HASTA.toISOString(), "y se canoniza");

  const sucio = leer({ hasta: HASTA.toISOString(), etiquetas: ["X".repeat(99), 7, null], fin: "Y".repeat(99), bg: 42 });
  ok((sucio.etiquetas as string[])[0].length === MAX_ETIQUETA, "las etiquetas se recortan al guardar");
  ok((sucio.etiquetas as string[]).length === 3, "y son siempre tres");
  ok((sucio.fin as string).length === MAX_FIN, "el texto de cierre también");
  ok(!("bg" in sucio), "un fondo que no es un string se borra");

  // `instante` es la frontera compartida: el saneo, el renderer y la ruta usan
  // la misma, o cada uno decidiría distinto qué fecha es válida.
  ok(instante("  ") === undefined && instante(42) === undefined, "`instante` sólo acepta strings legibles");
}

}

main().then(() => {
  console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ La cuenta regresiva cuenta lo que tiene que contar");
  process.exit(fallos ? 1 : 0);
});
