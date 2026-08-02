"use client";

// La tarjeta de la galería: la miniatura abre el mail entero.
//
// 🔑 Mirar es gratis y crear no. Hasta el 2-ago-2026 el único botón decía
// "Usar" y creaba una campaña BORRADOR: para saber si una plantilla servía había
// que crearla. Ahora la acción de la tarjeta es **Ver**, y recién adentro del
// modal se elige qué crear — el verbo dice qué pasa.

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { MiniaturaMail } from "@/components/MiniaturaMail";
import { ModalVistaPrevia } from "@/components/ModalVistaPrevia";
import { tapTarget } from "@/lib/ui";

export function TarjetaPlantilla({
  titulo,
  subtitulo,
  html,
  anchoMail,
  /** Los botones del pie del modal ("Crear campaña", …). Vienen del server. */
  acciones,
  /** Botones extra en la tarjeta misma (Editar, Eliminar). También del server. */
  pie,
}: {
  titulo: string;
  subtitulo: string;
  html: string;
  anchoMail?: number;
  acciones?: ReactNode;
  pie?: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Card padding="none" className="overflow-hidden">
        {/* La miniatura entera es el disparador: es lo que uno intenta tocar
            antes de buscar un botón. El `<button>` no envuelve nada clickeable
            (la miniatura va con `pointer-events-none`), así que no hay anidado. */}
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="block w-full cursor-zoom-in text-left"
          aria-label={`Ver ${titulo}`}
        >
          <MiniaturaMail titulo={titulo} html={html} />
        </button>
        <div className="p-4">
          <div className="truncate font-medium text-foreground" title={titulo}>
            {titulo}
          </div>
          <div className="mt-1 text-xs text-muted">{subtitulo}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAbierto(true)}
              className={`${tapTarget} flex-1 rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover`}
            >
              Ver
            </button>
            {pie}
          </div>
        </div>
      </Card>

      {abierto && (
        <ModalVistaPrevia
          titulo={titulo}
          html={html}
          anchoMail={anchoMail}
          acciones={acciones}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}
