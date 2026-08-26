/**
 * Los productos de una orden pagada de Tiendanube, listos para el bloque
 * `carrito`.
 *
 * 🔑 Vive en `lib/` y no adentro del webhook porque tiene DOS llamadores: el
 * webhook de `order/paid`, que arma el `triggerData` del run, y
 * `scripts/ensayo-secuencia.ts`, que renderiza el mail de reseña con un pedido
 * real para poder LEERLO. Escribirla dos veces es garantizar que se porten
 * distinto — la misma razón por la que `lib/contactos/importar.ts` no vive
 * adentro de su script.
 *
 * 🔴 Y no es un detalle de prolijidad: la primera versión del ensayo usó un
 * CHECKOUT como si fuera un pedido, y el mail de reseña salió con **cero
 * estrellas** — un checkout no trae `product_id` y un pedido sí. El único mail
 * cuya razón de existir son las estrellas se renderizaba mudo, en verde.
 */
import { tnGet } from "./client";

/**
 * Cuántos productos del carrito entran en el mail.
 *
 * Medido contra los checkouts reales de BDI: de 30 carritos, uno solo pasa de 4
 * productos y el más grande tiene 8. Con 6 entra casi todo, y lo que se recorta
 * se avisa con "y N más" en vez de desaparecer.
 */
export const TOPE_CARRITO = 6;

export interface ProductoDeTn {
  product_id?: number | string;
  name?: string;
  name_without_variants?: string | null;
  price?: string;
  compare_at_price?: string;
  image?: string | { src?: string };
  quantity?: number;
  variant_values?: string[];
}

/**
 * Los productos de una orden, con el link a su ficha, listos para el bloque
 * `carrito`.
 *
 * 🔴 **La ficha se pide producto por producto** (`GET /products/{id}`), y no con
 * un `ids=1,2,3`: ese filtro no está verificado contra la API real, y si TN lo
 * ignorara devolvería la primera página del catálogo — de la que los productos
 * que buscamos podrían faltar, dejando links caídos **sin un solo error**. Un
 * `GET` de un recurso por id es la forma que este archivo ya usa tres veces.
 * Son como mucho `TOPE_CARRITO` llamadas, una vez por orden pagada.
 *
 * ⚠️ **Un producto sin ficha se cae del mail, no sale sin link.** El bloque
 * `carrito` dibuja cada línea como un ancla; una con `#` es una promesa rota en
 * una casilla. Y si se caen todos, el bloque desaparece solo (lo hace el
 * renderer) y el mail sale igual con su texto y su botón: nunca se frena por
 * esto.
 *
 * ⚠️ Y por lo mismo devuelve `[]` ante cualquier fallo de TN en vez de tirar: el
 * webhook está creando el run de una automation, y perder el run entero porque
 * no se pudo resolver una URL sería cambiar un mail incompleto por ninguno.
 */
export async function productosDeOrden(
  todos: ProductoDeTn[],
  storeId: string,
  token: string,
): Promise<object[]> {
  const elegidos = todos.slice(0, TOPE_CARRITO);
  const salida: object[] = [];
  for (const p of elegidos) {
    if (p.product_id == null) continue;
    let url = "";
    try {
      const { data } = await tnGet<{ canonical_url?: string }>(
        storeId, token, `products/${p.product_id}`,
      );
      url = data.canonical_url ?? "";
    } catch {
      continue;
    }
    if (!url) continue;
    salida.push({
      // 🔑 El id, que es lo que necesitan las ESTRELLAS: cada una es un link
      // firmado que dice de qué producto se opina. La URL no sirve para eso —es
      // pública y cualquiera la escribe—, y sin el id el token no se puede
      // armar. Ver `lib/resena-token.ts`.
      productoId: String(p.product_id),
      // Mismo criterio que el carrito: `name` viene con la variante pegada y la
      // variante va en su propio renglón. `name_without_variants` es **null** en
      // los productos sin variantes, de ahí el fallback.
      nombre: p.name_without_variants || p.name || "",
      variante: p.variant_values?.length ? p.variant_values.join(" · ") : undefined,
      cantidad: typeof p.quantity === "number" ? p.quantity : undefined,
      precio: p.compare_at_price && p.compare_at_price !== p.price ? p.compare_at_price : p.price ?? "",
      precioPromo: p.compare_at_price && p.compare_at_price !== p.price ? p.price : undefined,
      imagen: typeof p.image === "string" ? p.image : p.image?.src ?? "",
      // 🔑 `?resena=1` es lo que hace que la ficha abra el formulario de
      // opiniones y lo traiga a la vista (lo lee `montarResenas` en el widget de
      // Resorty). Sin eso, el mail deja a la persona en una página larga donde
      // el botón de opinar está abajo de todo: se pide la reseña y no se dice
      // dónde.
      // ⚠️ Con `&` si la URL de TN ya trae query. Hoy `canonical_url` no trae,
      // pero armar links pegando "?" a ciegas es cómo se rompe uno el día que sí.
      url: url + (url.includes("?") ? "&" : "?") + "resena=1",
    });
  }
  return salida;
}