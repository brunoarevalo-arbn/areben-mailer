// Importa los contactos de la tienda TN conectada.
// Uso:  node --env-file=.env scripts/tn-import.ts
import { importCustomers } from '../lib/tn/import.ts';
import { prisma } from '../lib/prisma.ts';
import { getCuentaActiva } from '../lib/cuenta.ts';

async function main() {
  const cuenta = await getCuentaActiva();
  if (!cuenta.tnStoreId || !cuenta.tnToken) {
    throw new Error('La cuenta no tiene TN conectada. Corré scripts/tn-connect.ts primero.');
  }

  console.log(`Importando contactos de la tienda ${cuenta.tnStoreId}...`);
  const r = await importCustomers(cuenta.id, cuenta.tnStoreId, cuenta.tnToken, (p) => {
    process.stdout.write(`\r  leídos:${p.leidos} importados:${p.importados} sin-email:${p.sinEmail} aceptan-mkt:${p.aceptanMkt}`);
  });
  console.log(
    `\n✅ Import OK — leídos:${r.leidos} importados:${r.importados} sin-email:${r.sinEmail} aceptan-marketing:${r.aceptanMkt}`,
  );
}

main()
  .catch((e) => {
    console.error('\n❌', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
