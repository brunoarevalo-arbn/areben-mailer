"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bold, Italic, Underline, Link2, Highlighter, Baseline, Eraser } from "lucide-react";
import {
  CLAVES_FORMATO,
  MAX_TROZOS,
  aTrozos,
  ajustarSeleccion,
  aplicarFormato,
  canonizar,
  formatoEn,
  fusionar,
  negritasATrozos,
  sanearFormato,
  tieneFormato,
  tieneTodo,
  textoPlano,
  trozoCss,
  type ClaveFormato,
  type Formato,
  type TextoRico,
  type Trozo,
} from "@/lib/email/texto-rico";
import { RANGOS, type ValorColor } from "@/lib/email/estilos";
import { FUENTES, FUENTE_LABEL, type Paleta } from "@/lib/email/tema";
import { ControlColor } from "@/components/editor/ControlEstilo";
import { campoCompacto, tapTarget } from "@/lib/ui";

/**
 * El editor de un campo con formato por selección.
 *
 * Reemplaza al `<Input>`/`<Textarea>` en los ocho campos que el motor declara
 * ricos (`CAMPOS_RICOS`). Hasta que existió, el motor estaba **deployado y
 * apagado**: nadie podía crear un trozo porque no había con qué.
 *
 * ─── Por qué NO es un componente controlado ──────────────────────────────────
 *
 * 🔑 **Mientras el campo tiene el foco, el DOM es la fuente de verdad.** React no
 * puede repintar el contenido de un `contenteditable` en cada tecla sin
 * destruirle el cursor a quien está escribiendo: repintar es reemplazar los
 * nodos, y la selección del navegador apunta a nodos. Así que se pinta una vez
 * al montar, cada tecla LEE el DOM y avisa para arriba, y sólo se vuelve a
 * pintar cuando el valor que baja **no es el último que subió** — que son
 * exactamente dos casos: ⌘Z y elegir otro bloque.
 *
 * ─── La selección viaja como dos números ─────────────────────────────────────
 *
 * 🔑 Todo lo que se puede romper vive en `lib/email/texto-rico.ts` y trabaja
 * sobre **offsets del texto plano**. Este archivo solo traduce: `Range` → dos
 * números antes de aplicar, dos números → `Range` después. Es lo que deja que
 * partir, fusionar y colapsar los trozos lo pruebe un script de Node, porque
 * **nada de lo que pasa adentro de un `contenteditable` lo ve un test**.
 */

// ─────────────────────────────────────────────────────────────────────────────
// El puente con el DOM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El `<br>` de más que va SIEMPRE al final de un campo multilínea.
 *
 * ⚠️ Un `<br>` final no dibuja el renglón que abre: el navegador lo trata como
 * el cierre del último y no hay dónde poner el cursor. Es el motivo por el que
 * un Enter al final de un `contenteditable` "no hace nada" en todos lados. El
 * centinela ocupa ese lugar; `medir`, `punto` y `leerDom` lo saltean, así que no
 * existe para el dato.
 */
const esFin = (n: Node): boolean =>
  n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).dataset.fin !== undefined;

