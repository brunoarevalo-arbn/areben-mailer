// Una foto CORTADA EN PEDAZOS, cada uno con su link: el bloque `mosaico`.
//
//   node --import tsx scripts/probar-mosaico.ts
//
// 🔴 **Por qué existe la feature**: una pieza que viene diseñada entera de afuera
// —el mail que ES una foto— no podía tener más de un destino. La primera respuesta
// que da cualquiera es `<map>`/`<area>`, y **Gmail los borra**: el mail queda con
// una foto grande que no lleva a ningún lado. La única forma que llega a la casilla
// es que cada zona sea **su propia imagen** adentro de una celda de tabla, y por eso
// los cortes van en bandas y columnas: una tabla es una grilla, no un plano.
//
// Las seis invariantes que este archivo cuida, y ninguna es "que ande":
//
//   1. 🔴 **Los pedazos embaldosan.** Sobre la foto original —o se pierde una
//      franja de la imagen, o se dibuja dos veces y se ve la costura— y sobre el
//      ancho del mail: si los anchos de una fila suman 601 en un mail de 600,
//      **Outlook desborda la tabla y se lleva el resto del correo**. Tres columnas
//      de 33,33% redondeadas por separado dan exactamente eso.
//   2. **Todas las celdas de una fila declaran el MISMO alto.** Si cada pedazo
//      calcula el suyo de su relación de aspecto, los redondeos difieren en un
//      píxel entre vecinos y aparece el escalón: una rayita blanca justo donde la
//      foto tenía que verse continua.
//   3. **Cada pedazo marcado es UN link, y no hay ninguno de más.** Es el conteo
//      que pide el plan: los `<a>` del render contra los pedazos que se marcaron.
//   4. ⛔ **Ni un `<map>` ni un `<area>` en el HTML.** Es la salida que no
//      funciona, y la que va a volver a proponerse el día que alguien retoque esto.
//   5. 🔴 **Una grilla a medio cortar sale como la foto ENTERA.** Nunca dos pedazos
//      y cuatro huecos: eso llega a la casilla de otra persona y no hay arreglo.
//   6. **La versión de texto no queda vacía.** Un mail que es 100% imagen sin
//      `text/plain` es la señal de spam más vieja que hay —y de ahí saca el buzón
//      el texto de preview—. Es el precio de este bloque, y se paga con el `alt`.
import { renderEmailHtml, renderEmailTexto } from "../lib/email/render";
import {
  armarMosaico, bordes, cuantosPedazos, escalaDe, estaCortado, GRILLA_ENTERA, MAX_CELDAS,
  MAX_FILAS, MIN_PCT, moverCorteCelda, moverCorteFila, normalizar, partirCelda, partirFila,
  pedazosDe, quitarCelda, quitarFila, repartir, sinAlt, tirarPedazos,
} from "../lib/email/mosaico";
import { leerContenido, V_ACTUAL } from "../lib/email/esquema";
import type { Bloque, CeldaMosaico, ContenidoCampania, FilaMosaico } from "../lib/email/bloques";

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

const FOTO = "https://ejemplo.test/pieza.jpg";
const DESTINO = "https://bdiaccesorios.com.ar/girlhood/";
/** El ancho del mail de fábrica. El bloque va a sangre, así que es el ancho útil. */
const ANCHO = 600;

const cel = (x: Partial<CeldaMosaico> = {}): CeldaMosaico => ({ ancho: 100, ...x });

const bloque = (filas: FilaMosaico[], extra: Record<string, unknown> = {}): Bloque =>
  ({ id: "m1", tipo: "mosaico", foto: FOTO, ratio: 1.25, filas, ...extra }) as unknown as Bloque;

/** Todo pedazo cortado y subido: es la condición para que salga la grilla. */
const cortada = (filas: FilaMosaico[]): FilaMosaico[] =>
  filas.map((f, i) => ({
    ...f,
    celdas: f.celdas.map((c, j) => ({ ...c, url: `https://ejemplo.test/p${i}${j}.jpg` })),
  }));

