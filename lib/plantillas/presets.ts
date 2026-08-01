// Las plantillas que vienen con la app: lo que el comerciante ve el primer día.
//
// 📗 **Las reglas de qué plantilla puede entrar viven en `PLANTILLAS.md`**, en la
// raíz del repo, junto con el vocabulario de diseño y el backlog del motor.
// Leerlo antes de sumar o tocar un preset.
//
// Este archivo es la **puerta pública**: tipos, composición de `DEFS` y la API.
// Los presets en sí viven en `familias/*.ts`, uno por pestaña de la galería, y
// las piezas compartidas en `comun.ts`.
//
// ⚠️ **No se convierte en `presets/index.ts`.** `scripts/fix-automations-marca.ts`
// y `scripts/crear-automations-marca.ts` lo importan con extensión explícita
// (`'../lib/plantillas/presets.ts'`) y se romperían. Con el archivo donde está,
// los doce sitios de import no se tocan aunque las familias se muevan.
//
// ⚠️ Puro: no importa prisma ni next/headers. Lo lee el servidor (crear campaña)
// y el navegador (las miniaturas de /plantillas).
//
// Dos cosas que no se negocian y que ya costaron un bug cada una:
//
// - **Un preset se declara como función de la cuenta**, nunca como una
//   constante: el nombre de la marca va al copy y su sitio a los links, y eso se
//   resuelve al instanciar. El logo ni se toca — lo pone el bloque `encabezado`
//   al renderizar. Guardar cualquiera de las tres cosas adentro del Json es la
//   bienvenida de Zattia saludando en nombre de "BDI Accesorios".
// - **Los presets de campaña y los de automation son el MISMO tipo**, en la
//   misma lista, con una sola `presetsPara()`. Hasta el 29-jul eran dos tipos en
//   dos archivos: el de automations sí se resolvía contra la tienda, el de la
//   galería no —tenía todas las URLs vacías, y las plantillas salían con botones
//   que no llevaban a ninguna parte—.

import { leerContenido } from "@/lib/email/esquema";
import type { ContenidoCampania } from "@/lib/email/render";
import { urlTiendaDe, type Trigger } from "@/lib/automations";
import { type CtxPreset, type DefPreset, type Familia } from "./comun";
import { CATALOGO } from "./familias/catalogo";
import { VENTA } from "./familias/venta";
import { PRODUCTO } from "./familias/producto";
import { FECHAS } from "./familias/fechas";
import { CICLO } from "./familias/ciclo";
import { EDITORIAL } from "./familias/editorial";
import { AUTOMATION } from "./familias/automation";

// Se re-exportan desde acá para que nadie tenga que saber que `comun.ts` existe.
export { FAMILIAS } from "./comun";
export type { CtxPreset, Armado, DefPreset, Familia } from "./comun";

/** Un preset ya resuelto contra una cuenta: listo para guardar tal cual. */
export interface Preset {
  id: string;
  nombre: string;
  descripcion: string;
  familia?: Familia;
  trigger?: Trigger;
  esperaHoras: number;
  asunto: string;
  contenido: ContenidoCampania;
}

/**
 * Todos los presets, en el orden en el que se ofrecen.
 *
 * Las de automation van al final por costumbre, no porque importe: quien las
 * busca lo hace por `trigger`, y `presetsGaleria()` las saca por no tener uno.
 */
const DEFS: readonly DefPreset[] = [
  ...CATALOGO,
  ...VENTA,
  ...PRODUCTO,
  ...FECHAS,
  ...CICLO,
  ...EDITORIAL,
  ...AUTOMATION,
];

// ─────────────────────────────────────────────────────────────────────────────
// Resolución contra una cuenta
// ─────────────────────────────────────────────────────────────────────────────

/** Lo mínimo que hace falta saber de una cuenta para armar un preset. */
export interface CuentaPreset {
  nombre: string;
  config: unknown;
}

function resolver(d: DefPreset, ctx: CtxPreset): Preset {
  const { bloques, tema, estilos, asunto } = d.arma(ctx);
  return {
    id: d.id,
    nombre: d.nombre,
    descripcion: d.descripcion,
    familia: d.familia,
    trigger: d.trigger,
    esperaHoras: d.esperaHoras ?? 0,
    asunto: asunto ?? "",
    // Entra por la MISMA puerta que el contenido de la base: así lo que se
    // guarda ya nace en la versión actual del esquema, con ids propios y con la
    // cabecera de marca puesta. Un preset que se guardara sin pasar por acá
    // sería el único documento del sistema en un formato viejo.
    contenido: leerContenido({ bloques, tema, estilos }),
  };
}

/**
 * Todos los presets, resueltos contra una cuenta.
 *
 * `remitenteEmail` es el fallback del sitio de la tienda para las cuentas que
 * todavía no tienen `config.url` — ver `urlTiendaDe`.
 */
export function presetsPara(cuenta: CuentaPreset, remitenteEmail?: string | null): Preset[] {
  const ctx: CtxPreset = { marca: cuenta.nombre, tienda: urlTiendaDe(cuenta, remitenteEmail) };
  return DEFS.map((d) => resolver(d, ctx));
}

/** Los de la galería de /plantillas: todos menos los que dispara un evento. */
export function presetsGaleria(cuenta: CuentaPreset, remitenteEmail?: string | null): Preset[] {
  return presetsPara(cuenta, remitenteEmail).filter((p) => !p.trigger);
}

export function presetDe(id: string, cuenta: CuentaPreset, remitenteEmail?: string | null): Preset | undefined {
  const d = DEFS.find((x) => x.id === id);
  return d ? resolver(d, { marca: cuenta.nombre, tienda: urlTiendaDe(cuenta, remitenteEmail) }) : undefined;
}

/** El contenido inicial de una automation, con la marca que la crea adentro. */
export function presetDeTrigger(trigger: Trigger, cuenta: CuentaPreset, remitenteEmail?: string | null): Preset {
  const d = DEFS.find((x) => x.trigger === trigger);
  // No puede faltar: los cuatro triggers están cubiertos en `familias/automation.ts`
  // y `Trigger` es una unión cerrada. Si alguien agrega un trigger sin preset,
  // que reviente acá y no con una automation vacía llegándole a un cliente.
  if (!d) throw new Error(`Sin preset para el trigger ${trigger}`);
  return resolver(d, { marca: cuenta.nombre, tienda: urlTiendaDe(cuenta, remitenteEmail) });
}

/** Los ids que existen. Para las pruebas, que recorren todos. */
export const PRESET_IDS: readonly string[] = DEFS.map((d) => d.id);
