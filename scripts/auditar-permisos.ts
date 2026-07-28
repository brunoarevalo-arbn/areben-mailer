// Verifica que TODA server action declare un permiso.
//
// Esta es la red que evita que los permisos se degraden: el día que alguien
// escriba una action nueva y se olvide de autorizarla, esto falla. Sin algo así
// el sistema dura hasta el próximo archivo nuevo — que es exactamente cómo
// terminó la app sin permisos reales la primera vez.
//
// Correr:  node --import tsx scripts/auditar-permisos.ts
// Sale con código 1 si encuentra una action sin autorizar (sirve para CI).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Actions públicas a propósito: login y el opt-in de los formularios. */
const EXENTAS = new Set(['login', 'logout', 'suscribir']);

/** Estos archivos viven bajo (public) y son públicos por diseño. */
const DIRS_PUBLICOS = ['app/(public)'];

function buscar(dir: string, nombre: string, salida: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) buscar(ruta, nombre, salida);
    else if (entrada === nombre) salida.push(ruta);
  }
  return salida;
}

interface Hallazgo {
  archivo: string;
  action: string;
  permiso: string;
}

const filas: Hallazgo[] = [];
const faltantes: Hallazgo[] = [];

for (const archivo of buscar('app', 'actions.ts')) {
  const esPublico = DIRS_PUBLICOS.some((d) => archivo.startsWith(d));
  const src = readFileSync(archivo, 'utf8');

  // Cada export async function y su cuerpo hasta el próximo export (o el final).
  const re = /export async function (\w+)/g;
  const matches = [...src.matchAll(re)];

  for (let i = 0; i < matches.length; i++) {
    const nombre = matches[i][1];
    const desde = matches[i].index!;
    const hasta = i + 1 < matches.length ? matches[i + 1].index! : src.length;
    const cuerpo = src.slice(desde, hasta);

    if (EXENTAS.has(nombre) || esPublico) {
      filas.push({ archivo, action: nombre, permiso: '— público' });
      continue;
    }

    // El orden importa: primero el caso dinámico, porque `chequear(x === "A" ?
    // "enviar" : "editar")` también matchea el patrón simple y reportaría el
    // valor comparado como si fuera el permiso.
    const usaChequeoDinamico = /(?:autorizar|chequear)\([^)]*\?[^)]*:/.test(cuerpo);
    // getAuth() cuenta como autorización: valida sesión y cuenta. Se usa cuando
    // el permiso depende de datos que hay que leer antes (ver toggleAutomation).
    const usaGetAuth = /getAuth\(\)/.test(cuerpo);
    const m = cuerpo.match(/(?:autorizar|chequear)\(\s*["'](\w+)["']/);

    if (usaChequeoDinamico || usaGetAuth) {
      filas.push({ archivo, action: nombre, permiso: 'dinámico' });
    } else if (m) {
      filas.push({ archivo, action: nombre, permiso: m[1] });
    } else {
      const h = { archivo, action: nombre, permiso: '❌ SIN AUTORIZAR' };
      filas.push(h);
      faltantes.push(h);
    }
  }
}

console.table(filas.map((f) => ({ archivo: f.archivo.replace('app/', ''), action: f.action, permiso: f.permiso })));

if (faltantes.length) {
  console.error(`\n❌ ${faltantes.length} action(es) sin autorizar:`);
  for (const f of faltantes) console.error(`   ${f.archivo} → ${f.action}()`);
  console.error('\nAgregales autorizar()/chequear() de @/lib/auth, o sumalas a EXENTAS si son públicas a propósito.');
  process.exit(1);
}

console.log(`\n✅ Las ${filas.length} actions declaran permiso.\n`);
