// Familia "Fechas": las del calendario comercial.
//
// Un Cyber Monday, una vuelta al cole o un cambio de estación se arman la semana
// previa y no hay tiempo de producir imágenes: por eso la familia se sostiene
// con **color y tipografía**, y las fotos que usa salen del pack de stock
// (`fotos.ts`), no de una sesión que el comerciante tenga que pagar.
//
// Los seis clones de la tanda del 1-ago van primero, que es el orden de la
// galería; `evento` queda al final y es la única sin una sola foto — igual que
// `hot-sale` en venta, eso no es una versión pobre sino lo que sirve el primer
// día.
//
// 🔑 **Los seis declaran su `Tema` COMPLETO y con los hex MEDIDOS** sobre la
// captura (`scripts/paleta-referencia.ts`). `combinarTema` es un spread plano:
// el campo que falte se cae al tema de la marca que elige la plantilla y el clon
// deja de ser un clon. Ver la regla 4 de `PLANTILLAS.md`.

import {
  type DefPreset, aire, barra, botonSi, categorias, cta, fila, grilla,
  menuTienda, portada, redes,
} from "../comun";
import { foto } from "../fotos";

export const FECHAS: readonly DefPreset[] = [
  {
    id: "temporada",
    nombre: "Cambio de temporada",
    descripcion: "Todo enmarcado en líneas finas y con serifa. La colección nueva cuando arranca la estación.",
    familia: "fechas",
    // Clon de R-004 (Uyuni, invierno). Es la que el plan tenía anotada en
    // catálogo y terminó acá: no muestra el catálogo, muestra **que cambió la
    // estación**, que es una fecha del calendario.
    //
    // 🔑 Lo que la hace ser ella son dos cosas y ninguna es la anatomía: la
    // **serifa en todo** (títulos, nombres de producto y precios) y que **no
    // tiene un solo botón relleno** — cada CTA es un texto subrayado.
    arma: ({ marca, tienda }) => ({
      // Medido: #f8f8f8 el 46% de los píxeles y ningún color saturado arriba de
      // 0,43% (y ese poco es de las fotos, no del diseño). Es un mail **blanco
      // y negro**: el marrón de la ficha era la ropa.
      tema: { base: "claro", fondo: "#ffffff", fondoContenido: "#ffffff", acento: "#111111", link: "#111111", ancho: 600, fuente: "georgia" },
      estilos: {
        // 🔴 **Sin `color`**: la portada tiene el título sobre una foto y
        // clavarlo acá apaga el contraste que el motor calcula por bloque. Es el
        // error que se repitió en tres de los siete clones de catálogo.
        titulo: { mayusculas: true, espaciado: 0.6, peso: 400 },
        // El CTA de texto subrayado, igual que en `marroquineria`: el motor
        // siempre rellena, así que "sin caja" se emula con el fondo de atrás.
        boton: { fondo: "#ffffff", color: "#111111", radio: 0, padX: 2, padY: 4, peso: 700, tamano: 14, subrayado: true },
        imagen: { radio: 0 },
      },
      bloques: [
        // ⚠️ La referencia lleva SEIS links y `menuTienda` da tres: las
        // categorías son de cada tienda y un `/gorros` adivinado es un 404 en un
        // mail ya enviado. Quien arma el mail suma los que le falten.
        ...menuTienda(tienda, { cuerpo: { tamano: 13 } }),
        // 🟡 El marco de líneas finas que rodea CADA bloque no es expresable —el
        // borde vive en `caja` y no todos los bloques la dibujan—, pero las
        // horizontales sí, y son las que se ven: separan la portada del título,
        // el título de la grilla y la grilla del texto.
        { tipo: "divisor", estilo: { caja: { bordeColor: "#111111" } } },
        // ⚠️ La foto es de slot `celda` y no de slot `portada`, que es la única
        // vez que pasa en toda la galería: la portada de la referencia es un
        // producto quieto sobre fondo claro, y las diez fotos de slot `portada`
        // son ambientes llenos de cosas. Sobre una de ésas, el título negro no
        // se leía por más velo que se le pusiera — verificado mirándolo.
        portada("celda-calzado", {
          titulo: "Nueva temporada",
          subtitulo: "",
          boton: { texto: "Ver la colección", url: tienda },
          alto: 300,
          // 🔑 **Texto NEGRO sobre foto clara**, que es como la dibuja la
          // referencia: el velo tiene que ACLARAR y no oscurecer, y de este
          // mismo color sale el contraste que el renderer le calcula al título.
          // Con el oscuro de siempre saldría blanco y sería otra portada.
          veloColor: "#ffffff",
          // 50 y no 30: con poco velo el título negro competía con la foto. Es
          // el mismo criterio que el velo oscuro, al revés.
          velo: 50,
          align: "left",
          estilo: { titulo: { tamano: 36 } },
        }),
        { tipo: "divisor", estilo: { caja: { bordeColor: "#111111" } } },
        { tipo: "titulo", texto: "Indispensable", align: "center" },
        // Sin botón por tarjeta: es la única de las referencias con grilla que
        // no lo tiene. El nombre y el precio hacen todo el trabajo.
        // 🟡 La captura pone CUATRO por fila y `porFila` es 2 | 3.
        grilla("recientes", { tres: true }),
        { tipo: "divisor", estilo: { caja: { bordeColor: "#111111" } } },
        {
          tipo: "seccion",
          // Blanco explícito y no `bg: ""`: con el tema propio, `pal.seccion`
          // sería el beige del motor y la referencia no tiene una sola banda de
          // color — todo el mail es blanco con líneas.
          bg: "#ffffff",
          titulo: "Elegante / Cómodo / Sustentable",
          texto: `Contá en dos líneas por qué elegiste estos materiales y qué hace distinta a la ropa de ${marca}.`,
          ...cta("Ver más", tienda),
        },
        { tipo: "divisor", estilo: { caja: { bordeColor: "#111111" } } },
        // Las dos fotos con la etiqueta abajo y a la IZQUIERDA. El default de la
        // etiqueta es centrada desde la pasada de parecido (seis referencias la
        // centran), así que acá se pide explícito.
        categorias(
          tienda,
          [
            { clave: "celda-abrigos", titulo: "Temporada de abrigo" },
            // ⚠️ No `celda-calzado`: esa foto ya es la de la portada y la misma
            // bota dos veces en el mismo mail se ve como un error, no como una
            // repetición a propósito.
            { clave: "celda-remeras", titulo: "Básicos" },
          ],
          { titulo: { align: "left" } },
        ),
        { tipo: "divisor", estilo: { caja: { bordeColor: "#111111" } } },
        { tipo: "texto", texto: `Seguinos como @${marca.toLowerCase().replace(/\s+/g, "")}`, align: "left" },
        ...botonSi("Ver perfil", tienda, "left"),
        redes,
      ],
    }),
  },
  {
    id: "spring-sale",
    nombre: "Sale de primavera",
    descripcion: "Portada con foto, la historia de la marca firmada y la grilla. Para estrenar estación con descuento.",
    familia: "fechas",
    // Clon de R-011 ("Spring Sale").
    arma: ({ marca, tienda }) => ({
      // Medido: 31,9% blanco, 17,6% negro y 7,3% de un gris azulado #e8f0f0, sin
      // ningún saturado arriba de 0,23%. Es un mail **blanco y negro**; el único
      // color es el hilo debajo del título de la portada, que recortado y medido
      // aparte dio **#c03030** (9,2% de ese recorte). La ficha decía "coral" y
      // es un rojo ladrillo.
      tema: { base: "claro", fondo: "#e8f0f0", fondoContenido: "#ffffff", acento: "#111111", link: "#111111", ancho: 600, fuente: "sistema" },
      estilos: {
        // 🔴 Sin `color`: hay título sobre la foto de la portada y otro sobre la
        // banda negra del medio.
        titulo: { peso: 700 },
        boton: { fondo: "#111111", color: "#ffffff", radio: 2, peso: 700, tamano: 14 },
        imagen: { radio: 0 },
      },
      bloques: [
        portada("portada-moda-1", {
          titulo: "Spring sale",
          subtitulo: "Contá en dos renglones qué entra en el sale y hasta cuándo dura.",
          alto: 300,
          velo: 50,
          estilo: { titulo: { tamano: 40 } },
        }),
        // El hilo rojo que en la referencia va **adentro** de la portada, debajo
        // del título. Ahí no entra —el hero dibuja título, subtítulo y botón y
        // nada más—, así que queda pegado abajo, que es donde más se le parece.
        { tipo: "divisor", estilo: { caja: { bordeColor: "#c03030", bordeAncho: 2 } } },
        aire(8),
        // El "quiénes somos" firmado por una persona: título a la izquierda,
        // relato a la derecha. 🟡 La letra gigante de fondo es superposición y
        // `position` está prohibido en un mail.
        fila(
          [
            { titulo: `La historia de ${marca}`, texto: "Una línea sobre cómo empezó todo." },
            { titulo: "", texto: "Contá acá el relato largo: por qué existe la marca, qué buscabas cuando no encontrabas nada parecido y qué encontraste.\n\nNombre Apellido\nFundadora" },
          ],
          "left",
        ),
        categorias(tienda, [
          { clave: "celda-remeras", titulo: "Mujer" },
          { clave: "celda-abrigos", titulo: "Hombre" },
          { clave: "celda-bolsos", titulo: "Sale" },
        ]),
        // La banda negra de dos renglones. El hex se clava porque **es** el
        // diseño de la referencia, no un tinte de marca: con `bg: ""` sería un
        // beige suave y el mail perdería su único bloque oscuro.
        {
          tipo: "seccion",
          bg: "#111111",
          titulo: "Recién llegado",
          texto: "Lo mejor de la colección nueva, en un solo lugar.",
          ...cta("Verlo ahora", tienda),
        },
        ...menuTienda(tienda, { cuerpo: { tamano: 13 } }),
        // 🟡 La captura pone cuatro por fila.
        grilla("oferta", { tres: true }),
        ...botonSi("Ver más", tienda, "center"),
        { tipo: "texto", texto: "Los precios del sale duran hasta que se agote el stock. Después vuelven a lo que eran.", align: "center" },
        redes,
        // 🟡 La referencia cierra con una banda NEGRA que ocupa todo el pie, con
        // los íconos adentro. El fondo de página es uno solo y arriba tiene que
        // ser el gris de la captura, así que el cierre oscuro va **adentro de la
        // tarjeta** —el mismo camino que `final-sale` y `mega-oferta`— y el pie
        // de la baja queda sobre el gris.
        barra("Recibís este mail porque te anotaste en nuestra lista.", "#111111"),
      ],
    }),
  },
  {
    id: "cyber-tipografico",
    nombre: "Cyber Monday tipográfico",
    descripcion: "Azul noche de punta a punta y el título como un póster. La fecha se anuncia sola, sin foto de producto.",
    familia: "fechas",
    // Clon de R-013 (Cyber Monday tipográfico), la referencia madre de esta
    // familia: es la única de las 21 que no depende de una foto para verse
    // llena.
    arma: ({ marca, tienda }) => ({
      // Medido: el azul noche **#080028 es el 74,4% de los píxeles** —o sea que
      // no es el acento, es el mail entero— y el azul eléctrico #0058d0 el 2,4%,
      // que son los dos botones y la barra de cada categoría. El plan había
      // elegido #2b4cff a ojo y no es ninguno de los dos.
      //
      // 🔑 `fondo` y `fondoContenido` **iguales**: la referencia no tiene
      // tarjeta, es una sola pieza azul de borde a borde. Con dos azules
      // distintos se ve el recuadro recortado, que solo lo tendría nuestro
      // render (misma lección que `brasas`).
      tema: { base: "oscuro", fondo: "#080028", fondoContenido: "#080028", acento: "#0058d0", link: "#0058d0", ancho: 600, fuente: "sistema" },
      estilos: {
        titulo: { mayusculas: true, peso: 700 },
        // El botón de arriba es **blanco con el texto azul**; el de abajo es al
        // revés y se pide en el bloque. Son dos y distintos en la captura.
        boton: { fondo: "#ffffff", color: "#0058d0", radio: 0, peso: 700, tamano: 13, mayusculas: true, espaciado: 2 },
        imagen: { radio: 0 },
      },
      bloques: [
        aire(16),
        // La volanta. El color va **en el bloque** y no en la capa de documento:
        // acá no hay foto detrás, pero clavar el rol `titulo` entero pintaría de
        // azul también el póster, que en la captura es blanco.
        { tipo: "titulo", texto: "Ya llega", align: "center", estilo: { titulo: { tamano: 15, color: "#0058d0", espaciado: 4 } } },
        // El póster: 48 es el tope de `RANGOS.tamano` y es lo que la referencia
        // hace con una condensada que no tenemos (las seis de `FUENTES` son
        // web-safe: una condensada pediría un `<link>` que Gmail descarta).
        { tipo: "titulo", texto: "Cyber Monday", align: "center", estilo: { titulo: { tamano: 48 } } },
        // El año en su propio bloque: el póster de la referencia son **dos
        // renglones** y un `titulo` no los tiene —el `<h2>` sale por `esc()`,
        // sin `nl()`—, así que el salto se hace con dos bloques.
        { tipo: "titulo", texto: "2026", align: "center", estilo: { titulo: { tamano: 48 } } },
        { tipo: "texto", texto: `Tres días de descuentos en toda la tienda de ${marca}. Contá acá qué entra y qué no, para que nadie llegue esperando otra cosa.`, align: "center" },
        ...botonSi("Ver ofertas", tienda, "center"),
        aire(16),
        { tipo: "titulo", texto: "Categorías seleccionadas", align: "center", estilo: { titulo: { tamano: 16, espaciado: 2 } } },
        // 🔑 **La etiqueta de cada foto es una barra sólida azul pegada abajo**,
        // no un texto suelto. `caja.fondo` no existe en `columnas`, así que la
        // barra se hace con el **botón de la celda al ancho** y sin etiqueta:
        // el renderer no dibuja label cuando no hay `titulo`, y un botón cuenta
        // como contenido en el filtro de celdas vacías.
        categorias(
          tienda,
          [
            { clave: "celda-remeras", boton: "Remeras" },
            { clave: "celda-abrigos", boton: "Abrigos" },
            { clave: "celda-joyas", boton: "Accesorios" },
          ],
          { boton: { ancho: 100, fondo: "#0058d0", color: "#ffffff", radio: 0, peso: 700, tamano: 13, mayusculas: false, espaciado: 0 } },
        ),
        { tipo: "texto", texto: "3 días, muchos descuentos.\n¿Te lo vas a perder?", align: "center", estilo: { cuerpo: { tamano: 18, peso: 700 } } },
        // El segundo botón, el azul con texto blanco. Va por `botonSi` con
        // estilo para no perder la guarda del sitio vacío.
        ...botonSi("Ir a la tienda", tienda, "center", { boton: { fondo: "#0058d0", color: "#ffffff" } }),
        aire(8),
        { tipo: "divisor" },
        redes,
      ],
    }),
  },
  {
    id: "cyber-marmol",
    nombre: "Cyber Monday sobre mármol",
    descripcion: "Textura oscura, el código de descuento en el texto y tres accesos con ícono. Para una fecha con cupón.",
    familia: "fechas",
    // Clon de R-015 (Cyber Monday sobre mármol).
    arma: ({ marca, tienda }) => ({
      // Medido: los grises oscuros del mármol suman ~63% (#101010 24%, #181818
      // 21%, #303030 10%), la banda clara del medio es #e8e8e8 (13,8%) y el
      // violeta **#485098** el 1,5% — que son los tres botones y los íconos. El
      // plan había elegido #6d3bd6 a ojo, bastante más saturado.
      //
      // 🔑 `fondo` y `fondoContenido` **iguales**: mirándolo al lado de la
      // captura, con dos oscuros distintos se ve el recuadro de la tarjeta
      // recortado contra la página y la referencia es una sola pieza oscura de
      // borde a borde. Es la misma lección de `brasas`, y acá no hace falta el
      // truco de las bandas porque no hay ninguna zona clara arriba ni abajo.
      tema: { base: "oscuro", fondo: "#101010", fondoContenido: "#101010", acento: "#485098", link: "#7098d0", ancho: 600, fuente: "sistema" },
      estilos: {
        // 🔴 Sin `color`: hay título sobre la foto de mármol y otro sobre la
        // banda clara del medio, que son contrastes opuestos. El motor los
        // resuelve por bloque —`e("titulo", bg)` recibe el fondo real—, y un
        // color de documento le ganaría a los dos a la vez.
        titulo: { peso: 700 },
        boton: { fondo: "#485098", color: "#ffffff", radio: 2, peso: 700, tamano: 14 },
        imagen: { radio: 0 },
      },
      bloques: [
        ...menuTienda(tienda, { cuerpo: { tamano: 13 } }),
        portada("banda-marmol", {
          titulo: "Cyber Monday sale",
          subtitulo: "Hasta 40% OFF en productos seleccionados",
          // 🟡 En la captura el "40% OFF" gigante va **a la derecha** del
          // título, en otra columna: el `hero` es de una sola columna, así que
          // baja al subtítulo. El texto contra el costado sí es expresable.
          align: "left",
          // ⚠️ El alto se mide contra el CONTENIDO y no contra la captura: con
          // 300 quedaba media banda de mármol vacía debajo del subtítulo, que la
          // referencia no tiene —ahí el "40% OFF" de la otra columna llena el
          // alto—. Misma trampa que en `brasas`.
          alto: 200,
          // 🟡 El mármol del pack es CLARO y el de la referencia es negro. El
          // velo alto lo convierte en textura oscura, que es el mismo camino que
          // `brasas` con la madera: lo que la referencia pone atrás del título
          // es materia, no un producto.
          velo: 70,
          // El título de la referencia ocupa media portada. El default de un
          // `hero` es 30 y ahí se leía como un subtítulo más.
          estilo: { titulo: { tamano: 38 } },
        }),
        // El cupón se dice **en el texto**, no en el bloque `cupon`: es lo que
        // hace la referencia, y un `cupon` con su borde punteado ámbar sería
        // otro mail. El código de acá es de muestra y se cambia en el editor.
        { tipo: "texto", texto: "Escribí el código CYBER40 al finalizar la compra y el descuento se aplica solo.", align: "center" },
        // Los tres accesos: ícono, etiqueta y su propio botón al ancho. El botón
        // por celda entró el 2-ago por la regla de 3 y esta es una de las tres
        // referencias que lo pidieron.
        fila(
          [
            { titulo: "Para él", texto: "", icono: "regalo", boton: { texto: "Ver", url: tienda } },
            { titulo: "Para ella", texto: "", icono: "regalo", boton: { texto: "Ver", url: tienda } },
            { titulo: "Gift cards", texto: "", icono: "descuento", boton: { texto: "Ver", url: tienda } },
          ],
          "center",
          { boton: { ancho: 100 } },
        ),
        // La banda clara del medio. 🟡 En la captura lleva una foto al costado y
        // eso es el 🔴 "banda de color con la foto a un costado" del backlog: el
        // `seccion` es de una columna y el `columnas` no toma fondo. Va la banda
        // sola. ⛔ Y los badges de App Store / Google Play no entran: son logos
        // de marca, que es justo lo que el pack de fotos excluye.
        {
          tipo: "seccion",
          bg: "#e8e8e8",
          titulo: "20% extra en tu primera compra",
          texto: `Si es la primera vez que comprás en ${marca}, el descuento se suma al del Cyber.`,
          ...cta("Aprovecharlo", tienda),
        },
        aire(8),
        redes,
      ],
    }),
  },
  {
    id: "vuelta-al-cole",
    nombre: "Vuelta al cole",
    descripcion: "Blanco y negro, con el porcentaje como protagonista. El descuento es el diseño.",
    familia: "fechas",
    // Clon de R-014 ("Back to school").
    arma: ({ marca, tienda }) => ({
      // Medido: 38,1% blanco y 32,3% negro, y **ningún color saturado**: los dos
      // únicos que asoman (0,26%) son el azul de la campera de la foto. Es un
      // mail de dos colores y nada más.
      //
      // 🔑 **El negro va en el `fondo` de PÁGINA**: el encabezado y el pie se
      // dibujan fuera de la tarjeta, así que un fondo negro con la tarjeta
      // blanca da exactamente las dos bandas de la captura sin ningún bloque
      // nuevo. Es el truco que más acercó a `minimal`, `electro` y `audio`.
      tema: { base: "claro", fondo: "#000000", fondoContenido: "#ffffff", acento: "#111111", link: "#111111", ancho: 600, fuente: "sistema" },
      estilos: {
        // 🔴 Sin `color`: hay un título sobre la banda negra del cierre.
        // La manuscrita de la captura no existe en `FUENTES` —las seis son
        // web-safe— y georgia es lo más cerca que hay de una letra con carácter.
        titulo: { fuente: "georgia" },
        boton: { fondo: "#111111", color: "#ffffff", radio: 2, peso: 700, tamano: 14 },
        imagen: { radio: 0 },
      },
      bloques: [
        // ✅ El menú va **adentro** de la banda negra del encabezado, como en la
        // captura. El fondo es el **negro de página** (`#000000`) y no el
        // `#111111` de las barras: la banda arranca el borde de arriba de la
        // tarjeta y tiene que fundirse con el fondo sobre el que se dibuja el
        // encabezado, que es lo que hace leer las dos cosas como una sola banda.
        // Los links salen blancos solos — nadie eligió `color`, así que se
        // recalculan contra la banda.
        ...menuTienda(tienda, { cuerpo: { tamano: 13 } , caja: { fondo: "#000000", padY: 14 } }),
        // La portada de la referencia es texto a la izquierda y foto recortada a
        // la derecha: eso no es un `hero` —que es de una columna— sino dos
        // celdas. `texto-imagen` es "la última con foto".
        {
          tipo: "columnas",
          variante: "texto-imagen",
          proporcion: 50,
          celdas: [
            {
              imagen: "",
              url: tienda,
              titulo: "Vuelta al cole",
              texto: `Contá qué preparaste en ${marca} para arrancar las clases: qué entró, qué se repuso y hasta cuándo dura el descuento.`,
            },
            // ⚠️ Del pack sale un packshot y no una persona: **el criterio de
            // selección excluye las caras reconocibles** porque la plantilla la
            // manda un tercero a su propia lista.
            { imagen: foto("producto-escolar"), url: tienda, titulo: "" },
          ],
          estilo: { titulo: { tamano: 32 } },
        },
        aire(8),
        // El número gigante: en la captura el descuento ES el diseño. 48 es el
        // tope de `RANGOS.tamano`.
        { tipo: "titulo", texto: "60% OFF", align: "left", estilo: { titulo: { tamano: 48, fuente: "sistema", peso: 700 } } },
        { tipo: "texto", texto: "en toda tu compra", align: "left" },
        // La banda negra angosta debajo del número: es una `barra()`, o sea un
        // `seccion` sin título, que es lo que la deja en una sola línea.
        barra("Online y en el local", "#111111"),
        ...botonSi("Ver la tienda", tienda, "center"),
        aire(8),
        // El bloque negro grande del cierre, con el canal de atención.
        {
          tipo: "seccion",
          bg: "#111111",
          titulo: "",
          texto: "¿Dudas con un talle o con el envío? Respondé este mail y te contestamos nosotros, no un robot.",
          ...cta("Escribirnos", tienda),
        },
        redes,
      ],
    }),
  },
  {
    id: "invitacion",
    nombre: "Invitación con foto",
    descripcion: "Portada con foto, la cuenta regresiva y quiénes van a estar. Para un evento con fecha y hora.",
    familia: "fechas",
    // Clon de R-017 (Evento de negocios).
    //
    // ⚠️ Se llama `invitacion` y no `evento` porque ese id ya está tomado por la
    // plantilla de abajo, y **un id de preset no se cambia nunca** (regla 7: es
    // la clave del golden y de `usarPreset`). Las dos se diferencian de verdad:
    // esta lleva foto y fila de gente; la otra no tiene ninguna imagen.
    arma: ({ marca, tienda }) => ({
      // Medido: 47,3% blanco y el azul pizarra **#304858** el 8,8%, que es el
      // pie entero. Abajo del ~20% es acento y no fondo — la pregunta no es de
      // qué color es sino cuánto ocupa.
      tema: { base: "claro", fondo: "#f8f8f8", fondoContenido: "#ffffff", acento: "#304858", link: "#304858", ancho: 600, fuente: "sistema" },
      estilos: {
        // 🔴 Sin `color`: hay título sobre la foto de la portada y otro sobre la
        // banda azul del cierre.
        titulo: { peso: 700 },
        boton: { fondo: "#304858", color: "#ffffff", radio: 2, peso: 700, tamano: 14 },
      },
      bloques: [
        // 🟡 La captura lleva cinco links en dos renglones.
        ...menuTienda(tienda, { cuerpo: { tamano: 13 } }),
        portada("portada-gastro-1", {
          titulo: "Nuestro próximo encuentro",
          subtitulo: "Sábado 00 · 18 h",
          boton: { texto: "Reservar mi lugar", url: tienda },
          alto: 300,
          velo: 55,
          // El texto contra el costado derecho, como la referencia.
          align: "right",
          // 🔴 El botón azul sobre el velo oscuro se lee, pero en la captura es
          // **blanco con el texto oscuro** y es lo que más se ve de la portada.
          estilo: { boton: { fondo: "#ffffff", color: "#111111" } },
        }),
        { tipo: "titulo", texto: "El encuentro empieza en", align: "center" },
        // 🟡 **El contador regresivo no es expresable**: un mail no tiene JS y
        // un GIF con la fecha adentro pide un servicio que sirva la imagen. La
        // fila de tres celdas es la aproximación honesta —los mismos tres
        // números de la captura, quietos— y se editan a mano.
        fila(
          [
            { titulo: "00", texto: "Horas" },
            { titulo: "00", texto: "Minutos" },
            { titulo: "00", texto: "Segundos" },
          ],
          "center",
          { titulo: { tamano: 36 } },
        ),
        {
          tipo: "columnas",
          variante: "imagen-texto",
          proporcion: 40,
          celdas: [
            { imagen: foto("portada-deco-1"), url: tienda, titulo: "" },
            {
              imagen: "",
              url: tienda,
              titulo: `Va a ser el mejor encuentro del año de ${marca}`,
              texto: "Contá qué se va a mostrar, quién va a estar y por qué vale la pena moverse hasta ahí.",
              ...cta("Reservar mi lugar", tienda),
            },
          ],
          // El segundo CTA de la referencia es **outline**: borde fino y sin
          // relleno, distinto del blanco de la portada. El motor siempre
          // rellena, así que el `fondo` es el de la tarjeta.
          estilo: { boton: { fondo: "#ffffff", color: "#111111", bordeAncho: 1, bordeColor: "#111111" } },
        },
        { tipo: "titulo", texto: "Quiénes van a estar", align: "center" },
        // 🟡 En la captura son tres fotos de personas con nombre y cargo. **El
        // pack no tiene caras a propósito** —la plantilla la manda un tercero a
        // su propia lista— así que la fila va de texto: nombre arriba, cargo
        // abajo, que es la misma información sin una foto ajena.
        fila([
          { titulo: "Nombre Apellido", texto: "Qué hace" },
          { titulo: "Nombre Apellido", texto: "Qué hace" },
          { titulo: "Nombre Apellido", texto: "Qué hace" },
        ]),
        aire(8),
        redes,
        // 🟡 El pie de la referencia es una banda azul de borde a borde con las
        // redes y el contacto adentro. El fondo de página es uno solo y arriba
        // tiene que ser claro, así que el cierre azul va **adentro de la
        // tarjeta**, igual que en `mega-oferta` y `spring-sale`.
        {
          tipo: "seccion",
          bg: "#304858",
          titulo: "",
          texto: "Dirección del lugar · Ciudad\nEscribinos si no podés llegar y lo vemos.",
          ...cta("Cómo llegar", tienda),
        },
      ],
    }),
  },
  {
    id: "evento",
    nombre: "Invitación a un evento",
    // Re-descrita el 2-ago-2026: con `invitacion` al lado, lo que la distingue
    // es que **no tiene una sola foto**. Eso no es una versión pobre: es la que
    // sirve cuando hay que mandar la invitación mañana.
    descripcion: "Fecha, lugar y confirmación, sin una sola foto. Para un showroom, un vivo o una preventa que se arma sobre la hora.",
    familia: "fechas",
    arma: ({ marca, tienda }) => ({
      estilos: {
        // Título en versales y botón cuadrado: el rasgo de invitación, elegido
        // una vez para todo el mail.
        titulo: { mayusculas: true, espaciado: 1, color: "$acento" },
        boton: { radio: 0 },
      },
      bloques: [
        aire(12),
        { tipo: "titulo", texto: "Estás invitada/o", align: "center" },
        { tipo: "texto", texto: `Hola \${contacto.nombre}, te esperamos en el próximo encuentro de ${marca}.`, align: "center" },
        {
          tipo: "seccion",
          // 🔑 Este hex SÍ se clava, y es la excepción a la regla 4 de
          // PLANTILLAS.md: en una invitación el bloque oscuro **es** el diseño
          // —la tarjeta negra con la fecha— y no un tinte de marca. Con `bg: ""`
          // sería un beige suave y la plantilla dejaría de ser una invitación.
          bg: "#111827",
          titulo: "Sábado 00 · 18 h",
          texto: "Dirección del lugar\nCiudad",
          ...cta("Confirmar que voy", tienda),
        },
        aire(16),
        // ⛔ Acá había un `{ tipo: "imagen", url: "" }` — un `<img src="">`, que
        // sale roto. Lo que hace a esta plantilla es la banda negra de arriba,
        // no una foto que nadie subió.
        { tipo: "texto", texto: "Contá qué va a pasar: qué se muestra, quién va a estar y por qué vale la pena moverse.", align: "left" },
        aire(8),
        redes,
      ],
    }),
  },
];
