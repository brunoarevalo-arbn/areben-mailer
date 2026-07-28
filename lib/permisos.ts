// Matriz de permisos. Única fuente de verdad de "quién puede qué".
//
// ⚠️ Este archivo lo importan el SERVIDOR y el CLIENTE. Por eso es puro: sin
// `server-only`, sin prisma, sin next/headers. Si alguien mete un import de
// prisma acá, rompe el build del cliente entero.
//
// Que la UI y las server actions lean la MISMA función es lo que evita el bug
// clásico de permisos: un botón visible que después tira 403, o —peor— uno
// escondido sobre una action que en realidad no valida nada.

export type Rol = 'ADMIN' | 'EDITOR' | 'VIEWER';

export type Permiso =
  | 'ver' // leer el panel de la marca activa
  | 'editar' // CRUD de contenido y audiencia
  | 'probar' // mandar una prueba a UN destinatario
  | 'enviar' // envío masivo, o encender una automation
  | 'integrar' // Tiendanube: sincronizar, registrar webhooks
  | 'remitentes' // identidad de envío del dominio
  | 'usuarios'; // alta, baja y rol del equipo

const MATRIZ: Record<Rol, Permiso[]> = {
  ADMIN: ['ver', 'editar', 'probar', 'enviar', 'integrar', 'remitentes', 'usuarios'],
  EDITOR: ['ver', 'editar', 'probar'],
  VIEWER: ['ver'],
};

export function puede(rol: Rol | string | null | undefined, p: Permiso): boolean {
  if (!rol || !(rol in MATRIZ)) return false;
  return MATRIZ[rol as Rol].includes(p);
}

export const ROL_LABEL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  EDITOR: 'Editor',
  VIEWER: 'Lectura',
};

export const ROL_DESCRIPCION: Record<Rol, string> = {
  ADMIN: 'Puede todo, incluido enviar campañas y administrar el equipo.',
  EDITOR: 'Arma campañas, contactos y automations. No puede enviar.',
  VIEWER: 'Solo mira. No puede modificar nada.',
};

/** Copy que se le muestra a quien no tiene el permiso. Sirve de tooltip y de error. */
export const MOTIVO: Record<Permiso, string> = {
  ver: 'No tenés acceso a esta sección.',
  editar: 'Tu usuario es de solo lectura.',
  probar: 'Tu usuario es de solo lectura.',
  enviar: 'Solo un administrador puede enviar a la lista.',
  integrar: 'Solo un administrador puede tocar la conexión con Tiendanube.',
  remitentes: 'Solo un administrador puede administrar los remitentes.',
  usuarios: 'Solo un administrador puede administrar el equipo.',
};
