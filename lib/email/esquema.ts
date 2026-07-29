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
 *   3 → el encabezado de marca es un bloque, no HTML fijo del shell
 *
 * Cada cambio de forma de un bloque suma UN escalón con su función de migración.
 * No se reescribe un escalón ya publicado: un documento que ya subió a v2 nunca
 * vuelve a pasar por el paso 1→2, así que colgarle algo nuevo ahí no tendría
 * efecto sobre las filas que ya migraron.
 */
export const V_ACTUAL = 3;

type Bruto = Record<string, unknown>;
type Migracion = (c: Bruto) => Bruto;

const MIGRACIONES: Record<number, Migracion> = {
  // 1 → 2 · Los bloques ganan identidad propia.
  //
  // El trabajo real lo hace `sanearBloque`, que corre en cada lectura y le pone
  // `id` a lo que no tenga. Este escalón existe igual para dejar marcado en el
  // dato que ya pasó por acá, y para tener dónde colgar el próximo cambio.
  1: (c) => ({ ...c, v: 2 }),
  // 2 → 3 · El encabezado de marca deja de estar cableado en el shell.
  //
  // Hasta acá el nombre de la marca lo escribía `renderEmailHtml` sí o sí, así
  // que ningún documento lo tiene guardado. Si el bloque naciera solo para lo
  // nuevo, **toda campaña y plantilla ya guardada saldría sin cabecera** — que
  // es justo lo que no puede pasar al convertir algo fijo en algo editable.
  //
  // Se materializa SIN campos a propósito: un `encabezado` vacío resuelve el
  // nombre desde la cuenta al renderizar, que es exactamente lo que hacía el
  // shell. Escribirle el nombre adentro dejaría la marca clavada en el Json y
  // rompería el día que esa plantilla se comparta entre comerciantes.
  2: (c) => ({
    ...c,
    v: 3,
    bloques: [{ tipo: "encabezado" }, ...(Array.isArray(c.bloques) ? c.bloques : [])],
  }),
};

const CONOCIDOS = new Set<string>(TIPOS_BLOQUE);

/**
 * Un solo `encabezado`, y en la posición 0.
 *
 * No es prolijidad: el encabezado se dibuja **fuera** de la tarjeta de
 * contenido. Dos encabezados, o uno en el medio de la lista, harían que el
 * editor muestre un orden y el mail salga con otro. Sobrevive el primero, que
 * es el que materializó la migración.
 */
function acomodarEncabezado(bs: Bloque[]): Bloque[] {
  const i = bs.findIndex((b) => b.tipo === "encabezado");
  if (i < 0) return bs;
  const otros = bs.filter((b, j) => j !== i && b.tipo !== "encabezado");
  // Ya estaba primero y era el único: no hay nada que mover.
  if (i === 0 && otros.length === bs.length - 1) return bs;
  return [bs[i], ...otros];
}

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

  // Un bloque de productos automáticos guarda la CONSULTA y nunca los productos.
  // Los items se los pone quien envía, sobre una copia en memoria, y se tiran acá
  // por si alguna vez entraran por otro camino: un Json editado a mano, un script,
  // una versión futura del editor que se distraiga.
  //
  // No es prolijidad. Una plantilla con productos adentro es la bienvenida de
  // Zattia saludando en nombre de BDI, otra vez y con el catálogo.
  if (b.tipo === "productos-dinamicos") delete b.items;

  return b as unknown as Bloque;
}

/** ¿Ya está en la forma actual? Evita rehacer el trabajo en cada render. */
function esActual(v: unknown): v is ContenidoCampania {
  if (!v || typeof v !== "object" || (v as Bruto).v !== V_ACTUAL) return false;
  const bs = (v as Bruto).bloques;
  if (!Array.isArray(bs)) return false;
  // El encabezado acomodado también es parte de "la forma actual", y mirarlo
  // cuesta un recorrido sin trabajo adentro. Si esto no se chequeara, un Json
  // editado a mano con dos encabezados entraría por el camino rápido y el
  // editor mostraría una lista que el mail no respeta.
  // Un bloque dinámico con productos adentro NO es "la forma actual", por más
  // que el `v` diga 3: si entrara por el camino rápido, el saneo que los tira no
  // correría nunca y el Json quedaría con el catálogo de una marca guardado.
  if (bs.some((b) => (b as Bruto | null)?.tipo === "productos-dinamicos" && (b as Bruto).items !== undefined)) {
    return false;
  }
  const cabs = bs.filter((b) => (b as Bruto | null)?.tipo === "encabezado");
  return cabs.length === 0 || (cabs.length === 1 && cabs[0] === bs[0]);
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
  const bloques = acomodarEncabezado(
    (Array.isArray(c.bloques) ? c.bloques : [])
      .map((b) => sanearBloque(b, usados))
      .filter((b): b is Bloque => b !== null),
  );

  const out: ContenidoCampania = { v: V_ACTUAL, bloques };

  // `temaDe` espera el objeto contenedor, no el tema: lee `.tema` de adentro.
  const tema = temaDe(c);
  if (tema) out.tema = tema;

  const estilos = sanearEstilos(c.estilos);
  if (estilos) out.estilos = estilos;

  return out;
}
