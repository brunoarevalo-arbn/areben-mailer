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

## Vocabulario de diseño

Los patrones que van apareciendo en las referencias, y qué puede hacer el motor con cada uno.
**La última columna es el contador que dispara la regla de 3.**

| patrón | estado | cómo se hace hoy / qué falta | referencias |
|---|---|---|---|
| portada con título grande | ✅ | `hero` sin `imagen`, con `bg` o sin él | 001 · 009 · 013 · 014 · 016 |
| portada con foto de fondo y texto encima | ✅ | `hero.fondoImagen` + `velo` (VML para Outlook ya resuelto) | 002 · 003 · 004 · 005 · 007 · 008 · 011 · 012 · 015 · 017 · 018 · 019 · 020 |
| menú de navegación | ✅ | `menu`. **Lo pide casi toda la tanda y no lo usaba NINGÚN preset** | 002 · 003 · 004 · 005 · 006 · 007 · 010 · 011 · 014 · 015 · 017 · 018 · 019 · 020 · 021 |
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
| color de fondo en el menú o en una fila de celdas | 🔴 **llegó a 3** | `caja.fondo` lo dibujan solo `hero`, `seccion` y `cupon`, que son los tres bloques que arman su propio contenedor; el resto pasa por `pad()`, que es margen lateral y visibilidad y nada más (`propsCaja` en `estilos.ts`). ⚠️ **R-014 lo pide para el MENÚ** (va adentro de la banda negra del encabezado) y con eso el contador llega al umbral de la regla 5 — decisión de Bruno, no se implementó en esta tanda. 🔑 Para la **fila de celdas** ya hay una salida que no lo necesita: la barra de color de R-013 es el **botón de la celda al ancho** | 010 · 014 · 021 |
| banda de color con la foto a un costado | 🔴 | el `seccion` es de una columna y el `columnas`, que tiene dos, no toma color de fondo (fila de arriba). Se aproxima con la banda de color sola | 010 |
| precio más grande que el nombre en la tarjeta | 🔴 | los dos salen del mismo `eTexto.tamano` en `renderCard`. **Pide un rol de estilo nuevo** (`precio`) | las 7 de catálogo |
| grilla de 4 por fila | 🔴 | `PorFila` es `2 \| 3`. ⚠️ **No cuesta una llamada más a TN**: `claveProductos` es `fuente\|categoriaId\|n` y `porFila` no entra en la llave | 004 · 007 · 011 · 021 |
| badge de descuento sobre la foto | 🔴 | ⚠️ `position` está prohibido en un mail: va como fila de tabla, no overlay | 015 · 021 |
| producto único destacado grande | 🔴 | `productos` con 1 item dibuja media grilla | 002 · 009 |
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

### Tanda 2026-08-01 — 21 mails

Salieron todas de galerías de plantillas (Tiendanube, Perfit, Unlayer): no son mails que una
marca mandó, son **el catálogo contra el que nos comparan**. Por eso pesa tanto lo que se
repite y casi nada lo que hace una sola.

Lo que enseñó la tanda entera, antes de las fichas de a una:

- 🔑 **Tres bloques que el motor ya tenía no los usaba ningún preset** — `menu` (15
  referencias lo llevan), `columnas` (6) y `video` (1). El "se ven pobres" no era solo la
  grilla vacía: era la galería usando 15 de los 18 bloques.
- 🔑 **Y un cuarto que estaba en 12 presets sin dibujar nunca nada: `redes`.** El helper de
  `comun.ts` lo pone con los links vacíos —Tiendanube no devuelve las redes de una tienda—
  y el renderer, con razón, no dibuja un link vacío. O sea que 20 de las 21 referencias
  cierran con una fila de iconos y **la galería entera terminaba en un bloque invisible**.
  Se resolvió por donde correspondía: las redes son de la MARCA (`/remitentes`), y el bloque
  sin links propios las resuelve al renderizar, igual que el logo. Las 12 plantillas que ya
  existían se encienden solas.
