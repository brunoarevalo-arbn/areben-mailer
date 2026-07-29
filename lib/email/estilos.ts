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

import { FUENTES, esColorOscuro, type Paleta } from "./tema";
import type { TipoBloque } from "./bloques";

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

// ─────────────────────────────────────────────────────────────────────────────
// La cascada
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El piso de "heredar": lo que cada rol vale cuando nadie tocó nada.
 *
 * Son los mismos números que hasta ahora estaban escritos a mano dentro de cada
 * `case` del renderer. Que estén acá es lo que permite que la capa de documento
 * —"en este mail todos los títulos son Georgia 32"— exista.
 */
const BASE: Record<RolEstilo, EstiloBloque> = {
  caja: { padX: 32 },
  titulo: { color: "$texto", tamano: 26, interlinea: 1.25, align: "left" },
  subtitulo: { color: "$medio", tamano: 17, interlinea: 1.5, align: "left" },
  cuerpo: { color: "$cuerpo", tamano: 16, interlinea: 1.6, align: "left" },
  boton: { color: "$sobreAcento", fondo: "$acento", tamano: 16, peso: 600, radio: 8, padX: 32, padY: 14 },
  imagen: { radio: 8 },
  nota: { color: "$tenue", tamano: 13 },
};

/**
 * Lo que cambia según el bloque.
 *
 * El título de un `hero` mide 30px, el de una `seccion` 22 y el del bloque
 * `titulo` 26. Sin este escalón habría que elegir uno y romper los otros dos.
 */
const BASE_POR_TIPO: Partial<Record<TipoBloque, Estilos>> = {
  // Los mismos números que estaban escritos dentro del shell cuando el
  // encabezado era HTML fijo: 18px, negrita, 1px de espaciado y centrado.
  encabezado: {
    caja: { padY: 12, padX: 0 },
    titulo: { tamano: 18, peso: 700, espaciado: 1, align: "center" },
  },
  hero: {
    caja: { padX: 32, padY: 36 },
    titulo: { tamano: 30, interlinea: 1.2 },
    subtitulo: { tamano: 17, interlinea: 1.5 },
  },
  seccion: {
    caja: { padX: 32, padY: 32 },
    titulo: { tamano: 22, interlinea: 1.3 },
    // El texto de una sección es acompañamiento, no cuerpo: por eso va en el
    // tono medio y no en el de párrafo. Es el rol `subtitulo` con otra medida.
    subtitulo: { tamano: 16, interlinea: 1.6 },
  },
  cupon: {
    caja: {
      fondo: "$cuponFondo", radio: 12, padX: 24, padY: 24,
      bordeAncho: 2, bordeEstilo: "dashed", bordeColor: "$acento",
    },
    titulo: { color: "$cuponTexto", tamano: 26, peso: 700, espaciado: 3 },
    cuerpo: { tamano: 16 },
  },
  productos: { cuerpo: { tamano: 14 } },
  carrito: { titulo: { tamano: 15, interlinea: 1.35, peso: 600 } },
  redes: { cuerpo: { color: "$link", tamano: 14 } },
};

/** Todo resuelto a valores que se pueden escribir: hex, px, enums. */
export interface EstiloResuelto extends Omit<EstiloBloque, "color" | "fondo" | "bordeColor" | "fuente"> {
  color: string;
  fondo?: string;
  bordeColor?: string;
  /** El stack completo, no la clave. */
  fuente?: string;
  /**
   * Qué propiedades eligió una persona — las capas (b) y (c), no el BASE.
   *
   * Es el dato que separa "así se ve un título" de "así quiero ESTE título", y
   * de él dependen tres cosas: que `extra()` agregue solo lo elegido (y que por
   * lo tanto un mail sin estilos salga byte por byte como salía antes), que el
   * texto se recalcule contra el fondo real del bloque cuando nadie eligió el
   * color, y que el modo oscuro del cliente pueda repintar sin pisar una
   * decisión de quien armó el mail.
   */
  elegidas: ReadonlySet<string>;
  /** Atajos de lo mismo, que son los dos casos que más se preguntan. */
  autoColor: boolean;
  autoFondo: boolean;
}

export interface CtxEstilo {
  pal: Paleta;
  /** Capa (b): estilos del documento. */
  doc?: Estilos;
  /** Capa (c): estilos de este bloque. */
  propio?: Estilos;
}

/** `$acento` → el hex de la paleta. Un hex se devuelve tal cual. */
function resolverColor(v: ValorColor | undefined, pal: Paleta): string | undefined {
  if (!v) return undefined;
  if (v.startsWith("$")) {
    const t = pal[v.slice(1) as TokenColor];
    return typeof t === "string" ? t : undefined;
  }
  return v;
}

/**
 * Un rol, con las cuatro capas aplicadas en orden.
 *
 * `sobre` es el fondo REAL sobre el que se apoya este rol, cuando no es el del
 * mail (el `bg` de un hero, el de una sección). Solo se usa si el color quedó
 * heredado: si alguien lo eligió, se respeta aunque quede ilegible — es su mail.
 */
