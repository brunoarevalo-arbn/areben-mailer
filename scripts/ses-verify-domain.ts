// Registra un dominio como identidad en SES (Easy DKIM) y muestra los CNAME.
// Correr:  node --env-file=.env scripts/ses-verify-domain.ts <dominio>
import {
  SESv2Client,
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
} from '@aws-sdk/client-sesv2';

const ses = new SESv2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function main() {
  const domain = process.argv[2];
  if (!domain) throw new Error('Pasá el dominio: node --env-file=.env scripts/ses-verify-domain.ts <dominio>');

  let tokens: string[] = [];
  try {
    const res = await ses.send(new CreateEmailIdentityCommand({ EmailIdentity: domain }));
    tokens = res.DkimAttributes?.Tokens ?? [];
    console.log(`✓ Identidad creada en SES: ${domain}`);
  } catch (e) {
    if ((e as { name?: string }).name === 'AlreadyExistsException') {
      const res = await ses.send(new GetEmailIdentityCommand({ EmailIdentity: domain }));
      tokens = res.DkimAttributes?.Tokens ?? [];
      console.log(`• La identidad ya existía en SES: ${domain}`);
    } else {
      throw e;
    }
  }

  console.log('\n=== CNAME de DKIM (cargar en Cloudflare, nube GRIS / DNS-only) ===');
  tokens.forEach((t, i) => {
    console.log(`\n[${i + 1}]`);
    console.log(`  Name:  ${t}._domainkey.${domain}`);
    console.log(`  Value: ${t}.dkim.amazonses.com`);
  });
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('ERROR:', (e as Error).message);
    process.exit(1);
  });
