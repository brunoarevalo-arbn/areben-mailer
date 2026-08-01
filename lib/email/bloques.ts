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
  /** Solo para las variantes de texto del bloque `columnas`. */
  titulo?: string;
  texto?: string;
}

/**
 * De dónde salen los productos de un bloque dinámico.
 *
 * Vive acá —y no en `lib/tn`— porque este archivo es puro y lo importa el
 * editor: si la unión viviera del lado de Tiendanube, el `<Select>` del panel
 * arrastraría el cliente de la API al bundle del navegador. `lib/tn/products.ts`
 * importa el tipo desde acá, nunca al revés.
 *
 * `oferta` es la única que TN no sabe responder por sí sola: se filtra en casa.
 */
export type FuenteProductos = "destacados" | "recientes" | "oferta" | "categoria";

/** Lo que define QUÉ productos trae un bloque dinámico. */
export interface ConsultaProductos {
  fuente: FuenteProductos;
  categoriaId?: string;
  n?: number;
}

/**
 * Cuántas tarjetas por fila en el CELULAR. En escritorio siempre son dos.
 *
 * ⚠️ **Ausente = 1**, que es como se vieron todos los mails hasta el 1-ago-2026:
 * la grilla se dibuja de a dos y la clase `m-col` la apila en el corte móvil.
 * Cualquier otro default le cambiaría el aspecto en el teléfono a toda campaña y
 * plantilla ya guardada sin que nadie las toque — el mismo motivo por el que el
 * `velo` de la portada arranca en 0. La opinión ("de a dos entra el doble de
 * producto en la misma pantalla") vive en el editor, que nace los bloques
 * nuevos en 2; en el documento vive el dato.
 */
export type PorFilaMovil = 1 | 2;

/**
 * La consulta, hecha texto.
 *
 * Vive acá —en el archivo puro— para que el preview del editor y el envío usen
 * **la misma** llave: es lo que hace que dos bloques iguales cuesten una sola
 * llamada, y lo que garantiza que lo que se ve armando el mail sea lo que sale.
 * Dos definiciones de "la misma consulta" serían dos respuestas distintas.
 */
export const claveProductos = (c: ConsultaProductos): string =>
  [c.fuente, c.categoriaId ?? "", c.n ?? ""].join("|");

