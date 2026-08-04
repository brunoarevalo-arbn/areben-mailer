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

import { FUENTES, esColorOscuro, luminancia, type Paleta } from "./tema";
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
 * Cómo se llama cada token en el panel.
 *
 * El nombre importa más de lo que parece: el selector de tokens tiene que ganarle
 * al color picker, y le gana si lo que ofrece se entiende ("Acento de la marca")
 * en vez de parecer jerga ("acento"). Lo que queda como token se repinta cuando
 * el comerciante cambia su color — ese es el argumento de venta.
 */
export const TOKEN_LABEL: Record<TokenColor, string> = {
  fondo: "Fondo de la página",
  tarjeta: "Fondo del contenido",
  borde: "Borde",
  bordeSuave: "Borde suave",
  texto: "Texto fuerte",
  cuerpo: "Texto de párrafo",
  medio: "Texto medio",
  tenue: "Texto tenue",
  acento: "Acento de la marca",
  sobreAcento: "Sobre el acento",
  link: "Links",
  seccion: "Fondo de sección",
  cuponFondo: "Fondo del cupón",
  cuponTexto: "Texto del cupón",
};

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
  /**
   * ⚠️ A diferencia de `fuente`, esta se ve en TODOS lados: `font-style` no
   * descarga nada, el aparato usa la versión inclinada de la letra que ya tiene.
   * La excepción es Impact, que no tiene una y el sistema la sintetiza torcida.
   */
  italica?: boolean;
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

function sanearBool(v: unknown): boolean | undefined {
  // 🔴 **El `false` se guarda, y guardarlo es todo el punto.** Hasta el
  // 4-ago-2026 acá se tiraba, con el argumento de que "un false es lo mismo que
  // no estar". No lo es: en una cascada, *no estar* significa **heredar**, y una
  // capa de abajo puede traer un `true`. Sin poder escribir un `false` no había
  // forma de APAGAR desde el bloque algo que la plantilla prendió en la capa de
  // documento — destildar la casilla escribía "heredar" y el documento seguía
  // ganando.
  //
  // Se veía como "escribo el título en minúscula y me sale en mayúscula igual":
  // siete presets ponen `titulo.mayusculas: true` a nivel documento. El caso ya
  // estaba anotado como bug conocido en `familias/editorial.ts`, donde un
  // `mayusculas: false` no apagaba el "VER COLECCIÓN" de la portada.
  //
  // ⚠️ Los cuatro consumidores preguntan por el VALOR, nunca por la presencia
  // (`extra()` acá, y las dos clases de `shell.ts`), así que un `false` explícito
  // no emite nada — que es exactamente lo que se quiere— y encima le gana a la
  // capa de abajo porque la clave existe en `elegidas`.
  return typeof v === "boolean" ? v : undefined;
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
  poner("italica", sanearBool(x.italica));

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
  // La misma grilla, así que las mismas medidas: si divergieran, cambiar un
  // bloque elegido a mano por uno automático movería el diseño del mail.
  "productos-dinamicos": { cuerpo: { tamano: 14 } },
  carrito: { titulo: { tamano: 15, interlinea: 1.35, peso: 600 } },
  redes: { cuerpo: { color: "$link", tamano: 14 } },
  menu: { cuerpo: { color: "$texto", tamano: 14, peso: 600 } },
  // Medidas de columna, más chicas que un `titulo`/`texto` sueltos porque
  // comparten la mitad del ancho del mail.
  // El botón sigue el mismo criterio: adentro de una celda, los 32 px de
  // padding lateral del botón de cuerpo entero no entran —con cuatro celdas la
  // columna mide ~138 px— y saldría un botón más ancho que su tarjeta.
  columnas: {
    titulo: { tamano: 18, peso: 700, interlinea: 1.3 },
    cuerpo: { tamano: 14, interlinea: 1.5 },
    boton: { tamano: 14, padX: 18, padY: 10 },
  },
  // Sin margen lateral por default: la escotilla de HTML crudo es a sangre
  // salvo que alguien elija lo contrario desde la pestaña Estilo.
  html: { caja: { padX: 0 } },
};

