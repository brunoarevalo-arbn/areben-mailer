/**
 * El PNG de la cuenta regresiva: se dibuja **en cada apertura del mail**.
 *
 * Es la única parte del motor de diseño con un servicio atrás. Todo lo demás
 * —incluidos los pedazos de `mosaico`— se resuelve en el navegador de quien arma
 * el mail; una cuenta regresiva no puede: el HTML ya salió y lo único que se
 * puede pedir de nuevo desde una casilla es una imagen.
 *
 * 🔴 **Esta ruta NO toca Postgres, y no es una omisión.** La base es compartida
 * con Resorty y está al filo de los 100 CU-h del plan gratuito de Neon: una
 * escritura por apertura sobre un envío de 16.800 contactos la voltea. Acá no se
 * mide nada — para eso está el pixel de `/api/track/open`, que ya corre y ya
 * escribe una sola vez por envío.
 *
 * 🔴 **Y va en `PUBLIC_PREFIXES` del `proxy.ts`.** Sin esa línea el proxy le
 * contesta 307 a `/login` —el destinatario no tiene sesión— y la cuenta sale
 * como una imagen rota para el 100% de los que reciben el mail, sin arreglo
 * posible. Ya pasó el 2-ago-2026 con `/iconos/`. Lo clava `scripts/probar-redes.ts`.
 *
 * ⚠️ **Lo que hay que aceptar**: Gmail sirve las imágenes desde su propio proxy
 * y las cachea, así que en aperturas repetidas el número puede quedar viejo. Le
 * pasa a todos los servicios que hacen esto; es el motivo de que la cuenta vaya
 * en días/horas/minutos y no en segundos.
 */

import { ImageResponse } from "next/og";
import {
  ESCALA,
  cuerpoFin,
  dosDigitos,
  escalar,
  instante,
  leerParams,
  medidas,
  restante,
  type Medidas,
  type ParamsRegresiva,
} from "@/lib/email/regresiva";

// La cuenta cambia con el reloj: si Next la prerenderizara, todos los
// destinatarios verían el número del momento del build.
export const dynamic = "force-dynamic";

/**
 * El árbol que dibuja satori. No es HTML: es un subconjunto de flexbox, y
 * **todo `div` con más de un hijo necesita su `display` explícito** o tira.
 */
type Nodo = { type: "div"; key: null; props: { style: Record<string, unknown>; children: unknown } };
const div = (style: Record<string, unknown>, children: unknown): Nodo => ({
  type: "div",
  // `key` va en null porque `ImageResponse` pide un `ReactElement` y React lo
  // exige en el tipo. Acá no hay reconciliación: satori recorre el árbol una vez.
  key: null,
  props: { style: { display: "flex", ...style }, children },
});

/** Una casilla: el número arriba, su rótulo abajo. */
const casilla = (p: ParamsRegresiva, m: Medidas, ancho: number, numero: string, etiqueta: string): Nodo =>
  div(
    {
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      width: `${ancho}px`,
      height: `${m.alto}px`,
      background: p.bg,
      borderRadius: `${m.radio}px`,
    },
    [
      div({ fontSize: `${m.numero}px`, lineHeight: 1, color: p.tinta }, numero),
      div(
        {
          fontSize: `${m.etiqueta}px`,
          lineHeight: 1,
          color: p.rotulo,
          letterSpacing: `${m.espaciado}px`,
          marginTop: `${m.separacion}px`,
        },
        etiqueta,
      ),
    ],
  );

export async function GET(req: Request) {
  const p = leerParams(new URL(req.url).searchParams);
  // Sin fecha legible no hay nada que contar. El renderer tampoco emite el
  // `<img>` en ese caso, así que llegar acá significa una URL escrita a mano.
  if (!p) return new Response("falta hasta", { status: 400 });

  const base = medidas(p.ancho);
  const m = escalar(base, ESCALA);
  const r = restante(instante(p.hasta)!, new Date());

  // 🔴 Las dos pantallas ocupan el MISMO lienzo. El `<img>` del mail declara un
  // ancho y un alto que se escribieron el día del envío; si la de cierre midiera
  // distinto, el cliente de mail la estiraría hasta el alto de la otra.
  const lienzo = { width: m.ancho, height: m.alto };

  const contenido = r.terminado
    ? div(
        {
          width: `${m.ancho}px`,
          height: `${m.alto}px`,
          background: p.bg,
          borderRadius: `${m.radio}px`,
          alignItems: "center",
          justifyContent: "center",
        },
        // El cuerpo sale de `cuerpoFin` y no de `m.numero`: el texto lo escribe
        // quien arma el mail y al cuerpo de un número de dos dígitos se desborda.
        div(
          { fontSize: `${cuerpoFin(m, p.fin)}px`, lineHeight: 1, color: p.tinta, letterSpacing: `${m.espaciado}px` },
          p.fin,
        ),
      )
    : div(
        { width: `${m.ancho}px`, height: `${m.alto}px`, justifyContent: "space-between" },
        [
          casilla(p, m, m.casillas[0], dosDigitos(r.dias), p.etiquetas[0]),
          casilla(p, m, m.casillas[1], dosDigitos(r.horas), p.etiquetas[1]),
          casilla(p, m, m.casillas[2], dosDigitos(r.minutos), p.etiquetas[2]),
        ],
      );

  return new ImageResponse(contenido, {
    ...lienzo,
    // `no-store` es lo que hace que la cuenta sea una cuenta: sin él la CDN de
    // Vercel devolvería el mismo PNG a todos los que abran el mail después. Que
    // el proxy de Gmail lo ignore es otra historia y está dicha arriba.
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, private" },
  });
}
