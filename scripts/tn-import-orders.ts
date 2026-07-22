// Trae los pedidos de TN y setea la fecha de última compra (recencia) por contacto.
// Uso:  node --import tsx --env-file=.env scripts/tn-import-orders.ts
import { importOrders } from '../lib/tn/import.ts';
import { prisma } from '../lib/prisma.ts';
import { getCuentaActiva } from '../lib/cuenta.ts';

async function main() {
  const cuenta = await getCuentaActiva();
  if (!cuenta.tnStoreId || !cuenta.tnToken) throw new Error('TN no conectada.');

  console.log(`Trayendo pedidos de la tienda ${cuenta.tnStoreId}...`);
  const r = await importOrders(cuenta.id, cuenta.tnStoreId, cuenta.tnToken, (p) => {
    if (p % 1000 === 0) console.log(`  pedidos leídos: ${p}`);
  });
  console.log(`✅ Pedidos OK — leídos:${r.pedidos} contactos con última compra:${r.clientesActualizados}`);
}

main()
  .catch((e) => { console.error('\n❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
