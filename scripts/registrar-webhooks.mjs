// Registra en Tiendanube los webhooks obligatorios de cada tienda conectada.
//
// Los 3 de LGPD (store/redact, customers/redact, customers/data_request) + el de
// desinstalación son requisito para publicar la app en la App Store.
//
// Uso:
//   node scripts/registrar-webhooks.mjs            → muestra qué hay y qué faltaría (dry run)
//   node scripts/registrar-webhooks.mjs --aplicar  → crea los que falten

import 'dotenv/config';
import pg from 'pg';

const APLICAR = process.argv.includes('--aplicar');
const APP_URL = (process.env.APP_URL || 'https://areben-mailer.vercel.app').replace(/\/$/, '');
const API = 'https://api.tiendanube.com/v1';
const UA = 'Areben Mailer (brunoarevalo@arebensrl.com)';

const EVENTOS = {
  'store/redact': `${APP_URL}/api/tn/webhooks/store-redact`,
  'customers/redact': `${APP_URL}/api/tn/webhooks/customers-redact`,
  'customers/data_request': `${APP_URL}/api/tn/webhooks/customers-data-request`,
  'app/uninstalled': `${APP_URL}/api/tn/webhooks/app-uninstalled`,
};

const tn = (storeId, token, path, init = {}) =>
  fetch(`${API}/${storeId}/${path}`, {
    ...init,
    headers: {
      Authentication: `bearer ${token}`,
      'User-Agent': UA,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const { rows: cuentas } = await client.query(
  'select nombre, "tnStoreId", "tnToken" from "Cuenta" where "tnToken" is not null and "tnStoreId" is not null order by nombre',
);
await client.end();

console.log(`Modo: ${APLICAR ? 'APLICAR (crea los que falten)' : 'dry run (no cambia nada)'}`);
console.log(`Destino: ${APP_URL}\n`);

for (const cuenta of cuentas) {
  console.log(`── ${cuenta.nombre} (store ${cuenta.tnStoreId})`);
  const res = await tn(cuenta.tnStoreId, cuenta.tnToken, 'webhooks');
  if (!res.ok) {
    console.log(`   ⚠️  no se pudieron leer los webhooks: HTTP ${res.status}`);
    continue;
  }
  const existentes = await res.json();

  for (const [evento, url] of Object.entries(EVENTOS)) {
    const ya = existentes.find((w) => w.event === evento);
    if (ya && ya.url === url) {
      console.log(`   ✅ ${evento}`);
      continue;
    }
    if (ya) {
      console.log(`   ⚠️  ${evento} apunta a otra URL: ${ya.url}`);
      continue;
    }
    if (!APLICAR) {
      console.log(`   ➕ faltaría: ${evento}`);
      continue;
    }
    const alta = await tn(cuenta.tnStoreId, cuenta.tnToken, 'webhooks', {
      method: 'POST',
      body: JSON.stringify({ event: evento, url }),
    });
    console.log(alta.ok ? `   ✅ creado: ${evento}` : `   ❌ ${evento}: HTTP ${alta.status} ${await alta.text()}`);
  }
}
