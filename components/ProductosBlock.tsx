"use client";

import { useState } from "react";
import type { PorFila, PorFilaMovil, ProductoEmail } from "@/lib/email/render";
import { RotateCcw, X } from "lucide-react";
import { campoBase } from "@/lib/ui";
import { GrillaControl } from "@/components/editor/GrillaControl";
import { ImagenDrop } from "@/components/editor/ImagenDrop";
import { Input } from "@/components/ui/Input";


export function ProductosBlock({
  items,
  botonTexto,
  movil,
  porFila,
  onChange,
  onBoton,
  onGrilla,
}: {
  items: ProductoEmail[];
  botonTexto?: string;
  movil?: PorFilaMovil;
  porFila?: PorFila;
  onChange: (items: ProductoEmail[]) => void;
  onBoton: (botonTexto: string) => void;
  onGrilla: (cambio: { movil?: PorFilaMovil; porFila?: PorFila }) => void;
}) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ProductoEmail[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [editandoFoto, setEditandoFoto] = useState<number | null>(null);

  const buscar = async () => {
    setBuscando(true);
    try {
      const res = await fetch(`/api/productos?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResultados(data.productos ?? []);
    } finally {
      setBuscando(false);
    }
  };

  const agregar = (p: ProductoEmail) => {
    if (items.some((x) => x.url === p.url)) return;
    onChange([...items, p]);
  };
  const quitar = (i: number) => onChange(items.filter((_, j) => j !== i));

  /**
   * Pisar la foto que trajo la tienda con una propia.
   *
   * ⚠️ `imagenTienda` se escribe **una sola vez**, la primera. Reescribirla en
   * cada cambio haría que la segunda foto propia pase a ser "la de la tienda" y
   * el botón de volver dejaría de volver a ningún lado.
   */
  const ponerFoto = (i: number, url: string) =>
    onChange(
      items.map((p, j) =>
        j !== i ? p : { ...p, imagen: url, imagenTienda: p.imagenTienda ?? p.imagen },
      ),
    );
  const volverALaDeLaTienda = (i: number) =>
    onChange(
      items.map((p, j) => {
        if (j !== i || !p.imagenTienda) return p;
        const { imagenTienda, ...resto } = p;
        return { ...resto, imagen: imagenTienda };
      }),
    );

  return (
    <div className="space-y-3">
      {/* Seleccionados.
          Era una fila de chips: miniatura, nombre y la cruz de sacar. Pasó a
          lista de renglones el 5-ago-2026 para que cada producto tuviera dónde
          colgar su propia foto — en un chip de 32px no entra un campo. */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((p, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface-muted p-1.5">
              <div className="flex items-center gap-2">
                {p.imagen && <img src={p.imagen} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />}
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">{p.nombre}</span>
                <button
                  type="button"
                  onClick={() => setEditandoFoto(editandoFoto === i ? null : i)}
                  className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted transition-colors hover:bg-surface hover:text-foreground"
                >
                  {p.imagenTienda ? "Foto propia" : "Cambiar la foto"}
                </button>
                <button
                  type="button"
                  aria-label={`Sacar ${p.nombre}`}
                  onClick={() => quitar(i)}
                  className="shrink-0 text-danger-foreground hover:opacity-70"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {editandoFoto === i && (
                <div className="space-y-1.5 border-t border-border p-1.5 pt-2">
                  <ImagenDrop value={p.imagen} onChange={(url) => ponerFoto(i, url)} />
                  {p.imagenTienda ? (
                    <button
                      type="button"
                      onClick={() => volverALaDeLaTienda(i)}
                      className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden />
                      Volver a la foto de la tienda
                    </button>
                  ) : (
                    <p className="text-xs text-subtle">
                      Una foto propia pisa la de la tienda sólo en este mail. El producto no se toca.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Buscador */}
      <div className="flex gap-2">
        <input
          className={`${campoBase} flex-1`}
          value={q}
          placeholder="Buscar productos en tu tienda…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscar())}
        />
        <button onClick={buscar} disabled={buscando} className="rounded-lg border border-border-strong px-3 py-2 text-sm text-muted hover:bg-surface-muted disabled:opacity-50">
          {buscando ? "…" : "Buscar"}
        </button>
      </div>

      {/* Resultados */}
      {resultados.length > 0 && (
        <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto rounded-lg border border-border p-2">
          {resultados.map((p) => (
            <button key={p.url} onClick={() => agregar(p)} className="rounded-lg border border-border p-1.5 text-left hover:border-accent">
              {p.imagen && <img src={p.imagen} alt="" className="mb-1 aspect-square w-full rounded object-cover" />}
              <div className="truncate text-xs text-foreground">{p.nombre}</div>
              <div className="text-xs text-muted">${Number(p.precioPromo || p.precio).toLocaleString("es-AR")}</div>
            </button>
          ))}
        </div>
      )}

      {/* El botón de cada tarjeta. El motor lo dibuja desde que existe la grilla
          —`renderCard` lo lee de `botonTexto`— pero hasta el 5-ago-2026 no había
          input en ningún lado: sólo las plantillas prearmadas podían ponerlo, y
          desde el editor el botón era inalcanzable. Vacío = no se dibuja, la
          convención de todo el motor. */}
      <Input
        label="Texto del botón"
        value={botonTexto ?? ""}
        placeholder="Sin botón"
        hint="Va debajo de cada producto y lleva a su página. Vacío, no se dibuja."
        onChange={(e) => onBoton(e.target.value)}
      />

      {/* Cómo se acomoda la grilla en el teléfono. Va último: primero se eligen
          los productos, después se decide cómo se ven. */}
      <GrillaControl movil={movil} porFila={porFila} onChange={onGrilla} />
    </div>
  );
}
