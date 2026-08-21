// El BORRADOR del 2º y del 3er mail de la secuencia de carrito abandonado.
//
// El 1º ya existe en cada marca (lo creó `/automations` y el comerciante lo
// editó). Esto deja los otros dos **armados y PAUSADOS**, con los componentes en
// su lugar, para tener de qué hablar: el texto fino se ajusta después en el
// editor, que es donde vive el documento.
//
// Correr:  node --import tsx --env-file=.env scripts/crear-secuencia-carrito.ts --cuenta=bdi
//          node --import tsx --env-file=.env scripts/crear-secuencia-carrito.ts --cuenta=bdi --dry
//
// 🔴 **Idempotente en el sentido fuerte: NUNCA pisa un mail que ya existe.** Si
//    la marca ya tiene 2 o 3 automations de carrito, las de más se saltean con un
//    `=`. Correrlo de nuevo después de que alguien editó el 3º en el editor no le
//    devuelve este texto — que es lo que arruinaría el trabajo hecho a mano.
//
// ⚠️ Nace todo PAUSADO. Prender es decisión del comerciante y se hace desde
//    `/carrito-abandonado` (Resorty) o desde `/automations`.
import { prisma } from '../lib/prisma.ts';
import { MAX_POR_TRIGGER, nacimientoDelMail, puedeCrearOtra } from '../lib/automations.ts';
import { presetDeTrigger } from '../lib/plantillas/presets.ts';
import { getRemitenteEnvio } from '../lib/remitentes.ts';
import { leerContenido } from '../lib/email/esquema.ts';
import { nuevoId, type Bloque, type ContenidoCampania } from '../lib/email/bloques.ts';
import { V_ACTUAL } from '../lib/email/esquema.ts';

const TRIGGER = 'CARRITO_ABANDONADO' as const;
const soloCuenta = process.argv.find((a) => a.startsWith('--cuenta='))?.split('=')[1] ?? 'bdi';
const dry = process.argv.includes('--dry');

/** El gris del pie, el mismo que ya usa el 1er mail de BDI. */
const GRIS = '#6b7280';

/**
 * El botón, con la misma forma que el 1er mail: los colores van en **tokens de
 * marca** (`$texto`, `$tarjeta`) y no en hex, así el mail se repinta solo cuando
 * la marca cambia el tema. Es lo que hace que este mismo borrador sirva para
 * otra tienda sin sacarle un color prestado a BDI.
 */
const boton = (texto: string): Bloque => ({
  id: nuevoId(),
  tipo: 'boton',
  align: 'center',
  texto,
  // `${cart.url}` lo reemplaza el procesador con el link real del checkout, en
  // TODO el HTML y en la versión texto (`app/api/automations/procesar/route.ts`).
  url: '${cart.url}',
  estilo: { boton: { padX: 16, padY: 8, peso: 400, color: '$tarjeta', fondo: '$texto', tamano: 14 } },
});

const divisor = (): Bloque => ({ id: nuevoId(), tipo: 'divisor' });

const rotulo = (texto: string): Bloque => ({
  id: nuevoId(),
  tipo: 'titulo',
  align: 'center',
  texto: [{ t: texto, tamano: 12 }],
});

const pie = (): Bloque => ({
  id: nuevoId(),
  tipo: 'texto',
  align: 'center',
  texto: [{ t: 'Envío a todo el país  ·  Pago seguro  ·  Te contestamos por WhatsApp', tamano: 10 }],
  estilo: { cuerpo: { color: GRIS, tamano: 12 } },
});

/**
 * El link de WhatsApp **se hereda del 1er mail**, nunca se escribe acá.
 *
 * 🔴 Un `wa.me` a mano es el bug de siempre: sin el `9` después del código de
 * país el link abre un chat con un número que no existe
 * (`project_areben_whatsapp_telefono_9`). El del 1er mail ya está bien y ya está
 * probado. Si la marca no tiene ninguno, la frase sale **sin link** en vez de con
 * un número inventado.
 */
