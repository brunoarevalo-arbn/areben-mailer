# La pasada de parecido, clon por clon

Qué se comparó, qué se arregló y qué **no es expresable**, para que la sesión que viene no
vuelva a intentar lo mismo. Se llena mirando la comparación lado a lado que arma
`node --import tsx scripts/mirar-preset.ts <familia|id>`.

🔑 **El encuadre, del 2-ago-2026 (Bruno):** *"el clon tiene que ser clon, exacto. Luego la
gente edita. Y NO tiene que ponerse NADA de la marca que lo está eligiendo."* La galería es un
catálogo de SaaS: el comerciante entra, ve una miniatura que se parece a lo que fue a buscar,
la elige y **después** la edita. Un punto de partida fiel vale más que uno que se tiñe solo.
Eso da vuelta la regla 4 para los clones — ver `PLANTILLAS.md`.

## Las tres cosas que fallaban en los once, y eran las mismas

1. **El color.** Ningún clon declaraba tema, así que todos salían con el ámbar `#f59e0b` del
   default y con el tema de la marca que los elegía. El dorado de SIMPLE, el azul noche de la
   joyería y el amarillo del audio no estaban en ningún lado. 🔧 **Cada clon declara su `Tema`
   COMPLETO** — `combinarTema` es un spread plano, así que un campo que falte se cae al de la
   marca y el clon deja de ser un clon.
2. **La forma del botón.** El motor rellena siempre, y las referencias hacen cuatro cosas
   distintas: pastilla rellena (R-008), rectángulo sin redondeo (R-018, R-020), pastilla vacía
   con borde (R-007) y **texto subrayado sin caja** (R-002, R-019). Es lo que más cambia la
   cara de un mail y estaba igual en los once.
3. **La portada.** Todas usaban la misma: velo oscuro al 55%, título + subtítulo + botón,
   centrados. Cuatro referencias la ponen **contra un costado** y dos con **texto negro sobre
   foto clara**.

## Los colores no se eligieron a ojo

`node --import tsx scripts/paleta-referencia.ts --todas` los cuenta sobre la propia captura.
Lo medido para esta familia:

| clon | referencia | acento | fondo de página |
|---|---|---|---|
| `marroquineria` | R-002 | `#283840` (pizarra) | blanco |
| `new-arrivals` | R-018 | `#c0a040` (dorado, 3,3%) | `#f0f0f0` |
| `minimal` | R-020 | `#111111` | `#111111` (bandas) |
| `joyeria` | R-007 | pastilla vacía · banda `#183050` (7,6%) | blanco |
| `new-in` | R-008 | `#18c8a0` (verde agua) | blanco |
| `electro` | R-006 | `#3080f8` (azul de CTA, 2,1%) | `#111111` (bandas) |
| `audio` | R-019 | `#f8d000` (amarillo, 6,3%) | `#111111` (bandas) |

🔑 **Las bandas negras de arriba y abajo salen del `fondo` de PÁGINA.** El encabezado y el pie
se dibujan **fuera** de la tarjeta de contenido, así que un fondo de página negro con la
tarjeta blanca da exactamente las dos bandas de R-006, R-019 y R-020 sin ningún bloque nuevo.
Es lo que más acercó esas tres.

## 🔴 El error que se repitió en tres clones

**Clavar `color` en el rol `titulo` de la capa de documento apaga el contraste automático.**
En `marroquineria`, `joyeria` y `new-in` el título salía negro sobre la foto negra de la
portada y de la banda. El motor ya elige claro u oscuro según **dónde cae cada título**
(`bandaConFoto` calcula el contraste contra el color del velo), y un color de documento le
gana a los tres fondos a la vez. **En una plantilla con bandas de foto, el color del título no
se clava en la capa de documento**: se clava en el bloque que lo necesita.

