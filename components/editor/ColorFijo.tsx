"use client";

/**
 * Color propio del bloque, de los que NO pasan por la cascada.
 *
 * Son los `bg` que existen desde antes del motor de estilos (`hero` y `seccion`)
 * más el de la banda de `foto-encima`, y que el renderer usa para calcular la
 * legibilidad del texto de adentro. Quedan como color libre a propósito: moverlos
 * a la cascada es cambiar la forma del Json de todo mail guardado, y eso tiene su
 * propia migración.
 *
 * Vivía adentro de `FormBloque.tsx`. Salió a su propio archivo cuando el
 * formulario de `foto-encima` —que tiene estado propio y por eso no puede vivir en
 * ese `switch`— necesitó el mismo control: copiarlo habría dejado dos selectores
 * de color que se ven distinto en el mismo panel. Es la misma historia de `Rango`.
 */
export function ColorFijo({
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
