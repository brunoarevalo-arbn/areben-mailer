import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { contactosElegibles, crearEnvios } from "@/lib/campanias";
import { arrancarCola } from "@/lib/email/cola";
import { estadoEnvioMarca, motivoEnTexto } from "@/lib/remitentes";
import {
  destinatarioPermitido,
  modoEnvio,
  MSG_ENVIO_BLOQUEADO,
  type ModoEnvio,
} from "@/lib/email/proveedor";
import type { Campania } from "@prisma/client";

/**
 * Encolar una campaña, **sin sesión**.
 *
 * Por qué existe este archivo y no vive en `campanias/actions.ts`: desde que se
 * puede **programar** un envío, el mismo trabajo lo dispara el cron —que no
 * tiene cookie— además de la persona que aprieta el botón. Todas las guardas
 * vivían adentro de la server action, después de `chequear("enviar")`.
 *
 * ⛔ **No se resolvió exportando el núcleo desde `actions.ts`.** Ese archivo es
 * `"use server"`: **cada export suyo es un endpoint RPC alcanzable desde el
 * navegador**, así que un `encolarCampania` exportado ahí sería un envío a la
 * lista entera sin autorizar. Además `auditar-permisos.ts` exige que toda action
 * declare su permiso, y esta función justamente no puede pedir ninguno.
 *
 * Acá adentro **no hay ni un chequeo de permisos a propósito**: quien llame es
 * responsable de haberlo hecho (la action) o de ser el cron (que entra por
 * `CRON_SECRET` y ya resolvió que la campaña estaba programada por alguien que
 * sí tenía el permiso).
 */

/** Lo que necesita saber de la cuenta. El `nombre` solo para el mensaje de error. */
export interface CuentaEnvio {
  id: string;
  nombre: string;
}

export type ResultadoEncolar =
  | { ok: true; total: number; esTest?: boolean; modo: ModoEnvio; omitidos: number }
  | { ok: false; error: string };

/**
 * Todo lo que tiene que ser cierto para que una campaña pueda salir, en un solo
 * lugar. Devuelve el primer motivo por el que no, o `null` si puede.
 *
 * 🔑 Lo llaman **dos** caminos: encolar (justo antes de mandar) y **programar**.
 * Que programar corra las mismas guardas es lo que hace que un remitente sin
 * verificar se descubra a las 15:00, cuando alguien está mirando la pantalla, y
 * no a las 19:00 cuando la campaña tenía que salir sola.
 *
 * ⚠️ Igual se vuelve a correr al disparar: entre programar y mandar pueden pasar
 * horas, y el gate, el remitente o la lista pueden haber cambiado.
 */
export async function validarEnvio(
  cuenta: CuentaEnvio,
  campania: Pick<Campania, "asunto" | "asuntoB" | "abTestPct" | "listaId" | "segmentoId">,
): Promise<string | null> {
  if (!campania.asunto) return "Falta el asunto";
  if (!campania.listaId && !campania.segmentoId) return "Falta el destino (lista o segmento)";
  if (campania.abTestPct != null && !campania.asuntoB) return "Falta el asunto B";

  // Mientras el proveedor no esté aprobado para producción no dejamos enviar a
  // la lista real (los destinos no verificados rebotarían en masa).
  if (modoEnvio() === "bloqueado") return `${MSG_ENVIO_BLOQUEADO} Mientras tanto usá "Enviar prueba".`;

  // Sin remitente propio VERIFICADO no se manda, y se avisa ACÁ: llegar a
  // `armarFrom` con 5.000 envíos ya encolados sería descubrirlo cuando la
  // campaña está en curso. El mensaje distingue "no cargaste remitente" de
  // "falta el DNS": son dos problemas con dos soluciones distintas.
  const marcaLista = await estadoEnvioMarca(cuenta.id);
  if (!marcaLista.ok) return `${cuenta.nombre}: ${motivoEnTexto(marcaLista)}`;

  return null;
}

/** Fisher-Yates in-place. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Crea los `Envio` de una campaña y la pone `ENVIANDO`. A partir de ahí manda la
 * cola del servidor (`lib/email/cola.ts`), que se auto-encadena sola.
 */
export async function encolarCampania(cuenta: CuentaEnvio, id: string): Promise<ResultadoEncolar> {
  const campania = await prisma.campania.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!campania) return { ok: false, error: "Campaña no encontrada" };
  if (campania.estado === "ENVIANDO" || campania.estado === "ENVIADA")
    return { ok: false, error: "La campaña ya fue enviada" };

  const motivo = await validarEnvio(cuenta, campania);
  if (motivo) return { ok: false, error: motivo };

  const modo = modoEnvio();
  const todos = await contactosElegibles(cuenta.id, campania);
  if (todos === null) return { ok: false, error: "Segmento no encontrado" };
  if (todos.length === 0) return { ok: false, error: "No hay contactos elegibles" };

  // En ensayo recortamos acá para no crear miles de Envío que nacen condenados.
  // El corte que de verdad protege está en procesarLote, pegado al envío.
  const contactos = modo === "ensayo" ? todos.filter((c) => destinatarioPermitido(c.email)) : todos;
  const omitidos = todos.length - contactos.length;
  if (contactos.length === 0)
    return {
      ok: false,
      error: `Modo ensayo: ninguno de los ${todos.length} contactos elegibles está en ENVIO_ENSAYO.`,
    };

  const esAB = campania.abTestPct != null;
  if (esAB) {
    // Test A/B: mandar A y B a una muestra; el resto espera al ganador.
    const pct = campania.abTestPct!;
    // Muestra total (mín. 2 para que haya al menos 1 por variante), sin pasar el total.
    const testTotal = Math.min(contactos.length, Math.max(2, Math.floor((contactos.length * pct) / 100)));
    const muestra = shuffle([...contactos]).slice(0, testTotal);
    const mitad = Math.ceil(muestra.length / 2);
    await crearEnvios(cuenta.id, id, muestra.slice(0, mitad), "A");
    await crearEnvios(cuenta.id, id, muestra.slice(mitad), "B");
  } else {
    await crearEnvios(cuenta.id, id, contactos, null);
  }

  // ⚠️ `programadaAt` se limpia al disparar. Si no, una campaña que alguien
  // mandó a mano antes de su hora queda con una fecha que ya no significa nada,
  // y el panel la seguiría anunciando para las 19:00.
  await prisma.campania.update({ where: { id }, data: { estado: "ENVIANDO", programadaAt: null } });
  const total = await prisma.envio.count({ where: { campaniaId: id } });
  after(() => arrancarCola());
  return esAB ? { ok: true, total, esTest: true, modo, omitidos } : { ok: true, total, modo, omitidos };
}
