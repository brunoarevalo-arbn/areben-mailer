import { prisma } from './prisma';
import { getIdentityStatus } from './email/proveedores/ses';
import type { EstadoEnvioMarca } from './email/proveedor';

// El tipo y la redacción viven en `email/proveedor.ts`, que es puro: acá se
// importa prisma, y un script de invariantes no puede pagar una conexión para
// leer un cartel. Se re-exportan para que los llamadores importen de un lugar.
export { motivoEnTexto } from './email/proveedor';
export type { EstadoEnvioMarca, MotivoSinRemitente } from './email/proveedor';

/**
 * Remitente a usar en el envío de una marca: el principal, o el más antiguo,
 * **con el dominio verificado**.
 *
 * ⛔ **`null` significa "esta marca no manda", no "usá el default".** No hay
 * fallback a `SES_FROM_EMAIL`: esa env es una sola para todo el proyecto y
 * hacía que un mail de Stunned saliera firmado por BDI. Ver `armarFrom()`.
 *
 * 🔴 **Desde el 2-ago-2026 mira `estado`, no solo la existencia de la fila.**
 * Antes alcanzaba con tener un remitente cargado: un comerciante que escribía su
 * mail sin verificar el dominio pasaba el guard y sus envíos morían contra SES
 * (o peor, salían sin DKIM). La columna sí es autoritativa ahora, y para que lo
 * sea de verdad **se refresca contra SES cuando dice `PENDIENTE`**: si esperara
 * a que alguien apriete "Verificar" en la pantalla, el estado sería una foto
 * vieja y una marca ya verificada seguiría sin poder enviar.
 *
 * ⚠️ Ese refresco es una llamada a SES, pero **solo cuando el candidato no está
 * verificado**: el camino normal (dominio ya autenticado) no toca la red.
 */
export async function getRemitenteEnvio(cuentaId: string) {
  const rem = await candidato(cuentaId);
  if (!rem) return null;
  if (rem.estado === 'AUTENTICADO') {
    return { nombre: rem.nombre, email: rem.email, responderA: rem.responderA };
  }

  const estado = await refrescarEstado(rem);
  if (estado !== 'AUTENTICADO') return null;
  return { nombre: rem.nombre, email: rem.email, responderA: rem.responderA };
}

/**
 * Lo mismo que `getRemitenteEnvio` pero contando POR QUÉ no se puede enviar.
 *
 * Existe porque el modo de falla era mudo: las guardas decían "cargá un
 * remitente" incluso cuando el remitente estaba cargado y lo que faltaba era el
 * DNS. Para la operación propia eso era un detalle; para alguien que acaba de
 * instalar la app es "no anda y no dice por qué".
 */
export async function estadoEnvioMarca(cuentaId: string): Promise<EstadoEnvioMarca> {
  const rem = await candidato(cuentaId);
  if (!rem) return { ok: false, motivo: 'SIN_REMITENTE' };
  if (rem.estado === 'AUTENTICADO') return { ok: true };

  const estado = await refrescarEstado(rem);
  if (estado === 'AUTENTICADO') return { ok: true };
  return {
    ok: false,
    motivo: estado === 'RECHAZADO' ? 'RECHAZADO' : 'PENDIENTE',
    dominio: rem.dominio,
  };
}

function candidato(cuentaId: string) {
  return prisma.remitente.findFirst({
    where: { cuentaId },
    orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      nombre: true,
      email: true,
      responderA: true,
      dominio: true,
      estado: true,
    },
  });
}

/**
 * Le pregunta a SES y deja la columna al día.
 *
 * El `catch` devuelve el estado guardado —no `PENDIENTE`— a propósito: si SES no
 * contesta, un remitente que ya estaba verificado tiene que poder seguir
 * mandando. Un blip de red no puede frenar un envío en curso.
 */
async function refrescarEstado(rem: { id: string; dominio: string; estado: string }) {
  try {
    const estado = await getIdentityStatus(rem.dominio);
    if (estado !== rem.estado) {
      await prisma.remitente.update({ where: { id: rem.id }, data: { estado } });
    }
    return estado;
  } catch {
    return rem.estado;
  }
}
