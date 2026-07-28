import { autorizarApi } from "@/lib/auth";
import { buscarProductos } from "@/lib/tn/products";

// Búsqueda de productos TN para el bloque Producto del editor.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";

  // Antes usaba getCuentaActiva(), que LANZA sin sesión: devolvía un 500 donde
  // corresponde un 401. Además el editor consume esto por fetch, así que la
  // respuesta tiene que ser JSON y no un redirect.
  const auth = await autorizarApi("ver");
  if (auth instanceof Response) return auth;
  const { cuenta } = auth;

  if (!cuenta.tnStoreId || !cuenta.tnToken) {
    return Response.json({ productos: [], error: "TN no conectada" }, { status: 400 });
  }
  try {
    const productos = await buscarProductos(cuenta.tnStoreId, cuenta.tnToken, q);
    return Response.json({ productos });
  } catch (e) {
    return Response.json({ productos: [], error: (e as Error).message }, { status: 500 });
  }
}
