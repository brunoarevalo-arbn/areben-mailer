export type Trigger = "NUEVO_CLIENTE" | "COMPRA" | "CARRITO_ABANDONADO";

export interface Preset {
  nombre: string;
  esperaHoras: number;
  asunto: string;
  bloques: object[];
}

/**
 * Contenido inicial de una automation, escrito con el nombre y el sitio de la
 * marca que la crea.
 *
 * Antes esto era una constante con "BDI Accesorios" adentro, así que la
 * Bienvenida de Zattia salía saludando en nombre de otra tienda. Los presets
 * los ve el cliente final: la marca no puede estar cableada.
 *
 * `urlTienda` puede venir vacía (cuenta sin remitente ni config todavía): en ese
 * caso se omite el botón en lugar de mandar a un link roto.
 */
export function presetsPara(nombreMarca: string, urlTienda: string): Record<Trigger, Preset> {
  const botonTienda = urlTienda
    ? [{ tipo: "boton", texto: "Ver la tienda", url: urlTienda }]
    : [];

  return {
    NUEVO_CLIENTE: {
      nombre: "Bienvenida",
      esperaHoras: 0,
      asunto: `¡Bienvenido/a a ${nombreMarca}! 🎉`,
      bloques: [
        { tipo: "titulo", texto: "¡Hola ${contacto.nombre}! 👋" },
        { tipo: "texto", texto: "Gracias por sumarte. Descubrí nuestros productos y encontrá lo que buscás." },
        ...botonTienda,
      ],
    },
    COMPRA: {
      nombre: "Gracias por tu compra",
      esperaHoras: 1,
      asunto: "¡Gracias por tu compra! 🛍️",
      bloques: [
        { tipo: "titulo", texto: "¡Gracias ${contacto.nombre}!" },
        { tipo: "texto", texto: "Ya estamos preparando tu pedido. Cualquier duda, escribinos." },
      ],
    },
    CARRITO_ABANDONADO: {
      nombre: "Carrito abandonado",
      esperaHoras: 3,
      asunto: "¿Te olvidaste de algo? 🛒",
      bloques: [
        { tipo: "titulo", texto: "Todavía estás a tiempo, ${contacto.nombre}" },
        { tipo: "texto", texto: "Dejaste esto en tu carrito. Completá tu compra antes de que se agote." },
        // ${cart.url} lo reemplaza el procesador con el link real del checkout.
        { tipo: "boton", texto: "Completar mi compra", url: "${cart.url}" },
      ],
    },
  };
}

/**
 * Sitio público de la marca, para los links de los presets. Sale de
 * `config.url` si está cargada y, si no, del dominio del remitente — que para
 * las tres marcas coincide con el de la tienda.
 */
export function urlTiendaDe(
  cuenta: { config: unknown },
  remitenteEmail?: string | null,
): string {
  const config = (cuenta.config as Record<string, unknown>) ?? {};
  const url = typeof config.url === "string" ? config.url.trim() : "";
  if (url) return url.replace(/\/+$/, "");

  const dominio = remitenteEmail?.split("@")[1]?.trim().toLowerCase();
  return dominio ? `https://${dominio}` : "";
}
