"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Monitor, Smartphone } from "lucide-react";

/**
 * El marco donde se mira un mail: el HTML de verdad, al ancho de verdad,
 * escalado para entrar donde sea, con el toggle Escritorio/Celular.
 *
 * Salió de `editor/PreviewMail.tsx` el 2-ago-2026, sin tocarle una línea a lo
 * que hace. Existe aparte porque el mail ahora se mira en tres lugares —el
 * editor, la galería de plantillas y las listas de campañas y automations— y
 * cada copia de este cálculo sería una versión distinta de "cómo se ve".
 *
 * Dos cosas que no son obvias y son las que hay que respetar al reusarlo:
 *
 * - **El ancho del iframe importa.** El corte responsive del mail es el ancho
 *   del propio mail, no 600px fijos, así que un iframe angosto muestra la
 *   versión de celular aunque el toggle diga "escritorio". Por eso el marco
 *   tiene el ancho real y se **escala** para entrar, en vez de achicarse.
 * - **El alto lo decide quien lo usa** (`altoClase`): en el editor es lo que
 *   sobra de la pantalla, en un modal es otra cosa. Hasta que se extrajo estaba
 *   clavado al editor.
 */

/** El ancho del celular más chico que vale la pena mirar. */
const ANCHO_MOVIL = 375;

/**
 * El alto en el editor. Las 13rem son el encabezado, la barra de acciones, el
 * selector de vista y la fila del toggle; el `min-h-96` es el piso para una
 * pantalla corta.
 *
 * 🔴 `dvh` y no `vh`. En iOS Safari `vh` es el viewport GRANDE —el que queda
 * cuando la barra de direcciones se esconde—, así que un 70vh se mete abajo del
 * chrome del navegador y el mail se lee cortado. `dvh` sigue al alto real y se
 * ajusta solo cuando la barra aparece o se va. Arriba del corte vuelve al 70vh
 * de siempre, y va con el MISMO `@[66rem]` de la grilla del editor: acá "una
 * sola vista" quiere decir "el mail ocupa la pantalla", no "hay una pantalla
 * chica".
 */
export const ALTO_EDITOR = "h-[calc(100dvh-13rem)] min-h-96 @[66rem]:h-[70vh]";

