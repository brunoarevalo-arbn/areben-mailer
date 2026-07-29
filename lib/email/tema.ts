// Aspecto del mail: lo que antes estaba cableado en render.ts.
//
// Había 12 colores hardcodeados, 600px fijos y el botón en ámbar. Eso alcanzaba
// mientras las tres marcas se parecían; deja de alcanzar cuando el aspecto es
// una decisión de quien arma la campaña y no de quien escribió el renderer.
//
// ⚠️ Este archivo lo importan el SERVIDOR y el CLIENTE (el preview del editor
// renderiza con el mismo código). Por eso es puro: sin prisma, sin next/headers.

/** Lo que se guarda. Todo opcional: un mail sin tema se ve como se veía siempre. */
export interface Tema {
  /** Punto de partida. Los colores de texto se derivan de acá. */
  base?: "claro" | "oscuro";
  /** Fondo de la página (por fuera de la tarjeta). */
  fondo?: string;
  /**
   * Fondo del área de contenido. Vacío = **igual al fondo de la página**, que es
   * el `transparent` del editor de BEE: la tarjeta desaparece y el mail queda a
   * sangre completa.
   */
  fondoContenido?: string;
  /** Color del botón. */
  acento?: string;
  /** Color de los links de texto. */
  link?: string;
  /** Ancho del contenido, 600-700. */
  ancho?: number;
  /** Clave de `FUENTES`. */
  fuente?: keyof typeof FUENTES;
  /** Va al `lang` del documento. */
  idioma?: string;
}

/**
 * Stacks de fuentes, todos **web-safe**.
 *
 * No es un selector libre a propósito. La plantilla que motivó esto pedía Open
 * Sans con un `<link>` a Google Fonts, y **Outlook y Gmail lo descartan**: el
 * mail cae al stack de respaldo igual, pero diseñado para una tipografía que
 * nadie ve. Estas se renderizan en todos lados sin descargar nada.
 */
export const FUENTES = {
  sistema: "Arial, Helvetica, sans-serif",
  georgia: "Georgia, 'Times New Roman', Times, serif",
  verdana: "Verdana, Geneva, sans-serif",
  trebuchet: "'Trebuchet MS', Helvetica, Arial, sans-serif",
  tahoma: "Tahoma, Verdana, Segoe, sans-serif",
  mono: "'Courier New', Courier, monospace",
} as const;

export const FUENTE_LABEL: Record<keyof typeof FUENTES, string> = {
  sistema: "Arial (la de siempre)",
  georgia: "Georgia (con serifa)",
  verdana: "Verdana",
  trebuchet: "Trebuchet",
  tahoma: "Tahoma",
  mono: "Monoespaciada",
};

/** Todo resuelto: ningún campo opcional. Es lo que consume el renderer. */
export interface Paleta {
  fondo: string;
  tarjeta: string;
  borde: string;
  bordeSuave: string;
  /** Títulos, nombres de producto, precios. */
  texto: string;
  /** Cuerpo de texto. */
  cuerpo: string;
  /** Subtítulos y textos de apoyo. */
  medio: string;
  /** Pies, precio tachado, variante y cantidad. */
  tenue: string;
  acento: string;
  /** Texto sobre el botón. */
  sobreAcento: string;
  link: string;
  /** Fondo por defecto del bloque `seccion`. */
  seccion: string;
  cuponFondo: string;
  cuponTexto: string;
  ancho: number;
  fuente: string;
  idioma: string;
  /** true si el fondo es oscuro: lo usan los bloques con `bg` propio. */
  esOscuro: boolean;
}

const CLARO = {
  fondo: "#f4f4f5",
  tarjeta: "#ffffff",
  borde: "#ececec",
  bordeSuave: "#e5e5e5",
  texto: "#171717",
  cuerpo: "#404040",
  medio: "#525252",
  tenue: "#a3a3a3",
  seccion: "#faf7f0",
  cuponFondo: "#fffbeb",
  cuponTexto: "#b45309",
};

// El oscuro no es el claro invertido: sobre fondo negro el texto blanco puro
// "vibra", así que el cuerpo va en gris muy claro y no en #ffffff.
const OSCURO = {
  fondo: "#0f0f0f",
  tarjeta: "#161616",
  borde: "#2a2a2a",
  bordeSuave: "#2a2a2a",
  texto: "#fafafa",
  cuerpo: "#d5d4d4",
  medio: "#b8b8b8",
  tenue: "#8a8a8a",
  seccion: "#1f1f1f",
  cuponFondo: "#1f1a10",
  cuponTexto: "#fbbf24",
};

const ACENTO_DEFECTO = "#f59e0b";

/** ¿Este color es oscuro? Luminancia relativa, para decidir el texto que va encima. */
export function esColorOscuro(hex: string): boolean {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  if ([r, g, b].some(Number.isNaN)) return false;
  // Coeficientes de luminancia percibida (Rec. 709).
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5;
}

/**
 * Tema → paleta completa. Nunca lanza: un color mal escrito se usa igual (el
 * cliente de mail lo ignora y cae al heredado), pero un tema roto no puede
 * impedir que salga la campaña.
 */
export function resolverPaleta(tema: Tema = {}): Paleta {
  const base = tema.base === "oscuro" ? OSCURO : CLARO;
  const fondo = tema.fondo?.trim() || base.fondo;
  // Vacío = "igual al fondo": es el `transparent` de BEE. La tarjeta se funde
  // con la página en vez de dibujar un recuadro sobre sí misma.
  const tarjeta = tema.fondoContenido?.trim() || base.tarjeta;
  const acento = tema.acento?.trim() || ACENTO_DEFECTO;

  return {
    ...base,
    fondo,
    tarjeta,
    acento,
    // El texto del botón se decide por el color del botón, no por el tema: un
    // acento amarillo con letras blancas encima no se lee, y es justo lo que
    // pasaría si esto fuera fijo.
    sobreAcento: esColorOscuro(acento) ? "#ffffff" : "#171717",
    link: tema.link?.trim() || base.medio,
    ancho: Math.min(700, Math.max(600, Math.round(tema.ancho ?? 600))),
    fuente: FUENTES[tema.fuente ?? "sistema"] ?? FUENTES.sistema,
    idioma: tema.idioma?.trim() || "es",
    esOscuro: esColorOscuro(tarjeta),
  };
}

/**
 * Tema de la marca + el de la campaña, campo por campo.
 *
 * El merge es por campo y no por objeto para que una campaña pueda cambiar solo
 * el color del botón sin perder el ancho y la fuente que definió la marca.
 */
export function combinarTema(marca?: Tema | null, propio?: Tema | null): Tema {
  return { ...(marca ?? {}), ...(propio ?? {}) };
}

/** Lee el tema guardado en un Json suelto (`Cuenta.config`, `contenido`). */
export function temaDe(valor: unknown): Tema | undefined {
  if (!valor || typeof valor !== "object") return undefined;
  const t = (valor as Record<string, unknown>).tema;
  return t && typeof t === "object" ? (t as Tema) : undefined;
}
