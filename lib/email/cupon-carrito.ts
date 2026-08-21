// El cupón del ÚLTIMO mail de la secuencia de carrito abandonado.
//
// ⚠️ Puro: sin prisma, sin red. La llamada a Resorty —que es quien acuña el
// cupón en Tiendanube— la hace el procesador; acá sólo se decide qué pasa con
// el bloque `cupon` una vez que la respuesta llegó.
//
// Es el hermano de `cupon-trigger.ts` (el de la bienvenida de pop-up) y comparte
// su criterio de fondo, que es el que importa: **un bloque `cupon` que no tiene
// un código real detrás se ELIMINA**. Dejar el placeholder del preset
// —`CARRITO10`— es mandarle a un cliente un código que el checkout de Tiendanube
// rechaza: lo tipea, no anda, y el mail queda peor que si no hubiera traído
// premio.
import type { Bloque } from "./bloques";

/** Lo que devuelve `POST /api/carrito/cupon` de Resorty cuando pudo emitirlo. */
export interface CuponEmitido {
  codigo: string;
  /** Puntos de %. Es lo que el mail anuncia. */
  valor: number;
  vence?: string | null;
  /** La compra mínima del cupón, para la letra chica. 0 = sin mínimo. */
  minCompra?: number;
}

/**
 * ¿Este mail pide cupón?
 *
 * 🔑 **Se pregunta ANTES de llamar a Resorty**, y por eso es una función y no un
 * `if` adentro del procesador: acuñar un cupón en la tienda de alguien para un
 * mail que no lo va a mostrar es emitir descuento a la basura, y encima cuesta
 * una llamada a la API de TN por run. Los dos primeros mails de la secuencia no
 * declaran el bloque y no tienen que pagar nada de esto.
 */
export function pideCupon(bloques: Bloque[]): boolean {
  return bloques.some((b) => b.tipo === "cupon");
}

/**
 * La letra chica del premio, armada con lo que el cupón REALMENTE tiene.
 *
 * 🔴 **«No se acumula con otros cupones» no es un formalismo.** El escalado
 * existe justamente para quien ya ganó uno en la ruleta, y el checkout de
 * Tiendanube toma **UNO por orden**: sin esta línea, la persona llega esperando
 * sumar los dos, no puede, y la culpa se la lleva la marca. El mail no puede
 * prometer lo que el checkout desmiente.
 */
export function condicionesDe(c: CuponEmitido): string {
  const minCompra = c.minCompra ?? 0;
  const partes: string[] = [];
  if (c.vence) {
    const d = new Date(c.vence);
    if (!isNaN(d.getTime())) {
      // Día y mes locales, que es como lo lee quien lo recibe. Sin año: un cupón
      // de 7 días nunca cruza a un año que haga falta aclarar.
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      partes.push(`Válido hasta el ${dd}/${mm}`);
    }
  }
  if (minCompra > 0) partes.push(`Compra mínima $${minCompra.toLocaleString("es-AR")}`);
  partes.push("No se acumula con otros cupones");
  return partes.join(" · ");
}

/**
 * Devuelve los bloques con el bloque `cupon` resuelto contra lo que emitió
 * Resorty. `cupon = null` es "no hubo": se elimina el bloque.
 *
 * Los cuatro caminos por los que `cupon` llega en `null`, todos legítimos y
 * ninguno un error que haya que gritar:
 *  - el comerciante tiene la emisión APAGADA (es el default);
 *  - la tienda no está conectada;
 *  - **el escalado no mejora lo que la persona ya tiene** — ofrecerle como
 *    novedad el cupón que ya está en su casilla es peor que no ofrecer nada;
 *  - Tiendanube falló al acuñarlo.
 *
 * El `texto` del autor se conserva y las condiciones se AGREGAN, igual que en
 * `aplicarCuponDelTrigger`: son la letra chica del premio, no su descripción. Lo
 * que sí se pisa es el porcentaje, porque el valor lo decide el escalado y el
 * texto del preset ("10% OFF") puede no tener nada que ver con lo que se emitió.
 */
export function aplicarCuponDeCarrito(bloques: Bloque[], cupon: CuponEmitido | null): Bloque[] {
  if (!cupon) return bloques.filter((b) => b.tipo !== "cupon");
  return bloques.map((b) => {
    if (b.tipo !== "cupon") return b;
    return {
      ...b,
      codigo: cupon.codigo,
      texto: `${cupon.valor}% OFF · ${condicionesDe(cupon)}`,
    };
  });
}
