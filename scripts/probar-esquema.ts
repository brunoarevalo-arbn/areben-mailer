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
import { presetsPara, presetDeTrigger } from "../lib/plantillas/presets";

/** Una cuenta de mentira para instanciar los presets. Ver `presetsPara`. */
const CUENTA = { nombre: "Marca de prueba", config: { url: "https://ejemplo.com" } };

let fallas = 0;
function ok(cond: boolean, que: string, detalle = "") {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
}
const titulo = (s: string) => console.log(`\n${s}`);

/**
 * Los bloques SIN la cabecera de marca.
 *
 * Desde v3 la migración le materializa un `encabezado` a todo documento que no
 * lo tenga (ver `probar-encabezado.ts`), así que los invariantes de contenido se
 * miran contra el resto: lo que se está fijando acá es que la migración no
 * pierda ni reordene lo que el comerciante escribió.
 */
const cuerpo = (c: { bloques: Bloque[] }) => c.bloques.filter((b) => b.tipo !== "encabezado");

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
  ok(cuerpo(c).length === 2, "quedan los 2 conocidos", `quedaron ${cuerpo(c).length}`);
  ok(!c.bloques.some((b) => b.tipo === ("carrusel3d" as never)), "el desconocido no sobrevive");
}

// ─── Ids ─────────────────────────────────────────────────────────────────────
titulo("Todo bloque sale con id propio y único");
{
  const c = leerContenido({
    bloques: [{ tipo: "titulo", texto: "a" }, { tipo: "texto", texto: "b" }, { tipo: "divisor" }],
  });
  const ids = c.bloques.map((b) => b.id);
  ok(ids.every((i) => typeof i === "string" && i.length > 0), "todos tienen id (la cabecera incluida)");
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
  const ids = cuerpo(c).map((b) => b.id);
  ok(new Set(ids).size === 3, "tres ids repetidos se desduplican", ids.join(", "));
  ok(ids[0] === "igual", "el primero conserva el suyo (no se reasigna todo)");
}
{
  const b = nuevoBloque("titulo");
  const copia = duplicarBloque(b);
  ok(!!b.id && !!copia.id && b.id !== copia.id, "duplicar acuña un id nuevo");
}
{
  // 🔴 La copia tiene que ser PROFUNDA. Con el spread superficial de antes, el
  // array `celdas` y cada `Columna` quedaban COMPARTIDOS entre el original y la
  // copia: tocar la foto de una celda del duplicado se la cambiaba también al
  // bloque de arriba. Se pone rojo si alguien vuelve a `{ ...b, id }`.
  const b = nuevoBloque("columnas");
  const copia = duplicarBloque(b);
  if (b.tipo !== "columnas" || copia.tipo !== "columnas") throw new Error("no es columnas");

  ok(copia.celdas !== b.celdas, "el array de celdas es otro objeto");
  ok(copia.celdas[0] !== b.celdas[0], "cada celda es otro objeto");

  copia.celdas[0].imagen = "https://ejemplo.com/pisada.jpg";
  copia.celdas.push({ imagen: "", url: "" });
  ok(b.celdas[0].imagen === "", "mutar una celda de la copia no toca el original");
  ok(b.celdas.length === 2, "agregarle una celda a la copia no se la agrega al original");
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
            mayusculas: false,  // se GUARDA: es "apagado", que no es "heredar"
            subrayado: "sí",    // no es booleano → se cae
          },
          inventado: { color: "#000" }, // rol que no existe
        },
      },
    ],
  });
  const e = cuerpo(c)[0].estilo?.titulo;
  ok(e?.color === "$acento", "un token válido pasa");
  ok(e?.fondo === "#fff", "un hex válido pasa, normalizado a minúscula");
  ok(e?.bordeColor === undefined, "⛔ el color con comillas NO pasa");
  ok(e?.tamano === 48, "tamaño 999 se acota a 48", `quedó ${e?.tamano}`);
  ok(e?.interlinea === 1, "interlínea 0.1 se acota a 1", `quedó ${e?.interlinea}`);
  ok(e?.peso === undefined, "un peso fuera del enum se descarta");
  ok(e?.align === undefined, "un align fuera del enum se descarta");
  ok(!("position" in (e ?? {})), "position ni siquiera se copia");
  // 🔴 El `false` SÍ se guarda: en una cascada "apagado" y "heredar" son cosas
  // distintas, y sin poder escribir el primero no hay forma de apagar desde el
  // bloque algo que la plantilla prendió en la capa de documento.
  ok(e?.mayusculas === false, "un false se guarda: apagar no es heredar", `quedó ${String(e?.mayusculas)}`);
  ok(!("subrayado" in (e ?? {})), "lo que no es booleano se descarta igual que antes");
  ok(!("inventado" in (cuerpo(c)[0].estilo ?? {})), "un rol inexistente se descarta");
}
{
  // "Heredar" tiene que ser la AUSENCIA de la clave. Si el saneo dejara `color:
  // undefined` o un `""`, la cascada y el modo oscuro no podrían distinguir
  // "nadie lo tocó" de "alguien lo puso en negro".
  const c = leerContenido({ bloques: [{ tipo: "titulo", texto: "T", estilo: { titulo: { color: "rojo" } } }] });
  ok(cuerpo(c)[0].estilo === undefined, "si no quedó nada, no queda ni el objeto vacío");
}

