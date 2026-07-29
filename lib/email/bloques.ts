// Qué ES un mail: los tipos de bloque y su valor inicial. Nada de HTML.
//
// Vive aparte de render.ts para romper un ciclo: el normalizador del esquema
// (esquema.ts) necesita los tipos, y render.ts necesita al normalizador. Con los
// tipos acá, los dos importan de este archivo y nadie importa al otro.
//
// ⚠️ Puro: lo importan el SERVIDOR y el CLIENTE. Sin prisma, sin next/headers.
//
// Para no romper los imports que ya existen, render.ts re-exporta todo esto.

import type { Estilos } from "./estilos";
import type { Tema } from "./tema";

export interface ProductoEmail {
  nombre: string;
  precio: string;
  precioPromo?: string;
  imagen: string;
  url: string;
  /**
   * Variante elegida, ya legible: "iPhone 17 Pro Max · ROSA".
   *
   * Sale de `variant_values` del checkout de TN. Va aparte del nombre porque el
   * `name` que devuelve TN ya trae la variante entre paréntesis —"MAGSAFE CASE
   * (iPhone 17 Pro Max, ROSA)"— y repetirla se lee como un error.
   */
  variante?: string;
  /** Unidades. Solo se muestra si es > 1: un "Cantidad: 1" en cada línea es ruido. */
  cantidad?: number;
}

export interface Columna {
  imagen: string;
  url: string;
}

/**
 * Lo que todo bloque tiene, sea del tipo que sea.
 *
 * Se intersecta con la unión de abajo en vez de repetirse en cada variante. El
 * narrowing por `tipo` sigue funcionando: TypeScript distribuye la intersección
 * sobre la unión.
 */
export interface BloqueBase {
  /**
   * Identidad estable del bloque dentro del documento.
   *
   * No es cosmético. Sin esto la lista del editor se indexa por posición, y en
   * cuanto el panel de propiedades guarde "cuál está seleccionado", borrar el
   * bloque 2 hace que el 3 pase a ser el 2 y **el panel empiece a editar otro
   * bloque en silencio**. Opcional en el tipo solo para poder leer contenido
   * viejo: `leerContenido` se lo asigna a todo lo que entra.
   */
  id?: string;
  /** Override de estilo de ESTE bloque. Ver la cascada en estilos.ts. */
  estilo?: Estilos;
}

export type Bloque = BloqueBase &
  (
    /**
     * La cabecera de marca. Es el único bloque que se dibuja **fuera** de la
     * tarjeta de contenido, apoyado sobre el fondo de la página — que es
     * exactamente donde estuvo siempre, cuando lo escribía el shell a mano.
     *
     * Hay **uno solo por mail** y va primero: `leerContenido` lo acomoda y
     * `renderEmailHtml` lo saca de la lista antes de dibujar el cuerpo.
     */
    | {
        tipo: "encabezado";
        /**
         * Ausente = automático: el logo de la tienda si lo hay, si no el
         * nombre. `"logo"` sin `logo` cargado cae al de la tienda y después al
         * nombre; `"texto"` es la elección explícita de no mostrar el logo.
         */
        variante?: "texto" | "logo";
        /**
         * Vacío = el nombre de la cuenta.
         *
         * Que el default sea "vacío" y no "el nombre copiado adentro" es lo que
         * permite que un preset se comparta entre marcas sin que la bienvenida
         * de Zattia salga firmada por BDI. La marca se resuelve al renderizar.
         */
        texto?: string;
        logo?: string;
        /** Ancho del logo en px (40 – ancho útil del mail). */
        logoAncho?: number;
        /** A dónde lleva el click. Vacío = sin link. */
        url?: string;
        /** La barrita de acento debajo. Ausente = sí, que es lo que había. */
        linea?: boolean;
        /**
         * Ausente = sí. Va acá y no en `estilo.titulo.mayusculas` a propósito:
         * esto se aplica en JS sobre el string, y `text-transform` lo aplica el
         * cliente de mail —que en Outlook no es confiable.
         */
        mayusculas?: boolean;
      }
    | { tipo: "titulo"; texto: string; align?: "left" | "center" }
    | { tipo: "texto"; texto: string; align?: "left" | "center" }
    | { tipo: "boton"; texto: string; url: string; align?: "left" | "center"; full?: boolean }
    | { tipo: "imagen"; url: string; alt?: string }
    | { tipo: "productos"; items: ProductoEmail[] }
    // Placeholder: no se carga a mano. El procesador de automations le mete el
    // carrito real del contacto justo antes de enviar, EN ESTE LUGAR de la lista
    // — que es la diferencia con `productos`, que es una grilla curada.
    | { tipo: "carrito"; items?: ProductoEmail[]; restantes?: number }
    | { tipo: "columnas"; izq: Columna; der: Columna }
    | { tipo: "video"; imagen: string; url: string }
    | { tipo: "redes"; links: { red: string; url: string }[] }
    | { tipo: "divisor" }
    // Aire vertical y nada más. Parece de más hasta que se arma un diseño en serio:
    // la plantilla que motivó esto usa 12 espaciadores, de 5 a 75px, y sin ellos
    // los bloques se apilan pegados.
    | { tipo: "espaciador"; alto?: number }
    // Bloques "ricos"
    | { tipo: "hero"; imagen: string; titulo: string; subtitulo: string; botonTexto: string; botonUrl: string; bg: string }
    | { tipo: "seccion"; bg: string; titulo: string; texto: string; botonTexto: string; botonUrl: string }
    | { tipo: "cupon"; texto: string; codigo: string; botonTexto: string; botonUrl: string }
  );

