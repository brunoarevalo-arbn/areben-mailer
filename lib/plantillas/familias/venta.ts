// Familia "Venta": el mail que existe para que alguien compre hoy.
//
// El color de urgencia sale del **cupón**, no de un hex clavado en el hero: el
// bloque `cupon` ya usa `pal.cuponFondo` y `pal.acento`, así que la banda ámbar
// se repinta sola con el tema de cada marca.
//
// Las cuatro con foto van primero (el orden de la lista es el de la galería), y
// las tres de abajo se quedan: `hot-sale` es la única de toda la galería que no
// lleva **ninguna** foto, y eso es exactamente lo que un comerciante sin sesión
// de fotos necesita el primer día.
//
// Todas tiran de `productos-dinamicos` con fuente `oferta`, que es la que el
// mailer filtra en casa —TN no sabe responder "dame lo rebajado"—.

import {
  type DefPreset, aire, banda, bandaFoto, barra, botonSi, categorias, cta, fila,
  grilla, menuTienda, portada, redes,
} from "../comun";
import { foto } from "../fotos";

export const VENTA: readonly DefPreset[] = [
  {
    id: "brasas",
    nombre: "Oferta sobre fondo oscuro",
    descripcion: "Portada con foto, título enorme y las ofertas. El contraste hace todo el trabajo.",
    familia: "venta",
    // Clon de R-001 ("Hot Deal" hasta 50% OFF): negro de punta a punta, palo
    // seco y el título como un póster.
    //
    // 🟡 **La foto de brasas es del MAIL ENTERO** —no de un bloque— y eso no es
    // expresable: el fondo de página es un color del tema. Queda en la portada,
    // y por eso va una **textura** oscura y no un producto: lo que la referencia
    // pone atrás del título es materia, no una cosa que se vende.
    arma: ({ marca, tienda }) => ({
      // Medido con `paleta-referencia.ts`: el #181818 es el **62,5%** de los
      // píxeles de la captura y el naranja de las brasas suma 5,7% repartido en
      // ocho tonos, de los cuales #f89800 es el más frecuente.
      //
      // 🔑 **`fondo` y `fondoContenido` van IGUALES.** La referencia no tiene
      // tarjeta: el mail es una sola pieza oscura de borde a borde. Con dos
      // oscuros distintos —que es lo que pasaba con el tema `oscuro` a secas—
      // se ve el recuadro de la tarjeta recortado contra el fondo de página, y
      // eso solo lo tiene nuestro render.
      tema: { base: "oscuro", fondo: "#181818", fondoContenido: "#181818", acento: "#f89800", link: "#f89800", ancho: 600, fuente: "sistema" },
      estilos: {
        titulo: { mayusculas: true },
        // 🔑 **El botón *outline* sí es expresable**, al revés de lo que decía
        // esta nota hasta el 2-ago: el borde entra por `bordeAncho` (lo estrenó
        // `joyeria`) y desde hoy el `<v:roundrect>` lo dibuja también en
        // Outlook. El `fondo` es el mismo negro de atrás, que es cómo se emula
        // "sin relleno": el motor siempre rellena.
        boton: { fondo: "#181818", color: "#ffffff", bordeAncho: 1, bordeColor: "#ffffff", radio: 0, peso: 700 },
        // Las fotos de la grilla van al ras, sin redondeo: en la captura cada
        // producto es un rectángulo blanco pegado al de al lado.
        imagen: { radio: 0 },
      },
      bloques: [
        aire(12),
        // La línea blanca fina de arriba, debajo del logo. El divisor cae a
        // `pal.bordeSuave` (#2a2a2a en oscuro), que acá no se vería.
        { tipo: "divisor", estilo: { caja: { bordeColor: "#ffffff" } } },
        portada("banda-madera", {
          titulo: "Hot deal",
          // El título es un **póster**: en la captura ocupa el ancho del mail y
          // el "50% OFF" es casi igual de grande. Va en el bloque y no en la
          // capa de documento — con 44px ahí, el nombre de la marca del
          // `encabezado` saldría más grande que el título (la misma trampa
          // anotada en `hot-sale`).
          subtitulo: `— Hasta 50% OFF en toda la tienda de ${marca} —`,
          boton: { texto: "Visitar tienda", url: tienda },
          // ⚠️ El alto se mide contra el CONTENIDO, no contra la captura: con
          // 360 quedaba media banda de madera vacía debajo del botón, que la
          // referencia no tiene —ahí el título llena el alto solo—.
          alto: 300,
          // El velo alto es lo que convierte la textura en un fondo: a 60 la
          // madera se leía como una tabla y competía con el título. La
          // referencia es casi negra, con el naranja como resplandor.
          velo: 72,
          estilo: { titulo: { tamano: 48 }, subtitulo: { tamano: 22, peso: 700 } },
        }),
        // En la captura esta línea es casi un título: es la que empuja a la
        // grilla y está en el mismo cuerpo tipográfico que el resto del mail.
        { tipo: "texto", texto: "Hola ${contacto.nombre}, mirá los productos que tenemos para vos 👇", align: "center", estilo: { cuerpo: { tamano: 20 } } },
        grilla("oferta", { tres: true, boton: "COMPRAR", estilo: { cuerpo: { peso: 700, tamano: 15 } } }),
        ...botonSi("Ver todo lo rebajado", tienda, "center"),
        aire(8),
        { tipo: "divisor", estilo: { caja: { bordeColor: "#ffffff" } } },
        { tipo: "texto", texto: "Los precios vuelven a la normalidad el lunes. Después no digas que no te avisamos.", align: "center" },
        redes,
      ],
    }),
  },
  {
    id: "final-sale",
    nombre: "Liquidación final",
    descripcion: "Últimas unidades, con las razones para comprar arriba y la banda de envíos. Para cerrar temporada.",
    familia: "venta",
    // Clon de R-010 (Autopartes, "Final sale"). 🟡 Su portada es una ILUSTRACIÓN
    // sobre color plano y el pack es de fotos: va una foto de temporada, que es
    // lo que hace un ecommerce de Tiendanube. Y su "ver online / compartir" de
    // arriba de todo es una feature de plataforma, no un bloque — sigue en el
    // backlog con 6 pedidos, que es el que más tiene sin implementar.
    arma: ({ marca, tienda }) => ({
      // El celeste #18a8e8 medido sobre la captura: 9,4% de los píxeles, y son
      // las dos bandas que enmarcan el mail.
      //
      // 🔑 **El celeste va en el `fondo` de PÁGINA**, que es lo que dibuja la
      // banda de arriba con el logo y el menú. 🟡 La referencia cierra con una
      // banda NEGRA y el fondo de página es uno solo, así que ese cierre se hace
      // adentro de la tarjeta con una `barra()` negra — el pie de la baja queda
      // celeste. Es el único lado por el que se puede: el pie no es un bloque.
      tema: { base: "claro", fondo: "#18a8e8", fondoContenido: "#ffffff", acento: "#18a8e8", link: "#18a8e8", ancho: 600, fuente: "sistema" },
      estilos: {
        titulo: { peso: 700 },
        cuerpo: { color: "#4a4a4a" },
        // 🔑 **Los CTA de la referencia son NEGROS y rectangulares**: el celeste
        // es el color del mail, no el de los botones. Con el acento en los
        // botones el mail se leía como otro.
        boton: { fondo: "#111111", color: "#ffffff", radio: 2, peso: 700, tamano: 13, mayusculas: true, espaciado: 0.5 },
        // Foto redonda en las celdas: es el rasgo de la referencia y el rol
        // `imagen` solo emite `radio`, así que 32 —el tope de `RANGOS.radio`— es
        // todo lo redondo que se puede pedir.
        imagen: { radio: 32 },
      },
      bloques: [
        // ✅ El menú va sobre la banda celeste, como en la captura. Es el mismo
        // `#18a8e8` del fondo de página: la banda de arriba con el logo y esta
        // son **una sola** en la referencia, y la tarjeta empieza justo acá.
        //
        // 🔴 **El color va escrito.** Es el único de los seis con banda de
        // contraste MEDIO, y ahí el recálculo automático no sirve: sale un
        // celeste apenas más oscuro sobre el celeste, ilegible. Los links de la
        // captura son casi negros, el mismo `#111111` de los CTA. La lección es
        // del brillo del fondo, no del bloque: sobre negro o sobre rosa el
        // automático acierta, sobre un color de saturación media no.
        ...menuTienda(tienda, { cuerpo: { peso: 700, color: "#111111" }, caja: { fondo: "#18a8e8", padY: 14 } }),
        portada("portada-verano-1", {
          titulo: "Final sale",
          subtitulo: `Últimas unidades de la temporada en ${marca}. Lo que se va, se va.`,
          boton: { texto: "Ver la liquidación", url: tienda },
          // El texto contra el margen izquierdo, como en la captura.
          align: "left",
        }),
        { tipo: "texto", texto: "Hola ${contacto.nombre}, estamos vaciando el depósito: cuando se termina un talle, no vuelve.", align: "left" },
        // La captura titula la fila de categorías ("Best Deal for You"). 🟡 La
        // apoya además sobre un gris claro, que es el mismo `caja.fondo` que el
        // menú no puede: `columnas` tampoco lo dibuja.
        { tipo: "titulo", texto: "Lo mejor que queda", align: "center" },
        categorias(tienda, [
          { clave: "celda-remeras", titulo: "Remeras" },
          { clave: "celda-calzado", titulo: "Calzado" },
          { clave: "celda-bolsos", titulo: "Bolsos" },
        ], { titulo: { align: "center", peso: 700, tamano: 14 } }),
        aire(8),
        // 🔑 **La banda del medio es de COLOR, no una foto con velo**: el
        // celeste es lo que la hace suya. 🟡 La captura le pone además la foto
        // de un auto a la derecha, y una banda de color con foto al costado no
        // existe: el `seccion` es de una columna y el `columnas`, que sí tiene
        // dos, no toma color de fondo. Va la banda sola, que es la mitad que
        // define el mail.
        {
          tipo: "seccion",
          bg: "#18a8e8",
          titulo: "Te llega igual de rápido",
          texto: "Que sea liquidación no cambia el envío: sale el mismo día y con seguimiento.",
          ...cta("Ver más", tienda),
          // El texto contra el margen izquierdo, como en la captura.
          estilo: { caja: { align: "left" } },
        },
        { tipo: "titulo", texto: "Lo que está rebajado", align: "center" },
        grilla("oferta", { tres: true, boton: "Comprar" }),
        ...botonSi("Ver todo", tienda, "center"),
        aire(8),
        // El cierre oscuro de la referencia. El contraste del texto lo calcula
        // el renderer contra este mismo fondo (`e("subtitulo", bg)`), así que
        // sale claro sin clavarle un color.
        barra("Escribinos y te contestamos el mismo día.", "#111111"),
        redes,
      ],
    }),
  },
  {
    id: "tu-estilo",
    nombre: "Un color de punta a punta",
    descripcion: "Un color fuerte como estructura, con dos llamados a la acción iguales. Para una campaña con identidad propia.",
    familia: "venta",
    // Clon de R-012 ("What's your style?"): rojo ladrillo de arriba abajo.
    //
    // 🔑 **Acá el color ES la plantilla** —es la excepción de la regla 4—: lo que
    // la distingue en la galería es que un solo tono manda en todo el mail. Sin
    // el hex sería `promo` con otro copy. El comerciante lo cambia desde el
    // editor con dos clicks.
    arma: ({ marca, tienda }) => ({
      // 🔴 **El rojo estaba mal y estaba en el lugar equivocado.** Era `#b23a2f`
      // elegido a ojo de la ficha ("rojo ladrillo") y el medido sobre la captura
      // es **`#d83028`, el 28,8% de los píxeles** — o sea que en la referencia
      // el rojo no es el acento de los botones: **es el fondo**. Con el rojo
      // solo en `acento` teníamos un mail blanco con botones rojos, que es otra
      // plantilla.
      //
      // 🔑 Va en el `fondo` de PÁGINA: el encabezado y el pie se dibujan afuera
      // de la tarjeta, así que eso da el bloque rojo de arriba con el logo y el
      // de abajo con las redes, que es exactamente la captura.
      tema: { base: "claro", fondo: "#d83028", fondoContenido: "#ffffff", acento: "#d83028", link: "#d83028", ancho: 600, fuente: "sistema" },
      estilos: {
        titulo: { peso: 700 },
        // Los botones de la referencia son **negros y rectos**, nunca rojos: el
        // rojo ya es el fondo y un botón rojo sobre rojo no existiría.
        boton: { fondo: "#1a1a1a", color: "#ffffff", radio: 0, mayusculas: true, peso: 700, tamano: 13, espaciado: 0.5 },
        // Esquinas rectas en todo: la captura pega las fotos al borde de su
        // bloque, sin un solo redondeo.
        imagen: { radio: 0 },
      },
      bloques: [
        portada("portada-moda-1", {
          titulo: "¿Cuál es tu estilo?",
          // Sobre la foto va **solo el título**, grande y contra el margen: en
          // la captura la bajada y el CTA están abajo, en el bloque rojo. Es un
          // solo bloque visual partido en dos.
          subtitulo: "",
          align: "left",
          estilo: { titulo: { tamano: 34 } },
        }),
        // El bloque rojo debajo de la portada, con el texto y el único CTA de
        // arriba. Es lo que hace que el mail arranque en rojo y no en blanco.
        {
          tipo: "seccion",
          bg: "#d83028",
          titulo: "",
          texto: `Hola \${contacto.nombre}, armamos esta selección de ${marca} pensando en que no todos buscan lo mismo. Tres preguntas, una respuesta: la que ya tenemos en la tienda.`,
          ...cta("Comprar ahora", tienda),
        },
        {
          tipo: "columnas",
          variante: "imagen-texto",
          proporcion: 40,
          celdas: [
            { imagen: foto("producto-perfume"), url: tienda, titulo: "" },
            {
              titulo: "El clásico",
              texto: "Contá para quién es este y por qué no falla nunca.",
              imagen: "",
              url: tienda,
              ...cta("Verlo", tienda),
            },
          ],
          // La celda de texto de la referencia va centrada, no a la izquierda.
          estilo: { titulo: { align: "center" }, cuerpo: { align: "center" }, boton: { align: "center" } },
        },
        aire(8),
        bandaFoto(
          "banda-tela",
          "O empezá por lo que está rebajado",
          "Lo mismo, con menos plata. Mientras haya stock.",
          { texto: "Ver ofertas", url: tienda },
          220,
          // El texto de esta banda está contra el margen izquierdo en la captura.
          { caja: { align: "left" } },
        ),
        // La otra forma de grilla permitida: cuatro, dos filas parejas. Sus
        // botones son **blancos con el texto rojo**, al revés de los negros del
        // resto: es el único lugar donde la referencia los invierte.
        grilla("oferta", { boton: "Comprar", estilo: { boton: { fondo: "#ffffff", color: "#d83028", bordeAncho: 1, bordeColor: "#d83028" } } }),
        aire(8),
        // El cierre rojo con su CTA, como el bloque de arriba.
        {
          tipo: "seccion",
          bg: "#d83028",
          titulo: "¿Seguís sin decidirte?",
          texto: "Escribinos y te ayudamos a elegir. Contestamos todos los días.",
          ...cta("Ver la tienda", tienda),
        },
        redes,
      ],
    }),
  },
  {
    id: "mega-oferta",
    nombre: "Cupón y porcentajes",
    descripcion: "El cupón arriba, la fila de descuentos y dos grillas. La más ruidosa de todas: el número manda.",
    familia: "venta",
    // Clon de R-021 (TOLUCA, cámaras): cada bloque tiene un número adelante, y
    // las celdas llevan su propio botón — es una de las tres referencias que lo
    // pidieron.
    //
    // 🟡 La referencia dibuja el **% de descuento como badge SOBRE la foto**: eso
    // es superposición y `position` está prohibido en un mail. Va como fila de
    // celdas de texto abajo, que es la misma información sin el overlay.
    arma: ({ marca, tienda }) => ({
      // Los tres colores medidos: negro #202020 (10,2%) en la banda del logo,
      // azul #0038e8 (2,3%) que aparece **solo en los botones**, y verde lima
      // #80c000 (6,7%), que es el pie entero.
      //
      // 🔑 El negro va en el `fondo` de PÁGINA y da la banda del encabezado.
      // 🟡 El pie verde de la captura no entra por ahí —el fondo de página es
      // uno solo y arriba tiene que ser negro—, así que el cierre verde se hace
      // adentro de la tarjeta con una `barra()`.
      tema: { base: "claro", fondo: "#202020", fondoContenido: "#ffffff", acento: "#0038e8", link: "#0038e8", ancho: 600, fuente: "sistema" },
      estilos: {
        titulo: { peso: 700 },
        cuerpo: { color: "#4a4a4a" },
        // Azul, rectangular y en mayúsculas: aparece diez veces en la captura y
        // siempre igual.
        boton: { radio: 2, color: "#ffffff", mayusculas: true, peso: 700, tamano: 13, espaciado: 0.5 },
        imagen: { radio: 4 },
      },
      bloques: [
        // ⛔ **Este NO lleva `caja.fondo`, y no es un olvido.** R-021 figura en la
        // lista de las seis referencias con "el menú adentro de una banda", pero
        // mirando la captura al lado es la excepción: los links van sobre BLANCO,
        // entre la banda oscura del logo y la portada negra. Ese blanco ya es la
        // tarjeta, así que el bloque sale bien sin tocar nada — ponerle banda lo
        // alejaría de la referencia en vez de acercarlo. Verificado el 3-ago-2026
        // con `mirar-preset`. Las otras cinco (003 · 005 · 010 · 014 · 016) sí la
        // llevan.
        ...menuTienda(tienda),
        portada("portada-deco-1", {
          titulo: "Mega oferta",
          subtitulo: `Los días de descuento más grandes del año en ${marca}.`,
          boton: { texto: "Ver todo", url: tienda },
        }),
        // El cupón va arriba, como en la referencia: el código adentro del
        // banner. ⚠️ El código es de ejemplo y hay que crearlo en el admin de
        // Tiendanube — el mailer no crea cupones.
        //
        // En verde lima, que es como lo dibuja la captura. El ámbar del bloque
        // sale de la paleta y acá sería el cuarto color de un mail que tiene
        // tres.
        {
          tipo: "cupon",
          texto: "Sumale un 10% extra con este código",
          codigo: "MEGA10",
          ...cta("Comprar ahora", tienda),
          estilo: { caja: { bordeColor: "#80c000", fondo: "#f4fbe8" }, titulo: { color: "#3f6000" } },
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es todo lo que bajamos de precio esta semana.", align: "center" },
        categorias(tienda, [
          { clave: "celda-regalos", titulo: "Regalos", boton: "Ver" },
          // ⚠️ Acá iba `celda-hogar` y se cambió: ver el aviso de esa clave en
          // `fotos.ts`. La foto que sirve tiene un título de libro legible.
          { clave: "celda-plantas", titulo: "Hogar", boton: "Ver" },
        ], { titulo: { align: "center", peso: 700, tamano: 14 } }),
        // La captura separa cada rubro con una línea verde fina, no gris.
        { tipo: "divisor", estilo: { caja: { bordeColor: "#80c000" } } },
        // La fila de badges de descuento: son cuatro números y nada más. Con
        // `textos` no pide una sola foto. El número va en el verde de la
        // captura, que es donde vive el porcentaje en las cuatro pastillas.
        fila([
          { titulo: "20% OFF", texto: "En toda la tienda." },
          { titulo: "30% OFF", texto: "En lo de temporada pasada." },
          { titulo: "50% OFF", texto: "En las últimas unidades." },
          { titulo: "Envío gratis", texto: "A partir de tu monto mínimo." },
        ], "center", { titulo: { color: "#3f6000", tamano: 20 } }),
        { tipo: "titulo", texto: "Lo más rebajado", align: "center" },
        grilla("oferta", { tres: true, boton: "Comprar" }),
        ...(tienda ? [{ tipo: "boton" as const, texto: "Ver todas las ofertas", url: tienda, align: "center" as const }] : []),
        aire(8),
        // La banda de beneficios de la captura lleva ícono en las tres celdas
        // (camión, tarjeta, cambios), que es el catálogo cerrado de
        // `lib/email/iconos.ts` desde el 2-ago.
        fila([
          { titulo: "Compra protegida", texto: "Con garantía y factura.", icono: "seguro" },
          { titulo: "Hasta 12 cuotas", texto: "Con todas las tarjetas.", icono: "tarjeta" },
          { titulo: "Cambios sin cargo", texto: "Tenés 30 días.", icono: "cambios" },
        ]),
        aire(8),
        // El cierre verde lima. Ver la nota del tema: el pie de la baja queda
        // sobre el negro del fondo de página.
        barra("Envío gratis a partir de tu monto mínimo · Cambios sin cargo dentro de los 30 días.", "#80c000"),
        redes,
      ],
    }),
  },
  {
    id: "hot-sale",
    nombre: "Hot Sale / Cyber Monday",
    descripcion: "Título enorme, cupón y las ofertas. La única de toda la galería sin una sola foto: se manda hoy mismo, sin sesión de fotos.",
    familia: "venta",
    // R-001, R-013, R-015, R-016 y R-021. La 013 es la referencia madre: es la
    // ÚNICA de las 21 que no lleva una sola foto de stock, y por eso es la que
    // un comerciante puede mandar hoy sin sesión de fotos.
    arma: ({ marca, tienda }) => ({
      // ⚠️ El tamaño del título grande va en el BLOQUE, no en la capa de
      // documento: `estilos.titulo` alcanza al rol `titulo` de todos los
      // bloques, y el `encabezado` es uno de ellos — con 40px ahí, el nombre de
      // la marca salía más grande que el "HOT SALE". En la capa de documento
      // queda lo que sí es del mail entero: el botón pastilla.
      estilos: { boton: { radio: 24 } },
      bloques: [
        aire(12),
        // La volanta: un título chico arriba del grande. Es el "YA LLEGA" de la
        // referencia 013 — se hace con el bloque que ya existe, no hace falta
        // un campo nuevo.
        { tipo: "titulo", texto: "YA LLEGA", align: "center", estilo: { titulo: { tamano: 14, peso: 700 } } },
        {
          tipo: "hero",
          imagen: "",
          titulo: "HOT SALE",
          subtitulo: `Hasta 50% OFF en toda la tienda de ${marca}.`,
          bg: "",
          estilo: { titulo: { tamano: 40, peso: 700 } },
          ...cta("Ver las ofertas", tienda),
        },
        { tipo: "cupon", texto: "Sumale un 10% con este código", codigo: "HOTSALE10", ...cta("Comprar ahora", tienda) },
        { tipo: "titulo", texto: "Lo que está rebajado", align: "center" },
        { tipo: "productos-dinamicos", fuente: "oferta", n: 6, movil: 2, porFila: 3 },
        ...botonSi("Ver todas las ofertas", tienda, "center"),
        aire(8),
        { tipo: "texto", texto: "Son tres días. Después vuelven los precios de siempre.", align: "center" },
        { tipo: "divisor" },
        redes,
      ],
    }),
  },
  {
    id: "beneficios",
    nombre: "Por qué comprarnos",
    descripcion: "La banda de beneficios en grande, con las ofertas debajo. Se llena sola con tu catálogo, sin fotos de stock.",
    familia: "venta",
    // R-002, R-006, R-008, R-010, R-018 y R-021: la fila de tres con ícono es
    // el bloque más repetido de la tanda después del menú y las redes.
    arma: ({ marca, tienda }) => ({
      estilos: { imagen: { radio: 12 } },
      bloques: [
        ...menuTienda(tienda),
        {
          tipo: "hero",
          imagen: "",
          titulo: "Comprar tranquilo también cuenta",
          subtitulo: `Así trabajamos en ${marca}.`,
          bg: "",
          ...cta("Ver la tienda", tienda),
        },
        fila([
          { titulo: "Envío gratis", texto: "En compras superiores al mínimo que definas." },
          { titulo: "Hasta 12 cuotas", texto: "Con todas las tarjetas." },
          { titulo: "Cambios sin cargo", texto: "Primera devolución gratis." },
        ]),
        aire(8),
        banda("¿Lo pensás hace rato?", "Estos son los que están rebajados ahora mismo."),
        { tipo: "productos-dinamicos", fuente: "oferta", n: 6, movil: 2, porFila: 3 },
        ...botonSi("Ver todo", tienda, "center"),
        redes,
      ],
    }),
  },
  {
    id: "promo",
    nombre: "Promo / Descuento",
    descripcion: "Hero de oferta, cupón destacado y lo que está rebajado hoy. Para vender.",
    familia: "venta",
    arma: ({ tienda }) => ({
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "🔥 20% OFF en toda la tienda",
          subtitulo: "Solo por esta semana",
          // Antes "#fff7ed", un crema clavado que decía "oferta" solo en una
          // marca de tema claro. El color de urgencia lo pone el `cupon` de
          // abajo, que sale de la paleta.
          bg: "",
          ...cta("Comprar ahora", tienda),
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, aprovechá el descuento en toda la tienda antes de que termine.", align: "center" },
        { tipo: "cupon", texto: "Usá este código en el checkout", codigo: "PROMO20", ...cta("Ir a la tienda", tienda) },
        { tipo: "titulo", texto: "Lo que está en oferta", align: "center" },
        // La fuente `oferta` la filtra el mailer, no TN: la API no sabe
        // responder "dame lo rebajado".
        { tipo: "productos-dinamicos", fuente: "oferta", n: 4, movil: 2 },
        banda("Envíos a todo el país", "Comprá desde donde estés. Seguimiento del pedido incluido."),
        redes,
      ],
    }),
  },
];