// ─── Los presets reales nacen en la forma actual ─────────────────────────────
//
// Un preset se guarda tal cual sale de `presetsPara`, así que si naciera en una
// versión vieja del esquema sería el único documento del sistema que entra a la
// base sin migrar. Por eso pasan por `leerContenido` al instanciarse y acá se
// fija que releerlos no cambie nada.
titulo("Fixtures reales: los presets que vienen con la app");
for (const p of presetsPara(CUENTA)) {
  const antes = cuerpo(p.contenido).length;
  ok(p.contenido.v === V_ACTUAL, `preset "${p.id}": nace en v${V_ACTUAL}`, `nació en v${p.contenido.v}`);
  ok(p.contenido.bloques[0]?.tipo === "encabezado", `preset "${p.id}": estrena cabecera de marca`);
  ok(p.contenido.bloques.every((b) => b.id), `preset "${p.id}": todos los bloques con id`);

  const c = leerContenido(JSON.parse(JSON.stringify(p.contenido)));
  ok(cuerpo(c).length === antes, `preset "${p.id}": ${antes} bloques y siguen ${antes}`, `quedaron ${cuerpo(c).length}`);
  const tiposAntes = cuerpo(p.contenido).map((b) => b.tipo).join(",");
  const tiposDespues = cuerpo(c).map((b) => b.tipo).join(",");
  ok(tiposAntes === tiposDespues, `preset "${p.id}": los tipos y el orden no cambian`, `${tiposAntes}\n      → ${tiposDespues}`);
}
{
  // El carrito tiene que seguir en su lugar: si el bloque se moviera al final,
  // el mail diría "dejaste esto" y mostraría los productos DESPUÉS del botón.
  const ca = presetDeTrigger("CARRITO_ABANDONADO", CUENTA).contenido;
  const iCarrito = ca.bloques.findIndex((b) => b.tipo === "carrito");
  const iBoton = ca.bloques.findIndex((b) => b.tipo === "boton");
  ok(iCarrito >= 0 && iBoton > iCarrito, "el carrito sigue ANTES del botón");
}
// ─── Un preset no puede guardar la marca que lo instanció ────────────────────
//
// Es el bug que ya pasó (la bienvenida de Zattia firmando "BDI Accesorios"),
// ahora con dos formas nuevas de repetirse: el nombre de la marca en la cabecera
// y el catálogo de la tienda adentro de un bloque de productos.
titulo("Ningún preset guarda datos de la marca adentro del Json");
for (const p of presetsPara({ nombre: "Marca Uno", config: { url: "https://uno.com" } })) {
  const cab = p.contenido.bloques[0] as Extract<Bloque, { tipo: "encabezado" }>;
  ok(!cab.texto && !cab.logo, `preset "${p.id}": la cabecera no lleva la marca escrita`);
  const conProductos = p.contenido.bloques.filter(
    (b) => b.tipo === "productos-dinamicos" && "items" in b,
  );
  ok(conProductos.length === 0, `preset "${p.id}": el bloque dinámico no trae productos`);
}

