// Lo que comparten todas las familias de plantillas: los tipos y las piezas que
// se repiten en cada preset.
//
// Vive aparte de `presets.ts` para romper el ciclo: `presets.ts` importa las
// familias y las familias necesitan `DefPreset` y los helpers. Si esos tipos
// vivieran en `presets.ts`, cada familia importaría a quien la importa.
//
// ⚠️ Puro: no importa prisma ni next/headers. Lo lee el servidor (crear campaña)
// y el navegador (las miniaturas de /plantillas).

import type { Bloque } from "@/lib/email/render";
import type { Estilos } from "@/lib/email/estilos";
import type { Tema } from "@/lib/email/tema";
import type { Trigger } from "@/lib/automations";

/** Lo que un preset sabe de la cuenta que lo instancia. */
export interface CtxPreset {
  /** Nombre de la marca. Va al copy, nunca a un campo que se guarde solo. */
  marca: string;
  /**
   * Sitio de la tienda, sin barra final. **Puede venir vacío** (cuenta recién
   * creada, sin TN conectada): en ese caso el botón se omite en vez de mandar a
   * un link roto, que es peor que no tener botón.
   */
  tienda: string;
}

/** Lo que devuelve un preset antes de pasar por `leerContenido`. */
export interface Armado {
  bloques: Bloque[];
  tema?: Tema;
  /**
   * Capa de documento: "en este mail, todos los títulos son así". Es lo que
   * hace que dos presets con los mismos bloques se vean distinto sin repetir
   * quince overrides.
   */
  estilos?: Estilos;
  /** Solo los de automation: el asunto sale del preset. */
  asunto?: string;
}

/**
 * En qué pestaña de la galería aparece.
 *
 * Existe porque `/plantillas` **renderiza solo la familia activa**: con 30+
 * plantillas, dibujar todas en cada visita manda más de un megabyte al navegador
 * de un comerciante que abre el panel desde el celular.
 *
 * Los presets de automation NO llevan familia: no salen en la galería.
 */
export type Familia = "venta" | "catalogo" | "producto" | "fechas" | "ciclo" | "editorial";

/** El orden de las pestañas y cómo se llaman en la UI. */
export const FAMILIAS: readonly { id: Familia; nombre: string; descripcion: string }[] = [
  { id: "catalogo", nombre: "Catálogo", descripcion: "Mostrar lo que vendés. Se llenan solas con tu tienda." },
  { id: "venta", nombre: "Venta", descripcion: "Ofertas, cupones y urgencia. Para vender hoy." },
  { id: "producto", nombre: "Producto", descripcion: "Un lanzamiento, un restock, un producto que merece su mail." },
  { id: "fechas", nombre: "Fechas", descripcion: "Las del calendario: Día de la Madre, Hot Sale, Navidad." },
  { id: "ciclo", nombre: "Ciclo de vida", descripcion: "Bienvenida, post-compra, reactivación, carrito." },
  { id: "editorial", nombre: "Editorial", descripcion: "Para escribir de verdad, no para vender." },
];

export interface DefPreset {
  id: string;
  nombre: string;
  descripcion: string;
  /** En qué pestaña de la galería va. Ausente = de automation, no sale ahí. */
  familia?: Familia;
  /** Solo los de automation: a qué evento de la tienda responden. */
  trigger?: Trigger;
  /** Solo los de automation: cuánto espera después del disparador. */
  esperaHoras?: number;
  arma: (ctx: CtxPreset) => Armado;
}

// ─────────────────────────────────────────────────────────────────────────────
// Piezas compartidas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un botón que solo existe si hay a dónde ir.
 *
 * Los bloques ricos dibujan el botón cuando `botonTexto` tiene algo, así que
 * vaciar el texto es la forma de no dibujarlo. Un `href=""` en un mail no es un
 * detalle: es un click que no lleva a ningún lado y no se puede arreglar después
 * de enviado.
 */
export const cta = (texto: string, url: string) => ({
  botonTexto: url ? texto : "",
  botonUrl: url,
});

/** El bloque rico que, por diseño, no lleva botón: es una banda de texto. */
export const sinBoton = { botonTexto: "", botonUrl: "" } as const;

/** Botón suelto, o nada. Mismo criterio que `cta`. */
export const botonSi = (texto: string, url: string, align: "left" | "center" = "left"): Bloque[] =>
  url ? [{ tipo: "boton", texto, url, align, full: false }] : [];

/**
 * Las redes nacen vacías a propósito: Tiendanube no nos las devuelve y no hay de
 * dónde sacarlas. El renderer filtra los links sin URL, así que el bloque no
 * dibuja nada hasta que el comerciante las cargue — no es un link roto, es un
 * lugar reservado en el diseño.
 */
export const redes: Bloque = {
  tipo: "redes",
  // Las tres que tienen icono (ver `lib/email/redes.ts`). Antes estaba Facebook,
  // que no lo tiene: cargarle la URL habría dejado el nombre en texto al lado de
  // dos iconos. Una red sin archivo se puede seguir escribiendo a mano —sale en
  // texto, que es el fallback— pero no la ofrecemos de fábrica.
  links: [
    { red: "Instagram", url: "" },
    { red: "TikTok", url: "" },
    { red: "WhatsApp", url: "" },
  ],
};

export const aire = (alto: number): Bloque => ({ tipo: "espaciador", alto });

/**
 * La banda de color que se tiñe sola con el tema de la marca.
 *
 * 🔑 `bg: ""` es el punto: el renderer cae a `pal.seccion`, que sale del tema
 * (beige `#faf7f0` en claro, `#1f1f1f` en oscuro). Hasta el 1-ago-2026 los
 * presets clavaban el hex a mano —`#f0fdf4`, `#fff7ed`, `#f5f7ff`— y esos tintes
 * se veían como manchas ajenas en una marca con acento propio, y peor en una con
 * tema oscuro: la misma plantilla salía igual en las tres marcas en vez de
 * parecerse a cada una.
 *
 * Un color se clava **solo cuando el color ES la plantilla** (la invitación de
 * fondo negro, el carrito oscuro), y ahí va anotado por qué.
 */
export const banda = (titulo: string, texto: string): Bloque =>
  ({ tipo: "seccion", bg: "", titulo, texto, ...sinBoton });
