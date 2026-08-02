// Familia "Catálogo": mostrar lo que la tienda vende.
//
// Todas se llenan solas con `productos-dinamicos`, que es lo que hace que se
// vean completas el primer día —sin que nadie suba una foto— y distintas cada
// vez que se mandan.
//
// El orden importa: **las que traen foto de stock van primero**, porque el orden
// de esta lista es el orden de la galería y lo primero que ve el comerciante
// tiene que parecerse a lo que fue a buscar. Las cinco de abajo se quedan a
// propósito: son las únicas que se llenan **solo con su catálogo, sin una foto
// ajena**, y eso es un valor distinto y no una versión pobre.
//
// 🔴 **Solo dos formas de grilla en toda la galería**: `{n:6, porFila:3}` y
// `{n:4}`, las dos con `movil:2`. No es estética: `/plantillas` resuelve contra
// Tiendanube una consulta por `claveProductos` (`fuente|categoriaId|n`) de la
// familia activa, así que doce presets inventando su propio `n` convierten una
// pestaña de 2-3 llamadas en una de 10, contra un límite que se comparte con el
// monitor y con Resorty.

import {
  type DefPreset, aire, banda, bandaFoto, barra, botonSi, categorias, cta, fila,
  grilla, menuTienda, portada, redes,
} from "../comun";
import { alt, foto } from "../fotos";

