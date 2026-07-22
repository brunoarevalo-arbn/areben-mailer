// Envía un email de prueba por SES.
// Uso:  node --import tsx --env-file=.env scripts/ses-test.ts [destino]
import { sendEmail } from '../lib/ses/client.ts';

const to = process.argv[2] ?? 'brunoarevalo@arebensrl.com';

const html = `
<!doctype html>
<html><body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#171717">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:32px">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#a3a3a3">Areben Mailer</div>
      <h1 style="margin:8px 0 16px;font-size:22px">¡Funciona! 🎉</h1>
      <p style="line-height:1.5;color:#404040">
        Este es el primer email enviado desde <b>tu propio sistema</b>, por Amazon SES,
        firmado con DKIM desde <b>info@bdiaccesorios.com.ar</b>.
      </p>
      <p style="line-height:1.5;color:#404040">
        Circuito completo probado: base de datos, remitente autenticado y envío. Lo que sigue
        es el editor de campañas y el envío por lotes a tus contactos.
      </p>
      <div style="margin-top:24px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;color:#92400e;font-size:14px">
        Enviado en modo sandbox de SES (a direcciones verificadas). Al salir a producción,
        se habilita el envío a toda la lista.
      </div>
    </div>
    <p style="text-align:center;color:#a3a3a3;font-size:12px;margin-top:16px">
      BDI Accesorios · Santa Fe 1671 · <a href="{{unsub}}" style="color:#a3a3a3">Desuscribirme</a>
    </p>
  </div>
</body></html>`;

async function main() {
  const unsubscribeUrl = 'https://areben-mailer.vercel.app/baja?token=demo';
  const res = await sendEmail({
    to,
    subject: '✅ Prueba de envío — Areben Mailer',
    html: html.replace('{{unsub}}', unsubscribeUrl),
    text: 'Funciona: primer email desde tu propio sistema por Amazon SES (DKIM).',
    unsubscribeUrl,
  });
  console.log(`✅ Enviado a ${to} — MessageId: ${res.messageId}`);
}

main().catch((e) => {
  console.error('❌', e?.name, e?.message);
  process.exit(1);
});
