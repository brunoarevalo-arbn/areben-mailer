# La galería de plantillas

Dónde se acumula todo lo que sabemos sobre **cómo tiene que ser una plantilla de
areben-mailer**. Bruno va pasando mails de referencia tanda por tanda; acá queda lo que se
decidió, para que la sesión siguiente no arranque de cero.

El código vive en `lib/plantillas/presets.ts` (archivo público) y
`lib/plantillas/familias/*.ts` (una por familia).

---

## El ritual de cada tanda

1. Bruno deja las capturas en **`docs/referencias/`** (no las pega en el chat: una imagen
   pegada se ve una vez y se va con el contexto; una en la carpeta se puede volver a abrir
   siempre, también en seis meses).
2. Se escribe **una ficha por imagen** en la sección *Fichas de referencia*, con el formato
   fijo de abajo. Anatomía bloque por bloque, no prosa.
3. Cada patrón de la ficha se marca contra el *Vocabulario*: **✅** el motor lo hace ·
   **🟡** se aproxima con lo que hay · **🔴** falta. Los 🔴 suman +1 a su contador.
4. Todo lo que quedó ✅ o 🟡 **se convierte en preset ese mismo día**.
5. Un 🔴 entra al motor **recién cuando 3 referencias distintas lo pidieron**. Esa es la
   regla que evita un bloque nuevo por captura de pantalla.
6. Cierre: `npx tsc --noEmit` → las auditorías (ver *Verificación*) →
   `probar-render.ts --capturar` → commit con el golden adentro → `vercel --prod --yes`.

**Umbral de partición:** si este archivo pasa los ~40 KB, las fichas se mudan a
`docs/referencias/*.md` y acá quedan las otras tres secciones. No antes: que la sesión
siguiente arranque con **una sola lectura** es el punto de todo esto.

---

## Reglas de una plantilla que entra a la galería

1. **Ninguna marca adentro.** Un preset es una **función de la cuenta**
   (`arma: (ctx) => Armado`): el nombre va al copy, el sitio a los links, y el logo lo pone
   el bloque `encabezado` al renderizar. Guardar cualquiera de las tres cosas en el Json es
   la bienvenida de Zattia firmando como "BDI Accesorios".

2. **Sin sitio cargado, el botón no se dibuja.** Van los helpers `cta()`, `botonSi()` y
   `sinBoton` de `presets.ts`. Un `href=""` que ya salió no se arregla. Lo fija
   `probar-presets.ts`, que renderiza cada preset con y sin tienda.

3. **Se tiene que ver llena sin que nadie suba una foto.** Es la regla que resuelve el
   "se ven pobres". Tres mecanismos, en este orden:
   - **`productos-dinamicos`** — las fotos las pone la tienda sola. Es lo que hace que la
     plantilla se vea completa el primer día y distinta cada mes sin que nadie la abra.
   - **Color + tipografía**: `seccion`, `cupon`, `divisor`, `espaciador`, con el trabajo
     pesado en la **capa `estilos` de documento**, no en overrides bloque por bloque.
   - Si de verdad pide foto: `hero.fondoImagen` + `velo` + `bg`. Sin la foto queda la banda
     de color con el texto legible — el `background-color` de respaldo ya está puesto.
   - ⛔ **Nunca un bloque `imagen` con `url: ""`.** Renderiza el `<img>` igual: es un ícono
     roto en la galería y en la casilla de quien lo recibe. Era el estado de `newsletter`,
     `editorial`, `lanzamiento` y `evento` hasta el 1-ago-2026.