function waDelPrimero(bloques: Bloque[]): string | null {
  for (const b of bloques) {
    const t = (b as { texto?: unknown }).texto;
    if (!Array.isArray(t)) continue;
    for (const trozo of t) {
      const url = (trozo as { url?: string }).url;
      if (typeof url === 'string' && url.startsWith('https://wa.me/')) return url;
    }
  }
  return null;
}

/** Un párrafo con una frase linkeada en el medio, o sin ella si no hay link. */
function parrafoConWa(antes: string, ancla: string, despues: string, wa: string | null): Bloque {
  const trozos = wa
    ? [{ t: antes, tamano: 12 }, { t: ancla, url: wa, tamano: 12, subrayado: true }, { t: despues, tamano: 12 }]
    : [{ t: `${antes}${ancla}${despues}`, tamano: 12 }];
  return {
    id: nuevoId(),
    tipo: 'texto',
    align: 'center',
    texto: trozos,
    estilo: { cuerpo: { tamano: 14, interlinea: 1.4 } },
  };
}

/**
 * 🔴 **Ni el asunto ni ningún texto de afuera del bloque `cupon` nombran el
 * descuento**, y no es timidez: `aplicarCuponDeCarrito` **elimina el bloque
 * entero** cuando la perilla está apagada (que es el default de hoy), cuando el
 * escalado no mejora lo que la persona ya tiene, o cuando Tiendanube falla al
 * acuñarlo. El bloque se puede borrar; un asunto que prometió un descuento, no.
 * El mail tiene que seguir teniendo sentido sin el premio.
 */
