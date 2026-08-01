// Familia "Fechas": las del calendario comercial.
//
// Son las que se sostienen con color y tipografía, sin depender de una foto: un
// Día de la Madre o un Hot Sale se arma la semana previa y no hay tiempo de
// producir imágenes.

import { type DefPreset, aire, cta, redes } from "../comun";

export const FECHAS: readonly DefPreset[] = [
  {
    id: "evento",
    nombre: "Invitación a un evento",
    descripcion: "Fecha, lugar y confirmación. Para un showroom, un vivo o una preventa.",
    familia: "fechas",
    arma: ({ marca, tienda }) => ({
      estilos: {
        // Título en versales y botón cuadrado: el rasgo de invitación, elegido
        // una vez para todo el mail.
        titulo: { mayusculas: true, espaciado: 1, color: "$acento" },
        boton: { radio: 0 },
      },
      bloques: [
        aire(12),
        { tipo: "titulo", texto: "Estás invitada/o", align: "center" },
        { tipo: "texto", texto: `Hola \${contacto.nombre}, te esperamos en el próximo encuentro de ${marca}.`, align: "center" },
        {
          tipo: "seccion",
          // 🔑 Este hex SÍ se clava, y es la excepción a la regla 4 de
          // PLANTILLAS.md: en una invitación el bloque oscuro **es** el diseño
          // —la tarjeta negra con la fecha— y no un tinte de marca. Con `bg: ""`
          // sería un beige suave y la plantilla dejaría de ser una invitación.
          bg: "#111827",
          titulo: "Sábado 00 · 18 h",
          texto: "Dirección del lugar\nCiudad",
          ...cta("Confirmar que voy", tienda),
        },
        aire(16),
        // ⛔ Acá había un `{ tipo: "imagen", url: "" }` — un `<img src="">`, que
        // sale roto. Lo que hace a esta plantilla es la banda negra de arriba,
        // no una foto que nadie subió.
        { tipo: "texto", texto: "Contá qué va a pasar: qué se muestra, quién va a estar y por qué vale la pena moverse.", align: "left" },
        aire(8),
        redes,
      ],
    }),
  },
];
