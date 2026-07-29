"use client";

import { nuevoBloque, TIPOS_BLOQUE, type Bloque } from "@/lib/email/render";
import { ProductosBlock } from "@/components/ProductosBlock";
import { ImagenDrop } from "@/components/editor/ImagenDrop";
import { AISoonButton } from "@/components/ui/AISoonButton";
import { inputClass } from "@/lib/ui";
import { ChevronUp, ChevronDown, X } from "lucide-react";

const selectClass = `${inputClass} py-1.5`;
const alignSelect = (value: "left" | "center", onChange: (v: "left" | "center") => void) => (
  <select className={`${selectClass} max-w-40`} value={value} onChange={(e) => onChange(e.target.value as "left" | "center")}>
    <option value="left">Alinear: izquierda</option>
    <option value="center">Alinear: centro</option>
  </select>
);
const colorInput = (value: string, onChange: (v: string) => void, label: string) => (
  <label className="flex items-center gap-2 text-xs text-muted">
    {label}
    <input type="color" value={value || "#ffffff"} onChange={(e) => onChange(e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-border-strong bg-background" />
    <span className="tabular-nums">{value}</span>
  </label>
);

/**
 * Card editable de bloques de contenido (sin preview): lista de bloques con
 * mover/eliminar + botones de agregar. La comparten CampaniaEditor,
 * BloquesEditor y (vía BloquesEditor) AutomationEditor.
 */
export function BloquesList({
  bloques,
  onChange,
  nombreCuenta = "",
}: {
  bloques: Bloque[];
  onChange: (b: Bloque[]) => void;
  /** Solo para mostrarlo de placeholder en el encabezado: lo resuelve el render. */
  nombreCuenta?: string;
}) {
  // El encabezado es chapa del mail, no contenido: se dibuja fuera de la
  // tarjeta, hay uno solo y va primero. Por eso no se ofrece dos veces en la
  // paleta y no se puede mover — el renderer lo va a poner arriba igual, y una
  // flecha que no hace nada es peor que no tenerla.
  const hayEncabezado = bloques.some((b) => b.tipo === "encabezado");
  const fijoArriba = bloques[0]?.tipo === "encabezado";
  const disponibles = TIPOS_BLOQUE.filter((t) => t !== "encabezado" || !hayEncabezado);

  const setBloque = (i: number, patch: Partial<Bloque>) =>
    onChange(bloques.map((b, j) => (j === i ? ({ ...b, ...patch } as Bloque) : b)));
  const addBloque = (tipo: Bloque["tipo"]) =>
    // El encabezado entra arriba de todo, que es el único lugar donde existe.
    onChange(tipo === "encabezado" ? [nuevoBloque(tipo), ...bloques] : [...bloques, nuevoBloque(tipo)]);
  const delBloque = (i: number) => onChange(bloques.filter((_, j) => j !== i));
  const moveBloque = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= bloques.length) return;
    // Nadie pasa por encima del encabezado.
    if (fijoArriba && (i === 0 || j === 0)) return;
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
              {b.tipo !== "encabezado" && (
                <>
                  <button onClick={() => moveBloque(i, -1)} className="px-1 hover:text-foreground"><ChevronUp className="h-4 w-4" aria-hidden /></button>
                  <button onClick={() => moveBloque(i, 1)} className="px-1 hover:text-foreground"><ChevronDown className="h-4 w-4" aria-hidden /></button>
                </>
              )}
              <button onClick={() => delBloque(i)} className="px-1 text-danger-foreground hover:opacity-70"><X className="h-4 w-4" aria-hidden /></button>
            </div>
          </div>
          {b.tipo === "encabezado" && (
            <div className="space-y-2">
              <select
                className={`${selectClass} max-w-52`}
                value={b.variante ?? "texto"}
                onChange={(e) => setBloque(i, { variante: e.target.value as "texto" | "logo" })}
              >
                <option value="texto">Nombre de la marca</option>
                <option value="logo">Logo</option>
              </select>
              {b.variante === "logo" ? (
                <div className="space-y-2">
                  <ImagenDrop value={b.logo ?? ""} onChange={(logo) => setBloque(i, { logo })} placeholder="URL del logo (https://…)" />
                  <label className="flex items-center gap-2 text-xs text-muted">
                    Ancho
                    <input
                      type="range"
                      min={40}
                      max={400}
                      step={10}
                      value={b.logoAncho ?? 140}
                      onChange={(e) => setBloque(i, { logoAncho: Number(e.target.value) })}
                      className="flex-1 accent-accent"
                    />
                    <span className="w-12 tabular-nums text-foreground">{b.logoAncho ?? 140}px</span>
                  </label>
                  <p className="text-xs text-subtle">Sin logo cargado se muestra el nombre.</p>
                </div>
              ) : (
                <>
                  <input className={inputClass} value={b.texto ?? ""} placeholder={nombreCuenta} onChange={(e) => setBloque(i, { texto: e.target.value })} />
                  <p className="text-xs text-subtle">Vacío = el nombre de la marca. Dejalo así para que la plantilla sirva en cualquier tienda.</p>
                </>
              )}
              <input className={inputClass} value={b.url ?? ""} placeholder="Link al tocarlo (opcional)" onChange={(e) => setBloque(i, { url: e.target.value })} />
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" checked={b.linea !== false} onChange={(e) => setBloque(i, { linea: e.target.checked })} />
                  Barrita de color debajo
                </label>
                {b.variante !== "logo" && (
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    <input type="checkbox" checked={b.mayusculas !== false} onChange={(e) => setBloque(i, { mayusculas: e.target.checked })} />
                    En mayúsculas
                  </label>
                )}
              </div>
            </div>
          )}
          {(b.tipo === "titulo" || b.tipo === "texto") && (
            <div className="space-y-2">
              <textarea className={inputClass} rows={b.tipo === "texto" ? 3 : 1} value={b.texto} onChange={(e) => setBloque(i, { texto: e.target.value })} />
              {alignSelect(b.align ?? "left", (align) => setBloque(i, { align }))}
            </div>
          )}
          {b.tipo === "boton" && (
            <div className="space-y-2">
              <input className={inputClass} value={b.texto} placeholder="Texto del botón" onChange={(e) => setBloque(i, { texto: e.target.value })} />
              <input className={inputClass} value={b.url} placeholder="https://…" onChange={(e) => setBloque(i, { url: e.target.value })} />
              <div className="flex flex-wrap items-center gap-3">
                {alignSelect(b.align ?? "left", (align) => setBloque(i, { align }))}
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" checked={!!b.full} onChange={(e) => setBloque(i, { full: e.target.checked })} />
                  Ancho completo
                </label>
              </div>
            </div>
          )}
          {b.tipo === "hero" && (
            <div className="space-y-2">
              <ImagenDrop value={b.imagen} onChange={(imagen) => setBloque(i, { imagen })} placeholder="URL de la imagen (banner)" />
              <input className={inputClass} value={b.titulo} placeholder="Título principal" onChange={(e) => setBloque(i, { titulo: e.target.value })} />
              <input className={inputClass} value={b.subtitulo} placeholder="Subtítulo" onChange={(e) => setBloque(i, { subtitulo: e.target.value })} />
              <div className="flex gap-2">
                <input className={inputClass} value={b.botonTexto} placeholder="Texto del botón" onChange={(e) => setBloque(i, { botonTexto: e.target.value })} />
                <input className={inputClass} value={b.botonUrl} placeholder="Link del botón" onChange={(e) => setBloque(i, { botonUrl: e.target.value })} />
              </div>
              {colorInput(b.bg, (bg) => setBloque(i, { bg }), "Fondo del texto")}
            </div>
          )}
          {b.tipo === "seccion" && (
            <div className="space-y-2">
              <input className={inputClass} value={b.titulo} placeholder="Título de la sección" onChange={(e) => setBloque(i, { titulo: e.target.value })} />
              <textarea className={inputClass} rows={2} value={b.texto} placeholder="Texto" onChange={(e) => setBloque(i, { texto: e.target.value })} />
              <div className="flex gap-2">
                <input className={inputClass} value={b.botonTexto} placeholder="Texto del botón (opcional)" onChange={(e) => setBloque(i, { botonTexto: e.target.value })} />
                <input className={inputClass} value={b.botonUrl} placeholder="Link del botón" onChange={(e) => setBloque(i, { botonUrl: e.target.value })} />
              </div>
              {colorInput(b.bg, (bg) => setBloque(i, { bg }), "Fondo de la sección")}
            </div>
          )}
          {b.tipo === "cupon" && (
            <div className="space-y-2">
              <input className={inputClass} value={b.texto} placeholder="Texto (ej. Usá este código en el checkout)" onChange={(e) => setBloque(i, { texto: e.target.value })} />
              <input className={inputClass} value={b.codigo} placeholder="Código (ej. DESCUENTO10)" onChange={(e) => setBloque(i, { codigo: e.target.value })} />
              <div className="flex gap-2">
                <input className={inputClass} value={b.botonTexto} placeholder="Texto del botón (opcional)" onChange={(e) => setBloque(i, { botonTexto: e.target.value })} />
                <input className={inputClass} value={b.botonUrl} placeholder="Link del botón" onChange={(e) => setBloque(i, { botonUrl: e.target.value })} />
              </div>
            </div>
          )}
          {b.tipo === "imagen" && (
            <ImagenDrop value={b.url} onChange={(url) => setBloque(i, { url })} />
          )}
          {b.tipo === "productos" && (
            <ProductosBlock items={b.items} onChange={(items) => setBloque(i, { items })} />
          )}
          {b.tipo === "espaciador" && (
            <label className="flex items-center gap-2 text-xs text-muted">
              Alto
              <input
                type="range"
                min={4}
                max={120}
                step={4}
                value={b.alto ?? 24}
                onChange={(e) => setBloque(i, { alto: Number(e.target.value) })}
                className="flex-1 accent-accent"
              />
              <span className="w-12 tabular-nums text-foreground">{b.alto ?? 24}px</span>
            </label>
          )}
          {b.tipo === "carrito" && (
            <p className="text-xs text-muted leading-relaxed">
              Se completa solo con lo que la persona dejó en el carrito: foto, nombre, variante,
              cantidad y precio. Movelo para elegir en qué parte del mail aparece.
              <br />
              Solo tiene efecto en la automation de <strong>carrito abandonado</strong>. En una
              campaña común no hay carrito, así que el bloque no se dibuja.
            </p>
          )}
          {b.tipo === "columnas" && (
            <div className="grid grid-cols-2 gap-2">
              {(["izq", "der"] as const).map((lado) => (
                <div key={lado} className="space-y-1">
                  <ImagenDrop value={b[lado].imagen} onChange={(imagen) => setBloque(i, { [lado]: { ...b[lado], imagen } } as Partial<Bloque>)} placeholder="URL imagen" />
                  <input className={inputClass} value={b[lado].url} placeholder="Link" onChange={(e) => setBloque(i, { [lado]: { ...b[lado], url: e.target.value } } as Partial<Bloque>)} />
                </div>
              ))}
            </div>
          )}
          {b.tipo === "video" && (
            <div className="space-y-2">
              <ImagenDrop value={b.imagen} onChange={(imagen) => setBloque(i, { imagen })} placeholder="URL de la miniatura (imagen)" />
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
        {disponibles.map((t) => (
          <button key={t} onClick={() => addBloque(t)} className="rounded-lg border border-border-strong px-2.5 py-1 text-xs text-muted hover:bg-surface-muted">
            + {t}
          </button>
        ))}
      </div>
    </div>
  );
}
