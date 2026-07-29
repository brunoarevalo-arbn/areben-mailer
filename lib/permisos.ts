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
  | 'usuarios' // alta, baja y rol del equipo
  /**
   * Los controles finos del diseño del mail: interlínea, espaciado entre letras,
   * grosores, bordes, ocultar en celular.
   *
   * Es el único permiso que no protege un dato: no hay action detrás, gatea
   * pantalla. Aun así vive acá y **no en `localStorage`**, que es donde el
   * instinto lo pondría. Dos razones: `localStorage` es preferencia de un
   * navegador —la misma persona en otra máquina ve otra cosa— y sobre todo, un
   * toggle de navegador no sirve para empaquetar planes ni para bajarle el costo
   * de soporte a un comerciante que no tiene por qué ver el panel completo.
   *
   * Dentro del nivel que a cada uno le toca, la posición del acordeón sí puede
   * ir a `localStorage`: eso sí es preferencia.
   */
  | 'avanzado';

const MATRIZ: Record<Rol, Permiso[]> = {
  ADMIN: ['ver', 'editar', 'probar', 'enviar', 'integrar', 'remitentes', 'usuarios', 'avanzado'],
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
  avanzado: 'Los controles finos de diseño los ve un administrador.',
};
