// El CARRITO ABANDONADO de ZATTIA: DOS mails, a la hora y a las 24 h. Lo usan
// `crear-carrito-zattia.ts` (que los crea en PAUSADO) y `ensayo-carrito-zattia.mts`
// (que los dibuja con carritos reales sin escribir nada).
//
// Por qué dos y no cuatro (Bruno, 12-oct-2026), medido en TN sobre 30 días: Zattia
// abandona ~124 personas por mes, y sin ningún mail el 9% vuelve a comprar sola en
// 10 días — TODAS en menos de 72 h (9 de 11 en menos de 24 h). Un 3º y un 4º saldrían
// cuando ya nadie vuelve.
//
// De dónde sale: la propuesta del diseñador (`.mirar/carrito-zattia-v1/`, vitrina
// https://claude.ai/artifact/5VpMT3YNPPScgr6QpLF21x), de la misma familia que la
// bienvenida v3 que Bruno aprobó. Sus respuestas a la vitrina (12-oct):
//  - ⛔ no se recuerda el código de bienvenida: el 85% de los carritos son 100% prendas
//    en oferta, y ahí el checkout lo rechaza entero;
//  - ⛔ nunca «te faltan $X para el envío gratis» (carrito mediano $26.990 contra un
//    umbral de $150.000): el envío sólo se nombra para quien RETIRA (`${cart.retiro}`),
//    y la tercera garantía cambia sola (`${cart.entrega}`);
//  - el estante del 2 es NEW IN (precio lleno: se termina la feria);
//  - ⛔ sin texto plano del dueño (no hay quien conteste) y ⛔ sin cupón.
//
//  1 · a la hora — «Te lo guardamos»: su carrito como la ficha de la tienda, el total,
//                  la ayuda de TALLE por WhatsApp (en ropa es la duda que frena) y las
//                  garantías.
//  2 · 24 h      — «Sigue ahí, por ahora»: el carrito no aparta el stock (sin inventar
//                  escasez), las fotos en fila, y cuatro de NEW IN por si ya no quiere eso.
import { nuevoId, type Bloque, type ContenidoCampania } from '../lib/email/bloques.ts';
import { leerContenido, V_ACTUAL } from '../lib/email/esquema.ts';
import type { Estilos } from '../lib/email/estilos.ts';
import type { MailNuevo } from './secuencia-bienvenida-5.ts';
import {
  BLANCO, CAT, GRIS, NEGRO, TEMA, TIENDA, WHATSAPP,
  banda, boton, cabeceraZattia, filete, grilla, parrafo, pieZattia, rotulo, titular, volanta,
} from './secuencia-bienvenida-zattia.ts';

export const PREFIJO_CARRITO_ZATTIA = 'Carrito Z';

const utm = (ruta: string, n: number, donde: string) =>
  `${TIENDA}/${ruta}?utm_source=mailer&utm_medium=email&utm_campaign=carrito-zattia-${n}&utm_content=${donde}`;

/** WhatsApp con el mensaje ya escrito: quien escribe no tiene que pensar cómo empezar. */
const WA_TALLE = `${WHATSAPP}?text=${encodeURIComponent('¡Hola! Tengo una duda con el talle de una prenda de mi carrito')}`;

/** La prenda «de tienda»: nombre en MAYÚSCULAS a 400, variante en gris, precio en negrita, foto sin esquinas. */
const ESTILO_CARRITO: Estilos = {
  titulo: { tamano: 12, peso: 400, espaciado: 1, mayusculas: true },
  nota: { tamano: 12, color: '$medio' },
  precio: { tamano: 13, peso: 700 },
  imagen: { radio: 0 },
};

const carrito = (vista: 'tienda' | 'galeria'): Bloque =>
  ({ id: nuevoId(), tipo: 'carrito', items: [], vista, estilo: { ...ESTILO_CARRITO, caja: { padArriba: 8, padAbajo: 4 } } } as Bloque);

/** Un renglón chico y gris (el retiro, el resumen). Con el tag sin dato, se cae solo. */
const nota = (texto: string, align: 'left' | 'center' = 'left'): Bloque => ({
  id: nuevoId(), tipo: 'texto', align, texto,
  estilo: { cuerpo: { tamano: 12, interlinea: 1.5, color: '$medio' }, caja: { padArriba: 4, padAbajo: 0 } },
} as Bloque);

/** El botón con BORDE (WhatsApp): no compite con «Volver al carrito». */
const botonBorde = (texto: string, url: string): Bloque => ({
  id: nuevoId(), tipo: 'boton', texto, url, align: 'center', full: false,
  estilo: {
    boton: { tamano: 12, peso: 700, espaciado: 2, radio: 4, padY: 14, padX: 30, fondo: BLANCO, color: NEGRO, bordeAncho: 1, bordeEstilo: 'solid', bordeColor: NEGRO },
    caja: { padArriba: 12, padAbajo: 0 },
  },
} as Bloque);

