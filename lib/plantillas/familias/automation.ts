// Los presets de automation: el contenido inicial de un mail que dispara un
// evento de la tienda.
//
// Salen de la misma lista que los de campaña —mismo tipo `DefPreset`, misma
// resolución contra la tienda— y se distinguen solo por tener `trigger`. Hasta
// F6 eran otro tipo en otro archivo, y solo estos se resolvían contra la tienda:
// por eso las plantillas de la galería tenían **todos los botones vacíos**.
//
// ⛔ No llevan `familia`: `presetsGaleria()` es "todos los que no tienen
// trigger", y estos se crean desde /automations con su disparador.

import { type DefPreset, botonSi, cta } from "../comun";

export const AUTOMATION: readonly DefPreset[] = [
  {
    id: "auto-bienvenida",
    nombre: "Bienvenida",
    descripcion: "Sale sola cuando alguien se registra en la tienda.",
    trigger: "NUEVO_CLIENTE",
    esperaHoras: 0,
    arma: ({ marca, tienda }) => ({
      asunto: `¡Bienvenido/a a ${marca}! 🎉`,
      bloques: [
        { tipo: "titulo", texto: "¡Hola ${contacto.nombre}! 👋" },
        { tipo: "texto", texto: "Gracias por sumarte. Descubrí nuestros productos y encontrá lo que buscás." },
        ...botonSi("Ver la tienda", tienda),
      ],
    }),
  },
  {
    id: "auto-suscriptor",
    nombre: "Bienvenida a la lista",
    descripcion: "Sale sola cuando alguien se anota en un pop-up o formulario, con el cupón que ganó.",
    trigger: "NUEVO_SUSCRIPTOR",
    esperaHoras: 0,
    arma: ({ marca, tienda }) => ({
      asunto: `¡Gracias por sumarte a ${marca}! 🎉`,
      bloques: [
        // 🔴 SIN `${contacto.nombre}`, y no es un olvido. El pop-up SIMPLE pide
        // solo el mail, así que el 100% de los leads de Zattia no tiene nombre y
        // el merge tag se reemplaza por string vacío (`lib/email/render.ts`):
        // les llegaría "¡Hola ! 👋". El saludo de este trigger tiene que
        // funcionar vacío — es la diferencia de público con `NUEVO_CLIENTE`,
        // donde el que se registra en la tienda sí dejó su nombre.
        { tipo: "titulo", texto: "¡Gracias por sumarte! 👋" },
        { tipo: "texto", texto: "Ya estás en la lista: vas a ser de los primeros en enterarte de las novedades y las promos." },
        // El bloque `cupon` acá es SEGURO, y esa es media razón de que el
        // trigger exista. Un run de `NUEVO_SUSCRIPTOR` siempre viene de una
        // captura nuestra ⇒ `aplicarCuponDelTrigger` o pisa el código con el
        // real de Tiendanube, o **elimina el bloque entero**. El texto de abajo
        // no llega nunca a una casilla tal cual está.
        // (En `NUEVO_CLIENTE` no se puede: ese trigger también dispara con el
        // webhook `customer/created`, donde el bloque queda intacto y saldría un
        // código que no existe en TN.)
        { tipo: "cupon", texto: "Tu cupón de bienvenida", codigo: "TUCUPON", ...cta("Usar el cupón", tienda) },
        ...botonSi("Ver la tienda", tienda),
      ],
    }),
  },
  {
    id: "auto-compra",
    nombre: "Gracias por tu compra",
    descripcion: "Sale sola una hora después de que se paga un pedido.",
    trigger: "COMPRA",
    esperaHoras: 1,
    arma: () => ({
      asunto: "¡Gracias por tu compra! 🛍️",
      bloques: [
        { tipo: "titulo", texto: "¡Gracias ${contacto.nombre}!" },
        { tipo: "texto", texto: "Ya estamos preparando tu pedido. Cualquier duda, escribinos." },
      ],
    }),
  },
  {
    id: "auto-carrito",
    nombre: "Carrito abandonado",
    descripcion: "Sale sola a las 3 horas de un carrito que quedó sin pagar.",
    trigger: "CARRITO_ABANDONADO",
    esperaHoras: 3,
    arma: () => ({
      asunto: "¿Te olvidaste de algo? 🛒",
      bloques: [
        { tipo: "titulo", texto: "Todavía estás a tiempo, ${contacto.nombre}" },
        { tipo: "texto", texto: "Dejaste esto en tu carrito. Completá tu compra antes de que se agote." },
        // El carrito real va ACÁ, entre el texto que lo anuncia y el botón. Sin
        // este bloque el procesador lo appendearía al final, después del botón:
        // "dejaste esto" seguido de nada, y los productos abajo del CTA.
        { tipo: "carrito", items: [] },
        // ${cart.url} lo reemplaza el procesador con el link real del checkout.
        { tipo: "boton", texto: "Completar mi compra", url: "${cart.url}" },
      ],
    }),
  },
];