- 🔑 **La grilla de tres es el estándar de la industria**, no una preferencia: 16 de 21 la
  usan y el motor dibujaba siempre dos.
- 🔑 **La fila de 3–4 celdas aparece en 15 de 21** con tres disfraces distintos —beneficios
  con ícono, categorías con foto, gente con nombre y cargo— y era el mismo bloque las tres
  veces.
- 🔑 **Solo una (013) no lleva una sola foto de stock**, y es la que un comerciante puede
  copiar sin sesión de fotos. Es la que define la familia `fechas`.

---

### R-001 · "Hot Deal" hasta 50% OFF   (tanda 2026-08-01)
Archivo: `docs/referencias/R-001-hot-deal-brasas.png`
Anatomía: encabezado texto sobre foto · divisor claro · titulo póster · subtítulo ·
  texto · boton outline · texto "mirá los productos 👇" · grilla 3 con tachado y botón por
  producto · divisor · redes 4 · pie con teléfono, mail y domicilio
Tema: negro con foto de brasas a sangre en TODO el mail, tipografía de palo seco, blanco
Copy: promesa arriba, urgencia en el subtítulo, un solo CTA antes de la grilla
Patrones nuevos: foto de fondo del mail entero 🔴 (queda en el 🟡 del `hero` a sangre)
Sale como: preset **`brasas`** (familia venta), el clon fiel, y también `hot-sale` sin la foto.
  🟡 Lo único que no es expresable es la foto de fondo del MAIL ENTERO (el fondo de página es un
  color del tema); queda en la portada, con una **textura** oscura y no un producto.
  ⚠️ El botón *outline* **sí** es expresable y esta ficha decía lo contrario: entra por
  `boton.bordeAncho` + `bordeColor`, con el `fondo` del color de atrás (el motor siempre
  rellena). Desde el 2-ago el `<v:roundrect>` también lo dibuja

### R-002 · Morelia, marroquinería   (tanda 2026-08-01)
Archivo: `docs/referencias/R-002-morelia-cuero.png`
Anatomía: encabezado · menu 5 · hero foto + velo + link · titulo "Los más elegidos" ·
  grilla 3 con botón · **fila de 5 categorías** foto + label · columnas imagen-texto (el
  producto del mes) · **banda con foto de fondo** y misión · **3 beneficios con ícono** ·
  pie oscuro con redes y contacto
Tema: marrones y crema, serifa en los títulos, mucho aire
Copy: la marca habla de sí misma en el medio; el producto va arriba
Patrones nuevos: fila de 5 celdas · `fondoImagen` en `seccion`
Sale como: preset **`marroquineria`** (familia catalogo), el clon fiel — y es la que le dio la
  anatomía a `tienda`. 🟡 La fila de 5 categorías va con 4: es el tope del bloque

### R-003 · Morelia Bodas   (tanda 2026-08-01)
Archivo: `docs/referencias/R-003-morelia-bodas.png`
Anatomía: encabezado con logo manuscrito · menu 5 · hero foto + velo · columnas
  imagen-texto · titulo · grilla 3 **sin precio** · texto centrado con la dirección ·
  pie rosa con redes
Tema: rosa empolvado, serifa, todo centrado
Copy: emocional, sin precios: el mail no vende, invita a entrar
Patrones nuevos: grilla sin precio (es `productos` con el precio vacío, no un bloque)
Sale como: preset `lookbook` (familia editorial)

### R-004 · Uyuni, invierno (portugués)   (tanda 2026-08-01)
Archivo: `docs/referencias/R-004-uyuni-invierno.png`
Anatomía: menu 6 · hero foto a sangre con el texto abajo a la izquierda · seccion título ·
  grilla **4** con tachado y cuotas · seccion texto + link · 2 fotos con label · texto de
  Instagram · redes en fila de 6 · contacto