export function resolverEstilo(
  tipo: TipoBloque,
  rol: RolEstilo,
  ctx: CtxEstilo,
  sobre?: string,
): EstiloResuelto {
  const mezclado: EstiloBloque = {
    ...BASE[rol],
    ...(BASE_POR_TIPO[tipo]?.[rol] ?? {}),
    ...(ctx.doc?.[rol] ?? {}),
    ...(ctx.propio?.[rol] ?? {}),
  };

  // "¿Lo eligió una persona?" se responde mirando las capas de arriba, no el
  // mezclado — el BASE también escribe la clave.
  const elegidas = new Set<string>([
    ...Object.keys(ctx.doc?.[rol] ?? {}),
    ...Object.keys(ctx.propio?.[rol] ?? {}),
  ]);
  const autoColor = !elegidas.has("color");
  const autoFondo = !elegidas.has("fondo");

  let color = resolverColor(mezclado.color, ctx.pal) ?? ctx.pal.cuerpo;
  // Legibilidad contextual: generaliza lo que hoy hacen hero, seccion y cupon.
  if (autoColor && sobre) {
    const t = tonosSobre(sobre);
    color = rol === "titulo" ? t.texto : rol === "nota" ? t.medio : rol === "subtitulo" ? t.medio : t.cuerpo;
  }

  const { color: _c, fondo: _f, bordeColor: _b, fuente: _fu, ...resto } = mezclado;
  return {
    ...resto,
    color,
    fondo: resolverColor(mezclado.fondo, ctx.pal),
    bordeColor: resolverColor(mezclado.bordeColor, ctx.pal),
    fuente: mezclado.fuente ? FUENTES[mezclado.fuente] : undefined,
    elegidas,
    autoColor,
    autoFondo,
  };
}

/**
 * Colores de texto legibles sobre un fondo cualquiera.
 *
 * Vive acá y no en render.ts porque ahora lo necesita la cascada. Es la misma
 * tabla de siempre.
 */
export function tonosSobre(bg: string): { texto: string; cuerpo: string; medio: string } {
  return esColorOscuro(bg)
    ? { texto: "#fafafa", cuerpo: "#d5d4d4", medio: "#b8b8b8" }
    : { texto: "#171717", cuerpo: "#404040", medio: "#525252" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Emisión
//
// Los bloques siguen escribiendo su plantilla de siempre y le interpolan los
// valores resueltos — por eso un mail sin estilos sale byte por byte igual que
// antes. `extra()` agrega SOLO lo que alguien eligió y la plantilla no usa.
// ─────────────────────────────────────────────────────────────────────────────

export const px = (n: number) => `${Math.round(n)}px`;

/**
 * `padding`, en la forma corta cuando los dos lados son iguales.
 *
 * No es cosmética del código: `padding:32px` y `padding:32px 32px` significan lo
 * mismo pero son bytes distintos, y el golden que fija "el mail no cambió"
 * compara texto. Escribirlo como siempre se escribió deja el diff limpio.
 */
export const padCss = (y?: number, x?: number): string => {
  if (y === undefined && x === undefined) return "";
  const py = y ?? 0;
  const pxx = x ?? 0;
  return `padding:${py === pxx ? px(py) : `${px(py)} ${px(pxx)}`}`;
};

/**
 * Lo que una persona eligió y la plantilla del bloque no escribió.
 *
 * Dos filtros, y los dos importan:
 *
 * - **Solo lo elegido.** Si emitiera también los valores del BASE, un bloque sin
 *   estilos saldría con declaraciones que antes no tenía (`line-height` en el
 *   texto de un cupón, por ejemplo) y el mail cambiaría sin que nadie lo pida.
 *   La plantilla ya escribe lo que siempre escribió; acá va lo nuevo.
 * - **Menos `yaUsadas`.** Lo que el `case` interpola por su cuenta: repetirlo
 *   duplicaría la declaración.
 *
 * Devuelve `""` o algo que arranca con `;`, para pegarlo al final de un
 * `style="…"` sin pensar.
 */
export function extra(e: EstiloResuelto, yaUsadas: readonly (keyof EstiloResuelto)[] = []): string {
  const usadas = new Set<string>(yaUsadas as readonly string[]);
  const out: string[] = [];
  const poner = (k: keyof EstiloResuelto, css: string) => {
    if (!usadas.has(k) && e.elegidas.has(k) && e[k] !== undefined) out.push(css);
  };

  poner("fuente", `font-family:${e.fuente}`);
  poner("tamano", `font-size:${px(e.tamano!)}`);
  poner("peso", `font-weight:${e.peso}`);
  poner("interlinea", `line-height:${e.interlinea}`);
  poner("espaciado", `letter-spacing:${px(e.espaciado!)}`);
  poner("align", `text-align:${e.align}`);
  if (!usadas.has("mayusculas") && e.elegidas.has("mayusculas") && e.mayusculas) out.push("text-transform:uppercase");
  if (!usadas.has("subrayado") && e.elegidas.has("subrayado") && e.subrayado) out.push("text-decoration:underline");
  poner("fondo", `background:${e.fondo}`);
  poner("radio", `border-radius:${px(e.radio!)}`);
  if (!usadas.has("bordeAncho") && e.elegidas.has("bordeAncho") && e.bordeAncho) {
    out.push(`border:${px(e.bordeAncho)} ${e.bordeEstilo ?? "solid"} ${e.bordeColor ?? e.color}`);
  }

  return out.length ? ";" + out.join(";") : "";
}