4. **Hay DOS clases de plantilla y el color funciona al revés en cada una.** Partida el
   2-ago-2026, cuando Bruno dijo *"el clon tiene que ser clon, exacto. Luego la gente edita.
   Y NO tiene que ponerse NADA de la marca que lo está eligiendo"*. La galería es un catálogo
   de SaaS: el comerciante elige por la miniatura y **después** edita.

   - **La que clona una referencia** (los 11 de `docs/referencias/parecido.md`) **declara su
     `Tema` COMPLETO** — `base`, `fondo`, `fondoContenido`, `acento`, `link`, `ancho`,
     `fuente` — y clava los hex que hagan falta. 🔴 **Completo o nada**: `combinarTema` es un
     spread plano, así que cualquier campo que falte se cae al tema de la marca y el clon se
     ensucia. Los colores **se miden sobre la captura** con
     `scripts/paleta-referencia.ts`, no se eligen a ojo: "gris claro y dorado" salió `#f59e0b`
     y el dorado real era `#c0a040`.
   - **La que no clona nada** (`tienda`, `ecommerce`, `novedades`, `grilla`, las de ciclo) no
     declara tema y usa `bg: ""`, que toma `pal.seccion` del tema de la marca. **Se tiñe sola
     en cada tienda**, y eso es un valor distinto, no una versión pobre.

   🔴 **En las dos, el `color` del rol `titulo` NO se clava en la capa de documento si el
   mail tiene bandas con foto**: apaga el contraste automático y el título sale oscuro sobre
   la foto oscura. Pasó en tres de los siete clones de catálogo. Se clava en el bloque.

5. **`movil: 2` en toda grilla**, igual que `nuevoBloque`. Entra el doble de producto en la
   misma pantalla del teléfono.

6. **El texto plano tiene que decir algo.** `renderEmailTexto` sale en cada envío y es señal
   de deliverability: una plantilla que es toda `seccion` y `hero` sin un `texto` deja un
   `text/plain` casi vacío.

7. **Un `id` de preset no se cambia nunca.** Es la clave de
   `scripts/fixtures/render-golden.json` y la que usa `usarPreset(id)`.

8. **Cada preset declara su `familia`.** Es lo que agrupa `/plantillas`, que **renderiza
   solo la familia activa**: con 30+ plantillas, dibujar todas en cada visita manda más de
   un megabyte al navegador de un comerciante que abre el panel desde el celular.

---

## Fotos de stock

El pack que hace que la regla 3 se cumpla de verdad. **36 fotos** propias del proyecto
—10 `portada`, 6 `banda`, 12 `celda`, 8 `producto`— que cualquier plantilla puede usar sin
que el comerciante suba nada. Salió el 1-ago-2026, cuando el encuadre pasó a ser "la galería
es un producto": con `productos-dinamicos` + color la plantilla no se ve rota, pero tampoco
da ganas de elegirla.

**`lib/plantillas/fotos.ts` es la ÚNICA fuente de verdad** —lo leen los presets (`foto(clave)`),
el script que sube y la auditoría— y ⛔ **ningún preset escribe una URL a mano**:
`probar-fotos.ts` pone en rojo cualquier URL que no arranque con `BASE_FOTOS`.

- **Viven en Vercel Blob bajo `stock/v1/`**, fuera de `mail/<cuentaId>/` y 🔴 **sin fila en
  `ImagenMail`**. Con fila, el pack se duplicaría por comerciante, aparecería en su
  biblioteca —y **un DELETE rompería las plantillas de todos**— y le inflaría el contador de
  bytes, que existe para medir lo que consume él. Sin fila, borrarlo desde la app es
  directamente inalcanzable: `/api/imagenes/[id]` borra por id de fila.
- 🔑 **`v1` no es versionado semántico: es la promesa de que un archivo publicado nunca se
  pisa.** Esas URLs quedan adentro de mails que ya están en la casilla de otra persona.
  Cambiar una foto es una **clave nueva**, jamás un `allowOverwrite`.
- 🔑 Con `addRandomSuffix: false` el pathname es determinístico ⇒ **re-correr el script
  recupera una foto borrada con la MISMA URL**, y cura hasta los mails ya enviados. Por eso
  el script nunca borra.
- ⚠️ **El token de Blob está en `.env.local`, NO en `.env`** (que es el que usan los demás
  scripts):
  `node --env-file=.env.local --import tsx scripts/subir-fotos-stock.ts`
- **Los topes de peso están medidos, y el script falla ruidoso** si una se pasa — no
  recomprime en silencio. Las bandas van a `q=35` porque **siempre llevan velo**: medido con
  `banda-envios`, a q=50 pesa 111 KB y a q=35, 77 KB, y debajo del velo son indistinguibles.
  El peso no cuesta store: cuesta **una descarga por destinatario**, y quien la manda heredó
  esa foto de la plantilla.
