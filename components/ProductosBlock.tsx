"use client";

import { useState } from "react";
import type { ProductoEmail } from "@/lib/email/render";

const input = "rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function ProductosBlock({
  items,
  onChange,
}: {
  items: ProductoEmail[];
  onChange: (items: ProductoEmail[]) => void;
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
            <div key={i} className="flex items-center gap-2 rounded-lg border border-neutral-200 p-1.5 pr-2">
              {p.imagen && <img src={p.imagen} alt="" className="h-8 w-8 rounded object-cover" />}
              <span className="max-w-32 truncate text-xs text-neutral-700">{p.nombre}</span>
              <button onClick={() => quitar(i)} className="text-red-500 hover:text-red-700">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Buscador */}
      <div className="flex gap-2">
        <input
          className={`${input} flex-1`}
          value={q}
          placeholder="Buscar productos en tu tienda…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscar())}
        />
        <button onClick={buscar} disabled={buscando} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
          {buscando ? "…" : "Buscar"}
        </button>
      </div>

      {/* Resultados */}
      {resultados.length > 0 && (
        <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto rounded-lg border border-neutral-200 p-2">
          {resultados.map((p) => (
            <button key={p.url} onClick={() => agregar(p)} className="rounded-lg border border-neutral-200 p-1.5 text-left hover:border-amber-300">
              {p.imagen && <img src={p.imagen} alt="" className="mb-1 aspect-square w-full rounded object-cover" />}
              <div className="truncate text-xs text-neutral-700">{p.nombre}</div>
              <div className="text-xs text-neutral-500">${Number(p.precioPromo || p.precio).toLocaleString("es-AR")}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
