"use client";

import { useState } from "react";
import { ETIQUETA_BLOQUE, TIPOS_BLOQUE, type Bloque, type TipoBloque } from "@/lib/email/render";
import {
  AlignLeft, ChevronDown, ChevronUp, Columns2, Copy, GripVertical, ImageIcon,
  LayoutTemplate, Minus, MousePointerClick, MoveVertical, PanelTop, Play, Plus,
  Share2, ShoppingBag, ShoppingCart, Ticket, Trash2, Type,
} from "lucide-react";

/**
 * La columna izquierda del editor: qué bloques tiene el mail y en qué orden.
 *
 * Cada fila es UN renglón. Antes cada bloque abría su formulario entero acá
 * adentro, y con diez bloques la lista medía tres pantallas: mover el segundo al
 * final era scrollear a ciegas. Ahora el formulario vive en el panel de al lado
 * y esta lista es el mapa del mail.
 *
 * **Arrastrar es HTML5 nativo, sin dependencias.** Es una lista vertical de un
 * solo contenedor, que es el caso que `draggable` resuelve bien; `@dnd-kit` son
 * tres paquetes y ~40 KB en un bundle que ya lleva el renderer entero.
 *
 * ⚠️ El costo de eso es que **no anda con touch**: el editor es de escritorio y
 * las flechas ↑↓ cubren el táctil y el teclado. La API de acá afuera es
 * `onReorder(desde, hasta)` justamente para que cambiar el motor de arrastre sea
 * reemplazar este archivo y nada más.
 */

const ICONO: Record<TipoBloque, typeof Type> = {
  encabezado: PanelTop,
  hero: LayoutTemplate,
  seccion: AlignLeft,
  cupon: Ticket,
  titulo: Type,
  texto: AlignLeft,
  boton: MousePointerClick,
  imagen: ImageIcon,
  productos: ShoppingBag,
  carrito: ShoppingCart,
  columnas: Columns2,
  video: Play,
  redes: Share2,
  divisor: Minus,
  espaciador: MoveVertical,
};

/** Una línea de contexto para reconocer el bloque sin abrirlo. */
function resumen(b: Bloque): string {
  switch (b.tipo) {
    case "encabezado":
      return b.variante === "logo" ? "Logo" : b.texto?.trim() || "El nombre de la marca";
    case "titulo":
    case "texto":
      return b.texto.trim() || "—";
    case "boton":
      return b.texto.trim() || "—";
    case "hero":
    case "seccion":
      return b.titulo.trim() || "—";
    case "cupon":
      return b.codigo.trim() || "—";
    case "imagen":
      return b.url ? b.url.split("/").pop() ?? "" : "Sin imagen";
    case "productos":
      return b.items.length ? `${b.items.length} producto${b.items.length === 1 ? "" : "s"}` : "Sin productos";
    case "carrito":
      return "Se completa al enviar";
    case "columnas":
      return "Dos imágenes lado a lado";
    case "video":
      return b.url || "Sin link";
    case "redes":
      return b.links.map((l) => l.red).filter(Boolean).join(", ") || "Sin redes";
    case "divisor":
      return "—";
    case "espaciador":
      return `${b.alto ?? 24}px`;
  }
}

