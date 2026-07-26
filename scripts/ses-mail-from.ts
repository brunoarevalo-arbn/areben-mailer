// Configura un Custom MAIL FROM en SES para un dominio, y muestra los registros
// DNS que hay que cargar en Cloudflare.
//
// POR QUÉ IMPORTA (se descubrió el 26-jul-2026 con un ensayo real): sin esto, el
// remitente del sobre —el que mira SPF— es `amazonses.com`, no el dominio propio.
// SPF pasa, pero NO alinea con el From:, así que DMARC se sostiene solo con DKIM.
// A Gmail le alcanza; Outlook/Hotmail lo mandó a "no deseado".
//
// Con un MAIL FROM propio (mail.<dominio>) el sobre pasa a ser del dominio, SPF
// alinea, y quedan las dos patas —SPF y DKIM— en vez de una.
//
// Correr:
//   node --env-file=.env --import tsx scripts/ses-mail-from.ts <dominio>            (muestra qué haría)
//   node --env-file=.env --import tsx scripts/ses-mail-from.ts <dominio> --aplicar  (lo configura en SES)
//
// Es seguro aplicarlo ANTES de cargar el DNS: queda en BehaviorOnMxFailure =
// USE_DEFAULT_VALUE, así que mientras falte el MX, SES vuelve solo al remitente
// de siempre y no se corta ningún envío.
import {
  SESv2Client,
  GetEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
} from '@aws-sdk/client-sesv2';

const REGION = process.env.AWS_REGION ?? 'us-east-1';
const ses = new SESv2Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function main() {
  const dominio = process.argv[2];
  const aplicar = process.argv.includes('--aplicar');
  if (!dominio || dominio.startsWith('--')) throw new Error('Pasá el dominio: scripts/ses-mail-from.ts <dominio> [--aplicar]');

  const sub = `mail.${dominio}`;

  const antes = await ses.send(new GetEmailIdentityCommand({ EmailIdentity: dominio }));
  console.log(`\n${dominio} · MAIL FROM actual: ${antes.MailFromAttributes?.MailFromDomain ?? '(ninguno — usa amazonses.com)'}`);

  if (aplicar) {
    await ses.send(
      new PutEmailIdentityMailFromAttributesCommand({
        EmailIdentity: dominio,
        MailFromDomain: sub,
        BehaviorOnMxFailure: 'USE_DEFAULT_VALUE', // sin DNS, vuelve al default: no rompe nada
      }),
    );
    console.log(`✓ Configurado en SES: ${sub}`);
  } else {
    console.log(`(simulación — agregá --aplicar para configurarlo en SES)`);
  }

  console.log(`\n=== DNS a cargar en Cloudflare para ${sub} (nube GRIS / DNS-only) ===\n`);
  console.log(`  [1] Tipo: MX`);
  console.log(`      Name:     ${sub}`);
  console.log(`      Value:    feedback-smtp.${REGION}.amazonses.com`);
  console.log(`      Priority: 10\n`);
  console.log(`  [2] Tipo: TXT`);
  console.log(`      Name:     ${sub}`);
  console.log(`      Value:    v=spf1 include:amazonses.com ~all\n`);
  console.log(`⚠️  El TXT va en el SUBDOMINIO ${sub}, no en ${dominio}.`);
  console.log(`   No hay que tocar el SPF de ${dominio} (el de Zoho sigue igual).\n`);
  console.log(`   Verificar después (tarda unos minutos):`);
  console.log(`     node --env-file=.env --import tsx scripts/ses-mail-from.ts ${dominio}\n`);

  const despues = await ses.send(new GetEmailIdentityCommand({ EmailIdentity: dominio }));
  const st = despues.MailFromAttributes?.MailFromDomainStatus;
  if (st) console.log(`   Estado del MAIL FROM en SES: ${st}  ${st === 'SUCCESS' ? '✅' : '⏳ (falta el DNS o todavía no propagó)'}\n`);
}

main().catch((e) => {
  console.error(`\n❌ ${e instanceof Error ? e.message : e}\n`);
  process.exitCode = 1;
});
