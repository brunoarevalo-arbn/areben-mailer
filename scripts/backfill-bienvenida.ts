// Encola la bienvenida para los leads de pop-up que quedaron sin ella.
//
// Al 30-jul-2026 eran 197 contactos —175 de BDI, 22 de Zattia— capturados por
// Resorty que nunca recibieron un solo mail: el único camino que creaba un
// AutomationRun era el webhook `customer/created` de Tiendanube, y un lead de
// pop-up no crea un cliente en TN. Desde ahora los leads NUEVOS los encola
// Resorty solo (`areben-popups/lib/mailer.ts`); esto es para los de antes.
//
// 🔑 EL CUPÓN VA SI TODAVÍA SIRVE, y esa es la única regla (3-ago-2026). Antes
//    el script mandaba SIEMPRE sin cupón, sobre la premisa de que a esta altura
//    los códigos ya vencieron. Es cierto en BDI —24 h de validez— y **falso en
//    Zattia**, donde duran 7 días: el 3-ago los 28 leads pendientes tenían sus 28
//    códigos vivos en Tiendanube. Un mail de bienvenida sin el premio que la
//    persona ganó es peor que no mandarlo.
//
//    El código de cada lead está en `PopupEvento.cupon` (base compartida con
//    areben-popups; se lee por SQL crudo porque el schema del mailer no tiene esa
//    tabla, igual que `dispararBienvenida()` escribe `AutomationRun` desde allá).
//
// 🔴 NINGÚN MAIL SALE CON UN CÓDIGO MUERTO. Antes de encolar se le pregunta a TN
//    por los cupones de verdad y se descarta el que esté vencido, dado de baja o
//    con los usos agotados (`used >= max_uses`) — medido: de los 28 de Zattia hay
//    uno ya canjeado, y ese tiene que salir SIN bloque. Al lead sin código
//    utilizable el run le va sin `cupon` y el procesador **elimina** el bloque
//    (lib/email/cupon-trigger.ts), que es el comportamiento viejo. O sea: la
//    novedad no es "ahora manda cupón", es "manda el que sirve y solo ese".
//
// ⚠️ Si TN no contesta, no se adivina: se corta. Encolar 28 mails suponiendo que
//    los códigos están vivos es exactamente lo que este chequeo existe para no
//    hacer.
//
// 🔴 EL GATE TIENE QUE ESTAR EN `real` ANTES DE CORRER ESTO. Con el gate cerrado
//    o en `ensayo`, `procesarLote` marca cada run como ENVIADO/"dry-run" y se
//    consume SIN MANDAR NADA Y SIN REINTENTO. Mirá /envio primero.
//
// Correr:  node --import tsx --env-file=.env scripts/backfill-bienvenida.ts --marca=bdi
//          node --import tsx --env-file=.env scripts/backfill-bienvenida.ts --marca=bdi --aplicar
//
// Idempotente: un contacto que ya tuvo un run de esa automation se saltea, así
// que correrlo dos veces no manda dos mails.
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.ts';
import { tnGet } from '../lib/tn/client.ts';

const marca = process.argv.find((a) => a.startsWith('--marca='))?.split('=')[1];
// Dry-run por default: esto encola mails a gente real. Se pide el opuesto.
const aplicar = process.argv.includes('--aplicar');
// Escotilla: encolar sin cupón aunque los códigos sirvan (el comportamiento
// viejo). No es el default porque tirar un premio vivo a la basura tiene que ser
// una decisión escrita, no lo que pasa si no se piensa.
const sinCupon = process.argv.includes('--sin-cupon');

/** Lo que TN devuelve de un cupón. `max_uses` null = sin límite. */
interface CuponTN {
  code: string;
  valid: boolean;
  used: number | null;
  max_uses: number | null;
  end_date: string | null;
}

/**
 * Los cupones que la tienda tiene HOY, indexados por código en mayúsculas.
 *
 * 🔑 Se pide con `created_at_min` y no completo: BDI tiene miles de cupones del
 * comerciante y traerlos todos son decenas de páginas. La ventana arranca un día
 * antes del lead más viejo, así que no puede dejar afuera uno de los nuestros.
 */
