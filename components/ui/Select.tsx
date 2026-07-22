import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

// Espejo de Input.tsx pero para <select>. Misma API (label/error/hint/fullWidth)
// y mismo estilo (rounded-xl, foco en borde ámbar) para consistencia.
export function Select({
  label,
  error,
  hint,
  fullWidth = false,
  className = '',
  id,
  children,
  ...props
}: SelectProps) {
  const reactId = React.useId();
  const fieldId = id ?? reactId;
  const descId = error ? `${reactId}-err` : hint ? `${reactId}-hint` : undefined;
  const baseClasses = 'border rounded-xl px-3 py-2.5 text-sm text-stone-900 bg-white transition-colors focus:outline-none disabled:bg-stone-50 disabled:cursor-not-allowed';
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
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={descId}
        className={`${baseClasses} ${stateClasses} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={`${reactId}-err`} className="text-xs text-red-600 mt-1">{error}</p>
      )}
      {hint && !error && (
        <p id={`${reactId}-hint`} className="text-xs text-stone-500 mt-1">{hint}</p>
      )}
    </div>
  );
}
