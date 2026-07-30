// Borra automations por id. Dry-run por default.
//
// `/automations` no tiene borrado: las actions son crear, guardar, toggle y
// probar. Es a propósito —una automation con historial no se borra, se pausa—
// pero deja sin camino el caso de la que nació duplicada y nunca envió nada.
//
// Correr:  node --import tsx --env-file=.env scripts/borrar-automation.ts --id=xxx --id=yyy
//          …--aplicar     para que escriba
//
// ⛔ TRES GUARDAS, y ninguna se puede saltear con un flag:
//   1. Una automation ACTIVA no se borra. Primero se pausa desde la UI, que es
//      lo que da de baja el webhook en Tiendanube. Borrar la fila a mano deja el
//      webhook colgado en TN apuntando a un id que ya no existe.
//   2. Una automation con runs no se borra. `AutomationRun` cuelga de ella y de
//      cada run cuelga un `Envio` — el historial de un mail que ya está en la
//      casilla de otra persona. Las métricas del home salen de ahí.
//   3. Se borra por id explícito, nunca por nombre ni por trigger. El caso que
//      motivó el script es justamente DOS filas con el mismo nombre, el mismo
//      asunto y el mismo trigger: cualquier selector que no sea el id agarra las
//      dos.
import { prisma } from '../lib/prisma.ts';
import { leerContenido } from '../lib/email/esquema.ts';

const ids = process.argv.filter((a) => a.startsWith('--id=')).map((a) => a.slice(5));
const aplicar = process.argv.includes('--aplicar');

async function main() {
  if (!ids.length) {
    console.error('Falta --id=<id>. Se puede repetir.');
    process.exit(1);
  }

  console.log(aplicar ? '⚠️  APLICANDO (borra de verdad)\n' : '🔍 DRY-RUN — nada se borra. Agregá --aplicar.\n');

  let frenadas = 0;
  for (const id of ids) {
    const a = await prisma.automation.findUnique({ where: { id }, include: { cuenta: true } });
    if (!a) {
      console.log(`❌ ${id} — no existe`);
      frenadas++;
      continue;
    }

    const runs = await prisma.automationRun.count({ where: { automationId: id } });
    const envios = await prisma.envio.count({ where: { automationRun: { automationId: id } } });
    const { bloques } = leerContenido(a.contenido);
    console.log(
      `${a.cuenta.slug} · "${a.nombre}" · ${a.trigger} · ${a.estado} · ${bloques.length} bloques · runs:${runs} envios:${envios}`,
    );

    if (a.estado === 'ACTIVO') {
      console.log(`   ⛔ ACTIVA. Pausala desde /automations primero (eso da de baja el webhook en TN).\n`);
      frenadas++;
      continue;
    }
    if (runs > 0 || envios > 0) {
      console.log(`   ⛔ Tiene historial (${runs} runs, ${envios} envíos). No se borra: pausala.\n`);
      frenadas++;
      continue;
    }

    if (aplicar) {
      await prisma.automation.delete({ where: { id } });
      console.log(`   🗑️  BORRADA\n`);
    } else {
      console.log(`   ✓ se borraría\n`);
    }
  }

  if (frenadas) console.log(`${frenadas} frenada(s) por las guardas.`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
