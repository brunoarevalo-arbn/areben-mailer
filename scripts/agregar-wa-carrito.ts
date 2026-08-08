/**
 * Le suma al mail de carrito abandonado un renglón con link a WhatsApp.
 *
 * POR QUÉ. Un carrito se abandona muchas veces por una duda que el mail no
 * contesta: si llega hoy, si entra en la tarjeta, si hay otro talle. El botón
 * manda a la persona de vuelta al checkout con la misma duda. Un `wa.me` la
 * manda a preguntar.
 *
 * 🔑 **Es un `wa.me`, no la API de WhatsApp.** El cliente toca y **él** manda el
 * mensaje: no hay plantilla que aprobar, ni opt-in que juntar, ni costo por
 * mensaje. Y de paso abre la ventana de 24 h en la que se le puede contestar
 * como en un chat normal, desde el mismo celular de siempre.
 *
 * 🔴 **Va como TEXTO con link, no como un segundo botón.** El mail tiene un solo
 * trabajo —volver al carrito— y dos botones del mismo peso lo parten en dos.
 *
 * El número sale del widget de contacto de Resorty (`ModuloConfig`, módulo
 * `contacto`), que es donde cada marca ya lo tiene cargado: una segunda copia
 * acá sería la que queda vieja. Se normaliza con la misma regla que Resorty
 * —con el **9** de los móviles argentinos, sin el cual el link abre una pantalla
 * que no lleva a ninguna conversación.
 *
 *   node --env-file=.env --import tsx scripts/agregar-wa-carrito.ts
 *   node --env-file=.env --import tsx scripts/agregar-wa-carrito.ts --aplicar
 *
 * ⚠️ Escribe `Automation.contenido`, que es el documento ENTERO: se lee, se
 * agrega un bloque y se vuelve a escribir el mismo documento.
 */
import { prisma } from '../lib/prisma.ts';
import { leerContenido } from '../lib/email/esquema.ts';
import { nuevoBloque, type Bloque } from '../lib/email/bloques.ts';

const aplicar = process.argv.includes('--aplicar');

/** Marca de agua para reconocer el bloque y no duplicarlo al re-correr. */
const PREGUNTA = '¿Tenés alguna duda?';

/**
 * El mismo `telefonoWa` de Resorty (`areben-popups/lib/telefono.ts`).
 *
 * 🔴 Está copiado, y eso es deuda anotada: los dos repos comparten la base pero
 * no el código. Si esta regla cambia allá, cambia acá. La alternativa —un módulo
 * compartido— pide un paquete común que hoy no existe, y son doce líneas.
 */
function telefonoWa(telefono: string | null | undefined): string {
  let d = (telefono ?? '').replace(/\D/g, '');
  if (d.length < 8) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = d.replace(/^0(\d{2,4})15(\d+)$/, '$1$2').replace(/^0/, '');
  if (d.startsWith('54')) return d.length >= 12 ? (d.startsWith('549') ? d : `549${d.slice(2)}`) : '';
  if (d.length === 11 && d.startsWith('9')) return `54${d}`;
  return d.length === 10 ? `549${d}` : '';
}

async function main() {
  const autos = await prisma.automation.findMany({
    where: { trigger: 'CARRITO_ABANDONADO' },
    include: { cuenta: { select: { id: true, slug: true, nombre: true } } },
    orderBy: { id: 'asc' },
  });

  let tocadas = 0;
  for (const a of autos) {
    const [mod] = await prisma.$queryRaw<{ telefono: string | null }[]>`
      SELECT config->>'telefono' AS telefono FROM "ModuloConfig"
       WHERE "cuentaId" = ${a.cuenta.id} AND modulo = 'contacto' LIMIT 1`;
    const tel = telefonoWa(mod?.telefono);

    if (!tel) {
      // Sin número no se pone el renglón. Un "Escribinos por WhatsApp" que no
      // abre nada es peor que no ofrecerlo: promete atención y no la da.
      console.log(`- ${a.cuenta.slug.padEnd(9)} sin WhatsApp cargado en Resorty — se saltea`);
      continue;
    }

    const contenido = leerContenido(a.contenido);
    const bloques = contenido?.bloques ?? [];
    if (JSON.stringify(bloques).includes(PREGUNTA)) {
      console.log(`= ${a.cuenta.slug.padEnd(9)} ya lo tiene`);
      continue;
    }

    const url = `https://wa.me/${tel}?text=${encodeURIComponent(
      'Hola, tengo una consulta sobre mi compra',
    )}`;

    // Texto rico: dos trozos, y el link sólo en el segundo. El bloque `texto`
    // acepta `string | Trozo[]`, y un `Trozo` con `url` es la única forma de
    // meter un link adentro de un párrafo sin escribir HTML a mano.
    const renglon = {
      ...nuevoBloque('texto'),
      texto: [
        { t: `${PREGUNTA} ` },
        { t: 'Escribinos por WhatsApp', url, subrayado: true },
        { t: ' y te ayudamos a terminar la compra.' },
      ],
      align: 'center',
      estilo: { tamano: 14 },
    } as unknown as Bloque;

    // Va DESPUÉS del botón: primero el camino principal, y esto como salida
    // para quien no lo va a tomar.
    const nuevos = [...bloques, renglon];

    console.log(`${aplicar ? '+' : '~'} ${a.cuenta.slug.padEnd(9)} wa.me/${tel}`);
    tocadas++;
    if (!aplicar) continue;

    await prisma.automation.update({
      where: { id: a.id },
      data: { contenido: { ...contenido, bloques: nuevos } as never },
    });
  }

  if (!aplicar && tocadas) console.log(`\nDry-run: ${tocadas} para tocar. Volvé a correr con --aplicar.`);
  else if (aplicar) console.log(`\n✅ ${tocadas} automations con el renglón de WhatsApp.`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
