import type { Bloque } from "@/lib/email/render";

// Plantillas prearmadas que vienen con la app (compartidas por todas las marcas).
// Son esqueletos: copy de ejemplo + merge tags; las imágenes/links los completa el usuario.
export interface Preset {
  id: string;
  nombre: string;
  descripcion: string;
  bloques: Bloque[];
}

const redes: Bloque = {
  tipo: "redes",
  links: [
    { red: "Instagram", url: "" },
    { red: "Facebook", url: "" },
  ],
};

export const PRESETS: Preset[] = [
  {
    id: "newsletter",
    nombre: "Newsletter",
    descripcion: "Novedades del mes: intro, imagen, nota y botón. La clásica de contenido.",
    bloques: [
      { tipo: "titulo", texto: "Lo nuevo de este mes" },
      { tipo: "texto", texto: "Hola ${contacto.nombre}, te compartimos las novedades de esta semana 👇" },
      { tipo: "imagen", url: "", alt: "Imagen destacada" },
      { tipo: "texto", texto: "Contá algo acá: una nota, un detrás de escena o lo que quieras destacar." },
      { tipo: "boton", texto: "Ver más", url: "" },
      { tipo: "divisor" },
      redes,
    ],
  },
  {
    id: "promo",
    nombre: "Promo / Descuento",
    descripcion: "Oferta con CTA fuerte y bloque de productos. Para campañas de venta.",
    bloques: [
      { tipo: "titulo", texto: "🔥 20% OFF por tiempo limitado" },
      { tipo: "texto", texto: "Hola ${contacto.nombre}, aprovechá el descuento en toda la tienda. Solo por esta semana." },
      { tipo: "boton", texto: "Comprar ahora", url: "" },
      { tipo: "productos", items: [] },
      { tipo: "divisor" },
      redes,
    ],
  },
  {
    id: "lanzamiento",
    nombre: "Lanzamiento de producto",
    descripcion: "Imagen hero + presentación + productos. Para anunciar algo nuevo.",
    bloques: [
      { tipo: "imagen", url: "", alt: "Imagen principal del lanzamiento" },
      { tipo: "titulo", texto: "Ya llegó lo nuevo 🎉" },
      { tipo: "texto", texto: "Hola ${contacto.nombre}, presentamos nuestro último lanzamiento. Mirá los detalles." },
      { tipo: "boton", texto: "Ver más", url: "" },
      { tipo: "productos", items: [] },
      redes,
    ],
  },
  {
    id: "bienvenida",
    nombre: "Bienvenida / Anuncio simple",
    descripcion: "Corta y directa: título, texto y botón. Para dar la bienvenida o un aviso puntual.",
    bloques: [
      { tipo: "titulo", texto: "¡Bienvenida/o! 👋" },
      { tipo: "texto", texto: "Hola ${contacto.nombre}, gracias por sumarte. Te vamos a avisar de novedades, lanzamientos y promos." },
      { tipo: "boton", texto: "Conocé la tienda", url: "" },
    ],
  },
];

export const getPreset = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id);