/** El formato guardado en el `data-f` de un `<span>`, o `null` si no lo declara. */
function formatoDe(el: HTMLElement): Formato | null {
  const crudo = el.dataset.f;
  if (crudo === undefined) return null;
  try {
    const x: unknown = JSON.parse(crudo);
    if (!x || typeof x !== "object" || Array.isArray(x)) return null;
    // 🔴 Se vuelve a sanear a la salida del DOM y no es paranoia: el navegador
    // clona estos `<span>` solo —al partir un nodo, al arrastrar, al deshacer—
    // y un `data-f` viaja adentro de cualquier HTML que alguien pegue.
    return sanearFormato(x as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** El offset, en el texto plano, de un punto del DOM (`nodo` + `off` de un `Range`). */
function medir(raiz: HTMLElement, nodo: Node, off: number): number {
  let total = 0;
  const rec = (n: Node): boolean => {
    if (n.nodeType === Node.TEXT_NODE) {
      if (n === nodo) {
        total += Math.min(off, (n.nodeValue ?? "").length);
        return true;
      }
      total += (n.nodeValue ?? "").length;
      return false;
    }
    if (esFin(n)) return n === nodo;
    if (n.nodeName === "BR") {
      if (n === nodo) return true;
      total += 1;
      return false;
    }
    const hijos = Array.from(n.childNodes);
    for (let i = 0; i < hijos.length; i++) {
      // Un `Range` puede apuntar a un ELEMENTO con el offset contando hijos, no
      // caracteres. Pasa en cuanto la selección abarca un `<span>` entero.
      if (n === nodo && i === off) return true;
      if (rec(hijos[i])) return true;
    }
    return n === nodo;
  };
  rec(raiz);
  return total;
}

/** La operación inversa: dónde cae, en el DOM, el carácter número `objetivo`. */
function punto(raiz: HTMLElement, objetivo: number): { nodo: Node; off: number } {
  let total = 0;
  const rec = (n: Node): { nodo: Node; off: number } | null => {
    if (n.nodeType === Node.TEXT_NODE) {
      const largo = (n.nodeValue ?? "").length;
      if (objetivo <= total + largo) return { nodo: n, off: objetivo - total };
      total += largo;
      return null;
    }
    if (esFin(n)) return null;
    if (n.nodeName === "BR") {
      if (objetivo <= total) {
        const p = n.parentNode as Node;
        return { nodo: p, off: Array.from(p.childNodes).indexOf(n as ChildNode) };
      }
      total += 1;
      return null;
    }
    for (const h of Array.from(n.childNodes)) {
      const r = rec(h);
      if (r) return r;
    }
    return null;
  };
  return rec(raiz) ?? { nodo: raiz, off: raiz.childNodes.length };
}

/** Lo que hay en el DOM, como trozos. Es lo que se guarda. */
function leerDom(raiz: HTMLElement): Trozo[] {
  const out: Trozo[] = [];
  const rec = (n: Node, f: Formato) => {
    for (const h of Array.from(n.childNodes)) {
      if (h.nodeType === Node.TEXT_NODE) {
        const t = h.nodeValue ?? "";
        if (t) out.push({ t, ...f });
      } else if (esFin(h)) {
        continue;
      } else if (h.nodeName === "BR") {
        out.push({ t: "\n", ...f });
      } else if (h.nodeType === Node.ELEMENT_NODE) {
        // Sin `data-f` propio, el elemento hereda: el navegador envuelve cosas
        // por su cuenta y ese envoltorio no es formato de nadie.
        rec(h, formatoDe(h as HTMLElement) ?? f);
      }
    }
  };
  rec(raiz, {});
  return fusionar(out).slice(0, MAX_TROZOS);
}

/** El `style` de un trozo, tal cual lo va a emitir el mail. */
function cssDeTrozo(t: Trozo, pal: Paleta): string {
  const base = trozoCss(t, pal);
  if (!t.url) return base;
  // El mismo criterio del emisor: un link sin color propio toma el de la marca.
  const link = `${t.color ? "" : `color:${pal.link};`}text-decoration:underline`;
  return base ? `${base};${link}` : link;
}

/** El formato de un trozo, sin su texto. */
const soloFormato = (t: Trozo): Formato => {
  const { t: _t, ...f } = t;
  return f;
};

/** Pinta los trozos adentro del `contenteditable`. Destruye la selección: siempre se restaura después. */
function pintar(raiz: HTMLElement, ts: Trozo[], pal: Paleta, multilinea: boolean) {
  const nodos: Node[] = [];
  for (const t of ts) {
    const hijos: Node[] = [];
    t.t.split("\n").forEach((parte, i) => {
      if (i > 0) hijos.push(document.createElement("br"));
      if (parte) hijos.push(document.createTextNode(parte));
    });
    if (!tieneFormato(t)) {
      nodos.push(...hijos);
      continue;
    }
    const span = document.createElement("span");
    span.dataset.f = JSON.stringify(soloFormato(t));
    span.style.cssText = cssDeTrozo(t, pal);
    span.append(...hijos);
    nodos.push(span);
  }
  if (multilinea) {
    const fin = document.createElement("br");
    fin.dataset.fin = "";
    nodos.push(fin);
  }
  raiz.replaceChildren(...nodos);
}

/** Deja la selección del navegador en un rango de caracteres. */
function seleccionar(raiz: HTMLElement, desde: number, hasta: number) {
  const s = window.getSelection();
  if (!s) return;
  const a = punto(raiz, desde);
  const b = punto(raiz, hasta);
  const r = document.createRange();
  r.setStart(a.nodo, a.off);
  try {
    r.setEnd(b.nodo, b.off);
  } catch {
    r.collapse(true);
  }
  s.removeAllRanges();
  s.addRange(r);
}

/** Mete un fragmento donde está el cursor, pisando lo que hubiera seleccionado. */
function insertar(raiz: HTMLElement, frag: DocumentFragment) {
  const s = window.getSelection();
  if (!s || s.rangeCount === 0) return;
  const r = s.getRangeAt(0);
  if (!raiz.contains(r.commonAncestorContainer)) return;
  const ultimo = frag.lastChild;
  r.deleteContents();
  r.insertNode(frag);
  if (ultimo) {
    r.setStartAfter(ultimo);
    r.collapse(true);
    s.removeAllRanges();
    s.addRange(r);
  }
}

/** Texto pegado → nodos. Los renglones se respetan sólo si el campo los acepta. */
function fragmentoDeTexto(texto: string, multilinea: boolean): DocumentFragment {
  const frag = document.createDocumentFragment();
  const limpio = texto.replace(/\r\n?/g, "\n");
  if (!multilinea) {
    frag.append(document.createTextNode(limpio.replace(/\n+/g, " ")));
    return frag;
  }
  limpio.split("\n").forEach((parte, i) => {
    if (i > 0) frag.append(document.createElement("br"));
    if (parte) frag.append(document.createTextNode(parte));
  });
  return frag;
}

// ─────────────────────────────────────────────────────────────────────────────
// El componente
// ─────────────────────────────────────────────────────────────────────────────

/** Los tamaños que ofrece la barra. Adentro de `RANGOS.tamano`, que es [8, 48]. */
const TAMANOS = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48] as const;

const CLAVES_FUENTE = Object.keys(FUENTES) as (keyof typeof FUENTES)[];

export function CampoRico({
  label,
  value,
  onChange,
  pal,
  cuerpo,
  multilinea = false,
  filas = 3,
  placeholder,
  hint,
}: {
  label?: string;
  value: TextoRico | undefined;
  onChange: (v: TextoRico) => void;
  /** La misma paleta que usa el render: lo que se ve acá es lo que sale. */
  pal: Paleta;
  /**
   * ¿Es uno de los cuatro campos de CUERPO?
   *
   * Decide una sola cosa, y es la que evita que aparezcan asteriscos en un mail:
   * si el campo todavía es un `string` con `**palabra**` adentro, se muestra ya
   * en negrita y sin los asteriscos (ver `negritasATrozos`). En un título los
   * asteriscos nunca significaron nada y se dejan literales.
   */
  cuerpo: boolean;
  /** ¿El Enter corta renglón? Sólo los campos que el mail dibuja con `<br>`. */
  multilinea?: boolean;
  filas?: number;
  placeholder?: string;
  hint?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const id = useId();

  /**
   * El último valor que ESTE campo emitió.
   *
   * 🔑 Es todo el mecanismo de "no repintar mientras se escribe": si lo que baja
   * por props es esto, el DOM ya lo tiene y tocarlo sólo rompería el cursor. Si
   * es otra cosa, la cambió alguien de afuera (⌘Z, otro bloque) y hay que
   * repintar. Va en un ref y no en estado: se lee y se escribe desde
   * manejadores, nunca durante el render.
   */
  const ultimo = useRef<TextoRico | undefined>(undefined);

  /**
   * La última selección que estuvo adentro de este campo.
   *
   * ⚠️ **No se limpia cuando el foco se va**, y eso es deliberado: los dos
   * `<select>` de la barra (tipografía y tamaño) necesitan el foco para
   * desplegarse, así que para cuando llega su `change` la selección del
   * navegador ya no existe. Con los offsets guardados, el control aplica sobre
   * lo que la persona había marcado y después se los devuelve.
   */
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [abierto, setAbierto] = useState<"color" | "fondo" | "link" | null>(null);
  const [url, setUrl] = useState("");

  const vista = useCallback(
    (v: TextoRico | undefined): Trozo[] =>
      cuerpo && typeof v === "string" ? negritasATrozos(v) : aTrozos(v ?? ""),
    [cuerpo],
  );

  // Pintar: al montar, y cada vez que el valor cambie por fuera de este campo.
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    if (ultimo.current !== undefined && JSON.stringify(ultimo.current) === JSON.stringify(value)) return;
    ultimo.current = value;
    pintar(el, vista(value), pal, multilinea);
  }, [value, pal, multilinea, vista]);

  // Dónde está parada la selección. El evento es del documento —no hay uno de
  // elemento— así que cada campo pregunta si le corresponde.
  useEffect(() => {
    const onSel = () => {
      const el = caja.current;
      const s = window.getSelection();
      if (!el || !s || s.rangeCount === 0) return;
      const r = s.getRangeAt(0);
      if (!el.contains(r.commonAncestorContainer)) return;
      setSel([medir(el, r.startContainer, r.startOffset), medir(el, r.endContainer, r.endOffset)]);
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  /** Lo que hay en el DOM ahora mismo, ya canónico. Nunca se confía en `value`. */
  const actual = (): TextoRico => {
    const el = caja.current;
    return el ? canonizar(leerDom(el)) : (value ?? "");
  };

  const emitir = (v: TextoRico) => {
    ultimo.current = v;
    onChange(v);
  };

  /** Lo que hace cada tecla: leer el DOM y avisar. Sin repintar. */
  const alEscribir = () => emitir(actual());

  const aplicar = (patch: Partial<Formato>) => {
    const el = caja.current;
    if (!el || !sel) return;
    const v = actual();
    const [desde, hasta] = ajustarSeleccion(v, sel[0], sel[1]);
    if (desde >= hasta) return;
    const nuevo = aplicarFormato(v, desde, hasta, patch);
    emitir(nuevo);
    // Acá SÍ se repinta —el cambio no lo hizo el navegador sino nosotros— y por
    // eso hay que devolver la selección a mano: `pintar` reemplaza los nodos a
    // los que apuntaba.
    pintar(el, vista(nuevo), pal, multilinea);
    seleccionar(el, desde, hasta);
    setSel([desde, hasta]);
    el.focus();
  };

  /** La regla de Google Docs: si toda la selección ya lo tiene, el botón lo saca. */
  const alternar = (clave: ClaveFormato, valor: unknown) => {
    const v = actual();
    if (!sel) return;
    const [desde, hasta] = ajustarSeleccion(v, sel[0], sel[1]);
    const puesto = tieneTodo(v, desde, hasta, clave, valor);
    aplicar({ [clave]: puesto ? undefined : valor });
  };

  const hayseleccion = sel !== null && sel[0] !== sel[1];
  const fmt: Formato = sel && value !== undefined ? formatoEn(value, sel[0]) : {};
  const marcado = (clave: ClaveFormato, valor: unknown): boolean =>
    hayseleccion && value !== undefined ? tieneTodo(value, sel[0], sel[1], clave, valor) : false;

  const vacio = textoPlano(value ?? "") === "";

  const abrirLink = () => {
    setUrl(typeof fmt.url === "string" ? fmt.url : "");
    setAbierto((a) => (a === "link" ? null : "link"));
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-muted">
          {label}
        </label>
      )}

      {/* ─── La barra ───────────────────────────────────────────────────────
          Fija y siempre visible, no flotante sobre la selección. Una barra que
          sólo aparece cuando ya seleccionaste es una barra que el comerciante
          nunca descubre, y además la posición de una selección adentro de un
          panel scrolleable es de lo primero que se rompe en Safari. */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface-muted p-1">
        <Toggle icono={Bold} titulo="Negrita" puesto={marcado("peso", 700)} apagado={!hayseleccion} onClick={() => alternar("peso", 700)} />
        <Toggle icono={Italic} titulo="Itálica" puesto={marcado("italica", true)} apagado={!hayseleccion} onClick={() => alternar("italica", true)} />
        <Toggle icono={Underline} titulo="Subrayado" puesto={marcado("subrayado", true)} apagado={!hayseleccion} onClick={() => alternar("subrayado", true)} />
        <Toggle icono={Link2} titulo="Link" puesto={!!fmt.url} apagado={!hayseleccion} onClick={abrirLink} />

        <span className="mx-0.5 h-5 w-px bg-border" />

        <Toggle icono={Baseline} titulo="Color del texto" puesto={fmt.color !== undefined} apagado={!hayseleccion} onClick={() => setAbierto((a) => (a === "color" ? null : "color"))} />
        <Toggle icono={Highlighter} titulo="Resaltado" puesto={fmt.fondo !== undefined} apagado={!hayseleccion} onClick={() => setAbierto((a) => (a === "fondo" ? null : "fondo"))} />

        <span className="mx-0.5 h-5 w-px bg-border" />

        <Toggle
          icono={Eraser}
          titulo="Sacar todo el formato"
          puesto={false}
          apagado={!hayseleccion}
          onClick={() => aplicar(Object.fromEntries(CLAVES_FORMATO.map((k) => [k, undefined])))}
        />

        <select
          className={`${campoCompacto} min-w-0 flex-1 basis-28 text-xs`}
          title="Tipografía"
          aria-label="Tipografía"
          disabled={!hayseleccion}
          value={fmt.fuente ?? ""}
          onChange={(e) => aplicar({ fuente: e.target.value === "" ? undefined : (e.target.value as keyof typeof FUENTES) })}
        >
          <option value="">Tipografía automática</option>
          {CLAVES_FUENTE.map((k) => (
            <option key={k} value={k}>{FUENTE_LABEL[k]}</option>
          ))}
        </select>

        <select
          className={`${campoCompacto} w-20 text-xs`}
          title="Tamaño"
          aria-label="Tamaño"
          disabled={!hayseleccion}
          value={fmt.tamano ?? ""}
          onChange={(e) => aplicar({ tamano: e.target.value === "" ? undefined : Number(e.target.value) })}
        >
          <option value="">auto</option>
          {TAMANOS.map((n) => (
            <option key={n} value={n}>{n} px</option>
          ))}
        </select>
      </div>

      {abierto === "link" && (
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-2 py-1.5">
          <input
            className={`${campoCompacto} min-w-0 flex-1 text-xs`}
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              aplicar({ url: url.trim() || undefined });
              setAbierto(null);
            }}
          />
          <button
            type="button"
            className={`${tapTarget} rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground`}
            onClick={() => { aplicar({ url: url.trim() || undefined }); setAbierto(null); }}
          >
            Poner
          </button>
          {!!fmt.url && (
            <button
              type="button"
              className={`${tapTarget} rounded-md px-2 py-1 text-xs text-muted hover:text-foreground`}
              onClick={() => { aplicar({ url: undefined }); setAbierto(null); }}
            >
              Sacar
            </button>
          )}
        </div>
      )}

      {(abierto === "color" || abierto === "fondo") && (
        <div className="rounded-lg border border-border bg-surface-muted px-2 py-1.5">
          <ControlColor
            label={abierto === "color" ? "Color del texto" : "Resaltado"}
            valor={abierto === "color" ? fmt.color : fmt.fondo}
            // Sin `resuelto`: lo que se ve cuando el trozo no dice nada lo decide
            // la cascada del bloque, que este campo no conoce. Mostrar un color
            // cualquiera sería afirmar algo falso; "Automático" es la verdad.
            resuelto={undefined}
            pal={pal}
            onChange={(v: ValorColor | undefined) => aplicar(abierto === "color" ? { color: v } : { fondo: v })}
          />
        </div>
      )}

      <div className="relative">
        {vacio && placeholder && (
          <span className="pointer-events-none absolute left-3 top-3 text-base text-subtle lg:top-2.5 lg:text-sm">
            {placeholder}
          </span>
        )}
        <div
          id={id}
          ref={caja}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label={label}
          aria-multiline={multilinea}
          spellCheck
          style={{ minHeight: `${filas * 1.6}em` }}
          className="w-full whitespace-pre-wrap break-words rounded-xl border border-border px-3 py-3 text-base text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/30 lg:py-2.5 lg:text-sm"
          onInput={alEscribir}
          onBlur={alEscribir}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // El Enter se maneja a mano en los dos casos: sin esto el navegador
            // mete `<div>` o `<p>` propios, que `leerDom` tendría que adivinar.
            e.preventDefault();
            if (!multilinea) return;
            const el = caja.current;
            if (!el) return;
            insertar(el, fragmentoDeTexto("\n", true));
            alEscribir();
          }}
          onPaste={(e) => {
            // ⛔ Nunca entra HTML de afuera: se pega TEXTO. Lo que viene del
            // portapapeles trae `<span style>`, `<font>` y clases del programa
            // del que salió, y el formato de este campo es una lista blanca.
            e.preventDefault();
            const el = caja.current;
            if (!el) return;
            insertar(el, fragmentoDeTexto(e.clipboardData.getData("text/plain"), multilinea));
            alEscribir();
          }}
        />
      </div>

      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Toggle({
  icono: Icono,
  titulo,
  puesto,
  apagado,
  onClick,
}: {
  icono: typeof Bold;
  titulo: string;
  puesto: boolean;
  apagado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={puesto}
      disabled={apagado}
      // ⚠️ `onMouseDown` frenado: sin esto el click le saca el foco al
      // `contenteditable` ANTES del `onClick` y la selección se pierde en el
      // camino. Los dos `<select>` no lo pueden hacer —necesitan el foco para
      // desplegarse— y por eso la selección además se guarda en estado.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`${tapTarget} flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:opacity-40 ${
        puesto
          ? "border-accent bg-accent-subtle text-accent-subtle-foreground"
          : "border-transparent text-muted hover:border-border hover:text-foreground"
      }`}
    >
      <Icono className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}
