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

---

# La familia Venta (ronda 2, 2-ago-2026)

Los cuatro clones: `brasas` (R-001) · `final-sale` (R-010) · `tu-estilo` (R-012) ·
`mega-oferta` (R-021).

🔑 **Fallaba lo mismo que en catálogo, y encima peor: los cuatro no declaraban `Tema`.**
Tres no declaraban ninguno y el cuarto —`tu-estilo`— declaraba dos campos. O sea que los
cuatro salían con el ámbar `#f59e0b` del default y se teñían con la marca que los elegía,
que es exactamente lo que la regla 4 partida prohíbe.

## Los colores, medidos

| clon | referencia | acento | fondo de página |
|---|---|---|---|
| `brasas` | R-001 | `#f89800` (naranja de brasa) | `#181818` (62,5%), **igual que la tarjeta** |
| `final-sale` | R-010 | `#18a8e8` (celeste, 9,4%) · CTA **negros** | `#18a8e8` |
| `tu-estilo` | R-012 | `#d83028` (28,8%) · CTA **negros** | `#d83028` |
| `mega-oferta` | R-021 | `#0038e8` (azul de CTA, 2,3%) | `#202020` · cierre `#80c000` |

## Los tres hallazgos de esta ronda

1. 🔴 **El color de la referencia no siempre es el `acento`: a veces es el `fondo`.** En
   R-012 el rojo es el **28,8% de los píxeles** —el encabezado, dos bloques y el pie—, y
   estaba escrito como acento: daba un mail blanco con botones rojos, que es otra plantilla.
   La pregunta no es "¿de qué color es?" sino **"¿cuánto ocupa?"**. Arriba del ~20% es fondo.
   Su gemelo: en tres de los cuatro los **botones son negros**, y el color de la marca no
   toca un solo botón.
2. 🔑 **`fondo` y `fondoContenido` iguales borran la tarjeta.** R-001 es una sola pieza
   oscura de borde a borde; con dos oscuros distintos se ve el recuadro de la tarjeta
   recortado contra la página, y eso solo lo tenía nuestro render. Es la contracara del
   truco de las bandas: ahí los colores se separan **a propósito**.
3. 🔴 **El botón *outline* era "no expresable" y no lo era.** La ficha de R-001 decía que el
   rol `boton` no emite borde; lo emite desde `bordeAncho`/`bordeColor`, que estrenó
   `joyeria` en la ronda anterior. Al escribirlo apareció el bug de verdad: el
   `<v:roundrect>` tenía **`stroke="f"` cableado**, así que en Outlook el borde no se
   dibujaba nunca — y `joyeria` ya estaba en producción con una pastilla blanca sobre fondo
   blanco, o sea sin botón. Arreglado en `shell.ts`.

## 🔴 El pie se volvió ilegible sobre un fondo saturado

Estrenar fondos de página **del medio** (celeste, rojo) destapó que `pal.tenue` —el gris del
pie— es fijo por tema y no mira el fondo. Medido: `#a3a3a3` sobre el celeste `#18a8e8` da
**1,05:1**. Y en el pie vive el **link de baja**, que es obligatorio.

Se arregló en el motor con `tenueSobre()` (`estilos.ts`): contra un fondo **extremo**
—blanco o casi negro— queda el gris de siempre, y contra uno del medio se va al extremo
contrario con la misma tabla que usa el resto del motor. 🔑 **Ninguna plantilla ya publicada
se movió**: todas las que declaran `fondo` propio lo tienen en `#111111` o `#f0f0f0`, y el
golden lo confirma —solo se movieron `final-sale` y `tu-estilo`—.

## Clon por clon

- **`brasas` (R-001)** — Una sola pieza `#181818`, título póster de 48px, botones *outline*
  blancos, dos líneas blancas finas y fotos de producto al ras. 🟡 La foto de brasas es del
  MAIL ENTERO y no es expresable: queda en la portada, con una **textura** (madera oscura,
  velo 72) y no un producto — lo que hay atrás del título de la referencia es materia.
- **`final-sale` (R-010)** — Marco celeste, CTA negros rectos, banda celeste en el medio y
  cierre oscuro con una `barra()`. 🟡 Tres cosas quedaron afuera: el menú sobre celeste y el
  gris de la fila de categorías (`caja.fondo` no existe fuera de `hero`/`seccion`/`cupon`) y
  la foto del auto al costado de la banda de color.
- **`tu-estilo` (R-012)** — Rojo en el `fondo` de página ⇒ encabezado y pie rojos, más dos
  `seccion` rojas adentro. Botones negros, salvo los de la grilla, que la referencia
  **invierte**: blancos con el texto y el borde rojos. Sobre la foto va solo el título.
- **`mega-oferta` (R-021)** — Banda negra arriba, azul solo en los botones, cupón e hilos
  divisores en verde lima y los íconos en la banda de beneficios. 🟡 El pie verde de la
  captura no entra por el fondo de página —arriba tiene que ser negro y hay uno solo—, así
  que el cierre verde va adentro de la tarjeta.

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

---

# La familia Fechas (ronda 3, 2-ago-2026)

Los seis clones: `temporada` (R-004) · `spring-sale` (R-011) · `cyber-tipografico` (R-013) ·
`cyber-marmol` (R-015) · `vuelta-al-cole` (R-014) · `invitacion` (R-017). La familia pasó de
**1 a 7**.

