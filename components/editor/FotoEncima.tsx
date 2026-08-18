"use client";

// El formulario del bloque `foto-encima`: la foto, y una SUPERFICIE donde lo de
// encima se agarra y se suelta.
//
// Vive aparte de `FormBloque.tsx` por dos razones, y la segunda es la que obliga:
// ese archivo ya tiene 18 formularios en un `switch`, y **esto necesita estado
// propio** (cuál ficha está agarrada, cuál elegida, qué avisar) — un hook no
// puede vivir adentro de un `case`.
//
// 🔴 **La superficie es del PANEL y no de la vista previa.** El iframe del preview
// va con `sandbox="allow-same-origin"` y sin scripts (ver `PreviewMail.tsx`), así
// que ahí no hay dónde escuchar un arrastre; y colgarse de él acoplaría el editor
// al HTML del mail, que es una tabla armada para Outlook. Acá se dibuja la MISMA
// geometría con divs: la foto de fondo, el velo, y una ficha por elemento.
//
// ⚠️ El arrastre va con **Pointer Events** y no con `draggable` de HTML5: los
// eventos `drag*` no se disparan en ningún navegador de celular, y el panel se usa
// con el dedo (ver `auditar-responsive.ts`). Las flechas del teclado hacen lo
// mismo, así que también hay camino sin puntero.

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { ColorFijo } from "@/components/editor/ColorFijo";
import { ImagenDrop } from "@/components/editor/ImagenDrop";
import { Rango } from "@/components/editor/Rango";
import { Desplegable } from "@/components/ui/Desplegable";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { nuevoId, type Bloque, type ClaseEncima, type ElementoEncima } from "@/lib/email/render";
import {
  ANCHO_MIN, MAX_ELEMENTOS, PASO_X, PASO_Y, sePisan, snap, type CajaEncima,
} from "@/lib/email/encima";
import type { Paleta } from "@/lib/email/tema";

type BloqueFoto = Extract<Bloque, { tipo: "foto-encima" }>;

/** Cómo se llama cada cosa que va encima de una foto, para quien arma el mail. */
const ETIQUETA_CLASE: Record<ClaseEncima, string> = {
  titulo: "Título",
  texto: "Texto",
  boton: "Botón",
};

/** Un texto largo, en algo que quepa en un aviso. */
const corto = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** El ancho que ocupa un elemento cuando no lo eligió nadie: hasta el borde. */
const anchoDe = (el: ElementoEncima) => el.ancho ?? Math.max(ANCHO_MIN, 100 - el.x);

