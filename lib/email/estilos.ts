// Estilo por bloque, en cascada de tres capas.
//
//   (a) marca      → Cuenta.config.tema, ya resuelto como `Paleta`
//   (b) documento  → ContenidoCampania.estilos   ("en este mail, todos los títulos…")
//   (c) bloque     → Bloque.estilo               (el override puntual)
//
// ⚠️ Este archivo lo importan el SERVIDOR y el CLIENTE (el preview del editor
// renderiza con el mismo código). Puro: sin prisma, sin next/headers, sin zod.
//
// Acá viven los TIPOS y el saneamiento. El resolvedor de la cascada y los
// emisores de CSS llegan después: el normalizador del esquema tiene que poder
// filtrar un `estilo` que venga de la base antes de que exista quien lo dibuje.

import { FUENTES, type Paleta } from "./tema";

/**
 * Colores de la marca que un bloque puede nombrar.
 *
 * El `satisfies` no es adorno: garantiza que cada token sea una clave real de
 * `Paleta`, así renombrar un color del tema rompe la compilación acá en vez de
 * dejar un `$acento` que resuelve a `undefined` en silencio.
 */
export const TOKENS_COLOR = [
  "fondo", "tarjeta", "borde", "bordeSuave",
  "texto", "cuerpo", "medio", "tenue",
  "acento", "sobreAcento", "link",
  "seccion", "cuponFondo", "cuponTexto",
] as const satisfies readonly (keyof Paleta)[];

export type TokenColor = (typeof TOKENS_COLOR)[number];

/**
 * Un color, en una de tres formas:
 *
 *   "$acento"   → token de la marca. Se repinta solo cuando cambia el tema.
 *   "#f59e0b"   → valor libre. Queda clavado.
 *   (ausente)   → heredar de la capa de arriba.
 *
 * Se guarda como string con prefijo y no como `{ tipo, valor }` por dos razones.
 * Peso: un bloque con 8 propiedades pasa de ~90 a ~330 bytes, y ese Json se
 * re-serializa entero en cada guardado y viaja en cada Server Action. Y tipado:
 * `` `$${TokenColor}` `` es una unión de 14 literales, mientras que la rama
 * libre de la forma objeto sería `valor: string` y aceptaría cualquier cosa.
 *
 * Sin colisión con los merge tags: esos son `${contacto.nombre}`, con llave, y
 * la regex de `aplicarMergeTags` exige `\$\{`. Un `$acento` pelado no matchea.
 */
export type ValorColor = `$${TokenColor}` | `#${string}`;

/**
 * Las partes de un bloque que se pueden pintar por separado.
 *
 * Es por ROL y no un objeto plano por bloque porque un `hero` tiene título,
 * subtítulo y botón adentro: con un solo objeto habría que inventar prefijos
 * (`btnFondo`, `subTamano`) y la capa de documento —"todos los títulos de este
 * mail"— quedaría inexpresable.
 */
export type RolEstilo =
  /** El contenedor del bloque: fondo, padding, borde, radio. */
  | "caja"
  | "titulo"
  | "subtitulo"
  | "cuerpo"
  | "boton"
  | "imagen"
  /** Precio tachado, variante, cantidad, "y 3 productos más". */
  | "nota";

export const ROLES: readonly RolEstilo[] = [
  "caja", "titulo", "subtitulo", "cuerpo", "boton", "imagen", "nota",
];

/**
 * Plano a propósito: cada capa de la cascada es UN spread. Nada anidado.
 *
 * ⚠️ Todo opcional, y **"heredar" es la ausencia de la clave, nunca un
 * centinela** (`""`, `"auto"`, `null`). La legibilidad contextual y el modo
 * oscuro del cliente necesitan responder "¿este color lo puso una persona?", y
 * eso solo se sabe con `"color" in estilo`. Es la misma convención que ya usa
 * el TemaSelector, que resetea con `undefined`.
 */
export interface EstiloBloque {
  /* color */
  color?: ValorColor;
  fondo?: ValorColor;
  /* tipografía */
  fuente?: keyof typeof FUENTES;
  /** px */
  tamano?: number;
  peso?: 400 | 500 | 600 | 700;
  /** múltiplo (1.4 = 140%) */
  interlinea?: number;
  /** px de letter-spacing */
  espaciado?: number;
  align?: "left" | "center" | "right";
  mayusculas?: boolean;
  subrayado?: boolean;
  /* caja */
  padX?: number;
  padY?: number;
  radio?: number;
  bordeAncho?: number;
  bordeColor?: ValorColor;
  bordeEstilo?: "solid" | "dashed";
  /* medida */
  /** % del ancho disponible */
  ancho?: number;
  /** px */
  alto?: number;
  /* responsive */
  ocultarMovil?: boolean;
  ocultarEscritorio?: boolean;
}

export type Estilos = Partial<Record<RolEstilo, EstiloBloque>>;

// ─────────────────────────────────────────────────────────────────────────────
// Lista blanca y clamps
//
// Lo que NO está acá no se puede escribir desde el Json, y por lo tanto no puede
// llegar al HTML. Quedan afuera a propósito:
//
//   position   → Gmail lo elimina (es lo que hoy rompe el ▶ del bloque video)
//   flex/grid/float → Outlook de escritorio no los conoce; el layout va con <table>
//   transform, box-shadow, opacity, filter → inconsistentes o ignorados
//   calc()/var()/rem/em/%  en tipografía → Outlook rompe. Todo en px.
//   margen negativo → varios clientes lo descartan
//   fuentes web/@font-face → Outlook y Gmail las bajan igual (ver tema.ts)
//   SVG → ningún cliente lo rasteriza confiable, y es vector de XSS al subir
// ─────────────────────────────────────────────────────────────────────────────

