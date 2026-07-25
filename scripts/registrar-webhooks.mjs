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
const PROD = 'https://areben-mailer.vercel.app';
// El .env local apunta a localhost: Tiendanube tiene que poder llegar, así que
// se usa la URL pública salvo que se pase otra con --url=...
const urlArg = process.argv.find((a) => a.startsWith('--url='))?.slice(6);
const envUrl = process.env.APP_URL;
const APP_URL = (urlArg || (envUrl && !/localhost|127\.0\.0\.1/.test(envUrl) ? envUrl : PROD)).replace(/\/$/, '');
const API = 'https://api.tiendanube.com/v1';
const UA = 'Areben Mailer (brunoarevalo@arebensrl.com)';

// Solo estos se pueden dar de alta por API (`POST /webhooks`).
const EVENTOS = {
  'app/uninstalled': `${APP_URL}/api/tn/webhooks/app-uninstalled`,
};

// Los 3 de LGPD NO son creables por API: devuelven 422 "The selected event is
// invalid". Según la documentación, Tiendanube los envía a los partners por su
// cuenta. Queda por confirmar con socios@tiendanube.com a qué URL los manda y
// dónde se declara — nuestros endpoints ya están listos y esperando:
const AUTOMATICOS = {
  'store/redact': `${APP_URL}/api/tn/webhooks/store-redact`,
  'customers/redact': `${APP_URL}/api/tn/webhooks/customers-redact`,
  'customers/data_request': `${APP_URL}/api/tn/webhooks/customers-data-request`,
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

console.log('\nLos 3 webhooks de LGPD no se dan de alta por API: Tiendanube los envía');
console.log('por su cuenta. Nuestros endpoints ya están publicados y verifican firma:');
for (const [evento, url] of Object.entries(AUTOMATICOS)) console.log(`   ${evento.padEnd(24)} → ${url}`);
console.log('\nPendiente: confirmar con socios@tiendanube.com a qué URL los envían.');
