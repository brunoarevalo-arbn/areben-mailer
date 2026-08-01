// Familia "Venta": el mail que existe para que alguien compre hoy.
//
// El color de urgencia sale del **cupón**, no de un hex clavado en el hero: el
// bloque `cupon` ya usa `pal.cuponFondo` y `pal.acento`, así que la banda ámbar
// se repinta sola con el tema de cada marca.

import { type DefPreset, banda, cta, redes } from "../comun";

export const VENTA: readonly DefPreset[] = [
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
