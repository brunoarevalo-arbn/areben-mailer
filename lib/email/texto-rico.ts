// Texto con formato POR SELECCIÓN: negrita, cursiva, tipografía, tamaño, color
// y link aplicados a un pedazo de un campo, no al bloque entero.
//
// ⚠️ Puro: lo importan el SERVIDOR (render, saneo) y el CLIENTE (el editor). Sin
// DOM, sin React, sin prisma. La lógica de partir y fusionar vive acá y no en el
// componente porque es lo más fácil de romper y lo único que un script de Node
// puede probar — nada de lo que pasa adentro de un `contenteditable` lo ve un
// test.
//
// ─── Por qué una UNIÓN y no un reemplazo ─────────────────────────────────────
//
// Un campo de texto es `string | Trozo[]`, y el `string` sigue siendo válido
// PARA SIEMPRE. No es una etapa de transición: es la forma normal.
//
//   - Los 38 presets no se tocan y el golden no se mueve un byte.
//   - No hay migración ni bump de `V_ACTUAL`: no hay nada que convertir.
//   - `canonizar()` devuelve al string apenas el formato desaparece, así que la
//     forma vieja se mantiene sola.
//
// El precedente es literal: `Columna.botonTexto` e `icono` entraron sin bump con
// el mismo argumento (ver `bloques.ts`). `V_ACTUAL` existe para cambios de
// FORMA que requieren conversión —`izq`/`der` → `celdas`—, y acá no hay ninguno.
//
// ─── La asimetría, que es a propósito ────────────────────────────────────────
//
// Un `string` interpreta `**negrita**` (lo resuelve `negritas()` en el
// renderer). Un `Trozo[]` **NO**: adentro de un trozo los asteriscos quedan
// literales, porque el vocabulario del trozo es el formato y no una sintaxis.
// Por eso `canonizar` se niega a colapsar un trozo cuyo texto tenga `**`:
// colapsarlo cambiaría el HTML.

import {
  PESOS,
  RANGOS,
  resolverColor,
  sanearBool,
  sanearColor,
  sanearEnum,
  sanearNum,
  px,
  type ValorColor,
} from "./estilos";
import { FUENTES, type Paleta } from "./tema";

/**
 * Un pedazo de texto con su formato.
 *
 * 🔑 **Las claves son literalmente las de `EstiloBloque`.** No es prolijidad:
 * quien conoce la cascada lee un trozo sin manual, y el saneo reusa los mismos
 * validadores (`sanearColor`, `RANGOS.tamano`, `PESOS`, las claves de `FUENTES`)
 * en vez de inventar unos nuevos que se desincronizarían el día que alguien
 * mueva un rango.
 *
 * Los nombres son cortos porque este objeto se repite una vez por pedazo de
 * texto, se re-serializa entero en cada guardado y viaja en cada Server Action.
 *
 * ⚠️ **Lo que NO está y por qué:**
 *   - `interlinea` y `espaciado`: son del párrafo, no de una palabra. Un
 *     `line-height` en un `<span>` inline no hace nada confiable.
 *   - `align`: es del bloque. Media frase no se alinea distinto del resto.
 *   - `mayusculas`: `text-transform` no es confiable en Outlook, y el encabezado
 *     —el único lugar donde importaba— ya lo resuelve en JS sobre el string.
 */
export interface Trozo {
  /** El texto. `t` y no `texto`: aparece en cada trozo de cada campo. */
  t: string;
  /** Clave de `FUENTES`, nunca un stack CSS: el stack lo pone el emisor. */
  fuente?: keyof typeof FUENTES;
  /** px, dentro de `RANGOS.tamano`. */
  tamano?: number;
  peso?: 400 | 500 | 600 | 700;
  italica?: boolean;
  subrayado?: boolean;
  /**
   * 🔑 Acepta **token de la marca** (`$acento`) además de hex, igual que
   * `EstiloBloque`. Si fuera solo hex, pintar una palabra la clavaría para
   * siempre: dejaría de repintarse cuando el comerciante cambia el tema, que es
   * justo lo que hace que una plantilla se pueda compartir entre marcas.
   */
  color?: ValorColor;
  /** El resaltado. Mismo criterio que `color`. */
  fondo?: ValorColor;
  /** El link. Se emite como `<a>` alrededor del trozo. */
  url?: string;
}

