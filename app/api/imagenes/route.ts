// Biblioteca de imágenes del mail: listar y subir.
//
// Hasta acá toda imagen de un mail era una URL escrita a mano, así que armar un
// diseño con fotos propias significaba tener las fotos ya publicadas en otro
// lado. Esto las guarda en Vercel Blob y lleva el registro por cuenta.
//
// ⚠️ Todo cuelga de `ctx.cuenta.id`, nunca de un id que venga en el request.
// Una biblioteca de imágenes es contenido de UN comerciante.

import { put } from '@vercel/blob';
import { autorizarApi } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Formatos que un cliente de mail dibuja. La lista es blanca a propósito.
 *
 * ⛔ SVG queda afuera aunque sea una imagen: ningún cliente de mail lo
 * rasteriza confiable, y un SVG servido desde un dominio propio es un archivo
 * con `<script>` adentro esperando a que alguien lo abra en una pestaña.
 */
const TIPOS = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/** 5 MB. Un mail entero no debería pasar de 80 KB de HTML; las fotos pesan aparte. */
const MAX_BYTES = 5 * 1024 * 1024;

export async function GET() {
  const ctx = await autorizarApi('ver');
  if (ctx instanceof Response) return ctx;

  const imagenes = await prisma.imagenMail.findMany({
    where: { cuentaId: ctx.cuenta.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  // El total sale de un agregado sobre TODA la cuenta, no de sumar la página:
  // con el `take` de arriba, sumar `imagenes` daría un consumo menor al real en
  // cuanto haya más de 200. Y el número que importa es el que se paga.
  const total = await prisma.imagenMail.aggregate({
    where: { cuentaId: ctx.cuenta.id },
    _sum: { bytes: true },
    _count: true,
  });

  return Response.json({
    imagenes,
    total: { archivos: total._count, bytes: total._sum.bytes ?? 0 },
    truncado: total._count > imagenes.length,
  });
}

export async function POST(req: Request) {
  const ctx = await autorizarApi('editar');
  if (ctx instanceof Response) return ctx;

  const form = await req.formData();
  const archivo = form.get('archivo');
  if (!(archivo instanceof File)) {
    return Response.json({ error: 'Falta el archivo' }, { status: 400 });
  }
  if (!TIPOS.has(archivo.type)) {
    return Response.json(
      { error: 'Formato no soportado. Va PNG, JPG, GIF o WEBP.' },
      { status: 400 },
    );
  }
  if (archivo.size > MAX_BYTES) {
    return Response.json({ error: 'La imagen supera los 5 MB.' }, { status: 400 });
  }

  // El pathname arranca con la cuenta: si mañana hay que borrar todo lo de un
  // comerciante que se va, es un prefijo y no una consulta.
  //
  // `addRandomSuffix` evita que dos personas que suben "foto.jpg" se pisen. La
  // extensión sale del MIME y no del nombre original: un `.png` que en realidad
  // es un JPEG se serviría con el content-type equivocado.
  const limpio = (archivo.name || 'imagen')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .slice(0, 60) || 'imagen';
  const ruta = `mail/${ctx.cuenta.id}/${limpio}.${EXT[archivo.type]}`;

  const blob = await put(ruta, archivo, {
    access: 'public',
    addRandomSuffix: true,
    contentType: archivo.type,
  });

  const num = (v: FormDataEntryValue | null) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  const imagen = await prisma.imagenMail.create({
    data: {
      cuentaId: ctx.cuenta.id,
      url: blob.url,
      pathname: blob.pathname,
      nombre: archivo.name || 'imagen',
      mime: archivo.type,
      bytes: archivo.size,
      // Las manda el navegador, que ya tuvo que decodificar la imagen para
      // mostrar la miniatura. Medirlas en el servidor sería una dependencia
      // nueva para un dato que es informativo.
      ancho: num(form.get('ancho')),
      alto: num(form.get('alto')),
      subidoPor: ctx.userId,
    },
  });

  return Response.json({ imagen }, { status: 201 });
}
