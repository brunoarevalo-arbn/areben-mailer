// Borrar una imagen de la biblioteca.
//
// ⚠️ El borrado NO revisa los mails que la usan, y no puede: una campaña ya
// enviada tiene la URL adentro del correo que está en la casilla de otra
// persona. Borrar acá deja esa imagen rota para siempre. Por eso la UI avisa
// antes, y por eso no hay borrado masivo.

import { del } from '@vercel/blob';
import { autorizarApi } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await autorizarApi('editar');
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // El `cuentaId` va en el WHERE, no en un chequeo después de leer: con un
  // findUnique por id suelto, cualquiera con sesión podría borrar las imágenes
  // de otra marca cambiando el id de la URL. Es el agujero multi-tenant que ya
  // apareció una vez del lado de Resorty.
  const imagen = await prisma.imagenMail.findFirst({
    where: { id, cuentaId: ctx.cuenta.id },
  });
  if (!imagen) return Response.json({ error: 'No existe' }, { status: 404 });

  // Primero el blob y después la fila. Al revés, un error en `del` dejaría el
  // archivo pagándose en el store sin nadie que sepa que existe.
  try {
    await del(imagen.url);
  } catch {
    // El blob ya no está (borrado a mano, store vaciado). La fila igual sobra.
  }
  await prisma.imagenMail.delete({ where: { id: imagen.id } });

  return Response.json({ ok: true });
}