Su gemelo: **un botón claro sobre una foto oscura es un rectángulo blanco**, no un link. El
motor siempre rellena, así que "sin fondo" se emula con un fondo que se confunda con lo que
hay atrás — sobre un velo oscuro, `fondo: "#1f1f1f"`.

## Clon por clon

- **`marroquineria` (R-002)** — Serifa solo en los títulos (el cuerpo es palo seco), CTA de
  texto subrayado en todo el mail, esquinas rectas, íconos en la banda de cierre. Se le sacó
  el título "Por categoría" y el saludo con `${contacto.nombre}`, que la referencia no tiene.
  🟡 Cinco categorías con cuatro (tope del bloque) · 🟡 el pie oscuro `#283840` no es un
  bloque.
- **`new-arrivals` (R-018)** — Portada con el título a 44px **negro, a la derecha, con velo
  blanco al 12%** y sin subtítulo ni botón. La banda de color del "quiénes somos" pasó a texto
  entre dos divisores, que es lo que hay en la captura. Botón por celda **al ancho de la
  celda** (`estilo.boton.ancho: 100`, nuevo). Nombres de producto en mayúsculas.
- **`minimal` (R-020)** — 🔴 **La serifa estaba de más**: en la captura solo el logo es
  serifa y estaba aplicada a todos los títulos. Bandas negras arriba y abajo, botón negro
  cuadrado, sin título entre la portada y las categorías.
- **`joyeria` (R-007)** — Barra de envío en azul noche (antes tomaba el beige del tema),
  portada con el texto **a la izquierda**, botones de pastilla **vacía con borde fino**.
  🟡 La captura pone **cuatro por fila** y `PorFila` es `2 | 3`: va en tres.
- **`new-in` (R-008)** — Verde agua de punta a punta, pastillas con texto blanco, la banda
  "city walking" con foto, y los tres íconos exactos de la captura (camión, tarjeta, escudo).
- **`electro` (R-006)** — Bandas negras, azul solo en los botones, portada con texto a la
  izquierda, el "ver todos" **arriba** de la grilla como en la captura.
- **`audio` (R-019)** — 🔴 **Estaba en tema OSCURO y la referencia no lo es.** Se escribió de
  la ficha ("negro y amarillo") y el mail real es blanco: lo negro son las dos bandas y el
  texto. Medido: 47% de píxeles blancos contra 12,5% negros. Además, el CTA de cada tarjeta es
  texto subrayado y el amarillo aparece una vez por bloque.

## Lo que sigue sin ser expresable (no volver a intentarlo)

- **Menú lateral adentro de la portada** (R-006, R-019): el `hero` es una columna sola.
- **Texto encima de una foto de una celda** (R-008: "adventure life" sobre la foto):
  `position` está prohibido en un mail.
- **Bajada debajo del nombre en una celda de imagen** (R-019): la celda dibuja foto +
  etiqueta y nada más.
- **Badge de descuento sobre la foto** · **cuotas** (es dato, no diseño) · **letra gigante de
  fondo** · **la foto de fondo del mail entero** (R-001).
- **El pie con color propio**: no es un bloque, y no va a serlo — lleva el link de baja.

## ▶️ Lo que la pasada dejó pedido al motor

Los dos pasan la regla de 3 y están en el *Backlog* de `PLANTILLAS.md`:

- **El precio de la tarjeta no puede ser más grande que el nombre.** Los dos salen del mismo
  `eTexto.tamano` (`renderCard`, `render.ts`), y **las siete referencias de esta familia**
  ponen el precio más grande y más pesado que el nombre. Es la diferencia más visible que
  quedó sin arreglar, y pide un rol de estilo nuevo (`precio`).
- **Grilla de cuatro por fila**: `PorFila` es `2 | 3` y la piden R-004, R-007, R-011 y R-021.
  ⚠️ No cuesta una llamada más a Tiendanube: `claveProductos` es `fuente|categoriaId|n` y
  `porFila` no entra en la llave.