Tema: todo enmarcado con líneas negras finas, serifa, beige
Copy: portugués, seco, sustentabilidad como argumento
Patrones nuevos: grilla de 4 · cuotas · imagen a sangre
Sale como: preset `categorias` (familia catalogo) y su clon fiel **`temporada`** (familia
  fechas, no catalogo: es un mail de cambio de estación). 🟡 Seis links de menú con tres · grilla
  de 4 con `porFila: 3`. ⚠️ Su portada es la única de la galería que usa una foto de slot
  `celda`: las diez de slot `portada` son ambientes llenos de cosas y el título NEGRO no se leía
  sobre ninguna

### R-005 · Baires, swimwear   (tanda 2026-08-01)
Archivo: `docs/referencias/R-005-baires-summer.png`
Anatomía: encabezado sobre negro · menu lima · hero foto · titulo lateral + grilla 3 ·
  banda lima con el nombre de la colección repetido · **3 fotos a sangre sin separación** ·
  banda lima "Bottoms. / Tops." · pie negro con menú vertical, redes y contacto
Tema: negro y verde lima, dos colores y nada más
Copy: mínimo, la foto manda
Patrones nuevos: fotos a sangre pegadas · grilla de 4 fotos tipo lookbook
Sale como: preset `lookbook` (familia editorial)

### R-006 · Atlántico, electrónica   (tanda 2026-08-01)
Archivo: `docs/referencias/R-006-atlantico-electro.png`
Anatomía: **menú lateral adentro de la portada** + foto a la derecha · 3 categorías foto +
  label · seccion titulo + texto + boton · grilla 3 con botón · **video** · 3 beneficios
  con ícono · pie negro con redes
Tema: negro, blanco y un azul de CTA
Copy: funcional, cada bloque dice qué es
Patrones nuevos: menú lateral en el hero 🔴
Sale como: preset **`electro`** (familia catalogo), el clon fiel: es la única de las 21 con video.
  🟡 El menú lateral de la portada no es expresable (el `hero` es una columna sola) y va arriba

### R-007 · Lima, joyería   (tanda 2026-08-01)
Archivo: `docs/referencias/R-007-lima-joyas.png`
Anatomía: menu · **barra fina "Envío gratis a partir de $20.000"** · hero foto + boton
  pastilla · grilla **4** · fila de 4 categorías foto + label · banda azul con foto grande
  y 2 tarjetas de producto · banda foto + velo · redes
Tema: azul noche y celeste, sobrio
Copy: nombres propios de colección, poco texto
Patrones nuevos: barra fina de aviso 🔴 · `fondoImagen` en `seccion`
Sale como: preset **`joyeria`** (familia catalogo), el clon fiel: de acá salió la `barra()` fina

### R-008 · idea, "New in"   (tanda 2026-08-01)
Archivo: `docs/referencias/R-008-idea-new-in.png`
Anatomía: barra fina de envío · hero foto con logo + boton pastilla · banner de categoría ·
  2 fotos con el texto encima · titulo "New in!" · grilla 3 con tachado y cuotas ·
  3 beneficios con ícono · pie color con menú y redes
Tema: verde agua y magenta sobre blanco
Copy: volanta ("NEW COLLECTION") arriba de cada título
Patrones nuevos: eyebrow 🟡 · imagen a sangre
Sale como: preset **`new-in`** (familia catalogo), el clon fiel, con la volanta y la barra de envío

### R-009 · Vinos, "Say cheers together"   (tanda 2026-08-01)
Archivo: `docs/referencias/R-009a-vinos-say-cheers.png` + `R-009b-…` (el mismo mail, scrolleado)
Anatomía: encabezado · ornamento · titulo póster · imagen de producto · banda más clara con
  titulo + texto · seccion "The flavors" con foto · columnas textos con boton en cada una ·
  **producto único grande** · pie oscuro con redes y contacto
Tema: marrón oscuro casi negro, condensada en mayúsculas
Copy: en inglés y de catálogo (lorem), pero la anatomía es la de un lanzamiento
Patrones nuevos: producto único destacado 🔴 · ornamento como divisor 🔴
Sale como: no sale sola — refuerza `lanzamiento`, que ya existe

