import type { Bloque } from "@/lib/email/render";
import type { Tema } from "@/lib/email/tema";

// Plantillas prearmadas que vienen con la app (compartidas por todas las marcas).
// Aprovechan los bloques ricos (hero, sección con fondo, cupón). Son esqueletos:
// copy de ejemplo + merge tags; las imágenes/links los completa el usuario.
export interface Preset {
  id: string;
  nombre: string;
  descripcion: string;
  bloques: Bloque[];
  /** Aspecto propio. Sin esto, la plantilla usa el de la marca. */
  tema?: Tema;
}

const redes: Bloque = {
  tipo: "redes",
  links: [
    { red: "Instagram", url: "" },
    { red: "Facebook", url: "" },
    { red: "WhatsApp", url: "" },
  ],
};

export const PRESETS: Preset[] = [
  {
    id: "carrito-oscuro",
    nombre: "Carrito abandonado (oscuro)",
    descripcion: "Fondo negro, CTA azul y el carrito real de la persona. Para recuperar compras.",
    // Adaptación de una plantilla de Really Good Emails que trajo Bruno.
    //
    // ⛔ De la original NO queda nada suyo: ni las imágenes (apuntaban a su CDN,
    // `d1oco4z2z1fhwp.cloudfront.net`, que puede desaparecer cuando quieran) ni
    // el pie "Designed with RGE Studio". Lo que se tomó es la estructura.
    //
    // Lo que no se pudo reproducir y conviene saber: la barra de navegación y la
    // tira de 4 íconos del pie no tienen bloque equivalente todavía.
    tema: { base: "oscuro", acento: "#2d9ff7", ancho: 700 },
    bloques: [
      { tipo: "espaciador", alto: 20 },
      {
        tipo: "hero",
        imagen: "",
        titulo: "¿Todavía lo estás pensando?",
        subtitulo: "Te distrajiste, nos pasa a todos. Terminá la compra que dejaste empezada.",
        botonTexto: "",
        botonUrl: "",
        bg: "#161616",
      },
      { tipo: "espaciador", alto: 32 },
      { tipo: "titulo", texto: "Tu carrito", align: "center" },
      // Se llena solo con lo que la persona dejó. Va ACÁ y no al final: después
      // del botón, "esto dejaste" quedaría hablando de nada.
      { tipo: "carrito", items: [] },
      { tipo: "espaciador", alto: 28 },
      // ${cart.url} lo resuelve el procesador con el link real del checkout.
      { tipo: "boton", texto: "Volver a mi carrito", url: "${cart.url}", align: "center", full: false },
      { tipo: "espaciador", alto: 32 },
      {
        tipo: "seccion",
        bg: "#e6e6e6",
        titulo: "¿Dudas o necesitás ayuda?",
        texto: "Escribinos y te respondemos. Estamos para darte una mano con tu compra.",
        botonTexto: "",
        botonUrl: "",
      },
      { tipo: "espaciador", alto: 24 },
      redes,
    ],
  },
  {
    id: "newsletter",
    nombre: "Newsletter",
    descripcion: "Portada, nota destacada y CTA. La clásica de contenido, con secciones.",
    bloques: [
      { tipo: "hero", imagen: "", titulo: "Lo nuevo de este mes", subtitulo: "Novedades, tips y lo que se viene", botonTexto: "", botonUrl: "", bg: "#faf7f0" },
      { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es lo que preparamos para vos 👇", align: "left" },
      { tipo: "imagen", url: "", alt: "Imagen destacada" },
      { tipo: "titulo", texto: "Título de la nota", align: "left" },
      { tipo: "texto", texto: "Contá algo acá: una nota, un detrás de escena o lo que quieras resaltar.", align: "left" },
      { tipo: "boton", texto: "Leer la nota", url: "", align: "left", full: false },
      { tipo: "divisor" },
      { tipo: "seccion", bg: "#f0f9ff", titulo: "¿Todavía no nos seguís?", texto: "Sumate a nuestras redes para no perderte ninguna novedad.", botonTexto: "", botonUrl: "" },
      redes,
    ],
  },
  {
    id: "promo",
    nombre: "Promo / Descuento",
    descripcion: "Hero de oferta, cupón destacado y grilla de productos. Para vender.",
    bloques: [
      { tipo: "hero", imagen: "", titulo: "🔥 20% OFF en toda la tienda", subtitulo: "Solo por esta semana", botonTexto: "Comprar ahora", botonUrl: "", bg: "#fff7ed" },
      { tipo: "texto", texto: "Hola ${contacto.nombre}, aprovechá el descuento en toda la tienda antes de que termine.", align: "center" },
      { tipo: "cupon", texto: "Usá este código en el checkout", codigo: "PROMO20", botonTexto: "Ir a la tienda", botonUrl: "" },
      { tipo: "titulo", texto: "Lo más buscado", align: "center" },
      { tipo: "productos", items: [] },
      { tipo: "seccion", bg: "#faf7f0", titulo: "Envíos a todo el país", texto: "Comprá desde donde estés. Seguimiento del pedido incluido.", botonTexto: "", botonUrl: "" },
      redes,
    ],
  },
  {
    id: "lanzamiento",
    nombre: "Lanzamiento de producto",
    descripcion: "Hero con imagen, presentación y colección de productos.",
    bloques: [
      { tipo: "hero", imagen: "", titulo: "Ya llegó lo nuevo 🎉", subtitulo: "Presentamos nuestro último lanzamiento", botonTexto: "Ver más", botonUrl: "", bg: "#ffffff" },
      { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es lo que estabas esperando. Mirá los detalles:", align: "left" },
      { tipo: "imagen", url: "", alt: "Foto del producto" },
      { tipo: "titulo", texto: "Conocé la colección", align: "center" },
      { tipo: "productos", items: [] },
      { tipo: "boton", texto: "Ver toda la colección", url: "", align: "center", full: false },
      redes,
    ],
  },
  {
    id: "bienvenida",
    nombre: "Bienvenida",
    descripcion: "Hero de bienvenida + cupón de regalo. Para el primer contacto.",
    bloques: [
      { tipo: "hero", imagen: "", titulo: "¡Bienvenida/o! 👋", subtitulo: "Gracias por sumarte", botonTexto: "Conocé la tienda", botonUrl: "", bg: "#f0fdf4" },
      { tipo: "texto", texto: "Hola ${contacto.nombre}, qué bueno tenerte. Te vamos a avisar de novedades, lanzamientos y promos exclusivas.", align: "left" },
      { tipo: "seccion", bg: "#faf7f0", titulo: "Un regalo para empezar", texto: "Usá el código de abajo en tu primera compra.", botonTexto: "", botonUrl: "" },
      { tipo: "cupon", texto: "10% en tu primera compra", codigo: "BIENVENIDA10", botonTexto: "Comprar", botonUrl: "" },
      redes,
    ],
  },
];

export const getPreset = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id);
