// El pack de fotos de las plantillas. Lógica pura salvo con --red.
//
//   node --import tsx scripts/probar-fotos.ts          # sin red
//   node --import tsx scripts/probar-fotos.ts --red    # + HEAD a las 36
//
// Recorre `presetsPara()`, así que un preset nuevo entra solo a esta auditoría
// igual que a las otras cuatro: no hay que escribir un test por plantilla.
//
// Los dos modos de falla que cubre son los dos que llegan a una casilla ajena:
//
//   1. Una URL de imagen que no salió de `foto()`. Un `images.unsplash.com`
//      pegado a mano funciona en el editor y se rompe el día que Unsplash
//      cambia algo; y la foto de la tienda de OTRA marca es la fuga de siempre.
//   2. Una foto que en el store no existe, o que existe pesando el triple de lo
//      que creemos. El peso no cuesta store: cuesta una descarga por
//      destinatario, y el que la manda heredó esa foto de la plantilla.
//
// ⚠️ El chequeo de "clave que no usa ningún preset" (peso muerto en el catálogo)
// entra cuando existan las plantillas que las usan: hoy el pack está subido y
// los presets todavía no lo referencian, así que sería rojo por diseño.

import { presetsPara } from "../lib/plantillas/presets";
import { BASE_FOTOS, CLAVES_FOTO, SLOTS, foto, slotDe } from "../lib/plantillas/fotos";
import type { Bloque } from "../lib/email/bloques";

const conRed = process.argv.includes("--red");

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};
const titulo = (s: string) => console.log(`\n${s}`);

const CUENTA = { nombre: "Marca de prueba", config: { url: "https://ejemplo.com" } };

/**
 * Todos los campos de un bloque donde puede vivir una URL de imagen. Enumerarlos
 * a mano es frágil, pero la alternativa —barrer el Json entero buscando algo que
 * parezca una URL— daría falsos positivos con los links de `menu` y `boton`.
 * Si mañana un bloque nuevo lleva imagen, esta lista es la que hay que tocar.
 */
function urlsDeImagen(b: Bloque): { campo: string; url: string }[] {
  const out: { campo: string; url: string }[] = [];
  const push = (campo: string, url: unknown) => {
    if (typeof url === "string" && url) out.push({ campo: `${b.tipo}.${campo}`, url });
  };
  switch (b.tipo) {
    case "imagen":
      push("url", b.url);
      break;
    case "hero":
      push("imagen", b.imagen);
      push("fondoImagen", b.fondoImagen);
      break;
    case "seccion":
      push("fondoImagen", b.fondoImagen);
      break;
    case "video":
      push("imagen", b.imagen);
      break;
    case "columnas":
      b.celdas.forEach((c, i) => push(`celdas[${i}].imagen`, c.imagen));
      break;
    case "encabezado":
      push("logo", b.logo);
      break;
  }
  return out;
}

// ─── Ninguna URL suelta ──────────────────────────────────────────────────────
titulo("Toda imagen de un preset sale del pack");
for (const p of presetsPara(CUENTA)) {
  const ajenas = p.contenido.bloques
    .flatMap(urlsDeImagen)
    .filter(({ url }) => !url.startsWith(BASE_FOTOS));
  ok(
    ajenas.length === 0,
    `${p.id}`,
    ajenas.map((a) => `${a.campo} = ${a.url}`).join("\n      ")
  );
}

// ─── El alt no es opcional ───────────────────────────────────────────────────
titulo("Todo bloque `imagen` tiene alt");
// Outlook bloquea las imágenes por default: en esa primera pasada el alt ES el
// contenido. Un `imagen` sin alt es un rectángulo vacío en el mail de alguien.
for (const p of presetsPara(CUENTA)) {
  const sinAlt = p.contenido.bloques.filter(
    (b) => b.tipo === "imagen" && !(b.alt ?? "").trim()
  );
  ok(sinAlt.length === 0, `${p.id}`, sinAlt.length ? `${sinAlt.length} sin alt` : "");
}

// ─── El catálogo es coherente consigo mismo ──────────────────────────────────
titulo("El catálogo");
ok(CLAVES_FOTO.length > 0, `${CLAVES_FOTO.length} claves`);
ok(
  new Set(CLAVES_FOTO.map(foto)).size === CLAVES_FOTO.length,
  "ninguna URL repetida (dos claves apuntando al mismo archivo)"
);
ok(
  !BASE_FOTOS.endsWith("/"),
  "BASE_FOTOS sin barra final",
  "foto() concatena con /, una barra de más da una URL con //"
);

// ─── Contra el store ─────────────────────────────────────────────────────────
// ⚠️ Va adentro de una función y no como top-level await: `tsx` compila estos
// scripts a CJS y ahí el await de arriba de todo no existe.
async function contraElStore() {
  titulo("Las 36 están publicadas y pesan lo que dicen");
  const resultados = await Promise.all(
    CLAVES_FOTO.map(async (k) => {
      try {
        const r = await fetch(foto(k), { method: "HEAD" });
        return {
          k,
          status: r.status,
          tipo: r.headers.get("content-type") ?? "",
          bytes: Number(r.headers.get("content-length") ?? 0),
        };
      } catch (e) {
        return { k, status: 0, tipo: String(e), bytes: 0 };
      }
    })
  );
  for (const r of resultados) {
    const tope = SLOTS[slotDe(r.k)].tope;
    const bien = r.status === 200 && r.tipo.startsWith("image/jpeg") && r.bytes <= tope;
    ok(
      bien,
      `${r.k.padEnd(20)} ${String(r.status)} ${(r.bytes / 1024).toFixed(0)} KB`,
      bien ? "" : `tipo="${r.tipo}" tope=${(tope / 1024).toFixed(0)} KB`
    );
  }
}

function cerrar() {
  console.log(fallas === 0 ? "\n✓ Todo bien" : `\n✗ ${fallas} falla(s)`);
  process.exit(fallas === 0 ? 0 : 1);
}

if (conRed) {
  contraElStore().then(cerrar);
} else {
  console.log("\n(sin --red: no se verificó que las fotos estén publicadas)");
  cerrar();
}
