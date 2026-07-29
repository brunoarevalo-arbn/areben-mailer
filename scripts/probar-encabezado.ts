// El encabezado como bloque. Lógica pura: sin base, sin red.
//
//   node --import tsx scripts/probar-encabezado.ts
//
// Convertir algo fijo en algo editable tiene dos maneras de salir mal, y las dos
// son caras:
//
//   1. Lo que ya estaba guardado lo pierde. Ninguna campaña ni plantilla puede
//      quedarse sin cabecera porque el bloque nació después que ella.
//   2. Lo que NO era editable se vuelve borrable. El link de baja va en el pie y
//      el pie sigue siendo del shell: acá se fija que no hay lista de bloques
//      —vacía, rota o llena— que lo haga desaparecer. Es obligación legal, no
//      una preferencia de diseño.

import { renderEmailHtml, renderEmailTexto, nuevoBloque, TIPOS_BLOQUE } from "../lib/email/render";
import { leerContenido, V_ACTUAL } from "../lib/email/esquema";
import type { Bloque, ContenidoCampania } from "../lib/email/render";
import { PRESETS } from "../lib/plantillas/presets";
import { presetsPara } from "../lib/automations";

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};
const titulo = (s: string) => console.log(`\n${s}`);

const BAJA = "https://ejemplo.com/baja?token=abc";
const OPTS = { unsubscribeUrl: BAJA, nombreCuenta: "Marca Uno", direccionPostal: "Calle 1" };
const render = (c: unknown, opts = OPTS) => renderEmailHtml(c as ContenidoCampania, opts);
const texto = (c: unknown, opts = OPTS) => renderEmailTexto(c as ContenidoCampania, opts);

// ─── Nadie pierde la cabecera que ya tenía ───────────────────────────────────
titulo("La migración materializa el encabezado que escribía el shell");
{
  // Un documento de los de antes: sin `v` y sin encabezado.
  const c = leerContenido({ bloques: [{ tipo: "titulo", texto: "Hola" }] });
  ok(c.v === V_ACTUAL, `sube a v${V_ACTUAL}`, `quedó en v${c.v}`);
  ok(c.bloques[0]?.tipo === "encabezado", "el encabezado aparece primero", c.bloques.map((b) => b.tipo).join(","));
  ok(c.bloques.length === 2, "y no se pierde el bloque que ya estaba");

  const cab = c.bloques[0] as Extract<Bloque, { tipo: "encabezado" }>;
  ok(!cab.texto, "nace SIN texto: la marca se resuelve al renderizar, no se guarda");
}
{
  // Un documento que ya pasó por acá no vuelve a pasar.
  const una = leerContenido({ bloques: [{ tipo: "texto", texto: "x" }] });
  const dos = leerContenido(una);
  const tres = leerContenido(JSON.parse(JSON.stringify(dos)));
  ok(dos.bloques.filter((b) => b.tipo === "encabezado").length === 1, "leerlo dos veces no duplica el encabezado");
  ok(tres.bloques.filter((b) => b.tipo === "encabezado").length === 1, "ni tres veces, ni pasando por Json");
}
{
  // El caso que sí puede pasar en producción: el editor guarda sin `v` (pasó
  // hasta hoy) y el documento vuelve a entrar por la migración con el
  // encabezado ya adentro. No puede terminar con dos.
  const c = leerContenido({
    bloques: [{ tipo: "encabezado" }, { tipo: "titulo", texto: "T" }],
  });
  ok(c.bloques.filter((b) => b.tipo === "encabezado").length === 1, "un doc sin `v` que YA traía encabezado no queda con dos");
}

// ─── Uno solo y primero ──────────────────────────────────────────────────────
titulo("Hay un encabezado, y está arriba");
{
  const c = leerContenido({
    v: 3,
    bloques: [
      { tipo: "titulo", texto: "T" },
      { tipo: "encabezado", texto: "El bueno" },
      { tipo: "texto", texto: "x" },
      { tipo: "encabezado", texto: "El de más" },
    ],
  });
  const cabs = c.bloques.filter((b) => b.tipo === "encabezado");
  ok(cabs.length === 1, "sobrevive uno solo", `quedaron ${cabs.length}`);
  ok(c.bloques[0]?.tipo === "encabezado", "y queda en la posición 0");
  ok((cabs[0] as Extract<Bloque, { tipo: "encabezado" }>).texto === "El bueno", "sobrevive el primero, no el último");
  ok(c.bloques.length === 3, "el resto del contenido no se toca");
}
{
  // El renderer no puede depender del normalizador: el camino rápido de
  // `leerContenido` saltea el saneo de un documento que ya está en la versión
  // actual, así que un Json editado a mano puede llegar con dos.
  const html = render({
    v: V_ACTUAL,
    bloques: [
      { tipo: "encabezado", texto: "Uno" },
      { tipo: "titulo", texto: "T" },
      { tipo: "encabezado", texto: "Dos" },
    ],
  });
  ok(html.includes("UNO"), "el primero se dibuja");
  ok(!html.includes("DOS"), "el segundo NO se dibuja aunque el saneo no lo haya sacado");
}

// ─── Se dibuja fuera de la tarjeta ───────────────────────────────────────────
titulo("El encabezado va arriba de la tarjeta, no adentro");
{
  const html = render({ v: V_ACTUAL, bloques: [{ tipo: "encabezado" }, { tipo: "titulo", texto: "Adentro" }] });
  const iCab = html.indexOf("MARCA UNO");
  const iCuerpo = html.indexOf("<!-- Cuerpo -->");
  const iTitulo = html.indexOf("Adentro");
  ok(iCab > 0 && iCab < iCuerpo, "la cabecera sale antes de que abra el cuerpo");
  ok(iTitulo > iCuerpo, "y el contenido, después");
}

