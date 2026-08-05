/**
 * Copiar bloques de un mail y pegarlos en otro, **incluso entre marcas**.
 *
 * El caso que lo motivó es Zattia en una pestaña y BDI en otra: armar el mismo
 * bloque dos veces a mano, con sus estilos, es la fricción más cara que quedaba
 * en el editor después de las tres tandas de teclado.
 *
 * 🔴 **Portapapeles del sistema, nunca `sessionStorage`.** Dos pestañas de
 * marcas distintas son dos sesiones del panel, y `sessionStorage` no cruza de
 * pestaña. `localStorage` sí, pero es del ORIGEN: no cruzaría a otro navegador,
 * a otra ventana de incógnito ni a una nota de texto, y encima habría que
 * inventarle un vencimiento. El portapapeles ya resuelve eso y lo entiende
 * cualquiera.
 *
 * ⚠️ **Esta es la SEGUNDA puerta al Json de un mail** (la primera es
 * `leerContenido`, contra la base). Por eso este archivo **no sanea nada por su
 * cuenta**: valida el sobre —que lo pegado sea nuestro y no una receta de
 * cocina— y le pasa el contenido a `leerContenido`, que es donde vive el saneo y
 * la migración de versiones. Dos definiciones de "qué es un bloque válido"
 * serían dos respuestas distintas el día que se agregue un campo.
 *
 * Puro: sin DOM y sin React. El que toca `navigator.clipboard` es `EditorMail`.
 */
import { TIPOS_BLOQUE, type Bloque } from "./bloques";
import { leerContenido, V_ACTUAL } from "./esquema";

/**
 * La marca de agua del sobre.
 *
 * Lleva versión propia y **no** la del esquema del mail: son dos cosas que
 * cambian por motivos distintos —el sobre, si algún día se copia también el
 * tema; el esquema, cada vez que un bloque suma un campo— y el `v` del contenido
 * ya viaja adentro para que `leerContenido` sepa desde dónde migrar.
 */
const SOBRE = "areben-mailer/bloques@1";

/** Tope de bloques por pegada: un mail entero son ~15, y 200 es un accidente. */
const MAX = 50;

export interface Pegado {
  /**
   * Los bloques ya saneados.
   *
   * 🔴 **Con los ids de ORIGEN, y pueden venir hasta repetidos entre sí**: el
   * camino rápido de `leerContenido` (`esActual`) no mira ids duplicados. Quien
   * pega **tiene que** pasarlos por `duplicarBloque` — no es una precaución, es
   * la única cosa que impide dos bloques con el mismo id en un documento.
   */
  bloques: Bloque[];
  /** El nombre de la marca de la que se copiaron, si el sobre lo declaraba. */
  marca?: string;
}

/**
 * Los bloques elegidos → el texto que va al portapapeles.
 *
 * Va como JSON con sangría a propósito: si alguien lo pega en un mail o en una
 * nota, lo que ve es algo que se entiende y se puede volver a pegar acá, no una
 * línea de 4 KB. Son bytes del portapapeles, no del mail.
 */
export function armarClip(bloques: Bloque[], marca?: string): string {
  return JSON.stringify({ app: SOBRE, marca, contenido: { v: V_ACTUAL, bloques } }, null, 2);
}

/**
 * El texto del portapapeles → bloques, o `null` si no es nuestro.
 *
 * `null` es "esto no me lo pegaron a mí" y el que llama tiene que **devolverle
 * el evento al navegador**: la enorme mayoría de las pegadas del editor son
 * texto adentro de un campo, y quedarse con todas para descartarlas rompería
 * escribir un mail.
 */
export function leerClip(texto: string): Pegado | null {
  // Un JSON no arranca con otra cosa, y `JSON.parse` sobre el texto de un mail
  // entero es trabajo que no hace falta hacer en cada ⌘V.
  const t = texto.trim();
  if (!t.startsWith("{")) return null;

  let sobre: unknown;
  try {
    sobre = JSON.parse(t);
  } catch {
    return null;
  }
  if (!sobre || typeof sobre !== "object" || Array.isArray(sobre)) return null;

  const s = sobre as Record<string, unknown>;
  if (s.app !== SOBRE) return null;

  const c = s.contenido;
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;
  const crudos = (c as Record<string, unknown>).bloques;
  if (!Array.isArray(crudos) || crudos.length === 0) return null;

  // 🔴 **El tipo desconocido se filtra ACÁ y no se delega.** `leerContenido`
  // también lo tira, pero tiene un camino rápido para los documentos que ya
  // declaran la versión actual —existe para no rehacer el saneo en cada
  // render— y un sobre lo escribe quien quiera: bastaba un `tipo` inventado
  // para que `ICONO[b.tipo]` fuera `undefined` y la lista de bloques se cayera
  // entera con la pantalla en blanco. Del contenido de cada bloque sigue
  // ocupándose `leerContenido`.
  const conocidos = new Set<string>(TIPOS_BLOQUE);
  const bloques = crudos
    .slice(0, MAX)
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object" && !Array.isArray(b))
    .filter((b) => typeof b.tipo === "string" && conocidos.has(b.tipo));
  if (!bloques.length) return null;

  // El `v` del sobre y no `V_ACTUAL`: las dos pestañas pueden estar en deploys
  // distintos, y ahí lo que hace falta es exactamente la migración de siempre.
  const leido = leerContenido({ ...(c as object), bloques });
  if (!leido.bloques.length) return null;

  return {
    bloques: leido.bloques,
    marca: typeof s.marca === "string" && s.marca.trim() ? s.marca.trim() : undefined,
  };
}
