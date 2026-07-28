// Imprime la matriz rol × permiso tal como la aplica el código.
//
// Es lógica pura (sin base ni red): sirve para revisar de un vistazo quién
// puede qué cuando se discuta un caso borde, en vez de leer el if de turno.
//
// Correr:  node --import tsx scripts/probar-permisos.ts
import { puede, ROL_LABEL, ROL_DESCRIPCION, type Permiso, type Rol } from '../lib/permisos.ts';

const ROLES: Rol[] = ['ADMIN', 'EDITOR', 'VIEWER'];
const PERMISOS: Permiso[] = ['ver', 'editar', 'probar', 'enviar', 'integrar', 'remitentes', 'usuarios'];

const ANCHO = 12;
console.log('\n' + ' '.repeat(ANCHO) + ROLES.map((r) => r.padEnd(9)).join(''));
for (const p of PERMISOS) {
  const fila = ROLES.map((r) => (puede(r, p) ? '  ✅     ' : '  —      ')).join('');
  console.log(p.padEnd(ANCHO) + fila);
}

console.log();
for (const r of ROLES) console.log(`${ROL_LABEL[r].padEnd(15)} ${ROL_DESCRIPCION[r]}`);

// Chequeos de invariantes: si alguno falla, la matriz se rompió sin querer.
const errores: string[] = [];
if (puede('EDITOR', 'enviar')) errores.push('EDITOR no debería poder enviar');
if (puede('VIEWER', 'editar')) errores.push('VIEWER no debería poder editar');
if (!puede('ADMIN', 'usuarios')) errores.push('ADMIN debería administrar usuarios');
if (puede('EDITOR', 'remitentes')) errores.push('EDITOR no debería tocar remitentes');
if (puede(null, 'ver')) errores.push('un rol vacío no debería poder nada');

console.log();
if (errores.length) {
  for (const e of errores) console.error(`❌ ${e}`);
  process.exit(1);
}
console.log('✅ Invariantes de la matriz OK.\n');
