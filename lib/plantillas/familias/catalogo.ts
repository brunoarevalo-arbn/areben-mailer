// Familia "Catálogo": mostrar lo que la tienda vende.
//
// Las tres se llenan solas con `productos-dinamicos`, que es lo que hace que se
// vean completas el primer día —sin que nadie suba una foto— y distintas cada
// vez que se mandan.

import { type DefPreset, banda, botonSi, cta, redes, aire } from "../comun";

export const CATALOGO: readonly DefPreset[] = [
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
