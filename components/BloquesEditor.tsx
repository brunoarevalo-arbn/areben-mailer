"use client";

import { renderEmailHtml, type Bloque } from "@/lib/email/render";
import { ProductosBlock } from "@/components/ProductosBlock";

const input = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

const nuevoBloque = (tipo: Bloque["tipo"]): Bloque => {
  switch (tipo) {
    case "titulo": return { tipo, texto: "Título" };
    case "texto": return { tipo, texto: "Escribí tu mensaje. Podés usar ${contacto.nombre}." };
    case "boton": return { tipo, texto: "Ver más", url: "https://bdiaccesorios.com.ar" };
    case "imagen": return { tipo, url: "", alt: "" };
    case "productos": return { tipo, items: [] };
    case "columnas": return { tipo, izq: { imagen: "", url: "" }, der: { imagen: "", url: "" } };
    case "video": return { tipo, imagen: "", url: "" };
    case "redes": return { tipo, links: [{ red: "Instagram", url: "" }] };
    case "divisor": return { tipo };
  }
};

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

  const previewHtml = renderEmailHtml({ bloques }, { preheader, unsubscribeUrl: "#", nombreCuenta });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="text-sm font-medium text-neutral-700">Contenido</div>
        {bloques.map((b, i) => (
          <div key={i} className="rounded-lg border border-neutral-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{b.tipo}</span>
              <div className="flex gap-1 text-xs text-neutral-500">
                <button onClick={() => moveBloque(i, -1)} className="px-1 hover:text-neutral-900">↑</button>
                <button onClick={() => moveBloque(i, 1)} className="px-1 hover:text-neutral-900">↓</button>
                <button onClick={() => delBloque(i)} className="px-1 text-red-500 hover:text-red-700">✕</button>
              </div>
            </div>
            {(b.tipo === "titulo" || b.tipo === "texto") && (
              <textarea className={input} rows={b.tipo === "texto" ? 3 : 1} value={b.texto} onChange={(e) => setBloque(i, { texto: e.target.value })} />
            )}
            {b.tipo === "boton" && (
              <div className="space-y-2">
                <input className={input} value={b.texto} placeholder="Texto del botón" onChange={(e) => setBloque(i, { texto: e.target.value })} />
                <input className={input} value={b.url} placeholder="https://…" onChange={(e) => setBloque(i, { url: e.target.value })} />
              </div>
            )}
            {b.tipo === "imagen" && (
              <input className={input} value={b.url} placeholder="URL de la imagen" onChange={(e) => setBloque(i, { url: e.target.value })} />
            )}
            {b.tipo === "productos" && <ProductosBlock items={b.items} onChange={(items) => setBloque(i, { items })} />}
            {b.tipo === "columnas" && (
              <div className="grid grid-cols-2 gap-2">
                {(["izq", "der"] as const).map((lado) => (
                  <div key={lado} className="space-y-1">
                    <input className={input} value={b[lado].imagen} placeholder="URL imagen" onChange={(e) => setBloque(i, { [lado]: { ...b[lado], imagen: e.target.value } } as Partial<Bloque>)} />
                    <input className={input} value={b[lado].url} placeholder="Link" onChange={(e) => setBloque(i, { [lado]: { ...b[lado], url: e.target.value } } as Partial<Bloque>)} />
                  </div>
                ))}
              </div>
            )}
            {b.tipo === "video" && (
              <div className="space-y-2">
                <input className={input} value={b.imagen} placeholder="URL miniatura" onChange={(e) => setBloque(i, { imagen: e.target.value })} />
                <input className={input} value={b.url} placeholder="URL del video" onChange={(e) => setBloque(i, { url: e.target.value })} />
              </div>
            )}
            {b.tipo === "redes" && (
              <div className="space-y-2">
                {b.links.map((l, k) => (
                  <div key={k} className="flex gap-2">
                    <input className={`${input} w-32`} value={l.red} placeholder="Red" onChange={(e) => setBloque(i, { links: b.links.map((x, j) => (j === k ? { ...x, red: e.target.value } : x)) })} />
                    <input className={`${input} flex-1`} value={l.url} placeholder="URL" onChange={(e) => setBloque(i, { links: b.links.map((x, j) => (j === k ? { ...x, url: e.target.value } : x)) })} />
                    <button onClick={() => setBloque(i, { links: b.links.filter((_, j) => j !== k) })} className="px-2 text-red-500">✕</button>
                  </div>
                ))}
                <button onClick={() => setBloque(i, { links: [...b.links, { red: "", url: "" }] })} className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50">+ red</button>
              </div>
            )}
            {b.tipo === "divisor" && <div className="text-xs text-neutral-400">— línea divisoria —</div>}
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          {(["titulo", "texto", "boton", "imagen", "productos", "columnas", "video", "redes", "divisor"] as const).map((t) => (
            <button key={t} onClick={() => addBloque(t)} className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50">+ {t}</button>
          ))}
        </div>
      </div>

      <div className="lg:sticky lg:top-6 h-fit">
        <div className="mb-2 text-sm text-neutral-500">Vista previa</div>
        <iframe title="preview" srcDoc={previewHtml} className="h-[60vh] w-full rounded-xl border border-neutral-200 bg-white" />
      </div>
    </div>
  );
}
