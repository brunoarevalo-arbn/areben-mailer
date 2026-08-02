import { leerConfigCuenta } from "./marca";

// ⚠️ `NUEVO_SUSCRIPTOR` es el único que NO tiene evento de Tiendanube detrás
// (ver `TRIGGER_EVENT` en `lib/tn/eventos.ts`): lo encola quien captura el lead
// —Resorty hoy, los formularios `/f/[slug]` mañana— y no el webhook. Lo que
// nombra es el evento ("alguien se anotó"), no el widget: la fuente viaja en
// `triggerData.origen`, así que una superficie nueva no pide un valor de enum
// nuevo (que es DDL + deploy y no se puede sacar).
export type Trigger = "NUEVO_CLIENTE" | "COMPRA" | "CARRITO_ABANDONADO" | "NUEVO_SUSCRIPTOR";

/**
 * Los cuatro valores del enum `TriggerTipo`, como lista.
 *
 * Es lo que valida un trigger que llega de un formulario: el enum de la base no
 * viaja al cliente, y un valor inventado lo descubriría Prisma al insertar.
 * El `satisfies` obliga a que un trigger nuevo del tipo entre también acá.
 */
export const TRIGGERS = [
  "NUEVO_CLIENTE",
  "NUEVO_SUSCRIPTOR",
  "COMPRA",
  "CARRITO_ABANDONADO",
] as const satisfies readonly Trigger[];

export const esTrigger = (x: string): x is Trigger => (TRIGGERS as readonly string[]).includes(x);

/**
 * Qué hacer cuando alguien pide la automation de un trigger: llevarlo a la que
 * ya existe, o crearla.
 *
 * 🔴 Es puro y lo usan LOS DOS lados —la tarjeta de `/automations` y la action
 * `crearAutomation`— a propósito. El disparador manda **todas** las automations
 * que matcheen el trigger, así que una segunda fila con el mismo trigger es un
 * segundo mail a la misma persona; y una bienvenida es una sola vez en la vida
 * del contacto. Con el criterio escrito dos veces, alcanza con que uno de los
 * dos se quede viejo para que el bug vuelva.
 *
 * Devuelve el id de la existente —no un booleano— porque quien apretó el botón
 * viene a editar esa: fallar sería correcto y además inútil.
 *
 * ⚠️ La más VIEJA cuando hay varias. Las duplicadas que ya existían (BDI tuvo
 * dos bienvenidas) se resuelven a la que la gente venía editando, no a la que
 * creó el accidente.
 */
export function automationDelTrigger<T extends { id: string; trigger: string; createdAt: Date }>(
  existentes: T[],
  trigger: Trigger,
): T | undefined {
  return existentes
    .filter((a) => a.trigger === trigger)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
}

/**
 * Por qué NO se puede borrar una automation. `null` = se puede.
 *
 * 🔴 Puro y compartido por la action de `/automations` y por
 * `scripts/borrar-automation.ts`, por lo mismo que `automationDelTrigger`: dos
 * copias de una guarda son dos guardas que se van a portar distinto.
 *
 * Las dos razones no son cosméticas:
 *
 * 1. **ACTIVA no se borra.** Prender una automation es lo que registra el
 *    webhook en Tiendanube; borrar la fila deja el webhook colgado en TN
 *    apuntando a un id que ya no existe. Primero se pausa desde la UI, que es lo
 *    que lo da de baja.
 * 2. **Con historial no se borra.** No es solo perder las métricas del home: una
 *    bienvenida es **una sola vez en la vida del contacto**, y eso se decide
 *    preguntando "¿hubo algún run?". Borrarla y volver a crearla deja a todos
 *    elegibles otra vez ⇒ un segundo mail a gente que ya lo recibió. Es
 *    exactamente lo que pasó en BDI: 354 runs sobre 177 leads.
 *
 * La salida para una que ya mandó no es borrarla: es dejarla PAUSADA.
 */
export function motivoNoBorrable(
  a: { estado: string },
  runs: number,
  envios: number,
): string | null {
  if (a.estado === "ACTIVO") return "Está activa: pausala primero (eso da de baja el webhook en Tiendanube).";
  if (runs > 0 || envios > 0)
    return `Ya mandó ${Math.max(runs, envios)} mail${Math.max(runs, envios) === 1 ? "" : "es"}: no se borra, se deja pausada. Borrarla y recrearla se los volvería a mandar.`;
  return null;
}

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
