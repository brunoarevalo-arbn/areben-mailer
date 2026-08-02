// Familia "Venta": el mail que existe para que alguien compre hoy.
//
// El color de urgencia sale del **cupón**, no de un hex clavado en el hero: el
// bloque `cupon` ya usa `pal.cuponFondo` y `pal.acento`, así que la banda ámbar
// se repinta sola con el tema de cada marca.

import { type DefPreset, aire, banda, botonSi, cta, fila, menuTienda, redes } from "../comun";

export const VENTA: readonly DefPreset[] = [
  {
    id: "hot-sale",
    nombre: "Hot Sale / Cyber Monday",
    descripcion: "Título enorme, cupón y las ofertas. Sin una sola foto: el color y la tipografía hacen todo.",
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
    descripcion: "La banda de beneficios en grande, con las ofertas debajo. Para el que todavía no te compró.",
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
