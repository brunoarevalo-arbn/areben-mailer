"use client";

import { renderEmailHtml, type Bloque } from "@/lib/email/render";
import { BloquesList } from "@/components/BloquesList";

export function BloquesEditor({
  bloques,
  onChange,
  nombreCuenta,
  preheader,
}: {
  bloques: Bloque[];
  onChange: (b: Bloque[]) => void;
  nombreCuenta: string;
  preheader?: string;
}) {
  const previewHtml = renderEmailHtml({ bloques }, { preheader, unsubscribeUrl: "#", nombreCuenta, muestraCarrito: true });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <BloquesList bloques={bloques} onChange={onChange} />

      <div className="lg:sticky lg:top-6 h-fit">
        <div className="mb-2 text-sm text-muted">Vista previa</div>
        <iframe title="preview" srcDoc={previewHtml} className="h-[60vh] w-full rounded-xl border border-border bg-white" />
      </div>
    </div>
  );
}
