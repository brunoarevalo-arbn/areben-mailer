// Las reglas de la SECUENCIA de bienvenida (11-oct-2026), puras: sin base ni red.
// Las aplica `lib/email/secuencia.ts` y las prueba `scripts/probar-secuencia-bienvenida.ts`.
//
// La secuencia son cinco automations `NUEVO_SUSCRIPTOR` (D0 · D1 · D2 · D4 · D6, ver
// `docs/disenio/bienvenida-bdi/LEEME.md`). El 1º es el del código y sale al instante;
// los otros cuatro son «los que siguen», y a ésos —y sólo a ésos— les tocan tres reglas:
//  1. salen a hora fija (`cuandoSale` en `lib/automations.ts`),
//  2. se cortan si la persona ya compró (`yaCompro`),
//  3. no le llegan al grupo de control (`grupoDeContacto`).
import type { Trigger } from "./automations";

/**
 * ¿Es uno de los mails que SIGUEN al primero de la bienvenida?
 *
 * 🔑 Se decide por la espera, no por un número de paso: no hay concepto de paso en
 * la base (mismo criterio que el cupón del carrito, que pregunta «¿este mail declara
 * el bloque?» y no «¿es el 3º?»). El 1º sale al instante (espera 0) y es el único que
 * le llega a todos: lleva el código que la persona acaba de ganar en el pop-up, y
 * negárselo al grupo de control sería romperle una promesa, no medir.
 *
 * ⚠️ La bienvenida de un solo mail de hoy (`cms6kpmqg…`, espera 0) NO es «de las que
 * siguen» ⇒ ninguna de las tres reglas la toca.
 */
export const esMailQueSigue = (trigger: Trigger, esperaHoras: number): boolean =>
  trigger === "NUEVO_SUSCRIPTOR" && esperaHoras > 0;

/** Una orden de TN, reducida a lo que el corte necesita. */
export interface Compra {
  email: string;
  /** Los códigos de cupón que usó, en mayúsculas. */
  cupones: string[];
  pagada: boolean;
  cancelada: boolean;
  creada: Date;
}

export type MotivoCorte = "canjeo" | "compro";

/** Los motivos por los que un mail de automation NO sale aunque le toque. */
// `retirado`/`cancelado`: los avisos de retiro en el local (ver `lib/tn/retiro.ts`).
export type MotivoNoSale = MotivoCorte | "control" | "vencido" | "sin-cupon" | "retirado" | "cancelado";

/**
 * ¿Esta persona ya compró desde que se anotó? Devuelve POR QUÉ, o `null`.
 *
 * Dos caminos, y cualquiera alcanza:
 *  - **canjeó el cupón del pop-up**: hay una orden no cancelada con ESE código. No hace
 *    falta que esté pagada: quien llegó a usar el código en el checkout ya respondió a
 *    la secuencia, y seguir mandándole «tu código vence mañana» es mentirle. Tampoco
 *    se mira el mail de la orden: el código es de esta persona.
 *  - **compró sin el cupón**: una orden PAGADA con su mail, creada desde el alta.
 *
 * ⚠️ Desde el ALTA, no desde siempre: un cliente viejo que se anota al pop-up recibe
 * la secuencia igual — lo que se corta es al que la secuencia ya convirtió.
 *
 * 🔴 Con `compras === null` (TN no contestó) devuelve `null` y el mail SALE. Mismo
 * criterio que el carrito con `estadoDeCheckout`: para un mail es tolerable, y frenar
 * la secuencia de todos por un 500 de TN no lo es.
 */
export function yaCompro(
  compras: Compra[] | null,
  email: string,
  alta: Date,
  cupon: string | null | undefined,
): MotivoCorte | null {
  if (!compras) return null;
  const codigo = cupon?.trim().toUpperCase();
  if (codigo && compras.some((c) => !c.cancelada && c.cupones.includes(codigo))) return "canjeo";
  const mail = email.trim().toLowerCase();
  if (
    mail &&
    compras.some((c) => c.pagada && !c.cancelada && c.email === mail && c.creada.getTime() >= alta.getTime())
  )
    return "compro";
  return null;
}

/**
 * El mail ya no puede salir: su `saleHasta` (día de Argentina, inclusive) quedó
 * atrás. Comparar strings `AAAA-MM-DD` es comparar fechas.
 *
 * 🔑 Se pregunta por el día de HOY en Argentina, no por el instante: «hasta el
 * 31/10» incluye el 31 entero, y en UTC el 31 a las 21 h ya es 1/11.
 */
export const mailVencido = (saleHasta: string | undefined, hoyLocal: string): boolean =>
  !!saleHasta && hoyLocal > saleHasta;

/**
 * ¿El mail perdió un cupón que no podía perder? `antes` son los bloques del
 * documento, `despues` los mismos con el cupón del run ya aplicado
 * (`aplicarCuponDelTrigger` BORRA el bloque cuando el lead no trae código).
 *
 * Sin el bloque, «tu código vence mañana» es un mail sin código: se salta.
 */
export function faltaCuponObligatorio(
  antes: { tipo: string; obligatorio?: boolean }[],
  despues: { tipo: string; codigo?: string }[],
): boolean {
  if (!antes.some((b) => b.tipo === "cupon" && b.obligatorio)) return false;
  return !despues.some((b) => b.tipo === "cupon" && !!b.codigo?.trim());
}
