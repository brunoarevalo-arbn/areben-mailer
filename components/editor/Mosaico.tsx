"use client";

// El formulario del bloque `mosaico`: la foto, DÓNDE se corta, y el link de cada
// pedazo.
//
// 🔴 **Lo que se está editando no es un plano, es una GRILLA.** Un mail no puede
// tener zonas clickeables adentro de una imagen —`<map>`/`<area>` lo borra Gmail—,
// así que la única forma de que una parte de la foto lleve a un lado es que esa
// parte sea su propia imagen dentro de una celda de tabla. De ahí sale la única
// regla que esta pantalla tiene que dejar clarísima: **los cortes van en bandas y
// columnas**, no en rectángulos sueltos.
//
// Vive aparte de `FormBloque.tsx` por la misma razón que `FotoEncima.tsx`: ese
// archivo ya tiene un `switch` con 19 formularios y esto necesita estado propio
// —qué pedazo está elegido, qué corte está agarrado, cuántos pedazos ya se
// subieron—, y un hook no puede vivir adentro de un `case`.
//
// ⚠️ El arrastre va con **Pointer Events** y no con `draggable` de HTML5: los
// eventos `drag*` no se disparan en ningún navegador de celular y el panel se usa
// con el dedo. Las flechas del teclado mueven el mismo corte, así que también hay
// camino sin puntero.

import { useMemo, useRef, useState } from "react";
import { Scissors } from "lucide-react";
import { ImagenDrop } from "@/components/editor/ImagenDrop";
import { Input } from "@/components/ui/Input";
import { cortarEnPedazos } from "@/lib/imagenes";
import type { Bloque, CeldaMosaico, FilaMosaico } from "@/lib/email/bloques";
import {
  bordes, cuantosPedazos, estaCortado, GRILLA_ENTERA, MAX_CELDAS, MAX_FILAS, MAX_PEDAZOS,
  moverCorteCelda, moverCorteFila, normalizar, partirCelda, partirFila, PASO, quitarCelda,
  quitarFila, sinAlt, tirarPedazos,
} from "@/lib/email/mosaico";
import type { Paleta } from "@/lib/email/tema";

type BloqueMosaico = Extract<Bloque, { tipo: "mosaico" }>;

/** Cuál pedazo está elegido: su banda y su columna. */
interface Elegido {
  f: number;
  c: number;
}

/** El corte que está agarrado. `f` sólo existe en los verticales. */
type Agarre = { eje: "y"; i: number } | { eje: "x"; f: number; i: number };

/** Los acumulados de una lista de tamaños, para poder posicionar en %. */
const arranques = (partes: readonly number[]): number[] => [0, ...bordes(partes)];