/**
 * Qué roles dibuja de verdad cada bloque.
 *
 * Es lo que el panel de estilo usa para no ofrecer controles que no hacen nada:
 * un `divisor` no tiene título, y un control de tipografía ahí es una perilla
 * desconectada — la peor clase de bug de UI, porque no falla, simplemente no
 * pasa nada.
 *
 * ⚠️ **Espeja los `e("…")` de `renderBloque`.** Si un bloque empieza a usar un
 * rol nuevo, se agrega acá o el control no aparece nunca. El `espaciador` no
 * lleva ninguno a propósito: es un `div` con alto y nada más.
 */
export const ROLES_POR_TIPO: Record<TipoBloque, readonly RolEstilo[]> = {
  // Sin `imagen`: el logo se dibuja con el ancho del bloque y no toma el radio.
  encabezado: ["caja", "titulo"],
  titulo: ["caja", "titulo"],
  texto: ["caja", "cuerpo"],
  boton: ["caja", "boton"],
  imagen: ["caja", "imagen"],
  // "boton" entró con el botón por tarjeta (2-ago-2026): una grilla sin
  // `botonTexto` no dibuja ninguno, igual que `seccion` con el texto vacío.
  productos: ["caja", "cuerpo", "nota", "imagen", "boton"],
  "productos-dinamicos": ["caja", "cuerpo", "nota", "imagen", "boton"],
  carrito: ["caja", "titulo", "nota", "imagen"],
  // "imagen" solo pesa en la variante de dos fotos; en las de texto no se dibuja
  // ningún `<img>`, así que ofrecer su control ahí sería una perilla suelta.
  // "boton" entró con el botón por celda (2-ago-2026): una celda sin botón no
  // dibuja ninguno, igual que `seccion` con el `botonTexto` vacío.
  columnas: ["caja", "imagen", "titulo", "cuerpo", "boton"],
  video: ["caja", "imagen", "boton"],
  redes: ["caja", "cuerpo"],
  menu: ["caja", "cuerpo"],
  divisor: ["caja"],
  espaciador: [],
  // Ídem: la foto de la portada va a sangre, sin radio.
  hero: ["caja", "titulo", "subtitulo", "boton"],
  seccion: ["caja", "titulo", "subtitulo", "boton"],
  cupon: ["caja", "titulo", "cuerpo", "boton"],
  html: ["caja"],
};

/**
 * Qué propiedades emite de verdad cada rol.
 *
 * Espeja lo que `renderBloque` y `extra()` escriben. No es documentación: es lo
 * que el panel usa para no dibujar una perilla desconectada, que es la peor
 * clase de bug de UI —no falla, simplemente no pasa nada y quien lo usa piensa
 * que el mail está roto.
 *
 * ⚠️ **`ancho` y `alto` no están en ninguna lista.** Existen en `EstiloBloque` y
 * el saneador los acepta, pero hoy `extra()` no los emite: ofrecerlos sería
 * prometer algo que el mail no hace.
 */
const TIPOGRAFIA = [
  "color", "tamano", "peso", "interlinea", "espaciado", "align",
  "fuente", "mayusculas", "subrayado", "italica",
] as const satisfies readonly (keyof EstiloBloque)[];

const PROPS_POR_ROL: Record<RolEstilo, readonly (keyof EstiloBloque)[]> = {
  // La caja depende del bloque: ver `propsCaja`.
  caja: [],
  titulo: TIPOGRAFIA,
  subtitulo: TIPOGRAFIA,
  cuerpo: TIPOGRAFIA,
  // La nota (precio tachado, variante, "y 3 más") se dibuja sin `text-align`
  // propio: sigue al bloque que la contiene.
  nota: ["color", "tamano", "peso", "espaciado", "fuente", "mayusculas", "subrayado", "italica"],
  boton: ["color", "fondo", "tamano", "peso", "radio", "padX", "padY", "fuente", "espaciado", "mayusculas", "italica"],
  imagen: ["radio"],
};

