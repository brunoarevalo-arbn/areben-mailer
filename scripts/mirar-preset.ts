// Mirar una plantilla de la galería **con los ojos**, al lado de la captura que
// la originó.
//
//   node --import tsx scripts/mirar-preset.ts catalogo          # una familia
//   node --import tsx scripts/mirar-preset.ts new-arrivals audio # por id
//   node --import tsx scripts/mirar-preset.ts --todos
//   node --import tsx scripts/mirar-preset.ts audio --hostil    # ver qué se filtra
//
// Deja en `.mirar/` tres cosas por preset: el HTML suelto, su captura, y —si el
// preset clona una referencia— **la comparación lado a lado en un solo PNG**,
// las dos escaladas a la misma altura.
//
// 🔑 Que la comparación sea UNA imagen y no dos es el punto entero del script.
// La ronda 1 de la pasada de parecido se hizo mirando una captura, cerrándola y
// abriendo la otra, y así lo único que se compara es el esqueleto: la anatomía
// coincide y el parecido no. Proporción, peso tipográfico y cuánto aire lleva
// cada bloque solo se ven con las dos cosas al lado.
//
// ⚠️ Vivió en un scratchpad durante la ronda 1 y se perdió. Por eso está acá: el
// ritual de `PLANTILLAS.md` lo pide en cada tanda de referencias.
// ⚠️ `tsx` resuelve desde el **cwd**: hay que correrlo parado en el repo.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { renderEmailHtml, type ContenidoCampania } from "../lib/email/render";
import { presetsPara } from "../lib/plantillas/presets";
import { leerContenido } from "../lib/email/esquema";
import { claveProductos, type Bloque } from "../lib/email/bloques";
import { foto } from "../lib/plantillas/fotos";
import type { Tema } from "../lib/email/tema";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const RAIZ = process.cwd();
const SALIDA = join(RAIZ, ".mirar");
const REFERENCIAS = join(RAIZ, "docs", "referencias");

/**
 * Qué preset clona qué captura.
 *
 * Vive acá y no en `presets.ts` a propósito: es información de **cómo se hizo**
 * la plantilla, no de qué es. Un preset que no está en esta lista no clona nada
 * (`tienda`, `novedades`, `grilla`, los de ciclo) y se captura solo, sin
 * comparación — que es lo correcto: no hay contra qué compararlo.
 */
const REFERENCIA: Record<string, string> = {
  // catalogo
  marroquineria: "R-002-morelia-cuero.png",
  joyeria: "R-007-lima-joyas.png",
  "new-in": "R-008-idea-new-in.png",
  electro: "R-006-atlantico-electro.png",
  audio: "R-019-cubo-audio.png",
  "new-arrivals": "R-018-simple-new-arrivals.png",
  minimal: "R-020-simple-pt.png",
  // venta
  brasas: "R-001-hot-deal-brasas.png",
  "final-sale": "R-010-autopartes-final-sale.png",
  "tu-estilo": "R-012-whats-your-style.png",
  "mega-oferta": "R-021-toluca-camaras.png",
  // fechas
  temporada: "R-004-uyuni-invierno.png",
  "spring-sale": "R-011-spring-sale.png",
  "cyber-tipografico": "R-013-cyber-monday-tipografico.png",
  "cyber-marmol": "R-015-cyber-monday-marmol.png",
  "vuelta-al-cole": "R-014-back-to-school.png",
  invitacion: "R-017-evento-business.png",
  // producto
  bodega: "R-009a-vinos-say-cheers.png",
  "negro-y-dorado": "R-016-sweet-dreams.png",
  // editorial
  ocasion: "R-003-morelia-bodas.png",
  "dos-colores": "R-005-baires-summer.png",
};

/** La cuenta de mentira. Tiene redes cargadas para que el bloque `redes` dibuje. */
const CUENTA = {
  nombre: "Marca de prueba",
  config: {
    url: "https://ejemplo.com",
    redes: [
      { red: "instagram", url: "https://instagram.com/x" },
      { red: "facebook", url: "https://facebook.com/x" },
      { red: "whatsapp", url: "https://wa.me/1" },
    ],
  },
};