/** Un campo de texto humano: el string de siempre, o trozos con formato. */
export type TextoRico = string | Trozo[];

/** Las claves de formato de un `Trozo`. Todo lo que no sea `t`. */
export const CLAVES_FORMATO = [
  "fuente", "tamano", "peso", "italica", "subrayado", "color", "fondo", "url",
] as const satisfies readonly Exclude<keyof Trozo, "t">[];

export type ClaveFormato = (typeof CLAVES_FORMATO)[number];

/** El formato de un trozo, sin su texto. */
export type Formato = Omit<Trozo, "t">;

/**
 * Qué campo de qué bloque admite formato.
 *
 * 🔑 **Son 8 de los 22 campos de texto que escribe una persona**, y la lista es
 * cerrada a propósito:
 *
 *   - los 4 de cuerpo, que ya aceptaban `**negrita**`
 *   - los 4 de título, que son los que piden el patrón que motivó todo esto
 *     (dos tipografías en el mismo renglón)
 *
 * ⛔ Los `botonTexto` quedan afuera: el texto del botón se emite **dos veces**
 * —una en el `<v:roundrect>` de Outlook y otra en el ancla— y el VML no dibuja
 * `<span>` adentro. Un botón con dos tipografías saldría distinto en Outlook que
 * en todos lados.
 *
 * ⛔ `cupon.codigo`, `encabezado.texto`, `menu`, `redes` e `imagen.alt` tampoco:
 * ninguno es un párrafo, y el `alt` va adentro de un atributo.
 */
export const CAMPOS_RICOS = {
  titulo: ["texto"],
  texto: ["texto"],
  hero: ["titulo", "subtitulo"],
  seccion: ["titulo", "texto"],
  // Las celdas se recorren aparte: no son campos del bloque sino de cada
  // `Columna`. Ver `sanearCamposRicos`.
  columnas: [],
} as const satisfies Record<string, readonly string[]>;

/** Los campos de una `Columna` que admiten formato. */
export const CAMPOS_RICOS_CELDA = ["titulo", "texto"] as const;

/**
 * Tope de trozos por campo.
 *
 * No es un límite de diseño —nadie formatea 200 pedazos de un párrafo a mano—
 * sino la red contra un Json fabricado: cada trozo son bytes en la base, un
 * `<span>` en el HTML de CADA envío, y el mail tiene un techo de ~102 KB antes
 * de que Gmail lo recorte.
 */
export const MAX_TROZOS = 200;

// ─────────────────────────────────────────────────────────────────────────────
// Saneo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Protocolos que un link de trozo puede usar.
 *
 * 🔴 Es el primer lugar del motor donde una URL viene de una **selección de
 * texto** y no de un campo etiquetado "Link", así que acá sí se filtra el
 * esquema: sin esto, `javascript:` adentro de una palabra es un `href` que el
 * preview del panel sirve desde el origen de la app.
 *
 * `${` está en la lista porque un merge tag (`${cart.url}`) es un destino
 * legítimo: lo resuelve el procesador después de renderizar.
 */
const PROTOCOLOS = ["https://", "http://", "mailto:", "#", "/", "${"];

/**
 * ⚠️ Exportada porque **el emisor la vuelve a llamar**. La frontera de seguridad
 * son los emisores y no el saneo: `esActual()` deja pasar los documentos por el
 * camino rápido, así que un `href` que solo estuviera filtrado acá saldría
 * entero en un mail cuyo Json nunca se re-saneó.
 */
export function sanearUrl(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const u = v.trim();
  if (!u) return undefined;
  return PROTOCOLOS.some((p) => u.startsWith(p)) ? u : undefined;
}