/** Cómo se llama cada fuente para quien arma el mail. */
export const ETIQUETA_FUENTE = {
  destacados: "Los más vendidos",
  recientes: "Las novedades",
  oferta: "Los que están en oferta",
  categoria: "Los de una categoría",
} as const satisfies Record<FuenteProductos, string>;

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
    | { tipo: "productos"; items: ProductoEmail[]; movil?: PorFilaMovil }
    /**
     * La grilla de `productos`, pero guardando **la consulta y no los productos**.
     *
     * Es la diferencia entre un mail y un mail que sabe qué vende la tienda hoy:
     * una plantilla de "novedades del mes" se arma una vez y sale distinta cada
     * vez, sin que nadie la edite.
     *
     * Que guarde la consulta no es un detalle de implementación, es lo que
     * permite que un preset se comparta entre marcas: un bloque con productos
     * adentro le mandaría los de BDI a Zattia. Mismo motivo por el que el
     * encabezado guarda el texto vacío en vez del nombre de la cuenta.
     */
    | {
        tipo: "productos-dinamicos";
        fuente: FuenteProductos;
        /** Solo con `fuente:"categoria"`. Sin esto el bloque no se dibuja. */
        categoriaId?: string;
        /** Cuántos mostrar (2 a 6). La grilla es de a dos: un par se ve mejor. */
        n?: number;
        /** Cuántos por fila en el celular. Ausente = 1. Ver `PorFilaMovil`. */
        movil?: PorFilaMovil;
        /**
         * ⛔ **Acá no hay `items`, y es la decisión de diseño del bloque.**
         *
         * Los productos resueltos viajan por `RenderOpts.productosDinamicos`,
         * indexados por `claveProductos`. El primer intento los metía adentro
         * del bloque —como hace el `carrito`— y salió mal por los dos lados:
         *
         *  - **Del lado del guardado**, cada camino que persiste un documento
         *    tenía que acordarse de limpiarlos, y son cuatro. El día que alguien
         *    agregue un quinto, una plantilla se guarda con el catálogo de una
         *    marca adentro. Silencioso.
         *  - **Del lado del dibujo**, la limpieza que evitaba eso vivía en
         *    `leerContenido`, que `renderEmailHtml` llama de nuevo por las
         *    dudas: borraba los productos justo antes de dibujarlos y el bloque
         *    no aparecía nunca.
         *
         * Con los productos afuera, el bloque no puede guardar lo que no tiene.
         */
      }
    // Placeholder: no se carga a mano. El procesador de automations le mete el
    // carrito real del contacto justo antes de enviar, EN ESTE LUGAR de la lista
    // — que es la diferencia con `productos`, que es una grilla curada.
    | { tipo: "carrito"; items?: ProductoEmail[]; restantes?: number }
    | {
        tipo: "columnas";
        /** Ausente = "imagenes", que es el bloque de siempre: dos fotos lado a lado. */
        variante?: "imagenes" | "textos" | "imagen-texto" | "texto-imagen";
        /** % de ancho de la columna izquierda. Ausente = 50 (parejo). */
        proporcion?: 40 | 50 | 60;
        izq: Columna;
        der: Columna;
      }
    | { tipo: "video"; imagen: string; url: string }
    | { tipo: "redes"; links: { red: string; url: string }[] }
    /** Barra de navegación: un puñado de links de texto en fila. */
    | { tipo: "menu"; links: { texto: string; url: string }[] }
    | { tipo: "divisor" }
    // Aire vertical y nada más. Parece de más hasta que se arma un diseño en serio:
    // la plantilla que motivó esto usa 12 espaciadores, de 5 a 75px, y sin ellos
    // los bloques se apilan pegados.
    | { tipo: "espaciador"; alto?: number }
    // Bloques "ricos"
    | {
        tipo: "hero";
        imagen: string;
        titulo: string;
        subtitulo: string;
        botonTexto: string;
        botonUrl: string;
        bg: string;
        /**
         * Portada con el texto ENCIMA de una foto, en vez de arriba de ella.
         * Mutuamente excluyente con `imagen` en el editor —cuando está, `imagen`
         * no se dibuja—, pero un documento puede traer las dos sin romperse.
         */
        fondoImagen?: string;
        /** Alto aproximado en px, solo con `fondoImagen`. Outlook no mide el texto. */
        alto?: number;
        /**
         * Cuánto se oscurece la foto de fondo para que el texto se lea, 0-100.
         * Solo con `fondoImagen`. Pinta una capa del color `bg` ENCIMA de la
         * imagen — el mismo mecanismo que el `veloOpacidad` del pop-up de
         * Resorty, y por la misma razón: sin él, un título claro sobre una foto
         * clara no se lee. Es lo que hizo descartar esta portada en Zattia.
         *
         * 🔴 **El default es 0 y no puede ser otra cosa.** Cualquier valor
         * distinto le cambiaría el aspecto a toda portada con foto de fondo que
         * ya esté guardada, sin que nadie toque nada. La opinión ("55 se ve
         * bien") vive en el editor, en el momento en que alguien ELIGE poner la
         * foto de fondo; en el documento vive el dato, y ausente = como estaba.
         */
        velo?: number;
      }
    | { tipo: "seccion"; bg: string; titulo: string; texto: string; botonTexto: string; botonUrl: string }
    | { tipo: "cupon"; texto: string; codigo: string; botonTexto: string; botonUrl: string }
    /**
     * HTML crudo. Escotilla de administrador, no de comerciante: sale desde un
     * dominio verificado por vos y con tu reputación de envío.
     *
     * ⛔ El freno real no es la paleta del editor —esa es solo la UI, y el Json
     * se puede editar por otro camino—. `renderBloque` no lo dibuja si la
     * CUENTA no lo tiene habilitado (`Cuenta.config.htmlCrudoHabilitado`, un
     * toggle de ADMIN en Remitentes). Al enviar no hay usuario, solo cuenta.
     */
    | { tipo: "html"; contenido: string }
  );

