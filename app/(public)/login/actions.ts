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

  // Single-brand: buscamos por email (case-insensitive) sin filtrar por cuenta.
  const usuario = await prisma.usuario.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });

  const ok = usuario && (await verifyPassword(password, usuario.passwordHash));
  if (!usuario || !ok) {
    return { error: 'Credenciales inválidas.' };
  }

  await createSession(usuario.id, usuario.cuentaId, usuario.rol);
  redirect('/');
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect('/login');
}
