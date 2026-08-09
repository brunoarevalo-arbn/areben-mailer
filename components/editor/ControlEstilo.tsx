"use client";

import { useState } from "react";
import {
  TOKENS_COLOR, TOKEN_LABEL, esToken, TAMANOS_BOTON, CLAVES_TAMANO_BOTON,
  type ValorColor, type EstiloBloque,
} from "@/lib/email/estilos";
import type { Paleta } from "@/lib/email/tema";
import { ratioEnTexto, type AvisoContraste } from "@/lib/email/contraste";
import { campoCompacto, tapTarget } from "@/lib/ui";
import { Stepper } from "@/components/ui/Stepper";
import { Pipette, RotateCcw } from "lucide-react";

/**
 * Los controles de la cascada de estilo. Los cuatro tienen el mismo contrato:
 *
 *   valor    = lo que dice ESTA capa. `undefined` = heredar.
 *   resuelto = lo que se ve hoy, con las cuatro capas aplicadas.
 *
 * ⚠️ **"Heredar" es la ausencia de la clave, nunca un centinela.** Volver algo a
 * automático es `onChange(undefined)`, no `onChange("")`: el motor necesita
 * poder responder "¿esto lo eligió una persona?" y de eso dependen la
 * legibilidad contextual y el modo oscuro.
 */

/**
 * El control de color, que es donde se juega el valor del producto.
 *
 * El orden de las tres opciones **no es cosmético**: automático → colores de la
 * marca → color libre. Si el picker libre estuviera adelante, la gente clava un
 * hex, y el día que el comerciante cambia el color de su marca los mails no se
 * repintan. El motor seguiría funcionando igual y el argumento de venta se
 * moriría en silencio. Por eso el color libre está atrás de un clic.
 */
export function ControlColor({
  label,
  valor,
  resuelto,
  pal,
  aviso,
  onChange,
}: {
  label: string;
  valor: ValorColor | undefined;
  /** El color que se ve hoy, ya resuelto a hex. Es lo que muestra el chip "auto". */
  resuelto: string | undefined;
  pal: Paleta;
  /**
   * El veredicto de legibilidad de este color contra el fondo que tiene atrás,
   * ya calculado por quien conoce el bloque. El control no lo deduce: acá no se
   * sabe sobre qué se apoya el texto.
   */
  aviso?: AvisoContraste | null;
  onChange: (v: ValorColor | undefined) => void;
}) {
  const libre = valor !== undefined && !esToken(valor);
  const [abierto, setAbierto] = useState(libre);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-muted">{label}</span>
        <span className="text-xs text-subtle">
          {valor === undefined
            ? "Automático"
            : esToken(valor)
              ? TOKEN_LABEL[valor.slice(1) as keyof typeof TOKEN_LABEL]
              : valor}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => { setAbierto(false); onChange(undefined); }}
          title="Automático"
          aria-pressed={valor === undefined}
          className={`flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] transition-colors ${
            valor === undefined ? "border-accent bg-accent-subtle text-accent-subtle-foreground" : "border-border text-subtle hover:text-foreground"
          }`}
        >
          <span
            className="h-3 w-3 rounded-sm border border-border-strong"
            style={{ background: resuelto ?? "transparent" }}
          />
          auto
        </button>

        <span className="mx-0.5 h-5 w-px bg-border" />

        {TOKENS_COLOR.map((t) => {
          const v = `$${t}` as ValorColor;
          const puesto = valor === v;
          return (
            <button
              key={t}
              type="button"
              onClick={() => { setAbierto(false); onChange(v); }}
              title={TOKEN_LABEL[t]}
              aria-label={TOKEN_LABEL[t]}
              aria-pressed={puesto}
              className={`h-6 w-6 rounded-md border transition-transform hover:scale-110 ${
                puesto ? "border-accent ring-2 ring-ring/40" : "border-border-strong"
              }`}
              style={{ background: pal[t] }}
            />
          );
        })}

        <span className="mx-0.5 h-5 w-px bg-border" />

        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          title="Otro color"
          aria-label="Otro color"
          aria-expanded={abierto}
          className={`flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${
            libre ? "border-accent ring-2 ring-ring/40" : "border-border-strong text-subtle hover:text-foreground"
          }`}
          style={libre ? { background: valor } : undefined}
        >
          {!libre && <Pipette className="h-3 w-3" aria-hidden />}
        </button>
      </div>

      {abierto && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-2 py-1.5">
          <input
            type="color"
            value={libre ? valor : resuelto ?? "#000000"}
            onChange={(e) => onChange(e.target.value as ValorColor)}
            className="h-7 w-12 cursor-pointer rounded border border-border-strong bg-background"
          />
          <span className="flex-1 text-xs text-subtle">
            Un color a mano queda clavado: no se repinta cuando cambia el color de la marca.
          </span>
        </div>
      )}

      {/* El número va SIEMPRE que haya aviso, aunque el cartel de arriba diga lo
          mismo: éste es el que está al lado del control que lo arregla. */}
      {aviso && (
        <p
          className={`text-xs leading-relaxed ${
            aviso.nivel === "invisible" ? "text-danger-foreground" : "text-warning-foreground"
          }`}
        >
          {aviso.nivel === "invisible"
            ? `No se ve sobre el fondo que tiene atrás (${ratioEnTexto(aviso.ratio)}).`
            : `Se lee con dificultad sobre su fondo (${ratioEnTexto(aviso.ratio)}).`}
        </p>
      )}
    </div>
  );
}

