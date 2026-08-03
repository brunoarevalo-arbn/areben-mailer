"use client";

// "Otra igual que esta". El botón de duplicar una campaña, en la lista.
//
// Es cliente y no un `<form action={…}>` pelado por una sola razón: para poder
// preguntarle a `usePermisos` si esta persona puede editar. Un VIEWER que ve el
// botón y se come un 403 al apretarlo es la regla que la app ya tiene escrita
// —la UI y las actions leen la MISMA `puede()`—, y no se rompe por un botón más.

import { useTransition } from "react";
import { Copy } from "lucide-react";
import { usePermisos } from "@/components/PermisosProvider";
import { tapTarget } from "@/lib/ui";

export function BotonDuplicar({ accion }: { accion: () => Promise<void> }) {
  const [pendiente, start] = useTransition();
  const { puede } = usePermisos();
  if (!puede("editar")) return null;

  return (
    <button
      type="button"
      disabled={pendiente}
      title="Duplicar"
      aria-label="Duplicar"
      onClick={() => start(() => accion())}
      className={`flex ${tapTarget} items-center justify-center rounded-xl border border-border p-1.5 text-muted transition-colors hover:border-border-strong hover:bg-surface-muted disabled:opacity-40`}
    >
      <Copy className="h-4 w-4" aria-hidden />
    </button>
  );
}
