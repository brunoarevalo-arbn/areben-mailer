// Lo que le falta a un mail de PRUEBA para parecerse al que va a salir.
//
// 🔴 **POR QUÉ EXISTE.** «Mandar una prueba» renderizaba el documento **tal como
// está guardado**, sin nada de lo que pone el procesador al enviar. Con eso, el
// 21-ago-2026 se midió que:
//
//  - el mail de **pedido de reseña** llegaba **sin el bloque `carrito`** —o sea
//    sin los productos y sin las estrellas, que son su único contenido concreto—
//    porque un `carrito` sin items no se dibuja;
//  - el de **carrito abandonado** llegaba con **`${cart.url}` literal en el
//    `href` del botón**: la prueba tenía un botón que no lleva a ningún lado.
//
// Los dos son el mismo error: **la prueba juzgaba un mail que nadie va a
// recibir.** Y es peor que un bug cosmético, porque «mandar una prueba» es el
// ÚNICO camino para mirar el correo en Gmail y en Outlook de verdad — si ahí no
// se ven las estrellas, no hay forma de saber si funcionan hasta que le llegue a
// un cliente.
//
// ⚠️ Puro: sin prisma, sin red. Lo que sí necesita firma vive afuera.
import type { Bloque, ProductoEmail } from "./bloques";
import { CARRITO_MUESTRA } from "./render";

/**
 * Mete los productos en el bloque `carrito`, o lo appendea si no está declarado.
 *
 * 🔑 **Es el mismo criterio que el procesador**, a propósito: si la prueba
 * ubicara el carrito en otro lugar que el envío real, estaría mintiendo sobre lo
 * único que se le pide (mostrar cómo va a quedar). Las automations viejas no
 * declaran el bloque y en las dos puertas se appendea igual.
 */
export function conCarrito(bloques: Bloque[], items: ProductoEmail[]): Bloque[] {
  if (!items.length) return bloques;
  if (bloques.some((b) => b.tipo === "carrito")) {
    return bloques.map((b) => (b.tipo === "carrito" ? { ...b, items, restantes: 0 } : b));
  }
  return [...bloques, { tipo: "carrito", items, restantes: 0 }];
}

/**
 * La muestra, con todos sus links apuntando a algún lado de verdad.
 *
 * `urlEstrella` sólo se pasa para el pedido de reseña; sin él la muestra sale
 * como la línea de carrito de siempre.
 *
 * 🔴 **Las estrellas de la prueba son links REALES, no `#`.** Un `#` en una
 * casilla es un link que no lleva a ningún lado —lo mismo que este repo se niega
 * a mandar en cualquier otro bloque—, y además impide comprobar la mitad de la
 * cadena justo en el único momento en que se la puede mirar. `urlEstrella`
 * devuelve `null` si no se puede firmar (falta `RESENA_SECRET`), y entonces esa
 * línea sale **sin** estrellas: nunca con cinco links rotos.
 */
export function muestraDePrueba(
  urlTienda: string,
  urlEstrella?: (productoId: string, producto: string, rating: number) => string | null,
): ProductoEmail[] {
  return CARRITO_MUESTRA.map((p, i) => {
    // 🔴 **La línea del producto también deja de apuntar a `"#"`.** La muestra
    // trae `url: '#'` porque en el preview del editor nada es clickeable (el
    // iframe va con `pointer-events:none`), pero en una casilla eso es un link
    // muerto — el mismo defecto que las estrellas, un renglón más arriba. Sin
    // ficha real que ofrecer, el destino honesto es la tienda.
    const base = { ...p, url: urlTienda };
    if (!urlEstrella) return base;
    // Un id estable por posición: lo que se prueba es el dibujo y el link, no a
    // qué producto apunta.
    const productoId = `PRUEBA-P${i + 1}`;
    const urls = [1, 2, 3, 4, 5].map((r) => urlEstrella(productoId, p.nombre, r));
    return urls.every((u): u is string => !!u)
      ? { ...base, productoId, estrellas: urls }
      : { ...base, productoId, estrellas: undefined };
  });
}

/**
 * El destino de `${cart.url}` en una prueba.
 *
 * Mismo orden que el procesador —el carrito abandonado si lo hay, si no la
 * tienda, y `#` como último recurso—, salvo que acá no hay carrito: la prueba
 * lleva a la tienda, que es el destino que un botón «volver al carrito» tiene
 * cuando el carrito no existe.
 */
export const urlVueltaDePrueba = (urlCuenta: string | undefined) => urlCuenta || "#";