export function ControlNumero({
  label,
  valor,
  resuelto,
  rango,
  paso = 1,
  sufijo = "px",
  onChange,
}: {
  label: string;
  valor: number | undefined;
  resuelto: number | undefined;
  rango: readonly [number, number];
  paso?: number;
  sufijo?: string;
  onChange: (v: number | undefined) => void;
}) {
  const [min, max] = rango;
  // Sin valor propio, el control muestra el que se está usando igual: un campo
  // en cero cuando el texto mide 26px hace pensar que el panel está roto.
  //
  // 🔴 Y sin NINGUNO de los dos, muestra el neutro (0 acotado al rango), no el
  // mínimo. La diferencia la destapó pasar de barra a campo el 5-ago-2026:
  // `espaciado` no tiene BASE en casi ningún rol, así que caía al mínimo del
  // rango y **"Espacio entre letras" decía −1 en todo el panel** — un número
  // concreto y falso (el mail no emite `letter-spacing`, o sea 0), con el `−`
  // deshabilitado sugiriendo que ya estaba en el piso. Con una barra el pulgar
  // pegado al extremo izquierdo no afirmaba nada; un campo sí.
  const mostrado = valor ?? resuelto ?? Math.min(max, Math.max(min, 0));
  return (
    // ⚠️ `<div>` y no `<label>`: adentro hay tres cosas enfocables (los dos
    // botones y el campo) y un `<label>` que envuelve a varias manda el click de
    // cualquier parte al primer control, así que apretar `+` movía el foco al
    // campo. El nombre lo lleva el `aria-label` del Stepper.
    <div className="block">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-muted">{label}</span>
        {valor === undefined ? (
          // El "auto" ya no puede ir pegado al número —ahora el número vive
          // adentro del campo— pero sigue siendo la señal de que esto lo está
          // decidiendo la cascada y no la persona.
          <span className="text-xs text-subtle">auto</span>
        ) : (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label={`Volver ${label} al automático`}
            title="Volver al automático"
            className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            auto
          </button>
        )}
      </div>
      <Stepper
        value={mostrado}
        min={min}
        max={max}
        paso={paso}
        sufijo={sufijo}
        etiqueta={label}
        atenuado={valor === undefined}
        onChange={onChange}
      />
    </div>
  );
}

