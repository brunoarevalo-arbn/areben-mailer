import { tnGet } from "./client";
// Solo el TIPO: `bloques.ts` es puro y se bundlea al navegador, así que la
// flecha va en este sentido y nunca al revés. Un `import type` se borra al
// compilar, así que esto no arrastra nada de TN al bundle del editor.
import type { ConsultaProductos, FuenteProductos } from "@/lib/email/bloques";

export interface ProductoTN {
  id: string;
  nombre: string;
  precio: string;
  precioPromo?: string;
  imagen: string;
  url: string;
  /**
   * No está publicado en la tienda (5-ago-2026). Sólo lo devuelve el BUSCADOR;
   * el bloque no lo guarda.
   *
   * 🔑 Es un dato de la tienda de HOY, no del mail: guardarlo adentro del Json
   * lo dejaría mintiendo el día que el producto se publica. Lo que el mail sí
   * guarda es la URL, y de esa se vuelve a preguntar cuando hace falta.
   */
  oculto?: boolean;
}

interface TnVariantRaw {
  price?: string;
  promotional_price?: string | null;
  /**
   * Unidades. **`null` = ilimitado**, no "cero": es lo que devuelve TN cuando la
   * variante tiene el control de stock apagado. Tratarlo como 0 dejaría fuera del
   * mail a media tienda.
   */
  stock?: number | null;
}

interface TnProductRaw {
  id: number;
  name?: Record<string, string> | string;
  canonical_url?: string;
  has_stock?: boolean;
  published?: boolean;
  images?: { src: string }[];
  variants?: TnVariantRaw[];
}

function nombreDe(name: TnProductRaw["name"]): string {
  if (!name) return "";
  if (typeof name === "string") return name;
  return name.es ?? Object.values(name)[0] ?? "";
}

function normalizar(p: TnProductRaw): ProductoTN {
  const v = p.variants?.[0];
  return {
    id: p.id.toString(),
    nombre: nombreDe(p.name),
    precio: v?.price ?? "",
    precioPromo: v?.promotional_price ?? undefined,
    imagen: p.images?.[0]?.src ?? "",
    url: p.canonical_url ?? "#",
    // `undefined` y no `false`: es la convención del motor —ausente = lo normal—
    // y además así no se escribe una clave de más en cada item que se guarda.
    ...(p.published === false ? { oculto: true } : {}),
  };
}

/**
 * ¿Se puede comprar?
 *
 * Un mail que promociona algo agotado es peor que no mandar el mail: el click
 * llega a una ficha sin botón de compra y la próxima campaña se abre menos. Se
 * mira variante por variante porque un producto con seis talles y uno solo
 * disponible **sí** se puede vender.
 */
function hayStock(p: TnProductRaw): boolean {
  const vs = p.variants ?? [];
  if (!vs.length) return p.has_stock !== false;
  return vs.some((v) => v.stock == null || v.stock > 0);
}

const enOferta = (p: TnProductRaw): boolean =>
  (p.variants ?? []).some((v) => Number(v.promotional_price) > 0);

/**
 * Busca productos de la tienda TN, para elegir a mano (bloque `productos`).
 *
 * 🔑 **Los ocultos entran, marcados** (5-ago-2026). Hasta ese día iba
 * `published: "true"` y quedaban afuera en silencio, que es lo correcto para un
 * mail que sale hoy y lo incorrecto para el caso que existe de verdad: la
 * **preventa**. El mail se arma con el producto todavía oculto y se publica el
 * día del lanzamiento.
 *
 * ⚠️ Medido el 5-ago contra las cuatro tiendas: la ficha de un producto oculto
 * devuelve **404**, no una página sin botón de compra. Por eso el `oculto` no es
 * decorativo — es lo que sostiene el aviso del editor y el freno de
 * `procesarLote`, que es donde se comprueba de nuevo, en el único momento que
 * importa: cuando el mail está por salir.
 *
 * ⚠️ Sin foto sigue sin entrar: la grilla es de tarjetas con imagen y una sin
 * imagen deja un agujero blanco al lado de las que sí la tienen. Es el otro
 * motivo por el que un producto "no aparece" en el buscador.
 */
