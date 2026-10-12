# Zattia — kit de marca para mails

Medido de la tienda (zattia.com.ar) el 11-oct-2026: variables CSS del tema, captura de la home y
las páginas de envíos, cambios, preguntas frecuentes y quiénes somos. Es la fuente del agente
`disenador-mails`: un mail de Zattia se tiene que reconocer como Zattia **antes** de leer el logo.
⛔ Stunned es marca aparte: nada de acá se le aplica.

## Lo que se ve en la tienda

- **Color**
  - `#000000` negro puro: es el `--accent-color` del tema y también el de los botones, la barra de
    arriba y los textos. No hay un color de acento propio: la marca es **blanco y negro**.
  - `#FFFFFF`: el fondo de todo (header, catálogo, pie).
  - `#D9D9D9` gris: el fondo de estudio de las fotos de producto.
  - `#FFC1E1` rosa: los títulos y la barra de la «Feria de archivo online». ⚠️ Es de la **campaña**,
    no está en el tema. No usarlo en un mail que dura todo el año hasta que Bruno confirme si es de
    marca.
- **Tipografía**
  - Public Sans 400/700 en toda la tienda (`--heading-font` y `--body-font`).
  - Los títulos de sección van **en MAYÚSCULAS y en peso regular** (`--title-font-weight: 400`):
    «NEW IN», «NOVEDADES». Es lo opuesto al bold italic de BDI, y es lo que distingue las dos
    marcas a simple vista.
  - Los nombres de producto van en MAYÚSCULAS, sin negrita («TOP WREN», «CORSET FRANK»), con el precio
    abajo.
- **Botones**: negros con texto blanco y radio de 4 px (`--border-radius: 4px`). En el hero, pastilla
  blanca con texto negro en negrita («COMPRAR AHORA»).
- **Fotos**
  - De producto: la modelo de cuerpo entero sobre gris liso.
  - De campaña: chicas en la calle (Rosario), luz natural y outfits completos.
  - «Que veas la prenda puesta en una persona real» es una promesa de la marca (Quiénes somos).
- **Barra de arriba**: negra, en mayúsculas: «6 CUOTAS SIN INTERES COMPRAS +$250.000 · ENVIO GRATIS
  +$150.000».
- **Logo**: una «Z» negra con un corazón. El PNG que devuelve TN mide 4506×3940 y pesa 600 KB: para
  un mail, subir a la biblioteca una versión recortada y achicada.

## La voz

- Rioplatense, de **vos**, en **femenino** («¿Lista para encontrar tu próximo outfit favorito?»,
  «Bienvenida a Zattia»).
- «Somos la amiga con buen gusto». Cercana, sin solemnidad, con 🤍 como firma («Bienvenida a
  Zattia. 🤍»).
- Inglés de moda en las secciones («NEW IN», «BEST SELLERS», «baby tees»). El cuerpo va en
  castellano.
- ⛔ **No se inventa urgencia** ni se nombra un descuento fuera del bloque del cupón (ver `AGENTS.md`).

## Los datos del comercio (medidos el 11-oct-2026)

⚠️ **Zattia todavía no tiene `config.tienda` cargado**: hasta que se cargue en `/remitentes`, todo
`${tienda.…}` sale vacío. Lo que dice la tienda hoy:

| tag | valor en la tienda | de dónde |
|---|---|---|
| `${tienda.envioGratis}` | `$150.000` | /envios, barra y carrito |
| `${tienda.plazoDespacho}` | `24 h hábiles` | /envios |
| `${tienda.local}` | `Santa Fe 1435, Rosario` | pie de la tienda |
| `${tienda.plazoCambio}` | `30 días desde la fecha de compra` | /politicas-de-cambio (⚠️ es la política de la web: confirmar que vale igual para el local) |
| `${tienda.cuotas}` | 🔴 **no se carga**: la tienda se contradice | barra «6 cuotas +$250.000» · pie «3 cuotas +$100.000» · fichas «3 cuotas sin interés» sin mínimo |

Además de esos cinco, la tienda dice:

- **Envío en el día en Rosario** si se compra antes de las 12 h (lunes a viernes, excepto
  feriados). No hay tag para esto todavía.
- **Cambios**: sin uso y con etiquetas; en el local sin costo, con el producto y el ticket; a
  distancia por cadetería (Rosario) o correo, con el envío a cargo de la clienta. Se inician por
  WhatsApp o mail. Fallas: envío de ida y vuelta cubierto, con reclamo dentro de las 48 h.
- **Pagos**: efectivo, transferencia (las fichas muestran el precio con transferencia, 10% menos),
  crédito y débito.
- **Contacto**: WhatsApp `543416135024` (pie y botón flotante) · Instagram
  [`@zattia_co`](https://www.instagram.com/zattia_co/) · zattiaco@hotmail.com.

## La tipografía en un mail

Public Sans **no está** en el menú de `FUENTES` ni instalada en los teléfonos. El camino es
`sistema` (Arial/Helvetica): en mayúsculas y en peso regular se parece bastante. La regla de
marca es el **peso**, no la familia: títulos en mayúsculas a 400 con espaciado de 1-2 px, y
rótulos chicos a 700 con espaciado de 2 px.
