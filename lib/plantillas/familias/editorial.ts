// Familia "Editorial": los mails donde el texto es el producto.
//
// Son los únicos que no llevan grilla de productos de entrada. El rasgo lo pone
// la **capa `estilos` de documento** —serifa, cuerpo grande, renglones sueltos—,
// que es exactamente para lo que existe: un mail se ve distinto sin repetir
// quince overrides bloque por bloque.

import { type DefPreset, aire, banda, botonSi, menuTienda, redes, sinBoton } from "../comun";

export const EDITORIAL: readonly DefPreset[] = [
  {
    id: "newsletter",
    nombre: "Newsletter",
    descripcion: "Portada, nota destacada y lo último que cargaste. La clásica de contenido.",
    familia: "editorial",
    arma: ({ tienda }) => ({
      estilos: { imagen: { radio: 12 } },
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "Lo nuevo de este mes",
          subtitulo: "Novedades, tips y lo que se viene",
          bg: "",
          ...sinBoton,
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es lo que preparamos para vos 👇", align: "left" },
        // ⛔ Acá había un `{ tipo: "imagen", url: "" }`. Renderiza el `<img>`
        // igual, así que la miniatura salía con un ícono roto y el mail también
        // si el comerciante no la reemplazaba. La nota se sostiene con el título
        // y el texto; las fotos las pone la grilla del final.
        { tipo: "titulo", texto: "Título de la nota", align: "left" },
        { tipo: "texto", texto: "Contá algo acá: una nota, un detrás de escena o lo que quieras resaltar.", align: "left" },
        ...botonSi("Leer la nota", tienda),
        { tipo: "divisor" },
        { tipo: "titulo", texto: "Lo último que sumamos", align: "left" },
        { tipo: "productos-dinamicos", fuente: "recientes", n: 2, movil: 2 },
        aire(8),
        banda("¿Todavía no nos seguís?", "Sumate a nuestras redes para no perderte ninguna novedad."),
        redes,
      ],
    }),
  },
  {
    id: "editorial",
    nombre: "Editorial",
    descripcion: "Con serifa y mucho aire. Para escribir de verdad, no para vender.",
    familia: "editorial",
    arma: ({ marca, tienda }) => ({
      // Angosto: una columna de texto largo a 700px se lee mal.
      tema: { ancho: 600 },
      // La capa de documento entera al servicio de un rasgo: serifa y renglones
      // sueltos en todo el mail, sin tocar bloque por bloque.
      estilos: {
        titulo: { fuente: "georgia", tamano: 30, interlinea: 1.25 },
        subtitulo: { fuente: "georgia", tamano: 18 },
        cuerpo: { fuente: "georgia", tamano: 17, interlinea: 1.75 },
      },
      bloques: [
        aire(12),
        { tipo: "titulo", texto: "El título de la nota va acá", align: "left" },
        { tipo: "texto", texto: `Por el equipo de ${marca}`, align: "left" },
        { tipo: "divisor" },
        // ⛔ Acá había un `{ tipo: "imagen", url: "" }` — un `<img src="">`, roto.
        // Y esta plantilla es la que menos lo necesita: lo que la hace editorial
        // es la serifa, el cuerpo de 17 y el interlineado de 1,75. Una columna de
        // texto bien seteada ES el diseño.
        { tipo: "texto", texto: "Hola ${contacto.nombre}. Arrancá con el párrafo que engancha: qué pasó, por qué lo estás contando y qué se lleva quien termine de leer.", align: "left" },
        { tipo: "texto", texto: "Seguí desarrollando. En un mail editorial el texto es el producto, así que no lo cortes en dos renglones: si tenés algo para decir, decilo entero.", align: "left" },
        { tipo: "divisor" },
        ...botonSi("Seguir leyendo en la tienda", tienda),
        aire(8),
        redes,
      ],
    }),
  },
  {
    id: "lookbook",
    nombre: "Lookbook",
    descripcion: "Foto grande de borde a borde, un par de fotos al lado y el video. Para mostrar una colección.",
    familia: "editorial",
    // R-003, R-005, R-011 y R-020: la portada fotográfica pegada a los bordes.
    // Es la única plantilla de la galería que PIDE fotos, y va acá a propósito:
    // el resto se tiene que ver llena sin que nadie suba una (regla 3), pero un
    // lookbook sin fotos no es un lookbook — el copy lo dice desde el editor.
    arma: ({ marca, tienda }) => ({
      tema: { ancho: 600 },
      estilos: { titulo: { fuente: "georgia", tamano: 32 }, cuerpo: { fuente: "georgia", tamano: 16 } },
      bloques: [
        ...menuTienda(tienda),
        // A sangre: la foto ocupa la tarjeta de lado a lado. Nace vacía y el
        // renderer no dibuja una `imagen` sin URL, así que la galería no muestra
        // un ícono roto — pero el bloque queda puesto, que es el punto de una
        // plantilla prearmada.
        { tipo: "imagen", url: "", alt: "La foto de portada de la colección", sangre: true },
        aire(16),
        { tipo: "titulo", texto: "El nombre de la colección", align: "center" },
        { tipo: "texto", texto: `Dos renglones sobre de qué se trata: en qué se inspiró, para qué momento es. Después dejá que las fotos hablen.`, align: "center" },
        ...botonSi("Ver la colección", tienda, "center"),
        aire(12),
        // Tres fotos al lado, con su nombre debajo: la fila de `columnas` que
        // antes no se podía armar. Sin foto, la celda no se dibuja.
        {
          tipo: "columnas",
          celdas: ["El look uno", "El look dos", "El look tres"].map((titulo) => ({ imagen: "", url: tienda, titulo })),
        },
        aire(12),
        // El bloque `video` no lo usaba ningún preset y el motor lo tiene desde
        // hace rato. Sin miniatura no se dibuja, igual que la imagen.
        { tipo: "video", imagen: "", url: "" },
        { tipo: "divisor" },
        { tipo: "titulo", texto: "Lo último que entró", align: "left" },
        { tipo: "productos-dinamicos", fuente: "recientes", n: 3, movil: 2, porFila: 3 },
        aire(8),
        banda(`Seguí a ${marca}`, "Las fotos nuevas salen primero en nuestras redes."),
        redes,
      ],
    }),
  },
];
