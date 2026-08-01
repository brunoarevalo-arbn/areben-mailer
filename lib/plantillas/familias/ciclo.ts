// Familia "Ciclo de vida": los mails que dependen de dónde está la persona, no
// de qué se está vendiendo esta semana.
//
// Las cuatro son de campaña (se mandan a mano, a una lista). Sus gemelas
// automáticas —las que dispara un evento de Tiendanube— viven en
// `familias/automation.ts` y se distinguen por tener `trigger`.

import { type DefPreset, aire, banda, botonSi, cta, redes, sinBoton } from "../comun";

export const CICLO: readonly DefPreset[] = [
  {
    id: "bienvenida",
    nombre: "Bienvenida",
    descripcion: "Hero de bienvenida, cupón de regalo y por dónde empezar. Para el primer contacto.",
    familia: "ciclo",
    arma: ({ marca, tienda }) => ({
      estilos: { imagen: { radio: 12 } },
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "¡Bienvenida/o! 👋",
          subtitulo: `Gracias por sumarte a ${marca}`,
          bg: "",
          ...cta("Conocé la tienda", tienda),
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, qué bueno tenerte. Te vamos a avisar de novedades, lanzamientos y promos exclusivas.", align: "left" },
        banda("Un regalo para empezar", "Usá el código de abajo en tu primera compra."),
        { tipo: "cupon", texto: "10% en tu primera compra", codigo: "BIENVENIDA10", ...cta("Comprar", tienda) },
        // Una bienvenida sin nada para mirar es una carta. Los más vendidos le
        // dan las fotos —las de la tienda de verdad— y le dan a la persona por
        // dónde empezar, que es de lo que se trata el mail.
        { tipo: "titulo", texto: "Por acá suele empezar todo el mundo", align: "center" },
        { tipo: "productos-dinamicos", fuente: "destacados", n: 4, movil: 2 },
        ...botonSi("Ver la tienda completa", tienda, "center"),
        redes,
      ],
    }),
  },
  {
    id: "post-compra",
    nombre: "Gracias por tu compra",
    descripcion: "Agradecimiento, qué sigue ahora y una recomendación. Sube la segunda compra.",
    familia: "ciclo",
    arma: ({ tienda }) => ({
      estilos: { imagen: { radio: 12 } },
      bloques: [
        { tipo: "titulo", texto: "¡Gracias por tu compra, ${contacto.nombre}! 🎁", align: "center" },
        { tipo: "texto", texto: "Ya estamos preparando tu pedido. Te avisamos apenas salga y te pasamos el seguimiento.", align: "center" },
        banda("¿Alguna duda?", "Escribinos por donde te quede más cómodo y te respondemos."),
        { tipo: "titulo", texto: "Con esto también combina", align: "center" },
        // Dos y no cuatro: es una recomendación, no un catálogo. Después de una
        // compra, media pantalla de productos suena a que no leímos qué compró.
        { tipo: "productos-dinamicos", fuente: "destacados", n: 2, movil: 2 },
        ...botonSi("Seguir mirando", tienda, "center"),
        redes,
      ],
    }),
  },
  {
    id: "reactivacion",
    nombre: "Te extrañamos",
    descripcion: "Para quien no compra hace rato: un cupón y lo que se perdió mientras tanto.",
    familia: "ciclo",
    arma: ({ marca, tienda }) => ({
      estilos: { cuerpo: { tamano: 17 }, imagen: { radio: 12 } },
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "Hace rato que no te vemos 👀",
          subtitulo: `Pasaron cosas en ${marca} desde tu última visita.`,
          bg: "",
          ...cta("Ver qué hay de nuevo", tienda),
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, te dejamos un descuento para volver a empezar.", align: "center" },
        { tipo: "cupon", texto: "15% en tu próxima compra", codigo: "VOLVE15", ...cta("Usar el cupón", tienda) },
        { tipo: "titulo", texto: "Esto entró mientras no estabas", align: "center" },
        { tipo: "productos-dinamicos", fuente: "recientes", n: 4, movil: 2 },
        redes,
      ],
    }),
  },
  {
    id: "carrito-oscuro",
    nombre: "Carrito abandonado (oscuro)",
    descripcion: "Fondo negro, CTA azul y el carrito real de la persona. Para recuperar compras.",
    familia: "ciclo",
    // Adaptación de una plantilla de Really Good Emails que trajo Bruno.
    //
    // ⛔ De la original NO queda nada suyo: ni las imágenes (apuntaban a su CDN,
    // `d1oco4z2z1fhwp.cloudfront.net`, que puede desaparecer cuando quieran) ni
    // el pie "Designed with RGE Studio". Lo que se tomó es la estructura.
    //
    // Lo que no se pudo reproducir: la barra de navegación y la tira de 4 íconos
    // del pie, que no tienen bloque equivalente todavía (`menu` e `iconos`
    // quedaron fuera de F5).
    arma: () => ({
      // 🔑 Acá el tema oscuro **es** la plantilla, no una preferencia: por eso el
      // preset lo declara entero y los bloques de abajo se apoyan en él.
      tema: { base: "oscuro", acento: "#2d9ff7", ancho: 700 },
      bloques: [
        aire(20),
        {
          tipo: "hero",
          imagen: "",
          titulo: "¿Todavía lo estás pensando?",
          subtitulo: "Te distrajiste, nos pasa a todos. Terminá la compra que dejaste empezada.",
          // Vacío y no "#161616": con el tema oscuro puesto arriba, `pal.tarjeta`
          // ya vale exactamente eso. Clavarlo era repetir el mismo color en dos
          // lugares y que uno de los dos se olvidara si el tema cambia.
          bg: "",
          ...sinBoton,
        },
        aire(32),
        { tipo: "titulo", texto: "Tu carrito", align: "center" },
        // Se llena solo con lo que la persona dejó. Va ACÁ y no al final:
        // después del botón, "esto dejaste" quedaría hablando de nada.
        { tipo: "carrito", items: [] },
        aire(28),
        // ${cart.url} lo resuelve el procesador con el link real del checkout.
        // No pasa por `botonSi`: no depende de que la tienda tenga sitio.
        { tipo: "boton", texto: "Volver a mi carrito", url: "${cart.url}", align: "center", full: false },
        aire(32),
        {
          tipo: "seccion",
          // 🔑 Excepción a la regla 4, igual que la invitación: el gris claro
          // dentro del mail negro **es** el remate del diseño original. Con
          // `bg: ""` sería `#1f1f1f` y la banda desaparecería contra la tarjeta.
          bg: "#e6e6e6",
          titulo: "¿Dudas o necesitás ayuda?",
          texto: "Escribinos y te respondemos. Estamos para darte una mano con tu compra.",
          ...sinBoton,
        },
        aire(24),
        redes,
      ],
    }),
  },
];