- 🔴 **El criterio de selección es más estricto que la licencia**: sin caras reconocibles y
  sin logos de marca, porque **la plantilla la manda un tercero a su propia lista** y no
  controlamos con qué queda al lado. Quedaron afuera fotos buenas de Nike, Chanel, Prada,
  Gucci y The Ordinary. Y 🔑 **tres se cambiaron después de verlas GRANDES**: en miniatura
  parecían bien (una cara que parecía de espaldas, un recorte que quedaba vacío, un libro con
  el título legible).
- Respaldo local en `docs/fotos-stock/` (1,6 MB), que no viaja al deploy (`.vercelignore`).
  ⛔ Descartado guardarlas en `public/`: una foto queda congelada en el Json al instanciar el
  preset, y atarla a un dominio que varía por marca es garantizar mails rotos a futuro.

### ▶️ Lo que quedó abierto al cerrar la galería (2-ago-2026)

- **28 de las 36 las usa algún preset; 8 no las usa nadie**: `portada-escolar-1`,
  `portada-belleza-1`, `banda-envios`, `banda-gimnasio`, `celda-hogar`, `producto-calzado`,
  `producto-auricular`, `producto-reloj`. No es un error —el pack se armó antes que las
  plantillas y sobra inventario a propósito—, pero el plan prometía que la auditoría lo
  dijera y no lo decía. Desde el 2-ago `probar-fotos.ts` las **lista como aviso**, no como
  falla: con 8 sueltas, un rojo obligaría a usarlas o borrarlas para poder commitear.
- 🔴 **`celda-hogar` está QUEMADA**: la foto es **otra del mismo libro** con el "GOSPELS"
  legible, y su `alt` describe una foto que no es. No es desincronización —las 36 coinciden
  byte a byte con su origen—: el criterio se aplicó al catálogo y no a la imagen. Por eso
  `mega-oferta` la cambió. **Espera que Bruno elija el reemplazo**, que va como **clave
  nueva**.

---

## Vocabulario de diseño

Los patrones que van apareciendo en las referencias, y qué puede hacer el motor con cada uno.
**La última columna es el contador que dispara la regla de 3.**

