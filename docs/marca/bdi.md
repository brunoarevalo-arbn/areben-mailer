# BDI Accesorios — kit de marca para mails

Medido de la tienda (bdiaccesorios.com.ar) el 11-oct-2026. Es la fuente del agente
`disenador-mails`: un mail de BDI se tiene que reconocer como BDI **antes** de leer el logo.

## Lo que se ve en la tienda

- **Color**
  - `#1B1717` casi negro, un poco cálido: la franja del header, los botones, los rótulos.
  - `#FFFFFF`: el fondo de todo el catálogo. Las fundas se fotografían paradas sobre blanco.
  - `#E40044` magenta: el acento de la tienda. Se usa **poco**: el precio con transferencia.
  - Los colores de las fundas (bordó, lila, verde oliva, rosa) los pone **la foto**, no el diseño.
- **Tipografía**
  - Montserrat 400/700 en toda la tienda.
  - Los títulos de colección van en **bold italic** grande y apretado
    («*The girlhood collection is here!*»). Es el rasgo más propio que tiene la marca.
  - Los nombres de producto van en MAYÚSCULAS y sin negrita («MOCCA HEART CASE»), con el
    precio en bold abajo.
- **Botones**: pastilla negra, texto blanco y corto («Comprar»). En el hero, pastilla
  *outline* blanca sobre la foto.
- **Fotos**
  - De estilo de vida: manos con uñas hechas, cuero, cadenas, mesas con frutas, libros.
    Luz natural y contraste alto.
  - Las colecciones tienen nombre: Moods, Girlhood.
- **Barra de arriba**: «3 CUOTAS SIN INTERES - 10% OFF TRANSFERENCIA», en mayúsculas chicas.

## La voz

- Rioplatense, de **vos**, cercana, sin solemnidad. Los mails viejos cierran con «<3» y con ⚡.
- Inglés de moda en los nombres («LAST CALL», «NEW IN», «case»). El cuerpo va en castellano.
- ⛔ **No se inventa urgencia** («quedan pocas»): no lo sabemos, y una urgencia inventada es la
  que después nadie cree.
- ⛔ **Fuera del bloque del cupón ningún texto nombra el descuento**: el cupón se puede borrar
  solo (ver `AGENTS.md`).

## Los datos que no se escriben a mano

`${tienda.envioGratis}` · `${tienda.cuotas}` · `${tienda.plazoCambio}` · `${tienda.plazoDespacho}`
· `${tienda.local}` · `${contacto.primerNombre}` (puede venir **vacío**) · `${cart.url}` ·
`${cart.producto}`.

## La tipografía en un mail

Montserrat **no está instalada** en casi ningún teléfono, y Gmail y Outlook descartan el
`<link>` a Google Fonts. Hay tres caminos, y el diseño tiene que decir cuál toma:

1. **Montserrat con caída**: `font-family: Montserrat, 'Helvetica Neue', Arial, sans-serif`.
   Apple Mail la carga por `@font-face`; Gmail cae a Arial. Se diseña para que **la caída
   también se vea bien**.
2. **El título como imagen** (PNG con `alt` que dice lo mismo): el bold italic de marca se ve
   en todos lados, pero con las imágenes apagadas se lee sólo el `alt`. Va únicamente para el
   título de apertura, nunca para el cuerpo.
3. **Sólo web-safe**: Arial/Helvetica en bold italic ya se acerca bastante.
