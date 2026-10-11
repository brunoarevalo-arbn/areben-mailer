---
name: generar-mail
description: Generador de mails de BDI, Zattia y Stunned. Arma un mail (campaña o automation) desde un brief corto, con productos y datos reales de la tienda, lo diseña con el agente disenador-mails y lo publica como artifact para revisarlo. Una vez aprobado, lo aplica al mailer. Usar cuando Bruno diga «armá un mail de…», «generá la campaña de…», «necesito un mail para…» o pase un brief.
---

# Generar un mail

El problema que resuelve: **si el mail no lo produce la IA, no lo produce nadie.** El circuito
es: brief → datos reales → diseño → artifact → ajustes → aplicar.

## 1 · El brief (preguntar sólo lo que falte)

| campo | si no lo dicen |
|---|---|
| marca | BDI |
| tipo | campaña (a una lista) o automation (por disparador) |
| para qué | **obligatorio**: lanzamiento de colección, promo, novedades, reactivación… |
| productos | los de la colección o categoría que nombre; si no, `novedades` de TN |
| cupón | ninguno. ⛔ Nunca inventar un código: tiene que existir en TN |
| a quién | la lista habitual de la marca (se decide al aplicar, no al diseñar) |

Si falta el «para qué», preguntá eso solo, en una línea. El resto sale con su default, y lo nombrás al
mostrar el artifact.

## 2 · Los datos reales

- **Productos**: de la API de TN de la cuenta (`lib/tn/products.ts`, por script de sólo lectura con
  `node --env-file=.env --import tsx`): nombre, foto, precio, precio promocional, URL. ⛔ Un producto
  sin stock o sin publicar no entra.
- **Fotos de campaña**: las que dé Bruno, las del banner de la colección en la tienda, o la
  biblioteca de imágenes del mailer. Si no hay, decilo: ⛔ no se usan fotos de stock en un mail de
  marca.
- **Datos de la tienda**: van como `${tienda.…}` (ver `AGENTS.md`). ⛔ Nunca un número escrito a mano.
- **Lo que ya funcionó**: antes de diseñar, mirá en `~/.claude/projects/-Users-brunoarevalo/memory/MEMORY_mailer.md`
  § Campañas qué asuntos y qué piezas rindieron (por ejemplo, el T04 de Girlhood).

## 3 · El diseño

Delegalo al agente **`disenador-mails`** (`.claude/agents/disenador-mails.md`), pasándole el brief
completo y los datos ya resueltos. Él devuelve las propuestas y la `vitrina.html`. Para una campaña
nueva, pedile **2 o 3 asuntos con su preheader** y una sola propuesta de diseño (no tres): se itera
sobre una.

## 4 · El artifact

Publicá la `vitrina.html` con la herramienta Artifact (icono `mail`). En una ronda de ajustes, volvé a
publicar **el mismo archivo** para conservar el link. Bruno comenta y se itera ahí mismo. Al
mostrarlo: el link y dos líneas, como mucho.

## 5 · Aplicar (recién con el «va» de Bruno)

El diseño aprobado se lleva al motor del mailer. Hay dos caminos, en este orden de preferencia:

1. **Con los bloques del motor.** Si todo lo de la propuesta lo dibuja el motor, se arma el Json
   (`ContenidoCampania`, leído con `leerContenido()`) y se crea **en borrador** (campaña) o **en
   PAUSADO** (automation) con un script `scripts/crear-<algo>.ts` que mira sin `--escribir`. Se
   puede editar en el panel y tiene parte `text/plain`.
2. **Enseñándole al motor lo que falta.** La vitrina trae «Lo que el motor tiene que aprender».
   Cada pieza nueva se hace como cualquier cambio del motor (`lib/email/bloques.ts` + `render.ts`
   + su `probar-*.ts` + el golden), y recién después se vuelve al camino 1.

⚠️ El bloque `html` crudo existe, pero **no** es un camino: depende de una perilla por cuenta
(`htmlCrudoHabilitado`), no sale en la parte `text/plain` (que es señal de spam si queda vacía) y
nadie lo puede editar después en el panel. Sirve sólo para una pieza única y urgente, y avisándolo.

🔴 **Lo que escribe en producción lo frena el clasificador**: pasale a Bruno el comando con `!`.
⛔ Nunca se manda ni se prende nada: crear en borrador o PAUSADO es lo más lejos que llega este
skill. Mandar una prueba y prender son manos de Bruno.

## Antes de dar algo por listo

- El mail se dibuja con el renderer real (no sólo el HTML del diseñador) y se mira la captura.
- Corré los `probar-*` que toquen lo que cambiaste (lista en `AGENTS.md`).
- Si el motor cambió: `probar-render.ts` y el golden, `npx tsc --noEmit` y `npm run lint`.
