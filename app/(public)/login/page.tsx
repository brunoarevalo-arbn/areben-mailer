import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Ingresar · Areben Mailer',
};

export default function LoginPage() {
  return <LoginForm />;
}
