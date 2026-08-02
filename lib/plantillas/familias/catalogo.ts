// Familia "Catálogo": mostrar lo que la tienda vende.
//
// Las tres se llenan solas con `productos-dinamicos`, que es lo que hace que se
// vean completas el primer día —sin que nadie suba una foto— y distintas cada
// vez que se mandan.

import { type DefPreset, banda, botonSi, cta, fila, menuTienda, redes, aire } from "../comun";

export const CATALOGO: readonly DefPreset[] = [
  {
    id: "tienda",
    nombre: "Tu tienda entera",
    descripcion: "Menú arriba, grilla de tres, un destacado y la banda de beneficios. El mail que manda casi todo ecommerce.",
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
    descripcion: "Una fila de fotos con el nombre de cada rubro y la grilla abajo. Para tiendas con mucho surtido.",
    familia: "catalogo",
    // R-004, R-007, R-018 y R-021: la fila de categorías con la etiqueta
    // debajo de la foto. Es lo que abrió el bloque `columnas` a 3 y 4 celdas.
    arma: ({ marca, tienda }) => ({
      estilos: { imagen: { radio: 12 }, boton: { radio: 24 } },
      bloques: [
        ...menuTienda(tienda),
        { tipo: "titulo", texto: "¿Qué estás buscando?", align: "center" },
        { tipo: "texto", texto: `Hola \${contacto.nombre}, entrá directo al rubro que te interesa de ${marca}.`, align: "center" },
        // Las cuatro celdas nacen SIN foto: el renderer no dibuja una celda de
        // imagen vacía, así que la plantilla no muestra un hueco ni un ícono
        // roto. La etiqueta es el campo `titulo`, que en una celda de imagen se
        // dibuja debajo de la foto.
        {
          tipo: "columnas",
          celdas: ["Novedades", "Más vendidos", "Ofertas", "Todo el catálogo"].map((titulo) => ({
            imagen: "",
            url: tienda,
            titulo,
          })),
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