/** El formato de un objeto cualquiera, filtrado contra la lista blanca. */
function sanearFormato(x: Record<string, unknown>): Formato {
  const f: Formato = {};
  const poner = <K extends keyof Formato>(k: K, valor: Formato[K] | undefined) => {
    if (valor !== undefined) f[k] = valor;
  };

  poner("fuente", sanearEnum(x.fuente, Object.keys(FUENTES) as (keyof typeof FUENTES)[]));
  poner("tamano", sanearNum(x.tamano, RANGOS.tamano));
  poner("peso", sanearEnum(x.peso, PESOS));
  poner("italica", sanearBool(x.italica));
  poner("subrayado", sanearBool(x.subrayado));
  poner("color", sanearColor(x.color));
  poner("fondo", sanearColor(x.fondo));
  poner("url", sanearUrl(x.url));

  return f;
}

/**
 * Un campo de texto que viene del Json, filtrado.
 *
 * Devuelve `undefined` cuando el valor no es ni string ni array — que para el
 * llamador significa "dejá el campo como estaba", no "poné vacío".
 *
 * ⚠️ **Esto casi nunca corre.** `esActual()` deja pasar los documentos por el
 * camino rápido sin re-sanear, y está bien que así sea: la frontera de seguridad
 * son los emisores (`trozoCss`), no el saneo. El colapso canónico lo hace el
 * EDITOR al escribir, que es donde nacen los trozos; esta función es la red para
 * el Json editado a mano, pegado desde otra pestaña o traído por un script.
 */
export function sanearTrozos(v: unknown): TextoRico | undefined {
  if (typeof v === "string") return v;
  if (!Array.isArray(v)) return undefined;

  const out: Trozo[] = [];
  for (const item of v) {
    if (out.length >= MAX_TROZOS) break;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const x = item as Record<string, unknown>;
    // Un trozo sin texto no es un trozo. `canonizar` los tira igual, pero
    // cortarlos acá evita que llenen el cupo de MAX_TROZOS.
    if (typeof x.t !== "string" || x.t === "") continue;
    out.push({ t: x.t, ...sanearFormato(x) });
  }
  return canonizar(out);
}

// ─────────────────────────────────────────────────────────────────────────────
// La forma canónica
// ─────────────────────────────────────────────────────────────────────────────

/** ¿Este trozo tiene alguna clave de formato? */
export const tieneFormato = (t: Trozo): boolean =>
  CLAVES_FORMATO.some((k) => t[k] !== undefined);

/** ¿Dos trozos se ven igual? (todo menos el texto) */
const mismoFormato = (a: Trozo, b: Trozo): boolean =>
  CLAVES_FORMATO.every((k) => a[k] === b[k]);

/**
 * Tira los trozos vacíos y fusiona los adyacentes que se ven igual.
 *
 * 🔑 **Lo llama también el EMISOR**, y no por prolijidad: sin esto,
 * `[{t:"a",peso:700},{t:"b",peso:700}]` saldría como dos `<span>` idénticos
 * pegados y su forma canónica como uno solo — el mismo mail con dos HTML
 * distintos. Con esto, normalizar el dato nunca mueve el mail, que es lo que
 * deja correr `canonizar()` en el editor sin avisarle a nadie.
 *
 * Y de paso son bytes: un trozo vacío emitía un `<span style="…"></span>` que no
 * dibuja nada, contra el techo de ~102 KB con el que Gmail recorta.
 */
export function fusionar(ts: readonly Trozo[]): Trozo[] {
  const out: Trozo[] = [];
  for (const t of ts) {
    if (!t || typeof t.t !== "string" || t.t === "") continue;
    const previo = out[out.length - 1];
    if (previo && mismoFormato(previo, t)) previo.t += t.t;
    else out.push({ ...t });
  }
  return out;
}

