export type Trigger = "NUEVO_CLIENTE" | "COMPRA";

export const PRESETS: Record<Trigger, { nombre: string; esperaHoras: number; asunto: string; bloques: object[] }> = {
  NUEVO_CLIENTE: {
    nombre: "Bienvenida",
    esperaHoras: 0,
    asunto: "¡Bienvenido/a a BDI Accesorios! 🎉",
    bloques: [
      { tipo: "titulo", texto: "¡Hola ${contacto.nombre}! 👋" },
      { tipo: "texto", texto: "Gracias por sumarte. Descubrí nuestros productos y encontrá lo que buscás." },
      { tipo: "boton", texto: "Ver la tienda", url: "https://bdiaccesorios.com.ar" },
    ],
  },
  COMPRA: {
    nombre: "Gracias por tu compra",
    esperaHoras: 1,
    asunto: "¡Gracias por tu compra! 🛍️",
    bloques: [
      { tipo: "titulo", texto: "¡Gracias ${contacto.nombre}!" },
      { tipo: "texto", texto: "Ya estamos preparando tu pedido. Cualquier duda, escribinos." },
    ],
  },
};