/**
 * Un tema de marca **a propósito horrible**, para `--hostil`.
 *
 * 🔑 Es el test del encuadre nuevo: un clon tiene que verse igual en cualquier
 * tienda, así que **si algo de este tema aparece en el render, el preset dejó un
 * campo sin declarar**. `combinarTema` es un spread plano (`lib/email/tema.ts`):
 * lo que el preset no dice se cae al tema de la marca y se filtra.
 */
const TEMA_HOSTIL: Tema = {
  base: "oscuro",
  fondo: "#2b0b3a",
  fondoContenido: "#3d1250",
  acento: "#00ff95",
  link: "#00ff95",
  ancho: 660,
  fuente: "mono",
};

/** Ocho productos de mentira, con fotos del pack de stock. */
const CLAVES = [
  "producto-perfume", "producto-calzado", "producto-auricular", "producto-vino",
  "producto-textil", "producto-reloj", "producto-mochila", "producto-escolar",
] as const;

const NOMBRES = [
  "Perfume Nocturne 100ml", "Zapatilla Runner Pro", "Auriculares Aura ANC",
  "Malbec Reserva 2021", "Sweater oversize lana", "Reloj Classic acero",
  "Mochila urbana 22L", "Set escolar completo",
];

const PRODUCTOS = CLAVES.map((k, i) => ({
  nombre: NOMBRES[i],
  precio: `$${24 + i * 9}.990`,
  precioPromo: i % 3 === 0 ? `$${19 + i * 7}.990` : undefined,
  imagen: foto(k),
  url: "https://ejemplo.com/productos/x",
}));

// ─────────────────────────────────────────────────────────────────────────────
// Chrome
// ─────────────────────────────────────────────────────────────────────────────

const chrome = (args: string[]) =>
  execFileSync(CHROME, ["--headless=new", "--hide-scrollbars", "--force-device-scale-factor=1", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024,
  });

/**
 * Cuánto mide de alto una página, con las fotos ya cargadas.
 *
 * 🔴 Hay que medirla y no estimarla: `--screenshot` captura **el `--window-size`
 * que le pases**, ni más ni menos. Con una ventana de sobra, la captura sale con
 * un colchón de fondo abajo, y al escalarla contra la referencia ese colchón
 * cuenta como parte del mail: los dos quedan comparados a distinta escala y toda
 * la lectura de proporción es mentira.
 *
 * El truco es el `<title>`: `--dump-dom` imprime el DOM ya renderizado, así que
 * un script que escribe el `scrollHeight` ahí adentro sale por stdout.
 */
function medirAlto(archivo: string, anchoVentana: number): number {
  const dom = chrome([`--window-size=${anchoVentana},800`, "--virtual-time-budget=9000", "--dump-dom", `file://${archivo}`]);
  const m = dom.match(/ALTO:(\d+)/);
  return m ? Number(m[1]) : 3000;
}

const capturar = (archivo: string, salida: string, ancho: number, alto: number) =>
  chrome([`--window-size=${ancho},${alto}`, "--virtual-time-budget=9000", `--screenshot=${salida}`, `file://${archivo}`]);

/** El script que reporta el alto. Va al final del `<body>`; no dibuja nada. */
const MEDIDOR =
  "<script>window.addEventListener('load',function(){document.title='ALTO:'+document.documentElement.scrollHeight});" +
  "setTimeout(function(){document.title='ALTO:'+document.documentElement.scrollHeight},3000)</script>";

