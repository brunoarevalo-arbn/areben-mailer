// Familia "Producto": un lanzamiento, un restock, algo que merece su propio mail.

import { type DefPreset, banda, botonSi, cta, redes } from "../comun";

export const PRODUCTO: readonly DefPreset[] = [
  {
    id: "lanzamiento",
    nombre: "Lanzamiento de producto",
    descripcion: "Presentación, el pitch de por qué es distinto y la colección recién cargada.",
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