### R-010 · Autopartes, "Final sale"   (tanda 2026-08-01)
Archivo: `docs/referencias/R-010-autopartes-final-sale.png`
Anatomía: "ver online · compartir" · encabezado + menu con `|` · hero ilustración sobre
  color · titulo + texto + boton · seccion gris con **3 columnas** foto redonda + texto ·
  banda color con texto y foto · grilla 3 con tachado · pie negro con redes y contacto
Tema: celeste y negro, ilustración en vez de foto
Copy: promesa de descuento arriba, catálogo abajo
Patrones nuevos: ver online 🔴 · fila de 3 celdas
Sale como: preset **`final-sale`** (familia venta), el clon fiel. 🟡 Su portada es una
  ILUSTRACIÓN y el pack es de fotos; la foto redonda va con `estilo.imagen.radio: 32`, el tope

### R-011 · "Spring Sale"   (tanda 2026-08-01)
Archivo: `docs/referencias/R-011-spring-sale.png`
Anatomía: hero foto + velo con línea decorativa · **letra gigante de fondo** + texto +
  firma · 3 categorías foto + label · banda negra de dos renglones · menu secundario ·
  grilla **4** · boton centrado · texto de cierre · pie negro con redes y legales
Tema: blanco y negro, una línea coral como único acento
Copy: la marca se presenta con firma de una persona
Patrones nuevos: letra gigante de fondo 🔴 · grilla de 4
Sale como: preset **`spring-sale`** (familia fechas), el clon fiel. ⚠️ Esta ficha decía "una
  línea coral" y el hilo, recortado y medido aparte, es **#c03030** (rojo ladrillo). 🟡 La línea
  va debajo de la portada y no adentro · el cierre negro va dentro de la tarjeta

### R-012 · "What's your style?"   (tanda 2026-08-01)
Archivo: `docs/referencias/R-012-whats-your-style.png`
Anatomía: encabezado · foto con el título encima · texto + boton · columnas imagen-texto
  con boton · **banda oscura con foto de fondo** · grilla 2 con precio y botón · banda de
  cierre con boton · redes
