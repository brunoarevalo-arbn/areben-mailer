// Invariantes del esquema de bloques. Lógica pura: sin base, sin red.
//
//   node --import tsx scripts/probar-esquema.ts
//
// Lo que se fija acá vale por un test de verdad: estos Json son de los
// comerciantes y una migración mal hecha les reescribe la plantilla al primer
// guardado, sin vuelta atrás.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { leerContenido, V_ACTUAL } from "../lib/email/esquema";
import { nuevoBloque, duplicarBloque, type Bloque } from "../lib/email/bloques";
import { presetsPara } from "../lib/automations";
import { PRESETS } from "../lib/plantillas/presets";

let fallas = 0;
function ok(cond: boolean, que: string, detalle = "") {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
}
const titulo = (s: string) => console.log(`\n${s}`);

// ─── Forma y tolerancia ──────────────────────────────────────────────────────
titulo("Un Json roto no puede tumbar una campaña");

for (const basura of [null, undefined, 0, "", "texto", [], true, { bloques: "no es array" }]) {
  const c = leerContenido(basura);
  ok(
    Array.isArray(c.bloques) && c.v === V_ACTUAL,
    `${JSON.stringify(basura) ?? "undefined"} → contenido vacío y válido`,
  );
}

titulo("Un tipo desconocido se descarta, no rompe");
{
  const c = leerContenido({
    bloques: [
      { tipo: "titulo", texto: "Va" },
      { tipo: "carrusel3d", texto: "No existe" },
      { tipo: "texto", texto: "También va" },
    ],
  });
  ok(c.bloques.length === 2, "quedan los 2 conocidos", `quedaron ${c.bloques.length}`);
  ok(!c.bloques.some((b) => b.tipo === ("carrusel3d" as never)), "el desconocido no sobrevive");
}

// ─── Ids ─────────────────────────────────────────────────────────────────────
titulo("Todo bloque sale con id propio y único");
{
  const c = leerContenido({
    bloques: [{ tipo: "titulo", texto: "a" }, { tipo: "texto", texto: "b" }, { tipo: "divisor" }],
  });
  const ids = c.bloques.map((b) => b.id);
  ok(ids.every((i) => typeof i === "string" && i.length > 0), "todos tienen id");
  ok(new Set(ids).size === ids.length, "los ids no se repiten");
}
{
  // El caso feo: dos bloques guardados con el MISMO id. Sin desduplicar, React
  // colapsa las dos tarjetas en una y el panel edita la equivocada.
  const c = leerContenido({
    bloques: [
      { tipo: "titulo", texto: "a", id: "igual" },
      { tipo: "texto", texto: "b", id: "igual" },
      { tipo: "divisor", id: "igual" },
    ],
  });
  const ids = c.bloques.map((b) => b.id);
  ok(new Set(ids).size === 3, "tres ids repetidos se desduplican", ids.join(", "));
  ok(ids[0] === "igual", "el primero conserva el suyo (no se reasigna todo)");
}
{
  const b = nuevoBloque("titulo");
  const copia = duplicarBloque(b);
  ok(!!b.id && !!copia.id && b.id !== copia.id, "duplicar acuña un id nuevo");
}

// ─── Idempotencia ────────────────────────────────────────────────────────────
titulo("Idempotencia: leerlo dos veces da lo mismo");
{
  const crudo = {
    bloques: [
      { tipo: "hero", imagen: "", titulo: "T", subtitulo: "S", botonTexto: "", botonUrl: "", bg: "#fff" },
      { tipo: "texto", texto: "hola" },
    ],
    tema: { base: "oscuro", acento: "#2d9ff7" },
  };
  const una = leerContenido(crudo);
  const dos = leerContenido(una);
  ok(JSON.stringify(una) === JSON.stringify(dos), "segunda pasada = primera");
  ok(dos === una, "la segunda pasada ni copia el objeto (camino rápido)");
  ok(una.tema?.acento === "#2d9ff7", "el tema sobrevive a la migración");
}

