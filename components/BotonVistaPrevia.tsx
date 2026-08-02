"use client";

// "Ver" en una fila de `/campanias` o `/automations`.
//
// A diferencia de la galería —que ya tiene el HTML en el payload— acá el mail se
// pide recién al abrir (`/api/vista`): una lista de 40 campañas son 40 mails de
// 7-21 KB que nadie pidió.

import { useState, type ReactNode } from "react";
import { Eye } from "lucide-react";
import { ModalVistaPrevia, type FuenteVista } from "@/components/ModalVistaPrevia";
import { tapTarget } from "@/lib/ui";

export function BotonVistaPrevia({
  titulo,
  fuente,
  acciones,
}: {
  titulo: string;
  fuente: FuenteVista;
  acciones?: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Ver el mail"
        className={`flex ${tapTarget} items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-border-strong hover:bg-surface-muted hover:text-foreground`}
      >
        <Eye className="h-4 w-4" aria-hidden />
        Ver
      </button>
      {abierto && (
        <ModalVistaPrevia titulo={titulo} fuente={fuente} acciones={acciones} onCerrar={() => setAbierto(false)} />
      )}
    </>
  );
}
