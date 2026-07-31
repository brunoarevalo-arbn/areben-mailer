// Clases compartidas de UI (Tailwind v4 + tokens de globals.css).

/**
 * Todo lo del campo MENOS el alto: el tronco que comparten las dos variantes.
 *
 * 🔴 **El `text-base` abajo de `lg` no es estética: abajo de 16px iOS Safari
 * hace zoom solo al enfocar** y deja al comerciante con la página corrida y sin
 * forma obvia de volver. En `lg` vuelve a `text-sm`, así que el escritorio queda
 * exactamente como estaba.
 */
const campoSinAlto =
  "rounded-lg border border-border-strong bg-background text-foreground placeholder:text-subtle px-3 text-base lg:text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/30";

/**
 * Input/select/textarea SIN ancho: la base de la que sale todo lo demás.
 *
 * Vive acá y no copiado en cada componente porque hasta el 31-jul-2026 este
 * mismo string estaba escrito CINCO veces —`inputClass` más cuatro `const input`
 * byte-idénticos en SegmentoBuilder, ContactosAcciones, ProductosBlock y
 * AutomationEditor—. Con cinco copias, cambiarle una propiedad a los campos
 * (por ejemplo el tamaño de letra: abajo de 16px iOS Safari zoomea solo al
 * enfocar) es acordarse de cinco archivos, y alcanza con olvidarse de uno para
 * que medio panel quede distinto.
 *
 * El `py-3` de celular es la yapa del 16px: da ~46px de alto táctil sin tocar
 * ninguna otra clase, y en `lg` vuelve al `py-2` de siempre.
 *
 * ⚠️ NO es el único estilo de campo de la app: `components/ui/{Input,Select,
 * Textarea}` son otra familia (`rounded-xl`, `border-border`, `py-2.5`, con
 * label/error/hint). Unificar las dos es un cambio estético de toda la app y es
 * otra conversación; lo que sí tiene que valer para las dos son las propiedades
 * que hacen al celular.
 */
export const campoBase = `${campoSinAlto} py-3 lg:py-2`;

/** Input/select/textarea de ancho completo con foco ámbar (tokens). */
export const inputClass = `w-full ${campoBase}`;

/**
 * La variante baja del mismo campo (el `py-1.5` de los controles finos).
 *
 * Existe como export y no como `` `${campoBase} py-1.5` `` porque **dos
 * utilidades de la misma propiedad no se resuelven por el orden del string**:
 * gana la que Tailwind escribió última en el CSS, no la última que escribiste
 * vos. `${inputClass} py-1.5` (TemaSelector) y la copia con `py-1.5` de
 * `ControlEstilo` son las dos formas de ese mismo intento; con un tronco común
 * y un solo `py` por constante, no hay pelea que resolver.
 */
export const campoCompacto = `${campoSinAlto} py-2 lg:py-1.5`;

/**
 * 44×44 de superficie táctil en celular; en escritorio no cambia nada.
 *
 * 44px es el mínimo que recomiendan Apple y Google para algo que se toca con el
 * dedo. Los botones de ícono de la app rondan los 28-32px: alcanzan con el
 * mouse y se fallan con el dedo. Se apaga en `lg` porque agrandarlos en
 * escritorio no arregla nada y deja la interfaz inflada.
 */
export const tapTarget = "min-h-11 min-w-11 lg:min-h-0 lg:min-w-0";