/** Lo que `pad()` le da a la caja de cualquier bloque: margen lateral y visibilidad. */
const CAJA_BASE = ["padX", "ocultarMovil", "ocultarEscritorio"] as const satisfies readonly (keyof EstiloBloque)[];

/**
 * La caja del bloque, que es el rol menos parejo de todos.
 *
 * La mayoría de los bloques se envuelven en `pad()`, que solo aplica el margen
 * lateral y las clases de visibilidad. Los cuatro que dibujan su propio
 * contenedor —encabezado, portada, sección y cupón— soportan más, y dos de ellos
 * **no pasan por `clasesDe`**, así que ocultarlos en celular no funcionaría.
 */
function propsCaja(tipo: TipoBloque): readonly (keyof EstiloBloque)[] {
  switch (tipo) {
    case "encabezado":
      return ["padX", "padY", "align", "bordeColor", "ocultarMovil", "ocultarEscritorio"];
    case "hero":
    case "seccion":
      return ["fondo", "padX", "padY", "align"];
    // 🔑 El menú es el quinto que puede dibujar su propio contenedor, y solo
    // cuando alguien elige el fondo: sin `fondo` sigue pasando por `pad()`. Entró
    // por la regla 5 de `PLANTILLAS.md` (6 referencias con el menú adentro de una
    // banda). ⚠️ `align` NO va acá: la alineación de la barra la gobierna
    // `cuerpo.align`, y dos perillas para lo mismo es el bug que documenta
    // `SIN_EFECTO`. `padY` mueve el margen incluso sin banda, así que no es una
    // perilla que dependa de otra.
    case "menu":
      return ["fondo", "padX", "padY", "ocultarMovil", "ocultarEscritorio"];
    case "cupon":
      return ["fondo", "padX", "padY", "radio", "bordeAncho", "bordeEstilo", "bordeColor"];
    case "divisor":
      return ["padX", "bordeAncho", "bordeEstilo", "bordeColor", "ocultarMovil", "ocultarEscritorio"];
    default:
      return CAJA_BASE;
  }
}

/**
 * Lo que un bloque puntual NO respeta, aunque su rol sí lo respete en general.
 *
 * Casi todo es una misma historia contada tres veces: **quién gana la
 * alineación**. `titulo`, `texto` y `boton` la tienen en su formulario de
 * contenido y el renderer escribe `b.align ?? t.align`, así que la del estilo no
 * llega nunca; en la portada, la sección y el cupón la gana **la caja**, que es
 * la que escribe el `text-align` que cascadea al interior. Ofrecer el control
 * igual sería poner dos perillas para lo mismo y que solo funcione una.
 *
 * ⚠️ Esta lista no se escribe a ojo: sale de correr
 * `scripts/probar-panel-estilo.ts`, que ejercita el renderer control por control
 * y falla si el panel ofrece algo que no mueve nada.
 */
const SIN_EFECTO: Partial<Record<TipoBloque, Partial<Record<RolEstilo, readonly (keyof EstiloBloque)[]>>>> = {
  // Las mayúsculas del encabezado se aplican en JS sobre el string, no con CSS:
  // están en Contenido, no acá. `text-transform` no es confiable en Outlook.
  encabezado: { titulo: ["mayusculas"] },
  titulo: { titulo: ["align"] },
  texto: { cuerpo: ["align"] },
  carrito: { titulo: ["align"] },
  redes: { cuerpo: ["align", "subrayado"] },
  // 🔑 `caja.align` SÍ tiene efecto desde el 2-ago-2026: es **una sola perilla
  // para todo el interior** de la portada y de la banda. El `text-align` va en
  // la caja y cascadea al `<h1>`, al `<p>` y al botón —que es `inline-block`—,
  // así que alinear los tres por separado sería tres controles para una decisión
  // y con tres formas de dejarlos desalineados entre sí. Por eso `titulo` y
  // `subtitulo` siguen acá: los gobierna la caja.
  //
  // Entró por la regla de 3 de `PLANTILLAS.md`: el texto de la portada va fuera
  // del centro en R-004, R-015, R-017 y R-018 — cuatro referencias. Hasta hoy
  // "centrado por diseño" era una decisión del renderer que ninguna captura
  // respaldaba. El default sigue siendo `center`, así que nada ya publicado se
  // mueve: lo resuelve `alineacion()`, que pregunta por `elegidas` y no por el
  // valor.
  hero: { titulo: ["align"], subtitulo: ["align"] },
  seccion: { titulo: ["align"], subtitulo: ["align"] },
  cupon: { titulo: ["align", "interlinea"], cuerpo: ["align"] },
  // El "botón" del video es el círculo con el ▶ encima de la miniatura: toma
  // color, fondo y redondeo, y nada de tipografía porque no tiene texto.
  video: { boton: ["tamano", "peso", "padX", "padY", "fuente", "espaciado", "mayusculas", "italica"] },
};

