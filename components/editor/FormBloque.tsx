"use client";

import type { Bloque } from "@/lib/email/render";
import { ProductosBlock } from "@/components/ProductosBlock";
import { ImagenDrop } from "@/components/editor/ImagenDrop";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { Marca } from "@/lib/marca";
import { X } from "lucide-react";

/**
 * El formulario de UN bloque: lo que antes vivía adentro de cada fila de la
 * lista y ahora se dibuja en el panel de la derecha.
 *
 * Es solo la pestaña **Contenido**. El estilo (colores, tamaños, espaciados)
 * tiene su propia pestaña y su propio control de tres estados, porque el orden
 * en que se ofrecen las opciones es lo que decide si la gente clava un hex o usa
 * el color de su marca.
 */

function Rango({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  sufijo = "px",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  sufijo?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-semibold text-muted">{label}</span>
        <span className="text-xs tabular-nums text-foreground">
          {value}
          {sufijo}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
      {label}
    </label>
  );
}

function Alineacion({
  value,
  onChange,
}: {
  value: "left" | "center";
  onChange: (v: "left" | "center") => void;
}) {
  return (
    <Select label="Alineación" fullWidth value={value} onChange={(e) => onChange(e.target.value as "left" | "center")}>
      <option value="left">Izquierda</option>
      <option value="center">Centro</option>
    </Select>
  );
}

