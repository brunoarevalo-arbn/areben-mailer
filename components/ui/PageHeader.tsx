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
    <div className={`mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <span className="text-xs font-bold uppercase tracking-widest text-accent">{eyebrow}</span>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">{title}</h1>
        {subtitle && <p className="text-muted text-sm mt-1">{subtitle}</p>}
      </div>
      {/*
        `shrink-0` solo vale cuando el header es una fila (`sm+`): apilado, el
        contenedor ya ocupa el ancho entero y no hay nada de qué defenderse. Y
        `flex-wrap` es lo que evita que dos o tres CTAs desborden los 343px de
        un celular, donde antes salían en una sola línea que no achicaba.
      */}
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </div>
  );
}
