// Rellena los bloques `productos-dinamicos` con lo que la tienda vende HOY.
//
// ⚠️ NO es puro: habla con Tiendanube. No lo puede importar el editor — el
// preview del navegador resuelve lo suyo por `/api/productos`.
//
// El bloque guarda una consulta y nunca productos (ver `bloques.ts`), así que
// alguien tiene que resolverla justo antes de mandar. Ese alguien es este
// archivo, y lo llaman los dos caminos de envío que existen: la cola de
// campañas (`procesar.ts`) y el procesador de automations.
//
// El patrón es el mismo que el del `carrito`: se devuelve una **copia** de la
// lista de bloques con los items adentro, y lo que está en la base sigue
// guardando solo la consulta. Nada de esto se persiste.

import { traerProductos } from "@/lib/tn/products";
import { claveProductos, type Bloque, type ConsultaProductos, type ProductoEmail } from "./bloques";

/**
 * Cuánto vale una respuesta de TN antes de volver a preguntar.
 *
 * El número sale de para qué es: durante una campaña de 16.800 mails —una hora
 * de envío— los más vendidos de la tienda no cambian, y si cambian no importa
 * que el destinatario 300 y el 12.000 vean grillas distintas. Diez minutos
 * convierte las ~840 llamadas de una campaña de BDI en unas seis.
 */
const TTL_MS = 10 * 60 * 1000;

interface Entrada {
  vence: number;
  productos: ProductoEmail[];
}

/**
 * Caché de proceso, no de request.
 *
 * Vive a nivel módulo a propósito: las funciones de Vercel reusan el proceso
 * entre invocaciones, y `procesarLote` manda de a 20 destinatarios. Sin esto
 * cada lote sería una llamada más a TN contra un límite que se comparte con el
 * monitor y con Resorty.
 *
 * Que se pierda al reciclarse el proceso no es un problema: lo peor que pasa es
 * una llamada de más.
 */
const cache = new Map<string, Entrada>();

/**
 * La llave del caché: la consulta, con la cuenta adelante.
 *
 * La cuenta va porque la misma consulta contra dos tiendas son dos respuestas
 * distintas — mezclarlas mandaría productos de BDI en un mail de Zattia, que es
 * la clase de bug que este proyecto ya tuvo una vez.
 */
const clave = (cuentaId: string, c: ConsultaProductos): string =>
  `${cuentaId}|${claveProductos(c)}`;

const esDinamico = (b: Bloque): boolean => b.tipo === "productos-dinamicos";

export interface CuentaTN {
  id: string;
  tnStoreId: string | null;
  tnToken: string | null;
}

/**
 * Los productos de cada consulta del mail, listos para `RenderOpts`.
 *
 * Devuelve un mapa `claveProductos(bloque) → productos`, **no** los bloques
 * reescritos. Que los productos no entren nunca al documento es lo que hace
 * imposible guardarlos sin querer: ver el comentario del bloque en `bloques.ts`,
 * donde está el bug que motivó este diseño.
 *
 * Nunca lanza. Si TN no contesta, la consulta queda sin productos y el bloque no
 * se dibuja — el resto del mail sale igual. Frenar una campaña entera porque la
 * API de una tienda está lenta sería el remedio peor que la enfermedad.
 */
export async function resolverProductosDinamicos(
  bloques: Bloque[],
  cuenta: CuentaTN,
): Promise<Record<string, ProductoEmail[]>> {
  // El caso normal es un mail sin ningún bloque dinámico: sale de acá sin tocar
  // el caché ni la red.
  if (!bloques.some(esDinamico)) return {};
  if (!cuenta.tnStoreId || !cuenta.tnToken) return {};

  const ahora = Date.now();
  const consultas = new Map<string, ConsultaProductos>();
  const pedidos = new Map<string, ConsultaProductos>();

  for (const b of bloques) {
    if (b.tipo !== "productos-dinamicos") continue;
    const consulta: ConsultaProductos = { fuente: b.fuente, categoriaId: b.categoriaId, n: b.n };
    // Dos bloques con la misma consulta comparten entrada: una sola llamada.
    consultas.set(claveProductos(consulta), consulta);
    const k = clave(cuenta.id, consulta);
    const hit = cache.get(k);
    if (hit && hit.vence > ahora) continue;
    pedidos.set(k, consulta);
  }

  // Las consultas distintas van en paralelo: son pocas (una o dos por mail) y
  // secuenciarlas le sumaría latencia a cada lote de envío.
  await Promise.all(
    [...pedidos].map(async ([k, consulta]) => {
      const productos = await traerProductos(cuenta.tnStoreId!, cuenta.tnToken!, consulta);
      // El vacío también se cachea: si la tienda no tiene nada en oferta, no
      // tiene sentido preguntárselo a TN una vez por lote durante toda la hora.
      cache.set(k, {
        vence: Date.now() + TTL_MS,
        productos: productos.map((p) => ({
          nombre: p.nombre,
          precio: p.precio,
          precioPromo: p.precioPromo,
          imagen: p.imagen,
          url: p.url,
        })),
      });
    }),
  );

  const out: Record<string, ProductoEmail[]> = {};
  for (const [kRender, consulta] of consultas) {
    out[kRender] = cache.get(clave(cuenta.id, consulta))?.productos ?? [];
  }
  return out;
}

/** Solo para los scripts de prueba: deja el caché como recién arrancado. */
export function vaciarCacheProductos(): void {
  cache.clear();
}