/**
 * 🔑 **La pieza que hace que todo esto sea barato.**
 *
 * Tira los trozos vacíos, fusiona los adyacentes que se ven igual, y —si lo que
 * queda es UN solo trozo sin nada de formato— devuelve el `string` pelado.
 *
 * Sin esta regla, el primer click en negrita convierte el campo a array **para
 * siempre**: aunque después se saque el formato, el dato queda como
 * `[{t:"hola"}]` y en seis meses la mitad de los mails guardados son arrays de
 * un trozo que nadie puede volver a leer como string. Con ella, **la forma vieja
 * es la forma normal y el array es la excepción**.
 *
 * ⚠️ **El `**` bloquea el colapso.** Un `string` interpreta `**negrita**` y un
 * trozo no, así que colapsar `[{t:"hola **che**"}]` a `"hola **che**"` haría
 * aparecer un `<strong>` que no estaba. Es la única asimetría del diseño y vive
 * en esta línea.
 *
 * Es idempotente por construcción: `canonizar(canonizar(x))` da lo mismo.
 */
export function canonizar(v: TextoRico): TextoRico {
  if (typeof v === "string") return v;

  const out = fusionar(v);

  if (out.length === 0) return "";
  if (out.length === 1 && !tieneFormato(out[0]) && !out[0].t.includes("**")) return out[0].t;
  return out;
}

/**
 * El texto sin formato. Para el `alt` de una foto, el resumen de la tarjeta del
 * editor y la parte `text/plain` del mail.
 *
 * ⚠️ No resuelve `**negrita**`: eso es cosa del renderer (`sinNegritas()` en el
 * text/plain, `negritas()` en el HTML). Acá solo se concatena.
 */
export const textoPlano = (v: TextoRico): string =>
  typeof v === "string" ? v : v.map((t) => t.t).join("");

/** El largo en caracteres, sin materializar el string. */
export const largo = (v: TextoRico): number =>
  typeof v === "string" ? v.length : v.reduce((n, t) => n + t.t.length, 0);

/** Un campo como lista de trozos, para poder trabajarlo uniforme. */
export const aTrozos = (v: TextoRico): Trozo[] =>
  typeof v === "string" ? (v === "" ? [] : [{ t: v }]) : v.map((t) => ({ ...t }));

/** ¿Algún trozo declara tamaño propio? */
export const tieneTamano = (v: TextoRico | undefined): boolean =>
  Array.isArray(v) && v.some((t) => t.tamano !== undefined);

/** ¿Algún trozo lleva link? */
export const tieneLink = (v: TextoRico | undefined): boolean =>
  Array.isArray(v) && v.some((t) => !!t.url);

// ─────────────────────────────────────────────────────────────────────────────
// Editar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aplicar (o sacar) formato a un rango de caracteres.
 *
 * Los offsets son sobre el **texto plano concatenado**, no sobre nodos del DOM:
 * el componente traduce su `Range` a offsets antes de llamar acá, y vuelve a
 * ubicar el cursor por offsets después. Así esta función se puede probar entera
 * desde Node, que es todo el motivo por el que vive en `lib/`.
 *
 * Una clave del patch en `undefined` **saca** esa propiedad (es lo que hace el
 * segundo click en "Negrita"). Decidir si el click pone o saca es del llamador:
 * ver `tieneTodo`.
 */
