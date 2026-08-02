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
  type DefPreset, aire, banda, bandaFoto, botonSi, categorias, cta, fila,
  menuTienda, portada, redes,
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
    // 🟡 **Dos aproximaciones anotadas.** La referencia lleva la foto de brasas
    // de fondo del MAIL ENTERO —no de un bloque—, que no es expresable: el fondo
    // de página es un color del tema. Queda en la portada. Y su botón es
    // *outline*: el rol `boton` no emite borde, y el truco de
    // `fondo:"$tarjeta" + color:"$acento"` que sirve en un tema claro acá daría
    // un botón #161616 sobre un velo #111111, o sea invisible. Va sólido.
    arma: ({ marca, tienda }) => ({
      tema: { base: "oscuro" },
      estilos: { titulo: { mayusculas: true } },
      bloques: [
        aire(12),
        portada("portada-gastro-1", {
          titulo: "Hot deal",
          subtitulo: `Hasta 50% OFF en toda la tienda de ${marca}. Tres días y se termina.`,
          boton: { texto: "Ver las ofertas", url: tienda },
          alto: 320,
        }),
        { tipo: "texto", texto: "Hola ${contacto.nombre}, mirá los productos 👇", align: "center" },
        { tipo: "productos-dinamicos", fuente: "oferta", n: 6, movil: 2, porFila: 3 },
        ...botonSi("Ver todo lo rebajado", tienda, "center"),
        aire(8),
        { tipo: "divisor" },
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
      // Foto redonda en las celdas: es el rasgo de la referencia y el rol
      // `imagen` solo emite `radio`, así que 32 —el tope de `RANGOS.radio`— es
      // todo lo redondo que se puede pedir.
      estilos: { imagen: { radio: 32 } },
      bloques: [
        ...menuTienda(tienda),
        portada("portada-verano-1", {
          titulo: "Final sale",
          subtitulo: `Últimas unidades de la temporada en ${marca}. Lo que se va, se va.`,
          boton: { texto: "Ver la liquidación", url: tienda },
        }),
        { tipo: "texto", texto: "Hola ${contacto.nombre}, estamos vaciando el depósito: cuando se termina un talle, no vuelve.", align: "left" },
        categorias(tienda, [
          { clave: "celda-remeras", titulo: "Remeras" },
          { clave: "celda-calzado", titulo: "Calzado" },
          { clave: "celda-bolsos", titulo: "Bolsos" },
        ]),
        aire(8),
        bandaFoto(
          "banda-envios",
          "Te llega igual de rápido",
          "Que sea liquidación no cambia el envío: sale el mismo día y con seguimiento.",
        ),
        { tipo: "titulo", texto: "Lo que está rebajado", align: "center" },
        { tipo: "productos-dinamicos", fuente: "oferta", n: 6, movil: 2, porFila: 3 },
        ...botonSi("Ver todo", tienda, "center"),
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
    // el hex sería `promo` con otro copy. #b23a2f es el ladrillo de la
    // referencia; el comerciante lo cambia desde el editor con dos clicks.
    arma: ({ marca, tienda }) => ({
      tema: { acento: "#b23a2f", link: "#b23a2f" },
      estilos: { boton: { radio: 4 }, imagen: { radio: 12 } },
      bloques: [
        portada("portada-moda-1", {
          titulo: "¿Cuál es tu estilo?",
          subtitulo: "Tres preguntas, una respuesta: la que ya tenemos en la tienda.",
          boton: { texto: "Descubrilo", url: tienda },
        }),
        { tipo: "texto", texto: `Hola \${contacto.nombre}, armamos esta selección de ${marca} pensando en que no todos buscan lo mismo.`, align: "center" },
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
        },
        aire(8),
        bandaFoto(
          "banda-tela",
          "O empezá por lo que está rebajado",
          "Lo mismo, con menos plata. Mientras haya stock.",
          { texto: "Ver ofertas", url: tienda },
        ),
        // La otra forma de grilla permitida: cuatro, dos filas parejas.
        { tipo: "productos-dinamicos", fuente: "oferta", n: 4, movil: 2 },
        aire(8),
        banda("¿Seguís sin decidirte?", "Escribinos y te ayudamos a elegir. Contestamos todos los días."),
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
      estilos: { boton: { radio: 4 }, imagen: { radio: 12 } },
      bloques: [
        ...menuTienda(tienda),
        portada("portada-deco-1", {
          titulo: "Mega oferta",
          subtitulo: `Los días de descuento más grandes del año en ${marca}.`,
          boton: { texto: "Ver todo", url: tienda },
        }),
        // El cupón va arriba, como en la referencia: el código adentro del
        // banner. ⚠️ El código es de ejemplo y hay que crearlo en el admin de
        // Tiendanube — el mailer no crea cupones.
        { tipo: "cupon", texto: "Sumale un 10% extra con este código", codigo: "MEGA10", ...cta("Comprar ahora", tienda) },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es todo lo que bajamos de precio esta semana.", align: "center" },
        categorias(tienda, [
          { clave: "celda-regalos", titulo: "Regalos", boton: "Ver" },
          // ⚠️ Acá iba `celda-hogar` y se cambió: ver el aviso de esa clave en
          // `fotos.ts`. La foto que sirve tiene un título de libro legible.
          { clave: "celda-plantas", titulo: "Hogar", boton: "Ver" },
        ]),
        { tipo: "divisor" },
        // La fila de badges de descuento: son cuatro números y nada más. Con
        // `textos` no pide una sola foto.
        fila([
          { titulo: "20% OFF", texto: "En toda la tienda." },
          { titulo: "30% OFF", texto: "En lo de temporada pasada." },
          { titulo: "50% OFF", texto: "En las últimas unidades." },
          { titulo: "Envío gratis", texto: "A partir de tu monto mínimo." },
        ]),
        { tipo: "titulo", texto: "Lo más rebajado", align: "center" },
        { tipo: "productos-dinamicos", fuente: "oferta", n: 6, movil: 2, porFila: 3 },
        ...(tienda ? [{ tipo: "boton" as const, texto: "Ver todas las ofertas", url: tienda, align: "center" as const, full: true }] : []),
        aire(8),
        fila([
          { titulo: "Compra protegida", texto: "Con garantía y factura." },
          { titulo: "Hasta 12 cuotas", texto: "Con todas las tarjetas." },
          { titulo: "Cambios sin cargo", texto: "Tenés 30 días." },
        ]),
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
