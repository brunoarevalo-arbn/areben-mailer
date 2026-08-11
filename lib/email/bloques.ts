// Qué ES un mail: los tipos de bloque y su valor inicial. Nada de HTML.
//
// Vive aparte de render.ts para romper un ciclo: el normalizador del esquema
// (esquema.ts) necesita los tipos, y render.ts necesita al normalizador. Con los
// tipos acá, los dos importan de este archivo y nadie importa al otro.
//
// ⚠️ Puro: lo importan el SERVIDOR y el CLIENTE. Sin prisma, sin next/headers.
//
// Para no romper los imports que ya existen, render.ts re-exporta todo esto.

// Sólo el tipo, y de un archivo que también es puro: se borra al compilar, así
// que esto no le mete el módulo de imágenes al bundle de nadie.
import type { Formato as FormatoImagen } from "../imagenes-encuadre";
import type { Estilos } from "./estilos";
import type { EstiloIconos } from "./redes";
import type { Tema } from "./tema";
import type { TextoRico } from "./texto-rico";

/**
 * 🔑 **Ocho campos de este archivo son `TextoRico` y no `string`**: los cuatro
 * de cuerpo (`texto.texto`, `hero.subtitulo`, `seccion.texto`, `Columna.texto`)
 * y los cuatro de título (`titulo.texto`, `hero.titulo`, `seccion.titulo`,
 * `Columna.titulo`).
 *
 * `TextoRico` es `string | Trozo[]`, o sea una **unión**: el `string` de siempre
 * sigue siendo válido y es la forma normal — no hay migración, `V_ACTUAL` no
 * sube y ninguna plantilla ya guardada cambia. El porqué completo está arriba de
 * `texto-rico.ts`.
 *
 * ⚠️ El import es `type` puro, así que TS lo borra: `texto-rico.ts` importa
 * valores de `estilos.ts`, que importa el tipo de acá, y sin el `type` eso sería
 * un ciclo de módulos de verdad.
 */

export interface ProductoEmail {
  nombre: string;
  precio: string;
  precioPromo?: string;
  imagen: string;
  /**
   * La foto que trajo la tienda, guardada cuando `imagen` se pisa con una
   * propia (5-ago-2026).
   *
   * 🔑 Existe **sólo para poder volver atrás**: el renderer no la mira nunca.
   * Sin ella, deshacer una foto propia sería sacar el producto de la lista y
   * volver a buscarlo, que además le cambia el orden en la grilla.
   *
   * Se escribe la primera vez que se pisa la foto y no se toca más: si se
   * reescribiera en cada cambio, la segunda foto propia pasaría a ser "la de la
   * tienda" y el botón de volver dejaría de volver a ningún lado.
   */
  imagenTienda?: string;
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
  /**
   * En una celda de texto es el título; en una celda de imagen es la **etiqueta
   * de abajo** y el `alt` de la foto.
   *
   * Que sea el mismo campo y no dos no es ahorro: una fila de categorías es
   * exactamente "foto + cómo se llama", y en 10 de las 21 referencias de la
   * tanda del 1-ago la etiqueta ES el contenido de la celda. Con dos campos, el
   * día que alguien cambia la variante de la celda el texto se le queda atrás.
   */
  titulo?: TextoRico;
  texto?: TextoRico;
  /**
   * Botón propio de la celda. **Vacío o ausente = no se dibuja**, igual que en
   * `hero`, `seccion` y `cupon`: vaciar el texto es cómo se lo saca.
   *
   * Entró el 2-ago-2026 por la regla de 3: lo piden R-015, R-018 y R-021 de la
   * tanda de referencias del 1-ago (el contador de `PLANTILLAS.md` decía 2 y
   * estaba mal). Sin esto, una fila de tres tarjetas con su propio "Comprar"
   * abajo no es expresable, y son de los patrones más comunes de la galería.
   *
   * 🔴 **Con botón, la celda deja de ser un ancla entera**: un `<a>` adentro de
   * otro no está permitido en HTML y cada cliente lo repara distinto —Gmail
   * cierra el primero, Outlook anida—, así que el click terminaba yendo a
   * cualquier lado. El renderer envuelve la celda en el link **solo cuando no
   * hay botón**; ver el comentario en `celdaImagen`.
   *
   * Sin bump de esquema: `V_ACTUAL` existe para cambios de **forma**
   * (`izq`/`der` → `celdas`) y esto es aditivo. El saneador hace
   * `{ imagen:"", url:"", ...c }`, así que las dos claves sobreviven el
   * round-trip sin tocar `esquema.ts`.
   */
  botonTexto?: string;
  botonUrl?: string;
  /**
   * Ícono chico arriba del título de la celda. Una clave de `ICONOS`
   * (`lib/email/iconos.ts`), **nunca una URL libre**.
   *
   * Que sea una clave y no una imagen es el mismo criterio que `redes`: el
   * archivo lo servimos nosotros desde `public/iconos/`, así que no puede
   * quedar roto en una casilla, no se puede colar un tracker de un tercero, y
   * **el color lo elige el renderer** según el fondo — un PNG no se tiñe.
   *
   * Entró el 2-ago-2026 por la regla de 3: la banda de beneficios con ícono
   * está en R-002, R-006, R-008, R-018 y R-021 — cinco referencias.
   *
   * Sin bump de esquema, igual que `botonTexto`: es aditivo y el saneador hace
   * `{ imagen:"", url:"", ...c }`, así que sobrevive el round-trip solo.
   */
  icono?: string;
}

