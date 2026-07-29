"use client";

import { renderEmailHtml, type Bloque, type ContenidoCampania } from "@/lib/email/render";
import { BloquesList } from "@/components/BloquesList";
import { TemaSelector } from "@/components/TemaSelector";
import type { Tema } from "@/lib/email/tema";
import type { Marca } from "@/lib/marca";

export function BloquesEditor({
  bloques,
  onChange,
  marca,
  preheader,
  tema,
  onTemaChange,
  base,
}: {
  bloques: Bloque[];
  onChange: (b: Bloque[]) => void;
  /** Nombre, logo, sitio, pie y tema de la marca (`marcaDe(cuenta)`). */
  marca: Marca;
  preheader?: string;
  tema?: Tema;
  onTemaChange?: (t: Tema | undefined) => void;
  /**
   * El contenido completo del que salieron `bloques` y `tema`. El preview lo
   * usa de base para no perder lo que el editor todavía no muestra (versión del
   * esquema, estilos de documento) y mostrar así el mail que de verdad va a
   * salir, no una versión recortada.
   */
  base?: ContenidoCampania;
}) {
  const previewHtml = renderEmailHtml(
    { ...base, bloques, tema },
    { preheader, unsubscribeUrl: "#", muestraCarrito: true, ...marca },
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <BloquesList bloques={bloques} onChange={onChange} marca={marca} />
        {onTemaChange && (
          <TemaSelector
            tema={tema}
            onChange={onTemaChange}
            temaMarca={marca.temaMarca}
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