export function aplicarFormato(
  v: TextoRico,
  desde: number,
  hasta: number,
  patch: Partial<Formato>,
): TextoRico {
  const ts = aTrozos(v);
  const total = ts.reduce((n, t) => n + t.t.length, 0);

  const ini = Math.max(0, Math.min(desde, hasta));
  const fin = Math.min(total, Math.max(desde, hasta));
  // Selección vacía o fuera de rango: no se toca nada. El caso real es el click
  // en un botón de la barra sin nada seleccionado.
  if (ini >= fin) return v;

  const out: Trozo[] = [];
  let pos = 0;

  for (const t of ts) {
    const arranca = pos;
    const termina = pos + t.t.length;
    pos = termina;

    // Entero afuera de la selección.
    if (termina <= ini || arranca >= fin) {
      out.push(t);
      continue;
    }

    const cortaIni = Math.max(ini, arranca) - arranca;
    const cortaFin = Math.min(fin, termina) - arranca;

    if (cortaIni > 0) out.push({ ...t, t: t.t.slice(0, cortaIni) });

    const medio: Trozo = { ...t, t: t.t.slice(cortaIni, cortaFin) };
    for (const [k, valor] of Object.entries(patch) as [ClaveFormato, unknown][]) {
      if (valor === undefined) delete medio[k];
      else Object.assign(medio, { [k]: valor });
    }
    out.push(medio);

    if (cortaFin < t.t.length) out.push({ ...t, t: t.t.slice(cortaFin) });
  }

  return canonizar(out);
}

/**
 * ¿TODO lo seleccionado ya tiene esta propiedad con este valor?
 *
 * Es la regla de Google Docs para los toggles: si toda la selección ya está en
 * negrita, el botón la saca; si hay una parte sin negrita, la pone. Vive acá
 * —y no en el componente— porque decide qué se guarda.
 */
export function tieneTodo(
  v: TextoRico,
  desde: number,
  hasta: number,
  clave: ClaveFormato,
  valor: unknown,
): boolean {
  const ts = aTrozos(v);
  const ini = Math.max(0, Math.min(desde, hasta));
  const fin = Math.max(desde, hasta);
  if (ini >= fin) return false;

  let pos = 0;
  let vioAlguno = false;
  for (const t of ts) {
    const arranca = pos;
    const termina = pos + t.t.length;
    pos = termina;
    if (termina <= ini || arranca >= fin) continue;
    vioAlguno = true;
    if (t[clave] !== valor) return false;
  }
  return vioAlguno;
}

/**
 * El formato del trozo que contiene una posición. Para que la barra muestre en
 * qué tipografía y tamaño está parado el cursor.
 */
export function formatoEn(v: TextoRico, pos: number): Formato {
  const ts = aTrozos(v);
  let n = 0;
  for (const t of ts) {
    n += t.t.length;
    if (pos < n) {
      const { t: _t, ...f } = t;
      return f;
    }
  }
  const ultimo = ts[ts.length - 1];
  if (!ultimo) return {};
  const { t: _t, ...f } = ultimo;
  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// Emitir CSS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El `style` de un trozo. **Lista blanca pura.**
 *
 * 🔴 **Ni una sola interpolación de un string del Json.** La tipografía sale de
 * `FUENTES[clave]` (un literal del código), el tamaño de `px()` sobre un número
 * ya acotado, y el color de `resolverColor` sobre un valor que `sanearColor` ya
 * validó contra la regex de hex. Es la regla 3 de AGENTS.md sin excepción, y es
 * exactamente por eso que `Trozo.fuente` guarda una CLAVE y no un stack CSS.
 *
 * Devuelve `""` cuando el trozo no tiene formato — y ahí el emisor no envuelve
 * nada, así que un trozo pelado no agrega un solo byte al mail.
 */
export function trozoCss(t: Trozo, pal: Paleta): string {
  const out: string[] = [];

  if (t.fuente && t.fuente in FUENTES) out.push(`font-family:${FUENTES[t.fuente]}`);
  if (typeof t.tamano === "number") {
    const n = sanearNum(t.tamano, RANGOS.tamano);
    if (n !== undefined) out.push(`font-size:${px(n)}`);
  }
  if (t.peso && (PESOS as readonly number[]).includes(t.peso)) out.push(`font-weight:${t.peso}`);
  if (t.italica) out.push("font-style:italic");
  if (t.subrayado) out.push("text-decoration:underline");

  const color = resolverColor(sanearColor(t.color), pal);
  if (color) out.push(`color:${color}`);
  const fondo = resolverColor(sanearColor(t.fondo), pal);
  if (fondo) out.push(`background-color:${fondo}`);

  return out.join(";");
}