/**
 * Cuántas celdas tiene un bloque `columnas`. **Ausente = 2**, que es el bloque
 * de siempre.
 *
 * El tope es 4 y no "las que quieras": a 600px de ancho, cinco celdas dejan 104
 * px por columna —menos que la foto de producto más chica del catálogo— y en el
 * celular apilan igual. La referencia que usa cinco (R-002) las dibuja de 90px
 * y es ilegible en la casilla, no solo en la captura.
 */
export type CantidadCeldas = 2 | 3 | 4;

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
 * Cuántas tarjetas por fila en el ESCRITORIO. **Ausente = 2**, que es como se
 * dibujó la grilla desde el día uno.
 *
 * Tres es el estándar de la industria —16 de las 21 referencias de la primera
 * tanda lo usan, incluida la galería de Tiendanube— y el motor solo sabía hacer
 * dos.
 *
 * **Cuatro entró el 6-ago-2026**, pedido por R-004, R-007, R-011 y R-021. Hasta
 * ese día acá decía que no entraba, con dos argumentos: que la tarjeta queda en
 * 132px y que "en dos de las referencias que lo intentan el botón sale partido
 * en dos renglones". El primero es un dato de layout, no un impedimento —una
 * grilla de cuatro es una fila de fotos, no cuatro fichas—; el segundo era una
 * observación sobre **las capturas ajenas**, y medido acá resultó cierto sobre
 * este motor también, con dueño conocido: **es el botón por tarjeta**.
 *
 * 🔑 **Por eso con cuatro el botón por tarjeta no se dibuja.** Medido en Chrome
 * el 6-ago-2026 sobre el render real: la celda mide **134px** (118 de foto) y el
 * botón del BASE necesita **147px** — "COMPRAR" son 83px de texto a 16px más
 * 32px de padding de cada lado. Sobran 29px, así que el ancla parte el texto en
 * dos renglones y el `<v:roundrect>` de Outlook —que lleva el ancho de la celda
 * como tope— hace lo mismo. Preferir la fila de cuatro **y** el botón es elegir
 * el defecto que la referencia misma tiene. La tarjeta entera sigue siendo un
 * ancla, que es lo que hace un lookbook.
 * ⚠️ El texto **no se borra del bloque**: bajar a 3 o a 2 lo devuelve.
 * ⛔ No se resuelve achicando el botón: un botón de 11px sobre una foto de 118
 * es un renglón gris, y el tamaño lo puede haber elegido una persona.
 *
 * Lo que sí entra a 118px, medido en el mismo pase: el nombre en el BASE de 14px
 * (dos renglones para "Perfume Nocturne 100ml") y el precio con el tachado al
 * lado, en un solo renglón. Por eso no hay achique automático de texto acá.
 *
 * ⚠️ **Con 3 o 4 por fila, en el celular se APILA**, sea cual sea `movil`. No es
 * una decisión estética: la fila es una `<tr>` con tres o cuatro `<td>`, y una
 * clase no puede convertirla en dos filas de dos. Lo que sí se puede
 * —`display:inline-block` en las celdas— deja de ser una tabla justo en los
 * clientes donde la tabla es lo único confiable. Vale la regla del shell: lo
 * peor que se ve es el layout de escritorio, nunca uno roto.
 */
