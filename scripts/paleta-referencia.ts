// Los colores que de verdad tiene una captura de referencia.
//
//   node --import tsx scripts/paleta-referencia.ts R-018-simple-new-arrivals.png
//   node --import tsx scripts/paleta-referencia.ts --todas
//
// 🔑 Existe porque **el color a ojo no se acierta**. La ronda 1 de la pasada de
// parecido escribió "gris claro y dorado" en la ficha y de ahí salió el ámbar
// `#f59e0b` del tema por defecto, que no es el dorado de la captura ni de lejos.
// Un hex mal elegido se nota más que cualquier diferencia de espaciado: es lo
// primero que se ve al poner las dos imágenes al lado.
//
// Lo que imprime son los colores más frecuentes con su porcentaje. Los primeros
// son casi siempre el fondo de página y el de contenido; el acento aparece con
// poco porcentaje pero saturado, así que además se listan aparte **los más
// saturados**, que es donde vive el botón.
//
// ⚠️ La foto de producto mete decenas de tonos que no son del diseño. Por eso se
// cuantiza a saltos de 8 y se muestran porcentajes: lo que es del diseño se
// repite en bloques grandes, lo de las fotos queda diluido.

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const RAIZ = process.cwd();
const REFERENCIAS = join(RAIZ, "docs", "referencias");
const TMP = join(RAIZ, ".mirar");

interface Muestra {
  hex: string;
  pct: number;
  sat: number;
}

function coloresDe(archivo: string): { frecuentes: Muestra[]; saturados: Muestra[] } {
  // El conteo corre adentro de Chrome, que es el único que sabe decodificar un
  // PNG acá: `sips` no lee píxeles y no hay dependencia de imagen en el repo.
  // El resultado sale por el `<title>`, que es lo que imprime `--dump-dom`.
  const html = `<!doctype html><meta charset="utf-8"><img id="i" src="file://${archivo}"><script>
    const i = document.getElementById('i');
    function ir(){
      const c = document.createElement('canvas');
      c.width = i.naturalWidth; c.height = i.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(i,0,0);
      const d = x.getImageData(0,0,c.width,c.height).data;
      const cuenta = new Map();
      for (let p = 0; p < d.length; p += 4) {
        if (d[p+3] < 200) continue;
        // Cuantizar a saltos de 8: un degradé de foto no es un color del diseño.
        const r = d[p] & 0xf8, g = d[p+1] & 0xf8, b = d[p+2] & 0xf8;
        const k = (r << 16) | (g << 8) | b;
        cuenta.set(k, (cuenta.get(k) || 0) + 1);
      }
      const total = c.width * c.height;
      const lista = [...cuenta].map(([k, n]) => {
        const r = (k >> 16) & 255, g = (k >> 8) & 255, b = k & 255;
        const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
        return {
          hex: '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join(''),
          pct: +(100 * n / total).toFixed(2),
          sat: mx === 0 ? 0 : +((mx - mn) / mx).toFixed(2),
          n,
        };
      });
      lista.sort((a,b) => b.n - a.n);
      const frecuentes = lista.slice(0, 10);
      // Saturado Y con presencia: un pixel suelto de una foto no es el acento.
      const saturados = lista.filter(o => o.sat > 0.35 && o.pct > 0.15).slice(0, 8);
      document.title = 'PAL:' + JSON.stringify({frecuentes, saturados});
    }
    if (i.complete) ir(); else i.onload = ir;
  </script>`;

  const tmp = join(TMP, "_paleta.html");
  writeFileSync(tmp, html);
  const dom = execFileSync(CHROME, [
    "--headless=new", "--allow-file-access-from-files", "--virtual-time-budget=8000",
    "--dump-dom", `file://${tmp}`,
  ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  unlinkSync(tmp);

  const m = dom.match(/PAL:(\{.*?\})<\/title>/s);
  if (!m) throw new Error("Chrome no devolvió la paleta (¿falta --allow-file-access-from-files?)");
  return JSON.parse(m[1]);
}

mkdirSync(TMP, { recursive: true });

const args = process.argv.slice(2);
const archivos = args.includes("--todas")
  ? readdirSync(REFERENCIAS).filter((f) => f.endsWith(".png")).sort()
  : args.filter((a) => !a.startsWith("--"));

if (!archivos.length) {
  console.error("Pasá una captura de docs/referencias/, o --todas");
  process.exit(1);
}

for (const f of archivos) {
  const { frecuentes, saturados } = coloresDe(join(REFERENCIAS, f));
  console.log(`\n${f}`);
  console.log("  frecuentes: " + frecuentes.map((o) => `${o.hex} ${o.pct}%`).join("  "));
  console.log("  saturados:  " + (saturados.map((o) => `${o.hex} ${o.pct}%`).join("  ") || "—"));
}
