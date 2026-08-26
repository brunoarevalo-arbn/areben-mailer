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
import {
  encuadre,
  ejeSobrante,
  cajaDeTinta,
  recorteDeAire,
  FORMATOS,
  ANCHO_MAX,
} from "../lib/imagenes-encuadre";

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

// ─────────────────────────────────────────────────────────────────────────────
// Recortar el AIRE (26-ago-2026)
//
// Mismo motivo que todo lo de arriba: el `<canvas>` no se puede probar sin un
// navegador, así que la decisión —dónde empieza la tinta y qué rectángulo sale—
// vive en dos funciones puras y se ejerce acá, con arrays RGBA armados a mano.
//
// El caso que las motivó, medido sobre los archivos reales: el logo de BDI en
// Blob es 1080×1350 con la tinta en 1045×408, y los tres que devuelve Tiendanube
// tienen el mismo margen vacío. El encabezado del mail dibujaba 120×150 px para
// una marca de 116×45.
// ─────────────────────────────────────────────────────────────────────────────

/** Un lienzo RGBA de un color liso, para pintarle una caja de tinta encima. */
function lienzo(w: number, h: number, fondo: [number, number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set(fondo, i * 4);
  return {
    d,
    pintar(x0: number, y0: number, x1: number, y1: number, c: [number, number, number, number]) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) d.set(c, (y * w + x) * 4);
      return this;
    },
  };
}
const TRANSPARENTE: [number, number, number, number] = [0, 0, 0, 0];
const NEGRO: [number, number, number, number] = [0, 0, 0, 255];
const BLANCO: [number, number, number, number] = [255, 255, 255, 255];

console.log("\n8. Dónde empieza la tinta");
{
  // El caso de los cuatro logos medidos: margen transparente arriba y abajo.
  const a = lienzo(100, 100, TRANSPARENTE).pintar(10, 40, 89, 59, NEGRO);
  const ca = cajaDeTinta(a.d, 100, 100);
  ok(
    ca !== null && ca.x0 === 10 && ca.y0 === 40 && ca.x1 === 89 && ca.y1 === 59,
    "margen transparente: la caja es exactamente la tinta",
    JSON.stringify(ca),
  );

  // 🔴 El logo que Tiendanube devuelve para BDI: tinta BLANCA sobre transparente.
  // Cualquier regla del tipo "tinta = lo que no es blanco" lo borra entero.
  const b = lienzo(100, 100, TRANSPARENTE).pintar(20, 30, 79, 49, BLANCO);
  const cb = cajaDeTinta(b.d, 100, 100);
  ok(
    cb !== null && cb.x0 === 20 && cb.y0 === 30 && cb.x1 === 79 && cb.y1 === 49,
    "tinta BLANCA sobre transparente: se encuentra igual",
    JSON.stringify(cb),
  );

  // Un logo exportado sobre blanco liso: ahí el aire es de color, no de alfa.
  const c = lienzo(100, 100, BLANCO).pintar(5, 5, 24, 94, NEGRO);
  const cc = cajaDeTinta(c.d, 100, 100);
  ok(
    cc !== null && cc.x0 === 5 && cc.y0 === 5 && cc.x1 === 24 && cc.y1 === 94,
    "margen BLANCO liso: se mide contra el color de la esquina",
    JSON.stringify(cc),
  );

  // Un blanco re-encodeado no queda en 255 exacto y no puede leerse como tinta.
  const d = lienzo(100, 100, BLANCO).pintar(0, 0, 99, 9, [252, 251, 253, 255]);
  const cd = cajaDeTinta(d.d, 100, 100);
  ok(cd === null, "un blanco sucio de re-encode sigue siendo aire, no tinta", JSON.stringify(cd));

  ok(cajaDeTinta(lienzo(50, 50, TRANSPARENTE).d, 50, 50) === null, "una imagen vacía no tiene caja");
  ok(cajaDeTinta(new Uint8ClampedArray(0), 0, 0) === null, "0×0 tampoco");
  ok(cajaDeTinta(new Uint8ClampedArray(16), 100, 100) === null, "ni un array más corto que la imagen que dice medir");
}

console.log("\n9. La caja como recorte: al ras, adentro del archivo, y `null` si no hay aire");
{
  const r = recorteDeAire(1080, 1350, { x0: 26, y0: 465, x1: 1070, y1: 872 });
  ok(
    r !== null && r.sx === 26 && r.sy === 465 && r.sw === 1045 && r.sh === 408,
    "el logo real de BDI: 1080×1350 → toma 1045×408",
    JSON.stringify(r),
  );
  ok(r !== null && casi(r.dw / r.dh, 1045 / 408), "y no lo deforma", r ? `${r.dw}×${r.dh}` : "null");
  ok(r !== null && r.dw <= ANCHO_MAX, "ni lo agranda más allá del tope");

  ok(recorteDeAire(100, 100, null) === null, "sin caja no hay recorte");
  ok(recorteDeAire(0, 0, { x0: 0, y0: 0, x1: 10, y1: 10 }) === null, "una foto que no cargó tampoco");
  ok(
    recorteDeAire(100, 100, { x0: 0, y0: 0, x1: 99, y1: 99 }) === null,
    "una imagen SIN aire devuelve null: no se sube un archivo nuevo para dejar la misma imagen",
  );
  ok(
    recorteDeAire(100, 100, { x0: 0, y0: 0, x1: 98, y1: 99 }) === null,
    "y una a la que sólo le sobra una columna, tampoco",
  );

  // 🔴 La caja puede venir de una medición hecha sobre una copia achicada.
  const fuera = recorteDeAire(100, 100, { x0: -5, y0: -5, x1: 500, y1: 40 });
  ok(
    fuera !== null && fuera.sx === 0 && fuera.sy === 0 && fuera.sw === 100 && fuera.sy + fuera.sh <= 100,
    "una caja que se sale del archivo se acota, nunca produce un recorte inválido",
    JSON.stringify(fuera),
  );
}

console.log(fallos === 0 ? "\n✅ El recorte no deforma ni agranda, y el aire se saca al ras\n" : `\n❌ ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