/** Los controles que el panel puede ofrecer para un rol de un bloque. */
export function propsDeRol(tipo: TipoBloque, rol: RolEstilo): readonly (keyof EstiloBloque)[] {
  const base = rol === "caja" ? propsCaja(tipo) : PROPS_POR_ROL[rol];
  const fuera = SIN_EFECTO[tipo]?.[rol];
  return fuera ? base.filter((k) => !fuera.includes(k)) : base;
}

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
 * La alineación de un rol, con un default que **de verdad se usa**.
 *
 * 🔴 Existe porque `e.align ?? "center"` es letra muerta en todo el motor: el
 * `BASE` de `titulo`, `subtitulo` y `cuerpo` ya escribe `align:"left"`, así que
 * `mezclado.align` nunca es `undefined` y el `??` no corre jamás. La etiqueta de
 * la fila de categorías se escribió con ese `?? "center"` y salió alineada a la
 * izquierda desde el primer día, contra seis referencias que la centran — es una
 * de las cosas que hacían que los clones no se parecieran a su captura.
 *
 * La pregunta correcta no es "¿hay valor?" sino **"¿lo eligió una persona?"**,
 * que es justo lo que responde `elegidas`. Misma convención que `extra()`.
 */
export function alineacion(
  e: EstiloResuelto,
  porDefecto: "left" | "center" | "right",
): "left" | "center" | "right" {
  return e.elegidas.has("align") ? e.align ?? porDefecto : porDefecto;
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

/**
 * El gris apagado del pie, que se dibuja sobre el **fondo de página** y no sobre
 * la tarjeta.
 *
 * 🔴 `pal.tenue` es un gris a propósito bajo de contraste y funciona contra un
 * fondo **extremo** —blanco o casi negro—, que era lo único que había hasta el
 * 2-ago-2026: todas las plantillas con `fondo` propio lo tenían en #111111 o en
 * #f0f0f0. Contra un fondo del medio desaparece; medido sobre el celeste
 * #18a8e8 de `final-sale`, el #a3a3a3 da **1,05:1**. Y en el pie vive el **link
 * de baja**, que es obligatorio y es lo último del mail que puede quedar
 * ilegible — por algo el pie no es un bloque que se pueda borrar.
 *
 * Contra un fondo del medio no hay gris que sirva, así que se va al extremo
 * contrario con la misma tabla que usa el resto del motor. Un fondo extremo
 * conserva el gris de siempre: **ninguna plantilla ya publicada se mueve**.
 */
export function tenueSobre(fondo: string, tenue: string): string {
  const l = luminancia(fondo);
  return l > 0.75 || l < 0.15 ? tenue : tonosSobre(fondo).medio;
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
  if (!usadas.has("italica") && e.elegidas.has("italica") && e.italica) out.push("font-style:italic");
  poner("fondo", `background:${e.fondo}`);
  poner("radio", `border-radius:${px(e.radio!)}`);
  if (!usadas.has("bordeAncho") && e.elegidas.has("bordeAncho") && e.bordeAncho) {
    out.push(`border:${px(e.bordeAncho)} ${e.bordeEstilo ?? "solid"} ${e.bordeColor ?? e.color}`);
  }

  return out.length ? ";" + out.join(";") : "";
}
