// Chequeo del selector de proveedor de envío.
// Uso: node --import tsx --env-file=.env scripts/proveedor-check.ts
import { getProveedor, sendEmail } from '../lib/email/enviar.ts';

async function main() {
  for (const p of ['', 'ses', 'resend', 'sendgrid', 'inventado']) {
    if (p) process.env.EMAIL_PROVIDER = p; else delete process.env.EMAIL_PROVIDER;
    try {
      console.log(`EMAIL_PROVIDER=${p || '(vacío)'} → ${getProveedor().nombre}`);
    } catch (e) {
      console.log(`EMAIL_PROVIDER=${p} → error: ${(e as Error).message}`);
    }
  }
  // Sin API key, el proveedor debe fallar claro y no romper el proceso.
  process.env.EMAIL_PROVIDER = 'resend';
  await sendEmail({ to: 'x@example.com', subject: 't', html: '<p>t</p>' })
    .catch((e) => console.log(`sin key → ${(e as Error).message}`));
}
main();
