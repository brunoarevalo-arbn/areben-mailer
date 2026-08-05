import { autorizarApi } from "@/lib/auth";
import { buscarProductos, traerProductos } from "@/lib/tn/products";
import { esDeLaTienda, linksRotos } from "@/lib/email/links-productos";
import { marcaDe } from "@/lib/marca";
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
  const revisar = sp.get("revisar");

  // Antes usaba getCuentaActiva(), que LANZA sin sesión: devolvía un 500 donde
  // corresponde un 401. Además el editor consume esto por fetch, así que la
  // respuesta tiene que ser JSON y no un redirect.
  const auth = await autorizarApi("ver");
  if (auth instanceof Response) return auth;
  const { cuenta } = auth;

  // `?revisar=url1,url2` → cuáles de esas fichas dan 404 (o sea, están sin
  // publicar, borradas o renombradas). Es el MISMO chequeo que frena el envío en
  // `procesarLote`, para que el editor lo avise antes y no se descubra con la
  // campaña encolada.
  //
  // 🔴 Va detrás del filtro `esDeLaTienda`: sin él, esto es un SSRF de manual —
  // cualquiera con sesión haría que el servidor visite la URL que quiera. El
  // único destino legítimo es la tienda de la cuenta.
  if (revisar) {
    const urls = revisar
      .split(",")
      .map((u) => u.trim())
      .filter((u) => esDeLaTienda(u, marcaDe(cuenta, process.env.APP_URL ?? "").urlCuenta))
      .slice(0, 12);
    return Response.json({ rotos: urls.length ? await linksRotos(urls) : [] });
  }

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
