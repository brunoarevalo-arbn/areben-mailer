"use client";

import { useState } from "react";
import type { ResultadoGuardado } from "@/lib/documentos";

/**
 * El guardado de un documento del editor (campaña, automation o plantilla),
 * con detección de conflicto.
 *
 * 🔴 **Existe para que olvidarse de chequear el resultado no pueda mandar un
 * mail viejo.** Los tres editores guardan ANTES de mandar una prueba, de
 * enviar, de programar y de activar — y hasta el 20-ago-2026 lo hacían con un
 * `await guardarX(...)` cuyo resultado se tiraba. Con el guardado siempre
 * exitoso eso era inofensivo; desde que se puede NEGAR, un guardado rechazado
 * seguido de un envío manda **lo viejo**, que es exactamente el accidente que la
 * detección de conflicto viene a evitar, al revés.
 *
 * Por eso devuelve un `boolean` y no un objeto: la única pregunta que el
 * llamador tiene que hacerse es **"¿escribió?"**, y frenar si no. Lo custodia
 * `scripts/auditar-guardado.ts`, que se pone rojo si alguien vuelve a escribir
 * `await guardarCampania(...)` suelto.
 *
 * (Mismo criterio que el resultado de `toggleAutomation`, que también se
 * descartaba entero y por eso "no podés encender: falta el remitente" no
 * llegaba nunca a la pantalla.)
 */
export function useGuardadoDoc(versionInicial: number) {
  const [version, setVersion] = useState(versionInicial);
  const [conflicto, setConflicto] = useState<string | null>(null);

  /**
   * Corre el guardado con la versión que tiene esta pantalla y contesta si
   * ESCRIBIÓ.
   *
   * ⚠️ Al escribir se queda con la versión nueva. Sin eso, el segundo guardado
   * seguido chocaría contra su propio primero y la pantalla diría "alguien más
   * lo guardó" cuando ese alguien fue uno mismo — un aviso falso que se aprende
   * a ignorar en dos días, y ahí el arreglo empeora el lugar que venía a
   * arreglar.
   */
  async function guardarDoc(
    fn: (version: number) => Promise<ResultadoGuardado>,
  ): Promise<boolean> {
    const r = await fn(version);
    if (!r.ok) {
      setConflicto(r.error);
      return false;
    }
    setVersion(r.version);
    setConflicto(null);
    return true;
  }

  return { conflicto, guardarDoc, limpiarConflicto: () => setConflicto(null) };
}
