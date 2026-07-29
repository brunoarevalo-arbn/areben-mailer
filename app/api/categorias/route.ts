import { autorizarApi } from "@/lib/auth";
import { listarCategorias } from "@/lib/tn/products";

/**
 * Las categorías de la tienda, para el selector del bloque de productos
 * automáticos.
 *
 * Es de solo lectura y pide el permiso más bajo (`ver`), igual que
 * `/api/productos`: quien puede mirar una campaña puede ver de qué categorías
 * habla. `autorizarApi` también es lo que ata la respuesta a la marca activa —
 * sin eso, un usuario de Zattia vería el árbol de categorías de BDI.
 */
export async function GET() {
  const auth = await autorizarApi("ver");
  if (auth instanceof Response) return auth;
  const { cuenta } = auth;

  if (!cuenta.tnStoreId || !cuenta.tnToken) {
    return Response.json({ categorias: [], error: "TN no conectada" }, { status: 400 });
  }
  try {
    return Response.json({ categorias: await listarCategorias(cuenta.tnStoreId, cuenta.tnToken) });
  } catch (e) {
    return Response.json({ categorias: [], error: (e as Error).message }, { status: 500 });
  }
}
