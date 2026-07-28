'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { createSession, deleteSession } from '@/lib/session';

export type LoginState = { error?: string } | undefined;

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Ingresá email y contraseña.' };
  }

  // findMany y no findFirst: la unicidad del email es por CUENTA
  // (@@unique([cuentaId, email])), así que el mismo mail puede existir en dos
  // marcas. Con findFirst sin orderBy, Postgres devolvía cualquiera de las dos
  // filas —el orden no está garantizado— y la persona entraba a la marca
  // equivocada, con el rol de esa otra fila. Hoy no pasa porque hay un solo
  // usuario; pasaría en silencio el día que haya dos.
  const candidatos = await prisma.usuario.findMany({
    where: { email: { equals: email, mode: 'insensitive' }, activo: true },
  });

  const coinciden: typeof candidatos = [];
  for (const u of candidatos) {
    if (await verifyPassword(password, u.passwordHash)) coinciden.push(u);
  }

  if (coinciden.length === 0) {
    return { error: 'Credenciales inválidas.' };
  }
  if (coinciden.length > 1) {
    // Elegir una al azar sería peor que no dejar entrar: nadie se daría cuenta.
    return { error: 'Hay más de una cuenta con este email. Avisale al administrador.' };
  }

  const usuario = coinciden[0];
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoLoginAt: new Date() },
  });
  await createSession(usuario.id, usuario.cuentaId, usuario.rol);
  redirect('/');
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect('/login');
}
