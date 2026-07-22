import { tnGet } from "./client";

export interface ProductoTN {
  id: string;
  nombre: string;
  precio: string;
  precioPromo?: string;
  imagen: string;
  url: string;
}

interface TnProductRaw {
  id: number;
  name?: Record<string, string> | string;
  canonical_url?: string;
  has_stock?: boolean;
  images?: { src: string }[];
  variants?: { price?: string; promotional_price?: string | null }[];
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
  };
}

/** Busca productos publicados en la tienda TN (para el bloque Producto). */
export async function buscarProductos(
  storeId: string,
  token: string,
  q: string,
): Promise<ProductoTN[]> {
  const params: Record<string, string | number> = { per_page: 20, published: "true" };
  if (q) params.q = q;
  const { data } = await tnGet<TnProductRaw[]>(storeId, token, "products", params);
  return (Array.isArray(data) ? data : []).map(normalizar).filter((p) => p.imagen);
}