export function ListaBloques({
  bloques,
  seleccionadoId,
  onSeleccionar,
  onReorder,
  onDuplicar,
  onBorrar,
  onInsertar,
  soloLectura = false,
}: {
  bloques: Bloque[];
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  /** Mover el bloque de `desde` para que quede en la posición `hasta`. */
  onReorder: (desde: number, hasta: number) => void;
  onDuplicar: (i: number) => void;
  onBorrar: (i: number) => void;
  onInsertar: (tipo: TipoBloque, i: number) => void;
  soloLectura?: boolean;
}) {
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const [paletaEn, setPaletaEn] = useState<number | null>(null);

  // El encabezado se dibuja fuera de la tarjeta del mail: hay uno solo y va
  // primero. Por eso no se arrastra y nada se mete arriba de él — el renderer lo
  // subiría igual y la lista mostraría un orden que el mail no respeta.
  const hayEncabezado = bloques[0]?.tipo === "encabezado";
  const primerLibre = hayEncabezado ? 1 : 0;

  const soltarEn = (hueco: number) => {
    const desde = arrastrando;
    setArrastrando(null);
    setSobre(null);
    if (desde === null) return;
    const hasta = hueco > desde ? hueco - 1 : hueco;
    if (hasta !== desde) onReorder(desde, hasta);
  };

  // ⚠️ `Hueco` va como función que devuelve JSX y NO como componente definido
  // acá adentro: un componente declarado dentro del render es un tipo nuevo en
  // cada pasada, así que React desmonta y vuelve a montar el nodo. Con arrastre
  // encima eso cancela el `dragover` a mitad de camino y el drop nunca llega.
  const hueco = (i: number) => {
    const activo = arrastrando !== null;
    const marcado = sobre === i;
    return (
      <li key={`h${i}`} className={activo ? "py-1" : ""}>
        <div
          onDragOver={(e) => {
            if (!activo) return;
            e.preventDefault();
            setSobre(i);
          }}
          onDragLeave={() => setSobre((s) => (s === i ? null : s))}
          onDrop={(e) => {
            e.preventDefault();
            soltarEn(i);
          }}
          className={`group flex items-center justify-center transition-all ${
            activo ? "h-7 rounded-lg border-2 border-dashed" : "h-2"
          } ${marcado ? "border-accent bg-accent-subtle" : activo ? "border-border" : "border-transparent"}`}
        >
          {!activo && !soloLectura && (
            <button
              type="button"
              onClick={() => setPaletaEn((p) => (p === i ? null : i))}
              aria-label="Insertar un bloque acá"
              aria-expanded={paletaEn === i}
              className={`flex h-4 w-full items-center justify-center transition-opacity ${
                paletaEn === i ? "opacity-100" : "opacity-0 group-hover:opacity-60 focus-visible:opacity-100"
              }`}
            >
              <span className="h-px flex-1 bg-accent" />
              <span className="mx-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white">
                <Plus className="h-3 w-3" aria-hidden />
              </span>
              <span className="h-px flex-1 bg-accent" />
            </button>
          )}
        </div>
        {paletaEn === i && (
          <Paleta
            hayEncabezado={hayEncabezado}
            enCero={i === 0}
            onElegir={(tipo) => {
              setPaletaEn(null);
              onInsertar(tipo, i);
            }}
          />
        )}
      </li>
    );
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-0">
        {bloques.flatMap((b, i) => {
          const Icono = ICONO[b.tipo];
          const movible = !soloLectura && i >= primerLibre;
          const sel = b.id === seleccionadoId;
          return [
            ...(i >= primerLibre ? [hueco(i)] : []),
            <li key={b.id ?? i}>
              <div
                draggable={movible}
                onDragStart={(e) => {
                  setArrastrando(i);
                  e.dataTransfer.effectAllowed = "move";
                  // Firefox no arranca el arrastre sin datos adentro.
                  e.dataTransfer.setData("text/plain", String(i));
                }}
                onDragEnd={() => {
                  setArrastrando(null);
                  setSobre(null);
                }}
                onClick={() => b.id && onSeleccionar(b.id)}
                className={`flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors ${
                  sel ? "border-accent bg-accent-subtle" : "border-transparent hover:bg-surface-muted"
                } ${arrastrando === i ? "opacity-40" : ""}`}
              >
                <span className={`shrink-0 ${movible ? "cursor-grab text-subtle" : "text-transparent"}`}>
                  <GripVertical className="h-4 w-4" aria-hidden />
                </span>
                <Icono className={`h-4 w-4 shrink-0 ${sel ? "text-accent-subtle-foreground" : "text-muted"}`} aria-hidden />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => b.id && onSeleccionar(b.id)}
                >
                  <span className={`block truncate text-sm ${sel ? "font-medium text-accent-subtle-foreground" : "text-foreground"}`}>
                    {ETIQUETA_BLOQUE[b.tipo]}
                  </span>
                  <span className="block truncate text-xs text-subtle">{resumen(b)}</span>
                </button>
                {!soloLectura && (
                  <span className="flex shrink-0 items-center text-muted">
                    {movible && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onReorder(i, i - 1); }}
                          disabled={i <= primerLibre}
                          aria-label="Subir"
                          className="px-0.5 transition-colors hover:text-foreground disabled:opacity-25"
                        >
                          <ChevronUp className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onReorder(i, i + 1); }}
                          disabled={i >= bloques.length - 1}
                          aria-label="Bajar"
                          className="px-0.5 transition-colors hover:text-foreground disabled:opacity-25"
                        >
                          <ChevronDown className="h-4 w-4" aria-hidden />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDuplicar(i); }}
                      aria-label="Duplicar"
                      className="px-0.5 transition-colors hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onBorrar(i); }}
                      aria-label="Eliminar"
                      className="px-0.5 text-danger-foreground transition-opacity hover:opacity-70"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </span>
                )}
              </div>
            </li>,
          ];
        })}
        {hueco(bloques.length)}
      </ul>

      {!soloLectura && paletaEn === null && (
        <button
          type="button"
          onClick={() => setPaletaEn(bloques.length)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Agregar bloque
        </button>
      )}
    </div>
  );
}

function Paleta({
  hayEncabezado,
  enCero,
  onElegir,
}: {
  hayEncabezado: boolean;
  /** El encabezado solo se puede insertar arriba de todo, que es donde existe. */
  enCero: boolean;
  onElegir: (t: TipoBloque) => void;
}) {
  const disponibles = TIPOS_BLOQUE.filter((t) => t !== "encabezado" || (!hayEncabezado && enCero));
  return (
    <div className="my-1 grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-muted p-1.5">
      {disponibles.map((t) => {
        const Icono = ICONO[t];
        return (
          <button
            key={t}
            type="button"
            onClick={() => onElegir(t)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{ETIQUETA_BLOQUE[t]}</span>
          </button>
        );
      })}
    </div>
  );
}
