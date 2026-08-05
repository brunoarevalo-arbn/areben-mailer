"use client";

import { Stepper } from "@/components/ui/Stepper";

/**
 * Un número del formulario de contenido: ancho del logo, alto de un hero, velo,
 * alto del espaciador, cuántos productos mostrar.
 *
 * Vivía adentro de `FormBloque.tsx`. Salió a su propio archivo cuando el bloque
 * de productos automáticos —que tiene su propio componente por el fetch de
 * categorías— necesitó el mismo control: copiarlo hubiera dejado dos controles
 * que se ven distinto en el mismo panel.
 *
 * ⚠️ **Se llama `Rango` por historia, no por forma**: era un
 * `<input type="range">` hasta el 5-ago-2026. Hoy es el `Stepper`, igual que el
 * `ControlNumero` del panel de estilo — el nombre quedó porque lo importan seis
 * lugares y renombrarlo no cambia nada de lo que hace.
 */
export function Rango({
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
    <div className="block">
      <div className="mb-1 text-xs font-semibold text-muted">{label}</div>
      <Stepper
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        paso={step}
        sufijo={sufijo}
        etiqueta={label}
      />
    </div>
  );
}