🔑 **La diferencia con las dos rondas anteriores es que estos se escribieron mirando la
captura desde el principio**, no arreglándolos después: paleta medida antes de la primera
línea y `Tema` completo declarado de entrada. El resultado se nota en cuánto hubo que
corregir — cuatro retoques después de la primera comparación, contra once clones enteros
reescritos en la ronda 1.

## Los colores, medidos

| clon | referencia | acento | fondo de página |
|---|---|---|---|
| `temporada` | R-004 | `#111111` (ningún saturado arriba de 0,43%) | blanco |
| `spring-sale` | R-011 | `#111111` · hilo `#c03030` | `#e8f0f0` |
| `cyber-tipografico` | R-013 | `#0058d0` (2,4%) | `#080028` (**74,4%**), igual que la tarjeta |
| `cyber-marmol` | R-015 | `#485098` (1,5%) | `#101010`, igual que la tarjeta |
| `vuelta-al-cole` | R-014 | `#111111` | `#000000` (32,3%) |
| `invitacion` | R-017 | `#304858` (8,8%) | `#f8f8f8` |

⚠️ **El plan había elegido tres hex a ojo y los tres estaban mal**: `cyber-tipografico`
#2b4cff (el real es un fondo #080028 más un CTA #0058d0, o sea dos colores y ninguno ése),
`cyber-marmol` #6d3bd6 (el real #485098 es mucho menos saturado) y el "coral" de R-011, que
recortado y medido aparte dio **#c03030**, un rojo ladrillo.

## Los tres hallazgos de esta ronda

1. 🔑 **La barra de color pegada abajo de una foto es el BOTÓN de la celda, no una etiqueta.**
   En R-013 cada categoría cierra con un rectángulo azul sólido de ancho completo. `caja.fondo`
   no existe en `columnas` y parecía no expresable; sale con `estilo.boton.ancho: 100` y la
   celda **sin `titulo`** —el renderer no dibuja label cuando no hay título, y un botón ya
   cuenta como contenido en el filtro de celdas vacías—. Por eso `categorias()` pasó a tener el
   `titulo` opcional. Salió idéntico a la captura.
2. 🔑 **La foto de la portada puede salir del slot `celda`.** `temporada` es la única de la
   galería que lo hace y es a propósito: su portada lleva **texto negro sobre foto clara** y las
   diez fotos de slot `portada` son ambientes llenos de cosas, donde el título negro no se lee
   por más velo que se le ponga. La de la referencia es un producto quieto sobre fondo claro.
3. 🔑 **`fondo` y `fondoContenido` iguales otra vez, y en dos de seis.** R-013 y R-015 son una
   sola pieza oscura de borde a borde; con dos oscuros distintos se ve el recuadro de la tarjeta
   recortado, que solo lo tiene nuestro render. Ya había pasado con `brasas` y es la contracara
   del truco de las bandas de `vuelta-al-cole`, donde se separan **a propósito** para dibujar el
   encabezado y el pie negros.

## Lo que cambió después de mirar el render al lado de la captura

Cuatro cosas, todas de la primera comparación:

- `cyber-marmol` — la tarjeta recortada (arriba) y una portada de 300px con media banda de
  mármol vacía debajo del subtítulo. ⚠️ **El alto de un `hero` se mide contra el CONTENIDO, no
  contra la captura**: la referencia llena ese alto con una segunda columna que no tenemos.
- `temporada` — el título negro no se leía sobre la vidriera, y la bota de la portada se
  repetía en la fila de categorías. Dos fotos cambiadas y el velo blanco de 30 a 50.
- `cyber-tipografico` — el póster de la referencia son **dos renglones** y un `titulo` no los
  tiene (el `<h2>` sale por `esc()`, sin `nl()`): el año va en su propio bloque.
- `invitacion` — el segundo CTA de la referencia es *outline* y salía relleno.

## Lo que quedó 🟡 en esta familia (no volver a intentarlo)

- **El contador regresivo** (R-017): un mail no tiene JS y un GIF con la fecha adentro pide un
  servicio que lo sirva. Va como fila de tres celdas con los números quietos.
- **La fila de personas con foto** (R-017): 🔴 **el pack excluye las caras reconocibles a
  propósito** —la plantilla la manda un tercero a su propia lista—, así que nombre y cargo van
  en una fila de texto. No es una limitación del motor: es el criterio del pack.
- **El menú adentro de una banda de color** (R-014, R-015): `caja.fondo` no existe en `menu`.
  🔑 Con R-014 el contador llegó a **3** y pasa el umbral de la regla 5 ⇒ queda esperando que
  Bruno decida si entra al motor.
- **La segunda columna del hero** (R-015: el "40% OFF" al costado del título) y **la letra
  gigante de fondo** (R-011): el `hero` es de una columna y `position` está prohibido.
- **El pie con color propio**: el fondo de página es uno solo y arriba tiene que ser el de la
  captura, así que en `spring-sale` e `invitacion` el cierre de color va **adentro de la
  tarjeta**, igual que en `final-sale` y `mega-oferta`.
- **La foto al costado de una banda de color** (R-015) y **la grilla de 4 por fila** (R-004,
  R-011): siguen en el backlog, sin cambios.