export const CATALOGO: readonly DefPreset[] = [
  {
    id: "marroquineria",
    nombre: "La tienda completa, con foto",
    descripcion: "Portada con foto, los más elegidos, las categorías y la banda de quiénes somos. La anatomía más completa de todas.",
    familia: "catalogo",
    // Clon de R-002 (Morelia, marroquinería): es la referencia más completa de la
    // primera tanda.
    //
    // 🔑 **Lo que la hace ser ella no es la anatomía, es que no tiene un solo
    // botón relleno**: todos los CTA son texto subrayado. Con el ámbar del tema
    // por defecto salía un mail de pastillas naranjas que no se parecía en nada,
    // aunque los bloques fueran los mismos. Ver el `boton` de la capa de abajo.
    arma: ({ tienda }) => ({
      // Tema COMPLETO: `combinarTema` es un spread plano, así que cualquier
      // campo que falte acá se cae al de la marca que elige la plantilla y el
      // clon deja de ser un clon. Ver `PLANTILLAS.md`, regla 4.
      tema: { base: "claro", fondo: "#ffffff", fondoContenido: "#ffffff", acento: "#283840", link: "#283840", ancho: 600, fuente: "sistema" },
      estilos: {
        // Serifa en los títulos y palo seco en el cuerpo: la referencia mezcla
        // las dos, así que la fuente del tema es la del cuerpo y la serifa entra
        // por el rol.
        // 🔴 **Sin `color`.** Clavarlo apaga el contraste automático, y esta
        // plantilla tiene dos títulos sobre foto oscura (la portada y la banda
        // del taller): salían negros sobre negro. El motor ya elige claro u
        // oscuro según el fondo donde cae CADA título; ver `bandaConFoto`.
        titulo: { fuente: "georgia", peso: 400, espaciado: 0.4 },
        subtitulo: { color: "#5a5a5a" },
        cuerpo: { color: "#5a5a5a" },
        nota: { color: "#9a9a9a" },
        // El CTA de texto subrayado. `fondo` blanco y no "sin fondo" porque el
        // motor no tiene transparente —los colores son hex— y blanco sobre
        // blanco es exactamente lo que se ve en la captura.
        boton: { fondo: "#ffffff", color: "#1f1f1f", radio: 0, padX: 2, padY: 4, peso: 700, tamano: 14, subrayado: true },
        imagen: { radio: 0 },
      },
      bloques: [
        ...menuTienda(tienda, { cuerpo: { tamano: 13, color: "#4a4a4a" } }),
        portada("portada-cuero-1", {
          titulo: "100% cuero",
          subtitulo: "Todos nuestros productos están confeccionados en cuero ecológico.",
          boton: { texto: "Comprar", url: tienda },
          alto: 260,
          velo: 45,
          // 🔴 El botón blanco de la capa de documento **sobre una foto oscura
          // es un rectángulo blanco**, no un link subrayado: el motor siempre
          // rellena, así que "sin fondo" se emula con un fondo que se confunda
          // con lo que hay atrás. Acá atrás hay un velo oscuro.
          estilo: { boton: { fondo: "#1f1f1f", color: "#ffffff" } },
        }),
        { tipo: "titulo", texto: "Los más elegidos", align: "center" },
        grilla("destacados", { tres: true, boton: "Comprar" }),
        aire(8),
        // ⚠️ La referencia pone CINCO categorías. Cuatro es el tope del bloque, y
        // no por el tipo: a 600px de ancho, cinco celdas quedan en 104px cada una
        // —menos que la foto de producto más chica— y en la casilla no se leen.
        categorias(tienda, [
          { clave: "celda-bolsos", titulo: "Bolsos" },
          { clave: "celda-calzado", titulo: "Calzado" },
          { clave: "celda-abrigos", titulo: "Abrigos" },
          { clave: "celda-joyas", titulo: "Accesorios" },
        ]),
        aire(8),
        // El producto del mes: foto a la izquierda y el texto **centrado** a la
        // derecha, que es como lo dibuja la captura. Sin título arriba: la
        // referencia no lo tiene, el nombre del producto ES el título de la
        // celda.
        {
          tipo: "columnas",
          variante: "imagen-texto",
          proporcion: 40,
          celdas: [
            { imagen: foto("producto-mochila"), url: tienda, titulo: "" },
            {
              titulo: "El del mes",
              texto: "Descubrí la fusión perfecta entre estilo y sostenibilidad.\n\nTres renglones sobre qué es, para quién y por qué lo elegirían: es el bloque que más convierte de todo el mail.",
              imagen: "",
              url: tienda,
              ...cta("Ver más", tienda),
            },
          ],
          estilo: { titulo: { align: "center", tamano: 15, peso: 400 }, cuerpo: { align: "center", tamano: 13 } },
        },
        aire(8),
        bandaFoto(
          "banda-taller",
          "Nuestra misión es ofrecer objetos de alta calidad, sin comprometer el estilo ni el respeto por los animales.",
          "",
          { texto: "Conocer más", url: tienda },
          200,
          // Mismo caso que la portada: sobre la foto, el botón blanco es una caja.
          { boton: { fondo: "#1f1f1f", color: "#ffffff" } },
        ),
        aire(8),
        fila([
          { titulo: "Nosotros", texto: "Productos de alta calidad que reflejan la artesanía tradicional.", icono: "calidad" },
          { titulo: "Locales", texto: "Tenemos locales en todo el país para que puedas verlos.", icono: "atencion" },
          { titulo: "Reciclados", texto: "100% reciclados, amables con el medio ambiente.", icono: "cambios" },
        ]),
        redes,
      ],
    }),
  },
  {
    id: "new-arrivals",
    nombre: "New arrivals",
    descripcion: "Categorías con su propio botón, la marca contada en el medio y la grilla de tres. En mayúsculas, para marcas de ropa.",
    familia: "catalogo",
    // Clon de R-018 (SIMPLE): es la referencia que trajo el botón por celda al
    // motor.
    //
    // 🔑 Su portada es lo que más la distingue y es lo que teníamos al revés:
    // el título va **enorme, negro y contra un costado**, sobre una foto clara
    // y casi sin velo — sin subtítulo y sin botón. La nuestra era la portada
    // genérica de la galería (velo oscuro, texto blanco centrado, tres cosas
    // adentro) y por eso se leía como otra plantilla aunque el resto coincidiera.
    arma: ({ tienda }) => ({
      // Dorado medido sobre la captura con `scripts/paleta-referencia.ts`
      // (#c0a040, 3,3% de los píxeles), no elegido a ojo: el ámbar del tema por
      // defecto es de otra familia de color y es lo primero que se nota.
      tema: { base: "claro", fondo: "#f0f0f0", fondoContenido: "#f8f8f8", acento: "#c0a040", link: "#c0a040", ancho: 600, fuente: "sistema" },
      estilos: {
        titulo: { mayusculas: true, espaciado: 1, peso: 700, color: "#1f2a36" },
        subtitulo: { color: "#4a4a4a" },
        cuerpo: { color: "#4a4a4a" },
        // El botón dorado de la referencia es un rectángulo sin redondeo, con el
        // texto chico y espaciado. `ancho: 100` es lo que lo estira al ancho de
        // su celda en la fila de categorías.
        boton: { radio: 0, mayusculas: true, tamano: 12, espaciado: 1, peso: 700 },
        imagen: { radio: 0 },
      },
      bloques: [
        ...menuTienda(tienda, { cuerpo: { mayusculas: true, tamano: 12, espaciado: 1, color: "#1f2a36" } }),
        portada("portada-moda-1", {
          titulo: "New arrivals",
          subtitulo: "",
          alto: 240,
          // Velo BLANCO y bajo: acá el velo no oscurece para que entre texto
          // claro, aclara para que entre texto negro. De este mismo color sale
          // el contraste que el renderer le calcula al título.
          veloColor: "#ffffff",
          velo: 12,
          align: "right",
          estilo: { titulo: { tamano: 44, interlinea: 1.05, color: "#111111", espaciado: 0 } },
        }),
        // El patrón que justificó el cambio de motor del 2-ago: cada celda con
        // su propio botón, en vez de una foto muda que linkea entera. Los tres
        // textos son distintos porque en la captura lo son.
        categorias(tienda, [
          { clave: "celda-remeras", titulo: "Mujer", boton: "Comprar" },
          { clave: "celda-abrigos", titulo: "Hombre", boton: "Ver producto" },
          { clave: "celda-calzado", titulo: "Niños", boton: "Shop" },
        ], { boton: { ancho: 100 }, titulo: { align: "center", mayusculas: true, tamano: 13, espaciado: 0.5 } }),
        // ⚠️ Era un `banda()` —un `seccion` con fondo de color— y la captura no
        // tiene ninguna banda acá: es texto sobre el mismo fondo, entre dos
        // líneas finas. Con la banda, el bloque se leía como un aviso y no como
        // la marca presentándose.
        { tipo: "divisor" },
        { tipo: "titulo", texto: "Una filosofía de vida", align: "center" },
        { tipo: "texto", texto: "Somos una tienda inspirada en la indumentaria. Vas a encontrar las tendencias de la moda y todo lo que se viene.", align: "center" },
        { tipo: "divisor" },
        // El nombre del producto va en mayúsculas, como en la captura. Va en el
        // bloque y no en la capa de documento: el rol `cuerpo` también lo usa el
        // párrafo de "una filosofía de vida", que ahí sí va en minúscula.
        grilla("recientes", { tres: true, boton: "Agregar al carrito", estilo: { cuerpo: { mayusculas: true, peso: 700, tamano: 13 } } }),
        // ⚠️ Era `full: true`, y la captura dice que no: el "VER TODOS LOS
        // PRODUCTOS" de R-018 —y el de R-019 y R-020— es una pastilla centrada
        // de ancho medio, no una barra de lado a lado. Se escribió de la ficha
        // de texto, sin abrir la imagen.
        ...botonSi("Ver todos los productos", tienda, "center"),
        aire(8),
        {
          tipo: "columnas",
          variante: "imagen-texto",
          proporcion: 40,
          celdas: [
            { imagen: foto("producto-textil"), url: tienda, titulo: "" },
            {
              titulo: "Acompañamos tu camino",
              texto: "Estamos presentes en todas las etapas de tu vida.",
              imagen: "",
              url: tienda,
              ...cta("Conocénos", tienda),
            },
          ],
          estilo: { titulo: { align: "center" }, cuerpo: { align: "center" } },
        },
        aire(8),
        fila([
          { titulo: "Envíos gratis", texto: "Para compras de más del mínimo que definas.", icono: "envio" },
          { titulo: "12 cuotas sin interés", texto: "Con todas las tarjetas.", icono: "tarjeta" },
          { titulo: "Cambios y devoluciones", texto: "Primera devolución gratis.", icono: "cambios" },
        ]),
        redes,
      ],
    }),
  },
  {
    id: "minimal",
    nombre: "Minimalista",
    descripcion: "Una foto de borde a borde, tres categorías y la grilla. Casi sin texto: la foto manda.",
    familia: "catalogo",
    // Clon de R-020 (SIMPLE en portugués): la portada que es SOLO una foto a
    // sangre, sin texto encima. Es la más silenciosa de la galería.
    //
    // 🔴 La serifa estaba de más: en la captura **solo el logo es serifa**, y el
    // resto —menú, etiquetas, títulos, botones— es palo seco en negrita. Se
    // había escrito de la ficha ("serifa espaciada en el logo") aplicándola a
    // todos los títulos, que es media plantilla con otra tipografía.
    arma: ({ tienda }) => ({
      // Negro y blanco, sin un tercer color: las bandas de arriba y de abajo son
      // el fondo de PÁGINA, y el contenido va sobre blanco.
      tema: { base: "claro", fondo: "#111111", fondoContenido: "#ffffff", acento: "#111111", link: "#111111", ancho: 600, fuente: "sistema" },
      estilos: {
        titulo: { peso: 700 },
        // Botón negro, cuadrado y en mayúsculas: aparece cuatro veces en la
        // captura y siempre igual.
        boton: { radio: 2, mayusculas: true, peso: 700, tamano: 13, espaciado: 0.5 },
        imagen: { radio: 2 },
      },
      bloques: [
        ...menuTienda(tienda, { cuerpo: { mayusculas: true, tamano: 13, espaciado: 0.5 } }),
        // A sangre: pegada a los bordes de la tarjeta, sin radio ni margen. ⚠️ Es
        // el único caso del pack en el que la foto NO degrada a un color si no
        // carga (`fondoImagen` sí lo hace) — por eso lleva `alt` sí o sí: en
        // Outlook con imágenes bloqueadas, el alt ES la portada.
        { tipo: "imagen", url: foto("portada-moda-2"), alt: alt("portada-moda-2"), sangre: true },
        aire(16),
        // Sin título arriba: la captura pasa de la portada a las categorías sin
        // decir nada en el medio. Es lo que la hace "la más silenciosa".
        categorias(tienda, [
          { clave: "celda-remeras", titulo: "Suéters" },
          { clave: "celda-abrigos", titulo: "Camisas" },
          { clave: "celda-calzado", titulo: "Remeras" },
        ], { titulo: { align: "center", peso: 700, tamano: 14 } }),
        { tipo: "divisor" },
        { tipo: "titulo", texto: "Categorías principales", align: "center" },
        grilla("destacados", { tres: true, boton: "Comprar", estilo: { cuerpo: { mayusculas: true, peso: 700, tamano: 13 } } }),
        ...botonSi("Ver todos los productos", tienda, "center"),
        redes,
      ],
    }),
  },
  {
    id: "joyeria",
    nombre: "Con barra de envío",
    descripcion: "La barra fina de arriba con tu promesa de envío, portada con foto y las categorías. Sobria.",
    familia: "catalogo",
    // Clon de R-007 (Lima, joyería): la referencia que pidió la barra fina de
    // aviso, que se pudo recién cuando el `seccion` sin botón dejó de arrastrar
    // 16px de margen muerto.
    //
    // 🔑 El azul noche **no era prescindible**: es la barra de arriba, la banda
    // del medio y el color de todo el texto. Sin él quedaba un mail blanco con
    // pastillas ámbar, que es otra plantilla. Y sus botones son **pastillas
    // vacías con borde fino**, no rellenas: el único relleno de la captura es
    // el blanco del hero.
    arma: ({ tienda }) => ({
      tema: { base: "claro", fondo: "#ffffff", fondoContenido: "#ffffff", acento: "#ffffff", link: "#183050", ancho: 600, fuente: "sistema" },
      estilos: {
        // Sin `color`: el azul se ve en la barra, la banda y los links, pero
        // clavarlo en el rol dejaba "Narcissus" azul noche sobre la foto oscura
        // de la portada. Mismo caso que `marroquineria`.
        titulo: { peso: 600 },
        cuerpo: { color: "#6b7280" },
        nota: { color: "#9aa3af" },
        // Pastilla vacía con borde: `fondo` blanco + `bordeAncho` es lo que la
        // dibuja. Sin el borde, un botón blanco sobre fondo blanco no se ve.
        boton: { radio: 24, fondo: "#ffffff", color: "#3f4a5a", bordeAncho: 1, bordeColor: "#c9ced8", peso: 600, tamano: 14 },
        imagen: { radio: 4 },
      },
      bloques: [
        ...menuTienda(tienda),
        // ⚠️ Sin monto: el mínimo de envío gratis es de cada tienda y no lo sabe
        // el preset. Prometer "$20.000" acá es una promesa ajena en un mail ya
        // enviado, que es de las pocas cosas que no se pueden corregir después.
        barra("Envío gratis a partir del monto que definas", "#183050"),
        portada("portada-joyas-1", {
          titulo: "Narcissus",
          subtitulo: "Vestí tu reflejo con nuestra selección de artículos premium.",
          boton: { texto: "Ver selección", url: tienda },
          alto: 240,
          velo: 30,
          // El texto va contra el margen izquierdo, no centrado: es lo primero
          // que separa esta portada de la genérica de la galería.
          align: "left",
        }),
        { tipo: "titulo", texto: "Nuestra selección", align: "left", estilo: { titulo: { tamano: 16, peso: 400 } } },
        // Cuatro por fila, como la captura. Es la otra forma de grilla que la
        // galería permite (`{n:4}`), así que no agrega una consulta nueva.
        // 🟡 La captura pone CUATRO por fila y el motor sabe dos o tres
        // (`PorFila`). Tres se parece más que dos; el de cuatro quedó anotado en
        // el backlog, que ya lleva cuatro referencias pidiéndolo.
        grilla("destacados", { tres: true, boton: "Comprar" }),
        aire(8),
        { tipo: "titulo", texto: "Categorías", align: "left", estilo: { titulo: { tamano: 16, peso: 400 } } },
        categorias(tienda, [
          { clave: "celda-joyas", titulo: "Aros" },
          { clave: "celda-regalos", titulo: "Colgantes" },
          { clave: "celda-belleza", titulo: "Pulseras" },
          { clave: "celda-bolsos", titulo: "Anillos" },
        ], { titulo: { align: "center", tamano: 13, peso: 400 } }),
        aire(8),
        bandaFoto("banda-marmol", "Colors", "Colección de joyas de acrílico.", { texto: "Ver colección", url: tienda }, 180),
        redes,
      ],
    }),
  },
  {
    id: "new-in",
    nombre: "New in",
    descripcion: "Volanta, portada con foto y dos categorías grandes. Para anunciar que entró temporada nueva.",
    familia: "catalogo",
    // Clon de R-008 (idea, "New in"): la que trajo la volanta —un título chico
    // arriba del grande— y la barra fina de envío arriba de todo.
    //
    // 🔑 El verde agua (#18c8a0, medido) es la plantilla entera: la barra de
    // arriba, el precio de oferta, los botones y el pie. Con el ámbar del tema
    // por defecto no quedaba nada de la referencia salvo el orden de los
    // bloques. Y sus botones son **pastillas**, no rectángulos.
    arma: ({ tienda }) => ({
      tema: { base: "claro", fondo: "#ffffff", fondoContenido: "#ffffff", acento: "#18c8a0", link: "#18c8a0", ancho: 600, fuente: "sistema" },
      estilos: {
        // Sin `color`, por lo mismo que en `marroquineria` y `joyeria`: la
        // portada y la banda de "city walking" llevan el título sobre foto.
        titulo: { peso: 700 },
        cuerpo: { color: "#4a4a4a" },
        // Verde con texto BLANCO: el contraste automático elegiría oscuro sobre
        // un verde tan claro, y la captura lo hace al revés.
        boton: { radio: 24, color: "#ffffff", mayusculas: true, peso: 700, tamano: 13, espaciado: 0.5 },
        imagen: { radio: 4 },
      },
      bloques: [
        // ⚠️ Sin monto: el mínimo de envío gratis es de cada tienda. Prometer
        // "$14.000" acá es una promesa ajena en un mail ya enviado.
        barra("Envío gratis a partir del monto que definas", "#18c8a0"),
        portada("portada-moda-2", {
          titulo: "Stripes shirt",
          subtitulo: "Nueva colección",
          // Pastilla BLANCA con texto oscuro sobre la foto, que es el único
          // botón de la captura que no es verde.
          boton: { texto: "Ver productos", url: tienda },
          alto: 280,
          velo: 25,
          estilo: { boton: { fondo: "#ffffff", color: "#1a1a1a" } },
        }),
        bandaFoto("banda-tela", "City walking", "", { texto: "Ver categoría", url: tienda }, 200),
        categorias(tienda, [
          { clave: "celda-remeras", titulo: "Adventure life" },
          { clave: "celda-abrigos", titulo: "Bikinis" },
        ], { titulo: { align: "center", peso: 700, tamano: 15 } }),
        aire(8),
        { tipo: "titulo", texto: "New in!", align: "center" },
        grilla("recientes", { tres: true, boton: "Comprar", estilo: { cuerpo: { peso: 700, tamano: 14 } } }),
        { tipo: "divisor" },
        // Los tres íconos de la captura son exactamente estos tres: camión,
        // tarjeta y escudo.
        fila([
          { titulo: "Envíos a todo el país", texto: "A partir del mínimo, envío gratuito.", icono: "envio" },
          { titulo: "Pagá con todas las tarjetas", texto: "Hasta en 12 cuotas.", icono: "tarjeta" },
          { titulo: "Compra con seguridad", texto: "Todos tus datos están protegidos.", icono: "seguro" },
        ]),
        redes,
      ],
    }),
  },
  {
    id: "electro",
    nombre: "Con video",
    descripcion: "Portada con foto, categorías, la grilla y un video. Para productos que se explican mostrándolos.",
    familia: "catalogo",
    // Clon de R-006 (Atlántico, electrónica): la única de las 21 que lleva video,
    // y la que pidió el menú lateral adentro de la portada.
    //
    // 🟡 **El menú lateral no es expresable**: el `hero` es una columna sola, y
    // un menú al costado es otra tabla. Va arriba, como en las otras 14
    // referencias que llevan `menu`. Quedó anotado en el backlog con 2 pedidos.
    arma: ({ tienda }) => ({
      // Negro, blanco y un azul de CTA. El azul es #3080f8 medido sobre la
      // captura: aparece solo en los botones y es todo el color que tiene el
      // mail.
      tema: { base: "claro", fondo: "#111111", fondoContenido: "#ffffff", acento: "#3080f8", link: "#3080f8", ancho: 600, fuente: "sistema" },
      estilos: {
        titulo: { peso: 700 },
        cuerpo: { color: "#4a4a4a" },
        boton: { radio: 4, color: "#ffffff", mayusculas: true, peso: 700, tamano: 13, espaciado: 0.5 },
        imagen: { radio: 2 },
      },
      bloques: [
        ...menuTienda(tienda),
        portada("portada-tech-1", {
          titulo: "Tecnología que se explica sola",
          subtitulo: "Más de 20 horas de batería para usar.",
          boton: { texto: "Comprar", url: tienda },
          alto: 230,
          velo: 45,
          // Texto contra el margen izquierdo, como en la captura.
          align: "left",
        }),
        categorias(tienda, [
          { clave: "celda-tecnologia", titulo: "Notebooks" },
          { clave: "celda-auriculares", titulo: "Audio" },
          { clave: "celda-regalos", titulo: "Regalos" },
        ], { titulo: { align: "center", peso: 700, tamano: 14 } }),
        { tipo: "titulo", texto: "Productos destacados", align: "center" },
        { tipo: "texto", texto: "Descubrí los productos destacados de esta semana para estar siempre con las últimas tendencias.", align: "center" },
        // El "ver todos" va ARRIBA de la grilla, no abajo: la captura lo pone
        // como remate del bloque de texto y después muestra el catálogo.
        ...botonSi("Ver todos los productos", tienda, "center"),
        { tipo: "divisor" },
        grilla("destacados", { tres: true, boton: "Comprar", estilo: { cuerpo: { peso: 700, tamano: 14 } } }),
        aire(8),
        // Sin miniatura el bloque no se dibuja, igual que la imagen: la plantilla
        // no muestra un hueco hasta que alguien pegue el link de su video.
        { tipo: "video", imagen: "", url: "" },
        aire(8),
        fila([
          { titulo: "Enviamos tu compra", texto: "Entregas a todo el país.", icono: "envio" },
          { titulo: "Pagá como quieras", texto: "Tarjetas de crédito o efectivo.", icono: "tarjeta" },
          { titulo: "Comprá con seguridad", texto: "Tus datos siempre protegidos.", icono: "seguro" },
        ]),
        redes,
      ],
    }),
  },
  {
    id: "audio",
    nombre: "Oscura con acento",
    descripcion: "Fondo oscuro y un color fuerte de acento. Para marcas de tecnología, audio o deporte.",
    familia: "catalogo",
    // Clon de R-019 (CUBO co., audio): negro y amarillo, sin serifa.
    //
    // 🔴 **Estaba en tema OSCURO y la referencia no lo es.** Se escribió de la
    // ficha, que dice "negro y amarillo", y el mail real es **blanco**: lo negro
    // son dos bandas —la del logo arriba y la de las redes abajo— y el texto.
    // Medido con `paleta-referencia.ts`: 47% de los píxeles son blancos
    // (#f8f8f8 + #f0f0f0) contra 12,5% negros. Un mail entero en negro no se
    // parece a uno blanco con dos bandas negras, por más que los dos "sean
    // negro y amarillo".
    //
    // 🔑 Las bandas salen del `fondo` de PÁGINA: el encabezado y el pie se
    // dibujan afuera de la tarjeta de contenido, así que un fondo de página
    // negro con la tarjeta blanca da exactamente las dos bandas de la captura,
    // sin ningún bloque nuevo.
    arma: ({ tienda }) => ({
      tema: { base: "claro", fondo: "#111111", fondoContenido: "#ffffff", acento: "#f8d000", link: "#111111", ancho: 600, fuente: "sistema" },
      estilos: {
        // 🔴 **Sin `color` a propósito.** Clavarlo en #111111 —que es el color
        // que se ve en la captura— apagaba el contraste automático y dejaba el
        // nombre de la marca negro sobre la banda negra y el título de la banda
        // con foto negro sobre la foto oscura. El motor ya elige claro u oscuro
        // según DÓNDE cae cada título, y acá cae en tres fondos distintos.
        titulo: { peso: 700 },
        subtitulo: { peso: 700 },
        cuerpo: { color: "#4a4a4a" },
        // Amarillo con texto BLANCO: el motor calcularía texto oscuro sobre un
        // amarillo claro —que es lo correcto para contraste— y la referencia lo
        // hace al revés. Es una elección de la marca, así que se escribe.
        boton: { color: "#ffffff", radio: 2, mayusculas: true, peso: 700, tamano: 13, espaciado: 0.5 },
        imagen: { radio: 2 },
      },
      bloques: [
        ...menuTienda(tienda),
        portada("portada-tech-1", {
          titulo: "La mejor calidad de sonido",
          subtitulo: "Anulación de sonido de ambiente.",
          boton: { texto: "Ver productos", url: tienda },
          alto: 260,
          // Texto NEGRO a la izquierda sobre la parte clara de la foto, como en
          // la captura: el velo aclara en vez de oscurecer.
          veloColor: "#ffffff",
          velo: 25,
          align: "left",
          estilo: { titulo: { tamano: 28, color: "#111111" }, subtitulo: { color: "#111111" } },
        }),
        // 🟡 La referencia le pone una BAJADA a cada tarjeta de categoría, debajo
        // del nombre. La celda de imagen dibuja foto + etiqueta y nada más
        // (`celdaImagen` en `render.ts`): con un solo pedido no entra al motor,
        // así que el nombre carga con todo.
        categorias(tienda, [
          { clave: "celda-auriculares", titulo: "Auriculares" },
          { clave: "celda-tecnologia", titulo: "Escritorio" },
          { clave: "celda-deporte", titulo: "Deporte" },
        ]),
        { tipo: "titulo", texto: "Productos destacados", align: "left" },
        // El CTA de cada tarjeta es TEXTO subrayado, no una pastilla amarilla:
        // en la captura el amarillo aparece una sola vez por bloque y por eso
        // pega. Va en el bloque y no en la capa de documento, que es donde vive
        // el botón amarillo de los CTA grandes.
        grilla("destacados", {
          tres: true,
          boton: "Comprar",
          estilo: { cuerpo: { peso: 700, color: "#111111" }, boton: { fondo: "#ffffff", color: "#111111", subrayado: true, radio: 0, padX: 2, padY: 2 } },
        }),
        ...botonSi("Ver todos los productos", tienda, "center"),
        aire(8),
        // Baja (140 y no 220): en la captura es una franja, no un bloque de
        // media pantalla con la foto respirando alrededor del texto.
        bandaFoto("banda-madera", "Todo lo que necesitás para tu escritorio", "", { texto: "Visitar tienda", url: tienda }, 140),
        redes,
      ],
    }),
  },
  {
    id: "tienda",
    nombre: "Tu tienda entera",
    descripcion: "Menú arriba, grilla de tres, un destacado y la banda de beneficios. Se llena sola con tu catálogo, sin una sola foto de stock.",
    familia: "catalogo",
    // La anatomía que más se repitió en la primera tanda de referencias
    // (R-002, R-006, R-018, R-019, R-020): navegación arriba, catálogo en el
    // medio, un producto que se explica, y por qué comprarte a vos abajo.
    arma: ({ marca, tienda }) => ({
      estilos: { imagen: { radio: 12 } },
      bloques: [
        ...menuTienda(tienda),
        {
          tipo: "hero",
          imagen: "",
          titulo: "Todo lo que tenemos, en un mail",
          subtitulo: `Lo que más sale de ${marca}, elegido para vos.`,
          bg: "",
          ...cta("Ver la tienda", tienda),
        },
        // Tres por fila: es lo que hacen 16 de las 21 referencias. Seis llenan
        // dos filas parejas — con `n: 4` la segunda quedaría con un hueco.
        { tipo: "productos-dinamicos", fuente: "destacados", n: 6, movil: 2, porFila: 3 },
        ...botonSi("Ver todo el catálogo", tienda, "center"),
        aire(8),
        { tipo: "divisor" },
        { tipo: "titulo", texto: "El que no puede faltar", align: "left" },
        // Dos columnas imagen + texto: el bloque `columnas` no lo usaba ningún
        // preset. Nace sin foto y el renderer no dibuja una celda vacía, así
        // que hasta que suban una la plantilla se ve completa igual.
        {
          tipo: "columnas",
          variante: "imagen-texto",
          proporcion: 40,
          celdas: [
            { imagen: "", url: tienda },
            {
              titulo: "Contá por qué este",
              texto: "Una foto y tres renglones: qué es, para quién y por qué lo elegirían. Es el bloque que más convierte de todo el mail.",
              imagen: "",
              url: tienda,
            },
          ],
        },
        aire(8),
        fila([
          { titulo: "Envíos a todo el país", texto: "Con seguimiento del pedido." },
          { titulo: "Cambios sin vueltas", texto: "Tenés 30 días para cambiarlo." },
          { titulo: "Te respondemos", texto: "Escribinos y te contestamos." },
        ]),
        redes,
      ],
    }),
  },
  {
    id: "categorias",
    nombre: "Por categorías",
    descripcion: "Los accesos directos a cada rubro y la grilla abajo. Sin fotos de stock: la llenan tu catálogo y tus nombres de categoría.",
    familia: "catalogo",
    // R-004, R-007, R-018 y R-021: la fila de categorías con la etiqueta
    // debajo de la foto. Es lo que abrió el bloque `columnas` a 3 y 4 celdas.
    arma: ({ marca, tienda }) => ({
      estilos: { imagen: { radio: 12 }, boton: { radio: 24 } },
      bloques: [
        ...menuTienda(tienda),
        { tipo: "titulo", texto: "¿Qué estás buscando?", align: "center" },
        { tipo: "texto", texto: `Hola \${contacto.nombre}, entrá directo al rubro que te interesa de ${marca}.`, align: "center" },
        // 🔴 **`variante: "textos"`, y no es cosmético**: hasta el 2-ago-2026
        // esto eran cuatro celdas de IMAGEN sin imagen, y el filtro de celdas
        // vacías las descartaba a las cuatro ⇒ el bloque no dibujaba nada. Es el
        // mismo bug que tenía `redes` con los links vacíos: un bloque puesto en
        // el Json que nunca llegó a una casilla. Verificado el 2-ago con el
        // render: 1 bloque `columnas` en el documento, 0 filas dibujadas.
        //
        // Se arregla por acá y no bajándole una foto de stock a propósito: esta
        // plantilla es de las que se llenan **sin una foto ajena** (para eso está
        // `marroquineria`), así que las celdas pasan a ser accesos directos de
        // texto, que es lo que la variante dibuja y linkea entero.
        {
          tipo: "columnas",
          variante: "textos",
          celdas: [
            { titulo: "Novedades", texto: "Lo último que entró." },
            { titulo: "Más vendidos", texto: "Lo que más sale." },
            { titulo: "Ofertas", texto: "Lo que está rebajado." },
            { titulo: "Todo el catálogo", texto: "Mirá la tienda entera." },
          ].map((c) => ({ ...c, imagen: "", url: tienda })),
        },
        aire(8),
        { tipo: "titulo", texto: "Lo más elegido", align: "left" },
        { tipo: "productos-dinamicos", fuente: "destacados", n: 6, movil: 2, porFila: 3 },
        ...botonSi("Ver la tienda completa", tienda, "center"),
        redes,
      ],
    }),
  },
  {
    id: "ecommerce",
    nombre: "E-commerce clásico",
    descripcion: "Portada, los más vendidos de tu tienda y una banda de beneficios. El caballito de batalla.",
    familia: "catalogo",
    arma: ({ marca, tienda }) => ({
      // Botón pastilla para todo el mail: la capa de documento existe justo para
      // esto — un rasgo que se elige una vez y no se repite en cada bloque.
      estilos: { boton: { radio: 24 }, imagen: { radio: 12 } },
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "Lo que más se está vendiendo",
          subtitulo: `Una selección de ${marca} para que no te lo pierdas.`,
          // `bg` vacío = la tarjeta del tema. Antes decía "#ffffff", que era la
          // peor de las dos opciones: en un mail claro no se ve (banda blanca
          // sobre tarjeta blanca) y en uno oscuro es un parche blanco.
          bg: "",
          ...cta("Ver la tienda", tienda),
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es lo que más está saliendo esta semana 👇", align: "left" },
        // El bloque que justifica que este mailer viva sobre Tiendanube: la
        // plantilla se arma una vez y sale distinta cada vez que se manda.
        //
        // `movil: 2` en TODAS las grillas de los presets, igual que en
        // `nuevoBloque`: lo que se arma hoy nace de a dos por fila en el
        // teléfono. Un preset se instancia en el momento, no es un documento
        // guardado, así que acá no hay nada que "cambiar sin que nadie toque"
        // — el default ausente sigue existiendo para los mails ya guardados.
        { tipo: "productos-dinamicos", fuente: "destacados", n: 4, movil: 2 },
        ...botonSi("Ver todo el catálogo", tienda, "center"),
        aire(8),
        banda("Comprá tranquilo", "Envíos a todo el país · Cambios sin vueltas · Atención por WhatsApp"),
        redes,
      ],
    }),
  },
  {
    id: "novedades",
    nombre: "Novedades del mes",
    descripcion: "Se llena sola con lo último que cargaste. Se arma una vez y sirve todos los meses.",
    familia: "catalogo",
    arma: ({ marca, tienda }) => ({
      estilos: { imagen: { radio: 12 } },
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "Llegaron cosas nuevas",
          subtitulo: `Lo último que sumamos a ${marca}.`,
          bg: "",
          ...cta("Ver las novedades", tienda),
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es lo que entró desde la última vez que te escribimos.", align: "left" },
        // `recientes`, no `destacados`: es la fuente que hace que esta misma
        // plantilla sirva todos los meses sin que nadie la abra.
        { tipo: "productos-dinamicos", fuente: "recientes", n: 4, movil: 2 },
        ...botonSi("Ver todo lo nuevo", tienda, "center"),
        aire(8),
        banda("¿Buscabas algo puntual?", "Escribinos y te decimos si lo tenemos o cuándo entra."),
        redes,
      ],
    }),
  },
  {
    id: "grilla",
    nombre: "Grilla de productos",
    descripcion: "Seis productos y poco texto. Para mandar catálogo sin escribir nada.",
    familia: "catalogo",
    arma: ({ tienda }) => ({
      estilos: { imagen: { radio: 12 }, boton: { radio: 24 } },
      bloques: [
        { tipo: "titulo", texto: "Elegidos para vos", align: "center" },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, mirá lo que tenemos disponible ahora.", align: "center" },
        // Seis: tres filas de a dos. La grilla apila de a pares, así que un
        // número impar deja un hueco en la última fila.
        { tipo: "productos-dinamicos", fuente: "destacados", n: 6, movil: 2 },
        ...botonSi("Ver la tienda completa", tienda, "center"),
        redes,
      ],
    }),
  },
];