| patrón | estado | cómo se hace hoy / qué falta | referencias |
|---|---|---|---|
| portada con título grande | ✅ | `hero` sin `imagen`, con `bg` o sin él | 001 · 009 · 013 · 014 · 016 |
| portada con foto de fondo y texto encima | ✅ | `hero.fondoImagen` + `velo` (VML para Outlook ya resuelto) | 002 · 003 · 004 · 005 · 007 · 008 · 011 · 012 · 015 · 017 · 018 · 019 · 020 |
| menú de navegación | ✅ | `menu`. **Lo pide casi toda la tanda y no lo usaba NINGÚN preset**. 🔴 Y hasta el 2-ago salía **pegado a la izquierda**: el `t.align ?? "center"` del renderer era letra muerta —`BASE.cuerpo` ya escribe `align:"left"`—, contra las 15 referencias que lo centran sin una excepción. Va por `alineacion()`, igual que la etiqueta de la fila de categorías | 002 · 003 · 004 · 005 · 006 · 007 · 010 · 011 · 014 · 015 · 016 · 017 · 018 · 019 · 020 · 021 |
| redes con ícono al cierre | ✅ | `redes`. Los 7 íconos desde el 1-ago; **los links los trae la marca**, no el Json | las 21 menos 014 |
| grilla de productos | ✅ | `productos-dinamicos`, `movil: 2`, `porFila: 3` desde el 1-ago | 001 · 002 · 003 · 004 · 005 · 006 · 007 · 008 · 010 · 011 · 012 · 016 · 018 · 019 · 020 · 021 |
| precio de lista tachado | ✅ | sale solo: es el `promotional_price` de TN | 001 · 004 · 008 · 010 · 021 |
| cupón destacado | ✅ | `cupon` (borde punteado, ámbar de la paleta) | 015 · 021 |
| banda de color con título y bajada | ✅ | `seccion` con `bg: ""` | 004 · 006 · 009 · 012 · 018 |
| dos columnas imagen+texto | ✅ | `columnas`, 4 variantes, proporción 40/50/60 | 002 · 003 · 010 · 012 · 017 · 018 |
| fila de 3 o 4 celdas (beneficios · categorías · gente) | ✅ | `columnas` de 2 a 4 celdas desde el 1-ago. La variante `textos` no pide foto | 002 · 004 · 005 · 006 · 007 · 008 · 010 · 011 · 013 · 015 · 017 · 018 · 019 · 020 · 021 |
| imagen a sangre (borde a borde) | ✅ | `imagen.sangre` desde el 1-ago: saltea el `pad()`, que es donde vivía el padding | 001 · 004 · 005 · 008 · 016 · 020 |
| `fondoImagen` en `seccion` | ✅ | desde el 1-ago, por el mismo camino VML del `hero` | 002 · 007 · 012 · 019 |
| video | ✅ | `video` (miniatura + link) | 006 |
| carrito real de la persona | ✅ | `carrito` (lo llena el procesador) | — (son mails de campaña) |
| eyebrow / volanta arriba del título | 🟡 | se aproxima con un `titulo` chico encima, con tamaño y espaciado del panel | 002 · 008 · 013 · 017 |
| cuotas ("12 sin interés") | 🔴 | **no es diseño: es dato**. TN no lo devuelve en el producto, se calcularía a mano | 004 · 005 · 008 · 018 · 019 · 021 |
| "ver online / compartir" arriba de todo | 🔴 | pide hostear una copia del mail. Es plataforma, no un bloque | 010 · 011 · 012 · 013 · 014 · 015 |
| botón propio en cada celda de una fila | ✅ | `botonTexto`/`botonUrl` en `Columna` desde el 2-ago. ⚠️ El contador decía **2** y estaban mal contadas: son **3**, y por eso entró por la regla normal | 015 · 018 · 021 |
| botón "Comprar" en cada tarjeta de la grilla | ✅ | `botonTexto` en `productos`/`productos-dinamicos` desde el 2-ago. **Un texto para toda la grilla**: el destino de cada botón es la ficha de SU producto, que el motor ya sabe. Con botón, la tarjeta deja de ser un ancla entera | 001 · 002 · 006 · 007 · 008 · 010 · 012 · 018 · 019 · 020 · 021 |
| tarjeta de producto centrada | ✅ | `estilo.cuerpo.align` en la grilla, desde el 2-ago: el `text-align` va en el `<td>` y alinea nombre, precio y botón **juntos**. Antes salía por `extra()` en el nombre y nada más | las 11 de arriba, sin una excepción |
| texto de la portada fuera del centro | ✅ | `estilo.caja.align` en `hero` y `seccion` desde el 2-ago. **Una sola perilla para todo el interior**: el `text-align` de la caja cascadea al título, al subtítulo y al botón. Default `center`, así que nada ya publicado se movió | 004 · 015 · 017 · 018 |
| ícono en cada celda de una fila | ✅ | `icono` en `Columna` desde el 2-ago: clave de `lib/email/iconos.ts`, **nunca una URL libre**. Dos PNG por ícono (`public/iconos/<clave>-<claro\|oscuro>.png`, dibujados de lucide por `scripts/dibujar-iconos.ts`) y **el renderer elige cuál según `pal.esOscuro`**: un PNG no se tiñe | 002 · 006 · 008 · 018 · 021 |
| botón al ancho de su celda | ✅ | `estilo.boton.ancho: 100` en el bloque `columnas`, desde el 2-ago. Tres barras parejas y no tres pastillas de distinto largo según el texto | 015 · 018 · 021 |
| botón *outline* (borde fino, sin relleno) | ✅ | `boton.bordeAncho` + `bordeColor`, con el `fondo` del color que hay atrás: el motor **siempre** rellena, así que "sin fondo" se emula. ⚠️ Hasta el 2-ago el `<v:roundrect>` tenía `stroke="f"` cableado y **Outlook lo dibujaba sin borde** — `joyeria` ya estaba en producción con una pastilla blanca sobre blanco | 001 · 007 · 012 |
| color de fondo en el **menú** | ✅ | `caja.fondo` en `menu` desde el 3-ago-2026: **con `fondo` elegido el bloque deja de pasar por `pad()` y dibuja su propio contenedor**, que es el camino de `hero` y `seccion`. Sin `fondo` sale byte por byte como salía —el golden no se movió— y el `margin:12px 0` de siempre pasó a ser `padY ?? 12`. 🔑 **Con banda el aire va ADENTRO** (`padding`): un margen dejaría una franja del fondo de página entre el encabezado y el menú, que es justo lo que esas referencias tienen pegado. Los links se recalculan contra la banda si nadie eligió el color (sobre `#111111`: `#171717` → `#d5d4d4`). ⛔ `align` **no** entró en la caja: la alineación de la barra la gobierna `cuerpo.align` y dos perillas para lo mismo es lo que documenta `SIN_EFECTO`. ▶️ **Falta aplicarlo a los 6 presets**, que es una pasada de parecido con la captura al lado | 003 · 005 · 010 · 014 · 016 · 021 |
| color de fondo en una **fila de celdas** | 🟡 | `columnas` sigue pasando por `pad()`. 🔑 Ya hay una salida que no lo necesita: la barra de color de R-013 es el **botón de la celda al ancho** | 010 |
| banda de color con la foto a un costado | 🔴 | el `seccion` es de una columna y el `columnas`, que tiene dos, no toma color de fondo (fila de arriba). Se aproxima con la banda de color sola | 010 |
| precio más grande que el nombre en la tarjeta | 🔴 | los dos salen del mismo `eTexto.tamano` en `renderCard`. **Pide un rol de estilo nuevo** (`precio`) | las 7 de catálogo |
| grilla de 4 por fila | 🔴 | `PorFila` es `2 \| 3`. ⚠️ **No cuesta una llamada más a TN**: `claveProductos` es `fuente\|categoriaId\|n` y `porFila` no entra en la llave | 004 · 007 · 011 · 021 |
| badge de descuento sobre la foto | 🔴 | ⚠️ `position` está prohibido en un mail: va como fila de tabla, no overlay | 015 · 021 |
| producto único destacado grande | 🔴 | `productos` con 1 item dibuja media grilla. 🟡 `bodega` lo arma **a mano** —`imagen` + `titulo` + `texto` + `boton`, todo centrado— y sale igual que la captura: el bloque sigue faltando, la aproximación no | 002 · 009 |
| barra fina de aviso ("Envío gratis a partir de…") | ✅ | `barra()` de `comun.ts`: un `seccion` sin título con `caja.padY`. Se pudo cuando el `<p>` dejó de arrastrar 16px de margen cableado | 007 · 008 |
| menú lateral adentro de la portada | 🔴 | el `hero` es una columna: el menú al costado es otra tabla | 006 · 019 |
| reseña / testimonio con estrellas | 🔴 | no hay bloque | — |
| contador regresivo | 🔴 | un mail no tiene JS: sería un GIF servido, con fecha adentro | 017 |
| letra gigante de fondo detrás del texto | 🔴 | es superposición: `position` prohibido | 011 |
| grilla de 4 fotos tipo lookbook | 🔴 | | 005 |

