'use client';

import { useState, useEffect, InputHTMLAttributes } from 'react';

type NumInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (n: number) => void;
};

/**
 * Input numérico reutilizable. Resuelve el "problema del 0":
 * - cuando el valor es 0 muestra vacío (no un 0 molesto que hay que borrar)
 * - selecciona todo el contenido al enfocar, así escribís encima directo
 * Mantiene un buffer de texto interno para poder tipear "0.5", "0.", etc. sin
 * que el número parseado pelee con lo que estás escribiendo.
 *
 * Fuerza step="any": son campos de decimales libres. Con un step fijo (ej. 0.5)
 * un valor que no caiga justo en el paso (ej. 11.8 traído de producción) dispara
 * la validación nativa de HTML y bloquea el submit del formulario.
 */
// Decimales en Argentina se escriben con COMA. Como es un input de texto, aceptamos
// coma y punto al tipear y parseamos con coma→punto; el buffer se muestra con coma.
const parseNum = (s: string) => parseFloat(s.replace(',', '.')) || 0;
const toBuf = (v: number) => (v ? String(v).replace('.', ',') : '');

export function NumInput({ value, onChange, onFocus, onWheel, step: _step, ...rest }: NumInputProps) {
  const [buf, setBuf] = useState(() => toBuf(value));

  // Sincroniza si el valor externo cambia por fuera de lo que se está tipeando
  // (reset de formulario, autocompletado desde producción, etc.)
  useEffect(() => {
    if (parseNum(buf) !== value) setBuf(toBuf(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={buf}
      onChange={(e) => {
        // Solo dígitos, coma, punto y signo (evita letras); coma es el separador decimal.
        const limpio = e.target.value.replace(/[^0-9.,-]/g, '');
        setBuf(limpio);
        onChange(parseNum(limpio));
      }}
      onFocus={(e) => { e.currentTarget.select(); onFocus?.(e); }}
      // Sin flechitas (type text) y la ruedita no cambia el valor.
      onWheel={(e) => { e.currentTarget.blur(); onWheel?.(e); }}
    />
  );
}
