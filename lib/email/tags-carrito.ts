// Los merge tags del CARRITO: `${cart.url}` y `${cart.producto}`.
//
// ⚠️ Puro: lo usan el procesador de automations, la prueba de «Mandar una
// prueba» y `scripts/ensayo-secuencia.ts`. Con el reemplazo escrito tres veces
// —como estaba el de `${cart.url}` hasta el 29-sep-2026— alcanza con que uno se
// quede viejo para que un tag salga LITERAL en una casilla.
import type { ProductoEmail } from "./bloques";

/**
 * Lo que dice `${cart.producto}`: «Brownie Case», o «Brownie Case y 2 productos
 * más». Sin productos, «lo que elegiste», que se lee bien en cualquier frase
 * que lo use («Vi que dejaste ___ en el carrito»).
 *
 * Nació el 29-sep-2026 para el mail en texto plano de la secuencia de carrito:
 * un mail escrito como por una persona tiene que nombrar lo que la persona dejó.
 *
 * 🔑 Un nombre TODO EN MAYÚSCULAS —así vienen los de BDI desde Tiendanube— se
 * pasa a «Tipo Título»: en un mail de texto plano, «BROWNIE CASE» se lee como un
 * grito, y es justo el mail que tiene que parecer escrito a mano. Uno que ya
 * viene en minúsculas se respeta tal cual: ahí la marca eligió cómo se escribe.
 */
export function nombreDelCarrito(productos: ProductoEmail[] | undefined, restantes = 0): string {
  const lista = productos ?? [];
  if (lista.length === 0) return "lo que elegiste";
  const primero = legible(lista[0].nombre);
  const otros = lista.length - 1 + Math.max(0, restantes);
  return otros > 0 ? `${primero} y ${otros} producto${otros === 1 ? "" : "s"} más` : primero;
}

const legible = (nombre: string): string => {
  const n = nombre.trim();
  if (n !== n.toUpperCase() || n === n.toLowerCase()) return n;
  return n.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase());
};

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Resuelve los dos tags del carrito sobre un HTML, un text/plain o un asunto.
 *
 * 🔴 `formato` es obligatorio: en el HTML el nombre del producto va ESCAPADO
 * —viene de Tiendanube y lo escribe el comerciante— y en el texto y el asunto va
 * crudo, o saldría un `&amp;` en la casilla.
 */
export function resolverTagsCarrito(
  s: string,
  c: { url: string; productos?: ProductoEmail[]; restantes?: number },
  formato: "html" | "texto",
): string {
  const producto = nombreDelCarrito(c.productos, c.restantes);
  return s
    .replaceAll("${cart.url}", c.url)
    .replaceAll("${cart.producto}", formato === "html" ? escHtml(producto) : producto);
}
