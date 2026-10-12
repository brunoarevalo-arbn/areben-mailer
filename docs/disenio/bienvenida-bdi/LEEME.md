# Bienvenida de BDI · secuencia de 5 mails (diseño aprobado el 11-oct-2026)

Para los leads de la raspadita de Resorty (trigger `NUEVO_SUSCRIPTOR`). Reemplaza a la
bienvenida de un solo mail (`cms6kpmqg000004l4s4tg6djo`, ACTIVA).

**Por qué:** la bienvenida actual abre 33% pero clickea 0,9%. Sólo el 3,2% de los leads canjea el
cupón (85% de los canjes en 24 h, 94% en 72 h), y al que no compra no le llega nada más. Molde: la
secuencia de bienvenida de BURGA (14 mails reenviados por Bruno; ver `docs/referencias/R-022-*`).

| | cuándo | asunto | qué |
|---|---|---|---|
| 1 | al instante | Ya sos parte del club: tu código está adentro | código en barra arriba, fotos Moods, categorías |
| 2 | día 1 · 11 h | cómo empezó BDI | **texto plano firmado por Bruno**: mellizos, desde 2016, «moda en fundas», +100.000 personas; P.D. invita a responder |
| 3 | día 2 · 11 h | Una funda para cada outfit | la escalera de Resorty (LLEVANDO 2: la segunda −20% · 3: −20% y −30%) |
| 4 | día 4 · 11 h | Lo que cuentan quienes ya compraron | opiniones de Google, cómo es comprar, «¿Y si no te gusta? La cambiás», el local |
| 5 | día 6 · 11 h | Tu código vence mañana | el MISMO código, ⛔ sin descuento extra |

Reglas de la serie: **se corta si compra** · **grupo de control 10%** · fuera del bloque `cupon`
nada nombra el % (el premio varía: 10 o 15) · ⛔ no se usa el nombre (0% de los leads lo tiene).

Decisiones de Bruno que no salen del diseño:
- La funda **siempre le entra** (eligen su modelo): el riesgo es que **no le guste** ⇒ ⛔ nunca «si no te queda».
- Fotos: las de ambiente de Moods (colección 2) son de IA y **se usan**, mezcladas: ninguna se repite.
- Mail 2: el código **solo en su renglón**, para copiarlo (pedido de Darío), y el link a la tienda abajo.
- Las respuestas al 2 van a brunoarevalo@arebensrl.com. Antes de prender, ver cuántas respuestas
  junta el 2/4 del carrito («¿son para tu teléfono?»).

Archivos: `mail-N.html` (HTML con los `${tienda.…}` sin resolver), `mail-2.txt`, `captura-N.png`
y `generar.py` (el que los arma). Vitrina: https://claude.ai/artifact/N4yM4V2aAVDnt3HuAb8HCS

## Lo que falta construir

**Para que exista la secuencia (sin esto no sale):**
1. `MAX_POR_TRIGGER.NUEVO_SUSCRIPTOR` 1 → 5 y su escalera en `ESPERAS_SIGUIENTES` (`lib/automations.ts`),
   con el `triggerData` (el código) viajando a los 5 runs.
2. **Hora fija**: «día N a las 11:00 de Argentina» (`lib/fechas.ts`), no N horas desde el alta.
3. **Corte si compró**: antes de cada envío, ¿canjeó el cupón (`lib/canjes.ts`) o hay una orden
   pagada de ese mail desde el alta? ⇒ `SALTADO`. Hoy sólo existe para el carrito.
4. **Grupo de control 10%** (reusar el del carrito v2) y su medición.
5. **Mail que no sale**: el 5 sin código ⇒ `SALTADO`; el 3 después del 31/10 (o un bloque
   `escalera` que lea Resorty al enviar y se caiga si venció).
6. Tag de vencimiento `${cupon.vence}` («18/10») y `${cupon.venceLargo}` («el domingo 18/10»).
7. Renderer `personal` (`render.ts` ~2066): el código en su **propio renglón**, no adentro de la frase.

**Piezas de diseño (se pueden aproximar con los bloques de hoy y afinar después):**
- bloque `cupon` variante **barra** (1, 3, 4) y **grande sobre negro** (5)
- **dos fotos lado a lado**, bien alineadas con los márgenes del texto (en la propuesta se ven desparejas)
- tabla de categorías 2×3 con miniatura · escalones con número gigante y «LLEVANDO» chico ·
  pasos numerados · título con dos tipografías · baldosa para recortes sobre blanco · pie de marca compartido

**Fuera del motor (manos de Bruno):** dos opiniones de Google más (hoy hay 2 textuales: Tiara B. y
Thiago A.) · la foto del local sin el texto metido en la imagen · el horario del local como dato de la tienda.