// ─── Estilos: lo que no está en la lista blanca no entra ─────────────────────
titulo("El saneo de estilos");
{
  const c = leerContenido({
    bloques: [
      {
        tipo: "titulo",
        texto: "T",
        estilo: {
          titulo: {
            color: "$acento",
            fondo: "#FFF",
            // ⛔ el que importa: se escapa del atributo style="…" e inyecta HTML
            bordeColor: '#fff" onmouseover="alert(1)',
            tamano: 999,        // fuera de rango → se acota
            interlinea: 0.1,    // fuera de rango → se acota
            peso: 123,          // no está en el enum → se cae
            align: "justify",   // no está en el enum → se cae
            position: "absolute", // no está en la lista blanca → ni se mira
            mayusculas: false,  // false es lo mismo que ausente
          },
          inventado: { color: "#000" }, // rol que no existe
        },
      },
    ],
  });
  const e = c.bloques[0].estilo?.titulo;
  ok(e?.color === "$acento", "un token válido pasa");
  ok(e?.fondo === "#fff", "un hex válido pasa, normalizado a minúscula");
  ok(e?.bordeColor === undefined, "⛔ el color con comillas NO pasa");
  ok(e?.tamano === 48, "tamaño 999 se acota a 48", `quedó ${e?.tamano}`);
  ok(e?.interlinea === 1, "interlínea 0.1 se acota a 1", `quedó ${e?.interlinea}`);
  ok(e?.peso === undefined, "un peso fuera del enum se descarta");
  ok(e?.align === undefined, "un align fuera del enum se descarta");
  ok(!("position" in (e ?? {})), "position ni siquiera se copia");
  ok(!("mayusculas" in (e ?? {})), "un false no se guarda: es lo mismo que heredar");
  ok(!("inventado" in (c.bloques[0].estilo ?? {})), "un rol inexistente se descarta");
}
{
  // "Heredar" tiene que ser la AUSENCIA de la clave. Si el saneo dejara `color:
  // undefined` o un `""`, la cascada y el modo oscuro no podrían distinguir
  // "nadie lo tocó" de "alguien lo puso en negro".
  const c = leerContenido({ bloques: [{ tipo: "titulo", texto: "T", estilo: { titulo: { color: "rojo" } } }] });
  ok(c.bloques[0].estilo === undefined, "si no quedó nada, no queda ni el objeto vacío");
}

// ─── Los presets reales migran sin perder nada ───────────────────────────────
titulo("Fixtures reales: los 5 presets de plantilla + los 3 de automation");
for (const p of PRESETS) {
  const antes = p.bloques.length;
  const c = leerContenido({ bloques: p.bloques, tema: p.tema });
  ok(c.bloques.length === antes, `preset "${p.id}": ${antes} bloques y siguen ${antes}`, `quedaron ${c.bloques.length}`);
  const tiposAntes = p.bloques.map((b) => b.tipo).join(",");
  const tiposDespues = c.bloques.map((b) => b.tipo).join(",");
  ok(tiposAntes === tiposDespues, `preset "${p.id}": los tipos y el orden no cambian`, `${tiposAntes}\n      → ${tiposDespues}`);
}
{
  const presets = presetsPara("Marca de prueba", "https://ejemplo.com");
  for (const [trigger, p] of Object.entries(presets)) {
    const c = leerContenido({ bloques: p.bloques });
    ok(c.bloques.length === p.bloques.length, `automation ${trigger}: no pierde bloques`);
  }
  // El carrito tiene que seguir en su lugar: si el bloque se moviera al final,
  // el mail diría "dejaste esto" y mostraría los productos DESPUÉS del botón.
  const ca = leerContenido({ bloques: presets.CARRITO_ABANDONADO.bloques });
  const iCarrito = ca.bloques.findIndex((b) => b.tipo === "carrito");
  const iBoton = ca.bloques.findIndex((b) => b.tipo === "boton");
  ok(iCarrito >= 0 && iBoton > iCarrito, "el carrito sigue ANTES del botón");
}

// ─── El carrito no se llena solo ─────────────────────────────────────────────
titulo("La migración no le inventa productos al carrito");
{
  const c = leerContenido({ bloques: [{ tipo: "carrito", items: [] }] });
  const b = c.bloques[0] as Extract<Bloque, { tipo: "carrito" }>;
  ok((b.items ?? []).length === 0, "un carrito vacío sigue vacío");
}

// ─── Nadie puede volver al cast ──────────────────────────────────────────────
titulo("Ningún archivo lee el contenido con un cast");
{
  // Es la única forma de que el próximo call site que alguien escriba dentro de
  // tres meses no se filtre sin normalizar. Misma idea que auditar-permisos.ts.
  const raiz = join(import.meta.dirname, "..");
  const IGNORAR = new Set(["node_modules", ".next", ".git", "scripts", ".vercel"]);
  const culpables: string[] = [];

  const recorrer = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      if (IGNORAR.has(nombre)) continue;
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (/\.(ts|tsx)$/.test(nombre)) {
        // Sin comentarios: que un comentario EXPLIQUE por qué el cast se fue no
        // es una violación, y si no, este chequeo se cae solo con su propia
        // documentación.
        const src = readFileSync(ruta, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "");
        if (/as\s+unknown\s+as\s+ContenidoCampania|as\s+ContenidoCampania\b/.test(src)) {
          culpables.push(ruta.slice(raiz.length + 1));
        }
      }
    }
  };
  recorrer(raiz);
  ok(culpables.length === 0, "cero `as ContenidoCampania` en el repo", culpables.join("\n      "));
}

console.log(fallas === 0 ? "\n✅ Esquema OK\n" : `\n❌ ${fallas} fallas\n`);
process.exit(fallas === 0 ? 0 : 1);
