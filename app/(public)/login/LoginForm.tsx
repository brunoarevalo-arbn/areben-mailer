'use client';

import { useActionState } from 'react';
import { Send, AlertTriangle } from 'lucide-react';
import { login } from './actions';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="w-full max-w-sm">
      <div className="bg-surface border border-border rounded-2xl shadow-md px-8 py-9">
        {/* Marca */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-sm">
            <Send className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
            Areben Mailer
          </h1>
          <p className="mt-1 text-sm text-muted">Ingresá para continuar</p>
        </div>

        <div className="space-y-4">
          <Input
            name="email"
            type="email"
            label="Email"
            placeholder="tu@email.com"
            autoComplete="email"
            autoFocus
            required
            fullWidth
          />
          <Input
            name="password"
            type="password"
            label="Contraseña"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            fullWidth
          />

          {state?.error && (
            <div className="flex items-center gap-2 rounded-xl bg-danger border border-danger-border px-3 py-2 text-sm text-danger-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {state.error}
            </div>
          )}

          <Button
            type="submit"
            variant="accent"
            size="lg"
            isLoading={pending}
            className="w-full"
          >
            Ingresar
          </Button>
        </div>
      </div>
    </form>
  );
}
