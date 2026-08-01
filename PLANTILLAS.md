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

4. **Los tintes salen de la paleta, no de un hex clavado.** Un `seccion` con `bg: ""` toma
   `pal.seccion`, que se deriva del tema de la marca (beige `#faf7f0` en claro, `#1f1f1f` en
   oscuro). Así **la misma plantilla se tiñe sola en cada marca**. Un hex a mano
   (`#fff7ed`, `#f0fdf4`) se ve como una mancha ajena en una marca con tema propio, y peor
   en una con tema oscuro. Se clava un color **solo cuando el color ES la plantilla** —
   la invitación de fondo negro, por ejemplo — y ahí va anotado por qué.

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
| portada con título grande | ✅ | `hero` sin `imagen`, con `bg` o sin él | |
| portada con foto de fondo y texto encima | ✅ | `hero.fondoImagen` + `velo` (VML para Outlook ya resuelto) | |
| grilla de productos 2×2 / 2×3 | ✅ | `productos-dinamicos`, `movil: 2` | |
| cupón destacado | ✅ | `cupon` (borde punteado, ámbar de la paleta) | |
| banda de color con título y bajada | ✅ | `seccion` con `bg: ""` | |
| dos columnas imagen+texto | ✅ | `columnas`, 4 variantes, proporción 40/50/60 | |
| carrito real de la persona | ✅ | `carrito` (lo llena el procesador) | |
| menú de navegación | ✅ | `menu` | |
| redes con ícono | 🟡 | `redes`: solo Instagram, TikTok y WhatsApp tienen PNG; el resto sale en texto | |
| banda de 3 beneficios con ícono | 🟡 | se aproxima con `seccion` + texto separado por `·`, sin íconos ni columnas | |
| video | ✅ | `video` (miniatura + link) | |
| imagen a sangre (borde a borde) | 🔴 | la tarjeta tiene padding fijo en `shell.ts` | |
| fila de 3 o 4 columnas | 🔴 | `columnas` es de 2 y pide `imagen` en cada celda | |
| reseña / testimonio con estrellas | 🔴 | no hay bloque | |
| badge de descuento sobre la foto | 🔴 | ⚠️ `position` está prohibido en un mail: va como fila de tabla, no overlay | |
| producto único destacado grande | 🔴 | `productos` con 1 item dibuja media grilla | |
| `fondoImagen` en `seccion` | 🔴 | solo lo tiene `hero` | |
| grilla de 4 fotos tipo lookbook | 🔴 | | |

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

*(Todavía no hay ninguna: la primera tanda entra cuando Bruno cargue las capturas.)*

---

## Backlog del motor

Ordenado por cuántas referencias lo pidieron. **Nada de acá se implementa hasta llegar a 3.**

| pedidos | qué | nota de diseño |
|---|---|---|
| 0 | fila de 3–4 columnas | `columnas` gana `n: 2\|3\|4` y celdas sin imagen obligatoria. Es la banda de beneficios de casi todo ecommerce |
| 0 | imagen a sangre | el padding vive en `shell.ts`; hace falta que un bloque pueda salirse de la tarjeta |
| 0 | reseña con estrellas | las estrellas van en texto (`★★★★★`), no en imagen: sobreviven a las imágenes bloqueadas |
| 0 | badge de descuento | fila de tabla sobre la foto. ⚠️ nada de `position` |
| 0 | producto único destacado | bloque propio, no `productos` con n=1 |
| 0 | `fondoImagen` en `seccion` | copiar el camino VML del `hero` |
| 0 | grilla de 4 fotos | |

---

## Las familias

| familia | qué mail es | de dónde salen las fotos |
|---|---|---|
| `venta` | oferta, liquidación, envío gratis, últimas unidades | `productos-dinamicos` fuente `oferta` |
| `catalogo` | grilla, novedades, más vendidos, por categoría | `productos-dinamicos` |
| `producto` | lanzamiento, restock, el kit | 1 foto elegida + `columnas` |
| `fechas` | Día de la Madre, Navidad, Hot Sale, Black Friday | color + tipografía, sin foto |
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

Después de deployar: abrir `/plantillas` en las 3 marcas y confirmar que **ninguna miniatura
se ve vacía**; abrir una de cada familia en el editor con el toggle **Celular**; mandarse una
prueba y mirarla en Gmail.
