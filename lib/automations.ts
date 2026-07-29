import { leerConfigCuenta } from "./marca";

export type Trigger = "NUEVO_CLIENTE" | "COMPRA" | "CARRITO_ABANDONADO";

/**
 * Sitio público de la marca, para los links de los presets. Sale de
 * `config.url` si está cargada y, si no, del dominio del remitente — que para
 * las tres marcas coincide con el de la tienda.
 *
 * Puede devolver **vacío**: una cuenta recién creada no tiene ni TN conectada ni
 * remitente. Quien lo use tiene que omitir el botón, no dibujarlo apuntando a
 * ningún lado.
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

// ⚠️ El contenido inicial de una automation ya NO vive acá: está en
// `lib/plantillas/presets.ts`, junto con el de las plantillas de campaña.
// Eran dos tipos `Preset` distintos y solo uno se resolvía contra la tienda —
// por eso las plantillas de la galería salían con los botones vacíos. Se usa
// `presetDeTrigger(trigger, cuenta, remitenteEmail)`.
