/**
 * Las decisiones del barrido de carritos recuperados, sin I/O.
 *
 * Están acá y no adentro de `app/api/carritos/recuperados/route.ts` porque son
 * dos reglas que, si se invierten, **no rompen nada**: no tiran, no fallan el
 * build, el endpoint sigue devolviendo 200 y la métrica queda mal para siempre.
 * Eso es exactamente lo que tiene que fijar un ensayo, y un ensayo no puede
 * llamar a un handler que abre conexiones a TN y a la base.
 *
 * Ver `scripts/probar-recuperados.ts`.
 */

/** Lo que contesta `estadoDeCheckout()` sobre un checkout. */
export type EstadoTn = "abierto" | "completado" | "desconocido";

/** Lo que hay que escribirle a la fila de `CarritoVisto`. `null` = no tocarla. */
export interface Escritura {
  estado?: "RECUPERADO";
  completadoAt?: Date;
  revisadoAt: Date;
}

/**
 * Qué hacer con un carrito según lo que contestó Tiendanube.
 *
 * 🔴 **REGLA 1 — un "no sé" NO se marca como revisado.** Un fallo de TN no es
 * "todavía no compró". Si `desconocido` estampara `revisadoAt`, una caída de la
 * API de media hora dejaría un lote entero marcado como consultado y no se lo
 * volvería a mirar hasta 12 h después — con la ventana de 7 días corriendo. Es
 * la misma distinción que obliga a `listarCuponesTN` a devolver `null` y no `[]`
 * en los canjes de Resorty.
 *
 * 🔴 **REGLA 2 — un "sigue abierto" SÍ se marca, aunque no cambie nada.** Es la
 * mitad que se olvida. Sin el sello, la consulta del barrido —que ordena por
 * `revisadoAt NULLS FIRST`— vuelve a levantar los mismos 40 carritos en cada
 * corrida y **no avanza nunca**: los carritos 41 en adelante no se consultan
 * jamás. Y de paso es lo único que distingue "lo miramos y no compró" de "nunca
 * lo miramos", que es la diferencia entre informar un 0 y no poder informar.
 *
 * ⚠️ **REGLA 3 — la fecha de compra sale de TN cuando TN todavía la tiene.**
 * `estadoDeCheckout` mapea el 404 a "completado" (un checkout que se convierte
 * en orden desaparece), y ahí no hay objeto del cual leer `completed_at`: `ahora`
 * es una **cota superior**, no el momento de la compra. Por eso ninguna métrica
 * compara esta fecha contra la del envío — la atribución se decide por si hubo
 * envío, no por el orden de dos relojes de los cuales uno es aproximado.
 */
export function decidirCarrito(
  estadoTn: EstadoTn,
  completedAt: Date | null | undefined,
  ahora: Date,
): Escritura | null {
  if (estadoTn === "desconocido") return null;
  if (estadoTn === "abierto") return { revisadoAt: ahora };
  return { estado: "RECUPERADO", completadoAt: completedAt ?? ahora, revisadoAt: ahora };
}

/**
 * Cuántos "no sé" seguidos tolera una cuenta antes de dejarla para la próxima
 * corrida.
 *
 * 🔴 El corte existe porque la Regla 1 sola es una bomba: sin marcar nada, un
 * token vencido convierte cada corrida en 40 llamadas fallidas, cada 15 minutos,
 * para siempre. Con el corte, una cuenta rota cuesta 3 llamadas por corrida.
 * Tres seguidos distinguen el error puntual de la cuenta rota — mismo criterio
 * que los "3 barridos sin aparecer" con que se cierra un cupón en Resorty.
 */
export const TOLERANCIA_FALLOS = 3;

/** ¿Se sigue consultando esta cuenta en esta corrida? */
export function cuentaViva(fallosSeguidos: number): boolean {
  return fallosSeguidos < TOLERANCIA_FALLOS;
}
