import { leerConfigCuenta } from "./marca";

// ⚠️ `NUEVO_SUSCRIPTOR` es el único que NO tiene evento de Tiendanube detrás
// (ver `TRIGGER_EVENT` en `lib/tn/eventos.ts`): lo encola quien captura el lead
// —Resorty hoy, los formularios `/f/[slug]` mañana— y no el webhook. Lo que
// nombra es el evento ("alguien se anotó"), no el widget: la fuente viaja en
// `triggerData.origen`, así que una superficie nueva no pide un valor de enum
// nuevo (que es DDL + deploy y no se puede sacar).
export type Trigger =
  | "NUEVO_CLIENTE"
  | "COMPRA"
  | "CARRITO_ABANDONADO"
  | "NUEVO_SUSCRIPTOR"
  | "RESENA";

/**
 * Los cinco valores del enum `TriggerTipo`, como lista.
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
  "RESENA",
] as const satisfies readonly Trigger[];

export const esTrigger = (x: string): x is Trigger => (TRIGGERS as readonly string[]).includes(x);

/**
 * CUÁL es la automation de un trigger: la que se abre al apretar "Editar".
 *
 * ⚠️ **Ya no contesta "¿se puede crear otra?"** — eso lo decide `MAX_POR_TRIGGER`
 * acá abajo, porque el carrito abandonado admite dos. Esta sigue contestando
 * "cuál", que es una pregunta distinta y que un trigger con secuencia también
 * tiene (la primera es la que la gente venía editando).
 *
 * 🔴 Es puro y lo usan LOS DOS lados —la tarjeta de `/automations` y la action
 * `crearAutomation`— a propósito. Con el criterio escrito dos veces, alcanza con
 * que uno de los dos se quede viejo para que el bug vuelva.
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
 * Cuántas automations admite cada trigger.
 *
 * 🔴 **La regla NO es "una por trigger": es "una por trigger, salvo el carrito".**
 * Lo que la fundamenta está escrito arriba —el disparador manda TODAS las que
 * matcheen, así que una segunda fila es un segundo mail a la misma persona— y en
 * el carrito abandonado ese segundo mail **es el producto**, no el bug: recordar
 * a la hora y volver al día siguiente es la secuencia entera. En una bienvenida,
 * en cambio, sigue siendo el bug: es una sola vez en la vida del contacto.
 *
 * Que sea un `Record` completo y no una lista de excepciones es a propósito, por
 * lo mismo que el `Record` de iconos de `/automations`: un trigger nuevo **tiene
 * que decidir esto para compilar**. Una lista de excepciones deja que el valor
 * por defecto lo elija el olvido.
 *
 * ⚠️ La base **no tiene índice único** y nunca lo tuvo (ver `AGENTS.md`): la
 * decisión de cuántas caben vive acá, en código, donde se puede cambiar. Un
 * `@@unique` es DDL que después no se saca.
 *
 * ⚠️ Subir el número del carrito a 3 es lo ÚNICO que hace falta para un tercer
 * mail. Está en 2 porque el tercer toque de una secuencia de carrito es casi
 * siempre el del descuento, y hoy **no hay cupón atado a este trigger**
 * (`aplicarCuponDelTrigger` mira `triggerData.origen`, que el carrito no manda).
 */
export const MAX_POR_TRIGGER: Record<Trigger, number> = {
  NUEVO_CLIENTE: 1,
  NUEVO_SUSCRIPTOR: 1,
  COMPRA: 1,
  CARRITO_ABANDONADO: 2,
  RESENA: 1,
};

/**
 * ¿Entra otra automation de este trigger?
 *
 * Puro y compartido por los dos lados —la tarjeta de `/automations`, la de la
 * galería de plantillas y las dos actions que crean— por lo mismo que
 * `automationDelTrigger`: con el criterio escrito cuatro veces, alcanza con que
 * uno se quede viejo para que vuelva el bug de las dos bienvenidas.
 */
export function puedeCrearOtra(existentes: { trigger: string }[], trigger: Trigger): boolean {
  return existentes.filter((a) => a.trigger === trigger).length < MAX_POR_TRIGGER[trigger];
}

/**
 * La espera con la que nace el segundo mail de una secuencia, en horas.
 *
 * Es un **default del panel**, no una regla: quien lo arma la cambia desde
 * `/automations` o desde el panel de carrito de Resorty. Existe para que el
 * segundo no nazca con la misma espera que el primero, que es un mail duplicado
 * a la misma hora.
 */
export const ESPERA_SIGUIENTE_HORAS = 24;

/**
 * El `@default(1)` de `Automation.esperaHoras` en el schema, como constante.
 *
 * Existe para que la puerta que crea una automation desde una PLANTILLA de
 * galería —que no trae espera propia— pueda escribir el valor en vez de omitir
 * la columna: omitirla funciona igual, pero deja el número invisible en el
 * llamador y `nacimientoDelMail` necesita saber de qué parte.
 */
export const ESPERA_SCHEMA_HORAS = 1;

/**
 * Con qué nombre y con qué espera nace el mail número `orden` (1-based) de un
 * trigger, partiendo de lo que trae su preset.
 *
 * 🔑 **El nombre tiene que distinguirlos en la lista.** Sin esto, `/automations`
 * dibuja dos filas idénticas ("Carrito abandonado", "Carrito abandonado") y la
 * única forma de saber cuál se está editando es abrirlas: la pantalla afirmaría
 * que son la misma cosa. Es el mismo motivo por el que la espera no se repite.
 */
export function nacimientoDelMail(
  orden: number,
  base: { nombre: string; esperaHoras: number },
): { nombre: string; esperaHoras: number } {
  if (orden <= 1) return { nombre: base.nombre, esperaHoras: base.esperaHoras };
  return { nombre: `${base.nombre} — ${orden}º mail`, esperaHoras: ESPERA_SIGUIENTE_HORAS };
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