/** La tabla del mosaico, que es la única del mail con `border-collapse` inline. */
const tablaDe = (h: string) => h.match(/<table[^>]*border-collapse:collapse[\s\S]*?<\/table>/)?.[0] ?? "";
/** Los `<tr>` de esa tabla, cada uno con sus `<td>`. */
const filasDe = (h: string) => (tablaDe(h).match(/<tr>[\s\S]*?<\/tr>/g) ?? []);
/** Los `width="N"` de los `<td>` de una fila: es lo que Outlook mide. */
const anchosDe = (tr: string) => [...tr.matchAll(/<td width="(\d+)"/g)].map((m) => Number(m[1]));
/** Los `height="N"` de los `<img>` de una fila. */
const altosDe = (tr: string) => [...tr.matchAll(/<img[^>]*height="(\d+)"/g)].map((m) => Number(m[1]));

console.log("\n1) El reparto suma exacto: la fila no puede desbordar la tabla");
{
  // 🔴 El caso que motivó `repartir`: tres tercios de 536 redondeados por separado
  // dan 179+179+179 = 537, y ese píxel de más en Outlook desborda la tabla.
  const tres = repartir([33, 33, 34], 536);
  ok(tres.reduce((a, b) => a + b, 0) === 536, "tres columnas de 536 suman 536", `dio ${tres.join("+")}`);
  ok(
    repartir([33.3333, 33.3333, 33.3333], 536).reduce((a, b) => a + b, 0) === 536,
    "y también con tercios que no dan 100 redondos",
  );
  // Cinco anchos raros contra diez totales distintos: si alguno no suma, la tabla
  // se rompe en ese ancho de mail y en ningún otro.
  const casos: number[][] = [[7, 93], [1, 1, 98], [50, 50], [20, 20, 20, 20, 20], [33, 33, 33]];
  const totales = [320, 480, 536, 540, 600, 601, 700, 128, 3, 1];
  const malos = casos.flatMap((p) =>
    totales.filter((t) => repartir(p, t).reduce((a, b) => a + b, 0) !== t).map((t) => `${p.join("/")}@${t}`),
  );
  ok(malos.length === 0, "50 combinaciones de anchos y totales suman EXACTAMENTE el total", malos.join(", "));
  ok(repartir([], 600).length === 0, "sin partes no devuelve nada (y no divide por cero)");
  // Un documento roto no puede hacer que el reparto se vaya del total: el `NaN` de
  // un Json editado a mano cuenta como cero y el resto se reparte igual.
  ok(
    repartir([Number.NaN, 50], 600).reduce((a, b) => a + b, 0) === 600,
    "un porcentaje ilegible no rompe el total",
  );
}

console.log("\n2) Los pedazos embaldosan la foto original");
{
  const g = normalizar([
    { alto: 60, celdas: [cel({ ancho: 100 })] },
    { alto: 40, celdas: [cel({ ancho: 33 }), cel({ ancho: 33 }), cel({ ancho: 34 })] },
  ]);
  const NAT_W = 1417;
  const NAT_H = 1771;
  const ps = pedazosDe(g, NAT_W, NAT_H, 1);

  // Cada banda arranca donde terminó la anterior, y la última llega al último
  // píxel: sin esto se pierde una franja de la foto o se dibuja dos veces.
  const bandas = [...new Set(ps.map((p) => `${p.sy}:${p.sh}`))].map((s) => s.split(":").map(Number));
  let y = 0;
  let bien = true;
  for (const [sy, sh] of bandas.sort((a, b) => a[0] - b[0])) {
    if (sy !== y) bien = false;
    y += sh;
  }
  ok(bien && y === NAT_H, "las bandas cubren el alto entero, sin hueco ni solape", `terminó en ${y} de ${NAT_H}`);

  const fila1 = ps.filter((p) => p.fila === 1);
  let x = 0;
  let bienX = true;
  for (const p of fila1) {
    if (p.sx !== x) bienX = false;
    x += p.sw;
  }
  ok(bienX && x === NAT_W, "las columnas de una banda cubren el ancho entero", `terminó en ${x} de ${NAT_W}`);
  ok(ps.every((p) => p.sw > 0 && p.sh > 0), "ningún pedazo sale de ancho o alto cero");
  ok(ps.every((p) => p.dw >= 1 && p.dh >= 1), "ningún lienzo de salida sale vacío");

  // 🔴 **Nunca se agranda.** Al doble de lo que se muestra, y si la foto no da
  // para el doble se usa lo que hay: escalar para arriba no agrega información,
  // agrega bytes — y acá los bytes se pagan por destinatario Y por pedazo.
  ok(escalaDe(4000, 600) === 0.3, "una foto grande se baja al doble del ancho útil");
  ok(escalaDe(500, 600) === 1, "una foto chica NO se agranda");
  ok(escalaDe(0, 600) === 1, "una foto sin medir no rompe la cuenta");

  // 🔴 Y que la escala se APLIQUE: un mutante que subiera los pedazos al doble de
  // lo que corresponde pasaba todo lo de arriba, y son bytes que se pagan por
  // destinatario Y por pedazo. Se mide sobre el ANCHO TOTAL de una banda, que es
  // lo que de verdad viaja.
  const anchoSalida = (natW: number) => {
    const e = escalaDe(natW, ANCHO);
    const f0 = pedazosDe(g, natW, 2000, e).filter((p) => p.fila === 1);
    return f0.reduce((a, p) => a + p.dw, 0);
  };
  ok(Math.abs(anchoSalida(4000) - 2 * ANCHO) <= 3, "una foto grande se sube al DOBLE del ancho del mail", `dio ${anchoSalida(4000)}`);
  ok(Math.abs(anchoSalida(800) - 800) <= 3, "y una más chica que el doble se sube tal cual, sin agrandarse", `dio ${anchoSalida(800)}`);
  ok(
    pedazosDe(g, 4000, 2000, escalaDe(4000, ANCHO)).every((p) => p.dw <= p.sw && p.dh <= p.sh),
    "ningún pedazo sale MÁS GRANDE que el rectángulo que se le tomó a la foto",
  );
}

