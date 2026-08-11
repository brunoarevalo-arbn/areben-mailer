// La geometría del recorte: cover exacto, nunca deforma y nunca agranda.
//
//   node --import tsx scripts/probar-recorte.ts
//
// 🔴 **Es lo único del recorte que se puede probar sin un navegador.** El
// `<canvas>` es API del navegador y no hay puppeteer acá; por eso toda la
// decisión —qué rectángulo se toma y de qué tamaño sale— vive en una función
// pura y el módulo del canvas se limita a dibujar lo que ésta dice.
//
// Las invariantes:
//   1. **Cover, jamás stretch.** La relación del rectángulo tomado tiene que ser
//      la pedida: si no lo fuera, `drawImage` deformaría la foto, que es el peor
//      resultado posible (una persona más flaca o más gorda en el mail de otra).
//   2. **Nunca agranda.** Escalar para arriba no agrega información: agrega
//      bytes, y esos bytes se descargan UNA VEZ POR DESTINATARIO.
//   3. **El deslizador mueve el eje que SOBRA, y sólo ése.** En un cover nunca
//      sobran los dos: o la foto es más alta que el formato (sube y baja) o es
//      más ancha (se corre al costado). Y es CONTINUO — cada paso tiene que
//      mover el recorte, o volvería a ser el "elegí el menos malo de tres" que
//      esto vino a reemplazar.
//   4. **Sin `ratio` no se recorta nada**, sólo se achica. Es el modo de toda
//      subida.
//   5. Una foto que no cargó (0×0) no puede producir un lienzo `NaN`, y un
//      número guardado fuera de rango tampoco.
import { encuadre, ejeSobrante, FORMATOS, ANCHO_MAX } from "../lib/imagenes-encuadre";

let fallos = 0;
function ok(cond: boolean, que: string, detalle = "") {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    console.log(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
    fallos++;
  }
}
const casi = (a: number, b: number, tol = 0.011) => Math.abs(a - b) <= tol;

console.log("\n1. Cover exacto: la relación tomada es la pedida, en las dos orientaciones");
for (const [clave, { ratio }] of Object.entries(FORMATOS)) {
  for (const [w, h] of [[4000, 3000], [1000, 4000], [800, 800], [3000, 1000]]) {
    const r = encuadre(w, h, ratio);
    ok(
      casi(r.sw / r.sh, ratio) && casi(r.dw / r.dh, ratio),
      `${clave} sobre ${w}×${h}`,
      `tomó ${r.sw}×${r.sh} (${(r.sw / r.sh).toFixed(3)}) → ${r.dw}×${r.dh}`,
    );
  }
}

console.log("\n2. El rectángulo tomado entra entero en la foto");
for (const [clave, { ratio }] of Object.entries(FORMATOS)) {
  for (const [w, h] of [[4000, 3000], [1000, 4000], [1234, 567]]) {
    const r = encuadre(w, h, ratio);
    ok(
      r.sx >= 0 && r.sy >= 0 && r.sx + r.sw <= w && r.sy + r.sh <= h,
      `${clave} sobre ${w}×${h} no se sale`,
      `x ${r.sx}+${r.sw}/${w} · y ${r.sy}+${r.sh}/${h}`,
    );
  }
}

console.log("\n3. Nunca agranda");
{
  const r = encuadre(400, 300, undefined);
  ok(r.dw === 400 && r.dh === 300, "una foto chica sale igual de chica", `${r.dw}×${r.dh}`);
  const q = encuadre(500, 500, FORMATOS["16:9"].ratio);
  ok(q.dw <= 500, "recortada tampoco se estira", `${q.dw}×${q.dh}`);
  const g = encuadre(4000, 3000, undefined);
  ok(g.dw === ANCHO_MAX, "una grande baja al tope", `${g.dw}`);
}

