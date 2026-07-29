"use client";

// La biblioteca: todas las imágenes de la marca, con su consumo.
//
// Se abre desde cualquier campo de imagen del editor. Es lo que hace que armar
// un mail con fotos propias no dependa de tenerlas ya publicadas en otro lado.

import { useEffect, useRef, useState } from "react";
import { Trash2, Upload, X } from "lucide-react";
import { formatoBytes, subirImagen, type ImagenMailDto, type TotalImagenes } from "@/lib/imagenes";

export function ImagenPicker({
  onElegir,
  onCerrar,
}: {
  onElegir: (url: string) => void;
  onCerrar: () => void;
}) {
  const [imagenes, setImagenes] = useState<ImagenMailDto[]>([]);
  const [total, setTotal] = useState<TotalImagenes>({ archivos: 0, bytes: 0 });
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // El `vivo` no es de trámite: si alguien abre la biblioteca y la cierra antes
  // de que conteste el fetch, el estado se setearía sobre un componente que ya
  // no está.
  useEffect(() => {
    let vivo = true;
    fetch("/api/imagenes")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no se pudo leer"))))
      .then((d) => {
        if (!vivo) return;
        setImagenes(d.imagenes);
        setTotal(d.total);
      })
      .catch(() => vivo && setError("No se pudo leer la biblioteca."))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  // Escape cierra: un modal del que solo se sale con el mouse molesta cuando se
  // está armando un mail a dos manos.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  const subirVarias = async (files: FileList | File[]) => {
    const arr = [...files];
    if (!arr.length) return;
    setError(null);
    setSubiendo((n) => n + arr.length);
    const res = await Promise.all(arr.map(subirImagen));
    setSubiendo((n) => Math.max(0, n - arr.length));

    const nuevas = res.filter((r) => r.ok).map((r) => r.imagen);
    const fallas = res.filter((r) => !r.ok).map((r) => r.error);
    if (nuevas.length) {
      setImagenes((prev) => [...nuevas, ...prev]);
      setTotal((t) => ({
        archivos: t.archivos + nuevas.length,
        bytes: t.bytes + nuevas.reduce((s, i) => s + i.bytes, 0),
      }));
    }
    if (fallas.length) setError(fallas.join(" · "));
  };

  const borrar = async (img: ImagenMailDto) => {
    // El aviso no es de trámite: la URL ya está adentro de los mails enviados,
    // en la casilla de otra gente. Borrarla los deja con un hueco para siempre.
    if (!confirm(`¿Borrar "${img.nombre}"?\n\nLos mails que ya salieron con esta imagen la van a mostrar rota.`)) return;
    const r = await fetch(`/api/imagenes/${img.id}`, { method: "DELETE" });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error || "No se pudo borrar.");
      return;
    }
    setImagenes((prev) => prev.filter((x) => x.id !== img.id));
    setTotal((t) => ({ archivos: t.archivos - 1, bytes: t.bytes - img.bytes }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCerrar}>
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <div className="text-sm font-medium text-foreground">Biblioteca de imágenes</div>
            {/* El consumo se muestra desde el día uno: Blob se paga, y el
                egress de una imagen se paga por destinatario. */}
            <div className="text-xs text-muted">
              {total.archivos} imagen{total.archivos === 1 ? "" : "es"} · {formatoBytes(total.bytes)} en total
            </div>
          </div>
          <button onClick={onCerrar} className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-foreground">
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        {error && <div className="border-b border-danger-border bg-danger px-4 py-2 text-xs text-danger-foreground">{error}</div>}

        <div
          className="flex-1 overflow-y-auto p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) void subirVarias(e.dataTransfer.files);
          }}
        >
          <button
            onClick={() => inputRef.current?.click()}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong py-6 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
          >
            <Upload className="h-4 w-4" aria-hidden />
            {subiendo > 0 ? `Subiendo ${subiendo}…` : "Arrastrá imágenes acá o hacé click · PNG, JPG, GIF o WEBP hasta 5 MB"}
          </button>

          {cargando ? (
            <div className="py-8 text-center text-sm text-muted">Cargando…</div>
          ) : imagenes.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">
              Todavía no subiste ninguna imagen.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {imagenes.map((img) => (
                <div key={img.id} className="group relative overflow-hidden rounded-lg border border-border bg-surface-muted">
                  <button onClick={() => onElegir(img.url)} className="block w-full text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.nombre} className="h-24 w-full bg-white object-contain" />
                    <div className="p-2">
                      <div className="truncate text-[11px] text-foreground">{img.nombre}</div>
                      <div className="text-[10px] text-subtle">
                        {formatoBytes(img.bytes)}
                        {img.ancho ? ` · ${img.ancho}×${img.alto}` : ""}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => borrar(img)}
                    title="Borrar de la biblioteca"
                    className="absolute right-1.5 top-1.5 rounded-md bg-surface/90 p-1 text-muted opacity-0 transition-opacity hover:text-danger-foreground group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void subirVarias(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
