"use client";

import { ExternalLink } from "lucide-react";
import { tapTarget } from "@/lib/ui";

/**
 * "Abrir en una pestaña": el mail como página, donde los links **sí** andan.
 *
 * Adentro del editor todo click se frena —si no, tocar un botón navegaba el
 * iframe a la tienda y dejaba el preview en blanco—, así que no había forma de
 * contestar la otra pregunta que uno le hace a un mail terminado: *¿este link
 * lleva a donde creo?*. Son dos cosas distintas y por eso son dos vistas.
 *
 * 🔴 **Es un `<form target="_blank">` y no un `window.open`.** El HTML que hay
 * que abrir es el que está en pantalla, no el último guardado, así que viaja en
 * el body de un POST; y un POST no se puede abrir en una pestaña con
 * `window.open`. De paso el submit lo dispara el usuario, así que ningún
 * bloqueador de pop-ups lo frena — cosa que sí pasa cuando la pestaña se abre
 * después de un `await`.
 *
 * ⚠️ **Los links van a la URL cruda del comercio, sin el redirect de medición.**
 * Esto prueba que el producto exista, no que el click se cuente: eso se prueba
 * con "Enviar prueba", que es el único camino que pasa por `inyectarTracking`.
 */
export function AbrirEnPestana({ html }: { html: string }) {
  return (
    <form
      action="/api/vista"
      method="POST"
      target="_blank"
      // Sin esto el navegador manda `application/x-www-form-urlencoded`, que
      // para ~100 KB de mail es una cadena escapada gigante.
      encType="multipart/form-data"
      className="contents"
    >
      {/* ⛔ Sin los `data-b`: esa marca existe solo para saber qué bloque se
          tocó adentro del editor, y `probar-marcado.ts` fija que no se escape
          de ahí. En una pestaña no hay nada que seleccionar. */}
      <input type="hidden" name="html" value={html.replace(/ data-b="[^"]*"/g, "")} />
      <button
        type="submit"
        title="Abre el mail como página, con los links vivos. No mide clicks: para eso está Enviar prueba."
        className={`${tapTarget} flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:text-foreground`}
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        Probar los links
      </button>
    </form>
  );
}
