// Verifica DIRECCIONES sueltas como identidad en SES (no dominios: para eso está
// ses-verify-domain.ts). Sirve para habilitar casillas propias como destinatarios
// mientras la cuenta sigue en sandbox, sin tocar el DNS de nadie.
//
// AWS le manda un mail con un link a cada dirección; hasta que no se hace clic,
// el estado queda PENDING y SES sigue rechazando el envío.
//
// Correr:
//   node --env-file=.env --import tsx scripts/ses-verify-email.ts <mail> [<mail>...]
//   node --env-file=.env --import tsx scripts/ses-verify-email.ts --estado
import {
  SESv2Client,
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  ListEmailIdentitiesCommand,
} from '@aws-sdk/client-sesv2';

const ses = new SESv2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/** VERIFIED / PENDING / FAILED, o "(no existe)". */
async function estadoDe(email: string): Promise<string> {
  try {
    const r = await ses.send(new GetEmailIdentityCommand({ EmailIdentity: email }));
    return r.VerifiedForSendingStatus ? 'VERIFIED' : (r.VerificationStatus ?? 'PENDING');
  } catch (e) {
    if ((e as { name?: string }).name === 'NotFoundException') return '(no existe)';
    throw e;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--estado') || args.length === 0) {
    const r = await ses.send(new ListEmailIdentitiesCommand({ PageSize: 50 }));
    console.log('\nIdentidades en SES:\n');
    for (const i of r.EmailIdentities ?? []) {
      const tipo = i.IdentityType === 'DOMAIN' ? 'dominio' : 'dirección';
      console.log(`   ${i.SendingEnabled ? '✅' : '⏳'} ${(i.IdentityName ?? '').padEnd(38)} ${tipo}`);
    }
    console.log('\n   ✅ = puede recibir (y enviar) · ⏳ = falta hacer clic en el mail de AWS\n');
    return;
  }

  for (const email of args) {
    if (!email.includes('@')) throw new Error(`"${email}" no parece una dirección`);
    try {
      await ses.send(new CreateEmailIdentityCommand({ EmailIdentity: email }));
      console.log(`✓ ${email} — AWS le mandó el mail de verificación`);
    } catch (e) {
      if ((e as { name?: string }).name === 'AlreadyExistsException') {
        console.log(`• ${email} — ya existía · estado: ${await estadoDe(email)}`);
      } else {
        throw e;
      }
    }
  }

  console.log(
    '\n⚠️  Hay que abrir cada casilla y hacer clic en el link de "Amazon Web Services".\n' +
      '   El asunto es "Amazon Web Services – Email Address Verification Request".\n' +
      '   Mirar si ya está: node --env-file=.env --import tsx scripts/ses-verify-email.ts --estado\n',
  );
}

main().catch((e) => {
  console.error(`\n❌ ${e instanceof Error ? e.message : e}\n`);
  process.exitCode = 1;
});
