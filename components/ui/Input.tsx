import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export function Input({
  label,
  error,
  hint,
  fullWidth = false,
  className = '',
  id,
  ...props
}: InputProps) {
  // Estilo alineado al estándar de la app (igual a NumInput y a los inputs
  // inline existentes): text-sm, px-3 py-2.5, focus en el borde ámbar. Así
  // adoptarlo es un drop-in que no cambia el look.
  const reactId = React.useId();
  const fieldId = id ?? reactId;
  const descId = error ? `${reactId}-err` : hint ? `${reactId}-hint` : undefined;
  const baseClasses = 'border rounded-xl px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 transition-colors focus:outline-none disabled:bg-stone-50 disabled:cursor-not-allowed';
  const stateClasses = error
    ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-400/30'
    : 'border-stone-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30';

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label htmlFor={fieldId} className="block text-xs font-semibold text-stone-600 mb-1.5">
          {label}
        </label>
      )}
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={descId}
        className={`${baseClasses} ${stateClasses} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p id={`${reactId}-err`} className="text-xs text-red-600 mt-1">{error}</p>
      )}
      {hint && !error && (
        <p id={`${reactId}-hint`} className="text-xs text-stone-500 mt-1">{hint}</p>
      )}
    </div>
  );
}
