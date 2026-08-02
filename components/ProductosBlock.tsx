"use client";

import { useState } from "react";
import type { PorFila, PorFilaMovil, ProductoEmail } from "@/lib/email/render";
import { X } from "lucide-react";
import { campoBase } from "@/lib/ui";
import { GrillaControl } from "@/components/editor/GrillaControl";


export function ProductosBlock({
  items,
  movil,
  porFila,
  onChange,
  onGrilla,
}: {
  items: ProductoEmail[];
  movil?: PorFilaMovil;
  porFila?: PorFila;
  onChange: (items: ProductoEmail[]) => void;
  onGrilla: (cambio: { movil?: PorFilaMovil; porFila?: PorFila }) => void;
}) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ProductoEmail[]>([]);
  const [buscando, setBuscando] = useState(false);

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

  return (
    <div className="space-y-3">
      {/* Seleccionados */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted p-1.5 pr-2">
              {p.imagen && <img src={p.imagen} alt="" className="h-8 w-8 rounded object-cover" />}
              <span className="max-w-32 truncate text-xs text-foreground">{p.nombre}</span>
              <button onClick={() => quitar(i)} className="text-danger-foreground hover:opacity-70"><X className="h-4 w-4" aria-hidden /></button>
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

      {/* Cómo se acomoda la grilla en el teléfono. Va último: primero se eligen
          los productos, después se decide cómo se ven. */}
      <GrillaControl movil={movil} porFila={porFila} onChange={onGrilla} />
    </div>
  );
}
