"use client";

import { tapTarget } from "@/lib/ui";

/**
 * Una barra de opciones excluyentes: pocas, cortas y con el nombre a la vista.
 *
 * Es la misma barra que ya usan `ControlTamanoBoton` del panel de estilo y el
 * toggle Escritorio/Celular del preview. Salió a `ui/` cuando la necesitó el
 * tercer lugar (el tamaño y el formato de una foto): tres copias del mismo
 * control es cómo se termina con tres barras que se ven distinto en el mismo
 * panel — que es justo lo que ya había pasado con `Rango`.
 *
 * ⚠️ **El valor se compara contra lo que está ESCRITO**, nunca contra lo
 * resuelto: la opción "como siempre" suele ser la ausencia del campo, y
 * comparando contra un default se vería marcada y sin marcar según de dónde
 * venga.
 */
export function BarraOpciones<T extends string>({
  label,
  value,
  opciones,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  opciones: readonly { clave: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
        {opciones.map((o) => (
          <button
            key={o.clave}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.clave)}
            aria-pressed={value === o.clave}
            className={`${tapTarget} flex-1 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
              value === o.clave ? "bg-accent-subtle text-accent-subtle-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
