import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { buscarProductos } from "@/lib/tn/products";

// Búsqueda de productos TN para el bloque Producto del editor.
// Bajo /api/productos → requiere Basic Auth (no está en las rutas públicas del proxy).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const cuenta = await getCuentaActiva();
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
