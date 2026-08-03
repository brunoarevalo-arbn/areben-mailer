// Familia "Producto": un lanzamiento, un restock, algo que merece su propio mail.
//
// Es la familia más chica y la que menos depende del catálogo: acá el mail lo
// sostiene UN producto, así que la foto grande es el bloque principal y no un
// adorno. Las dos primeras salen del pack de stock (`fotos.ts`); `lanzamiento`
// se llena sola con la tienda y no lleva ninguna, que es otro valor y no una
// versión pobre.
//
// 🔑 **Las dos clonan una referencia y declaran su `Tema` COMPLETO, con los hex
// MEDIDOS** sobre la captura (`scripts/paleta-referencia.ts`). `combinarTema` es
// un spread plano: el campo que falte se cae al tema de la marca que elige la
// plantilla y el clon deja de ser un clon. Ver la regla 4 de `PLANTILLAS.md`.

import {
  type DefPreset, aire, banda, bandaFoto, botonSi, cta, grilla, menuTienda, portada, redes, sinBoton,
} from "../comun";
import { alt, foto } from "../fotos";

export const PRODUCTO: readonly DefPreset[] = [
  {
    id: "bodega",
    nombre: "Bodega",
    descripcion: "Marrón oscuro de punta a punta, versales y la botella del mes en grande. Para presentar una etiqueta nueva.",
    familia: "producto",
    // Clon de R-009 ("Say cheers together"), la única referencia de las 21 que
    // vino en dos capturas porque el mail es largo.
    //
    // 🔑 Lo que la hace ser ella son dos cosas: el **marrón casi negro** de
    // borde a borde arriba y abajo, y que **la mitad de abajo es blanca** — un
    // mail partido en dos, no uno oscuro. Por eso el marrón va en el `fondo` de
    // PÁGINA y la tarjeta queda blanca: el encabezado y el pie se dibujan fuera
    // de ella, así que las dos bandas salen solas.
    arma: ({ marca, tienda }) => ({
      // Medido: el marrón **#201808 es el 71% de la mitad de arriba** y el 84%
      // de la banda del pie; la banda del medio es **#202020** (un gris oscuro
      // neutro, no el marrón) y los botones salen de ese mismo #202020. El
      // único color de la referencia es el cobre **#c07850** del hilo que
      // separa la portada de esa banda.
      tema: { base: "claro", fondo: "#201808", fondoContenido: "#ffffff", acento: "#202020", link: "#c07850", ancho: 600, fuente: "sistema" },
      estilos: {
        // 🔴 Sin `color`: hay títulos sobre las tres bandas oscuras y otros
        // sobre el blanco de abajo. Clavarlo en la capa de documento le gana a
        // los dos contrastes a la vez — el error que se repitió en tres de los
        // siete clones de catálogo.
        //
        // La referencia usa una condensada en mayúsculas y ninguna de las seis
        // de `FUENTES` lo es (son web-safe a propósito): las versales con
        // espaciado corto es lo más cerca que hay.
        titulo: { mayusculas: true, peso: 700, espaciado: 0.5 },
        boton: { fondo: "#202020", color: "#ffffff", radio: 0, peso: 700, tamano: 13 },
        imagen: { radio: 0 },
      },
      bloques: [
        // 🟡 Entre el logo y el título la referencia tiene un **ornamento de
        // filigrana** en cobre, y debajo de la foto un hilo del mismo color. Los
        // dos separan dos zonas OSCURAS, y un `divisor` se dibuja sobre la
        // tarjeta —que acá es blanca—: serían dos franjas blancas donde la
        // referencia es continua. El cobre se mudó al único hilo que la
        // referencia también tiene sobre blanco, el de abajo de la grilla.
        //
        // 🟡 En la captura el título va sobre el marrón PLANO y las botellas
        // vienen debajo. Acá van juntos, que es el camino de `brasas` y de
        // `cyber-marmol`: la foto de una portada se usa como **materia** detrás
        // del título. ⚠️ El primer intento fue fiel a la anatomía —hero de color
        // liso + `imagen` a sangre debajo— y salió mal por la foto: la única de
        // vino a sangre del pack es una mesa CLARA, y esa franja blanca partía
        // en dos la mitad oscura del mail, que es justo lo que la define.
        portada("producto-vino", {
          titulo: "Brindemos juntos",
          subtitulo: "",
          alto: 340,
          // El velo va del color de la PÁGINA y no del oscuro fijo: así la
          // portada y la banda del encabezado son una sola pieza marrón, que es
          // lo que se ve en la captura. Es la misma razón por la que
          // `veloColor` existe, al revés que en `temporada`.
          veloColor: "#201808",
          velo: 45,
          // El título de la referencia ocupa dos renglones y media portada.
          estilo: { titulo: { tamano: 44 } },
        }),
        // La banda del medio. El gris **no** es el marrón y se nota: es el
        // único bloque de la referencia que se despega del fondo.
        {
          tipo: "seccion",
          bg: "#202020",
          titulo: "Una etiqueta nueva en la carta",
          texto: `Contá en dos renglones de dónde viene, quién la hace y con qué se toma. En ${marca} la conseguís desde hoy.`,
          ...sinBoton,
        },
        // "The flavors": en la captura es el título gigante sobre el marrón con
        // tres botellas debajo. Va como banda con textura —madera oscura bajo
        // velo— porque las botellas de la referencia son el catálogo, y el
        // catálogo lo pone la grilla de abajo con los productos de verdad.
        bandaFoto(
          "banda-madera",
          "Los estilos",
          "Tres perfiles distintos para tres momentos distintos.",
          undefined,
          // ⚠️ El alto se mide contra el CONTENIDO y no contra la captura: con
          // 200 quedaban 90px de madera vacía debajo del texto. Ahí la
          // referencia tiene tres botellas y nosotros un renglón. Misma trampa
          // que en `cyber-marmol`.
          150,
          // El velo del marrón de la página otra vez, y no el oscuro fijo: con
          // `#111111` la madera salía gris y se despegaba de las dos bandas de
          // arriba, que en la captura son el mismo color. Y el título va en
          // tamaño de póster: en la captura "THE FLAVORS" es lo más grande del
          // mail después de la portada, no el título de una banda cualquiera.
          { caja: { fondo: "#201808" }, titulo: { tamano: 32 } },
        ),
        // La mitad blanca arranca acá. 🟡 La captura pone DOS productos en una
        // fila; van cuatro en dos filas, que es una de las dos formas de grilla
        // que la galería permite (ver `grilla()` en `comun.ts`).
        grilla("destacados", { boton: "Comprar" }),
        // El único cobre que sobrevive del diseño: en la captura hay un hilo
        // acá también, y es el único que cae sobre el blanco.
        { tipo: "divisor", estilo: { caja: { bordeColor: "#c07850" } } },
        // 🟡 **El producto único destacado no es un bloque** —está en el backlog
        // con 2 pedidos— y `productos` con un solo item dibuja media grilla. La
        // aproximación es armarlo a mano: foto grande, nombre, bajada y botón,
        // todo centrado, que es exactamente lo que hace la segunda captura.
        { tipo: "imagen", url: foto("portada-gastro-1"), alt: alt("portada-gastro-1") },
        { tipo: "titulo", texto: "La botella del mes", align: "center" },
        {
          tipo: "texto",
          texto: "Una sola por pedido mientras dure el stock. Contá acá con qué maridarla y por qué la elegiste vos.",
          align: "center",
        },
        ...botonSi("Pedirla", tienda, "center"),
        aire(8),
        // 🟡 En la captura las redes van adentro de la banda marrón del pie,
        // igual que el contacto. El bloque `redes` vive dentro de la tarjeta, o
        // sea sobre el blanco; la banda marrón de abajo sale igual, porque es el
        // fondo de página donde se dibuja el pie.
        redes,
      ],
    }),
  },
  {
    id: "negro-y-dorado",
    nombre: "Negro y dorado",
    descripcion: "Póster dorado sobre negro, el producto a sangre y la grilla en blanco. Para estrenar algo que se mira antes de leerse.",
    familia: "producto",
    // Clon de R-016 ("Sweet dreams", antifaces).
    //
    // 🔑 Es el mismo truco de partición que `bodega` y por eso van juntas: el
    // negro en el `fondo` de PÁGINA da la banda de arriba (donde va el logo) y
    // la de abajo, y la tarjeta blanca se queda con la mitad de abajo del mail.
    arma: ({ marca, tienda }) => ({
      // Medido: **#000000 el 73% de la mitad de arriba** y #f8f8f8 el 31% del
      // mail entero — es negro puro, no un gris oscuro. El dorado del póster,
      // recortado y medido aparte, es **#e0a868** (el 34% de ese recorte): el
      // plan había elegido #c9a227 a ojo, bastante más verdoso y saturado. Los
      // dos botones son **negros puros**, no dorados: el dorado aparece una
      // sola vez en todo el mail y es el título de la portada.
      tema: { base: "claro", fondo: "#000000", fondoContenido: "#ffffff", acento: "#000000", link: "#000000", ancho: 600, fuente: "sistema" },
      estilos: {
        // 🔴 Sin `color`: el título de la portada es dorado sobre negro y los de
        // abajo son negros sobre blanco. El dorado se clava **en el bloque**.
        titulo: { mayusculas: true, peso: 700 },
        boton: { fondo: "#000000", color: "#ffffff", radio: 0, peso: 700, tamano: 13 },
        imagen: { radio: 0 },
      },
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "Edición limitada",
          subtitulo: "",
          bg: "#000000",
          ...sinBoton,
          // El póster dorado. 48 es el tope de `RANGOS.tamano` y es lo que hace
          // la referencia: el título ocupa un tercio del mail.
          estilo: { titulo: { tamano: 48, color: "#e0a868" } },
        },
        // El producto a sangre, todavía sobre el negro. La foto es oscura a
        // propósito: en la captura el antifaz negro se funde con el fondo y esa
        // continuidad es la mitad del efecto.
        { tipo: "imagen", url: foto("portada-joyas-1"), alt: alt("portada-joyas-1"), sangre: true },
        // El cierre de la portada, todavía en negro: el número grande y una
        // línea que dice sobre qué aplica.
        {
          tipo: "seccion",
          bg: "#000000",
          titulo: "20% OFF",
          texto: "Por el lanzamiento, esta semana.",
          ...sinBoton,
          estilo: { titulo: { tamano: 32 } },
        },
        // La banda blanca. Blanco explícito y no `bg: ""`: con `bg: ""` sería el
        // beige de `pal.seccion` y la referencia no tiene un solo bloque de
        // color intermedio — el mail es negro y blanco.
        {
          tipo: "seccion",
          bg: "#ffffff",
          titulo: "Ya está en la tienda",
          texto: `Contá en un renglón qué lo hace distinto de todo lo que ${marca} ya tenía.`,
          ...cta("Verlo ahora", tienda),
        },
        { tipo: "divisor" },
        // 🟡 La captura pone cuatro productos en 2×2 **sin precio**, y el precio
        // de la grilla sale de Tiendanube: no hay forma de apagarlo sin apagar
        // el dato. `n: 4` da exactamente el 2×2 de la referencia.
        grilla("recientes"),
        ...botonSi("Ver todo", tienda, "center"),
        aire(8),
        // La foto ancha del cierre. 🟡 En la captura es una persona usando el
        // producto: **el pack excluye las caras reconocibles a propósito**
        // —la plantilla la manda un tercero a su propia lista— así que va una
        // textura del mismo mundo.
        { tipo: "imagen", url: foto("banda-tela"), alt: alt("banda-tela"), sangre: true },
        // ✅ El menú va **adentro** de la banda negra del pie, como en la
        // captura. Es el único de los seis donde la banda cierra el mail en vez
        // de abrirlo, y va pegada a la foto a sangre de arriba: con `caja.fondo`
        // el aire es padding y no margen, así que no queda una franja blanca
        // entre la foto y la banda.
        ...menuTienda(tienda, { cuerpo: { tamano: 13 }, caja: { fondo: "#000000", padY: 16 } }),
        redes,
      ],
    }),
  },
  {
    id: "lanzamiento",
    nombre: "Lanzamiento de producto",
    // Re-descrita el 2-ago-2026: con `bodega` y `negro-y-dorado` al lado, lo que
    // la distingue es que **no usa una sola foto del pack**. Se llena con la
    // tienda del comerciante y nada más, que es otro valor y no una versión
    // pobre — igual que `hot-sale` en venta y `evento` en fechas.
    descripcion: "Presentación, el pitch de por qué es distinto y la colección recién cargada. Sin fotos ajenas: se llena con tu tienda.",
    familia: "producto",
    arma: ({ tienda }) => ({
      estilos: { imagen: { radio: 12 } },
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "Ya llegó lo nuevo 🎉",
          subtitulo: "Presentamos nuestro último lanzamiento",
          bg: "",
          ...cta("Ver más", tienda),
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es lo que estabas esperando. Mirá los detalles:", align: "left" },
        // ⛔ Acá había un `{ tipo: "imagen", url: "" }`, que renderiza el `<img>`
        // igual: un ícono roto en la miniatura y en la casilla de quien lo
        // recibe si el comerciante no la reemplaza. La foto del producto la pone
        // la grilla de abajo, que sale de la tienda de verdad.
        banda("Por qué es distinto", "Contá en dos renglones qué lo hace valer la pena: el material, el detalle, para quién es."),
        { tipo: "titulo", texto: "Conocé la colección", align: "center" },
        { tipo: "productos-dinamicos", fuente: "recientes", n: 4, movil: 2 },
        ...botonSi("Ver toda la colección", tienda, "center"),
        redes,
      ],
    }),
  },
];
