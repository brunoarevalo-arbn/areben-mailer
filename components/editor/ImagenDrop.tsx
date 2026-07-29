"use client";

// El campo de imagen de un bloque. Reemplaza al `<input>` pelado donde había que
// pegar una URL a mano — que era la razón número uno por la que no se podía
// armar un mail con fotos propias.
//
// Tres caminos al mismo dato, porque los tres aparecen en uso real: arrastrar un
// archivo, elegir una que ya está en la biblioteca, o pegar el link de una foto
// que ya vive en la tienda.

import { useRef, useState } from "react";
import { ImageIcon, Library } from "lucide-react";
import { inputClass } from "@/lib/ui";
import { subirImagen } from "@/lib/imagenes";
import { ImagenPicker } from "@/components/editor/ImagenPicker";

export function ImagenDrop({
  value,
  onChange,
  placeholder = "URL de la imagen (https://…)",
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const subir = async (file: File) => {
    setError(null);
    setSubiendo(true);
    const r = await subirImagen(file);
    setSubiendo(false);
    if (r.ok) onChange(r.imagen.url);
    else setError(r.error);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void subir(f);
          }}
          title="Arrastrá una imagen o hacé click"
          className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border-strong bg-surface-muted transition-colors hover:border-accent"
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full bg-white object-contain" />
          ) : (
            <ImageIcon className="h-5 w-5 text-subtle" aria-hidden />
          )}
          {subiendo && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface/80 text-[10px] text-muted">…</div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <input className={inputClass} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAbierta(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border-strong px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-muted"
            >
              <Library className="h-3.5 w-3.5" aria-hidden />
              Biblioteca
            </button>
            {value && (
              <button type="button" onClick={() => onChange("")} className="text-xs text-subtle hover:text-danger-foreground">
                Quitar
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <div className="text-xs text-danger-foreground">{error}</div>}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void subir(f);
          e.target.value = "";
        }}
      />

      {abierta && (
        <ImagenPicker
          onCerrar={() => setAbierta(false)}
          onElegir={(url) => {
            onChange(url);
            setAbierta(false);
          }}
        />
      )}
    </div>
  );
}
