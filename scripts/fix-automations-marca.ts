// Reescribe las automations que quedaron con el texto de OTRA marca.
//
// Los presets vivían hardcodeados con "BDI Accesorios" y su URL, así que toda
// automation creada desde otra cuenta salió saludando en nombre de BDI. Esto lo
// corrige aplicando el preset de la marca dueña.
//
// Solo toca automations **sin runs**: si alguna ya mandó mails, se lista y se
// deja quieta para no pisar contenido que alguien pudo haber editado.
//
// Correr:  node --import tsx --env-file=.env scripts/fix-automations-marca.ts
import { prisma } from '../lib/prisma.ts';
import { presetsPara, urlTiendaDe, type Trigger } from '../lib/automations.ts';
import { getRemitenteEnvio } from '../lib/remitentes.ts';

/** Marcas de agua del preset viejo. */
const RASTROS = ['BDI Accesorios', 'bdiaccesorios.com.ar'];

async function main() {
  const automations = await prisma.automation.findMany({
    include: { cuenta: true, _count: { select: { runs: true } } },
  });

  let corregidas = 0;
  for (const a of automations) {
    const texto = `${a.asunto ?? ''} ${JSON.stringify(a.contenido)}`;
    const tieneRastro = RASTROS.some((r) => texto.includes(r));
    const esDeBdi = a.cuenta.slug === 'bdi';
    if (!tieneRastro || esDeBdi) continue;

    if (a._count.runs > 0) {
      console.log(`   ⏭️  ${a.cuenta.slug}/${a.nombre}: tiene ${a._count.runs} run(s), no se toca`);
      continue;
    }

    const rem = await getRemitenteEnvio(a.cuentaId);
    const preset = presetsPara(a.cuenta.nombre, urlTiendaDe(a.cuenta, rem?.email))[a.trigger as Trigger];
    await prisma.automation.update({
      where: { id: a.id },
      data: { asunto: preset.asunto, contenido: { bloques: preset.bloques } },
    });
    console.log(`   ✅ ${a.cuenta.slug}/${a.nombre} → "${preset.asunto}"`);
    corregidas++;
  }

  console.log(`\n${corregidas} automation(s) corregida(s) de ${automations.length}.`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