export function VistaPreviaMail({
  html,
  /** Ancho del mail ya resuelto (el del tema). El marco de escritorio no baja de acá. */
  anchoMail = 600,
  /** Lo que dice a la izquierda del toggle. `null` lo saca (en un modal el título ya está arriba). */
  etiqueta = "Vista previa",
  /** A la derecha del todo, en la misma fila del toggle. */
  extra,
  altoClase = ALTO_EDITOR,
  className = "",
  /**
   * ⚠️ **`allow-same-origin` y nada más.** Sin `allow-scripts` el navegador no
   * ejecuta NADA de adentro —ni `<script>`, ni `onerror=`, ni `javascript:`—,
   * así que el XSS almacenado que motivó el `sandbox=""` original sigue tapado:
   * el contenido sale de un Json que pudo escribir otro usuario de la cuenta.
   * Tampoco van `allow-forms`, `allow-popups` ni `allow-top-navigation`.
   *
   * Hace falta para poder **leer el `contentDocument` y frenar los clicks** (ver
   * abajo). Con `sandbox=""` el origen es opaco, `contentDocument` es `null` y
   * no hay forma de evitar que el mail navegue.
   */
  sandbox = "allow-same-origin",
  /** Tocar una parte del mail avisa qué bloque fue. Sin esto igual no navega. */
  onBloque,
  /** El bloque que se está editando: se le pinta un contorno y se lo trae a la vista. */
  resaltado,
  /** El iframe recién montado, para quien necesite colgarle algo (el editor). */
  onIframe,
}: {
  html: string;
  anchoMail?: number;
  etiqueta?: string | null;
  extra?: ReactNode;
  altoClase?: string;
  className?: string;
  sandbox?: string;
  onBloque?: (id: string) => void;
  resaltado?: string | null;
  onIframe?: (el: HTMLIFrameElement | null) => void;
}) {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const refIframe = useCallback(
    (el: HTMLIFrameElement | null) => {
      setFrame(el);
      onIframe?.(el);
    },
    [onIframe],
  );
  // Arranca en CELULAR a propósito: es donde el mail se lee de verdad, así que
  // es el default que empuja a diseñar para ahí. Escritorio queda a un click.
  const [movil, setMovil] = useState(true);
  const [caja, setCaja] = useState({ w: 0, h: 0 });
  const cont = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cont.current;
    if (!el) return;
    const medir = () => setCaja({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const anchoMarco = movil ? ANCHO_MOVIL : Math.max(640, anchoMail);
  // Solo se achica, nunca se agranda: un mail de 600px estirado a 900 se vería
  // borroso y encima mentiría sobre el tamaño de la tipografía.
  const escala = caja.w ? Math.min(1, caja.w / anchoMarco) : 1;

  /**
   * El alto REAL del mail, medido adentro del iframe.
   *
   * Existe porque el mail dejó de scrollear adentro del iframe y pasó a
   * scrollear el contenedor (ver el `pointer-events` de abajo): para eso el
   * iframe tiene que medir todo lo que dibuja, no el alto del marco.
   *
   * ⚠️ Se mide en el `load` **y** en el momento: cuando cambia el `srcDoc` el
   * documento se reemplaza de forma asíncrona, así que leerlo justo después del
   * render devuelve el alto del documento anterior.
   *
   * 🔴 **Y además con un `ResizeObserver`, que es lo que lo hace confiable.** Un
   * mail tiene fotos de producto: en el `load` casi ninguna terminó de bajar, así
   * que esa primera medida sale corta y el final del mail queda inalcanzable.
   * El observador también cubre el cambio de Escritorio a Celular —el mail se
   * redibuja a otro ancho y cambia de alto— sin tener que acordarse de listar
   * cada cosa que lo mueve.
   *
   * ⚠️ Se observa el **`body`, no el `documentElement`**: el alto del segundo es
   * `max(contenido, viewport)`, y como el viewport del iframe es justamente el
   * alto que estamos fijando, se realimenta y nunca vuelve a bajar. El `body` del
   * mail no declara alto, así que mide su contenido y nada más.
   */
  const [altoMail, setAltoMail] = useState(0);
  useEffect(() => {
    if (!frame) return;
    let ro: ResizeObserver | undefined;
    const enganchar = () => {
      const d = frame.contentDocument;
      if (!d?.body) return;
      const medir = () => setAltoMail(d.body.scrollHeight);
      medir();
      ro?.disconnect();
      ro = new ResizeObserver(medir);
      ro.observe(d.body);
    };
    frame.addEventListener("load", enganchar);
    enganchar();
    return () => {
      frame.removeEventListener("load", enganchar);
      ro?.disconnect();
    };
  }, [frame, html, anchoMarco]);

  /**
   * 🔴 **Cambiar el estilo de un bloque NO puede tirar la vista previa para
   * arriba.** Y lo hacía, sin que nadie escribiera un `scrollTop`: el arreglo de
   * `6eb6423` frenó que se moviera la *página*, y lo que quedó fue esto.
   *
   * La cadena, medida en Chrome el 7-ago-2026:
   *
   * 1. Cambia el `html` ⇒ se reescribe el `srcDoc` ⇒ el navegador reemplaza el
   *    documento de forma asíncrona.
   * 2. Dispara `load` ⇒ `enganchar()` mide `body.scrollHeight` con las fotos
   *    todavía sin bajar y la medida sale **corta** (es el mismo motivo por el
   *    que existe el `ResizeObserver` de arriba).
   * 3. Ese `altoMail` corto colapsa la caja que reserva el alto ⇒ el
   *    `scrollHeight` del scroller se desploma ⇒ **el navegador clampea
   *    `scrollTop`**, y contra un mail de miles de px eso es ir a parar a 0.
   * 4. El `ResizeObserver` devuelve el alto real cuando las fotos cargan, pero
   *    **la posición no vuelve sola**: el clamp ya pasó.
   *
   * Medido en un banco con la misma estructura: scrollear a 2000, colapsar la
   * reserva de 4000 a 300 y devolverla a 4000 deja el `scrollTop` en 0.
   *
   * 🔑 **Por eso se re-aplica en CADA cambio de alto y con un `Math.min`, no una
   * sola vez al final.** Las fotos entran de a una y el alto llega en varios
   * escalones; con el mínimo contra el tope de cada momento, la posición
   * **vuelve caminando** (0 → 502 → 1402 → 2000) y no hace falta saber cuándo
   * terminó de cargar todo — que es justo lo que no se puede saber.
   *
   * ⚠️ **`propio` es lo que impide que el arreglo se coma a sí mismo.** Tanto el
   * clamp como la restauración disparan un evento `scroll`, y si ese evento
   * grabara la posición, el 0 del clamp pisaría la posición buena antes de poder
   * usarla. Se apaga en el `requestAnimationFrame` siguiente —los eventos de
   * scroll se despachan antes de los rAF del mismo cuadro— así que entre dos
   * medidas del observador un scroll de verdad **sí** se graba.
   *
   * ⛔ No se toca el efecto de `[resaltado]` de más abajo: ése ya está bien y
   * cambiar la tipografía no cambia el bloque elegido.
   */
  const pos = useRef(0);
  const propio = useRef(false);
  useLayoutEffect(() => {
    const s = scroller.current;
    if (!s) return;
    // 🔴 **`propio` se prende porque el alto se movió, NO porque haya algo que
    // restaurar**, y esa diferencia era todo el bug en la primera versión de
    // este arreglo (7-ago-2026).
    //
    // Con un `if (scrollTop === destino) return` antes de prenderlo, el paso que
    // importa se escapaba: en el momento del colapso el navegador **ya** clampeó
    // a 0, así que `destino` también daba 0, el efecto se iba sin marcar nada y
    // el evento `scroll` del clamp —que llega después— grababa `pos = 0`. Para
    // cuando el observador devolvía el alto real ya no quedaba a dónde volver, y
    // la vista previa seguía yéndose para arriba igual que antes.
    //
    // Por eso se marca primero y se pregunta después.
    propio.current = true;
    const destino = Math.min(pos.current, Math.max(0, s.scrollHeight - s.clientHeight));
    if (s.scrollTop !== destino) s.scrollTop = destino;
    // ⚠️ El `rAF` es el que manda —se despacha justo después de los eventos de
    // scroll del mismo cuadro, que es lo que hay que dejar pasar—, pero **en una
    // pestaña de fondo no corre nunca**. Sin el reloj de atrás, `propio` se
    // quedaría prendido para siempre y el preview dejaría de seguir a la persona
    // al volver a la pestaña. Ahí no hay nada que dibujar, así que llegar tarde
    // no cuesta nada.
    const soltar = () => {
      propio.current = false;
    };
    const cuadro = requestAnimationFrame(soltar);
    const reloj = setTimeout(soltar, 250);
    return () => {
      cancelAnimationFrame(cuadro);
      clearTimeout(reloj);
    };
  }, [altoMail]);

  /**
   * 🔴 **Un click adentro del mail nunca navega, y no por un handler.**
   *
   * Hasta el 4-ago-2026 acá había un listener que hacía `preventDefault()` sobre
   * el documento del iframe. **No corría nunca**, y el modo de falla es de los
   * que no se ven leyendo: con `sandbox` sin `allow-scripts`, el navegador
   * pregunta si en el contexto del target se puede ejecutar script **antes de
   * despachar cualquier evento**, y descarta todos los listeners — también los
   * que colgó el panel desde afuera. `addEventListener` no falla, no devuelve
   * nada y no avisa. Resultado: tocar un producto navegaba el iframe a la tienda
   * —que no se deja enmarcar— y **el preview quedaba en blanco**, que es el
   * síntoma que se reportó dos veces.
   *
   * ⚠️ Lo que confundía es que el contorno del bloque elegido y el auto-scroll
   * **sí** funcionan: son escrituras directas del padre sobre el DOM del hijo,
   * no eventos. El preview parece vivo y el click está muerto.
   *
   * ⛔ **La salida NO es agregar `allow-scripts`**: junto con `allow-same-origin`
   * anula el sandbox entero y el bloque de `html` crudo pasaría a correr con la
   * cookie de sesión al lado.
   *
   * La salida es que el iframe **no reciba el click**, que es lo único de este
   * mecanismo que siempre funcionó (la miniatura de la galería hace exactamente
   * esto). Y no depende de que el diagnóstico de arriba sea correcto: un iframe
   * con `pointer-events: none` no puede navegar por un click, pase lo que pase.
   *
   * Lo que había frenado esta solución —"el mail es más alto que el marco y hay
   * que poder scrollearlo adentro"— se resuelve sacando el scroll AFUERA: el
   * iframe mide todo el mail y el que scrollea es el contenedor. El scroll queda
   * nativo, con la rueda y con el dedo, sin reimplementar nada.
   */
  const alClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const d = frame?.contentDocument;
    if (!d || !onBloque) return;
    const caja = frame!.getBoundingClientRect();
    // Las coordenadas del iframe están SIN escalar: el `scale()` es de afuera.
    // Y no hace falta sumar scroll interno — el iframe ya no scrollea.
    const el = d.elementFromPoint((e.clientX - caja.left) / escala, (e.clientY - caja.top) / escala);
    const id = el?.closest("[data-b]")?.getAttribute("data-b");
    if (id) onBloque(id);
  };

  /**
   * El contorno del bloque elegido, del lado de adentro.
   *
   * Se pinta por DOM y no en el HTML del mail: lo que se renderiza tiene que
   * seguir siendo el mail que sale, y un borde de más ahí saldría en el envío.
   *
   * ⚠️ **Va colgado del `load`, no solo del render.** Cuando lo que cambia es el
   * `html`, el efecto corre ANTES de que el navegador reemplace el documento por
   * el `srcDoc` nuevo, así que pintaba el documento que estaba por descartarse:
   * se escribía una letra en un título y el bloque elegido se quedaba sin borde
   * hasta volver a clickearlo.
   */
  useEffect(() => {
    if (!frame) return;
    const pintar = () => {
      const d = frame.contentDocument;
      if (!d) return;
      for (const el of d.querySelectorAll<HTMLElement>("[data-b]")) {
        const puesto = el.getAttribute("data-b") === resaltado;
        el.style.outline = puesto ? "2px solid #f59e0b" : "";
        el.style.outlineOffset = puesto ? "-2px" : "";
      }
    };
    frame.addEventListener("load", pintar);
    pintar();
    return () => frame.removeEventListener("load", pintar);
  }, [frame, resaltado, html]);

  /**
   * Traer a la vista el bloque elegido. Solo cuando cambia la selección: si
   * dependiera del `html`, scrollearía en cada tecla que se escribe.
   *
   * 🔴 **Nunca con `scrollIntoView`.** El iframe es same-origin, así que el
   * navegador no frena en el borde del documento del mail: sigue subiendo por
   * los contenedores scrolleables, **cruza al documento del panel** y lo mueve
   * para dejar el iframe centrado en la pantalla. Se veía como "cada vez que
   * toco un bloque, la página se va sola para arriba".
   *
   * ⚠️ Dos conversiones, y las dos son fáciles de errar:
   *
   * - **Por la escala.** La medida sale de adentro del iframe, sin escalar, y el
   *   contenedor vive afuera, donde todo está multiplicado por `escala`.
   * - **`top` acá YA es absoluto.** `getBoundingClientRect` es relativo al
   *   viewport del iframe, pero el iframe mide todo el mail y **nunca scrollea
   *   por dentro**, así que ese viewport no se mueve y `top` es la distancia
   *   desde el principio del mail. Sumarle el `scrollTop` del contenedor —el
   *   reflejo de cuando el que scrolleaba era el iframe— lo corre de más
   *   justamente cuando ya estabas scrolleado.
   */
  useEffect(() => {
    const cajaScroll = scroller.current;
    const el = resaltado
      ? frame?.contentDocument?.querySelector<HTMLElement>(`[data-b="${CSS.escape(resaltado)}"]`)
      : null;
    if (!cajaScroll || !el) return;
    const y = el.getBoundingClientRect().top * escala - cajaScroll.clientHeight / 2;
    cajaScroll.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resaltado]);

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        {etiqueta ? <span className="text-sm text-muted">{etiqueta}</span> : <span />}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            {([
              { movil: false, Icono: Monitor, label: "Escritorio" },
              { movil: true, Icono: Smartphone, label: "Celular" },
            ] as const).map(({ movil: m, Icono, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => setMovil(m)}
                aria-pressed={movil === m}
                title={label}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                  movil === m ? "bg-accent-subtle text-accent-subtle-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                <Icono className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          {extra}
        </div>
      </div>

      {/* Dos divs y no uno: el de afuera es el que MIDE (y el que observa el
          ResizeObserver), el de adentro es el que se achica al ancho real del
          mail. Con uno solo, cambiarle el ancho al elemento observado lo hace
          re-medir y dispararse para siempre.

          El de adentro mide `anchoMarco * escala` y va centrado. Sin eso, en
          celular el iframe queda en 375px dentro de una caja de ~460 y esos 85px
          sobrantes se ven como un borde blanco a la derecha — que es lo que se
          veía y parecía "que no actualiza". */}
      <div ref={cont} className={`flex w-full justify-center ${altoClase}`}>
        <div
          ref={scroller}
          onClick={alClick}
          // Dónde está parada la persona. Lo que escribe el propio arreglo no
          // cuenta — ver `propio`, arriba.
          onScroll={(e) => {
            if (!propio.current) pos.current = e.currentTarget.scrollTop;
          }}
          // `overflow-y-auto` y no `hidden`: **este** es el que scrollea el mail
          // desde que el iframe dejó de recibir eventos.
          className="h-full overflow-y-auto rounded-xl border border-border bg-white"
          style={{ width: caja.w ? anchoMarco * escala : "100%" }}
        >
          {/* 🔴 El tercer div no es decorativo. `transform: scale()` **no cambia
              el tamaño de layout**: un mail de 4.000px escalado al 60% sigue
              ocupando 4.000px, y el contenedor scrollearía casi el doble de lo
              que se ve. Esta caja reserva el alto YA ESCALADO — el mismo truco
              que la de afuera usa para el ancho. */}
          <div style={{ height: altoMail ? altoMail * escala : "100%" }}>
            <iframe
              title="Vista previa del mail"
              ref={refIframe}
              sandbox={sandbox}
              srcDoc={html}
              style={{
                width: anchoMarco,
                // Todo el mail, no el alto del marco: el que scrollea es el
                // contenedor.
                height: altoMail || "100%",
                transform: `scale(${escala})`,
                transformOrigin: "top left",
                border: 0,
                // ⛔ Lo que impide que un click navegue el iframe y deje el
                // preview en blanco. El porqué está arriba, en `alClick`.
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