/** Rango de cada número, en un solo lugar. */
export const RANGOS = {
  //     mín  máx     por qué el tope
  tamano:      [10, 48],  // <10 ilegible; >48 desborda 600px y explota en móvil
  interlinea:  [1, 2.4],  // debajo de 1 los renglones se pisan
  espaciado:   [-1, 10],  // negativo fuerte pega las letras en Outlook
  padX:        [0, 64],   // 64 ya deja 470px útiles sobre 600
  padY:        [0, 64],
  radio:       [0, 32],   // de acá sale el `arcsize` del botón VML
  bordeAncho:  [0, 8],
  ancho:       [10, 100], // %
  alto:        [4, 400],  // px
} as const satisfies Record<string, readonly [number, number]>;

const PESOS = [400, 500, 600, 700] as const;
const ALINEACIONES = ["left", "center", "right"] as const;
const BORDES = ["solid", "dashed"] as const;

/** `#fff` o `#f59e0b`. Nada más: ni `rgb()`, ni nombres, ni `transparent`. */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * ¿Es un color que se puede escribir en el HTML?
 *
 * No es paranoia de más: `esc()` no escapa comillas y los colores se interpolan
 * dentro de un atributo `style="…"`, así que un valor con comillas se escapa del
 * atributo. Como el preview del editor corre en un iframe que hereda el origen
 * del panel, eso sería XSS almacenado. **Ningún string del Json llega al HTML
 * sin pasar por acá.**
 */
export function esColorLibre(v: unknown): v is `#${string}` {
  return typeof v === "string" && HEX.test(v.trim());
}

export function esToken(v: unknown): v is `$${TokenColor}` {
  return (
    typeof v === "string" &&
    v.startsWith("$") &&
    (TOKENS_COLOR as readonly string[]).includes(v.slice(1))
  );
}

/** Un color válido, o `undefined` — que significa "heredar", no "negro". */
export function sanearColor(v: unknown): ValorColor | undefined {
  if (esToken(v)) return v;
  if (esColorLibre(v)) return v.trim().toLowerCase() as `#${string}`;
  return undefined;
}

/** Número dentro de rango, o `undefined`. Redondea salvo la interlínea. */
function sanearNum(v: unknown, rango: readonly [number, number], decimales = false): number | undefined {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  const [min, max] = rango;
  const acotado = Math.min(max, Math.max(min, n));
  return decimales ? Math.round(acotado * 100) / 100 : Math.round(acotado);
}

function sanearEnum<T extends string | number>(v: unknown, valores: readonly T[]): T | undefined {
  return (valores as readonly unknown[]).includes(v) ? (v as T) : undefined;
}

function sanearBool(v: unknown): true | undefined {
  // Solo `true` se guarda: un `false` es lo mismo que no estar, y guardarlo
  // engorda el Json y arruina el "¿lo puso una persona?" de la cascada.
  return v === true ? true : undefined;
}

/**
 * Un `EstiloBloque` que viene de la base, filtrado contra la lista blanca.
 *
 * Devuelve `undefined` si no quedó nada: un `{}` colgado de cada rol de cada
 * bloque es puro peso, y además haría que `"caja" in estilos` diera `true` para
 * un bloque que nadie tocó.
 */
export function sanearEstiloBloque(v: unknown): EstiloBloque | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const x = v as Record<string, unknown>;

  const e: EstiloBloque = {};
  const poner = <K extends keyof EstiloBloque>(k: K, valor: EstiloBloque[K] | undefined) => {
    if (valor !== undefined) e[k] = valor;
  };

  poner("color", sanearColor(x.color));
  poner("fondo", sanearColor(x.fondo));
  poner("bordeColor", sanearColor(x.bordeColor));

  poner("fuente", sanearEnum(x.fuente, Object.keys(FUENTES) as (keyof typeof FUENTES)[]));
  poner("tamano", sanearNum(x.tamano, RANGOS.tamano));
  poner("peso", sanearEnum(x.peso, PESOS));
  poner("interlinea", sanearNum(x.interlinea, RANGOS.interlinea, true));
  poner("espaciado", sanearNum(x.espaciado, RANGOS.espaciado));
  poner("align", sanearEnum(x.align, ALINEACIONES));
  poner("mayusculas", sanearBool(x.mayusculas));
  poner("subrayado", sanearBool(x.subrayado));

  poner("padX", sanearNum(x.padX, RANGOS.padX));
  poner("padY", sanearNum(x.padY, RANGOS.padY));
  poner("radio", sanearNum(x.radio, RANGOS.radio));
  poner("bordeAncho", sanearNum(x.bordeAncho, RANGOS.bordeAncho));
  poner("bordeEstilo", sanearEnum(x.bordeEstilo, BORDES));

  poner("ancho", sanearNum(x.ancho, RANGOS.ancho));
  poner("alto", sanearNum(x.alto, RANGOS.alto));

  poner("ocultarMovil", sanearBool(x.ocultarMovil));
  poner("ocultarEscritorio", sanearBool(x.ocultarEscritorio));

  return Object.keys(e).length ? e : undefined;
}

/** Lo mismo, para el mapa completo de roles. `undefined` si no quedó ninguno. */
export function sanearEstilos(v: unknown): Estilos | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const x = v as Record<string, unknown>;

  const out: Estilos = {};
  for (const rol of ROLES) {
    const e = sanearEstiloBloque(x[rol]);
    if (e) out[rol] = e;
  }
  return Object.keys(out).length ? out : undefined;
}