console.log("\n4. El deslizador mueve el eje que SOBRA, y sólo ése");
{
  // Foto vertical llevada a 16:9: sobra alto ⇒ el número sube y baja.
  const arriba = encuadre(1000, 2000, FORMATOS["16:9"].ratio, ANCHO_MAX, 0);
  const centro = encuadre(1000, 2000, FORMATOS["16:9"].ratio, ANCHO_MAX, 50);
  const abajo = encuadre(1000, 2000, FORMATOS["16:9"].ratio, ANCHO_MAX, 100);
  ok(arriba.sy === 0, "0 arranca pegado arriba", String(arriba.sy));
  ok(centro.sy > arriba.sy && centro.sy < abajo.sy, "50 queda en el medio", `${arriba.sy} < ${centro.sy} < ${abajo.sy}`);
  ok(abajo.sy + abajo.sh === 2000, "100 termina justo en el borde de abajo", `${abajo.sy}+${abajo.sh}`);
  ok(
    arriba.sx === centro.sx && centro.sx === abajo.sx,
    "y el eje horizontal no se movió con ninguno",
    `${arriba.sx} ${centro.sx} ${abajo.sx}`,
  );
  // 🔑 Es continuo, no tres posiciones: el punto entero del cambio.
  const puntos = [0, 10, 25, 40, 60, 75, 90, 100].map(
    (p) => encuadre(1000, 2000, FORMATOS["16:9"].ratio, ANCHO_MAX, p).sy,
  );
  ok(
    puntos.every((v, i) => i === 0 || v > puntos[i - 1]),
    "cada paso del deslizador mueve el recorte",
    puntos.join(" "),
  );
  ok(new Set(puntos).size === puntos.length, "y no hay dos valores que caigan en el mismo lugar", puntos.join(" "));

  // Foto apaisada llevada a 1:1: sobra ancho ⇒ el MISMO número corre a los costados.
  const izq = encuadre(4000, 1000, FORMATOS["1:1"].ratio, ANCHO_MAX, 0);
  const der = encuadre(4000, 1000, FORMATOS["1:1"].ratio, ANCHO_MAX, 100);
  ok(izq.sx === 0 && der.sx + der.sw === 4000, "0 pega a la izquierda y 100 a la derecha", `${izq.sx} · ${der.sx}+${der.sw}`);
  ok(izq.sy === der.sy, "y ahí el eje vertical no se mueve", `${izq.sy} ${der.sy}`);

  // Lo que se guarda en el Json puede ser cualquier cosa.
  ok(
    encuadre(1000, 2000, FORMATOS["1:1"].ratio, ANCHO_MAX, 999).sy ===
      encuadre(1000, 2000, FORMATOS["1:1"].ratio, ANCHO_MAX, 100).sy,
    "un valor fuera de rango se acota",
  );
  ok(
    encuadre(1000, 2000, FORMATOS["1:1"].ratio, ANCHO_MAX, NaN).sy ===
      encuadre(1000, 2000, FORMATOS["1:1"].ratio, ANCHO_MAX, 50).sy,
    "y un NaN cae al centro, no a un recorte en la nada",
  );
}

console.log("\n5. Qué eje se puede mover, que es lo que rotula el deslizador");
{
  ok(ejeSobrante(1000, 2000, FORMATOS["16:9"].ratio) === "vertical", "un retrato a 16:9 se sube y se baja");
  ok(ejeSobrante(4000, 1000, FORMATOS["1:1"].ratio) === "horizontal", "una apaisada a 1:1 se corre al costado");
  ok(ejeSobrante(800, 800, FORMATOS["1:1"].ratio) === "ninguno", "una foto que ya tiene el formato no ofrece nada");
  ok(ejeSobrante(0, 0, FORMATOS["1:1"].ratio) === "ninguno", "y una que no cargó, tampoco");
}

console.log("\n6. Sin formato no se recorta: sólo se achica");
{
  const r = encuadre(4000, 3000, undefined);
  ok(r.sx === 0 && r.sy === 0 && r.sw === 4000 && r.sh === 3000, "se toma la foto entera");
  ok(casi(r.dw / r.dh, 4000 / 3000), "y conserva su relación original", `${r.dw}×${r.dh}`);
}

console.log("\n7. Una foto que no cargó no produce un lienzo NaN");
{
  const r = encuadre(0, 0, FORMATOS["1:1"].ratio);
  ok(Number.isFinite(r.dw) && Number.isFinite(r.dh) && r.dw === 0, "0×0 devuelve 0×0", JSON.stringify(r));
}

console.log(fallos === 0 ? "\n✅ El recorte no deforma ni agranda\n" : `\n❌ ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