Tema: rojo ladrillo de punta a punta, blanco arriba
Copy: pregunta como asunto, tres CTA iguales
Patrones nuevos: `fondoImagen` en `seccion`
Sale como: preset **`tu-estilo`** (familia venta), el clon fiel: **el color ES la plantilla**
  (#d83028 medido, el 28,8% de los píxeles), que es la excepción de la regla 4. ⚠️ Esta ficha
  decía #b23a2f, elegido a ojo de "rojo ladrillo", **y en el lugar equivocado**: con ese rojo
  solo en `acento` salía un mail blanco con botones rojos. En la captura el rojo es el **fondo**
  y los botones son negros

### R-013 · Cyber Monday tipográfico   (tanda 2026-08-01)
Archivo: `docs/referencias/R-013-cyber-monday-tipografico.png`
Anatomía: encabezado · **eyebrow con espaciado** · titulo póster en dos renglones · texto ·
  boton · titulo chico "categorías seleccionadas" · 3 fotos con label pegada abajo · texto
  de urgencia · segundo boton · divisor · contacto y redes chiquitas
Tema: azul noche + azul eléctrico, condensada, **sin una sola foto de stock**
Copy: castellano rioplatense, tres días y una pregunta
Patrones nuevos: label pegada a la foto 🟡 (es la celda de `columnas` con título)
Sale como: preset **`cyber-tipografico`** (familia fechas), el clon fiel, y también `hot-sale`.
  🔑 Medido, el azul noche **#080028 es el 74,4% de los píxeles**: no es el acento, es el mail
  entero (`fondo` y `fondoContenido` iguales). El azul eléctrico #0058d0 son los dos botones y
  las barras de categoría. 🔑 **La etiqueta de cada foto es una barra sólida y se hace con el
  BOTÓN de la celda al ancho, sin `titulo`** — `caja.fondo` no existe en `columnas`

### R-014 · "Back to school"   (tanda 2026-08-01)
Archivo: `docs/referencias/R-014-back-to-school.png`
Anatomía: encabezado negro + menu con `·` · hero blanco con recorte de foto a la derecha ·
  **número gigante 60%** + banda negra · boton · banda negra con el texto de soporte ·
  pie con menú, redes y domicilio
Tema: blanco y negro, manuscrita para el título
Copy: el descuento ES el diseño
Patrones nuevos: número gigante (es un `titulo` con tamaño, no un bloque)
Sale como: preset **`vuelta-al-cole`** (familia fechas), el clon fiel: blanco y negro puro
  —medido, ningún color saturado— con el negro en el **fondo de PÁGINA**, que es lo que dibuja
  las bandas de arriba y abajo. 🟡 El menú va sobre el blanco de la tarjeta: en la captura está
  adentro de la banda negra y `caja.fondo` no existe en `menu`

### R-015 · Cyber Monday sobre mármol   (tanda 2026-08-01)
Archivo: `docs/referencias/R-015-cyber-monday-marmol.png`
Anatomía: encabezado + menu · hero foto con el título a la izquierda y el "40% OFF" a la
  derecha · texto con **el código adentro** · 3 columnas ícono + label + boton · banda gris
  con foto y badges de las tiendas de apps · pie negro con redes y legales
Tema: mármol negro y violeta
Copy: el cupón se dice en el texto, no en un bloque aparte
Patrones nuevos: badge de descuento 🔴 · botón por celda 🔴
Sale como: preset **`cyber-marmol`** (familia fechas), el clon fiel. El violeta medido es
  **#485098**, bastante menos saturado de lo que parece. 🟡 El "40% OFF" gigante va en otra
  columna del hero y baja al subtítulo · el mármol del pack es CLARO y se oscurece con velo 70 ·
  la banda clara va sin la foto al costado. ⛔ Los badges de App Store / Google Play no entran:
  son logos de marca

### R-016 · "Sweet dreams", antifaces   (tanda 2026-08-01)
Archivo: `docs/referencias/R-016-sweet-dreams.png`
Anatomía: encabezado · titulo póster dorado sobre negro con la foto del producto a sangre ·
  banda blanca con titulo + subtítulo tenue + boton · divisor · **grilla 2×2 sin precio** ·
  boton "ver todo" · foto a sangre de ancho completo · pie con menú y redes
Tema: negro y dorado arriba, blanco abajo
Copy: el producto se nombra en cada tarjeta, sin precio
Patrones nuevos: imagen a sangre (dos veces en el mismo mail)
Sale como: preset `lookbook` (familia editorial)

### R-017 · Evento de negocios   (tanda 2026-08-01)
Archivo: `docs/referencias/R-017-evento-business.png`
Anatomía: encabezado + menu 5 · hero foto con el texto a la derecha y boton · **contador
  regresivo** · columnas imagen-texto con boton · titulo "Our speakers" · **3 celdas con
  foto, nombre y cargo** · pie azul con redes y contacto
Tema: azul pizarra y blanco, tipografía de sistema
Copy: dos "Register now" idénticos, uno arriba y otro en el medio
Patrones nuevos: contador regresivo 🔴 · fila de 3 celdas con personas
Sale como: preset **`invitacion`** (familia fechas), el clon fiel. ⚠️ Se llama así porque
  `evento` ya está tomado y un id no se cambia nunca (regla 7). 🟡 El contador regresivo va como
  fila de 3 celdas con los números quietos · **la fila de speakers va SIN foto**: el pack excluye
  las caras reconocibles a propósito, así que nombre y cargo van en una fila de texto

### R-018 · SIMPLE, "New arrivals"   (tanda 2026-08-01)
Archivo: `docs/referencias/R-018-simple-new-arrivals.png`
Anatomía: encabezado en caja + menu con `·` · hero foto con el título encima · **3
  categorías foto + label + boton propio** · seccion titulo + texto · grilla 3 con cuotas y
  botón · boton ancho "ver todos" · columnas imagen-texto · 3 beneficios con ícono ·
  pie con redes y contacto
Tema: gris claro y dorado, todo en mayúsculas
Copy: la marca se explica en el medio, entre las dos grillas
Patrones nuevos: botón por celda 🔴
Sale como: preset **`new-arrivals`** (familia catalogo), el clon fiel: es la referencia que trajo
  el **botón por celda** al motor

### R-019 · CUBO co., audio   (tanda 2026-08-01)
Archivo: `docs/referencias/R-019-cubo-audio.png`
Anatomía: encabezado negro · **menú lateral amarillo adentro de la portada** + foto ·
  3 tarjetas de categoría con foto, título y bajada · titulo "productos destacados" ·
  grilla 3 con cuotas y botón subrayado · boton ancho · **banda con foto de fondo** y
  boton · pie negro con redes
Tema: negro y amarillo, sin serifa
Copy: la categoría se explica en una línea abajo del nombre
Patrones nuevos: menú lateral en el hero 🔴 · `fondoImagen` en `seccion`
Sale como: preset **`audio`** (familia catalogo), el clon fiel. 🔑 Es la única de la familia que
  clava un color (#ffd400 sobre tema oscuro): acá el color ES la plantilla

### R-020 · SIMPLE (portugués)   (tanda 2026-08-01)
Archivo: `docs/referencias/R-020-simple-pt.png`
Anatomía: encabezado dorado + menu negro · **hero foto a sangre sin texto** ·
  3 categorías foto + label · divisor · titulo · grilla 3 con boton por producto ·
  boton ancho · pie negro con titulo "redes sociais" y 4 íconos
Tema: negro y dorado, serifa espaciada en el logo
Copy: portugués, nombres de producto y nada más
Patrones nuevos: portada que es solo una foto a sangre
Sale como: preset **`minimal`** (familia catalogo), el clon fiel: la portada que es solo una foto
  a sangre, sin texto encima

### R-021 · TOLUCA, cámaras   (tanda 2026-08-01)
Archivo: `docs/referencias/R-021-toluca-camaras.png`
Anatomía: encabezado + menu de dos renglones · hero banner con **el cupón adentro** y badge
  de envío · 2 categorías foto + label + boton · divisor · titulo de rubro · grilla **4**
  con tachado, **% de descuento** y botón · fila de 4 badges de descuento · grilla 3 en
  tarjetas con borde · 3 beneficios con ícono · pie verde con contacto y redes
Tema: negro, azul de CTA y verde lima en el pie
Copy: portugués, el número manda en cada bloque
Patrones nuevos: badge de % 🔴 · botón por celda 🔴 · grilla de 4
Sale como: preset **`mega-oferta`** (familia venta), el clon fiel: el cupón arriba y la fila de
  porcentajes. 🟡 El badge de % va como fila abajo, no sobre la foto: `position` está prohibido

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
| **3** | color de fondo en el menú y en la fila de celdas | `caja.fondo` lo dibujan solo `hero`, `seccion` y `cupon`. No es una prop nueva: es hacer que `menu` y `columnas` **dibujen su propio contenedor** en vez de pasar por `pad()`. ⚠️ Toca `propsCaja` y por lo tanto el panel. **Llegó a 3 con R-014 el 2-ago-2026** (el menú adentro de la banda negra) ⇒ pasa el umbral de la regla 5 y **espera que Bruno decida si entra**. 🔑 Lo de la fila de celdas ya tiene salida sin esto: el botón al ancho |
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
| `producto` | lanzamiento, restock, el kit | 1 foto elegida + `columnas` |
| `fechas` | Día de la Madre, Navidad, Hot Sale, Black Friday | color + tipografía; los seis clones suman fotos del pack, y `evento` es la única sin ninguna |
| `ciclo` | bienvenida, post-compra, reactivación, carrito | color + cupón |
| `editorial` | newsletter, detrás de escena, guía de talles | foto opcional con velo |

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
node --import tsx scripts/probar-render.ts        # golden: nada se movió sin querer
```

Las cuatro primeras recorren `presetsPara()`, así que **un preset nuevo entra solo a las
auditorías** sin escribir un test.

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