// ─── El layout móvil de la grilla sobrevive a la ida y vuelta ────────────────
//
// `movil` es un campo que `sanearBloque` no enumera: pasa porque el bloque se
// copia entero con spread. Si algún día alguien cambiara ese saneo por una lista
// blanca de campos, el mail seguiría guardándose "de a dos" en el editor y
// saldría apilado, **solo en el envío** — que es exactamente el modo de falla
// que la regla 6 de AGENTS existe para evitar.
titulo("La grilla se acuerda de cuántos productos por fila van en el celular");
{
  const c = leerContenido({
    v: V_ACTUAL,
    bloques: [
      { tipo: "encabezado" },
      { tipo: "productos", items: [], movil: 2 },
      { tipo: "productos-dinamicos", fuente: "destacados", n: 4, movil: 2 },
    ],
  });
  const bs = cuerpo(c) as Extract<Bloque, { tipo: "productos" | "productos-dinamicos" }>[];
  ok(bs[0]?.movil === 2, "el bloque de productos elegidos a mano conserva `movil`");
  ok(bs[1]?.movil === 2, "el bloque dinámico conserva `movil`");

  // Y lo de siempre sigue como estaba: sin el campo, apila.
  const viejo = leerContenido({ bloques: [{ tipo: "productos", items: [] }] });
  const b = cuerpo(viejo)[0] as Extract<Bloque, { tipo: "productos" }>;
  ok(b.movil === undefined, "un documento viejo NO gana el campo al migrar (ausente = apila)");
}

// ─── v3 → v4: `columnas` deja de ser izquierda y derecha ─────────────────────
//
// Es la migración más peligrosa que hubo hasta ahora: no agrega un campo, le
// **cambia la forma** a un bloque que ya está guardado en campañas y plantillas
// de comerciantes. Si perdiera una celda, el mail sale con la mitad del bloque y
// nadie se entera hasta que está en la casilla de otro.
titulo("v3→v4: las dos columnas de un documento viejo son las dos primeras celdas");
{
  const viejo = leerContenido({
    v: 3,
    bloques: [
      { tipo: "encabezado" },
      {
        tipo: "columnas",
        variante: "imagen-texto",
        proporcion: 40,
        izq: { imagen: "https://x/a.jpg", url: "https://a" },
        der: { titulo: "T", texto: "Cuerpo", url: "https://b" },
      },
    ],
  });
  const b = cuerpo(viejo)[0] as Extract<Bloque, { tipo: "columnas" }>;
  ok(b.celdas?.length === 2, "quedan dos celdas");
  ok(b.celdas?.[0]?.imagen === "https://x/a.jpg", "la izquierda es la primera, con su foto");
  ok(b.celdas?.[1]?.texto === "Cuerpo", "la derecha es la segunda, con su texto");
  ok(b.proporcion === 40 && b.variante === "imagen-texto", "la proporción y la variante no se tocan");
  ok(
    (b as unknown as Record<string, unknown>).izq === undefined,
    "el campo viejo se borra: dos fuentes de verdad para lo mismo es la próxima falla silenciosa",
  );

  // Un Json que ya dice v4 pero todavía trae `izq`/`der` —editado a mano, o
  // escrito por un script que no se actualizó— NO puede entrar por el camino
  // rápido: el render se quedaría sin celdas y el bloque desaparecería callado.
  const mentiroso = leerContenido({
    v: V_ACTUAL,
    bloques: [{ tipo: "columnas", izq: { imagen: "https://x/a.jpg", url: "#" }, der: { imagen: "https://x/b.jpg", url: "#" } }],
  });
  const m = cuerpo(mentiroso)[0] as Extract<Bloque, { tipo: "columnas" }>;
  ok(m.celdas?.length === 2, "un v4 con la forma vieja adentro igual se convierte");

  // Los bordes del rango: nunca menos de 2 ni más de 4.
  const muchas = leerContenido({
    bloques: [{ tipo: "columnas", celdas: [1, 2, 3, 4, 5, 6].map((n) => ({ imagen: `https://x/${n}.jpg`, url: "#" })) }],
  });
  ok((cuerpo(muchas)[0] as Extract<Bloque, { tipo: "columnas" }>).celdas.length === 4, "seis celdas se recortan a cuatro");
  const pocas = leerContenido({ bloques: [{ tipo: "columnas", celdas: [{ imagen: "https://x/a.jpg", url: "#" }] }] });
  ok((cuerpo(pocas)[0] as Extract<Bloque, { tipo: "columnas" }>).celdas.length === 2, "una sola celda se completa a dos");
}

