import { exchangeCode } from '@/lib/tn/client';
import { prisma } from '@/lib/prisma';
import { getCuentaActiva } from '@/lib/cuenta';

// TN redirige acá tras la instalación con ?code=... Canjeamos el token y lo guardamos.
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  if (!code) return new Response('falta code', { status: 400 });

  try {
    const token = await exchangeCode(code);
    const cuenta = await getCuentaActiva();
    await prisma.cuenta.update({
      where: { id: cuenta.id },
      data: { tnStoreId: token.user_id.toString(), tnToken: token.access_token },
    });
    return Response.redirect(new URL('/?tn=conectado', process.env.APP_URL ?? req.url));
  } catch (e) {
    return new Response(`Error conectando Tiendanube: ${(e as Error).message}`, { status: 500 });
  }
}
