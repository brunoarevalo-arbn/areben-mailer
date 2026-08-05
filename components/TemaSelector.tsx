"use client";

import { FUENTES, FUENTE_LABEL, resolverPaleta, type Tema } from "@/lib/email/tema";
import { Card } from "@/components/ui/Card";
import { Desplegable } from "@/components/ui/Desplegable";
import { Stepper } from "@/components/ui/Stepper";
import { campoCompacto } from "@/lib/ui";
import { RotateCcw } from "lucide-react";

// Selector de aspecto del mail.
//
// El preview de al lado renderiza con el MISMO `renderEmailHtml` que el envío,
// así que cada cambio de acá se ve al instante en el mail real, no en una
// aproximación. Es la razón por la que este control puede existir sin tener que
// mantener dos versiones del diseño.

// ⚠️ Era `${inputClass} py-1.5`, y ese `py-1.5` no ganaba por estar último en el
// string: entre dos utilidades de la misma propiedad decide el orden del CSS que
// escribe Tailwind, no el del className. `campoCompacto` ya trae UN solo `py`.
const selectClass = `w-full ${campoCompacto}`;

/** El punto de partida decide los colores de texto; el resto se retoca encima. */
const BASES = [
  { valor: "claro", label: "Claro", muestra: "#ffffff", borde: "#e5e5e5" },
  { valor: "oscuro", label: "Oscuro", muestra: "#161616", borde: "#2a2a2a" },
] as const;

function Color({
  label,
  valor,
  porDefecto,
  onChange,
}: {
  label: string;
  valor: string | undefined;
  porDefecto: string;
  onChange: (v: string | undefined) => void;
}) {
  const puesto = valor !== undefined && valor !== "";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          // Sin valor propio muestra el que va a usar igual: un picker en negro
          // cuando el mail sale blanco hace pensar que el tema está roto.
          value={puesto ? valor : porDefecto}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded border border-border-strong bg-background"
        />
        <span className="w-16 text-xs tabular-nums text-muted">{puesto ? valor : "auto"}</span>
        {puesto && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label={`Volver ${label} al automático`}
            className="text-muted transition-colors hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

export function TemaSelector({
  tema,
  onChange,
  /** Tema de la marca: es contra ESTO que "auto" muestra su color. */
  temaMarca,
  titulo = "Diseño del mail",
  ayuda,
  /**
   * Plegado (el editor de mail). En `/remitentes` va abierto: ahí el tema de la
   * marca ES la pantalla, no una caja al costado de otra cosa.
   */
  plegable = false,
}: {
  tema: Tema | undefined;
  onChange: (t: Tema | undefined) => void;
  temaMarca?: Tema | null;
  titulo?: string;
  ayuda?: string;
  plegable?: boolean;
}) {
  const t = tema ?? {};
  const set = (patch: Partial<Tema>) => onChange({ ...t, ...patch });
  // Lo que se vería sin overrides: alimenta los "auto" de los pickers.
  const base = resolverPaleta({ ...(temaMarca ?? {}), ...t });
  const sinTema = Object.values(t).every((v) => v === undefined || v === "");

  const restablecer = !sinTema && (
    <button
      type="button"
      onClick={() => onChange(undefined)}
      className="shrink-0 text-xs text-muted underline transition-colors hover:text-foreground"
    >
      Restablecer
    </button>
  );

  const cuerpo = (
    <>
      <div>
        <div className="mb-1.5 text-xs text-muted">Punto de partida</div>
        <div className="flex gap-2">
          {BASES.map((b) => {
            const activo = (t.base ?? "claro") === b.valor;
            return (
              <button
                key={b.valor}
                type="button"
                onClick={() => set({ base: b.valor })}
                className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  activo
                    ? "border-accent bg-accent-subtle text-accent-subtle-foreground font-medium"
                    : "border-border text-muted hover:bg-surface-muted"
                }`}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded border"
                  style={{ background: b.muestra, borderColor: b.borde }}
                />
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <Color label="Fondo de la página" valor={t.fondo} porDefecto={base.fondo} onChange={(v) => set({ fondo: v })} />
        <Color
          label="Fondo del contenido"
          valor={t.fondoContenido}
          porDefecto={base.tarjeta}
          onChange={(v) => set({ fondoContenido: v })}
        />
        <Color label="Botón" valor={t.acento} porDefecto={base.acento} onChange={(v) => set({ acento: v })} />
        <Color label="Links" valor={t.link} porDefecto={base.link} onChange={(v) => set({ link: v })} />
        <p className="pt-1 text-xs text-muted">
          Si el fondo del contenido es igual al de la página, el mail sale a sangre completa, sin
          tarjeta.
        </p>
      </div>

      <div className="space-y-3 border-t border-border pt-3">
        <div className="block">
          <div className="mb-1 text-xs text-muted">Ancho del contenido</div>
          <Stepper
            value={base.ancho}
            min={600}
            max={700}
            paso={10}
            etiqueta="Ancho del contenido"
            onChange={(v) => set({ ancho: v })}
          />
        </div>

        <label className="block">
          <span className="mb-1 block text-xs text-muted">Fuente</span>
          <select
            className={selectClass}
            value={t.fuente ?? "sistema"}
            onChange={(e) => set({ fuente: e.target.value as keyof typeof FUENTES })}
          >
            {(Object.keys(FUENTES) as (keyof typeof FUENTES)[]).map((k) => (
              <option key={k} value={k}>
                {FUENTE_LABEL[k]}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            Solo tipografías que existen en todos los clientes de mail. Las de Google Fonts las
            descartan Outlook y Gmail, así que el mail terminaría en una de estas igual.
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted">Idioma del mail</span>
          <select className={selectClass} value={t.idioma ?? "es"} onChange={(e) => set({ idioma: e.target.value })}>
            <option value="es">Español</option>
            <option value="pt">Portugués</option>
            <option value="en">Inglés</option>
          </select>
        </label>
      </div>
    </>
  );

  if (plegable) {
    return (
      <Card padding="loose">
        <Desplegable
          titulo={titulo}
          // Cerrada, la caja igual dice si el mail sigue el tema de la marca o
          // tiene el suyo: es la única pregunta que se le hace de un vistazo.
          resumen={sinTema ? "el de la marca" : "personalizado"}
        >
          {ayuda && <p className="text-xs text-muted">{ayuda}</p>}
          {restablecer && <div className="flex justify-end">{restablecer}</div>}
          {cuerpo}
        </Desplegable>
      </Card>
    );
  }

  return (
    <Card padding="loose" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          {ayuda && <p className="mt-0.5 text-xs text-muted">{ayuda}</p>}
        </div>
        {restablecer}
      </div>
      {cuerpo}
    </Card>
  );
}
