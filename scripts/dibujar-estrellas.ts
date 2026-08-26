// Dibuja la estrella del mail de reseña a `public/estrellas/`.
//
//   node --import tsx scripts/dibujar-estrellas.ts
//
// Se corre a mano y **solo cuando cambia el dibujo**. El PNG se commitea: el
// build no lo genera, igual que los de `public/redes/` y `public/iconos/`.
//
// 🔴 **UN solo archivo, y no dos como los íconos de celda.** La regla de los dos
// (`-claro` / `-oscuro`) existe porque un PNG no se tiñe y una tinta oscura
// desaparece en una plantilla de fondo negro. El dorado no tiene ese problema:
// se lee sobre blanco y sobre negro, que es exactamente por lo que las estrellas
// de puntuación son doradas en todos lados. Un segundo archivo sería una
// variante que nadie va a mirar y que se puede desincronizar.
//
// 🔑 El trazo sale de **lucide-react**, igual que `dibujar-iconos.ts`, con el
// mismo argumento: ya es dependencia, es ISC, y re-correr esto después de un
// `npm update` la rehace igual.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const RAIZ = process.cwd();
const DESTINO = join(RAIZ, "public", "estrellas");
const TMP = join(RAIZ, ".mirar");

/** El lado del PNG. 96 para que se vea nítido a los 28px del mail, y en pantalla 2x. */
const LADO = 96;
/** El dorado de siempre de las puntuaciones. Se lee sobre claro y sobre oscuro. */
const DORADO = "#f5a623";

type Nodo = [string, Record<string, string>];
const atributos = (a: Record<string, string>) =>
  Object.entries(a).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ");

function nodosDe(nombreLucide: string): Nodo[] {
  const archivo = join(RAIZ, "node_modules/lucide-react/dist/esm/icons", `${nombreLucide}.mjs`);
  const texto = readFileSync(archivo, "utf8");
  const m = texto.match(/const __iconNode = (\[[\s\S]*?\n\]);/);
  if (!m) throw new Error(`No se pudo leer __iconNode de ${nombreLucide}.mjs`);
  return new Function(`return ${m[1]}`)() as Nodo[];
}

mkdirSync(DESTINO, { recursive: true });
mkdirSync(TMP, { recursive: true });

const cuerpo = nodosDe("star").map(([tag, attrs]) => `<${tag} ${atributos(attrs)} />`).join("");
// 🔴 **VACÍA, `fill="none"`, y es lo que la fila SIGNIFICA.** Cinco estrellas
// llenas en el mail son un puntaje ya puesto: dicen "esto ya se calificó con 5",
// justo cuando lo que se está pidiendo es que la persona elija. El contorno es
// una casilla sin tildar — invita en vez de afirmar. La que se llena es la del
// otro lado del link, en `/opinar`, que abre con las estrellas hasta la apretada
// pintadas: **el "se completó" pasa ahí, no en el mail**, porque un mail no
// puede repintar nada al tocarlo.
//
// ⚠️ El trazo sube de 1,5 a 2,25 por esto mismo. A los 26px del mail, 1,5 sobre
// un viewBox de 24 son ~1,6px de línea: en un celular se lee como un garabato
// (era el argumento del relleno). 2,25 son ~2,4px y aguanta.
const TRAZO = 2.25;
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}" viewBox="0 0 24 24" ` +
  `fill="none" stroke="${DORADO}" stroke-width="${TRAZO}" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`;
const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0}</style>${svg}`;

const tmpHtml = join(TMP, "_estrella.html");
const salida = join(DESTINO, "estrella.png");
writeFileSync(tmpHtml, html);
execFileSync(CHROME, [
  "--headless=new", "--hide-scrollbars", "--force-device-scale-factor=1",
  "--default-background-color=00000000",
  `--window-size=${LADO},${LADO}`, `--screenshot=${salida}`, `file://${tmpHtml}`,
], { stdio: ["ignore", "ignore", "ignore"] });
unlinkSync(tmpHtml);
console.log("✓ estrella ← lucide/star");
