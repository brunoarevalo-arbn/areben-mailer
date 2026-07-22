// Importa los contactos de la tienda TN conectada.
// Uso:  node --env-file=.env scripts/tn-import.ts [slug-marca]   (default: bdi)
import { importCustomers } from '../lib/tn/import.ts';
import { prisma } from '../lib/prisma.ts';
import { getCuentaBySlug } from '../lib/cuenta.ts';

async function main() {
  const slug = process.argv[2] ?? 'bdi';
  const cuenta = await getCuentaBySlug(slug);
  if (!cuenta.tnStoreId || !cuenta.tnToken) {
    throw new Error('La cuenta no tiene TN conectada. Corré scripts/tn-connect.ts primero.');
  }

  console.log(`Importando contactos de la tienda ${cuenta.tnStoreId}...`);
  const r = await importCustomers(cuenta.id, cuenta.tnStoreId, cuenta.tnToken, (leidos) => {
    console.log(`  leídos de TN: ${leidos}`);
  });
  console.log(
    `✅ Import OK — leídos:${r.leidos} nuevos:${r.importados} sin-email:${r.sinEmail} duplicados:${r.duplicados} aceptan-marketing:${r.aceptanMkt}`,
  );
}

main()
  .catch((e) => {
    console.error('\n❌', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