export function ControlEnum<T extends string | number>({
  label,
  valor,
  resuelto,
  opciones,
  onChange,
}: {
  label: string;
  valor: T | undefined;
  resuelto: T | undefined;
  opciones: readonly { valor: T; label: string }[];
  onChange: (v: T | undefined) => void;
}) {
  const autoLabel = opciones.find((o) => o.valor === resuelto)?.label;
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      <select
        className={`w-full ${campoCompacto}`}
        value={valor === undefined ? "" : String(valor)}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") return onChange(undefined);
          const op = opciones.find((o) => String(o.valor) === v);
          onChange(op?.valor);
        }}
      >
        <option value="">Automático{autoLabel ? ` (${autoLabel})` : ""}</option>
        {opciones.map((o) => (
          <option key={String(o.valor)} value={String(o.valor)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Heredar · Sí · No. **Tres estados y no una casilla**, y el tercero es el que
 * importa.
 *
 * 🔴 Una casilla solo sabe decir dos cosas, y acá hacen falta tres: *heredar*
 * (que es la ausencia de la clave), *sí* y *no*. Mientras fue casilla,
 * destildarla escribía **heredar**, así que un `mayusculas: true` puesto por la
 * plantilla en la capa de documento **no se podía apagar desde el bloque**: se
 * escribía en minúscula y el mail salía en mayúscula igual. El `false` que hace
 * falta para eso ahora lo conserva `sanearBool` (ver `lib/email/estilos.ts`).
 *
 * `Heredar` muestra entre paréntesis qué está heredando, igual que el
 * "Automático (…)" de `ControlEnum`: sin eso las tres opciones se ven iguales y
 * no hay forma de saber qué pasa si no se toca nada.
 */
export function ControlBool({
  label,
  valor,
  resuelto,
  onChange,
}: {
  label: string;
  valor: boolean | undefined;
  /** Lo que da la cascada si este bloque no dice nada. */
  resuelto?: boolean;
  onChange: (v: boolean | undefined) => void;
}) {
  const opciones: { v: boolean | undefined; label: string }[] = [
    { v: undefined, label: resuelto === undefined ? "Heredar" : `Heredar (${resuelto ? "sí" : "no"})` },
    { v: true, label: "Sí" },
    { v: false, label: "No" },
  ];
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      {/* Botones y no un `<select>` de tres: son tres opciones de una palabra y
          el panel ya viene denso de desplegables. Mismo patrón que el toggle
          Escritorio/Celular del preview. `tapTarget` porque abajo de `lg` esto
          se toca con el dedo. */}
      <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
        {opciones.map((o) => {
          const puesto = valor === o.v;
          return (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => onChange(o.v)}
              aria-pressed={puesto}
              className={`${tapTarget} flex-1 rounded-md px-2 py-1 text-xs transition-colors ${
                puesto ? "bg-accent-subtle text-accent-subtle-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Chico · Mediano · Grande, de un click.
 *
 * 🔑 **Es el único control del panel que escribe TRES claves a la vez**, y por
 * eso no entra por la tabla `CAMPO` como los demás: ahí cada entrada describe
 * una propiedad. Es un atajo por encima de "Tamaño", "Margen lateral" y "Margen
 * arriba y abajo", que siguen abajo para quien quiera afinar — y que es
 * exactamente lo que había que tocar de a una hasta ahora.
 *
 * ⚠️ **Cuál está puesto se decide comparando lo ESCRITO, nunca lo resuelto.** En
 * `columnas` el automático es 14/18/10, así que preguntar por lo resuelto
 * marcaría "Chico" en un bloque donde nadie eligió nada — y peor, elegir Mediano
 * ahí **agranda** el botón, que es información que el control tiene que poder
 * dar. Cuando la persona afinó las perillas de abajo no coincide ninguno y no se
 * marca ninguno, que es la verdad.
 *
 * **Sin `avanzado`**: es justamente la versión simple de tres perillas finas.
 */
export function ControlTamanoBoton({
  valor,
  onChange,
}: {
  /** Lo que dice ESTA capa para el rol `boton`. */
  valor: EstiloBloque | undefined;
  /**
   * Siempre las **tres** claves, y "Automático" las manda en `undefined` para
   * que se borren. Nunca un objeto a medias: dejar una puesta y las otras dos no
   * es un botón que no es ninguno de los tres tamaños.
   */
  onChange: (v: Record<(typeof CLAVES_TAMANO_BOTON)[number], number | undefined>) => void;
}) {
  const auto = CLAVES_TAMANO_BOTON.every((k) => valor?.[k] === undefined);
  const puesto = auto
    ? "auto"
    : TAMANOS_BOTON.find((t) => CLAVES_TAMANO_BOTON.every((k) => valor?.[k] === t.valores[k]))?.clave;

  const vacio = Object.fromEntries(CLAVES_TAMANO_BOTON.map((k) => [k, undefined])) as Record<
    (typeof CLAVES_TAMANO_BOTON)[number],
    number | undefined
  >;
  const opciones = [{ clave: "auto", label: "Automático", valores: vacio }, ...TAMANOS_BOTON] as const;

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-muted">Tamaño del botón</span>
      {/* La misma barra de botones que `ControlBool` y que el toggle
          Escritorio/Celular del preview. `tapTarget` porque abajo de `lg` esto
          se toca con el dedo. */}
      <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
        {opciones.map((o) => (
          <button
            key={o.clave}
            type="button"
            onClick={() => onChange(o.valores)}
            aria-pressed={puesto === o.clave}
            className={`${tapTarget} flex-1 rounded-md px-2 py-1 text-xs transition-colors ${
              puesto === o.clave ? "bg-accent-subtle text-accent-subtle-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