---

## Fichas de referencia

Formato fijo, ~10 líneas por imagen:

```
### R-001 · <qué es>   (tanda AAAA-MM-DD)
Archivo: docs/referencias/R-001-<slug>.png
Anatomía: encabezado logo · hero foto + velo · titulo centrado · texto 2 líneas ·
  grilla 2×2 · boton pastilla · seccion beneficios · redes
Tema: fondo #faf7f0, acento #1f1f1f, ancho 600, georgia
Copy: tuteo, frases cortas, un solo CTA
Patrones nuevos: imagen a sangre 🔴 · badge "NEW" 🔴
Sale como: preset `<id>` (familia <familia>)
```

Las fichas de la tanda **2026-08-01 (21 mails)** viven en
**`docs/referencias/tanda-2026-08-01.md`** — salieron de acá el 2-ago-2026, cuando este
archivo pasó su propio umbral de 40 KB. Son 20 KB de detalle referencia por referencia: se
abren **cuando se clona una de esas 21**, y no hacen falta para sumar una plantilla nueva.
Cada tanda que venga estrena su propio `docs/referencias/tanda-AAAA-MM-DD.md`.

🔑 Lo que la tanda enseñó **de conjunto** no se fue con las fichas: está repartido entre el
*Vocabulario* (los contadores) y el *Backlog*, que es donde se lee sin abrir nada más.

