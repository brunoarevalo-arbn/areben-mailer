"use client";

import { useActionState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { suscribir, type SuscribirState } from "./actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Props {
  slug: string;
  titulo: string;
  descripcion: string | null;
  botonTexto: string;
  exitoMensaje: string;
  pedirNombre: boolean;
}

export function FormularioPublico({
  slug,
  titulo,
  descripcion,
  botonTexto,
  exitoMensaje,
  pedirNombre,
}: Props) {
  const action = suscribir.bind(null, slug);
  const [state, formAction, pending] = useActionState<SuscribirState, FormData>(
    action,
    undefined
  );

  if (state?.ok) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-surface border border-border rounded-2xl shadow-md px-7 py-9 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-success text-success-foreground">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </div>
          <p className="mt-4 text-base font-medium text-foreground">
            {exitoMensaje}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="w-full max-w-sm">
      <div className="bg-surface border border-border rounded-2xl shadow-md px-7 py-8">
        <h1 className="text-lg font-bold tracking-tight text-foreground">
          {titulo}
        </h1>
        {descripcion && <p className="mt-1 text-sm text-muted">{descripcion}</p>}

        <div className="mt-5 space-y-3">
          {pedirNombre && (
            <Input
              name="nombre"
              type="text"
              placeholder="Tu nombre"
              autoComplete="name"
              fullWidth
            />
          )}
          <Input
            name="email"
            type="email"
            placeholder="tu@email.com"
            autoComplete="email"
            required
            fullWidth
          />

          {state && !state.ok && state.error && (
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
            {botonTexto}
          </Button>
        </div>
      </div>
    </form>
  );
}