export function FormFotoEncima({
  b,
  set,
  pal,
}: {
  b: BloqueFoto;
  /** Parche sobre el bloque, el mismo `onChange` de `FormBloque`. */
  set: (patch: Partial<Bloque>) => void;
  pal: Paleta;
}) {
  const elementos = b.elementos ?? [];
  const [elegido, setElegido] = useState<string | null>(elementos[0]?.id ?? null);

  // Se reescribe la lista entera, igual que `celdas` en `columnas`: `set` hace un
  // merge superficial, así que mutar un elemento sin devolver el array nuevo le
  // deja a React la misma referencia y el panel no se redibuja.
  const setEl = (id: string, campos: Partial<ElementoEncima>) =>
    set({ elementos: elementos.map((el) => (el.id === id ? { ...el, ...campos } : el)) } as Partial<Bloque>);

  const agregar = (clase: ClaseEncima) => {
    const id = nuevoId();
    // Cada uno nace más abajo que el anterior: con el mismo `y` saldrían uno al
    // lado del otro —es una fila— y parece que el segundo no se agregó.
    const y = snap(Math.min(90, 10 + elementos.length * 20), PASO_Y);
    set({
      elementos: [
        ...elementos,
        {
          id,
          clase,
          texto: clase === "boton" ? "Comprar" : clase === "titulo" ? "Título" : "Un texto encima",
          ...(clase === "boton" ? { url: "" } : null),
          x: 8,
          y,
          ancho: 84,
        },
      ],
    } as Partial<Bloque>);
    setElegido(id);
  };

  /**
   * El alto de la banda sale del TAMAÑO REAL de la foto, para que entre entera.
   *
   * 🔑 Sólo mientras nadie lo haya elegido (`alto` ausente): una vez que alguien
   * movió la perilla, una foto nueva no se la pisa — ese es exactamente el bug de
   * "el panel dice 320 y el mail dibuja otra cosa".
   *
   * ⚠️ Llega desde el `onLoad` de la superficie, que sólo existe mientras ESTE
   * bloque está elegido: si se cambia de bloque, el componente se desmonta y el
   * parche no llega nunca. Es lo que evita que una medida que tardó le escriba el
   * alto al bloque siguiente — `editar()` parchea "el elegido", no "este".
   */
  const alMedirLaFoto = (ratio: number) => {
    if (b.alto !== undefined) return;
    set({ alto: Math.min(600, Math.max(120, Math.round(pal.ancho * ratio))) } as Partial<Bloque>);
  };

  return (
    <div className="space-y-3">
      <ImagenDrop value={b.foto} onChange={(foto) => set({ foto })} placeholder="URL de la foto de fondo" />
      {b.foto && (
        <Superficie
          b={b}
          pal={pal}
          elegido={elegido}
          onElegir={setElegido}
          onMover={(id, x, y) => setEl(id, { x, y })}
          onMedida={alMedirLaFoto}
        />
      )}
      <Rango
        label="Alto de la banda"
        value={b.alto ?? 280}
        onChange={(alto) => set({ alto })}
        min={120}
        max={600}
        step={10}
      />
      <Rango label="Cuánto se tapa la foto" value={b.velo ?? 0} onChange={(velo) => set({ velo })} min={0} max={90} step={5} />
      <ColorFijo label="Color de respaldo y del velo" value={b.bg} onChange={(bg) => set({ bg })} />
      <p className="text-xs text-subtle">
        Si la foto no carga —Outlook las bloquea— queda el color solo, con los textos encima. Outlook
        tampoco puede medir el texto: si queda apretado, subí el alto.
      </p>
      {elementos.map((el, i) => (
        <Desplegable
          // 🔑 El `key` lleva si está elegido, así el desplegable se REMONTA al
          // tocar su ficha y `abiertoDeFabrica` vuelve a decidir. Es la única
          // forma de abrirlo desde afuera sin controlar el `<details>`, que es
          // justo lo que su comentario prohíbe (pisaría a quien lo cerró a mano).
          key={`${el.id ?? i}-${elegido === el.id}`}
          tono="rol"
          titulo={`${ETIQUETA_CLASE[el.clase] ?? "Texto"} ${i + 1}`}
          abiertoDeFabrica={elegido === el.id}
          resumen={el.texto?.trim() || "sin texto"}
        >
          <Select
            label="Qué es"
            fullWidth
            value={el.clase}
            onChange={(e) => setEl(el.id!, { clase: e.target.value as ClaseEncima })}
          >
            <option value="titulo">Título</option>
            <option value="texto">Texto</option>
            <option value="boton">Botón</option>
          </Select>
          <Input
            label="Texto"
            fullWidth
            value={el.texto}
            placeholder={el.clase === "boton" ? "Comprar" : "Lo que dice"}
            hint={el.texto?.trim() ? undefined : "Vacío no se dibuja."}
            onChange={(e) => setEl(el.id!, { texto: e.target.value })}
          />
          {el.clase === "boton" && (
            <Input
              label="Link del botón"
              fullWidth
              value={el.url ?? ""}
              placeholder="https://…"
              onChange={(e) => setEl(el.id!, { url: e.target.value })}
            />
          )}
          {/* Los números quedan al lado del arrastre y no en su lugar: son el
              camino de teclado, el que sirve para el último píxel, y el único que
              puede decir "exactamente 50". */}
          <div className="grid grid-cols-2 gap-2">
            <Rango label="Desde la izquierda" value={el.x} onChange={(x) => setEl(el.id!, { x })} min={0} max={95} step={PASO_X} sufijo="%" />
            <Rango label="Desde arriba" value={el.y} onChange={(y) => setEl(el.id!, { y })} min={0} max={100} step={PASO_Y} sufijo="%" />
          </div>
          <Rango
            label="Ancho"
            value={el.ancho ?? 100 - el.x}
            onChange={(ancho) => setEl(el.id!, { ancho })}
            min={ANCHO_MIN}
            max={100}
            step={1}
            sufijo="%"
          />
          <button
            type="button"
            onClick={() => set({ elementos: elementos.filter((o) => o.id !== el.id) } as Partial<Bloque>)}
            className="flex items-center gap-1 text-xs text-danger-foreground transition-opacity hover:opacity-70"
          >
            <X className="h-3.5 w-3.5" aria-hidden /> Quitar
          </button>
        </Desplegable>
      ))}
      {elementos.length < MAX_ELEMENTOS ? (
        <div className="flex flex-wrap gap-2">
          {(["titulo", "texto", "boton"] as const).map((clase) => (
            <button
              key={clase}
              type="button"
              onClick={() => agregar(clase)}
              className="min-h-11 rounded-lg border border-border-strong px-2.5 text-xs text-muted transition-colors hover:bg-surface-muted lg:min-h-0 lg:py-1"
            >
              + {ETIQUETA_CLASE[clase]}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-subtle">
          Ocho es el tope: cada uno se lleva su celda y más angosto que eso no entra una palabra.
        </p>
      )}
    </div>
  );
}

/**
 * La foto con las fichas encima: agarrar, mover, soltar.
 *
 * Dibuja la misma geometría que el mail —`background-size:cover` es `object-cover`,
 * el velo es el color con opacidad, y el alto de la banda sale del `aspect-ratio`
 * contra el ancho del mail—, así que lo que se ve acá es lo que sale… **salvo el
 * alto de cada texto**, que en el mail lo decide el cliente de correo. Por eso el
 * freno de "no se pisan" mide el alto REAL de cada ficha en la pantalla y no uno
 * inventado: es la mejor aproximación que hay, y del lado seguro.
 */
function Superficie({
  b,
  pal,
  elegido,
  onElegir,
  onMover,
  onMedida,
}: {
  b: BloqueFoto;
  pal: Paleta;
  elegido: string | null;
  onElegir: (id: string) => void;
  onMover: (id: string, x: number, y: number) => void;
  /** El alto sobre el ancho de la foto, en cuanto el navegador la mide. */
  onMedida: (ratio: number) => void;
}) {
  const marco = useRef<HTMLDivElement>(null);
  /** Cada ficha en el DOM, para poder MEDIR su alto: ver `CajaEncima`. */
  const fichas = useRef(new Map<string, HTMLElement>());
  /** Dónde arrancó el arrastre. En un ref y no en estado: cambia en cada `move`. */
  const inicio = useRef<{ px: number; py: number; x: number; y: number; w: number; h: number } | null>(null);
  const [arrastre, setArrastre] = useState<{ id: string; x: number; y: number; choca: string | null } | null>(null);
  const [aviso, setAviso] = useState("");

  const elementos = b.elementos ?? [];
  const alto = b.alto ?? 280;

  const cajaDe = (el: ElementoEncima, x = el.x, y = el.y): CajaEncima => {
    const r = marco.current?.getBoundingClientRect();
    const nodo = el.id ? fichas.current.get(el.id) : undefined;
    // Antes del primer layout no hay qué medir: 12% es lo que ocupa un renglón en
    // una banda de 280, y es lo bastante grande para que el freno no arranque
    // suelto — un alto de 0 dejaría soltar todo encima de todo.
    const altoPct = r?.height && nodo ? (nodo.offsetHeight / r.height) * 100 : 12;
    return { x, y, ancho: anchoDe(el), alto: altoPct };
  };

  /** Con qué se pisaría si se suelta acá. `null` = con nada. */
  const choqueCon = (el: ElementoEncima, x: number, y: number): string | null =>
    elementos.find((o) => o.id !== el.id && o.texto?.trim() && sePisan(cajaDe(el, x, y), cajaDe(o)))?.texto ?? null;

  /** Mover una ficha, si ahí no se pisa con otra. Devuelve qué avisar. */
  const intentar = (el: ElementoEncima, x: number, y: number) => {
    const choca = choqueCon(el, x, y);
    if (choca) {
      setAviso(`Ahí se pisa con «${corto(choca)}»: un mail no puede superponer dos cosas.`);
      return;
    }
    onMover(el.id!, x, y);
    setAviso(`«${corto(el.texto)}»: ${x}% desde la izquierda, ${y}% desde arriba.`);
  };

  const soltar = (el: ElementoEncima) => {
    const a = arrastre;
    inicio.current = null;
    setArrastre(null);
    if (!a || a.id !== el.id) return;
    if (a.choca) {
      setAviso(`Ahí se pisa con «${corto(a.choca)}»: quedó donde estaba.`);
      return;
    }
    if (a.x !== el.x || a.y !== el.y) intentar(el, a.x, a.y);
  };

  return (
    <div className="space-y-1">
      <div
        ref={marco}
        // El ancho del mail contra el alto de la banda: la misma proporción que va
        // a tener en el correo, sea cual sea el ancho que le toque al panel.
        style={{ aspectRatio: `${pal.ancho} / ${alto}`, backgroundColor: b.bg || pal.tarjeta }}
        className="relative w-full select-none overflow-hidden rounded-lg border border-border-strong"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- es una URL de
            afuera (la biblioteca de imágenes o la tienda) y el que la sirve es el
            mail, no Next: optimizarla acá no cambia nada de lo que se envía. */}
        <img
          src={b.foto}
          alt=""
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth > 0) onMedida(img.naturalHeight / img.naturalWidth);
          }}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        {/* El velo: el color de la banda con opacidad encima de la foto, que es lo
            mismo que el `linear-gradient` del mail hace con `rgba`. */}
        <div
          aria-hidden
          style={{ backgroundColor: b.bg || pal.tarjeta, opacity: (b.velo ?? 0) / 100 }}
          className="pointer-events-none absolute inset-0"
        />
        {elementos.map((el, i) => {
          const enMano = arrastre?.id === el.id;
          const x = enMano ? arrastre!.x : el.x;
          const y = enMano ? arrastre!.y : el.y;
          const pisa = enMano && !!arrastre!.choca;
          return (
            <button
              key={el.id ?? i}
              ref={(n) => {
                if (!el.id) return;
                if (n) fichas.current.set(el.id, n);
                else fichas.current.delete(el.id);
              }}
              type="button"
              // `touch-action:none` o el navegador se queda el gesto para
              // scrollear y el arrastre no ocurre nunca en un teléfono.
              style={{ left: `${x}%`, top: `${y}%`, width: `${anchoDe(el)}%`, touchAction: "none" }}
              className={`absolute cursor-grab rounded bg-surface/80 px-1.5 py-1 text-left text-xs text-foreground ring-2 ${
                pisa
                  ? "ring-danger-border"
                  : elegido === el.id
                    ? "ring-ring"
                    : "ring-transparent hover:ring-border-strong"
              }`}
              aria-label={`${ETIQUETA_CLASE[el.clase]}: ${el.texto || "sin texto"}. Flechas para mover.`}
              onPointerDown={(e) => {
                const r = marco.current?.getBoundingClientRect();
                if (!r?.width || !el.id) return;
                // Con la captura, el `move` y el `up` siguen llegando a ESTA ficha
                // aunque el puntero se vaya de ella — o soltar rápido dejaba la
                // ficha pegada al dedo.
                e.currentTarget.setPointerCapture(e.pointerId);
                inicio.current = { px: e.clientX, py: e.clientY, x: el.x, y: el.y, w: r.width, h: r.height };
                onElegir(el.id);
                setArrastre({ id: el.id, x: el.x, y: el.y, choca: null });
              }}
              onPointerMove={(e) => {
                const i0 = inicio.current;
                if (!i0 || arrastre?.id !== el.id) return;
                const x2 = Math.min(snap(i0.x + ((e.clientX - i0.px) / i0.w) * 100, PASO_X), 100 - ANCHO_MIN);
                const y2 = snap(i0.y + ((e.clientY - i0.py) / i0.h) * 100, PASO_Y);
                setArrastre({ id: el.id!, x: x2, y: y2, choca: choqueCon(el, x2, y2) });
              }}
              onPointerUp={() => soltar(el)}
              // Un `pointercancel` (una llamada, el gesto de atrás del sistema) no
              // es un soltar: la ficha vuelve a donde estaba.
              onPointerCancel={() => {
                inicio.current = null;
                setArrastre(null);
              }}
              onKeyDown={(e) => {
                const d = { ArrowLeft: [-PASO_X, 0], ArrowRight: [PASO_X, 0], ArrowUp: [0, -PASO_Y], ArrowDown: [0, PASO_Y] }[e.key];
                if (!d) return;
                // El scroll de la página no se lleva la flecha cuando la ficha
                // tiene el foco: acá la tecla significa mover esto.
                e.preventDefault();
                intentar(
                  el,
                  Math.min(Math.max(el.x + d[0], 0), 100 - ANCHO_MIN),
                  Math.min(Math.max(el.y + d[1], 0), 100),
                );
              }}
            >
              <span className="block truncate">{el.texto || `(${ETIQUETA_CLASE[el.clase].toLowerCase()} sin texto)`}</span>
            </button>
          );
        })}
      </div>
      {/* El renglón que cuenta qué pasó, como el del portapapeles: sin esto, un
          arrastre rechazado se ve igual que uno que no se registró. */}
      <p aria-live="polite" className="min-h-4 text-xs text-subtle">
        {aviso || "Arrastrá lo que va encima, o movelo con las flechas. No se pueden superponer."}
      </p>
    </div>
  );
}