/** Tamaño de un PNG, por `sips` (viene con macOS; no hay ImageMagick). */
function medirPng(archivo: string): { ancho: number; alto: number } {
  const out = execFileSync("/usr/bin/sips", ["-g", "pixelWidth", "-g", "pixelHeight", archivo], { encoding: "utf8" });
  return {
    ancho: Number(out.match(/pixelWidth:\s*(\d+)/)?.[1] ?? 0),
    alto: Number(out.match(/pixelHeight:\s*(\d+)/)?.[1] ?? 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La comparación
// ─────────────────────────────────────────────────────────────────────────────

/** A qué alto se escalan las dos. Es el techo de lo que se lee cómodo en una imagen. */
const ALTO_COMPARACION = 1600;
const BARRA = 34;

/**
 * Referencia y render lado a lado, **escaladas a la misma altura**.
 *
 * Igualar el alto y no el ancho es a propósito: así el ancho de cada mail queda
 * a escala de su propio largo, y **que nuestro clon salga más angosto significa
 * que es más largo que su referencia** — que es el hallazgo que más se repite
 * (nos sobra aire, o bloques).
 */
function comparar(id: string, ref: string, render: string, salida: string) {
  const r = medirPng(ref);
  const n = medirPng(render);
  const anchoRef = Math.round((r.ancho * ALTO_COMPARACION) / r.alto);
  const anchoNue = Math.round((n.ancho * ALTO_COMPARACION) / n.alto);
  const total = anchoRef + anchoNue + 24;

  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#fff;font:600 13px/${BARRA}px -apple-system,Arial,sans-serif}
    .fila{display:flex;gap:24px}
    .col{width:max-content}
    .r{background:#111;color:#fff;padding:0 10px}
    .n{background:#0b6b3a;color:#fff;padding:0 10px}
    img{display:block;height:${ALTO_COMPARACION}px;width:auto}
  </style><div class="fila">
    <div class="col"><div class="r">REFERENCIA · ${ref.split("/").pop()}</div><img src="file://${ref}"></div>
    <div class="col"><div class="n">NUESTRO · ${id}</div><img src="file://${render}"></div>
  </div>`;

  const tmp = join(SALIDA, `_cmp-${id}.html`);
  writeFileSync(tmp, html);
  capturar(tmp, salida, total, ALTO_COMPARACION + BARRA);
}

// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const hostil = args.includes("--hostil");
const filtros = args.filter((a) => !a.startsWith("--"));
const todos = args.includes("--todos") || filtros.length === 0;

mkdirSync(SALIDA, { recursive: true });

const presets = presetsPara(CUENTA).filter(
  (p) => !p.trigger && (todos || filtros.includes(p.id) || filtros.includes(p.familia ?? "")),
);

if (!presets.length) {
  console.error("Nada que mirar. Ids disponibles:");
  console.error("  " + presetsPara(CUENTA).filter((p) => !p.trigger).map((p) => p.id).join(" "));
  process.exit(1);
}

for (const p of presets) {
  const contenido = leerContenido(p.contenido) as ContenidoCampania;

  // 🔑 Respetar el `n` de cada bloque: al enviar, `resolverProductosDinamicos`
  // le pide a TN exactamente esa cantidad. Inyectar ocho a todas las grillas
  // dibuja filas que el mail real nunca va a tener, y la comparación mide un
  // mail que no existe.
  const mapa: Record<string, typeof PRODUCTOS> = {};
  for (const b of contenido.bloques as Bloque[]) {
    if (b.tipo === "productos-dinamicos") mapa[claveProductos(b)] = PRODUCTOS.slice(0, b.n ?? 4);
  }

  const html = renderEmailHtml(contenido, {
    unsubscribeUrl: "https://ejemplo.com/baja?token=abc",
    nombreCuenta: CUENTA.nombre,
    sitio: CUENTA.config.url,
    direccionPostal: "Calle Falsa 123, CABA",
    // 🔑 `public/` local y no la URL de producción: los íconos de celda recién
    // existen en el deploy siguiente al que los agrega, y con la URL de prod la
    // comparación mostraría rotos íconos que están perfectos. Chrome resuelve
    // `file://` sin problema y el HTML es el mismo.
    assetsBase: `file://${join(RAIZ, "public")}`,
    redesMarca: CUENTA.config.redes,
    productosDinamicos: mapa,
    ...(hostil ? { temaMarca: TEMA_HOSTIL } : {}),
  });

  const fHtml = join(SALIDA, `${p.id}.html`);
  const fPng = join(SALIDA, `${p.id}.png`);
  writeFileSync(fHtml, html.replace("</body>", `${MEDIDOR}</body>`));

  // El ancho de ventana es el del mail más aire: el fondo de página se ve, y sin
  // él no se juzga una portada a sangre.
  const ANCHO = 760;
  const alto = medirAlto(fHtml, ANCHO);
  capturar(fHtml, fPng, ANCHO, alto);

  const ref = REFERENCIA[p.id];
  if (ref && existsSync(join(REFERENCIAS, ref))) {
    const fCmp = join(SALIDA, `cmp-${p.id}.png`);
    comparar(p.id, join(REFERENCIAS, ref), fPng, fCmp);
    console.log(`${p.id.padEnd(16)} ${alto}px  →  ${resolve(fCmp)}`);
  } else {
    console.log(`${p.id.padEnd(16)} ${alto}px  →  ${resolve(fPng)}   (no clona ninguna referencia)`);
  }
}