export type TipoBloque = Bloque["tipo"];

/** Todos los tipos que existen. El editor arma su paleta con esto. */
export const TIPOS_BLOQUE = [
  "encabezado",
  "hero", "seccion", "cupon", "titulo", "texto", "boton", "imagen",
  "productos", "carrito", "columnas", "video", "redes", "divisor", "espaciador",
] as const satisfies readonly TipoBloque[];

/**
 * Cómo se llama cada bloque para quien arma el mail.
 *
 * Vive acá y no en el editor porque el nombre interno se filtraba a la pantalla
 * (la paleta decía "+ cupon", "+ espaciador") y esos son nombres de código: el
 * comerciante que abra esto no tiene por qué saber que a la portada le decimos
 * `hero`. El `satisfies` obliga a que un tipo nuevo traiga su etiqueta.
 */
export const ETIQUETA_BLOQUE = {
  encabezado: "Encabezado",
  hero: "Portada",
  seccion: "Sección con fondo",
  cupon: "Cupón",
  titulo: "Título",
  texto: "Texto",
  boton: "Botón",
  imagen: "Imagen",
  productos: "Productos",
  carrito: "Carrito abandonado",
  columnas: "Dos imágenes",
  video: "Video",
  redes: "Redes sociales",
  divisor: "Línea divisoria",
  espaciador: "Espacio en blanco",
} as const satisfies Record<TipoBloque, string>;

export interface ContenidoCampania {
  /**
   * Versión del esquema de bloques. La escribe `leerContenido`; nadie más.
   *
   * Existe porque estos Json son de los comerciantes: una vez que hay plantillas
   * guardadas afuera, cambiar la forma de un bloque sin poder migrarlo es una
   * pared. Ausente = v1, el formato anterior a que esto existiera.
   */
  v?: number;
  bloques: Bloque[];
  /**
   * Aspecto de ESTA campaña. Viaja dentro del Json `contenido` que ya existe en
   * `Campania` y `Automation`, así que no hizo falta ninguna migración — la base
   * se comparte con popups y `db:push` está prohibido.
   */
  tema?: Tema;
  /**
   * Capa (b) de la cascada: "en este mail, todos los títulos son así".
   *
   * Está para que armar un mail coherente no sea repetir el mismo override en
   * quince bloques — que es exactamente lo que hace que un mail quede desprolijo
   * y que después no se pueda re-marcar.
   */
  estilos?: Estilos;
}

/**
 * Id corto y único dentro de un documento.
 *
 * 8 hex = 32 bits. Con ~30 bloques por mail la chance de choque es de 1 en 10
 * millones, y `leerContenido` desduplica igual, así que no hace falta un UUID
 * entero: 36 caracteres por bloque son ~1 KB de Json que se re-serializa en cada
 * guardado y viaja en cada Server Action.
 */
export function nuevoId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID().slice(0, 8);
  return Math.random().toString(16).slice(2, 10).padEnd(8, "0");
}

/** Bloque inicial por tipo, compartido por todos los editores de contenido. */
export function nuevoBloque(tipo: TipoBloque): Bloque {
  const id = nuevoId();
  switch (tipo) {
    // Nace SIN texto y SIN variante: vacío significa "lo de esta cuenta" —el
    // nombre, y el logo si la tienda tiene uno—, y así el bloque es el mismo
    // para las tres marcas y para el comerciante que venga. Clavarle
    // `variante:"texto"` era decidir por él que no quería su logo.
    case "encabezado": return { id, tipo, texto: "", url: "" };
    case "titulo": return { id, tipo, texto: "Título", align: "left" };
    case "texto": return { id, tipo, texto: "Escribí tu mensaje. Podés usar ${contacto.nombre}.", align: "left" };
    case "boton": return { id, tipo, texto: "Ver más", url: "", align: "left", full: false };
    case "imagen": return { id, tipo, url: "", alt: "" };
    case "productos": return { id, tipo, items: [] };
    // Nace vacío A PROPÓSITO: si trajera productos de ejemplo, una automation
    // guardada con ellos se los mandaría a un cliente real. La muestra del
    // editor la pone el preview (`muestraCarrito`), no el dato.
    case "carrito": return { id, tipo, items: [] };
    case "columnas": return { id, tipo, izq: { imagen: "", url: "" }, der: { imagen: "", url: "" } };
    case "video": return { id, tipo, imagen: "", url: "" };
    case "redes": return { id, tipo, links: [{ red: "Instagram", url: "" }] };
    case "divisor": return { id, tipo };
    case "espaciador": return { id, tipo, alto: 24 };
    case "hero": return { id, tipo, imagen: "", titulo: "Título principal", subtitulo: "Un subtítulo que acompaña", botonTexto: "Ver más", botonUrl: "", bg: "#ffffff" };
    case "seccion": return { id, tipo, bg: "#faf7f0", titulo: "Título de sección", texto: "Texto de la sección.", botonTexto: "", botonUrl: "" };
    case "cupon": return { id, tipo, texto: "Usá este código en el checkout", codigo: "DESCUENTO10", botonTexto: "Comprar", botonUrl: "" };
  }
}

/** Copia de un bloque con identidad propia. Sin id nuevo, React colapsa las dos tarjetas. */
export function duplicarBloque(b: Bloque): Bloque {
  return { ...b, id: nuevoId() } as Bloque;
}
