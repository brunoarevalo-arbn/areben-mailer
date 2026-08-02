// Familia "Catálogo": mostrar lo que la tienda vende.
//
// Todas se llenan solas con `productos-dinamicos`, que es lo que hace que se
// vean completas el primer día —sin que nadie suba una foto— y distintas cada
// vez que se mandan.
//
// El orden importa: **las que traen foto de stock van primero**, porque el orden
// de esta lista es el orden de la galería y lo primero que ve el comerciante
// tiene que parecerse a lo que fue a buscar. Las cinco de abajo se quedan a
// propósito: son las únicas que se llenan **solo con su catálogo, sin una foto
// ajena**, y eso es un valor distinto y no una versión pobre.
//
// 🔴 **Solo dos formas de grilla en toda la galería**: `{n:6, porFila:3}` y
// `{n:4}`, las dos con `movil:2`. No es estética: `/plantillas` resuelve contra
// Tiendanube una consulta por `claveProductos` (`fuente|categoriaId|n`) de la
// familia activa, así que doce presets inventando su propio `n` convierten una
// pestaña de 2-3 llamadas en una de 10, contra un límite que se comparte con el
// monitor y con Resorty.

import {
  type DefPreset, aire, banda, bandaFoto, barra, botonSi, categorias, cta, fila,
  grilla, menuTienda, portada, redes,
} from "../comun";
import { alt, foto } from "../fotos";

