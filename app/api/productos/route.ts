import { autorizarApi } from "@/lib/auth";
import { buscarProductos, traerProductos } from "@/lib/tn/products";
import type { FuenteProductos } from "@/lib/email/bloques";

const FUENTES: readonly string[] = ["destacados", "recientes", "oferta", "categoria"];

/**
 * Productos de la tienda para el editor. Sirve a los dos bloques:
 *
 * - `?q=…`            → búsqueda por texto, para elegir a mano (bloque `productos`)
 * - `?fuente=…&n=…`   → la MISMA consulta que resuelve el envío (bloque dinámico)
 *
 * Que el preview del bloque dinámico pase por acá y no por una lista de ejemplo
 * es lo que hace que lo que se ve armando el mail sea lo que va a salir. La
 * diferencia con el envío es solo cuándo se pregunta, no qué se pregunta.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q") ?? "";
  const fuente = sp.get("fuente");

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
    if (fuente) {
      if (!FUENTES.includes(fuente)) {
        return Response.json({ productos: [], error: "fuente desconocida" }, { status: 400 });
      }
      const productos = await traerProductos(cuenta.tnStoreId, cuenta.tnToken, {
        fuente: fuente as FuenteProductos,
        categoriaId: sp.get("categoriaId") ?? undefined,
        n: Number(sp.get("n")) || undefined,
      });
      return Response.json({ productos });
    }
    const productos = await buscarProductos(cuenta.tnStoreId, cuenta.tnToken, q);
    return Response.json({ productos });
  } catch (e) {
    return Response.json({ productos: [], error: (e as Error).message }, { status: 500 });
  }
}
