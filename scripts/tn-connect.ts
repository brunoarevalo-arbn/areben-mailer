// Atajo para conectar TN sin server deployado.
// Uso:  node --env-file=.env scripts/tn-connect.ts <code>
// El <code> sale de la URL a la que TN te redirige tras autorizar la app.
import { exchangeCode } from '../lib/tn/client.ts';
import { prisma } from '../lib/prisma.ts';
import { getCuentaActiva } from '../lib/cuenta.ts';

async function main() {
  const code = process.argv[2];
  if (!code) throw new Error('Pasá el code: node --env-file=.env scripts/tn-connect.ts <code>');

  const token = await exchangeCode(code);
  const cuenta = await getCuentaActiva();
  await prisma.cuenta.update({
    where: { id: cuenta.id },
    data: { tnStoreId: token.user_id.toString(), tnToken: token.access_token },
  });
  console.log(`✅ TN conectado — store_id: ${token.user_id} · scope: ${token.scope}`);
}

main()
  .catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
