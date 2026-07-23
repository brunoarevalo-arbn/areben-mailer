"use client";

import { nuevoBloque, type Bloque } from "@/lib/email/render";
import { ProductosBlock } from "@/components/ProductosBlock";
import { AISoonButton } from "@/components/ui/AISoonButton";
import { inputClass } from "@/lib/ui";
import { ChevronUp, ChevronDown, X } from "lucide-react";

const TIPOS = ["titulo", "texto", "boton", "imagen", "productos", "columnas", "video", "redes", "divisor"] as const;

/**
 * Card editable de bloques de contenido (sin preview): lista de bloques con
 * mover/eliminar + botones de agregar. La comparten CampaniaEditor,
 * BloquesEditor y (vía BloquesEditor) AutomationEditor.
 */
export function BloquesList({
  bloques,
  onChange,
}: {
  bloques: Bloque[];
  onChange: (b: Bloque[]) => void;
}) {
  const setBloque = (i: number, patch: Partial<Bloque>) =>
    onChange(bloques.map((b, j) => (j === i ? ({ ...b, ...patch } as Bloque) : b)));
  const addBloque = (tipo: Bloque["tipo"]) => onChange([...bloques, nuevoBloque(tipo)]);
  const delBloque = (i: number) => onChange(bloques.filter((_, j) => j !== i));
  const moveBloque = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= bloques.length) return;
    const copy = [...bloques];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">Contenido</span>
        <AISoonButton label="Redactar con IA" />
      </div>
      {bloques.map((b, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface-muted p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-subtle">{b.tipo}</span>
            <div className="flex gap-1 text-muted">
              <button onClick={() => moveBloque(i, -1)} className="px-1 hover:text-foreground"><ChevronUp className="h-4 w-4" aria-hidden /></button>
              <button onClick={() => moveBloque(i, 1)} className="px-1 hover:text-foreground"><ChevronDown className="h-4 w-4" aria-hidden /></button>
              <button onClick={() => delBloque(i)} className="px-1 text-danger-foreground hover:opacity-70"><X className="h-4 w-4" aria-hidden /></button>
            </div>
          </div>
          {(b.tipo === "titulo" || b.tipo === "texto") && (
            <textarea className={inputClass} rows={b.tipo === "texto" ? 3 : 1} value={b.texto} onChange={(e) => setBloque(i, { texto: e.target.value })} />
          )}
          {b.tipo === "boton" && (
            <div className="space-y-2">
              <input className={inputClass} value={b.texto} placeholder="Texto del botón" onChange={(e) => setBloque(i, { texto: e.target.value })} />
              <input className={inputClass} value={b.url} placeholder="https://…" onChange={(e) => setBloque(i, { url: e.target.value })} />
            </div>
          )}
          {b.tipo === "imagen" && (
            <input className={inputClass} value={b.url} placeholder="URL de la imagen (https://…)" onChange={(e) => setBloque(i, { url: e.target.value })} />
          )}
          {b.tipo === "productos" && (
            <ProductosBlock items={b.items} onChange={(items) => setBloque(i, { items })} />
          )}
          {b.tipo === "columnas" && (
            <div className="grid grid-cols-2 gap-2">
              {(["izq", "der"] as const).map((lado) => (
                <div key={lado} className="space-y-1">
                  <input className={inputClass} value={b[lado].imagen} placeholder="URL imagen" onChange={(e) => setBloque(i, { [lado]: { ...b[lado], imagen: e.target.value } } as Partial<Bloque>)} />
                  <input className={inputClass} value={b[lado].url} placeholder="Link" onChange={(e) => setBloque(i, { [lado]: { ...b[lado], url: e.target.value } } as Partial<Bloque>)} />
                </div>
              ))}
            </div>
          )}
          {b.tipo === "video" && (
            <div className="space-y-2">
              <input className={inputClass} value={b.imagen} placeholder="URL de la miniatura (imagen)" onChange={(e) => setBloque(i, { imagen: e.target.value })} />
              <input className={inputClass} value={b.url} placeholder="URL del video (YouTube, etc.)" onChange={(e) => setBloque(i, { url: e.target.value })} />
            </div>
          )}
          {b.tipo === "redes" && (
            <div className="space-y-2">
              {b.links.map((l, k) => (
                <div key={k} className="flex gap-2">
                  <input className={`${inputClass} w-32`} value={l.red} placeholder="Red" onChange={(e) => setBloque(i, { links: b.links.map((x, j) => (j === k ? { ...x, red: e.target.value } : x)) })} />
                  <input className={`${inputClass} flex-1`} value={l.url} placeholder="URL" onChange={(e) => setBloque(i, { links: b.links.map((x, j) => (j === k ? { ...x, url: e.target.value } : x)) })} />
                  <button onClick={() => setBloque(i, { links: b.links.filter((_, j) => j !== k) })} className="px-2 text-danger-foreground hover:opacity-70"><X className="h-4 w-4" aria-hidden /></button>
                </div>
              ))}
              <button onClick={() => setBloque(i, { links: [...b.links, { red: "", url: "" }] })} className="rounded-lg border border-border-strong px-2.5 py-1 text-xs text-muted hover:bg-surface-muted">+ red</button>
            </div>
          )}
          {b.tipo === "divisor" && <div className="text-xs text-subtle">— línea divisoria —</div>}
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        {TIPOS.map((t) => (
          <button key={t} onClick={() => addBloque(t)} className="rounded-lg border border-border-strong px-2.5 py-1 text-xs text-muted hover:bg-surface-muted">
            + {t}
          </button>
        ))}
      </div>
    </div>
  );
}
