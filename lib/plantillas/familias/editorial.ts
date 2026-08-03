// Familia "Editorial": los mails donde el texto es el producto.
//
// Son los únicos que no llevan grilla de productos de entrada. El rasgo lo pone
// la **capa `estilos` de documento** —serifa, cuerpo grande, renglones sueltos—,
// que es exactamente para lo que existe: un mail se ve distinto sin repetir
// quince overrides bloque por bloque.
//
// 🔑 Las dos primeras clonan una referencia y **declaran su `Tema` COMPLETO con
// los hex MEDIDOS** sobre la captura (`scripts/paleta-referencia.ts`).
// `combinarTema` es un spread plano: el campo que falte se cae al tema de la
// marca que elige la plantilla y el clon deja de ser un clon. Regla 4 de
// `PLANTILLAS.md`. Las otras tres no clonan nada y se tiñen con la marca.

import {
  type DefPreset, aire, banda, botonSi, categorias, cta, menuTienda, portada, redes, sinBoton,
} from "../comun";
import { foto } from "../fotos";

export const EDITORIAL: readonly DefPreset[] = [
  {
    id: "ocasion",
    nombre: "Ocasión especial",
    descripcion: "Rosa empolvado, serifa y todo centrado, sin un solo precio. Para una fecha que se elige con tiempo: bodas, egresados, aniversarios.",
    familia: "editorial",
    // Clon de R-003 ("Morelia Bodas").
    //
    // 🔑 Lo que la hace ser ella no es un bloque: es que **el mail no vende**.
    // Invita a entrar. Por eso la grilla va sin botón por tarjeta —es la única
    // de los 21 clones que no lo lleva— y el CTA de cada zona es un "Ver más"
    // subrayado y no una pastilla.
    arma: ({ marca, tienda }) => ({
      // Medido sobre la captura: el rosa de las bandas de arriba y abajo es
      // **#fcf0ec** (el 92% de la banda del pie), la tarjeta es blanco puro
      // (#fcfcfc al 100% del recorte) y **el vinoso viene en dos tonos**: los
      // títulos y los nombres de la grilla en **#7c1818** y los links "Ver más"
      // en **#9c5450**, más lavado. La captura no tiene un solo color saturado
      // —`paleta-referencia` devuelve "—" en la lista de saturados—, que es
      // exactamente lo que "rosa empolvado" quiere decir.
      tema: { base: "claro", fondo: "#fcf0ec", fondoContenido: "#ffffff", acento: "#7c1818", link: "#9c5450", ancho: 600, fuente: "georgia" },
      estilos: {
        // 🔴 Sin `color` en `titulo`: el de la portada va sobre la foto y los
        // tres de abajo sobre el blanco. Clavarlo acá le gana a los dos
        // contrastes a la vez — el error que se repitió en tres de los siete
        // clones de catálogo. El vinoso se clava bloque por bloque.
        titulo: { fuente: "georgia", interlinea: 1.3 },
        cuerpo: { fuente: "georgia", interlinea: 1.7 },
        // 🟡 **El "botón" de la referencia es un link subrayado, no una
        // pastilla.** El motor siempre rellena, así que se emula con el fondo
        // del color que hay atrás (blanco acá, el velo en la portada) y sin
        // padding lateral. El subrayado sale por `extra()`, que lo emite después
        // del `text-decoration:none` cableado del ancla y por lo tanto le gana.
        // ⚠️ En Outlook el botón va por VML y ahí no se subraya: queda el texto
        // vinoso solo, que es lo que se pierde y no es mucho.
        boton: { fondo: "#ffffff", color: "#9c5450", radio: 0, padX: 0, padY: 4, peso: 400, tamano: 15, subrayado: true },
        imagen: { radio: 0 },
      },
      bloques: [
        // ✅ El menú va sobre el rosa de la banda de arriba, que es el mismo
        // `#fcf0ec` del fondo de PÁGINA: en la captura el logo y los links
        // comparten una sola banda, y la tarjeta blanca arranca recién en la
        // portada. Es la más suave de las seis —dos tonos casi iguales, no
        // blanco contra negro como en `vuelta-al-cole`— pero es la que hace que
        // el mail empiece con la franja rosa en vez de con un filo blanco.
        ...menuTienda(tienda, { cuerpo: { tamano: 14 }, caja: { fondo: "#fcf0ec", padY: 14 } }),
        // ⚠️ La portada de la referencia es una persona de frente y **el pack
        // excluye las caras reconocibles a propósito**: la plantilla la manda un
        // tercero a su propia lista.
        //
        // 🔴 El primer intento fue `banda-tela` —telas de lino, que es lo que
        // más dice "vestido" del pack— y salió MAL por el brillo, no por el
        // tema: es arpillera oscura, y bajo velo daba una banda marrón adentro
        // de un mail que es rosa y blanco. La referencia es clarísima, y en una
        // paleta empolvada la portada oscura se lleva puesto al mail entero. El
        // mármol claro es neutro y con velo 40 queda gris suave, que es el tono
        // de la captura. (Lo usa también `cyber-marmol`, en otra familia y con
        // velo 70: es una textura, no un motivo.)
        portada("banda-marmol", {
          titulo: "El vestido de tus sueños",
          subtitulo: "La noche más importante",
          boton: { texto: "Ver más", url: tienda },
          alto: 300,
          // 🔑 **El velo va del vinoso del mail y no del oscuro fijo**, que es
          // el tercer uso distinto de `veloColor`: en `temporada` sirve para
          // ACLARAR, en `bodega` para que la portada y el encabezado sean una
          // sola pieza, y acá para **teñir**. Con el `#111111` de siempre el
          // mármol quedaba gris frío en el medio de un mail rosa —medido, la
          // banda daba #7d7d7d— y era la única diferencia grande que quedaba
          // contra la captura, donde la portada es rosa empolvado de punta a
          // punta. Con el vinoso al 45% sobre el mármol la banda sale rosa
          // apagada, que es el color de la referencia (#b8949c medido sobre
          // ella).
          veloColor: "#7c1818",
          velo: 45,
          estilo: {
            titulo: { tamano: 34 },
            // La volanta de la captura va en versales con espaciado, chiquita y
            // debajo del título. Es el 🟡 del "eyebrow" del vocabulario, usado
            // al revés: acá el título viene primero.
            subtitulo: { mayusculas: true, espaciado: 1.5, tamano: 13 },
            // 🔴 **El fondo del botón no es el color del velo: es el color de
            // la banda YA VELADA**, y ese se mide sobre nuestro propio render,
            // no se deduce. Acá el vinoso al 45% sobre el mármol da **#a47777**
            // (medido). Con el `#7c1818` del velo puesto acá —que es lo que
            // parece obvio— el "Ver más" sale como un rectángulo vinoso en el
            // medio de la portada, igual que salía negro cuando el velo era
            // `#111111`. Es la misma trampa que "un botón claro sobre foto
            // oscura", al revés.
            boton: { fondo: "#a47777", color: "#ffffff" },
          },
        }),
        // Foto a la izquierda, texto centrado a la derecha con su propio "Ver
        // más". `imagen-texto` es "la PRIMERA con foto".
        {
          tipo: "columnas",
          variante: "imagen-texto",
          proporcion: 50,
          celdas: [
            { imagen: foto("celda-joyas"), url: tienda, titulo: "" },
            {
              imagen: "",
              url: "",
              titulo: "Damas de honor",
              texto: `Contá qué preparaste para quienes la acompañan: los talles, los colores y con cuánto tiempo conviene encargarlo en ${marca}.`,
              ...cta("Ver más", tienda),
            },
          ],
          estilo: { titulo: { align: "center", color: "#7c1818", tamano: 20 }, cuerpo: { align: "center" } },
        },
        { tipo: "divisor" },
        { tipo: "titulo", texto: "Todo para tu noche ideal", align: "center", estilo: { titulo: { color: "#7c1818", tamano: 20 } } },
        // 🟡 La grilla de la captura va **sin precio** y el precio lo pone
        // Tiendanube: no hay forma de apagarlo sin apagar el dato. Lo que sí se
        // respeta es que **no lleva botón por tarjeta** — es la única de las 21
        // referencias con grilla que no lo tiene, y es coherente con un mail que
        // invita a entrar en vez de vender.
        //
        // ⚠️ Va a mano y no por `grilla()` por la **fila de tres exacta** de la
        // captura: las dos formas del helper son 6 (2 filas) y 4, y con seis
        // este mail medía media pantalla más que la referencia. No cuesta una
        // consulta extra a Tiendanube — al contrario: `recientes|3` es la MISMA
        // clave que ya pide `lookbook` en esta familia, así que la pestaña
        // editorial resuelve menos consultas que con el helper. El `align`
        // centrado se escribe explícito porque es lo que `grilla()` garantiza.
        { tipo: "productos-dinamicos", fuente: "recientes", n: 3, porFila: 3, movil: 2, estilo: { cuerpo: { align: "center" } } },
        aire(8),
        { tipo: "titulo", texto: "Dónde estamos ubicadas", align: "center", estilo: { titulo: { color: "#7c1818", tamano: 18 } } },
        // ⚠️ La captura escribe la dirección acá. Nosotros **no la repetimos**:
        // el domicilio de la marca ya sale en el pie de todo mail (`marcaDe()`),
        // y escribirlo dos veces es un dato que se desincroniza solo.
        { tipo: "texto", texto: "Pasá por el local a probarte lo que elegiste. Te esperamos con turno; el domicilio está al pie de este mail.", align: "center" },
        aire(8),
        redes,
      ],
    }),
  },
  {
    id: "dos-colores",
    nombre: "Dos colores",
    descripcion: "Negro y verde lima, sin un tercer color. Las fotos ocupan todo y el texto casi no aparece: para presentar una colección.",
    familia: "editorial",
    // Clon de R-005 ("Baires", swimwear).
    //
    // 🔑 Es el mismo truco de partición que `bodega` y `negro-y-dorado`: el
    // negro va en el `fondo` de PÁGINA —donde se dibujan el encabezado y el
    // pie— y la tarjeta queda blanca. Lo que la distingue de esas dos es que
    // acá **el segundo color es una banda entera**, no un título.
    arma: ({ marca, tienda }) => ({
      // Medido: negro puro **#000000 el 23,1%** del mail (95,5% del recorte del
      // pie), blanco el 26,3% y el lima **#d8fc54** el 6% — el único color
      // saturado de toda la captura. ⚠️ El plan había elegido **#c8ff00** a ojo:
      // es un lima bastante más ácido y sin nada de rojo. Cuarta tanda seguida
      // con el hex del plan mal.
      //
      // 🔑 El lima NO es el acento: **los botones son negros**, igual que en
      // R-016. Con 6% de los píxeles es un color de banda, no de CTA (la
      // pregunta no es de qué color es, es cuánto ocupa).
      tema: { base: "claro", fondo: "#000000", fondoContenido: "#ffffff", acento: "#000000", link: "#000000", ancho: 600, fuente: "sistema" },
      estilos: {
        // 🔴 Sin `color`: hay títulos sobre las dos bandas lima, uno sobre la
        // foto de la portada y otro sobre el bloque negro del cierre.
        titulo: { peso: 700 },
        // 🔴 **Sin `mayusculas` acá.** Estaba puesto en la capa de documento y el
        // `mayusculas: false` del botón de la portada no lo apagaba: `sanearBool`
        // no escribe un `false`, así que el override no existe y el "Ver
        // colección" —que en la captura es un link en minúsculas— salía "VER
        // COLECCIÓN". Las versales son del botón de la grilla, que es el único
        // que la referencia pone así, y ahí se piden.
        boton: { fondo: "#000000", color: "#ffffff", radio: 0, peso: 700, tamano: 13 },
        imagen: { radio: 0 },
      },
      bloques: [
        // ✅ El menú va en lima **adentro de la banda negra** de arriba, pegado
        // al logo, como en la captura. Es el caso donde más se notaba: sobre el
        // blanco de la tarjeta los links salían negros.
        //
        // 🔴 **El lima va escrito**, no recalculado: el motor recolorea los links
        // contra la banda solo cuando nadie eligió `color`, y sobre negro eso da
        // BLANCO. Acá el lima es el rasgo de la referencia —el único color
        // saturado del mail— así que se clava.
        ...menuTienda(tienda, { cuerpo: { tamano: 13, peso: 700, color: "#d8fc54" }, caja: { fondo: "#000000", padY: 14 } }),
        // La portada con el texto abajo a la IZQUIERDA: `caja.align` desde el
        // 2-ago-2026 es una sola perilla para todo el interior.
        portada("portada-verano-1", {
          titulo: "Summer",
          subtitulo: "Nuestra colección de verano está pensada para que siempre brilles.",
          boton: { texto: "Ver colección", url: tienda },
          alto: 320,
          // La playa es la foto más clara del pack y el título va blanco: 55 es
          // el default y acá es también el mínimo que lo deja leer.
          velo: 55,
          align: "left",
          estilo: {
            // 48 es el tope de `RANGOS.tamano` y es lo que hace la captura: el
            // "Summer" ocupa un tercio del ancho del mail.
            titulo: { tamano: 48 },
            subtitulo: { tamano: 14 },
            // Mismo link subrayado que en `ocasion`, y con el mismo cuidado: el
            // fondo es el de la **banda ya velada** —medido acá en #4c4644—, no
            // el `#111111` del velo, que sobre esta playa dibujaba una pastilla
            // negra opaca en el medio de la portada.
            boton: { fondo: "#4c4644", color: "#ffffff", padX: 0, peso: 400, tamano: 14, subrayado: true },
          },
        }),
        // 🟡 En la captura el "Sets." está **al costado** de la grilla, en su
        // propia columna con una rayita debajo. El `hero` y el `titulo` son de
        // una columna sola, así que va arriba y a la izquierda.
        { tipo: "titulo", texto: "Sets.", align: "left", estilo: { titulo: { tamano: 32 } } },
        // Tres en una fila, como la captura. Va a mano por la misma razón que en
        // `ocasion`: las dos formas de `grilla()` son 6 y 4, y `n: 3` es la
        // forma que esta familia ya usa. Las versales del "COMPRAR" se piden
        // acá, que es el único botón de la referencia que las tiene.
        {
          tipo: "productos-dinamicos",
          fuente: "destacados",
          n: 3,
          porFila: 3,
          movil: 2,
          botonTexto: "Comprar",
          estilo: { cuerpo: { align: "center" }, boton: { mayusculas: true } },
        },
        aire(8),
        // La primera banda lima. El texto repetido con el punto en el medio es
        // literal de la captura: es tipografía usada como textura.
        {
          tipo: "seccion",
          bg: "#d8fc54",
          titulo: "Spring & Summer · Spring & Summer",
          texto: "",
          ...sinBoton,
          estilo: { titulo: { color: "#000000", tamano: 22, fuente: "georgia", peso: 400 }, caja: { padY: 14 } },
        },
        // 🟡 En la captura son **tres fotos a sangre pegadas entre sí**, sin un
        // píxel de separación. La fila de `columnas` lleva el margen lateral de
        // `pad()` y una separación entre celdas que no se puede sacar: queda la
        // misma tríada, con aire.
        //
        // ⚠️ Las tres son de ROPA a propósito: en la captura son tres fotos de
        // la misma colección y la tríada se lee como una sola pieza. El primer
        // intento mezclaba remera, cartera y bota —tres rubros— y ahí deja de
        // ser un lookbook y pasa a ser una fila de categorías, que es otro
        // bloque de otra plantilla.
        categorias(tienda, [{ clave: "celda-remeras" }, { clave: "celda-abrigos" }, { clave: "celda-calzado" }]),
        // La segunda banda lima. En la captura dice "Bottoms." pegado a la
        // izquierda y "Tops." a la derecha; el interior de un `seccion` está
        // siempre centrado salvo por `caja.align`, que es una sola perilla para
        // los dos.
        {
          tipo: "seccion",
          bg: "#d8fc54",
          titulo: "Bottoms. · Tops.",
          texto: "",
          ...sinBoton,
          estilo: { titulo: { color: "#000000", tamano: 22, fuente: "georgia", peso: 400 }, caja: { padY: 14 } },
        },
        // El cierre negro. En la captura el pie lleva el menú vertical en lima y
        // los datos de contacto; acá el negro del pie ya lo pone el fondo de
        // página, y este bloque es el que mete el lima ahí abajo.
        {
          tipo: "seccion",
          bg: "#000000",
          titulo: "Nada te queda lejos",
          texto: `Envíos a todo el país y cambios sin cargo. Escribinos y te ayudamos a elegir el talle antes de que compres en ${marca}.`,
          ...cta("Escribirnos", tienda),
          estilo: { titulo: { color: "#d8fc54" }, boton: { fondo: "#d8fc54", color: "#000000" } },
        },
        redes,
      ],
    }),
  },
  {
    id: "newsletter",
    nombre: "Newsletter",
    descripcion: "Portada, nota destacada y lo último que cargaste. La clásica de contenido.",
    familia: "editorial",
    arma: ({ tienda }) => ({
      estilos: { imagen: { radio: 12 } },
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "Lo nuevo de este mes",
          subtitulo: "Novedades, tips y lo que se viene",
          bg: "",
          ...sinBoton,
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es lo que preparamos para vos 👇", align: "left" },
        // ⛔ Acá había un `{ tipo: "imagen", url: "" }`. Renderiza el `<img>`
        // igual, así que la miniatura salía con un ícono roto y el mail también
        // si el comerciante no la reemplazaba. La nota se sostiene con el título
        // y el texto; las fotos las pone la grilla del final.
        { tipo: "titulo", texto: "Título de la nota", align: "left" },
        { tipo: "texto", texto: "Contá algo acá: una nota, un detrás de escena o lo que quieras resaltar.", align: "left" },
        ...botonSi("Leer la nota", tienda),
        { tipo: "divisor" },
        { tipo: "titulo", texto: "Lo último que sumamos", align: "left" },
        { tipo: "productos-dinamicos", fuente: "recientes", n: 2, movil: 2 },
        aire(8),
        banda("¿Todavía no nos seguís?", "Sumate a nuestras redes para no perderte ninguna novedad."),
        redes,
      ],
    }),
  },
  {
    id: "editorial",
    nombre: "Editorial",
    descripcion: "Con serifa y mucho aire. Para escribir de verdad, no para vender.",
    familia: "editorial",
    arma: ({ marca, tienda }) => ({
      // Angosto: una columna de texto largo a 700px se lee mal.
      tema: { ancho: 600 },
      // La capa de documento entera al servicio de un rasgo: serifa y renglones
      // sueltos en todo el mail, sin tocar bloque por bloque.
      estilos: {
        titulo: { fuente: "georgia", tamano: 30, interlinea: 1.25 },
        subtitulo: { fuente: "georgia", tamano: 18 },
        cuerpo: { fuente: "georgia", tamano: 17, interlinea: 1.75 },
      },
      bloques: [
        aire(12),
        { tipo: "titulo", texto: "El título de la nota va acá", align: "left" },
        { tipo: "texto", texto: `Por el equipo de ${marca}`, align: "left" },
        { tipo: "divisor" },
        // ⛔ Acá había un `{ tipo: "imagen", url: "" }` — un `<img src="">`, roto.
        // Y esta plantilla es la que menos lo necesita: lo que la hace editorial
        // es la serifa, el cuerpo de 17 y el interlineado de 1,75. Una columna de
        // texto bien seteada ES el diseño.
        { tipo: "texto", texto: "Hola ${contacto.nombre}. Arrancá con el párrafo que engancha: qué pasó, por qué lo estás contando y qué se lleva quien termine de leer.", align: "left" },
        { tipo: "texto", texto: "Seguí desarrollando. En un mail editorial el texto es el producto, así que no lo cortes en dos renglones: si tenés algo para decir, decilo entero.", align: "left" },
        { tipo: "divisor" },
        ...botonSi("Seguir leyendo en la tienda", tienda),
        aire(8),
        redes,
      ],
    }),
  },
  {
    id: "lookbook",
    nombre: "Lookbook",
    descripcion: "Foto grande de borde a borde, tres looks al lado y el video. Para mostrar una colección con TUS fotos: nace vacía y la llenás vos.",
    familia: "editorial",
    // La portada fotográfica pegada a los bordes de R-003, R-005, R-011 y
    // R-020. ⚠️ **No clona ninguna**: desde el 2-ago-2026 R-003 y R-005 tienen
    // sus clones fieles acá arriba (`ocasion` y `dos-colores`) y esta es la que
    // se llena con **las fotos del comerciante**, no con las del pack. Por eso
    // no declara tema y se tiñe con la marca, que es el otro valor de la regla 4.
    //
    // Es la única plantilla de la galería que PIDE fotos, y va acá a propósito:
    // el resto se tiene que ver llena sin que nadie suba una (regla 3), pero un
    // lookbook sin fotos no es un lookbook — el copy lo dice desde el editor.
    arma: ({ marca, tienda }) => ({
      tema: { ancho: 600 },
      estilos: { titulo: { fuente: "georgia", tamano: 32 }, cuerpo: { fuente: "georgia", tamano: 16 } },
      bloques: [
        ...menuTienda(tienda),
        // A sangre: la foto ocupa la tarjeta de lado a lado. Nace vacía y el
        // renderer no dibuja una `imagen` sin URL, así que la galería no muestra
        // un ícono roto — pero el bloque queda puesto, que es el punto de una
        // plantilla prearmada.
        { tipo: "imagen", url: "", alt: "La foto de portada de la colección", sangre: true },
        aire(16),
        { tipo: "titulo", texto: "El nombre de la colección", align: "center" },
        { tipo: "texto", texto: `Dos renglones sobre de qué se trata: en qué se inspiró, para qué momento es. Después dejá que las fotos hablen.`, align: "center" },
        ...botonSi("Ver la colección", tienda, "center"),
        aire(12),
        // Tres fotos al lado, con su nombre debajo: la fila de `columnas` que
        // antes no se podía armar. Sin foto, la celda no se dibuja.
        {
          tipo: "columnas",
          celdas: ["El look uno", "El look dos", "El look tres"].map((titulo) => ({ imagen: "", url: tienda, titulo })),
        },
        aire(12),
        // El bloque `video` no lo usaba ningún preset y el motor lo tiene desde
        // hace rato. Sin miniatura no se dibuja, igual que la imagen.
        { tipo: "video", imagen: "", url: "" },
        { tipo: "divisor" },
        { tipo: "titulo", texto: "Lo último que entró", align: "left" },
        { tipo: "productos-dinamicos", fuente: "recientes", n: 3, movil: 2, porFila: 3 },
        aire(8),
        banda(`Seguí a ${marca}`, "Las fotos nuevas salen primero en nuestras redes."),
        redes,
      ],
    }),
  },
];