export function armarCarritoZattia(vieja: { contenido: unknown }): MailNuevo[] {
  const enc = leerContenido(vieja.contenido).bloques.find((x) => x.tipo === 'encabezado');
  if (!enc) throw new Error('falta el encabezado (el logo de Zattia) en el mail del que se clona');
  const doc = (bloques: Bloque[]): ContenidoCampania => leerContenido({ v: V_ACTUAL, bloques, tema: TEMA });

  // ── 1 · a la hora: te lo guardamos ─────────────────────────────────────────
  const mail1: Bloque[] = [
    ...cabeceraZattia(enc, (ruta) => utm(ruta, 1, 'menu')),
    volanta('TU CARRITO'),
    titular('Te lo guardamos'),
    // Sin el número de prendas a propósito: «lo que elegiste» vale para una y para seis.
    parrafo('Hola, lo que elegiste quedó en el carrito tal cual lo dejaste. Cuando quieras, seguís desde ahí.'),
    carrito('tienda'),
    nota('${cart.retiro}.'),
    { ...boton('VOLVER AL CARRITO', '${cart.url}'), estilo: { boton: { tamano: 13, peso: 700, espaciado: 2, radio: 4, padY: 15, padX: 30 }, caja: { padArriba: 18, padAbajo: 10 } } } as Bloque,
    banda(GRIS, NEGRO, 32, [
      { ...volanta('¿DUDAS CON EL TALLE?', NEGRO, 20), align: 'center' } as Bloque,
      parrafo('Contanos tus medidas o qué talle usás en otras prendas, y te decimos cuál te queda.', { align: 'center', tamano: 14, padX: 20 }),
      botonBorde('ESCRIBINOS POR WHATSAPP', WA_TALLE),
    ]),
    filete(32),
    {
      id: nuevoId(), tipo: 'columnas', variante: 'textos', movil: 'fila',
      celdas: [
        { imagen: '', url: '', titulo: 'Despacho', texto: 'en ${tienda.plazoDespacho}' },
        { imagen: '', url: '', titulo: 'Cambios', texto: '${tienda.plazoCambio}' },
        // La tercera la decide SU carrito: «Envío gratis · desde $150.000» o «Retiro · en el local».
        { imagen: '', url: '', titulo: '${cart.entrega}', texto: '${cart.entregaDetalle}' },
      ],
      estilo: { titulo: { tamano: 10, peso: 700, mayusculas: true, espaciado: 2, align: 'center' }, cuerpo: { tamano: 12, color: '$medio', align: 'center' }, caja: { padArriba: 4, padAbajo: 0 } },
    } as unknown as Bloque,
    filete(32),
    ...pieZattia(),
  ];

  // ── 2 · 24 h: sigue ahí, por ahora ─────────────────────────────────────────
  const mail2: Bloque[] = [
    ...cabeceraZattia(enc, (ruta) => utm(ruta, 2, 'menu')),
    banda(NEGRO, BLANCO, 16, [
      volanta('TODAVÍA EN TU CARRITO', '#bdbdbd', 20),
      { ...titular('Sigue ahí, por ahora'), estilo: { titulo: { tamano: 20, peso: 400, espaciado: 2, interlinea: 1.2, mayusculas: true }, caja: { padArriba: 6, padAbajo: 0, padX: 20 } } } as Bloque,
      // ⛔ Sin «quedan 2»: no sabemos el stock de su talle. Lo que es cierto es que el
      // carrito no lo aparta.
      parrafo('El carrito guarda lo que elegiste, pero no aparta el stock: si otra persona se lleva tu talle antes, se va. Está a un click.', { color: BLANCO, padX: 20 }),
    ]),
    carrito('galeria'),
    { ...boton('VOLVER AL CARRITO', '${cart.url}'), estilo: { boton: { tamano: 13, peso: 700, espaciado: 2, radio: 4, padY: 15, padX: 30 }, caja: { padArriba: 14, padAbajo: 4 } } } as Bloque,
    // Dos renglones: si es a domicilio, el segundo no tiene dato y se cae solo.
    nota('${cart.cantidad} · ${cart.total}\n${cart.retiro}', 'center'),
    rotulo('¿O buscás otra cosa?', 'Todo new in →', utm(CAT.newIn.ruta, 2, 'rotulo')),
    grilla('destacados'),
    parrafo([
      { t: '¿Dudas con el talle? ' },
      { t: 'Escribinos por WhatsApp', url: WA_TALLE, subrayado: true },
      { t: ' y te ayudamos a elegir.' },
    ], { tamano: 14 }),
    ...pieZattia(),
  ];

  const m = (n: number, nombre: string, esperaHoras: number, asunto: string, preheader: string, contenido: ContenidoCampania): MailNuevo => ({
    nombre: `${PREFIJO_CARRITO_ZATTIA} ${n}/2 — ${nombre}`, esperaHoras, asunto, preheader, contenido, remitenteNombre: null, responderA: null,
  });

  return [
    m(1, 'te lo guardamos', 1, 'Te guardamos tu carrito 🤍', 'Está como lo dejaste. ¿Dudas con el talle? Te ayudamos por WhatsApp.', doc(mail1)),
    m(2, 'sigue ahí', 24, 'Tu carrito sigue ahí, por ahora', 'Guarda lo que elegiste, pero no aparta el stock: si otra se lleva tu talle, se va.', doc(mail2)),
  ];
}
