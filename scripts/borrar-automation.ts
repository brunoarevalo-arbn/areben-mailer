// Borra automations por id. Dry-run por default.
//
// Desde el 2-ago-2026 `/automations` también borra, con **las mismas guardas**:
// las dos primeras viven en `motivoNoBorrable` (`lib/automations.ts`) y las
// comparten la action y este script. La razón de que el script siga existiendo
// es la tercera guarda, que es de acá: borrar de a varias por id explícito.
//
// Correr:  node --import tsx --env-file=.env scripts/borrar-automation.ts --id=xxx --id=yyy
//          …--aplicar     para que escriba
//
// ⛔ TRES GUARDAS, y ninguna se puede saltear con un flag:
//   1 y 2. Las de `motivoNoBorrable`: una ACTIVA no se borra (el webhook de TN
//      quedaría colgado apuntando a un id que no existe) y una con historial
//      tampoco (borrarla y recrearla le vuelve a mandar la bienvenida a quien ya
//      la recibió; encima las métricas del home salen de ahí).
//   3. Se borra por id explícito, nunca por nombre ni por trigger. El caso que
//      motivó el script es justamente DOS filas con el mismo nombre, el mismo
//      asunto y el mismo trigger: cualquier selector que no sea el id agarra las
//      dos.
import { prisma } from '../lib/prisma.ts';
import { leerContenido } from '../lib/email/esquema.ts';
import { motivoNoBorrable } from '../lib/automations.ts';

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

    const motivo = motivoNoBorrable(a, runs, envios);
    if (motivo) {
      console.log(`   ⛔ ${motivo}\n`);
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
