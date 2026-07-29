"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Deshacer / rehacer para el documento que edita el editor de mails.
 *
 * Guarda el contenido ENTERO en cada paso, no un diff. Un mail son unos pocos KB
 * de Json y el anillo son 50 pasos: peor caso ~200 KB en memoria del navegador,
 * contra el costo de mantener un sistema de parches que hay que actualizar cada
 * vez que se agrega un campo a un bloque. La forma del dato ya cambia sola en
 * cada fase; el historial no tiene por qué enterarse.
 */
const LARGO = 50;

/**
 * Ventana en la que dos cambios seguidos cuentan como uno.
 *
 * Sin esto, escribir "Hola" en un título son cuatro entradas del historial y
 * deshacer borra una letra por vez — que es exactamente lo que hace que nadie
 * use el deshacer. Con 300 ms, una ráfaga de tecleo es un solo paso y una pausa
 * corta ya abre uno nuevo.
 */
const FUSION_MS = 300;

export interface Historial {
  deshacer: () => void;
  rehacer: () => void;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
}

export interface OpcionesSet {
  /**
   * Forzar un paso nuevo aunque haya pasado menos de la ventana de fusión.
   *
   * Lo usan las operaciones estructurales —agregar, borrar, duplicar, mover—:
   * son atómicas y encima suelen caer justo después de tipear, así que sin esto
   * la fusión por tiempo se las comería junto con la última letra escrita.
   */
  marcar?: boolean;
}

interface Estado<T> {
  valor: T;
  pasado: T[];
  futuro: T[];
}

/**
 * Estado con historial. Devuelve la misma tupla que `useState` más los controles.
 *
 * El atajo de teclado se registra acá adentro y **pisa el deshacer nativo del
 * navegador**, incluso adentro de un `<input>`. Es a propósito: el valor de cada
 * campo es estado de React, así que el deshacer del navegador no lo puede
 * revertir de verdad — dejaría la letra en pantalla y el documento sin cambiar.
 *
 * ⚠️ Las tres pilas viven en **un solo objeto de estado**, no en refs. Un ref no
 * se puede leer durante el render (lo frena el lint de React), y "¿hay algo para
 * deshacer?" es justamente un dato de render: es lo que apaga el botón.
 */
export function useHistorial<T>(inicial: T): [T, (v: T, o?: OpcionesSet) => void, Historial] {
  const [e, setE] = useState<Estado<T>>({ valor: inicial, pasado: [], futuro: [] });

  // El único dato que no se mira en el render. Se lee y se escribe siempre desde
  // un manejador de eventos, nunca desde el actualizador de estado —que React
  // puede correr dos veces— así que un ref es exactamente lo que corresponde.
  const ultimo = useRef(0);

  const set = useCallback((v: T, o?: OpcionesSet) => {
    const ahora = Date.now();
    const fusiona = !o?.marcar && ahora - ultimo.current < FUSION_MS;
    ultimo.current = ahora;
    setE((prev) => {
      const pasado = fusiona && prev.pasado.length > 0
        ? prev.pasado
        : [...prev.pasado, prev.valor].slice(-LARGO);
      // Una edición nueva mata la rama de rehacer: es la convención de todo
      // editor y evita que rehacer aplique un cambio que ya no tiene sentido.
      return { valor: v, pasado, futuro: [] };
    });
  }, []);

  const deshacer = useCallback(() => {
    // Que el próximo `set` no fusione con lo que había antes de deshacer.
    ultimo.current = 0;
    setE((prev) => {
      if (!prev.pasado.length) return prev;
      return {
        valor: prev.pasado[prev.pasado.length - 1],
        pasado: prev.pasado.slice(0, -1),
        futuro: [...prev.futuro, prev.valor],
      };
    });
  }, []);

  const rehacer = useCallback(() => {
    ultimo.current = 0;
    setE((prev) => {
      if (!prev.futuro.length) return prev;
      return {
        valor: prev.futuro[prev.futuro.length - 1],
        pasado: [...prev.pasado, prev.valor].slice(-LARGO),
        futuro: prev.futuro.slice(0, -1),
      };
    });
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      // `metaKey` en Mac, `ctrlKey` en Windows. Los dos, no uno u otro: el panel
      // se abre en las dos plataformas y nadie prueba en la que no usa.
      if (!(ev.metaKey || ev.ctrlKey) || ev.key.toLowerCase() !== "z") return;
      ev.preventDefault();
      if (ev.shiftKey) rehacer();
      else deshacer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deshacer, rehacer]);

  return [
    e.valor,
    set,
    {
      deshacer,
      rehacer,
      puedeDeshacer: e.pasado.length > 0,
      puedeRehacer: e.futuro.length > 0,
    },
  ];
}