export type PorFila = 2 | 3 | 4;

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
    | { tipo: "titulo"; texto: TextoRico; align?: "left" | "center" }
    | { tipo: "texto"; texto: TextoRico; align?: "left" | "center" }
    | { tipo: "boton"; texto: string; url: string; align?: "left" | "center"; full?: boolean }
    | {
        tipo: "imagen";
        url: string;
        alt?: string;
        /**
         * De borde a borde de la tarjeta, sin margen ni esquinas redondeadas.
         * **Ausente = no**, que es como se dibujó siempre.
         *
         * Es la portada fotográfica de 6 de las 21 referencias de la primera
         * tanda: la foto pegada a los bordes es lo que hace que un mail no se
         * vea como un documento. ⚠️ El estilo del rol `imagen` (radio, margen)
         * no se aplica cuando está prendida — pegada a los bordes, una esquina
         * redondeada deja cuatro puntitos del color de la tarjeta.
         */
        sangre?: boolean;
        /**
         * Cuánto del ancho útil ocupa la foto, en % (10-100).
         * **Ausente = 100**, que es como se dibujó siempre.
         *
         * Va acá y no en el rol `imagen` de la cascada —donde `EstiloBloque.ancho`
         * existe desde siempre— por dos motivos. El estilo **cascadea**: un ancho
         * en la capa de documento alcanzaría también a la grilla de `productos`,
         * a las celdas de `columnas` y al `video`, que no lo emiten, y eso es
         * justo la perilla desconectada que caza `probar-panel-estilo`. Y las
         * perillas numéricas del panel están detrás del permiso `avanzado`,
         * mientras que "qué tan grande sale esta foto" es la decisión más básica
         * de quien arma el mail. El precedente es `logoAncho` del encabezado.
         *
         * 🔴 **Excluyente con `sangre`**: una foto a borde-a-borde saltea el
         * `pad()`, así que ahí un ancho no significa nada. El editor apaga una al
         * elegir la otra, y el renderer le da prioridad a `sangre`.
         */
        ancho?: number;
        /**
         * Dónde queda la foto cuando no ocupa todo el ancho. **Ausente = izquierda**,
         * que es donde caía una imagen de menos de 100% antes de que esto existiera.
         * Sin `ancho` no hace nada — no hay lugar libre que repartir.
         */
        align?: "left" | "center" | "right";
        /**
         * A qué formato se recortó la foto, y desde dónde.
         *
         * 🔑 **El renderer NO las mira nunca.** Existen sólo para el editor: la
         * primera para poder marcar cuál de los chips está puesto, la segunda
         * para poder volver al original. Es el mismo criterio —y el mismo
         * comentario— que `imagenTienda` de `ProductoEmail`.
         *
         * 🔴 **`urlOriginal` se escribe UNA sola vez y no se pisa más.** Si cada
         * recorte la reescribiera, el segundo recorte pasaría a ser "el
         * original" y re-encodear encima de un re-encode degrada la foto sin
         * techo, sin forma de volver.
         */
        formato?: FormatoImagen;
        urlOriginal?: string;
        /**
         * Qué parte de la foto conservó el recorte, de 0 a 100 (**ausente = 50**,
         * centrado). Se guarda para que reabrir el bloque muestre el encuadre que
         * quedó y no haya que volver a buscarlo con el deslizador.
         */
        encuadre?: number;
      }
    | {
        tipo: "productos";
        items: ProductoEmail[];
        movil?: PorFilaMovil;
        porFila?: PorFila;
        /** Ver `botonTexto` de `productos-dinamicos`: es el mismo campo. */
        botonTexto?: string;
        /** Ver `precioOculto` de `productos-dinamicos`: es el mismo campo. */
        precioOculto?: boolean;
      }
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
        /** Cuántos por fila en escritorio. Ausente = 2. Ver `PorFila`. */
        porFila?: PorFila;
        /**
         * Esconder el precio (5-ago-2026).
         *
         * 🔑 La clave es **ocultar** y no "mostrar" para que ausente signifique
         * "se ve", que es lo que hacen todos los mails ya guardados: al revés,
         * un default nuevo le sacaría el precio a toda grilla existente. Mismo
         * criterio que `direccionOculta` en `lib/marca.ts`.
         *
         * Sale de una devolución de diseño: *«capaz sacaría el precio, para que
         * la gente entre a ver el producto»*. Es una decisión de campaña —en un
         * mail de novedades el precio distrae, en uno de ofertas es el titular—
         * y por eso es un flag del bloque y no un estilo.
         */
        precioOculto?: boolean;
        /**
         * El texto del botón que lleva **cada tarjeta**. Vacío o ausente = sin
         * botón, igual que en `seccion` y en una celda de `columnas`.
         *
         * 🔑 Es UN texto para toda la grilla y no uno por producto: el destino
         * de cada botón es la ficha de SU producto, que ya la sabe el motor. Un
         * texto por tarjeta sería contenido guardado sobre productos que este
         * bloque, a propósito, no guarda.
         *
         * Entró el 2-ago-2026 por la regla de 3 de `PLANTILLAS.md`, con cinco
         * referencias pidiéndolo (002 · 018 · 019 · 020 · 021): en todas, la
         * grilla lleva un "Comprar" abajo de cada precio.
         *
         * ⚠️ No entra en `claveProductos`: es cómo se dibuja la grilla, no qué
         * se le pide a Tiendanube. Si entrara, dos bloques con la misma consulta
         * y distinto botón costarían dos llamadas a TN.
         */
        botonTexto?: string;
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
    /**
     * La fila: de 2 a 4 celdas, cada una con foto o con texto.
     *
     * Nació como "dos columnas" (`izq`/`der`) y se abrió el 1-ago-2026: la fila
     * de 3 o 4 celdas apareció en **15 de las 21 referencias** de la primera
     * tanda, con tres disfraces que son el mismo bloque —la banda de beneficios
     * con ícono, la fila de categorías con foto, y la de gente con nombre y
     * cargo—. Ver `PLANTILLAS.md`.
     *
     * Los documentos viejos siguen entrando: la migración v3→v4 convierte
     * `izq`/`der` en `celdas`, y el saneo lo vuelve a hacer en cada lectura por
     * si un Json entra editado a mano.
     */
    | {
        tipo: "columnas";
        /**
         * Ausente = "imagenes", que es el bloque de siempre.
         *
         * Con más de dos celdas la variante decide igual, generalizando lo que
         * ya hacía: `imagen-texto` es "la PRIMERA con foto" y `texto-imagen` es
         * "la ÚLTIMA con foto". Con dos celdas eso es exactamente izquierda y
         * derecha, así que ningún mail ya guardado cambia.
         */
        variante?: "imagenes" | "textos" | "imagen-texto" | "texto-imagen";
        /**
         * % de ancho de la primera celda. Ausente = parejo.
         *
         * ⚠️ **Solo se aplica con dos celdas.** Con tres o cuatro el reparto es
         * parejo y punto: "40 / 60" no dice nada sobre la tercera, y la única
         * lectura que no inventa nada es ignorarlo.
         */
        proporcion?: 40 | 50 | 60;
        /**
         * Qué hace la fila en el CELULAR. **Ausente = `"apilar"`**, que es como
         * se vio toda fila hasta el 5-ago-2026: la clase `m-col` las pasa a
         * ancho completo en el corte móvil y quedan una debajo de la otra.
         *
         * `"fila"` es la escotilla: la celda no lleva esa clase y se queda con
         * el ancho de escritorio. Existe porque tres beneficios apilados ocupan
         * una pantalla entera de teléfono —"se aplana la lista y se hace larga,
         * y capaz representa el 30% del mail"— y una banda de beneficios se lee
         * de un vistazo o no se lee.
         *
         * ⚠️ Cualquier otro default le cambiaría el aspecto en el teléfono a
         * toda campaña y plantilla ya guardada sin que nadie las toque. Mismo
         * criterio que `PorFilaMovil`, `precioOculto` y `direccionOculta`.
         *
         * 🔑 Enum y no booleano: `movil` ya significa "qué pasa en el celular"
         * en este motor, y deja lugar a un valor más el día que se pueda 2×2
         * —hoy no se puede: una `<tr>` de cuatro `<td>` no se parte en dos filas
         * con CSS, ver `PorFila`—.
         */
        movil?: "apilar" | "fila";
        /** De 2 a 4. Lo garantiza `leerContenido`, no el tipo. */
        celdas: Columna[];
      }
    | { tipo: "video"; imagen: string; url: string }
    | {
        tipo: "redes";
        links: { red: string; url: string }[];
        /** Ausente = `marca`, los iconos de color de siempre. Ver `EstiloIconos`. */
        iconos?: EstiloIconos;
      }
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
        titulo: TextoRico;
        subtitulo: TextoRico;
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
    | {
        tipo: "seccion";
        bg: string;
        titulo: TextoRico;
        texto: TextoRico;
        botonTexto: string;
        botonUrl: string;
        /**
         * Foto de fondo, con el texto encima. Los tres campos se portan igual
         * que en el `hero` y comparten el código (`bandaConFoto`): la banda con
         * foto en el MEDIO del mail —no en la portada— aparece en 4 de las 21
         * referencias de la primera tanda.
         */
        fondoImagen?: string;
        /** Alto aproximado en px, solo con `fondoImagen`. Outlook no mide texto. */
        alto?: number;
        /** Cuánto se oscurece la foto, 0-100. **Ausente = 0**, como el `hero`. */
        velo?: number;
      }
    | {
        tipo: "cupon";
        /**
         * Ausente = `"caja"`, el recuadro de borde cortado de siempre. Misma
         * convención que `columnas.variante` y `encabezado.variante`.
         *
         * `"compacta"` es el mismo cupón apilado pero achatado: existe para
         * cuando el cupón **acompaña** en vez de ser el protagonista, que con
         * una sola forma salía ocupando ~180 px igual.
         *
         * 🔑 Lo único que la variante decide acá son los tres márgenes que
         * ninguna perilla alcanza (ver el `case "cupon"` del renderer). Todo lo
         * demás —padding, borde, tamaños— ya tiene control en el panel, y lo
         * escribe el editor en `estilo` al elegirla: si el renderer usara
         * defaults propios, el panel diría "Automático (24)" al lado de un mail
         * que dibuja 14.
         */
        variante?: "caja" | "compacta";
        texto: string;
        codigo: string;
        botonTexto: string;
        botonUrl: string;
      }
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
    // `n: 4` y no 3 aunque la fila sea de dos: cuatro llena dos filas parejas, y
    // el que pase la grilla a tres las ve completas igual.
    case "productos-dinamicos": return { id, tipo, fuente: "destacados", n: 4, movil: 2 };
    // Nace vacío A PROPÓSITO: si trajera productos de ejemplo, una automation
    // guardada con ellos se los mandaría a un cliente real. La muestra del
    // editor la pone el preview (`muestraCarrito`), no el dato.
    case "carrito": return { id, tipo, items: [] };
    // Nace con dos celdas: es el bloque que existió siempre, y el que agrega una
    // tercera lo hace porque la está mirando. Tres de fábrica sería una perilla
    // menos para el que arma una fila de beneficios y un hueco de más para todos
    // los demás.
    case "columnas": return { id, tipo, celdas: [{ imagen: "", url: "" }, { imagen: "", url: "" }] };
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

