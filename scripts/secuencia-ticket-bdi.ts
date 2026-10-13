// El TICKET DEL LOCAL de BDI: el mail que sale apenas se cobra en la Caja, si la
// clienta dejó su mail. Lo usan `crear-ticket-bdi.ts` (que lo crea en PAUSADO) y
// `.mirar/ticket-bdi/motor.mts` (que lo dibuja con el motor real sin escribir nada).
//
// De dónde sale: el diseño aprobado por Bruno el 12-oct-2026
// (`.mirar/ticket-bdi/propuesta-a.html` y `-b.html`, `captura-a.png`), de la misma
// familia que la bienvenida de 5: el logo, Montserrat, el casi negro `#1B1717`,
// títulos con un trozo en bold italic y botones pastilla.
//
// Reglas del mail (Bruno, 12-oct):
//  - ⛔ la forma de pago: ni «Pagaste con», ni «Entregaste», ni «Vuelto» (lo saca
//    `bloqueDeTicket` para todas las marcas). El descuento sí, en el magenta;
//  - ⛔ nada de cambios: en BDI no se menciona el cambio, ni en el cuerpo ni en el
//    asunto ni en el preheader;
//  - ⛔ cupón y ⛔ envíos: es para quien ya compró en el local.
//
// 🔑 Se CLONAN de la bienvenida de BDI de hoy (`cms6kpmqg…`) el encabezado (el logo
// ya recortado) y las redes, con id NUEVO: el logo es el que subió el comerciante.
import { nuevoId, type Bloque, type ContenidoCampania } from '../lib/email/bloques.ts';
import { leerContenido, V_ACTUAL } from '../lib/email/esquema.ts';
import type { Tema } from '../lib/email/tema.ts';
import type { Trozo } from '../lib/email/texto-rico.ts';
import type { MailNuevo } from './secuencia-bienvenida-5.ts';

/** La bienvenida de BDI de la que se clonan el logo y las redes. */
export const FUENTE_TICKET_BDI = 'cms6kpmqg000004l4s4tg6djo';
export const NOMBRE_TICKET_BDI = 'Ticket del local';

const NEGRO = '#1b1717';
const MAGENTA = '#e40044';
const BLANCO = '#ffffff';

/** El de la bienvenida de 5 y el carrito v2 de BDI: Montserrat, el casi negro de la tienda y blanco. */
const TEMA: Tema = { base: 'claro', fondo: BLANCO, fondoContenido: BLANCO, acento: NEGRO, fuente: 'montserrat' };

const TIENDA = 'https://bdiaccesorios.com.ar';
const INSTAGRAM = 'https://www.instagram.com/bdi_accesorios/';
/** La ficha de Google del LOCAL de BDI (el link cargado en Resorty, `ModuloConfig('resenas')`). */
const RESENA_GOOGLE = 'https://g.page/r/CTSlez0IRhw3EAI/review';
const utm = (ruta: string, donde: string) =>
  `${TIENDA}/${ruta}?utm_source=mailer&utm_medium=email&utm_campaign=ticket-bdi&utm_content=${donde}`;

const clon = <T extends Bloque>(b: T): T => ({ ...structuredClone(b), id: nuevoId() });

/** Rótulo chico en mayúsculas, separado: «TU COMPRA EN EL LOCAL». */
const volanta = (texto: string, color = '$medio', arriba = 18): Bloque => ({
  id: nuevoId(), tipo: 'titulo', align: 'left', texto,
  estilo: { titulo: { tamano: 11, peso: 700, espaciado: 2, color }, caja: { padArriba: arriba, padAbajo: 0 } },
} as Bloque);

/** El título de la tienda: bold italic apretado, a la izquierda. */
const titular = (texto: string | Trozo[], tamano: number, extra: { color?: string; arriba?: number } = {}): Bloque => ({
  id: nuevoId(), tipo: 'titulo', align: 'left', texto,
  estilo: {
    titulo: { tamano, peso: 800, italica: true, espaciado: -1, interlinea: 1.15, ...(extra.color ? { color: extra.color } : {}) },
    caja: { padArriba: extra.arriba ?? 8, padAbajo: 0 },
  },
} as Bloque);

const parrafo = (texto: string, extra: { tamano?: number; color?: string; arriba?: number } = {}): Bloque => ({
  id: nuevoId(), tipo: 'texto', align: 'left', texto,
  estilo: {
    cuerpo: { tamano: extra.tamano ?? 15, interlinea: 1.55, ...(extra.color ? { color: extra.color } : {}) },
    caja: { padArriba: extra.arriba ?? 12, padAbajo: 0 },
  },
} as Bloque);