---

## Backlog del motor

Ordenado por cuántas referencias lo pidieron. **Nada de acá se implementa hasta llegar a 3.**

| pedidos | qué | nota de diseño |
|---|---|---|
| ✅ 15 | fila de 3–4 columnas | **hecho el 1-ago-2026**: `columnas` pasó a `celdas[]` (2 a 4) con la migración v3→v4 |
| ✅ 16 | grilla de 3 en escritorio | **hecho el 1-ago-2026**: `porFila`, ausente = 2 |
| ✅ 6 | imagen a sangre | **hecho el 1-ago-2026**: `imagen.sangre` saltea el `pad()` |
| ✅ 4 | `fondoImagen` en `seccion` | **hecho el 1-ago-2026**: mismo camino VML del `hero` |
| 6 | cuotas del producto | ⚠️ **no es un bloque**: TN no devuelve el plan de cuotas en `/products`. Sale de la config de pagos de la tienda, o se escribe a mano en el mail |
| 6 | "ver online / compartir" | pide guardar el HTML y servirlo por una URL pública. Es una feature de plataforma, con su propia decisión de privacidad: el mail de otra persona no puede quedar indexado |
| ✅ 3 | botón propio en cada celda | **hecho el 2-ago-2026**: `botonTexto`/`botonUrl` en `Columna`, sin bump de esquema. 🔴 Con botón la celda deja de ser un ancla entera |
| 7 | **precio más grande que el nombre** | las siete referencias de catálogo lo hacen. Pide un rol `precio` en la cascada: hoy nombre y precio comparten `eTexto.tamano`. ⚠️ Un rol nuevo obliga a una entrada de `SIN_EFECTO` por cada tipo de bloque que no lo use, o `probar-panel-estilo` se pone rojo |
| 4 | grilla de 4 por fila | `PorFila` es `2 \| 3`. No agrega llamadas a TN (`porFila` no está en `claveProductos`); sí toca el `GrillaControl` del panel |
| ✅ 4 | texto de la portada fuera del centro | **hecho el 2-ago-2026**: `caja.align` salió de `SIN_EFECTO` en `hero` y `seccion` |
| ✅ 5 | ícono en cada celda | **hecho el 2-ago-2026**: catálogo cerrado en `lib/email/iconos.ts` + dos PNG por ícono |
| ✅ 5 | color de fondo en el **menú** | **hecho el 3-ago-2026** (lo autorizó Bruno cuando el contador llegó a 6): el `case "menu"` dibuja su propio contenedor **solo si alguien eligió `fondo`**; sin fondo sigue en `pad()` y el mail no cambia un byte. 🔑 El aire pasó a `padY ?? 12`, que reproduce el `margin:12px 0` de siempre ⇒ el golden quedó quieto y de yapa el margen se volvió una perilla del panel. ▶️ **Los 6 presets todavía no lo usan** |
| 1 | color de fondo en la **fila de celdas** | `columnas` sigue pasando por `pad()`. 🔑 Ya tiene salida sin esto: el botón de la celda al ancho |
| 2 | badge de descuento sobre la foto | fila de tabla sobre la foto. ⚠️ nada de `position` |
| 2 | producto único destacado | bloque propio, no `productos` con n=1 |
| ✅ 2 | barra fina de aviso | **hecho el 2-ago-2026**: salió gratis con el margen muerto del `seccion`. Es `barra()` en `comun.ts` |
| 2 | menú lateral en la portada | el `hero` es de una columna; esto es una tabla de dos con el menú a un costado |
| 1 | contador regresivo | sin JS: sería un GIF servido con la fecha adentro. Caro y con un servicio atrás |
| 1 | letra gigante de fondo | superposición ⇒ `position` ⇒ prohibido. Se aproxima con una imagen |
| 1 | grilla de 4 fotos | |
| 0 | reseña con estrellas | las estrellas van en texto (`★★★★★`), no en imagen: sobreviven a las imágenes bloqueadas |

---

## Las familias

