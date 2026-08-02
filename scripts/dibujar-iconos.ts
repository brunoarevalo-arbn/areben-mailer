// Dibuja el pack de íconos de celda a `public/iconos/`.
//
//   node --import tsx scripts/dibujar-iconos.ts
//
// Se corre a mano y **solo cuando se suma o cambia un ícono**. Los PNG se
// commitean: el build no los genera, igual que los 7 de `public/redes/`.
//
// 🔑 Los trazos salen de **lucide-react**, que ya es dependencia del panel y es
// ISC. Nadie los dibuja a mano y nadie los baja de ninguna galería con licencia
// dudosa: la fuente de verdad es el `__iconNode` del paquete, así que
// re-correr esto después de un `npm update` los rehace igual.
//
// 🔴 **Dos archivos por ícono, y el sufijo es el color de la TINTA.** Un PNG no
// se tiñe con CSS —no hay `filter` confiable en un cliente de mail—, así que un
// ícono oscuro desaparece adentro de una plantilla de fondo negro. El renderer
// elige cuál servir con `Paleta.esOscuro`; ver `lib/email/iconos.ts`.
//
// ⚠️ Fondo transparente (`--default-background-color=00000000`): el ícono se
// apoya sobre lo que haya, que puede ser una banda de color y no la tarjeta.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { ICONOS } from "../lib/email/iconos";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const RAIZ = process.cwd();
const DESTINO = join(RAIZ, "public", "iconos");
const TMP = join(RAIZ, ".mirar");

/**
 * Qué ícono de lucide es cada clave nuestra.
 *
 * El nombre nuestro describe **para qué sirve en un mail** ("cambios") y el de
 * lucide describe el dibujo ("refresh-ccw"). Que sean dos nombres y no uno es a
 * propósito: el día que un ícono se cambie por otro que se lea mejor, el Json de
 * las plantillas ya guardadas no se entera.
 */
const LUCIDE: Record<string, string> = {
  envio: "truck",
  tarjeta: "credit-card",
  cambios: "refresh-ccw",
  atencion: "headset",
  seguro: "shield-check",
  regalo: "gift",
  descuento: "percent",
  calidad: "award",
};

/** El lado del PNG. 96 para que se vea nítido a los 40px de la celda, y en pantalla 2x. */
const LADO = 96;

/** La tinta de cada variante: la misma que el texto de cada tema (`lib/email/tema.ts`). */
const TINTAS = { oscuro: "#171717", claro: "#fafafa" };

type Nodo = [string, Record<string, string>];

const atributos = (a: Record<string, string>) =>
  Object.entries(a)
    .filter(([k]) => k !== "key")
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");

/**
 * Los trazos de un ícono de lucide, leídos del archivo.
 *
 * ⚠️ Se lee el texto y se evalúa el literal en vez de importar el módulo: los
 * `exports` de lucide-react no publican las rutas internas, y un `import()`
 * dinámico con la ruta absoluta lo reescribe `tsx` y termina resolviendo
 * cualquier cosa. El literal es un array de tuplas `["path", {...}]` de nuestro
 * propio `node_modules`, no entrada de nadie.
 */
function nodosDe(nombreLucide: string): Nodo[] {
  const archivo = join(RAIZ, "node_modules/lucide-react/dist/esm/icons", `${nombreLucide}.mjs`);
  const texto = readFileSync(archivo, "utf8");
  const m = texto.match(/const __iconNode = (\[[\s\S]*?\n\]);/);
  if (!m) throw new Error(`No se pudo leer __iconNode de ${nombreLucide}.mjs`);
  return new Function(`return ${m[1]}`)() as Nodo[];
}

mkdirSync(DESTINO, { recursive: true });
mkdirSync(TMP, { recursive: true });

for (const icono of ICONOS) {
  const lucide = LUCIDE[icono.slug];
  if (!lucide) {
    console.error(`✗ ${icono.slug}: no hay ícono de lucide asignado en este script`);
    process.exitCode = 1;
    continue;
  }
  const nodos = nodosDe(lucide);
  const cuerpo = nodos.map(([tag, attrs]) => `<${tag} ${atributos(attrs)} />`).join("");

  for (const [variante, tinta] of Object.entries(TINTAS)) {
    // `stroke-width` 1.75 y no los 2 de lucide: a 96px el trazo de 2 se ve
    // gordo al lado del texto de la celda, que es lo que el ícono acompaña.
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}" viewBox="0 0 24 24" ` +
      `fill="none" stroke="${tinta}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`;
    const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0}</style>${svg}`;

    const tmpHtml = join(TMP, `_icono-${icono.slug}-${variante}.html`);
    const salida = join(DESTINO, `${icono.slug}-${variante}.png`);
    writeFileSync(tmpHtml, html);
    execFileSync(CHROME, [
      "--headless=new",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--default-background-color=00000000",
      `--window-size=${LADO},${LADO}`,
      `--screenshot=${salida}`,
      `file://${tmpHtml}`,
    ], { stdio: ["ignore", "ignore", "ignore"] });
    unlinkSync(tmpHtml);
  }
  console.log(`✓ ${icono.slug.padEnd(10)} ← lucide/${lucide}`);
}