// ─── El carrito no se llena solo ─────────────────────────────────────────────
titulo("La migración no le inventa productos al carrito");
{
  const c = leerContenido({ bloques: [{ tipo: "carrito", items: [] }] });
  const b = cuerpo(c)[0] as Extract<Bloque, { tipo: "carrito" }>;
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

// ─── Un bloque sin `id` no puede entrar por el camino rápido ─────────────────
// 🔴 El editor identifica cada bloque por su `id`: `marcarBloques` lo emite como
// `data-b` y el click sobre el preview resuelve con eso cuál formulario abrir.
// Un bloque sin id **se dibuja perfecto y es intocable**.
//
// Pasó el 20-ago-2026: un script escribió los bloques del mail de carrito de BDI
// sin id y 8 de 12 quedaron imposibles de seleccionar. ⚠️ Nada lo vio — el HTML
// era idéntico, el golden no se movió y las 16 auditorías dieron verde. Se
// encontró clickeando, a mano, en Safari.
//
// La red no es "acordate de poner el id": es que un documento así **no sea la
// forma actual**, caiga al camino lento y `sanearBloque` se lo ponga. Así se
// repara solo al leerse, venga de un script, de una migración o de un Json
// editado a mano.
console.log("\nUn bloque sin id se repara al leerse");
{
  const sano = leerContenido({
    v: V_ACTUAL,
    bloques: [nuevoBloque("encabezado"), nuevoBloque("titulo"), nuevoBloque("texto")],
  });
  ok(
    sano.bloques.every((b) => typeof (b as { id?: string }).id === "string" && (b as { id?: string }).id),
    "un documento sano sale con todos sus ids",
  );

  // El caso real: `v` dice la versión actual, pero un bloque no trae id.
  const roto = {
    v: V_ACTUAL,
    bloques: [
      nuevoBloque("encabezado"),
      { tipo: "titulo", texto: "Escrito por un script" },
      { tipo: "boton", texto: "COMPRAR", url: "https://ejemplo.com" },
    ],
  };
  const reparado = leerContenido(roto);
  const sinId = reparado.bloques.filter((b) => !(b as { id?: string }).id);
  ok(sinId.length === 0, "un bloque sin id sale CON id después de leerlo", `quedaron ${sinId.length} sin id`);
  ok(
    reparado.bloques.map((b) => b.tipo).join(",") === "encabezado,titulo,boton",
    "y no se pierde ni se reordena ningún bloque",
    reparado.bloques.map((b) => b.tipo).join(","),
  );
  ok(
    new Set(reparado.bloques.map((b) => (b as { id?: string }).id)).size === reparado.bloques.length,
    "los ids que se asignan no se repiten entre sí",
  );

  // La otra punta: el camino rápido tiene que seguir siendo rápido para lo sano.
  // Si `esActual` empezara a devolver false siempre, esto se pondría verde por
  // el motivo equivocado y el saneo correría en cada render.
  const dosVeces = leerContenido(sano);
  ok(dosVeces === sano, "un documento sano sigue entrando por el camino rápido (misma referencia)");
  ok(
    leerContenido(roto) !== roto,
    "y uno roto NO: se lo copia y sanea",
  );
}

console.log(fallas === 0 ? "\n✅ Esquema OK\n" : `\n❌ ${fallas} fallas\n`);
process.exit(fallas === 0 ? 0 : 1);