export type TipoBloque = Bloque["tipo"];

/** Todos los tipos que existen. El editor arma su paleta con esto. */
export const TIPOS_BLOQUE = [
  "encabezado",
  "hero", "seccion", "cupon", "titulo", "texto", "boton", "imagen",
  "productos", "productos-dinamicos", "carrito", "columnas", "video", "redes", "menu",
  "divisor", "espaciador", "html",
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
  // "Productos" a secas era ambiguo desde que hay dos: los dos salen de la
  // tienda, la diferencia es quién los elige.
  productos: "Productos elegidos",
  "productos-dinamicos": "Productos automáticos",
  carrito: "Carrito abandonado",
  columnas: "Dos columnas",
  video: "Video",
  redes: "Redes sociales",
  menu: "Menú",
  divisor: "Línea divisoria",
  espaciador: "Espacio en blanco",
  html: "HTML avanzado",
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
    // `movil: 2` acá y no como default del tipo: un bloque NUEVO nace de a dos
    // por fila en el celular —entra el doble de producto en la misma pantalla y
    // se comparan de un vistazo—, pero los mails ya guardados siguen apilando.
    case "productos": return { id, tipo, items: [], movil: 2 };
    // Nace en "los más vendidos" y no en "una categoría": es la única fuente que
    // ya devuelve algo sin que haya que elegir nada, así que el bloque se ve
    // funcionando en el preview desde el segundo cero.
    case "productos-dinamicos": return { id, tipo, fuente: "destacados", n: 4, movil: 2 };
    // Nace vacío A PROPÓSITO: si trajera productos de ejemplo, una automation
    // guardada con ellos se los mandaría a un cliente real. La muestra del
    // editor la pone el preview (`muestraCarrito`), no el dato.
    case "carrito": return { id, tipo, items: [] };
    case "columnas": return { id, tipo, izq: { imagen: "", url: "" }, der: { imagen: "", url: "" } };
    case "video": return { id, tipo, imagen: "", url: "" };
    case "redes": return { id, tipo, links: [{ red: "Instagram", url: "" }] };
    case "menu": return { id, tipo, links: [{ texto: "Inicio", url: "" }, { texto: "Tienda", url: "" }] };
    case "divisor": return { id, tipo };
    case "espaciador": return { id, tipo, alto: 24 };
    // `bg` vacío y no "#ffffff": el renderer cae a `pal.tarjeta`, que en un mail
    // claro se ve idéntico y en uno oscuro **no es un parche blanco**. Un hero
    // nuevo tiene que verse bien en el tema que tenga la marca, no en el claro.
    case "hero": return { id, tipo, imagen: "", titulo: "Título principal", subtitulo: "Un subtítulo que acompaña", botonTexto: "Ver más", botonUrl: "", bg: "" };
    case "seccion": return { id, tipo, bg: "#faf7f0", titulo: "Título de sección", texto: "Texto de la sección.", botonTexto: "", botonUrl: "" };
    case "cupon": return { id, tipo, texto: "Usá este código en el checkout", codigo: "DESCUENTO10", botonTexto: "Comprar", botonUrl: "" };
    case "html": return { id, tipo, contenido: "" };
  }
}

/** Copia de un bloque con identidad propia. Sin id nuevo, React colapsa las dos tarjetas. */
export function duplicarBloque(b: Bloque): Bloque {
  return { ...b, id: nuevoId() } as Bloque;
}