console.log("\n3) La tabla que sale: ni un píxel de más, y el mismo alto por fila");
{
  const g = cortada([
    { alto: 60, celdas: [cel()] },
    { alto: 40, celdas: [cel({ ancho: 33 }), cel({ ancho: 33 }), cel({ ancho: 34 })] },
  ]);
  const h = html([bloque(g)]);
  const trs = filasDe(h);
  ok(trs.length === 2, "dos bandas, dos filas de tabla", `hubo ${trs.length}`);
  const sumas = trs.map((tr) => anchosDe(tr).reduce((a, b) => a + b, 0));
  ok(sumas.every((s) => s === ANCHO), `toda fila suma exactamente ${ANCHO}`, sumas.join(", "));
  const altos = trs.map(altosDe);
  ok(
    altos.every((a) => a.length > 0 && new Set(a).size === 1),
    "todas las celdas de una fila declaran el MISMO alto (si no, escalón)",
    altos.map((a) => a.join("/")).join(" · "),
  );
  // El alto total tiene que ser el de la foto estirada al ancho del mail, o la
  // pieza sale achatada o estirada respecto de lo que se diseñó.
  const totalAlto = altos.reduce((a, f) => a + f[0], 0);
  ok(totalAlto === Math.round(ANCHO * 1.25), "los altos suman la foto entera a ese ancho", `dio ${totalAlto}`);
  ok(anchosDe(trs[1]).length === 3, "la segunda banda sale en tres columnas");

  // Sin `ratio` medido no hay de dónde sacar el alto: se puede, pero se dice.
  const sinRatio = html([bloque(g, { ratio: undefined })]);
  ok(!/<img[^>]*height="/.test(tablaDe(sinRatio)), "sin la foto medida no se declara ningún alto");
  ok(tablaDe(sinRatio).includes("height:auto"), "…y ahí el alto queda en auto, no en cero");
}

console.log("\n4) El margen del panel achica el ancho útil, y la fila lo sigue");
{
  const g = cortada([{ alto: 100, celdas: [cel({ ancho: 50 }), cel({ ancho: 50 })] }]);
  const b = bloque(g);
  (b as unknown as { estilo: unknown }).estilo = { caja: { padX: 32 } };
  const trs = filasDe(html([b]));
  const suma = anchosDe(trs[0]).reduce((a, x) => a + x, 0);
  ok(suma === ANCHO - 64, "con 32 de margen la fila suma 536, no 600", `dio ${suma}`);
  // Y el default es a sangre: la pieza viene diseñada de punta a punta.
  const solo = anchosDe(filasDe(html([bloque(g)]))[0]).reduce((a, x) => a + x, 0);
  ok(solo === ANCHO, "sin tocar nada, la foto va de punta a punta");
}

console.log("\n5) Un link por pedazo marcado, y ni uno de más");
{
  const g = cortada([
    { alto: 50, celdas: [cel({ ancho: 50, enlace: DESTINO }), cel({ ancho: 50 })] },
    { alto: 50, celdas: [cel({ ancho: 100, enlace: `${DESTINO}?x=1` })] },
  ]);
  const t = tablaDe(html([bloque(g)]));
  const anclas = (t.match(/<a href="/g) ?? []).length;
  ok(anclas === 2, "dos pedazos marcados ⇒ dos anclas, y el sin link no lleva ninguna", `hubo ${anclas}`);
  ok((t.match(/<img /g) ?? []).length === 3, "los tres pedazos salen igual, con link o sin él");

  // ⚠️ El marco azul de link que Word le dibuja a una imagen dentro de un `<a>`:
  // el `border` de CSS no lo saca, el ATRIBUTO sí. Acá va en todas, porque en una
  // grilla el marco de UNA se ve como una raya entre dos pedazos.
  const imgs = t.match(/<img [^>]*>/g) ?? [];
  ok(imgs.every((i) => / border="0"/.test(i)), "todo pedazo lleva `border=\"0\"` como ATRIBUTO");
  ok(imgs.every((i) => /display:block/.test(i)), "y `display:block`: si no, queda una franja abajo");
  ok(
    (t.match(/<td [^>]*font-size:0;line-height:0/g) ?? []).length === 3,
    "todo `<td>` mata la altura de línea (si no, franja blanca en Outlook)",
  );
  ok(/cellspacing="0"/.test(t) && /border-collapse:collapse/.test(t), "la tabla no deja aire entre pedazos");

  // 🔴 Un `javascript:` guardado a mano no sale: la frontera es el EMISOR, porque
  // `esActual()` saltea el saneo de todo documento ya guardado.
  const sucio = cortada([{ alto: 100, celdas: [cel({ enlace: "javascript:alert(1)" })] }]);
  const hSucio = html([bloque(sucio)]);
  ok(!hSucio.includes("javascript:"), "un link con protocolo raro no llega al mail");
  ok(!/<a href=/.test(tablaDe(hSucio)), "…y el pedazo sale sin ancla, no con una rota");
}

console.log("\n6) La salida que NO funciona: nada de mapas de imagen");
{
  const g = cortada([{ alto: 100, celdas: [cel({ ancho: 50, enlace: DESTINO }), cel({ ancho: 50, enlace: DESTINO })] }]);
  const h = html([bloque(g)]);
  ok(!/<map\b/i.test(h) && !/<area\b/i.test(h), "ni un `<map>` ni un `<area>`: Gmail los borra");
  ok(!/position:\s*absolute/i.test(tablaDe(h)), "y nada de `position`, que Gmail también borra");
}

console.log("\n7) A medio cortar sale la foto ENTERA, nunca una grilla con huecos");
{
  const media: FilaMosaico[] = [
    { alto: 50, celdas: [cel({ url: "https://ejemplo.test/p1.jpg", enlace: DESTINO })] },
    { alto: 50, celdas: [cel({ enlace: DESTINO })] },
  ];
  ok(!estaCortado(media), "una grilla con un pedazo sin subir no está cortada");
  const t = tablaDe(html([bloque(media)]));
  const srcs = [...t.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);
  ok(srcs.length === 1 && srcs[0] === FOTO, "sale una sola imagen y es la foto entera", srcs.join(", "));
  ok(!/<a href=/.test(t), "y sin ningún link: es exactamente lo que el editor avisa que se pierde");

  // Recién con TODOS los pedazos aparece la grilla.
  const toda = cortada(media);
  ok(estaCortado(toda), "con todos los pedazos subidos, sí está cortada");
  ok(filasDe(html([bloque(toda)])).length === 2, "…y ahí sí salen las dos bandas");

  // Sin foto no se dibuja nada: un `<img src="">` es el ícono de imagen rota en la
  // casilla de otra persona. Mismo criterio que `imagen` sin `url`.
  ok(tablaDe(html([bloque(GRILLA_ENTERA, { foto: "" })])) === "", "sin foto el bloque desaparece");
}

console.log("\n8) Con las imágenes apagadas, la pieza sigue diciendo de qué se trata");
{
  const g = cortada([
    { alto: 50, celdas: [cel({ ancho: 50, enlace: DESTINO, alt: "Camperas de jean" }), cel({ ancho: 50, alt: "Buzos" })] },
    { alto: 50, celdas: [cel({ enlace: `${DESTINO}?x=1`, alt: "Ver todo" })] },
  ]);
  const t = tablaDe(html([bloque(g)]));
  ok(/alt="Camperas de jean"/.test(t) && /alt="Buzos"/.test(t) && /alt="Ver todo"/.test(t), "cada pedazo lleva su alt");

  // 🔴 La parte `text/plain`: es TODO lo que sobrevive de este bloque, y sin ella
  // el mail es solo-HTML — la señal de spam más vieja que hay, y encima de ahí saca
  // el buzón el texto de preview.
  const tx = texto([bloque(g)]);
  ok(tx.includes("Camperas de jean: " + DESTINO), "el texto lleva el alt con su link");
  ok(tx.includes("Buzos"), "y el alt del pedazo sin link también");
  const vacio = texto([]);
  ok(tx !== vacio, "un mail que es una foto NO sale con la parte de texto vacía");

  // 🔴 Una comilla en el `alt` NO puede cerrar el atributo. Es el único texto libre
  // de este bloque y va entero adentro de un `alt="…"`: sin escapar, `Ver "Girlhood"`
  // sale como una etiqueta rota con un atributo de más — la puerta de un `onerror=`.
  const conComilla = cortada([{ alto: 100, celdas: [cel({ alt: 'Ver "Girlhood" ahora' })] }]);
  const tc = tablaDe(html([bloque(conComilla)]));
  ok(tc.includes("&quot;Girlhood&quot;"), "una comilla en el alt sale escapada");
  ok((tc.match(/<img /g) ?? []).length === 1 && !/onerror/i.test(tc), "…y el `<img>` sigue siendo uno solo y limpio");

  // El contador que el editor le pone a la vista: sin esto el precio de este
  // bloque se paga callado.
  ok(sinAlt(g) === 0, "una grilla con todos los alt puestos no avisa nada");
  ok(sinAlt(cortada([{ alto: 100, celdas: [cel(), cel({ ancho: 50, alt: "x" })] }])) === 1, "y cuenta el que falta");
}

console.log("\n9) Un Json roto no puede emitir una fila que desborde");
{
  // Todo lo que puede llegar de un Json editado a mano, junto: bandas de más,
  // columnas de más, porcentajes que suman 300, negativos y basura.
  const roto = [
    { alto: -50, celdas: [cel({ ancho: 200 }), cel({ ancho: 200 })] },
    { alto: Number.NaN, celdas: [] },
    { alto: 100, celdas: Array.from({ length: 12 }, () => cel({ ancho: 30 })) },
    ...Array.from({ length: 9 }, () => ({ alto: 50, celdas: [cel()] })),
  ] as unknown as FilaMosaico[];
  const g = normalizar(roto);
  ok(g.length <= MAX_FILAS, `no salen más de ${MAX_FILAS} bandas`, `salieron ${g.length}`);
  ok(g.every((f) => f.celdas.length <= MAX_CELDAS), `ni más de ${MAX_CELDAS} columnas por banda`);
  ok(g.every((f) => f.celdas.length > 0), "no queda ninguna banda sin columnas");
  ok(g.reduce((a, f) => a + f.alto, 0) === 100, "los altos suman 100");
  ok(g.every((f) => f.celdas.reduce((a, c) => a + c.ancho, 0) === 100), "y cada banda suma 100 de ancho");
  ok(g.every((f) => f.alto >= 1 && f.celdas.every((c) => c.ancho >= 1)), "ningún pedazo queda en cero");
  // Y lo que de verdad importa: el HTML que sale de eso tampoco desborda.
  const trs = filasDe(html([bloque(cortada(g))]));
  const sumas = trs.map((tr) => anchosDe(tr).reduce((a, b) => a + b, 0));
  ok(sumas.every((s) => s === ANCHO), "el HTML de un Json roto sigue sumando el ancho exacto", sumas.join(", "));
  ok(normalizar([]).length === 1, "una grilla vacía cae a la foto entera, no a cero filas");
  ok(normalizar(undefined)[0].celdas.length === 1, "y una ausente también");
}

console.log("\n10) El saneo del esquema deja el documento GUARDADO sano");
{
  // ⚠️ Este camino sólo corre en la lectura LENTA: `esActual()` deja pasar los
  // documentos ya en la versión actual sin re-sanear (por eso la §9 mide el
  // renderer). Lo que esto fija es que un Json amontonado quede arreglado la
  // próxima vez que alguien toque la campaña, en vez de arreglarse en cada lectura.
  const sucio = {
    bloques: [
      {
        tipo: "mosaico",
        foto: FOTO,
        ratio: "muchisimo",
        filas: [
          { alto: 200, celdas: [{ ancho: 50, url: 7, enlace: "  https://x.test  ", alt: "Hola" }, { ancho: 50, url: "" }] },
          "no soy una fila",
        ],
      },
    ],
  } as unknown as ContenidoCampania;
  // ⚠️ Se busca POR TIPO y no por índice: sin `v`, la migración le materializa un
  // `encabezado` adelante y `bloques[0]` sería ése.
  const b = leerContenido(sucio).bloques.find((x) => x.tipo === "mosaico") as Extract<Bloque, { tipo: "mosaico" }>;
  ok(b.filas.length === 1 && b.filas[0].celdas.length === 2, "la fila que no era una fila se descarta");
  ok(b.filas[0].alto === 100, "el alto se acomoda al rango");
  ok(b.ratio === undefined, "un ratio ilegible se borra en vez de caer a un número inventado");
  // 🔑 Un `url` que no es string se BORRA, y eso apaga la grilla entera hacia "la
  // foto entera": mejor la pieza sin cortar que un `<img src="7">` en una casilla.
  ok(b.filas[0].celdas[0].url === undefined, "un `url` que no es string se borra");
  ok(!estaCortado(b.filas), "…y con eso la grilla queda «sin cortar», que es el estado seguro");
  ok(b.filas[0].celdas[0].enlace === "https://x.test", "el link se guarda sin espacios");
  ok(b.filas[0].celdas[0].alt === "Hola", "y el texto alternativo se conserva");
}

console.log("\n11) Los cortes del editor: partir, unir y arrastrar");
{
  const g0 = normalizar(GRILLA_ENTERA);
  const suman100 = (g: FilaMosaico[]) =>
    g.reduce((a, f) => a + f.alto, 0) === 100 && g.every((f) => f.celdas.reduce((a, c) => a + c.ancho, 0) === 100);

  const g1 = partirFila(g0, 0);
  ok(g1.length === 2 && suman100(g1), "partir una banda da dos que siguen sumando 100", g1.map((f) => f.alto).join("+"));
  const g2 = partirCelda(g1, 1, 0);
  ok(g2[1].celdas.length === 2 && suman100(g2), "partir un pedazo da dos columnas que suman 100");
  ok(g2[0].celdas.length === 1, "y no toca la otra banda: por eso es una grilla y no un plano");

  // 🔑 La banda de abajo hereda las COLUMNAS pero no los pedazos: heredar los
  // `url` dejaría dos bandas mostrando la MISMA franja de la foto, que es el error
  // que nadie ve hasta que el mail está mandado.
  const conUrl = cortada([{ alto: 100, celdas: [cel({ ancho: 50, enlace: DESTINO, alt: "A" }), cel({ ancho: 50 })] }]);
  const partida = partirFila(conUrl, 0);
  ok(partida[1].celdas.every((c) => c.url === undefined), "la banda nueva nace SIN pedazos");
  ok(partida[1].celdas[0].enlace === DESTINO && partida[1].celdas[0].alt === "A", "…pero hereda link y alt: son del destino");

  // Unir devuelve el espacio a la vecina, no lo reparte entre todas: si lo
  // repartiera, borrar una banda movería los cortes de las otras.
  const u = quitarFila(g2, 0);
  ok(u.length === 1 && u[0].alto === 100, "unir dos bandas devuelve una de 100");
  ok(quitarFila(g0, 0).length === 1, "y nunca deja el bloque sin ninguna banda");
  const uc = quitarCelda(g2, 1, 1);
  ok(uc[1].celdas.length === 1 && uc[1].celdas[0].ancho === 100, "unir dos columnas devuelve una de 100");
  ok(quitarCelda(g2, 0, 0)[0].celdas.length === 1, "y nunca deja una banda sin columnas");

  // Arrastrar un corte reparte SÓLO las dos partes que separa.
  const tres: FilaMosaico[] = [
    { alto: 30, celdas: [cel()] },
    { alto: 30, celdas: [cel()] },
    { alto: 40, celdas: [cel()] },
  ];
  const movida = moverCorteFila(tres, 0, 10);
  ok(movida[0].alto === 10 && movida[1].alto === 50, "el corte 0 reparte la banda 1 y la 2", movida.map((f) => f.alto).join("/"));
  ok(movida[2].alto === 40, "…y la tercera no se enteró");
  ok(suman100(movida), "y el total sigue en 100");
  // Llevado al borde frena en el mínimo en vez de dejar una banda de cero.
  const alBorde = moverCorteFila(tres, 0, -80);
  ok(alBorde[0].alto === MIN_PCT, `arrastrado al borde frena en ${MIN_PCT}, no en 0`, `dio ${alBorde[0].alto}`);
  ok(moverCorteFila(tres, 0, 999)[1].alto === MIN_PCT, "y del otro lado, igual");
  ok(moverCorteFila(tres, 5, 50).map((f) => f.alto).join() === "30,30,40", "un corte que no existe no cambia nada");
  const mc = moverCorteCelda([{ alto: 100, celdas: [cel({ ancho: 40 }), cel({ ancho: 60 })] }], 0, 0, 70);
  ok(mc[0].celdas.map((c) => c.ancho).join("/") === "70/30", "el corte vertical se mueve igual", mc[0].celdas.map((c) => c.ancho).join("/"));

  // Los topes: no es la grilla lo que se rompe, es la factura (una imagen por
  // pedazo Y por destinatario).
  let muchas = g0;
  for (let i = 0; i < 20; i++) muchas = partirFila(muchas, 0);
  ok(muchas.length === MAX_FILAS, `partir sin parar frena en ${MAX_FILAS} bandas`, `dio ${muchas.length}`);
  let anchas = g0;
  for (let i = 0; i < 20; i++) anchas = partirCelda(anchas, 0, 0);
  ok(anchas[0].celdas.length === MAX_CELDAS, `y en ${MAX_CELDAS} columnas por banda`);

  // Mover un corte invalida los pedazos: el mail volvería a mostrar cortes viejos.
  const t = tirarPedazos(conUrl);
  ok(t[0].celdas.every((c) => c.url === undefined), "mover un corte tira los pedazos");
  ok(t[0].celdas[0].enlace === DESTINO && t[0].celdas[0].alt === "A", "…y deja el link y el alt donde estaban");
  ok(cuantosPedazos(g2) === 3 && bordes([30, 30, 40]).join() === "30,60", "el conteo y los bordes son los que dibuja el editor");
}

console.log("\n12) El plano, contra lo que dibuja el mail");
{
  // Que `armarMosaico` y el HTML digan lo mismo: si se separan, el editor y el
  // renderer pasan a tener dos geometrías y una de las dos miente.
  const g = cortada([
    { alto: 25, celdas: [cel({ ancho: 40 }), cel({ ancho: 60 })] },
    { alto: 75, celdas: [cel()] },
  ]);
  const plano = armarMosaico(g, ANCHO, 1.25);
  const trs = filasDe(html([bloque(g)]));
  const delPlano = plano.filas.map((f) => f.celdas.map((c) => c.ancho).join("/")).join(" · ");
  const delHtml = trs.map((tr) => anchosDe(tr).join("/")).join(" · ");
  ok(delPlano === delHtml, "el plano y el HTML reparten idéntico", `${delPlano} vs ${delHtml}`);
  ok(
    plano.filas.map((f) => f.alto).join("/") === trs.map((tr) => altosDe(tr)[0]).join("/"),
    "y los altos también",
  );
  ok(plano.ancho === ANCHO, "el plano sabe cuánto mide la tabla");
}

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ La foto en pedazos sale como se pidió");
process.exit(fallos ? 1 : 0);