| familia | qué mail es | de dónde salen las fotos |
|---|---|---|
| `venta` | oferta, liquidación, envío gratis, últimas unidades | `productos-dinamicos` fuente `oferta` |
| `catalogo` | grilla, novedades, más vendidos, por categoría | `productos-dinamicos` |
| `producto` | lanzamiento, restock, el kit | los dos clones sostienen el mail con **una foto grande** del pack; `lanzamiento` no usa ninguna y se llena con la tienda |
| `fechas` | Día de la Madre, Navidad, Hot Sale, Black Friday | color + tipografía; los seis clones suman fotos del pack, y `evento` es la única sin ninguna |
| `ciclo` | bienvenida, post-compra, reactivación, carrito | color + cupón |
| `editorial` | newsletter, detrás de escena, guía de talles, una fecha que se elige con tiempo | los dos clones traen fotos del pack; `newsletter` y `editorial` no usan ninguna |

Las de automation (`auto-*`) **no tienen familia**: no salen en la galería, se crean desde
`/automations` con su disparador. Se distinguen por tener `trigger`.

---

## Verificación

```bash
npx tsc --noEmit                                  # los scripts NO los mira `next build`
node --import tsx scripts/probar-presets.ts       # ningún botón que no lleva a ningún lado
node --import tsx scripts/probar-esquema.ts       # cada preset instancia en la versión actual
node --import tsx scripts/probar-encabezado.ts    # el link de baja sale en el 100% de los renders
node --import tsx scripts/probar-html.ts          # VML, media queries, tracking y peso
node --import tsx scripts/probar-tema.ts          # ningún preset queda ilegible con otro tema
node --import tsx scripts/probar-fotos.ts         # toda imagen sale del pack, y con alt
node --import tsx scripts/probar-fotos.ts --red   # + HEAD a las 36: publicadas y bajo su tope
node --import tsx scripts/probar-render.ts        # golden: nada se movió sin querer
```

Las cinco primeras recorren `presetsPara()`, así que **un preset nuevo entra solo a las
auditorías** sin escribir un test.

⚠️ `probar-fotos` **sin `--red` no toca el store**: dice que las URLs salen del pack, no que
existan. El `--red` es el que atrapa el caso caro —una foto que no está publicada, o que pesa
el triple de lo que creemos— y ese peso se paga **por destinatario**.

🔴 **El golden no veía la grilla hasta el 2-ago-2026**, que es el bloque más grande de la
galería: `productos-dinamicos` no dibuja nada sin productos —y los productos viajan por
`opts`, no adentro del bloque—, así que el botón por tarjeta y la alineación se agregaron y
`probar-render` pasó en verde **sin haberlos dibujado una sola vez**. Hoy inyecta dos
productos de mentira por grilla. Si algún día un bloque nuevo también resuelve su contenido
por `RenderOpts`, hay que alimentarlo ahí o el golden lo mira sin verlo.

📌 **Para mirar un preset con los ojos** están estos dos, y son parte del ritual de cada tanda:

```bash
node --import tsx scripts/mirar-preset.ts catalogo   # deja en .mirar/ la comparación
node --import tsx scripts/mirar-preset.ts audio --hostil   # ¿se filtra algo de la marca?
node --import tsx scripts/paleta-referencia.ts --todas     # los colores REALES de cada captura
```

`mirar-preset` renderiza con productos de mentira, captura con Chrome y **compone la
referencia y nuestro render lado a lado en un solo PNG**, las dos escaladas a la misma altura.
🔑 Que sea UNA imagen es el punto: mirando una y después la otra solo se compara el esqueleto,
y el esqueleto ya coincidía. `--hostil` renderiza con un tema de marca a propósito horrible —
si algo de ese tema aparece, el clon dejó un campo del `Tema` sin declarar.

⚠️ Los dos se corren **parados en el repo** (`tsx` resuelve desde el cwd). La salida va a
`.mirar/`, que está ignorada por git y por Vercel.

Después de deployar: abrir `/plantillas` en las 3 marcas y confirmar que **ninguna miniatura
se ve vacía**; abrir una de cada familia en el editor con el toggle **Celular**; mandarse una
prueba y mirarla en Gmail.
