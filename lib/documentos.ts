/**
 * Guardado con detección de conflicto para los tres documentos que se editan a
 * mano: campaña, automation y plantilla.
 *
 * 🔴 **EL PROBLEMA QUE CIERRA.** Guardar escribe el registro ENTERO con lo que
 * tenía la pantalla. Sin historial y sin chequeo, una pantalla cargada ANTES de
 * un cambio y guardada DESPUÉS lo borra — sin error, sin aviso, y el `updatedAt`
 * sólo muestra la última escritura, así que ni queda rastro de que hubo dos. El
 * 8-ago-2026 pasó dos veces: se comió el bloque `cupon` de GIRLHOOD (se
 * reconstruyó a ojo desde una captura porque no hay historial) y revirtió el
 * destino de una campaña de Zattia que, de no verlo Bruno, salía a 178 personas
 * que ya tenían ese mismo mail en la casilla.
 *
 * 🔑 **La forma es un `updateMany` condicional**, el mismo idioma que la cola de
 * envío ya usa para que dos workers no agarren la misma campaña
 * (`Campania.procesandoHasta`). Lo que faltaba era el equivalente **para las
 * personas**.
 *
 * ⚠️ **Y el marcador es `docVersion`, no `updatedAt`.** `updatedAt` lo mueve
 * cualquier escritura, y a estas tablas les escribe mucho más que el editor: el
 * toggle de una automation, el panel de carrito de Resorty y el lease de la cola
 * durante un envío. Con `updatedAt` de marcador, tener el editor abierto
 * mientras sale una campaña haría imposible guardar. Un aviso que salta cuando
 * no pasó nada se aprende a ignorar en dos días.
 *
 * Este archivo es **puro** (sin prisma, sin next): lo importan el servidor y el
 * cliente, y así la decisión se puede probar con un script de Node.
 */

/** Lo que devuelve cualquiera de las tres actions de guardado. */
export type ResultadoGuardado =
  | { ok: true; version: number }
  | { ok: false; error: string; conflicto: boolean };

/**
 * 🔑 **El texto dice qué hacer, no qué pasó.** "Conflicto de versiones" no le
 * dice a nadie qué apretar. Y dice explícitamente que lo que está en pantalla
 * NO se guardó, porque el modo de falla que más duele es creer que sí.
 */
export const MENSAJE_CONFLICTO =
  'Alguien más guardó este mail mientras lo tenías abierto. Para no pisarle los cambios, esto NO se guardó. Copiá lo que hayas escrito, recargá la página y volvé a aplicarlo.';

export const MENSAJE_NO_EXISTE = 'No se encontró: puede que lo hayan borrado.';

/**
 * Qué contestar después de intentar el `updateMany` condicional.
 *
 * `filas` es lo que devolvió el update (0 o 1) y `existe` es si el documento
 * sigue estando. Son dos preguntas distintas y hay que hacer las dos: con sólo
 * `filas === 0` no se puede distinguir **"alguien lo pisó"** de **"lo
 * borraron"**, y son dos cosas que se resuelven distinto — una se arregla
 * recargando y la otra no se arregla.
 *
 * ⚠️ Es puro y devuelve el mensaje ya armado a propósito: es lo mismo que va a
 * la pantalla y a los tests, así que no puede haber dos redacciones.
 */
export function veredictoGuardado(
  filas: number,
  existe: boolean,
  versionNueva: number,
): ResultadoGuardado {
  if (filas > 0) return { ok: true, version: versionNueva };
  if (!existe) return { ok: false, error: MENSAJE_NO_EXISTE, conflicto: false };
  return { ok: false, error: MENSAJE_CONFLICTO, conflicto: true };
}

/**
 * La versión con la que el editor tiene que arrancar cuando la fila todavía no
 * tiene ninguna.
 *
 * 🔴 Existe porque `docVersion` se agregó a tablas que ya tenían filas: todas
 * arrancan en 0, y 0 es un valor **válido**, no "sin versión". Un
 * `version || 1` —el reflejo de siempre— convertiría el 0 en 1 y haría que el
 * primer guardado de todo documento existente fallara por conflicto contra sí
 * mismo.
 */
export const VERSION_INICIAL = 0;
