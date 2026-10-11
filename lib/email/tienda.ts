// Los datos duros de la tienda, en UN lugar: `${tienda.envioGratis}` en vez del
// número escrito adentro de cada mail.
//
// 🔴 **Por qué existe** (22-ago-2026). Se buscó en la base si el umbral de envío
// gratis ya estaba escrito en algún mail, para copiarlo en vez de inventarlo.
// Estaba: **el mismo bloque de garantías en 10 campañas de BDI y en la
// automation de Bienvenida**, y las once decían "En compras mayores a $50.000"
// cuando el real es $44.000. La Bienvenida estaba ACTIVA: cada lead nuevo
// recibía un umbral seis mil pesos más alto.
//
// La lección no es que alguien se olvidó: es que **cambiar el umbral obligaba a
// editar once documentos**, y ningún proceso humano hace eso once veces sin
// fallar una. Un dato copiado es un dato que se va a desincronizar.
//
// 🔑 **El principio es el mismo que el del logo y el de las redes**: el dato vive
// en la cuenta (`Cuenta.config.tienda`, ver `lib/marca.ts`) y el mail lo **lee**
// al renderizar. El Json del documento no lleva el número adentro, así que la
// misma plantilla sale con los datos de cada marca — los de Zattia no son los de
// BDI, y Stunned tiene los suyos.
//
// ⚠️ Puro: lo importan el servidor (envío) y el navegador (el preview del
// editor, el formulario de Remitentes). Sin prisma, sin next/headers.
//
// ⚠️ No confundir con `DatosTienda` de `lib/tn/client.ts`: eso es lo que
// Tiendanube devuelve en `/store` (nombre, logo, sitio, domicilio fiscal). Esto
// son los datos COMERCIALES, que TN no sabe y escribe una persona.

/**
 * Los cinco datos que hoy están escritos a mano adentro de los mails de BDI.
 *
 * ⛔ **No se agregan datos nuevos "por si sirven".** Cada campo de acá es una
 * frase que ya existía copiada en un mail; uno que nadie escribió todavía es una
 * perilla más en una pantalla, no un dato en un lugar.
 *
 * Todos son texto libre y no números a propósito: "3 cuotas sin interés" y
 * "24 h hábiles" no son cantidades, y hacer que UNO de los cinco sea un número
 * obliga a explicar dos formatos distintos en la misma pantalla y a que el mail
 * adivine la moneda. El formato lo escribe quien conoce su tienda.
 */
export interface Tienda {
  /** Umbral de envío gratis, con símbolo y todo: `$44.000`. */
  envioGratis?: string;
  /** Las cuotas que ofrece la tienda: `3 cuotas sin interés`. */
  cuotas?: string;
  /** Cuánto tiempo hay para cambiar: `30 días desde que lo recibís`. */
  plazoCambio?: string;
  /** En cuánto sale el paquete: `24 h hábiles`. */
  plazoDespacho?: string;
  /** El local a la calle, si lo hay: `Santa Fe 1671, Rosario`. */
  local?: string;
}

/** Una clave válida de `${tienda.…}`. */
export type ClaveTienda = keyof Tienda;

/**
 * Los campos, en el orden en que se muestran y con lo que la pantalla necesita
 * para explicarlos.
 *
 * 🔑 **Esta lista es la única definición.** El formulario, el validador y el
 * texto de ayuda del editor salen todos de acá: un campo nuevo se agrega en un
 * solo lugar y aparece en los tres. Enumerar los campos a mano en el formulario
 * es exactamente el bug de `marcaDe()` —el preview mostraba una cosa y el mail
 * mandaba otra— un piso más abajo.
 */
