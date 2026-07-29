// El único punto de entrada al Json de bloques que viene de la base.
//
// Hasta acá, `Campania.contenido` / `Automation.contenido` / `Plantilla.contenido`
// se leían con `as unknown as ContenidoCampania` en siete lugares distintos: un
// cast no valida nada, así que cualquier fila rara reventaba en el render o, peor,
// salía mal en un mail ya enviado.
//
// ⚠️ Puro: lo importan el SERVIDOR y el CLIENTE (el preview). Sin prisma, sin
// next/headers y **sin zod** — son ~14 KB gzip en el bundle del navegador para
// validar una unión que ya está escrita en TypeScript. Esto hace lo mismo a mano
// y, como `resolverPaleta`, **nunca lanza**: un contenido roto no puede impedir
// que salga la campaña.

import { TIPOS_BLOQUE, nuevoId, type Bloque, type ContenidoCampania } from "./bloques";
import { sanearEstilos } from "./estilos";
import { temaDe } from "./tema";

/**
 * Versión del esquema de bloques.
 *
 *   1 → el formato original, sin `v` (todo lo guardado antes del 29-jul-2026)
 *   2 → cada bloque tiene `id` estable, y `estilo`/`estilos` están saneados
 *
 * Cada cambio de forma de un bloque suma UN escalón con su función de migración.
 * No se reescribe un escalón ya publicado: un documento que ya subió a v2 nunca
 * vuelve a pasar por el paso 1→2, así que colgarle algo nuevo ahí no tendría
 * efecto sobre las filas que ya migraron.
 */
export const V_ACTUAL = 2;

type Bruto = Record<string, unknown>;
type Migracion = (c: Bruto) => Bruto;

const MIGRACIONES: Record<number, Migracion> = {
  // 1 → 2 · Los bloques ganan identidad propia.
  //
  // El trabajo real lo hace `sanearBloque`, que corre en cada lectura y le pone
  // `id` a lo que no tenga. Este escalón existe igual para dejar marcado en el
  // dato que ya pasó por acá, y para tener dónde colgar el próximo cambio.
  1: (c) => ({ ...c, v: 2 }),
};

const CONOCIDOS = new Set<string>(TIPOS_BLOQUE);

/**
 * Un bloque de la base, o `null` si no es rescatable.
 *
 * Un `tipo` desconocido **se descarta y no rompe**: es lo que pasa si alguien
 * abre en una versión vieja del panel una plantilla guardada con un bloque nuevo.
 * Perder un bloque es feo; que no cargue la campaña entera es peor.
 */
function sanearBloque(v: unknown, usados: Set<string>): Bloque | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const b = { ...(v as Bruto) };

  if (typeof b.tipo !== "string" || !CONOCIDOS.has(b.tipo)) return null;

  // Id propio y sin repetir. El duplicado importa tanto como el faltante: dos
  // bloques con el mismo id hacen que React colapse las dos tarjetas en una y
  // que el panel de propiedades edite la equivocada.
  let id = typeof b.id === "string" && b.id.trim() ? b.id.trim() : nuevoId();
  while (usados.has(id)) id = nuevoId();
  usados.add(id);
  b.id = id;

  const estilo = sanearEstilos(b.estilo);
  if (estilo) b.estilo = estilo;
  else delete b.estilo;

  return b as unknown as Bloque;
}

/** ¿Ya está en la forma actual? Evita rehacer el trabajo en cada render. */
function esActual(v: unknown): v is ContenidoCampania {
  return (
    !!v &&
    typeof v === "object" &&
    (v as Bruto).v === V_ACTUAL &&
    Array.isArray((v as Bruto).bloques)
  );
}

/**
 * Json crudo → contenido usable. Idempotente: llamarlo dos veces da lo mismo.
 *
 * ⚠️ El camino rápido saltea el saneo de un documento que ya está en la versión
 * actual, y eso está bien: **la garantía de que nada del Json llega crudo al
 * HTML vive en los emisores de estilos.ts**, no acá. Este saneo es para que el
 * editor no muestre basura y para que la forma sea la esperada, no es la
 * frontera de seguridad.
 */
export function leerContenido(json: unknown): ContenidoCampania {
  if (esActual(json)) return json;

  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return { v: V_ACTUAL, bloques: [] };
  }

  let c = { ...(json as Bruto) };

  // Escalones, en orden, desde la versión que declare (sin `v` = 1).
  const desde = typeof c.v === "number" && Number.isFinite(c.v) ? c.v : 1;
  for (let n = desde; n < V_ACTUAL; n++) {
    const paso = MIGRACIONES[n];
    if (!paso) break;
    c = paso(c);
  }

  const usados = new Set<string>();
  const bloques = (Array.isArray(c.bloques) ? c.bloques : [])
    .map((b) => sanearBloque(b, usados))
    .filter((b): b is Bloque => b !== null);

  const out: ContenidoCampania = { v: V_ACTUAL, bloques };

  // `temaDe` espera el objeto contenedor, no el tema: lee `.tema` de adentro.
  const tema = temaDe(c);
  if (tema) out.tema = tema;

  const estilos = sanearEstilos(c.estilos);
  if (estilos) out.estilos = estilos;

  return out;
}