export function FormBloque({
  bloque: b,
  onChange,
  marca,
}: {
  bloque: Bloque;
  /** Parche sobre el bloque. Nunca reemplaza el bloque entero: perdería el `id`. */
  onChange: (patch: Partial<Bloque>) => void;
  /**
   * Solo para los placeholders del encabezado: el nombre y el logo los resuelve
   * el render, no se copian adentro del bloque.
   */
  marca: Marca;
}) {
  const set = onChange;
  const nombreCuenta = marca.nombreCuenta ?? "";
  const logoTienda = marca.logoCuenta ?? "";

  switch (b.tipo) {
    case "encabezado":
      return (
        <div className="space-y-3">
          {/* "Automático" es la ausencia de `variante`, no un valor: así el
              bloque no decide por una marca que todavía no conoce y una
              plantilla sirve igual en una tienda con logo y en una sin. */}
          <Select
            label="Qué se muestra arriba"
            fullWidth
            value={b.variante ?? "auto"}
            onChange={(e) => {
              const v = e.target.value;
              set({ variante: v === "auto" ? undefined : (v as "texto" | "logo") });
            }}
          >
            <option value="auto">Automático{logoTienda ? " (el logo de tu tienda)" : " (el nombre de la marca)"}</option>
            <option value="texto">Nombre de la marca</option>
            <option value="logo">Otro logo</option>
          </Select>

          {b.variante === "logo" ? (
            <>
              <ImagenDrop value={b.logo ?? ""} onChange={(logo) => set({ logo })} placeholder="URL del logo (https://…)" />
              <Rango label="Ancho del logo" value={b.logoAncho ?? 140} onChange={(logoAncho) => set({ logoAncho })} min={40} max={400} step={10} />
              <p className="text-xs text-subtle">
                {logoTienda ? "Sin cargar ninguno se usa el logo de tu tienda." : "Sin logo cargado se muestra el nombre."}
              </p>
            </>
          ) : (
            <>
              {b.variante === undefined && logoTienda && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoTienda} alt="Logo de tu tienda" className="h-9 w-auto max-w-40 object-contain" />
              )}
              <Input
                label="Texto"
                fullWidth
                value={b.texto ?? ""}
                placeholder={nombreCuenta}
                onChange={(e) => set({ texto: e.target.value })}
                hint="Vacío = el nombre de la marca. Dejalo así para que la plantilla sirva en cualquier tienda."
              />
            </>
          )}

          <Input
            label="Link al tocarlo"
            fullWidth
            value={b.url ?? ""}
            placeholder={marca.urlCuenta || "https://… (opcional)"}
            onChange={(e) => set({ url: e.target.value })}
          />
          <Check label="Barrita de color debajo" checked={b.linea !== false} onChange={(linea) => set({ linea })} />
          {b.variante !== "logo" && (
            <Check label="En mayúsculas" checked={b.mayusculas !== false} onChange={(mayusculas) => set({ mayusculas })} />
          )}
        </div>
      );

    case "titulo":
    case "texto":
      return (
        <div className="space-y-3">
          <Textarea
            label={b.tipo === "titulo" ? "Título" : "Texto"}
            fullWidth
            rows={b.tipo === "texto" ? 6 : 2}
            value={b.texto}
            onChange={(e) => set({ texto: e.target.value })}
            hint="Podés usar ${contacto.nombre}."
          />
          <Alineacion value={b.align ?? "left"} onChange={(align) => set({ align })} />
        </div>
      );

    case "boton":
      return (
        <div className="space-y-3">
          <Input label="Texto del botón" fullWidth value={b.texto} onChange={(e) => set({ texto: e.target.value })} />
          <Input label="Link" fullWidth value={b.url} placeholder="https://…" onChange={(e) => set({ url: e.target.value })} />
          <Alineacion value={b.align ?? "left"} onChange={(align) => set({ align })} />
          <Check label="Ancho completo" checked={!!b.full} onChange={(full) => set({ full })} />
        </div>
      );

    case "hero":
      return (
        <div className="space-y-3">
          <ImagenDrop value={b.imagen} onChange={(imagen) => set({ imagen })} placeholder="URL de la imagen (banner)" />
          <Input label="Título principal" fullWidth value={b.titulo} onChange={(e) => set({ titulo: e.target.value })} />
          <Input label="Subtítulo" fullWidth value={b.subtitulo} onChange={(e) => set({ subtitulo: e.target.value })} />
          <Input label="Texto del botón" fullWidth value={b.botonTexto} onChange={(e) => set({ botonTexto: e.target.value })} />
          <Input label="Link del botón" fullWidth value={b.botonUrl} placeholder="https://…" onChange={(e) => set({ botonUrl: e.target.value })} />
          <ColorFijo label="Fondo del texto" value={b.bg} onChange={(bg) => set({ bg })} />
        </div>
      );

    case "seccion":
      return (
        <div className="space-y-3">
          <Input label="Título de la sección" fullWidth value={b.titulo} onChange={(e) => set({ titulo: e.target.value })} />
          <Textarea label="Texto" fullWidth rows={4} value={b.texto} onChange={(e) => set({ texto: e.target.value })} />
          <Input label="Texto del botón" fullWidth value={b.botonTexto} placeholder="Opcional" onChange={(e) => set({ botonTexto: e.target.value })} />
          <Input label="Link del botón" fullWidth value={b.botonUrl} placeholder="https://…" onChange={(e) => set({ botonUrl: e.target.value })} />
          <ColorFijo label="Fondo de la sección" value={b.bg} onChange={(bg) => set({ bg })} />
        </div>
      );

    case "cupon":
      return (
        <div className="space-y-3">
          <Input label="Texto" fullWidth value={b.texto} placeholder="Usá este código en el checkout" onChange={(e) => set({ texto: e.target.value })} />
          <Input label="Código" fullWidth value={b.codigo} placeholder="DESCUENTO10" onChange={(e) => set({ codigo: e.target.value })} />
          <Input label="Texto del botón" fullWidth value={b.botonTexto} placeholder="Opcional" onChange={(e) => set({ botonTexto: e.target.value })} />
          <Input label="Link del botón" fullWidth value={b.botonUrl} placeholder="https://…" onChange={(e) => set({ botonUrl: e.target.value })} />
        </div>
      );

    case "imagen":
      return (
        <div className="space-y-3">
          <ImagenDrop value={b.url} onChange={(url) => set({ url })} />
          <Input
            label="Texto alternativo"
            fullWidth
            value={b.alt ?? ""}
            onChange={(e) => set({ alt: e.target.value })}
            hint="Lo que se lee cuando el cliente de mail bloquea las imágenes — que es el caso por defecto en Outlook."
          />
        </div>
      );

    case "productos":
      return <ProductosBlock items={b.items} onChange={(items) => set({ items })} />;

    case "espaciador":
      return <Rango label="Alto" value={b.alto ?? 24} onChange={(alto) => set({ alto })} min={4} max={120} step={4} />;

    case "carrito":
      return (
        <p className="text-sm leading-relaxed text-muted">
          Se completa solo con lo que la persona dejó en el carrito: foto, nombre, variante,
          cantidad y precio. Movelo para elegir en qué parte del mail aparece.
          <br />
          <br />
          Solo tiene efecto en la automation de <strong>carrito abandonado</strong>. En una
          campaña común no hay carrito, así que el bloque no se dibuja.
        </p>
      );

    case "columnas":
      return (
        <div className="space-y-4">
          {(["izq", "der"] as const).map((lado) => (
            <div key={lado} className="space-y-2">
              <div className="text-xs font-semibold text-muted">{lado === "izq" ? "Izquierda" : "Derecha"}</div>
              <ImagenDrop
                value={b[lado].imagen}
                onChange={(imagen) => set({ [lado]: { ...b[lado], imagen } } as Partial<Bloque>)}
                placeholder="URL de la imagen"
              />
              <Input
                fullWidth
                value={b[lado].url}
                placeholder="Link"
                onChange={(e) => set({ [lado]: { ...b[lado], url: e.target.value } } as Partial<Bloque>)}
              />
            </div>
          ))}
        </div>
      );

    case "video":
      return (
        <div className="space-y-3">
          <ImagenDrop value={b.imagen} onChange={(imagen) => set({ imagen })} placeholder="URL de la miniatura (imagen)" />
          <Input
            label="URL del video"
            fullWidth
            value={b.url}
            placeholder="https://youtube.com/…"
            onChange={(e) => set({ url: e.target.value })}
            hint="Ningún cliente de mail reproduce video adentro: se dibuja la miniatura con el ▶ y el click abre el link."
          />
        </div>
      );

    case "redes":
      return (
        <div className="space-y-2">
          {b.links.map((l, k) => (
            <div key={k} className="flex items-end gap-2">
              <Input
                label={k === 0 ? "Red" : undefined}
                className="w-28"
                value={l.red}
                placeholder="Instagram"
                onChange={(e) => set({ links: b.links.map((x, j) => (j === k ? { ...x, red: e.target.value } : x)) })}
              />
              <Input
                label={k === 0 ? "URL" : undefined}
                fullWidth
                value={l.url}
                placeholder="https://…"
                onChange={(e) => set({ links: b.links.map((x, j) => (j === k ? { ...x, url: e.target.value } : x)) })}
              />
              <button
                type="button"
                onClick={() => set({ links: b.links.filter((_, j) => j !== k) })}
                aria-label={`Quitar ${l.red || "la red"}`}
                className="mb-2.5 text-danger-foreground transition-opacity hover:opacity-70"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ links: [...b.links, { red: "", url: "" }] })}
            className="rounded-lg border border-border-strong px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-muted"
          >
            + Agregar red
          </button>
        </div>
      );

    case "divisor":
      return <p className="text-sm text-muted">Una línea horizontal para separar secciones. No tiene nada que configurar acá; el color y el grosor van en la pestaña Estilo.</p>;
  }
}

/**
 * Color propio del bloque, de los que NO pasan por la cascada.
 *
 * Son los dos `bg` que existen desde antes del motor de estilos (`hero` y
 * `seccion`) y que el renderer usa para calcular la legibilidad del texto de
 * adentro. Quedan como color libre a propósito: moverlos a la cascada es cambiar
 * la forma del Json de todo mail guardado, y eso tiene su propia migración.
 */
function ColorFijo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded border border-border-strong bg-background"
        />
        <span className="w-16 text-xs tabular-nums text-muted">{value}</span>
      </span>
    </label>
  );
}