export const CAMPOS_TIENDA: readonly {
  clave: ClaveTienda;
  etiqueta: string;
  ayuda: string;
  ejemplo: string;
  max: number;
}[] = [
  {
    clave: "envioGratis",
    etiqueta: "Envío gratis desde",
    ayuda: "El monto mínimo de compra para que el envío no se cobre.",
    ejemplo: "$44.000",
    max: 40,
  },
  {
    clave: "cuotas",
    etiqueta: "Cuotas",
    ayuda: "Cómo se financia. Va tal cual al mail.",
    ejemplo: "3 cuotas sin interés",
    max: 60,
  },
  {
    clave: "plazoCambio",
    etiqueta: "Plazo de cambio",
    ayuda: "Cuánto tiempo tiene quien compró para cambiarlo.",
    ejemplo: "30 días desde que lo recibís",
    max: 80,
  },
  {
    clave: "plazoDespacho",
    etiqueta: "Plazo de despacho",
    ayuda: "En cuánto sale el paquete después de la compra.",
    ejemplo: "24 h hábiles",
    max: 60,
  },
  {
    clave: "local",
    etiqueta: "Local a la calle",
    ayuda: "Dirección donde se puede retirar. Vacío si no hay local.",
    ejemplo: "Santa Fe 1671, Rosario",
    max: 160,
  },
];

/** El tag entero, con la clave capturada: `${tienda.envioGratis}`. */
const RE_TAG = /\$\{tienda\.([a-zA-Z]+)\}/g;

/** ¿Hay algún `${tienda.…}` acá adentro? Barato, para no recorrer de gusto. */
const PREFIJO = "${tienda.";

/**
 * Lee `Cuenta.config.tienda` sin confiar en nada.
 *
 * Devuelve `undefined` si no quedó ni un campo: ausente y objeto vacío
 * significan lo mismo para el render, y una clave menos en el Json es una forma
 * menos de que quede basura adentro.
 */
export function leerTienda(valor: unknown): Tienda | undefined {
  if (!valor || typeof valor !== "object") return undefined;
  const c = valor as Record<string, unknown>;
  const out: Tienda = {};
  let hay = false;
  for (const campo of CAMPOS_TIENDA) {
    const v = c[campo.clave];
    const s = (typeof v === "string" ? v : "").trim().slice(0, campo.max);
    if (!s) continue;
    out[campo.clave] = s;
    hay = true;
  }
  return hay ? out : undefined;
}

/** Marca interna: "este texto tenía un tag y NO había dato para llenarlo". */
const SIN_DATO = Symbol("tienda-sin-dato");

/**
 * Cambia los tags de UN string. `valor(clave)` devuelve el texto o `undefined`
 * si no hay dato; cualquier tag sin dato hace que el string entero valga
 * `SIN_DATO` (nunca sale la frase mutilada).
 */
function reemplazarCon(
  s: string, prefijo: string, re: RegExp, valor: (clave: string) => string | undefined, faltan: Set<string>,
): string | typeof SIN_DATO {
  if (!s.includes(prefijo)) return s;
  let falto = false;
  const out = s.replace(re, (_, clave: string) => {
    const v = valor(clave);
    if (v) return v;
    // Una clave que no existe cae por el mismo lado que una sin dato. Es a
    // propósito: `${tienda.pepe}` escrito con un dedo torcido no puede salir a
    // una casilla como texto crudo, que es el modo de falla obvio de todo esto.
    falto = true;
    faltan.add(clave);
    return "";
  });
  return falto ? SIN_DATO : out;
}

/**
 * Recorre el documento entero cambiando los tags por su valor.
 *
 * 🔑 **Es un recorrido genérico del Json y no una lista de campos por tipo de
 * bloque.** El título de un `hero`, el texto de una celda de `columnas` y un
 * trozo de texto rico son todos strings adentro del mismo árbol: enumerarlos
 * sería tener que acordarse de cada bloque nuevo, que es el bug que hace que un
 * campo se pierda **sólo en el envío** (ver la regla 6 de `AGENTS.md`).
 *
 * 🔴 **Qué hace un tag sin dato**: el string entero queda vacío, y si ese string
 * era el texto de un trozo (`{ t }`), el trozo se cae. Nunca sale el tag crudo,
 * y nunca sale la frase mutilada ("En compras mayores a "). La celda de la barra
 * SIGUE EXISTIENDO con su título: una barra de tres celdas con una vacía queda
 * coja, y esa fue la decisión del plan.
 *
 * Devuelve el MISMO objeto si no cambió nada, así un documento sin tags no
 * paga ni una asignación por render.
 */
