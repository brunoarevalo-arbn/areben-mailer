// Deja las cuatro automations creadas (y PAUSADAS) en cada marca.
//
// Estaban a medias: BDI sin post-compra, Zattia solo con bienvenida, Stunned
// sin nada. Tenerlas creadas no envía nada —el disparo depende de activarlas—
// pero evita que la marca arranque de cero cuando alguien las quiera prender.
//
// ⚠️ Se crean PAUSADAS a propósito. Activar es lo que registra el webhook en
//    Tiendanube, y eso se hace desde la UI para que quede claro quién lo prendió.
//
// Correr:  node --import tsx --env-file=.env scripts/crear-automations-marca.ts
//          node --import tsx --env-file=.env scripts/crear-automations-marca.ts --cuenta=zattia
//
// Idempotente: si la marca ya tiene esa automation, no la duplica ni la pisa.
import { prisma } from '../lib/prisma.ts';
import { type Trigger } from '../lib/automations.ts';
import { presetDeTrigger } from '../lib/plantillas/presets.ts';
import { getRemitenteEnvio } from '../lib/remitentes.ts';

// ⚠️ `NUEVO_SUSCRIPTOR` deja una SEGUNDA bienvenida en la marca, para el público
// del pop-up: saludo que funciona sin nombre y bloque de cupón, que es lo que la
// de `NUEVO_CLIENTE` no puede tener. Nace PAUSADA como el resto. 🔴 Prender las
// dos a la vez le manda DOS mails al mismo lead de pop-up — `dispararBienvenida()`
// encola un run por cada automation activa de los dos triggers.
const TRIGGERS: Trigger[] = ['NUEVO_CLIENTE', 'COMPRA', 'CARRITO_ABANDONADO', 'NUEVO_SUSCRIPTOR'];
const soloCuenta = process.argv.find((a) => a.startsWith('--cuenta='))?.split('=')[1];

async function main() {
  const cuentas = await prisma.cuenta.findMany({
    where: soloCuenta ? { slug: soloCuenta } : { slug: { in: ['bdi', 'zattia', 'stunned'] } },
    orderBy: { slug: 'asc' },
  });

  for (const cuenta of cuentas) {
    const rem = await getRemitenteEnvio(cuenta.id);
    const preset = (t: Trigger) => presetDeTrigger(t, cuenta, rem?.email);
    console.log(`\n▶ ${cuenta.nombre} (${cuenta.slug})${cuenta.tnStoreId ? '' : ' — sin Tiendanube conectada'}`);

    for (const trigger of TRIGGERS) {
      const ya = await prisma.automation.findFirst({ where: { cuentaId: cuenta.id, trigger } });
      if (ya) {
        console.log(`   = ${preset(trigger).nombre.padEnd(24)} ya existe (${ya.estado})`);
        continue;
      }
      const p = preset(trigger);
      await prisma.automation.create({
        data: {
          cuentaId: cuenta.id,
          nombre: p.nombre,
          trigger,
          esperaHoras: p.esperaHoras,
          asunto: p.asunto,
          contenido: p.contenido,
        },
      });
      console.log(`   + ${p.nombre.padEnd(24)} creada · "${p.asunto}"`);
    }
  }

  console.log('\nTodas quedan PAUSADAS. Activalas desde /automations: eso registra el webhook en Tiendanube.');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
