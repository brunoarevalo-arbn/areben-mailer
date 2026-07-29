"use client";

import { renderEmailHtml, type Bloque } from "@/lib/email/render";
import { BloquesList } from "@/components/BloquesList";
import { TemaSelector } from "@/components/TemaSelector";
import type { Tema } from "@/lib/email/tema";

export function BloquesEditor({
  bloques,
  onChange,
  nombreCuenta,
  preheader,
  tema,
  onTemaChange,
  temaMarca,
}: {
  bloques: Bloque[];
  onChange: (b: Bloque[]) => void;
  nombreCuenta: string;
  preheader?: string;
  tema?: Tema;
  onTemaChange?: (t: Tema | undefined) => void;
  temaMarca?: Tema | null;
}) {
  const previewHtml = renderEmailHtml(
    { bloques, tema },
    { preheader, unsubscribeUrl: "#", nombreCuenta, muestraCarrito: true, temaMarca },
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <BloquesList bloques={bloques} onChange={onChange} />
        {onTemaChange && (
          <TemaSelector
            tema={tema}
            onChange={onTemaChange}
            temaMarca={temaMarca}
            ayuda="Solo para esta automation. Sin tocar nada, usa el de la marca."
          />
        )}
      </div>

      <div className="lg:sticky lg:top-6 h-fit">
        <div className="mb-2 text-sm text-muted">Vista previa</div>
        <iframe title="preview" sandbox="" srcDoc={previewHtml} className="h-[60vh] w-full rounded-xl border border-border bg-white" />
      </div>
    </div>
  );
}