function caminar(v: unknown, r1: (s: string) => string | typeof SIN_DATO): unknown | typeof SIN_DATO {
  if (typeof v === "string") return r1(v);
  if (Array.isArray(v)) {
    let cambio = false;
    const out: unknown[] = [];
    for (const el of v) {
      const r = caminar(el, r1);
      // Un trozo que se quedó sin dato no se dibuja vacío: se va de la lista.
      // Un `<span>` vacío no molesta, pero un trozo CON LINK y sin texto es un
      // `<a></a>` en la casilla de otra persona, y eso no se arregla.
      if (r === SIN_DATO) { cambio = true; continue; }
      if (r !== el) cambio = true;
      out.push(r);
    }
    return cambio ? out : v;
  }
  if (v && typeof v === "object") {
    let cambio = false;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const r = caminar(val, r1);
      if (r === SIN_DATO) {
        // El texto de un trozo se lleva el trozo entero (lo dropea el `for` de
        // arriba). Cualquier otro campo se vacía y el bloque sobrevive.
        if (k === "t") return SIN_DATO;
        out[k] = "";
        cambio = true;
        continue;
      }
      if (r !== val) cambio = true;
      out[k] = r;
    }
    return cambio ? out : v;
  }
  return v;
}

const deTienda = (datos: Tienda | undefined, faltan: Set<string>) => (s: string) =>
  reemplazarCon(s, PREFIJO, RE_TAG, (k) => (datos as Record<string, string | undefined> | undefined)?.[k], faltan);

/** El documento con los `${tienda.…}` ya resueltos. */
export function resolverTienda<T>(contenido: T, datos?: Tienda): T {
  const r = caminar(contenido, deTienda(datos, new Set()));
  return (r === SIN_DATO ? contenido : r) as T;
}

/**
 * Las claves que este documento pide y la cuenta no tiene cargadas.
 *
 * No frena nada —igual que `revisarContraste`, esto cuenta lo que ve— pero es lo
 * que deja escribir un ensayo que se ponga rojo, y lo que un día puede nombrar
 * la pantalla de envío.
 */
export function tagsSinDato(contenido: unknown, datos?: Tienda): string[] {
  const faltan = new Set<string>();
  caminar(contenido, deTienda(datos, faltan));
  return [...faltan].sort();
}

/**
 * El MISMO recorrido para otra familia de tags (`${cart.total}`…), con la misma
 * regla: un tag sin dato vacía su string y se lleva su trozo. Existe para no
 * escribir dos veces la caminata —una copia es un bloque nuevo que una de las
 * dos no conoce—. Lo usa `resolverCarritoEnDoc` de `tags-carrito.ts`.
 */
export function resolverTagsEnDoc<T>(
  contenido: T, prefijo: string, re: RegExp, valor: (clave: string) => string | undefined, faltan = new Set<string>(),
): T {
  const r = caminar(contenido, (s) => reemplazarCon(s, prefijo, re, valor, faltan));
  return (r === SIN_DATO ? contenido : r) as T;
}

/** Ídem para un string suelto (el preheader). `null` si le faltó un dato. */
export function resolverTagsEnTexto(
  s: string, prefijo: string, re: RegExp, valor: (clave: string) => string | undefined,
): string | null {
  const r = reemplazarCon(s, prefijo, re, valor, new Set());
  return r === SIN_DATO ? null : r;
}

/**
 * El umbral de envío gratis como NÚMERO, leído del texto que escribió la tienda
 * («$44.000» → 44000). Estricto: sólo un monto en pesos con puntos de miles y,
 * si acaso, coma decimal. Cualquier otra cosa («$44.000 en CABA», «gratis») da
 * `null` y la frase que lo usa se cae — adivinar un umbral es prometer un envío
 * gratis que la tienda no dio.
 */
export function montoEnvioGratis(t?: Tienda): number | null {
  const m = /^\$?\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/.exec((t?.envioGratis ?? "").trim());
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "") + (m[2] ? "." + m[2] : ""));
  return n > 0 ? n : null;
}

/**
 * Cuántas cuotas SIN INTERÉS ofrece la tienda, leído de «3 cuotas sin interés».
 * Sin el «sin interés» escrito da `null`: dividir el total en cuotas con interés
 * sería anunciar una cuota más baja que la real.
 */
export function cantidadCuotas(t?: Tienda): number | null {
  const m = /^(\d{1,2})\s+cuotas?\s+sin\s+inter[eé]s\b/i.exec((t?.cuotas ?? "").trim());
  const n = m ? Number(m[1]) : 0;
  return n >= 2 ? n : null;
}
