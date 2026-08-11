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
import { subirImagen, recortarImagen } from "@/lib/imagenes";
import { FORMATOS, type Formato, type Ancla } from "@/lib/imagenes-encuadre";
import { ImagenPicker } from "@/components/editor/ImagenPicker";
import { BarraOpciones } from "@/components/ui/BarraOpciones";

export function ImagenDrop({
  value,
  onChange,
  placeholder = "URL de la imagen (https://…)",
  formatos = false,
  formato,
  urlOriginal,
  onRecorte,
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  /**
   * Ofrecer los formatos de recorte. **Opt-in a propósito**: este mismo campo
   * dibuja el logo del encabezado, la miniatura de un video y la foto de una
   * celda, y en ninguno de esos tres la relación de aspecto es del autor —la
   * decide el bloque. Sin la bandera, este control no existe.
   */
  formatos?: boolean;
  formato?: Formato;
  urlOriginal?: string;
  /** Escribe las tres claves de una: no van en tres `set()` seguidos. */
  onRecorte?: (v: { url: string; formato?: Formato; urlOriginal?: string }) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [ancla, setAncla] = useState<Ancla>("centro");
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Recortar SIEMPRE parte del original, nunca de la última recortada: un
   * recorte sobre un recorte compone la pérdida del re-encode y, peor, no hay
   * forma de volver a la foto entera. Por eso `urlOriginal` se escribe una sola
   * vez y es la que se lee acá.
   */
  // ⚠️ El ancla entra por parámetro y no se lee del estado: el botón que la
  // cambia dispara el recorte en la misma vuelta, y ahí `ancla` todavía tiene el
  // valor viejo. Es el mismo motivo por el que un `set()` no se llama tres veces
  // seguidas en el panel de estilo.
  const recortar = async (f: Formato | "original", conAncla: Ancla = ancla) => {
    const origen = urlOriginal || value;
    if (!origen) return;
    setError(null);
    if (f === "original") {
      onRecorte?.({ url: origen, formato: undefined, urlOriginal: undefined });
      return;
    }
    setSubiendo(true);
    const nombre = origen.split("/").pop() || "imagen";
    const mime = /\.png($|\?)/i.test(origen) ? "image/png" : /\.gif($|\?)/i.test(origen) ? "image/gif" : "image/jpeg";
    const r = await recortarImagen(origen, nombre, mime, FORMATOS[f].ratio, conAncla);
    setSubiendo(false);
    if (r.ok) onRecorte?.({ url: r.imagen.url, formato: f, urlOriginal: origen });
    else setError(r.error);
  };

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

      {formatos && value && (
        <div className="space-y-1.5 pt-1">
          <BarraOpciones
            label="Formato"
            value={(formato ?? "original") as string}
            opciones={[
              { clave: "original" as string, label: "Original" },
              ...(Object.keys(FORMATOS) as Formato[]).map((k) => ({ clave: k as string, label: FORMATOS[k].label })),
            ]}
            disabled={subiendo}
            onChange={(v) => void recortar(v as Formato | "original")}
          />
          {/* El ancla sólo tiene sentido mientras se elige un recorte: cuando lo
              que sobra es alto, es lo que decide si se corta la cabeza o los
              pies. Se ve antes de recortar y también después, para poder
              corregir sin deshacer. */}
          {formato && (
            <BarraOpciones
              label="Qué parte se conserva"
              value={ancla}
              opciones={[
                { clave: "arriba" as Ancla, label: "Arriba" },
                { clave: "centro" as Ancla, label: "Centro" },
                { clave: "abajo" as Ancla, label: "Abajo" },
              ]}
              disabled={subiendo}
              onChange={(v) => {
                setAncla(v);
                void recortar(formato, v);
              }}
            />
          )}
          <p className="text-xs leading-relaxed text-muted">
            El recorte genera una foto nueva y deja la original en tu biblioteca: volver a
            «Original» no pierde nada.
          </p>
        </div>
      )}

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