async function cuponesDeLaTienda(storeId: string, token: string, desde: Date) {
  const out = new Map<string, CuponTN>();
  for (let page = 1; page <= 10; page++) {
    const { data } = await tnGet<CuponTN[]>(storeId, token, 'coupons', {
      per_page: 200,
      page,
      fields: 'code,valid,used,max_uses,end_date',
      created_at_min: desde.toISOString(),
    });
    if (!Array.isArray(data)) break;
    for (const c of data) if (c.code) out.set(String(c.code).toUpperCase(), c);
    if (data.length < 200) break;
  }
  return out;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
/** "2026-08-05" → "5 de agosto". Sin `toLocaleDateString`: en Node el ICU no está garantizado. */
function fechaLarga(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)} de ${MESES[Number(m) - 1] ?? m}`;
}

/** `null` si el código no sirve para mandarlo, con el motivo para el log. */
function porQueNoSirve(c: CuponTN | undefined, hoy: Date): string | null {
  if (!c) return 'no existe en TN';
  if (c.valid === false) return 'dado de baja en TN';
  // Comparado contra el FIN del día: `end_date` es una fecha sin hora y un cupón
  // que vence hoy todavía se puede usar hoy.
  if (c.end_date && new Date(`${c.end_date}T23:59:59Z`) < hoy) return `venció el ${c.end_date}`;
  if (c.max_uses != null && Number(c.used ?? 0) >= c.max_uses) return 'usos agotados';
  return null;
}

async function main() {
  if (!marca) {
    console.error('❌ Falta --marca=<slug>. Se hace de a una marca: BDI y Zattia no comparten proveedor verificado.');
    process.exit(1);
  }

  const cuenta = await prisma.cuenta.findFirst({ where: { slug: marca } });
  if (!cuenta) {
    console.error(`❌ No existe la cuenta "${marca}".`);
    process.exit(1);
  }

  // Se exige `asunto` porque el procesador saltea el run que no lo tenga: sin
  // esto encolaríamos runs que nacen muertos.
  // Los dos triggers, igual que `dispararBienvenida()` en areben-popups: si acá
  // mirara uno solo, el backfill y el camino en vivo encolarían cosas distintas
  // para el mismo lead.
  const autos = await prisma.automation.findMany({
    where: {
      cuentaId: cuenta.id,
      trigger: { in: ['NUEVO_CLIENTE', 'NUEVO_SUSCRIPTOR'] },
      estado: 'ACTIVO',
      asunto: { not: null },
    },
  });

  console.log(`\n▶ ${cuenta.nombre} — ${autos.length} bienvenida(s) ACTIVA(s)`);
  if (autos.length === 0) {
    console.log('   Nada que encolar: prendé la bienvenida desde /automations primero.');
    console.log('   ⚠️ Si hay más de una activa, cada lead recibe un mail por cada una.');
    return;
  }
  if (autos.length > 1) {
    console.log(`   ⚠️ HAY ${autos.length} ACTIVAS: cada lead va a recibir ${autos.length} mails.`);
    for (const a of autos) console.log(`      · ${a.id} — "${a.asunto}"`);
  }

  // Los mismos filtros que aplica el procesador antes de mandar (estado y
  // consentimiento), para no encolar runs que va a saltear igual.
  const leads = await prisma.contacto.findMany({
    where: { cuentaId: cuenta.id, source: 'popup', estado: 'ACTIVO', tnAcceptsMkt: true },
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`   ${leads.length} leads de pop-up mandables`);

  // ── El cupón de cada lead ────────────────────────────────────────────────
  // Se resuelve ANTES del loop de encolado: una consulta y una llamada a TN
  // para todos, en vez de dos por persona.
  const cupones = new Map<string, { cupon: string; campaniaId: string; vence: string }>();
  if (!sinCupon && leads.length) {
    // 🔴 SQL crudo: `PopupEvento` es de areben-popups y el schema del mailer no
    // la declara, aunque la base sea la misma. El `DISTINCT ON` deja el PRIMER
    // código de cada mail: si alguien volvió a abrir el pop-up, el que le
    // mostramos en su momento es el primero.
    const filas = await prisma.$queryRaw<
      { email: string; cupon: string; campaniaId: string; createdAt: Date; cuponConfig: unknown }[]
    >`
      SELECT DISTINCT ON (e.email)
             e.email, e.cupon, e."campaniaId", e."createdAt", c."cuponConfig"
      FROM "PopupEvento" e
      JOIN "PopupCampania" c ON c.id = e."campaniaId"
      WHERE c."cuentaId" = ${cuenta.id}
        AND e.cupon IS NOT NULL
        AND e.email = ANY(${leads.map((l) => l.email)}::text[])
      ORDER BY e.email, e."createdAt" ASC`;

    const desde = filas.reduce<Date>(
      (min, f) => (f.createdAt < min ? f.createdAt : min),
      filas[0]?.createdAt ?? new Date(),
    );
    // Un día de colchón: `created_at_min` filtra por el alta en TN, que puede
    // caer minutos después del evento del pop-up y de otro lado del huso.
    desde.setDate(desde.getDate() - 1);

    if (!cuenta.tnStoreId || !cuenta.tnToken) {
      console.error('❌ La cuenta no tiene tienda conectada: no se puede verificar ni un cupón.');
      console.error('   Corré con --sin-cupon si querés mandar la bienvenida pelada igual.');
      process.exit(1);
    }
    let deTN: Map<string, CuponTN>;
    try {
      deTN = await cuponesDeLaTienda(cuenta.tnStoreId, cuenta.tnToken, desde);
    } catch (e) {
      // ⚠️ Corta. Con TN caída no se sabe si los códigos viven, y encolar a
      // ciegas es mandar códigos muertos a gente que no los va a poder usar.
      console.error('❌ Tiendanube no contestó, así que no se sabe qué cupón sirve:', e);
      console.error('   Volvé a intentar, o corré con --sin-cupon para mandar sin el bloque.');
      process.exit(1);
    }
    console.log(`   ${deTN.size} cupones traídos de TN desde ${desde.toISOString().slice(0, 10)}`);

    const hoy = new Date();
    const motivos = new Map<string, number>();
    for (const f of filas) {
      const c = deTN.get(f.cupon.toUpperCase());
      const no = porQueNoSirve(c, hoy);
      if (no) {
        motivos.set(no, (motivos.get(no) ?? 0) + 1);
        continue;
      }
      cupones.set(f.email, { cupon: f.cupon, campaniaId: f.campaniaId, vence: c!.end_date ?? '' });
    }
    console.log(`   ${cupones.size} con cupón VIVO · ${filas.length - cupones.size} descartados`);
    for (const [m, n] of motivos) console.log(`      · ${n} ${m} ⇒ van sin bloque de cupón`);
    if (leads.length > filas.length) {
      console.log(`      · ${leads.length - filas.length} sin código guardado ⇒ van sin bloque de cupón`);
    }
  }

  let encolados = 0, yaTenian = 0, conCupon = 0, sinCodigo = 0;
  for (const a of autos) {
    for (const lead of leads) {
      // Una bienvenida es una sola vez en la vida: se mira si hubo ALGÚN run,
      // sin ventana de días. Mismo criterio que usa Resorty al disparar.
      const ya = await prisma.automationRun.findFirst({
        where: { automationId: a.id, contactoId: lead.id },
        select: { id: true },
      });
      if (ya) { yaTenian++; continue; }

      const cup = cupones.get(lead.email);

      // 🔴 **Sin cupón utilizable NO se manda**, y esto se descubrió mirando el
      // render, no leyendo el código: el cuerpo de la bienvenida dice *"Tu
      // código está acá abajo"*, y cuando `aplicarCuponDelTrigger` elimina el
      // bloque esa frase queda apuntando a un cupón que no existe. El mail no
      // sale mal por el bloque que falta: sale mal por el párrafo que se quedó.
      // A quien ya canjeó su código, no mandarle nada es mejor que mandarle eso.
      //
      // ⚠️ `probar-bienvenida.ts` no lo agarra ni lo va a agarrar: fija que el
      // bloque se va, que es cierto. Lo que nadie puede fijar desde el motor es
      // si el COPY de una plantilla —que edita el comerciante— promete algo.
      // Por eso es una guarda del backfill y no una regla del renderer.
      //
      // `--sin-cupon` la apaga: es para una plantilla cuyo texto no prometa
      // ningún código.
      if (!cup && !sinCupon) { sinCodigo++; continue; }
      // Misma forma que arma `dispararBienvenida()` en areben-popups: si acá
      // fuera distinta, el mismo lead saldría con un mail distinto según por
      // qué camino se encoló.
      //
      // 🔑 `condiciones` lleva la fecha REAL de vencimiento y no la validez
      // nominal. En el camino en vivo da igual —el mail sale al toque— pero acá
      // el cupón nació hace días: decir "válido 7 días" sería mentir, y la
      // persona necesita saber cuánto le queda, que es lo único que cambió.
      //
      // `origen:'popup'` sin `cupon` es lo que le dice al procesador que saque
      // el bloque en vez de mandar el placeholder de la plantilla.
      const triggerData = {
        origen: 'popup',
        backfill: true,
        campaniaId: cup?.campaniaId ?? null,
        cupon: cup?.cupon ?? null,
        vence: cup?.vence || null,
        condiciones: cup?.vence ? `válido hasta el ${fechaLarga(cup.vence)}` : null,
        prizeLabel: null,
      };

      if (aplicar) {
        await prisma.automationRun.create({
          data: {
            id: randomUUID(),
            automationId: a.id,
            contactoId: lead.id,
            proximoAt: new Date(Date.now() + a.esperaHoras * 3600000),
            triggerData,
          },
        });
      } else if (encolados < 5) {
        console.log(`      ${lead.email} → ${cup ? `${cup.cupon} (vence ${cup.vence})` : 'SIN cupón'}`);
      }
      encolados++;
      if (cup) conCupon++;
    }
  }

  console.log(`\n   ${aplicar ? 'Encolados' : 'Se encolarían'}: ${encolados}`);
  console.log(`   Con cupón vivo: ${conCupon} · sin bloque de cupón: ${encolados - conCupon}`);
  if (sinCodigo) {
    console.log(`   ⛔ SALTEADOS por no tener cupón utilizable: ${sinCodigo}`);
    console.log('      (el cuerpo del mail dice "tu código está acá abajo" — sin bloque queda colgado).');
    console.log('      Si la plantilla no promete ningún código, corré con --sin-cupon.');
  }
  if (yaTenian) console.log(`   Ya tenían run (salteados): ${yaTenian}`);
  if (!aplicar) {
    console.log('\n   DRY-RUN. Para aplicarlo de verdad: --aplicar');
    console.log('   Antes: confirmá en /envio que el gate dice `real`, o los runs se queman.');
  } else {
    // El cron procesa de a 30 runs (BATCH en app/api/automations/procesar), así
    // que 175 leads tardan unas 3 corridas ≈ 45 min en salir todos.
    console.log(`\n   Salen de a 30 por corrida del cron (cada 15 min): ~${Math.ceil(encolados / 30)} corrida(s).`);
  }
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