export function FormMosaico({
  b,
  set,
  pal,
}: {
  b: BloqueMosaico;
  /** Parche sobre el bloque, el mismo `onChange` de `FormBloque`. */
  set: (patch: Partial<Bloque>) => void;
  pal: Paleta;
}) {
  // Se normaliza para DIBUJAR, no sólo para guardar: un documento que entró por
  // otro camino (pegado, editado a mano) tiene que verse en el editor con la misma
  // grilla que va a salir en el mail, no con la que dice el Json.
  const filas = useMemo(() => normalizar(b.filas), [b.filas]);
  const total = cuantosPedazos(filas);
  const cortado = estaCortado(filas);
  const mudos = sinAlt(filas);

  const [elegido, setElegido] = useState<Elegido>({ f: 0, c: 0 });
  const [cortando, setCortando] = useState<{ hechos: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // El elegido puede quedar fuera de rango al unir dos pedazos o al cambiar la
  // foto. Se acota al leerlo y no con un efecto: un `setState` en un efecto dibuja
  // una vez con el índice viejo, que acá sería el panel de otro pedazo.
  const f = Math.min(elegido.f, filas.length - 1);
  const c = Math.min(elegido.c, filas[f].celdas.length - 1);
  const celda = filas[f].celdas[c];

  /**
   * La grilla cambió de FORMA ⇒ los pedazos que había son de la grilla anterior.
   *
   * 🔴 Se tiran siempre, y eso es lo que hace que el editor no pueda mentir: con
   * los pedazos viejos puestos, el mail dibujaría los cortes de antes mientras la
   * pantalla muestra los nuevos. Sin pedazos, el mail vuelve a ser la foto entera
   * —que es como se veía antes de cortar— hasta que alguien vuelva a cortar.
   */
  const cambiarGrilla = (nuevas: FilaMosaico[]) => {
    setError(null);
    set({ filas: normalizar(tirarPedazos(nuevas)) } as Partial<Bloque>);
  };

  /** El link o el texto alternativo de un pedazo: NO invalida el corte. */
  const cambiarCelda = (campos: Partial<CeldaMosaico>) =>
    set({
      filas: filas.map((fila, i) =>
        i === f ? { ...fila, celdas: fila.celdas.map((x, j) => (j === c ? { ...x, ...campos } : x)) } : fila,
      ),
    } as Partial<Bloque>);

  /**
   * El ancho con el que se recortan los pedazos.
   *
   * Se usa el ancho del mail y no el ancho ÚTIL de este bloque: el margen lateral
   * es una perilla del panel de estilo, que este formulario no ve. Errar para
   * arriba es gratis (el pedazo se muestra más chico de lo que mide); errar para
   * abajo lo dejaría blando en una pantalla retina.
   */
  const anchoCorte = pal.ancho;

  const cortar = async () => {
    setError(null);
    setCortando({ hechos: 0, total });
    const nombre = b.foto.split("/").pop() || "foto";
    const mime = /\.png($|\?)/i.test(b.foto) ? "image/png" : /\.gif($|\?)/i.test(b.foto) ? "image/gif" : "image/jpeg";
    const r = await cortarEnPedazos(b.foto, nombre, mime, filas, anchoCorte, (hechos, t) =>
      setCortando({ hechos, total: t }),
    );
    setCortando(null);
    if (r.ok) set({ filas: r.filas } as Partial<Bloque>);
    else setError(r.error);
  };

  return (
    <div className="space-y-3">
      <ImagenDrop
        value={b.foto}
        // 🔴 Otra foto ⇒ la grilla vuelve a cero y el ratio se borra. Los cortes
        // eran de la foto anterior: dejarlos puestos cortaría la nueva por lugares
        // que nadie eligió, y los pedazos ya subidos son de la vieja.
        //
        // ⛔ Sin `formatos`: esta foto viene diseñada entera de afuera (Canva,
        // Photoshop). Recortarla a 16:9 acá sería pisarle el diseño antes de
        // cortarla en pedazos.
        onChange={(foto) => set({ foto, ratio: undefined, filas: GRILLA_ENTERA } as Partial<Bloque>)}
        placeholder="URL de la foto (https://…)"
      />

      {b.foto && (
        <Cortes
          foto={b.foto}
          filas={filas}
          elegido={{ f, c }}
          onElegir={setElegido}
          onGrilla={cambiarGrilla}
          // El ratio SÍ se pisa con una foto nueva, al revés que el alto de una
          // banda con textos encima: no es la elección de nadie, es una propiedad
          // de la imagen. Y sin él las bandas salen sin alto declarado, que es
          // justo donde reaparece el escalón de un píxel entre pedazos vecinos.
          onMedida={(ratio) => {
            if (b.ratio && Math.abs(b.ratio - ratio) < 0.001) return;
            set({ ratio } as Partial<Bloque>);
          }}
        />
      )}

      {b.foto && (
        <>
          <div className="flex flex-wrap gap-2">
            <Accion
              onClick={() => cambiarGrilla(partirFila(filas, f))}
              disabled={filas.length >= MAX_FILAS || total + filas[f].celdas.length > MAX_PEDAZOS}
            >
              Partir la banda ↕
            </Accion>
            <Accion
              onClick={() => cambiarGrilla(partirCelda(filas, f, c))}
              disabled={filas[f].celdas.length >= MAX_CELDAS || total + 1 > MAX_PEDAZOS}
            >
              Partir el pedazo ↔
            </Accion>
            {filas[f].celdas.length > 1 && (
              <Accion onClick={() => cambiarGrilla(quitarCelda(filas, f, c))}>Unir ↔</Accion>
            )}
            {filas.length > 1 && (
              <Accion onClick={() => cambiarGrilla(quitarFila(filas, f))}>Unir ↕</Accion>
            )}
          </div>

          {total >= MAX_PEDAZOS && (
            <p className="text-xs leading-relaxed text-muted">
              Doce pedazos es el tope. No es un límite de la grilla: cada pedazo es una imagen que
              se descarga <strong>una vez por destinatario</strong>, así que doce en un envío a
              16.800 contactos son 200.000 pedidos de imagen.
            </p>
          )}

          {/* 🔑 El botón sólo existe cuando hay algo que cortar y falta cortarlo.
              Con un solo pedazo la foto entera YA es el mosaico, y cortarla sería
              subir una copia de la misma imagen. */}
          {total > 1 && !cortado && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => void cortar()}
                disabled={!!cortando}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-border-strong px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted disabled:opacity-60 lg:min-h-0 lg:py-2"
              >
                <Scissors className="h-4 w-4" aria-hidden />
                {cortando
                  ? `Cortando… ${cortando.hechos} de ${cortando.total}`
                  : `Cortar la foto en ${total} pedazos`}
              </button>
              <p className="text-xs leading-relaxed text-muted">
                Hasta que no la cortes, el mail sale con <strong>la foto entera y sin ningún
                link</strong>: una grilla a medio cortar dibujaría dos pedazos y cuatro huecos en la
                casilla de la otra persona.
              </p>
            </div>
          )}

          {error && <div className="text-xs text-danger-foreground">{error}</div>}

          {/* El pedazo elegido: su destino y lo que se lee sin imágenes. Es el
              único lugar del bloque donde se escribe algo, y por eso está abajo de
              la superficie y no plegado en "Más opciones". */}
          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className="text-xs font-semibold text-muted">
              {total > 1 ? `Pedazo ${f + 1}.${c + 1} de ${total}` : "La foto entera"}
            </p>
            <Input
              label="Link"
              fullWidth
              value={celda.enlace ?? ""}
              placeholder="https://…"
              onChange={(e) => cambiarCelda({ enlace: e.target.value.trim() || undefined })}
              hint="A dónde lleva tocar este pedazo. Vacío, este pedazo no se puede clickear."
            />
            <Input
              label="Texto alternativo"
              fullWidth
              value={celda.alt ?? ""}
              onChange={(e) => cambiarCelda({ alt: e.target.value })}
              hint="Lo que se lee cuando el cliente de mail bloquea las imágenes — que es el caso por defecto en Outlook. Cortito: entra en el ancho del pedazo."
            />
          </div>

          {/* 🔴 El precio de este bloque, cobrado a la vista y no escondido. Una
              pieza que es 100% imagen no dice UNA LETRA con las fotos apagadas, y
              su gemelo en texto plano —de donde el buzón saca el preview— sale
              vacío, que es la señal de spam más vieja que hay. */}
          {mudos > 0 && (
            <p className="text-xs leading-relaxed text-danger-foreground">
              ⚠️ {mudos === total ? "Ningún pedazo tiene" : `${mudos} de ${total} pedazos no tienen`}{" "}
              texto alternativo. Con las imágenes apagadas ese pedazo no dice nada, y la versión en
              texto del mail sale sin esa línea.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Un botón de la barra de cortes. 44px de alto abajo de `lg`: se toca. */
function Accion({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 rounded-lg border border-border-strong px-2.5 text-xs text-muted transition-colors hover:bg-surface-muted disabled:opacity-40 lg:min-h-0 lg:py-1"
    >
      {children}
    </button>
  );
}

/**
 * La foto con los cortes encima: elegir un pedazo, y arrastrar una línea.
 *
 * 🔑 **La foto se dibuja tal cual y todo lo demás va posicionado en % sobre
 * ella**, así que lo que se ve acá es exactamente la grilla que el renderer va a
 * repartir en píxeles. No hay una segunda geometría: los porcentajes son los
 * mismos números que se guardan.
 */
function Cortes({
  foto,
  filas,
  elegido,
  onElegir,
  onGrilla,
  onMedida,
}: {
  foto: string;
  filas: FilaMosaico[];
  elegido: Elegido;
  onElegir: (e: Elegido) => void;
  onGrilla: (filas: FilaMosaico[]) => void;
  /** Alto sobre ancho de la foto, en cuanto el navegador la mide. */
  onMedida: (ratio: number) => void;
}) {
  const marco = useRef<HTMLDivElement>(null);
  const agarre = useRef<Agarre | null>(null);
  /**
   * La grilla mientras se arrastra. Va en estado aparte y **no se guarda en cada
   * `pointermove`**: el documento entero se re-serializa en cada cambio y cada
   * cambio tira los pedazos, así que guardar por píxel sería cincuenta escrituras
   * y cincuenta invalidaciones por arrastre. Se guarda al soltar, como el
   * deslizador de encuadre.
   */
  const [vista, setVista] = useState<FilaMosaico[] | null>(null);
  const [aviso, setAviso] = useState("");

  const g = vista ?? filas;
  const topes = arranques(g.map((x) => x.alto));

  const pctDe = (e: { clientX: number; clientY: number }, eje: "x" | "y"): number | null => {
    const r = marco.current?.getBoundingClientRect();
    if (!r?.width || !r.height) return null;
    return eje === "y" ? ((e.clientY - r.top) / r.height) * 100 : ((e.clientX - r.left) / r.width) * 100;
  };

  /** Mover el corte agarrado hasta `pct`, sin guardar. */
  const mover = (a: Agarre, pct: number) =>
    setVista(a.eje === "y" ? moverCorteFila(filas, a.i, pct) : moverCorteCelda(filas, a.f, a.i, pct));

  const soltar = () => {
    const a = agarre.current;
    agarre.current = null;
    const v = vista;
    setVista(null);
    if (!a || !v) return;
    onGrilla(v);
    setAviso("Los cortes cambiaron: hay que volver a cortar la foto.");
  };

  /** Un paso de teclado sobre un corte: mueve y guarda, que es el camino sin puntero. */
  const conTecla = (a: Agarre, delta: number) => {
    const partes = a.eje === "y" ? filas.map((x) => x.alto) : filas[a.f].celdas.map((x) => x.ancho);
    const destino = partes.slice(0, a.i + 1).reduce((x, y) => x + y, 0) + delta;
    onGrilla(a.eje === "y" ? moverCorteFila(filas, a.i, destino) : moverCorteCelda(filas, a.f, a.i, destino));
    setAviso("Los cortes cambiaron: hay que volver a cortar la foto.");
  };

  /** Los tres handlers que comparten todas las líneas de corte. */
  const gestos = (a: Agarre) => ({
    style: { touchAction: "none" as const },
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      // Con la captura, el `move` y el `up` siguen llegando a ESTA línea aunque el
      // puntero se le vaya: soltar rápido dejaba la línea pegada al dedo.
      e.currentTarget.setPointerCapture(e.pointerId);
      agarre.current = a;
      setVista(filas);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!agarre.current) return;
      const pct = pctDe(e, a.eje);
      if (pct !== null) mover(a, pct);
    },
    onPointerUp: soltar,
    // Un `pointercancel` (una llamada, el gesto de atrás del sistema) no es un
    // soltar: el corte vuelve a donde estaba.
    onPointerCancel: () => {
      agarre.current = null;
      setVista(null);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      const d = a.eje === "y"
        ? { ArrowUp: -PASO, ArrowDown: PASO }[e.key]
        : { ArrowLeft: -PASO, ArrowRight: PASO }[e.key];
      if (d === undefined) return;
      e.preventDefault();
      conTecla(a, d);
    },
  });

  return (
    <div className="space-y-1">
      <div ref={marco} className="relative w-full select-none overflow-hidden rounded-lg border border-border-strong">
        {/* eslint-disable-next-line @next/next/no-img-element -- es una URL de
            afuera (la biblioteca de imágenes o la tienda) y quien la sirve es el
            mail, no Next: optimizarla acá no cambia nada de lo que se envía.
            Además es la que le da el alto al marco, así que no lleva `absolute`. */}
        <img
          src={foto}
          alt=""
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth > 0) onMedida(img.naturalHeight / img.naturalWidth);
          }}
          className="pointer-events-none block w-full"
        />

        {/* Un botón por pedazo: es lo que se elige para ponerle el link. */}
        {g.map((fila, i) => {
          const lados = arranques(fila.celdas.map((x) => x.ancho));
          return fila.celdas.map((cel, j) => (
            <button
              key={`${i}-${j}`}
              type="button"
              onClick={() => onElegir({ f: i, c: j })}
              style={{ top: `${topes[i]}%`, left: `${lados[j]}%`, height: `${fila.alto}%`, width: `${cel.ancho}%` }}
              className={`absolute flex items-end justify-start p-1 ring-inset ${
                elegido.f === i && elegido.c === j ? "ring-2 ring-ring" : "ring-1 ring-white/40 hover:ring-2 hover:ring-border-strong"
              }`}
              aria-label={`Pedazo ${i + 1}.${j + 1}${cel.enlace ? `, lleva a ${cel.enlace}` : ", sin link"}`}
            >
              {/* El punto que dice "este pedazo lleva a algún lado". Sin esto, un
                  mosaico de seis pedazos con un solo link se ve idéntico a uno con
                  seis, y el link que falta no se encuentra nunca. */}
              {cel.enlace && <span className="h-2 w-2 rounded-full bg-accent ring-1 ring-white" aria-hidden />}
            </button>
          ));
        })}

        {/* Las líneas horizontales: separan una banda de la siguiente. */}
        {bordes(g.map((x) => x.alto)).map((pos, i) => {
          const gs = gestos({ eje: "y", i });
          return (
            <div
              key={`y${i}`}
              role="slider"
              tabIndex={0}
              aria-label={`Corte horizontal ${i + 1}`}
              aria-valuenow={Math.round(pos)}
              aria-valuemin={0}
              aria-valuemax={100}
              {...gs}
              style={{ ...gs.style, top: `${pos}%` }}
              className="absolute left-0 h-6 w-full -translate-y-1/2 cursor-ns-resize before:absolute before:top-1/2 before:h-0.5 before:w-full before:-translate-y-1/2 before:bg-accent"
            />
          );
        })}

        {/* Las verticales: son POR BANDA, porque cada banda es una fila de la
            tabla y puede tener sus propias columnas. Es la diferencia entre una
            grilla y un plano, y acá se ve. */}
        {g.map((fila, i) => {
          const lados = bordes(fila.celdas.map((x) => x.ancho));
          return lados.map((pos, k) => {
            const gs = gestos({ eje: "x", f: i, i: k });
            return (
              <div
                key={`x${i}-${k}`}
                role="slider"
                tabIndex={0}
                aria-label={`Corte vertical ${k + 1} de la banda ${i + 1}`}
                aria-valuenow={Math.round(pos)}
                aria-valuemin={0}
                aria-valuemax={100}
                {...gs}
                style={{ ...gs.style, left: `${pos}%`, top: `${topes[i]}%`, height: `${fila.alto}%` }}
                className="absolute w-6 -translate-x-1/2 cursor-ew-resize before:absolute before:left-1/2 before:h-full before:w-0.5 before:-translate-x-1/2 before:bg-accent"
              />
            );
          });
        })}
      </div>
      {/* El renglón que cuenta qué pasó: sin esto, arrastrar un corte y que los
          pedazos se hayan invalidado se ve igual que no haber hecho nada. */}
      <p aria-live="polite" className="min-h-4 text-xs text-subtle">
        {aviso || "Tocá un pedazo para ponerle su link. Arrastrá una línea, o movela con las flechas."}
      </p>
    </div>
  );
}
