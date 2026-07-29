// Invariantes del gate de envío: quién recibe según cómo estén las envs.
//
// Es lógica pura (sin base ni red). Existe porque este es el único punto del
// código donde un error no rompe nada visible: manda de más. Con 16.825
// contactos de BDI en la base, "se abrió sin querer" no tiene deshacer.
//
// El caso que motivó el archivo es el primero de la lista: hasta el 29-jul,
// `envioRealHabilitado()` caía a `SES_SANDBOX === 'false'` cuando `ENVIO_REAL`
// no estaba definida. Esa env quedó de la época del sandbox de AWS —que ya no
// existe— y su nombre invitaba a borrarla creyendo que no hacía nada, cuando en
// realidad era lo único que decidía si salían los mails.
//
// Correr:  node --import tsx scripts/probar-gate.ts
import { modoEnvio, destinatarioPermitido, DOMINIO_SIMULADOR } from '../lib/email/proveedor.ts';

const errores: string[] = [];

/** Deja las envs del gate exactamente como pide el caso, sin arrastres. */
function conEnv(envs: Record<string, string | undefined>, fn: () => void) {
  const claves = ['ENVIO_REAL', 'ENVIO_ENSAYO', 'SES_SANDBOX'];
  const previo = Object.fromEntries(claves.map((k) => [k, process.env[k]]));
  for (const k of claves) delete process.env[k];
  for (const [k, v] of Object.entries(envs)) if (v !== undefined) process.env[k] = v;
  try {
    fn();
  } finally {
    for (const k of claves) {
      if (previo[k] === undefined) delete process.env[k];
      else process.env[k] = previo[k]!;
    }
  }
}

function esperar(cond: boolean, msg: string) {
  if (!cond) errores.push(msg);
}

const CASOS: { titulo: string; correr: () => void }[] = [
  {
    titulo: 'SES_SANDBOX ya no abre nada por su cuenta',
    correr: () =>
      conEnv({ SES_SANDBOX: 'false' }, () => {
        esperar(modoEnvio() === 'bloqueado', 'SES_SANDBOX="false" NO debe habilitar el envío real');
        esperar(
          !destinatarioPermitido('alguien@gmail.com'),
          'con el gate bloqueado no se le manda a nadie',
        );
      }),
  },
  {
    titulo: 'sin ninguna env, el default es mudo',
    correr: () =>
      conEnv({}, () => {
        esperar(modoEnvio() === 'bloqueado', 'sin envs el modo debe ser bloqueado');
      }),
  },
  {
    titulo: 'ENVIO_REAL solo abre con el string exacto "true"',
    correr: () => {
      conEnv({ ENVIO_REAL: 'true' }, () =>
        esperar(modoEnvio() === 'real', 'ENVIO_REAL="true" debe habilitar el envío real'),
      );
      for (const v of ['false', 'TRUE', '1', 'sí', '']) {
        conEnv({ ENVIO_REAL: v }, () =>
          esperar(modoEnvio() !== 'real', `ENVIO_REAL=${JSON.stringify(v)} NO debe abrir el gate`),
        );
      }
    },
  },
  {
    titulo: 'ENVIO_ENSAYO deja pasar solo a lo que lista',
    correr: () =>
      conEnv({ ENVIO_ENSAYO: 'qa@bdiaccesorios.com.ar, @zattia.com.ar' }, () => {
        esperar(modoEnvio() === 'ensayo', 'con ENVIO_ENSAYO el modo debe ser ensayo');
        esperar(destinatarioPermitido('qa@bdiaccesorios.com.ar'), 'la dirección exacta debe pasar');
        esperar(destinatarioPermitido('QA@BDIaccesorios.com.ar'), 'la comparación no distingue mayúsculas');
        esperar(destinatarioPermitido('quien.sea@zattia.com.ar'), 'el dominio entero debe pasar');
        esperar(!destinatarioPermitido('otro@bdiaccesorios.com.ar'), 'una casilla no listada NO pasa');
        esperar(!destinatarioPermitido('alguien@gmail.com'), 'un ajeno NO pasa');
        // El caso feo: un dominio que TERMINA en el permitido pero no es él.
        esperar(
          !destinatarioPermitido('victima@nozattia.com.ar'),
          'un dominio que apenas termina igual NO debe pasar',
        );
      }),
  },
  {
    titulo: 'ENVIO_REAL le gana a ENVIO_ENSAYO',
    correr: () =>
      conEnv({ ENVIO_REAL: 'true', ENVIO_ENSAYO: 'qa@bdiaccesorios.com.ar' }, () => {
        esperar(modoEnvio() === 'real', 'con las dos puestas, real gana');
        esperar(destinatarioPermitido('alguien@gmail.com'), 'en real le llega a cualquiera');
      }),
  },
  {
    titulo: 'el simulador de SES pasa en cualquier modo',
    correr: () => {
      for (const envs of [{}, { ENVIO_ENSAYO: 'qa@bdiaccesorios.com.ar' }, { ENVIO_REAL: 'true' }]) {
        conEnv(envs, () =>
          esperar(
            destinatarioPermitido(`bounce@${DOMINIO_SIMULADOR}`),
            'el simulador debe pasar siempre: es un agujero negro, no una persona',
          ),
        );
      }
    },
  },
];

for (const c of CASOS) {
  const antes = errores.length;
  c.correr();
  console.log(`${errores.length === antes ? '✅' : '❌'} ${c.titulo}`);
}

console.log();
if (errores.length) {
  for (const e of errores) console.error(`❌ ${e}`);
  process.exit(1);
}
console.log('✅ Invariantes del gate OK.\n');
