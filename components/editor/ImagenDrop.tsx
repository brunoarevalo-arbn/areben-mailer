"use client";

// El campo de imagen de un bloque. Reemplaza al `<input>` pelado donde había que
// pegar una URL a mano — que era la razón número uno por la que no se podía
// armar un mail con fotos propias.
//
// Tres caminos al mismo dato, porque los tres aparecen en uso real: arrastrar un
// archivo, elegir una que ya está en la biblioteca, o pegar el link de una foto
// que ya vive en la tienda.

import { useRef, useState } from "react";
import { ImageIcon, Library, Crop } from "lucide-react";
import { inputClass } from "@/lib/ui";
import { subirImagen, recortarImagen, recortarAire } from "@/lib/imagenes";
import { FORMATOS, POS_CENTRO, ejeSobrante, type Formato } from "@/lib/imagenes-encuadre";
import { ImagenPicker } from "@/components/editor/ImagenPicker";
import { BarraOpciones } from "@/components/ui/BarraOpciones";

export function ImagenDrop({
  value,
  onChange,
  placeholder = "URL de la imagen (https://…)",
  formatos = false,
  aire = false,
  formato,
  urlOriginal,
  encuadre,
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
  /**
   * Ofrecer «Recortar el aire». **Opt-in por lo mismo que `formatos`**, pero la
   * pregunta es otra: la relación de aspecto es una decisión de diseño y el aire
   * alrededor de un logo es un defecto del archivo. Hoy se enciende en el campo
   * del logo del encabezado, que es donde ese defecto se paga en cada mail.
   *
   * ⚠️ Escribe por `onChange`, no por `onRecorte`: un recorte al ras no tiene
   * formato ni encuadre que guardar. Volver atrás es elegir el original en la
   * biblioteca, que es donde quedó.
   */
  aire?: boolean;
  formato?: Formato;
  urlOriginal?: string;
  encuadre?: number;
  /** Escribe las cuatro claves de una: no van en cuatro `set()` seguidos. */
  onRecorte?: (v: { url: string; formato?: Formato; urlOriginal?: string; encuadre?: number }) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Lo que pasó y no es un error: "esta imagen no tenía aire para sacar". Va
   * aparte del `error` porque se dibuja en gris y no en rojo — pintar de rojo una
   * respuesta correcta enseña a ignorar el color.
   */
  const [aviso, setAviso] = useState<string | null>(null);
  const [abierta, setAbierta] = useState(false);
  /**
   * Dónde está el deslizador AHORA, que no es lo mismo que el encuadre que ya se
   * subió: mientras se arrastra, esto se mueve y la foto del mail todavía no.
   * `guardado` es lo aplicado, y sale del bloque —no de un ref— porque después
   * de un recorte el valor vuelve por props: dos fuentes para el mismo dato es
   * cómo se termina con el deslizador diciendo una cosa y la foto siendo otra.
   */
  const guardado = encuadre ?? POS_CENTRO;
  const [pos, setPos] = useState(guardado);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);

  // Volver a sincronizar cuando cambia el bloque, la foto o el formato (elegir
  // otro bloque, ⌘Z). Va **en el render y no en un efecto**: un `setState` dentro
  // de un efecto dibuja una vez con el valor viejo y vuelve a dibujar, que acá se
  // vería como el deslizador saltando solo.
  const firma = `${value}|${formato ?? ""}|${guardado}`;
  const [ultimaFirma, setUltimaFirma] = useState(firma);
  if (ultimaFirma !== firma) {
    setUltimaFirma(firma);
    setPos(guardado);
  }

  const inputRef = useRef<HTMLInputElement>(null);
  const origen = urlOriginal || value;
  const eje = formato && nat ? ejeSobrante(nat.w, nat.h, FORMATOS[formato].ratio) : "ninguno";

  /**
   * Recortar SIEMPRE parte del original, nunca de la última recortada: un
   * recorte sobre un recorte compone la pérdida del re-encode y, peor, no hay
   * forma de volver a la foto entera. Por eso `urlOriginal` se escribe una sola
   * vez y es la que se lee acá.
   *
   * ⚠️ La posición entra por parámetro y no se lee del estado: el deslizador
   * dispara el recorte en la misma vuelta en la que la cambia, y ahí el estado
   * todavía tiene el valor viejo.
   */
  /**
   * Con qué nombre y con qué tipo se vuelve a subir lo recortado.
   *
   * 🔴 El `mime` sale de la EXTENSIÓN de la URL y no se puede adivinar de otra
   * forma acá: es lo que decide si el recorte sale PNG —conservando la
   * transparencia— o JPEG, que pinta de negro lo que era transparente. En un
   * logo eso es todo el fondo.
   */
  const comoArchivo = (url: string) => ({
    nombre: url.split("/").pop() || "imagen",
    mime: /\.png($|\?)/i.test(url) ? "image/png" : /\.gif($|\?)/i.test(url) ? "image/gif" : "image/jpeg",
  });

  const recortar = async (f: Formato | "original", conPos: number = pos) => {
    if (!origen) return;
    setError(null);
    setAviso(null);
    if (f === "original") {
      onRecorte?.({ url: origen, formato: undefined, urlOriginal: undefined, encuadre: undefined });
      return;
    }
    setSubiendo(true);
    const { nombre, mime } = comoArchivo(origen);
    const r = await recortarImagen(origen, nombre, mime, FORMATOS[f].ratio, conPos);
    setSubiendo(false);
    if (r.ok) {
      onRecorte?.({
        url: r.imagen.url,
        formato: f,
        urlOriginal: origen,
        encuadre: conPos === POS_CENTRO ? undefined : conPos,
      });
    } else setError(r.error);
  };

  /**
   * 🔴 **El recorte se sube al SOLTAR, no en cada píxel del arrastre.** Cada
   * recorte es un archivo nuevo en el store que ya no se puede borrar (su URL
   * puede estar en un mail entregado), así que subir uno por cada paso del
   * deslizador dejaría cincuenta huérfanos por encuadre. Mientras se arrastra, lo
   * que se mueve es el preview de acá al lado, que usa `object-fit: cover` — o
   * sea exactamente la misma cuenta que hace el canvas.
   */
  const soltar = () => {
    if (!formato || pos === guardado) return;
    void recortar(formato, pos);
  };

  /**
   * Recortar el aire: llevar la imagen al borde de su tinta.
   *
   * 🔑 Parte de `origen` —el original, no la última recortada— por la misma razón
   * que `recortar`: un recorte sobre un recorte compone la pérdida del re-encode.
   * En el campo del logo, que es donde esto se enciende hoy, no hay `urlOriginal`
   * y `origen` es lo que se está viendo.
   */
  const sacarAire = async () => {
    if (!origen) return;
    setError(null);
    setAviso(null);
    setSubiendo(true);
    const { nombre, mime } = comoArchivo(origen);
    const r = await recortarAire(origen, nombre, mime);
    setSubiendo(false);
    if (r.ok) onChange(r.imagen.url);
    else if (r.sinAire) setAviso(r.error);
    else setError(r.error);
  };

  const subir = async (file: File) => {
    setError(null);
    setAviso(null);
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
            {aire && value && (
              <button
                type="button"
                onClick={() => void sacarAire()}
                disabled={subiendo}
                title="Saca el vacío que la imagen tiene alrededor, sin achicar la marca"
                className="flex items-center gap-1.5 rounded-lg border border-border-strong px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-muted disabled:opacity-50"
              >
                <Crop className="h-3.5 w-3.5" aria-hidden />
                Recortar el aire
              </button>
            )}
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
          {/* La foto original, medida al vuelo: de acá sale qué eje se puede
              mover. No se dibuja — es la misma imagen que ya está cacheada. */}
          {formato && origen && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={origen}
              alt=""
              className="hidden"
              onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            />
          )}

          {formato && eje !== "ninguno" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">Qué parte se conserva</span>
                <span className="text-xs text-subtle">
                  {eje === "vertical" ? "arrastrá para subir o bajar" : "arrastrá para correr a los costados"}
                </span>
              </div>
              {/* 🔑 El preview usa `object-fit: cover` con la MISMA posición que
                  le va a pasar al canvas, así que lo que se ve acá es literalmente
                  lo que va a quedar. Sin esto, encuadrar sería mover un número y
                  esperar a que suba para ver si acertaste. */}
              <div
                className="overflow-hidden rounded-lg border border-border bg-surface-muted"
                style={{ aspectRatio: String(FORMATOS[formato].ratio) }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={origen}
                  alt=""
                  className="h-full w-full"
                  style={{
                    objectFit: "cover",
                    objectPosition: eje === "vertical" ? `50% ${pos}%` : `${pos}% 50%`,
                  }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={pos}
                disabled={subiendo}
                aria-label="Qué parte de la foto se conserva"
                className="w-full accent-accent"
                onChange={(e) => setPos(Number(e.target.value))}
                // El commit va en los tres finales que existen: soltar el mouse,
                // soltar el dedo y soltar la tecla. El `onChange` de un `range`
                // en React es continuo, así que no sirve para esto.
                onPointerUp={soltar}
                onKeyUp={soltar}
                onBlur={soltar}
              />
            </div>
          )}
          <p className="text-xs leading-relaxed text-muted">
            El recorte genera una foto nueva y deja la original en tu biblioteca: volver a
            «Original» no pierde nada.
          </p>
        </div>
      )}

      {aviso && <div className="text-xs text-subtle">{aviso}</div>}
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
