import type { Bloque } from "./email/bloques";
import { leerConfigCuenta } from "./marca";

export type Trigger = "NUEVO_CLIENTE" | "COMPRA" | "CARRITO_ABANDONADO";

export interface Preset {
  nombre: string;
  esperaHoras: number;
  asunto: string;
  /**
   * Tipado contra `Bloque`, no `object[]`.
   *
   * Con `object[]` un `tipo` mal escrito compilaba igual y el bloque
   * simplemente no se dibujaba — sin error, sin aviso, en una automation que
   * ya le estaba llegando a gente.
   */
  bloques: Bloque[];
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
  const botonTienda: Bloque[] = urlTienda
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
        // El carrito real va ACÁ, entre el texto que lo anuncia y el botón. Sin
        // este bloque el procesador lo appendearía al final, después del botón:
        // "dejaste esto" seguido de nada, y los productos abajo del CTA.
        { tipo: "carrito", items: [] },
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
  // `config.url` la trae Tiendanube sola en el callback del OAuth (y el botón
  // "traer de mi tienda" de /remitentes para las cuentas ya conectadas).
  const url = leerConfigCuenta(cuenta.config).url;
  if (url) return url;

  const dominio = remitenteEmail?.split("@")[1]?.trim().toLowerCase();
  return dominio ? `https://${dominio}` : "";
}