export async function buscarProductos(
  storeId: string,
  token: string,
  q: string,
): Promise<ProductoTN[]> {
  const params: Record<string, string | number> = { per_page: 20 };
  if (q) params.q = q;
  const { data } = await tnGet<TnProductRaw[]>(storeId, token, "products", params);
  return (Array.isArray(data) ? data : []).map(normalizar).filter((p) => p.imagen);
}

/**
 * Cómo ordena TN cada fuente.
 *
 * `oferta` no tiene orden propio ni filtro en la API: TN no sabe responder
 * "dame lo que está rebajado", así que se pide una página grande del orden de la
 * tienda y se filtra acá por `promotional_price`. Es la única fuente que puede
 * volver corta aunque la tienda tenga productos.
 */
const ORDEN: Record<FuenteProductos, string | undefined> = {
  destacados: "best-selling",
  recientes: "created-at-descending",
  categoria: "user",
  oferta: undefined,
};

/** Cuántos pedirle a TN para que, después de filtrar, queden los que se piden. */
const A_PEDIR: Record<FuenteProductos, number> = {
  destacados: 24,
  recientes: 24,
  categoria: 24,
  oferta: 50,
};

/**
 * Resuelve una consulta contra la tienda: la única función que traduce
 * "los más vendidos" a parámetros de la API de TN.
 *
 * Devuelve **lista vacía y no lanza** ante cualquier problema. Es a propósito:
 * el llamador de arriba está por mandar una campaña de 16.800 mails y que TN
 * esté caído no puede frenarla — el bloque simplemente no se dibuja.
 */
export async function traerProductos(
  storeId: string,
  token: string,
  consulta: ConsultaProductos,
): Promise<ProductoTN[]> {
  const n = Math.min(6, Math.max(2, Math.round(consulta.n ?? 4)));
  const fuente = consulta.fuente;

  const params: Record<string, string | number> = {
    published: "true",
    per_page: A_PEDIR[fuente],
  };
  const orden = ORDEN[fuente];
  if (orden) params.sort_by = orden;
  if (fuente === "categoria") {
    // Sin categoría elegida no se cae al catálogo entero: mandar "lo que sea"
    // donde el autor pidió "ropa de bebé" es peor que no mandar el bloque.
    if (!consulta.categoriaId) return [];
    params.category_id = consulta.categoriaId;
  }

  let crudos: TnProductRaw[];
  try {
    const { data } = await tnGet<TnProductRaw[]>(storeId, token, "products", params);
    crudos = Array.isArray(data) ? data : [];
  } catch (e) {
    console.log(JSON.stringify({ ev: "productos-dinamicos-error", fuente, error: (e as Error).message }));
    return [];
  }

  return crudos
    .filter(hayStock)
    .filter((p) => (fuente === "oferta" ? enOferta(p) : true))
    .map(normalizar)
    // Sin foto no entra: la grilla es de tarjetas con imagen y una tarjeta sin
    // imagen deja un agujero blanco al lado de las que sí la tienen.
    .filter((p) => p.imagen)
    .slice(0, n);
}

export interface CategoriaTN {
  id: string;
  nombre: string;
}

interface TnCategoryRaw {
  id: number;
  name?: Record<string, string> | string;
}

/** Las categorías de la tienda, para el selector del bloque dinámico. */
export async function listarCategorias(storeId: string, token: string): Promise<CategoriaTN[]> {
  const { data } = await tnGet<TnCategoryRaw[]>(storeId, token, "categories", { per_page: 200 });
  return (Array.isArray(data) ? data : [])
    .map((c) => ({ id: c.id.toString(), nombre: nombreDe(c.name) }))
    .filter((c) => c.nombre);
}