function borrador(orden: number, wa: string | null): { asunto: string; preheader: string; bloques: Bloque[] } {
  if (orden === 2) {
    return {
      asunto: 'Tu carrito sigue guardado 🛒',
      preheader: 'Está ahí esperándote — lo terminás en un toque',
      bloques: [
        { id: nuevoId(), tipo: 'titulo', align: 'center', texto: [{ t: '${contacto.nombre}, tu carrito sigue ahí 👀', tamano: 16 }] },
        parrafoConWa(
          'Guardamos lo que elegiste. Si te quedó una duda con el talle, el color o el envío, ',
          'escribinos por WhatsApp',
          ' y lo vemos juntos.',
          wa,
        ),
        divisor(),
        rotulo('ESTO ES LO QUE DEJASTE'),
        divisor(),
        // El bloque `carrito` va ENTRE el texto que lo anuncia y el botón: sin él
        // el procesador lo appendea al final, después del CTA.
        { id: nuevoId(), tipo: 'carrito', items: [], estilo: { imagen: { radio: 6 } } },
        divisor(),
        boton('FINALIZAR COMPRA'),
        pie(),
      ],
    };
  }
  return {
    asunto: 'Última llamada para tu carrito 🛒',
    preheader: 'Es el último mail que te mandamos por esto',
    bloques: [
      { id: nuevoId(), tipo: 'titulo', align: 'center', texto: [{ t: 'Última llamada, ${contacto.nombre}', tamano: 16 }] },
      parrafoConWa(
        'Es el último mail que te mandamos por este carrito. Si todavía lo querés, está acá abajo — y si preferís, ',
        'escribinos por WhatsApp',
        ' y te damos una mano.',
        wa,
      ),
      // El único bloque `cupon` de la secuencia, y lo que hace que este mail pida
      // uno (`pideCupon()` pregunta exactamente por este tipo de bloque). El
      // `texto` y el `codigo` de acá **se pisan al enviar** con lo que Tiendanube
      // acuñó de verdad; son el placeholder que se ve en el editor.
      {
        id: nuevoId(),
        tipo: 'cupon',
        variante: 'caja',
        texto: 'Tu descuento por volver',
        codigo: 'CARRITO10',
        botonTexto: 'Usar mi descuento',
        botonUrl: '${cart.url}',
      },
      divisor(),
      rotulo('TU CARRITO'),
      divisor(),
      { id: nuevoId(), tipo: 'carrito', items: [], estilo: { imagen: { radio: 6 } } },
      divisor(),
      boton('FINALIZAR COMPRA'),
      pie(),
    ],
  };
}

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug: soloCuenta } });
  if (!cuenta) {
    console.error(`❌ No existe la cuenta "${soloCuenta}".`);
    process.exit(1);
  }
  const existentes = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger: TRIGGER },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`▶ ${cuenta.nombre} (${cuenta.slug}) — ${existentes.length}/${MAX_POR_TRIGGER[TRIGGER]} mails de carrito`);
  if (existentes.length === 0) {
    console.error('❌ No hay un 1er mail. Este script arma la SECUENCIA, no la estrena: creá el primero desde /automations.');
    process.exit(1);
  }

  // El tema y el encabezado salen del 1er mail: el logo que el comerciante ya
  // subió y los colores que ya eligió. Un borrador que llega con otro logo no se
  // lee como el mismo remitente.
  const primero = leerContenido(existentes[0].contenido);
  const encabezado = primero.bloques.find((b) => b.tipo === 'encabezado');
  const wa = waDelPrimero(primero.bloques);
  console.log(`   tema "${primero.tema?.base ?? 'claro'}" · encabezado ${encabezado ? 'heredado' : 'AUSENTE'} · WhatsApp ${wa ?? 'sin link'}`);

  const rem = await getRemitenteEnvio(cuenta.id);
  const p = presetDeTrigger(TRIGGER, cuenta, rem?.email);

  for (const orden of [2, 3]) {
    if (existentes.length >= orden) {
      const ya = existentes[orden - 1];
      console.log(`   = ${orden}º mail ya existe: "${ya.nombre}" (${ya.estado}, ${ya.esperaHoras} h) — no se toca`);
      continue;
    }
    const yaCreadas = await prisma.automation.findMany({
      where: { cuentaId: cuenta.id, trigger: TRIGGER },
      select: { id: true, trigger: true, createdAt: true },
    });
    // La misma guarda que la action de `/automations`, por la misma razón: el
    // tope lo decide `MAX_POR_TRIGGER` y no un número escrito acá.
    if (!puedeCrearOtra(yaCreadas, TRIGGER)) {
      console.log(`   ⛔ ${orden}º mail: la marca ya llegó al tope de ${MAX_POR_TRIGGER[TRIGGER]}`);
      continue;
    }
    // Nombre y espera salen de la MISMA función que usa la UI (3 h → 24 h → 72 h).
    const nace = nacimientoDelMail(orden, p, TRIGGER);
    const b = borrador(orden, wa);
    const contenido: ContenidoCampania = {
      v: V_ACTUAL,
      tema: primero.tema,
      bloques: encabezado ? [encabezado, ...b.bloques] : b.bloques,
    };
    if (dry) {
      console.log(`   ~ ${orden}º mail (dry): "${nace.nombre}" · ${nace.esperaHoras} h · "${b.asunto}" · ${contenido.bloques.length} bloques`);
      continue;
    }
    const a = await prisma.automation.create({
      data: {
        cuentaId: cuenta.id,
        nombre: nace.nombre,
        trigger: TRIGGER,
        esperaHoras: nace.esperaHoras,
        asunto: b.asunto,
        preheader: b.preheader,
        contenido: contenido as object,
      },
    });
    console.log(`   + ${orden}º mail creado: "${nace.nombre}" · ${nace.esperaHoras} h · "${b.asunto}" · ${contenido.bloques.length} bloques · ${a.id}`);
  }

  console.log('\nQuedan PAUSADOS. Se prenden desde /carrito-abandonado (Resorty) o desde /automations.');
  console.log('⚠️ El 3º lleva bloque `cupon`: sin la perilla del descuento prendida en /carrito-abandonado, ese bloque se elimina al enviar y el mail sale sin premio.');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
