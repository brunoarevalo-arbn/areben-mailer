"use client";

/**
 * Un número que se elige arrastrando, con el valor a la vista.
 *
 * Vivía adentro de `FormBloque.tsx`. Salió a su propio archivo cuando el bloque
 * de productos automáticos —que tiene su propio componente por el fetch de
 * categorías— necesitó el mismo control: copiarlo hubiera dejado dos sliders
 * que se ven distinto en el mismo panel.
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
