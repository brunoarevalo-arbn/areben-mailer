"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cambiarMiPassword } from "@/app/(app)/usuarios/actions";

/**
 * Cambio de contraseña propia. Es la contraparte necesaria de las temporales:
 * sin esto, la contraseña que se dicta por chat al dar de alta a alguien queda
 * viva para siempre.
 */
export function CambiarMiPassword() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const guardar = () =>
    start(async () => {
      const r = await cambiarMiPassword(actual, nueva);
      setMsg(r.ok ? "Contraseña actualizada ✓" : (r.error ?? "Error"));
      if (r.ok) {
        setActual("");
        setNueva("");
      }
      setTimeout(() => setMsg(null), 4000);
    });

  return (
    <Card>
      <div className="text-sm font-medium text-foreground">Mi contraseña</div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Actual"
          fullWidth
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
        />
        <Input
          label="Nueva"
          fullWidth
          type="password"
          autoComplete="new-password"
          hint="Mínimo 8 caracteres"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
        />
        <div className="flex items-end">
          <Button
            variant="primary"
            fullWidth
            onClick={guardar}
            disabled={pending || !actual || !nueva}
          >
            {pending ? "Guardando…" : "Cambiar"}
          </Button>
        </div>
      </div>
      {msg && <div className="mt-2 text-sm text-muted">{msg}</div>}
    </Card>
  );
}