/**
 * Copia de un bloque con identidad propia. Sin id nuevo, React colapsa las dos
 * tarjetas.
 *
 * 🔴 **La copia es PROFUNDA, y el `{ ...b }` de antes era un bug esperando.** Un
 * spread superficial deja el array `celdas` —y cada objeto `Columna` adentro—
 * **compartido entre el original y la copia**: editar la foto de la celda 2 del
 * duplicado se la cambiaba también al bloque de arriba. Hoy no muerde porque
 * todos los caminos de edición son inmutables (`setCelda` hace `map`), pero eso
 * es una promesa que ningún tipo obliga y que ningún test custodiaba, y basta un
 * `celdas[i].titulo = …` en un componente nuevo para que reaparezca.
 *
 * Vale también para el portapapeles: `leerClip` devuelve los bloques con los ids
 * de ORIGEN y quien pega tiene que pasar por acá, así que esta línea es lo que
 * evita que un bloque pegado comparta memoria con el de la otra pestaña.
 *
 * `structuredClone` y no `JSON.parse(JSON.stringify(…))`: un bloque es Json puro
 * —lo custodia `leerContenido`—, así que las dos hacen lo mismo, pero la primera
 * no pasa por el serializador. Corre en un click, nunca en un loop de envío.
 */
export function duplicarBloque(b: Bloque): Bloque {
  return { ...structuredClone(b), id: nuevoId() } as Bloque;
}
