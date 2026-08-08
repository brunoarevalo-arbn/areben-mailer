import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { contactosElegibles, crearEnvios } from "@/lib/campanias";
import { proximaTanda } from "@/lib/contactos/tramos";
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
  | { ok: true; total: number; esTest?: boolean; modo: ModoEnvio; omitidos: number; restantes?: number }
  | { ok: false; error: string };

/**
 * Mandar de a poco sobre un destino grande, sin fabricar una lista por escalón.
 *
 * 🔑 **Es lo que reemplaza a las listas de tramo.** Hasta hoy, "mandale a 1.000
 * de estos 5.280" no existía: el motor manda a una lista o segmento COMPLETO,
 * así que cada escalón de un ramp tenía que fabricar una lista a mano. Eso dejó
 * 24 listas entre BDI y Zattia, la mayoría sin uso, y —peor— **nada impedía que
 * dos se solaparan**: el índice único de `Envio` es por campaña, así que evita
 * el doble envío de LA MISMA campaña, no el de dos campañas distintas.
 *
 * Con un tope, el destino es un segmento que se recalcula solo y el "ya le
 * mandé" sale de `Envio`, que es donde siempre estuvo.
 */
export interface OpcionesEncolar {
  /** Cuántos como máximo. Ausente = todos, que es como se comportó siempre. */
  tope?: number;
  /**
   * Reanudar una campaña ya enviada: manda a los que quedaron afuera del tope.
   *
   * 🔑 Es una puerta aparte y no un relajamiento de la guarda de `ENVIADA`:
   * volver a mandar una campaña terminada tiene que ser algo que alguien pidió
   * explícitamente, no algo que pasa por apretar dos veces el botón de siempre.
   */
  continuar?: boolean;
}

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
export async function encolarCampania(
  cuenta: CuentaEnvio,
  id: string,
  opts: OpcionesEncolar = {},
): Promise<ResultadoEncolar> {
  const campania = await prisma.campania.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!campania) return { ok: false, error: "Campaña no encontrada" };

  // ⚠️ `ENVIANDO` frena las dos puertas: hay una cola con lease corriendo sobre
  // esta campaña y meterle envíos nuevos en el medio es pedirle a dos workers
  // que se pisen. Reanudar se hace con la campaña quieta.
  if (campania.estado === "ENVIANDO")
    return { ok: false, error: "La campaña se está enviando ahora mismo" };
  if (opts.continuar) {
    if (campania.estado !== "ENVIADA")
      return { ok: false, error: "Solo se puede continuar una campaña que ya salió" };
  } else if (campania.estado === "ENVIADA") {
    return { ok: false, error: "La campaña ya fue enviada" };
  }

  const motivo = await validarEnvio(cuenta, campania);
  if (motivo) return { ok: false, error: motivo };

  // ⛔ El tope y el A/B se pelean por el mismo recorte: el A/B ya reparte una
  // muestra entre las dos variantes y decide el resto con el ganador. Dos
  // criterios de corte encima del otro no tienen una respuesta correcta.
  if ((opts.tope != null || opts.continuar) && campania.abTestPct != null)
    return { ok: false, error: "Una campaña con test A/B se manda entera: no admite tope ni continuar" };

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

  /**
   * Los que YA tienen `Envio` de esta campaña salen antes de recortar.
   *
   * 🔴 El índice único `[campaniaId, contactoId]` + `skipDuplicates` ya hacen
   * imposible mandar dos veces, así que esto **no es la protección**: es lo que
   * hace que el tope signifique algo. Sin este filtro, "los próximos 1.000"
   * agarra a los primeros 1.000 de siempre, `skipDuplicates` los descarta a
   * todos y **no sale nadie nuevo** — un botón que dice que mandó y no mandó.
   */
  const yaEncolados = new Set(
    opts.continuar || opts.tope != null
      ? (await prisma.envio.findMany({ where: { campaniaId: id }, select: { contactoId: true } }))
          .map((e) => e.contactoId)
      : [],
  );
  // El recorte vive en `proximaTanda` (puro): es la parte que se puede romper
  // —solaparse, saltear gente— y probarla acá adentro sería mandar mails.
  const { tanda: aMandar, restantes } = proximaTanda(contactos, yaEncolados, opts.tope);
  if (aMandar.length === 0)
    return { ok: false, error: "Ya salió a todos los contactos elegibles de esta campaña" };

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
    await crearEnvios(cuenta.id, id, aMandar, null);
  }

  // ⚠️ `programadaAt` se limpia al disparar. Si no, una campaña que alguien
  // mandó a mano antes de su hora queda con una fecha que ya no significa nada,
  // y el panel la seguiría anunciando para las 19:00.
  await prisma.campania.update({ where: { id }, data: { estado: "ENVIANDO", programadaAt: null } });
  // `total` es cuántos envíos EXISTEN, no cuántos se crearon recién: al
  // continuar, es acumulado. Es el número que la pantalla necesita para decir
  // "1.000 de 2.338", y para un envío sin tope los dos coinciden.
  const total = await prisma.envio.count({ where: { campaniaId: id } });
  after(() => arrancarCola());
  return esAB
    ? { ok: true, total, esTest: true, modo, omitidos }
    : { ok: true, total, modo, omitidos, restantes };
}