/** La pastilla de la tienda. Con `segundo`, el botón doble (el segundo en contorno). */
const pastilla = (texto: string, url: string, extra: { segundo?: { texto: string; url: string }; arriba?: number; abajo?: number } = {}): Bloque => ({
  id: nuevoId(), tipo: 'boton', texto, url, align: 'left', full: false,
  ...(extra.segundo ? { segundo: extra.segundo } : {}),
  estilo: {
    boton: { tamano: 12, peso: 700, espaciado: 1.5, radio: 30, padY: 15, padX: 18 },
    caja: { padArriba: extra.arriba ?? 18, padAbajo: extra.abajo ?? 0 },
  },
} as Bloque);

export function armarTicketBdi(fuente: { contenido: unknown }): MailNuevo {
  const base = leerContenido(fuente.contenido).bloques;
  const enc = base.find((x) => x.tipo === 'encabezado');
  const redes = base.find((x) => x.tipo === 'redes');
  if (!enc || !redes) throw new Error('falta el encabezado o las redes en la bienvenida de BDI (de ahí se clonan)');
  // Las redes, con el «Sitio web» medido como del ticket (⛔ de la bienvenida).
  const redesTicket = clon(redes);
  if (redesTicket.tipo === 'redes') {
    redesTicket.links = (redesTicket.links ?? []).map((l) =>
      /bdiaccesorios\.com\.ar/.test(l.url) && !/instagram|tiktok/.test(l.url) ? { ...l, url: utm('', 'pie') } : l);
    redesTicket.estilo = { caja: { padArriba: 30, padAbajo: 0 } };
  }

  const bloques: Bloque[] = [
    clon(enc),
    volanta('TU COMPRA EN EL LOCAL', '$medio', 4),
    // Dos tipografías, como «YA SOS parte del club.» de la bienvenida. ⚠️ La itálica
    // va en el TROZO: un `italica:false` de trozo no apaga la del bloque.
    {
      id: nuevoId(), tipo: 'titulo', align: 'left',
      texto: [{ t: 'GRACIAS POR ', peso: 400 }, { t: 'pasar por el local.', peso: 800, italica: true }],
      estilo: { titulo: { tamano: 30, peso: 400, espaciado: -0.5, interlinea: 1.1 }, caja: { padArriba: 8, padAbajo: 0 } },
    } as Bloque,
    parrafo('Acá tenés el detalle de lo que te llevaste. ¡Que lo disfrutes! <3', { arriba: 14 }),
    // Lo rellena el procesador con `triggerData.ticket`: prendas, totales, número y fecha.
    {
      id: nuevoId(), tipo: 'carrito', items: [], modo: 'ticket', vista: 'tarjeta', colorDescuento: MAGENTA,
      estilo: { precio: { peso: 700 }, caja: { padArriba: 24, padAbajo: 0 } },
    } as Bloque,
    { id: nuevoId(), tipo: 'espaciador', alto: 24 } as Bloque,
    // Lo nuevo y las redes, sin cupón ni envíos: es para quien ya compró.
    {
      id: nuevoId(), tipo: 'banda', fondo: NEGRO, base: 'oscuro', acento: BLANCO,
      bloques: [
        volanta('NEW IN', MAGENTA, 2),
        titular('Mirá lo que va entrando.', 26, { color: BLANCO }),
        parrafo('Las colecciones nuevas las mostramos primero en Instagram. Y en la tienda online está todo, para cuando no puedas pasar.', { tamano: 14, color: '#d9d4d4', arriba: 10 }),
        pastilla('VER LO NUEVO', utm('new-in/', 'nuevo'), { segundo: { texto: 'SEGUINOS EN INSTAGRAM', url: INSTAGRAM }, arriba: 20, abajo: 2 }),
      ],
    } as unknown as Bloque,
    // La reseña de Google del local.
    titular('¿Cómo te atendimos?', 24, { arriba: 36 }),
    parrafo('Si te gustó, contalo en Google. Nos ayuda muchísimo a que más gente se anime a venir al local.', { arriba: 10 }),
    pastilla('DEJAR MI RESEÑA EN GOOGLE', RESENA_GOOGLE),
    redesTicket,
    {
      id: nuevoId(), tipo: 'texto', align: 'center', texto: 'Te llegó porque dejaste tu mail en la caja del local.',
      estilo: { cuerpo: { tamano: 11, color: '$tenue' }, caja: { padArriba: 12, padAbajo: 8 } },
    } as Bloque,
  ];

  const contenido: ContenidoCampania = leerContenido({ v: V_ACTUAL, bloques, tema: TEMA });
  return {
    nombre: NOMBRE_TICKET_BDI,
    esperaHoras: 0,
    asunto: 'Tu ticket de BDI',
    preheader: 'El detalle de lo que te llevaste del local, en tu mail.',
    contenido,
    remitenteNombre: null,
    responderA: null,
  };
}
