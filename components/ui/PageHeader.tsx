import React from 'react';

interface PageHeaderProps {
  /** Etiqueta chica arriba del título (módulo/sección). */
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  /** Slot a la derecha para CTAs (botones, links). */
  actions?: React.ReactNode;
  className?: string;
}

// Header de página consistente en todos los módulos. Reemplaza el bloque
// eyebrow + h1 + subtítulo que estaba repetido inline en cada página.
export function PageHeader({ eyebrow, title, subtitle, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`mb-8 flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <span className="text-xs font-bold uppercase tracking-widest text-amber-500">{eyebrow}</span>
        )}
        <h1 className="text-2xl font-bold text-stone-900 mt-1">{title}</h1>
        {subtitle && <p className="text-stone-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