// ─── La marca no queda clavada en el Json ────────────────────────────────────
titulo("Una plantilla no lleva la marca adentro");
{
  const c = { v: V_ACTUAL, bloques: [{ tipo: "encabezado" }] };
  const uno = render(c, { ...OPTS, nombreCuenta: "BDI Accesorios" });
  const dos = render(c, { ...OPTS, nombreCuenta: "Zattia" });
  ok(uno.includes("BDI ACCESORIOS") && !uno.includes("ZATTIA"), "el mismo bloque firma BDI en la cuenta de BDI");
  ok(dos.includes("ZATTIA") && !dos.includes("BDI ACCESORIOS"), "y Zattia en la de Zattia");
}
{
  const html = render({ v: V_ACTUAL, bloques: [{ tipo: "encabezado", texto: "Otra cosa" }] });
  ok(html.includes("OTRA COSA") && !html.includes("MARCA UNO"), "un texto propio pisa al nombre de la cuenta");
}
{
  const html = render({ v: V_ACTUAL, bloques: [{ tipo: "encabezado", texto: "iPhone Store", mayusculas: false }] });
  ok(html.includes("iPhone Store"), "se pueden respetar las mayúsculas originales");
}

// ─── Variante logo ───────────────────────────────────────────────────────────
titulo("La variante logo");
{
  const html = render({
    v: V_ACTUAL,
    bloques: [{ tipo: "encabezado", variante: "logo", logo: "https://cdn.x/logo.png", logoAncho: 180 }],
  });
  ok(html.includes('src="https://cdn.x/logo.png"'), "sale la imagen");
  ok(html.includes('width="180"'), "con el width en atributo (Outlook no escala por CSS)");
  ok(html.includes('alt="Marca Uno"'), "y el alt cae al nombre de la marca");
}
{
  // Un logo a medio configurar no puede dejar un ícono roto arriba del mail.
  const html = render({ v: V_ACTUAL, bloques: [{ tipo: "encabezado", variante: "logo", logo: "" }] });
  ok(!html.includes("<img"), "sin URL cargada no se dibuja ninguna imagen");
  ok(html.includes("MARCA UNO"), "y cae al nombre de la marca");
}
{
  // El ancho se acota contra el ancho útil del mail, no contra lo que diga el Json.
  const html = render({
    v: V_ACTUAL,
    bloques: [{ tipo: "encabezado", variante: "logo", logo: "https://x/l.png", logoAncho: 9999 }],
  });
  const img = html.slice(html.indexOf("<img"));
  const w = Number(img.match(/width="(\d+)"/)?.[1] ?? 0);
  ok(w > 0 && w <= 600 - 64, `un ancho absurdo se acota (salió ${w}px)`);
}

// ─── Lo que no puede faltar NUNCA ────────────────────────────────────────────
titulo("El link de baja está en el 100% de los renders");
{
  const listas: [string, unknown][] = [
    ["sin bloques", { v: V_ACTUAL, bloques: [] }],
    ["contenido null", null],
    ["contenido basura", "no soy un contenido"],
    ["bloques no-array", { bloques: 42 }],
    ["sin encabezado (lo borraron)", { v: V_ACTUAL, bloques: [{ tipo: "titulo", texto: "T" }] }],
    ["solo encabezado", { v: V_ACTUAL, bloques: [{ tipo: "encabezado" }] }],
    ["dos encabezados", { v: V_ACTUAL, bloques: [{ tipo: "encabezado" }, { tipo: "encabezado" }] }],
    ["todos los tipos", { bloques: TIPOS_BLOQUE.map((t) => nuevoBloque(t)) }],
    ["tipos desconocidos", { bloques: [{ tipo: "carrusel3d" }, { tipo: "encabezado" }] }],
  ];
  for (const [que, c] of listas) {
    ok(render(c).includes(BAJA), `HTML con ${que}`);
    ok(texto(c).includes(BAJA), `texto con ${que}`);
  }
}
for (const p of PRESETS) {
  ok(render({ bloques: p.bloques, tema: p.tema }).includes(BAJA), `preset "${p.id}"`);
}
{
  const presets = presetsPara("Marca Uno", "https://ejemplo.com");
  for (const [trigger, p] of Object.entries(presets)) {
    ok(render({ bloques: p.bloques }).includes(BAJA), `automation ${trigger}`);
  }
}

// ─── Borrarlo tiene efecto ───────────────────────────────────────────────────
titulo("Borrar el encabezado lo borra de verdad");
{
  const sin = render({ v: V_ACTUAL, bloques: [{ tipo: "titulo", texto: "T" }] });
  ok(!sin.includes("MARCA UNO"), "sin bloque no sale el nombre arriba");
  // El pie sí lo lleva, y ese no es borrable: es la identificación del remitente.
  ok(sin.includes("Marca Uno"), "pero el pie sigue identificando al remitente");
  ok(!texto({ v: V_ACTUAL, bloques: [{ tipo: "titulo", texto: "T" }] }).startsWith("MARCA UNO"), "y la parte de texto tampoco lo encabeza");
}

// ─── Parte de texto ──────────────────────────────────────────────────────────
titulo("La parte text/plain arranca por la marca");
{
  const t = texto({ bloques: [{ tipo: "titulo", texto: "Hola" }] });
  ok(t.startsWith("MARCA UNO\n\nHola"), "primer renglón la marca, después el contenido", JSON.stringify(t.slice(0, 40)));
}

console.log(fallas === 0 ? "\n✅ Encabezado OK\n" : `\n❌ ${fallas} fallas\n`);
process.exit(fallas === 0 ? 0 : 1);