export const CATALOGO: readonly DefPreset[] = [
  {
    id: "marroquineria",
    nombre: "La tienda completa, con foto",
    descripcion: "Portada con foto, los más elegidos, las categorías y la banda de quiénes somos. La anatomía más completa de todas.",
    familia: "catalogo",
    // Clon de R-002 (Morelia, marroquinería): es la referencia más completa de la
    // primera tanda. Serifa en los títulos y mucho aire, que es lo que la hace
    // verse cara sin un solo color clavado.
    arma: ({ marca, tienda }) => ({
      estilos: { titulo: { fuente: "georgia" }, imagen: { radio: 12 } },
      bloques: [
        ...menuTienda(tienda),
        portada("portada-cuero-1", {
          titulo: "Hecho para durar",
          subtitulo: `Lo que mejor trabajamos en ${marca}, en un solo lugar.`,
          boton: { texto: "Ver la colección", url: tienda },
        }),
        { tipo: "titulo", texto: "Los más elegidos", align: "center" },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es lo que más nos están pidiendo este mes.", align: "center" },
        grilla("destacados", { tres: true, boton: "Comprar" }),
        ...botonSi("Ver todo el catálogo", tienda, "center"),
        aire(8),
        { tipo: "titulo", texto: "Por categoría", align: "left" },
        // ⚠️ La referencia pone CINCO categorías. Cuatro es el tope del bloque, y
        // no por el tipo: a 600px de ancho, cinco celdas quedan en 104px cada una
        // —menos que la foto de producto más chica— y en la casilla no se leen.
        categorias(tienda, [
          { clave: "celda-bolsos", titulo: "Bolsos" },
          { clave: "celda-calzado", titulo: "Calzado" },
          { clave: "celda-abrigos", titulo: "Abrigos" },
          { clave: "celda-joyas", titulo: "Accesorios" },
        ]),
        aire(8),
        { tipo: "divisor" },
        { tipo: "titulo", texto: "El del mes", align: "left" },
        {
          tipo: "columnas",
          variante: "imagen-texto",
          proporcion: 40,
          celdas: [
            { imagen: foto("producto-mochila"), url: tienda, titulo: "" },
            {
              titulo: "Contá por qué este",
              texto: "Una foto y tres renglones: qué es, para quién y por qué lo elegirían. Es el bloque que más convierte de todo el mail.",
              imagen: "",
              url: tienda,
            },
          ],
        },
        aire(8),
        bandaFoto(
          "banda-taller",
          "Así trabajamos",
          "Dos renglones sobre quién hace lo que vendés: dónde, con qué y desde cuándo. Es lo que separa una marca de un catálogo.",
        ),
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
    id: "new-arrivals",
    nombre: "New arrivals",
    descripcion: "Categorías con su propio botón, la marca contada en el medio y la grilla de tres. En mayúsculas, para marcas de ropa.",
    familia: "catalogo",
    // Clon de R-018 (SIMPLE): es la referencia que trajo el botón por celda al
    // motor. Gris y dorado, todo en mayúsculas — el rasgo lo pone la capa de
    // documento, no un hex.
    arma: ({ marca, tienda }) => ({
      estilos: { titulo: { mayusculas: true, espaciado: 1 }, imagen: { radio: 12 } },
      bloques: [
        ...menuTienda(tienda),
        portada("portada-moda-1", {
          titulo: "New arrivals",
          subtitulo: "Lo que acaba de entrar, antes que en la tienda.",
          boton: { texto: "Ver lo nuevo", url: tienda },
        }),
        // El patrón que justificó el cambio de motor del 2-ago: cada celda con
        // su propio "Ver", en vez de una foto muda que linkea entera.
        categorias(tienda, [
          { clave: "celda-remeras", titulo: "Remeras", boton: "Ver" },
          { clave: "celda-abrigos", titulo: "Abrigos", boton: "Ver" },
          { clave: "celda-calzado", titulo: "Calzado", boton: "Ver" },
        ]),
        banda(
          `Qué es ${marca}`,
          "La marca se explica en el medio, entre las dos grillas: dos renglones sobre qué hacés y para quién.",
        ),
        { tipo: "titulo", texto: "Lo más pedido", align: "center" },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, si venías esperando algo, es probable que esté acá.", align: "center" },
        grilla("recientes", { tres: true, boton: "Comprar" }),
        // ⚠️ Era `full: true`, y la captura dice que no: el "VER TODOS LOS
        // PRODUCTOS" de R-018 —y el de R-019 y R-020— es una pastilla centrada
        // de ancho medio, no una barra de lado a lado. Se escribió de la ficha
        // de texto, sin abrir la imagen.
        ...(tienda ? [{ tipo: "boton" as const, texto: "Ver todos", url: tienda, align: "center" as const }] : []),
        aire(8),
        {
          tipo: "columnas",
          variante: "imagen-texto",
          proporcion: 40,
          celdas: [
            { imagen: foto("producto-textil"), url: tienda, titulo: "" },
            {
              titulo: "El básico de la temporada",
              texto: "Elegí uno y explicá por qué: de qué está hecho, cómo calza, con qué se usa.",
              imagen: "",
              url: tienda,
            },
          ],
        },
        aire(8),
        fila([
          { titulo: "Envío gratis", texto: "A partir del mínimo que definas." },
          { titulo: "Hasta 12 cuotas", texto: "Con todas las tarjetas." },
          { titulo: "Cambios sin cargo", texto: "Primera devolución gratis." },
        ]),
        redes,
      ],
    }),
  },
  {
    id: "minimal",
    nombre: "Minimalista",
    descripcion: "Una foto de borde a borde, tres categorías y la grilla. Casi sin texto: la foto manda.",
    familia: "catalogo",
    // Clon de R-020 (SIMPLE en portugués): la portada que es SOLO una foto a
    // sangre, sin texto encima. Es la más silenciosa de la galería.
    arma: ({ tienda }) => ({
      estilos: { titulo: { fuente: "georgia", espaciado: 2, mayusculas: true }, imagen: { radio: 12 } },
      bloques: [
        ...menuTienda(tienda),
        // A sangre: pegada a los bordes de la tarjeta, sin radio ni margen. ⚠️ Es
        // el único caso del pack en el que la foto NO degrada a un color si no
        // carga (`fondoImagen` sí lo hace) — por eso lleva `alt` sí o sí: en
        // Outlook con imágenes bloqueadas, el alt ES la portada.
        { tipo: "imagen", url: foto("portada-moda-2"), alt: alt("portada-moda-2"), sangre: true },
        aire(16),
        { tipo: "titulo", texto: "La temporada, en tres pasos", align: "center" },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, entrá por donde te quede más cómodo.", align: "center" },
        categorias(tienda, [
          { clave: "celda-remeras", titulo: "Ellos" },
          { clave: "celda-abrigos", titulo: "Ellas" },
          { clave: "celda-calzado", titulo: "Calzado" },
        ]),
        { tipo: "divisor" },
        { tipo: "titulo", texto: "Destacados", align: "center" },
        grilla("destacados", { tres: true, boton: "Comprar" }),
        ...(tienda ? [{ tipo: "boton" as const, texto: "Ver la tienda", url: tienda, align: "center" as const }] : []),
        redes,
      ],
    }),
  },
  {
    id: "joyeria",
    nombre: "Con barra de envío",
    descripcion: "La barra fina de arriba con tu promesa de envío, portada con foto y las categorías. Sobria.",
    familia: "catalogo",
    // Clon de R-007 (Lima, joyería): la referencia que pidió la barra fina de
    // aviso, que se pudo recién cuando el `seccion` sin botón dejó de arrastrar
    // 16px de margen muerto.
    arma: ({ marca, tienda }) => ({
      // Pastilla en todo el mail: es lo que hace que se vea "de joyería" sin
      // clavar el azul noche de la referencia.
      estilos: { boton: { radio: 24 }, imagen: { radio: 12 } },
      bloques: [
        ...menuTienda(tienda),
        // ⚠️ Sin monto: el mínimo de envío gratis es de cada tienda y no lo sabe
        // el preset. Prometer "$20.000" acá es una promesa ajena en un mail ya
        // enviado, que es de las pocas cosas que no se pueden corregir después.
        barra("Envío gratis a partir del monto que definas · Cambios sin cargo"),
        portada("portada-joyas-1", {
          titulo: "Para regalar (o no)",
          subtitulo: `Las piezas que más salen de ${marca}.`,
          boton: { texto: "Ver la tienda", url: tienda },
        }),
        { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es lo que más nos están eligiendo esta semana.", align: "center" },
        grilla("destacados", { tres: true, boton: "Comprar" }),
        ...botonSi("Ver todo", tienda, "center"),
        aire(8),
        { tipo: "titulo", texto: "Entrá directo", align: "left" },
        categorias(tienda, [
          { clave: "celda-joyas", titulo: "Joyas" },
          { clave: "celda-regalos", titulo: "Regalos" },
          { clave: "celda-belleza", titulo: "Belleza" },
          { clave: "celda-bolsos", titulo: "Bolsos" },
        ]),
        aire(8),
        bandaFoto(
          "banda-marmol",
          "La colección nueva",
          "Contá en dos renglones de qué se trata y mandá a la categoría.",
          { texto: "Verla", url: tienda },
        ),
        redes,
      ],
    }),
  },
  {
    id: "new-in",
    nombre: "New in",
    descripcion: "Volanta, portada con foto y dos categorías grandes. Para anunciar que entró temporada nueva.",
    familia: "catalogo",
    // Clon de R-008 (idea, "New in"): la que trajo la volanta —un título chico
    // arriba del grande— y la barra fina de envío arriba de todo.
    arma: ({ marca, tienda }) => ({
      estilos: { boton: { radio: 24 }, imagen: { radio: 12 } },
      bloques: [
        barra("Envío gratis en tu primera compra · Hasta 12 cuotas"),
        portada("portada-moda-2", {
          titulo: "New in!",
          subtitulo: `Entró la temporada nueva de ${marca}.`,
          boton: { texto: "Verla ahora", url: tienda },
        }),
        // La volanta: un `titulo` chico encima del grande. 🟡 No hay bloque
        // "eyebrow" y no hace falta — es tamaño y espaciado sobre el bloque que
        // ya existe (lo mismo que hace `hot-sale`).
        {
          tipo: "titulo",
          texto: "NEW COLLECTION",
          align: "center",
          estilo: { titulo: { tamano: 13, peso: 700, espaciado: 2 } },
        },
        { tipo: "titulo", texto: "Lo que acaba de llegar", align: "center" },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es lo primero que entró de la temporada.", align: "center" },
        categorias(tienda, [
          { clave: "celda-remeras", titulo: "Lo nuevo" },
          { clave: "celda-abrigos", titulo: "Abrigos" },
        ]),
        grilla("recientes", { tres: true, boton: "Comprar" }),
        ...botonSi("Ver todo lo nuevo", tienda, "center"),
        aire(8),
        fila([
          { titulo: "Envíos a todo el país", texto: "Con seguimiento del pedido." },
          { titulo: "Hasta 12 cuotas", texto: "Con todas las tarjetas." },
          { titulo: "Cambios sin vueltas", texto: "Tenés 30 días." },
        ]),
        redes,
      ],
    }),
  },
  {
    id: "electro",
    nombre: "Con video",
    descripcion: "Portada con foto, categorías, la grilla y un video. Para productos que se explican mostrándolos.",
    familia: "catalogo",
    // Clon de R-006 (Atlántico, electrónica): la única de las 21 que lleva video,
    // y la que pidió el menú lateral adentro de la portada.
    //
    // 🟡 **El menú lateral no es expresable**: el `hero` es una columna sola, y
    // un menú al costado es otra tabla. Va arriba, como en las otras 14
    // referencias que llevan `menu`. Quedó anotado en el backlog con 2 pedidos.
    arma: ({ marca, tienda }) => ({
      estilos: { boton: { radio: 8 }, imagen: { radio: 12 } },
      bloques: [
        ...menuTienda(tienda),
        portada("portada-tech-1", {
          titulo: "Tecnología que se explica sola",
          subtitulo: `Lo que más recomendamos en ${marca}.`,
          boton: { texto: "Ver la tienda", url: tienda },
        }),
        categorias(tienda, [
          { clave: "celda-tecnologia", titulo: "Notebooks" },
          { clave: "celda-auriculares", titulo: "Audio" },
          { clave: "celda-regalos", titulo: "Regalos" },
        ]),
        {
          tipo: "seccion",
          bg: "",
          titulo: "¿No sabés cuál elegir?",
          texto: "Escribinos y te ayudamos a decidir. Contestamos todos los días.",
          ...cta("Escribinos", tienda),
        },
        { tipo: "titulo", texto: "Los más vendidos", align: "left" },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, estos son los que más salen y los que menos nos vuelven.", align: "left" },
        grilla("destacados", { tres: true, boton: "Comprar" }),
        ...botonSi("Ver todo el catálogo", tienda, "center"),
        aire(8),
        // Sin miniatura el bloque no se dibuja, igual que la imagen: la plantilla
        // no muestra un hueco hasta que alguien pegue el link de su video.
        { tipo: "video", imagen: "", url: "" },
        aire(8),
        fila([
          { titulo: "Garantía oficial", texto: "Con factura y respaldo." },
          { titulo: "Envío en 48 h", texto: "A todo el país." },
          { titulo: "Soporte real", texto: "Te atendemos después de la compra." },
        ]),
        redes,
      ],
    }),
  },
  {
    id: "audio",
    nombre: "Oscura con acento",
    descripcion: "Fondo oscuro y un color fuerte de acento. Para marcas de tecnología, audio o deporte.",
    familia: "catalogo",
    // Clon de R-019 (CUBO co., audio): negro y amarillo, sin serifa.
    //
    // 🔑 **Es la única de la familia que clava un color**, y entra por la
    // excepción de la regla 4: acá el color ES la plantilla. Una versión de esta
    // que se tiña con el tema de cada marca sería `minimal` con otro copy — el
    // contraste duro sobre negro es todo lo que la distingue en la galería. El
    // comerciante lo cambia desde el editor con dos clicks.
    arma: ({ marca, tienda }) => ({
      tema: { base: "oscuro", acento: "#ffd400" },
      estilos: { titulo: { mayusculas: true }, imagen: { radio: 12 } },
      bloques: [
        ...menuTienda(tienda),
        portada("portada-tech-1", {
          titulo: "Sonido, en serio",
          subtitulo: `Lo que ${marca} elige para escuchar todos los días.`,
          boton: { texto: "Ver la tienda", url: tienda },
        }),
        // 🟡 La referencia le pone una BAJADA a cada tarjeta de categoría, debajo
        // del nombre. La celda de imagen dibuja foto + etiqueta y nada más
        // (`celdaImagen` en `render.ts`): con un solo pedido no entra al motor,
        // así que el nombre carga con todo.
        categorias(tienda, [
          { clave: "celda-auriculares", titulo: "Auriculares" },
          { clave: "celda-tecnologia", titulo: "Escritorio" },
          { clave: "celda-deporte", titulo: "Deporte" },
        ]),
        { tipo: "titulo", texto: "Productos destacados", align: "left" },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es lo que más se está llevando.", align: "left" },
        grilla("destacados", { tres: true, boton: "Comprar" }),
        ...(tienda ? [{ tipo: "boton" as const, texto: "Ver todo", url: tienda, align: "center" as const }] : []),
        aire(8),
        bandaFoto(
          "banda-madera",
          "Probalo antes de decidir",
          "Contá acá tu diferencial: garantía, prueba en el local, devolución sin preguntas.",
          { texto: "Cómo funciona", url: tienda },
        ),
        redes,
      ],
    }),
  },
  {
    id: "tienda",
    nombre: "Tu tienda entera",
    descripcion: "Menú arriba, grilla de tres, un destacado y la banda de beneficios. Se llena sola con tu catálogo, sin una sola foto de stock.",
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
    descripcion: "Los accesos directos a cada rubro y la grilla abajo. Sin fotos de stock: la llenan tu catálogo y tus nombres de categoría.",
    familia: "catalogo",
    // R-004, R-007, R-018 y R-021: la fila de categorías con la etiqueta
    // debajo de la foto. Es lo que abrió el bloque `columnas` a 3 y 4 celdas.
    arma: ({ marca, tienda }) => ({
      estilos: { imagen: { radio: 12 }, boton: { radio: 24 } },
      bloques: [
        ...menuTienda(tienda),
        { tipo: "titulo", texto: "¿Qué estás buscando?", align: "center" },
        { tipo: "texto", texto: `Hola \${contacto.nombre}, entrá directo al rubro que te interesa de ${marca}.`, align: "center" },
        // 🔴 **`variante: "textos"`, y no es cosmético**: hasta el 2-ago-2026
        // esto eran cuatro celdas de IMAGEN sin imagen, y el filtro de celdas
        // vacías las descartaba a las cuatro ⇒ el bloque no dibujaba nada. Es el
        // mismo bug que tenía `redes` con los links vacíos: un bloque puesto en
        // el Json que nunca llegó a una casilla. Verificado el 2-ago con el
        // render: 1 bloque `columnas` en el documento, 0 filas dibujadas.
        //
        // Se arregla por acá y no bajándole una foto de stock a propósito: esta
        // plantilla es de las que se llenan **sin una foto ajena** (para eso está
        // `marroquineria`), así que las celdas pasan a ser accesos directos de
        // texto, que es lo que la variante dibuja y linkea entero.
        {
          tipo: "columnas",
          variante: "textos",
          celdas: [
            { titulo: "Novedades", texto: "Lo último que entró." },
            { titulo: "Más vendidos", texto: "Lo que más sale." },
            { titulo: "Ofertas", texto: "Lo que está rebajado." },
            { titulo: "Todo el catálogo", texto: "Mirá la tienda entera." },
          ].map((c) => ({ ...c, imagen: "", url: tienda })),
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
