"use client";

import type { Bloque, Columna } from "@/lib/email/render";
import { ProductosBlock } from "@/components/ProductosBlock";
import { ProductosDinamicosBlock } from "@/components/editor/ProductosDinamicosBlock";
import { ImagenDrop } from "@/components/editor/ImagenDrop";
import { Rango } from "@/components/editor/Rango";
import { CampoRico } from "@/components/editor/CampoRico";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { Marca } from "@/lib/marca";
import { REDES, redConIcono, type EstiloIconos } from "@/lib/email/redes";
import { estiloCupon } from "@/lib/email/estilos";
import { Desplegable } from "@/components/ui/Desplegable";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { Paleta } from "@/lib/email/tema";
import { textoPlano, type TextoRico } from "@/lib/email/texto-rico";
import { BarraOpciones } from "@/components/ui/BarraOpciones";

/**
 * Un campo con formato, visto como texto pelado.
 *
 * ⚠️ Ya **no** se usa para dibujar ninguno de los ocho campos ricos: esos van
 * por `CampoRico`. Queda para los resúmenes —el renglón que muestra el
 * desplegable de una celda sin abrirla— donde lo que hace falta es texto y no
 * formato.
 */
const plano = (v: TextoRico | undefined): string => (v === undefined ? "" : textoPlano(v));

/**
 * El cartelito del "Link del botón" de una banda con foto (`hero` / `seccion`).
 *
 * 🔑 **La combinación existe pero no se adivina**: con foto y sin texto de
 * botón, el link se lo come la banda entera y la foto pasa a ser clickeable.
 * Sin este renglón la feature está en el motor y no en la cabeza de nadie — es
 * el mismo criterio que el hint de una celda de `columnas`, que avisa que con
 * botón el link de la celda no se usa.
 *
 * Los tres estados son los tres que se pueden mirar en pantalla, y por eso
 * también avisa el caso inútil: una URL sin texto y **sin foto** no dibuja nada,
 * que era el estado en el que el T01 de BDI dejó 350 px de portada muerta.
 */
function linkDeBanda(conFoto: boolean, botonTexto: string | undefined, botonUrl: string | undefined): string | undefined {
  if (botonTexto) return undefined; // Hay botón: el link es del botón, y punto.
  if (!botonUrl) return conFoto ? "Sin texto de botón, este link hace clickeable toda la foto." : undefined;
  return conFoto
    ? "✓ Sin texto de botón: la foto entera es el link."
    : "⚠️ Sin texto de botón y sin foto de fondo no se dibuja ningún link. Poné el texto, o una foto.";
}

/**
 * El formulario de UN bloque: lo que antes vivía adentro de cada fila de la
 * lista y ahora se dibuja en el panel de la derecha.
 *
 * Es solo la pestaña **Contenido**. El estilo (colores, tamaños, espaciados)
 * tiene su propia pestaña y su propio control de tres estados, porque el orden
 * en que se ofrecen las opciones es lo que decide si la gente clava un hex o usa
 * el color de su marca.
 */

/**
 * Lo secundario de un bloque, plegado.
 *
 * ⚠️ Lo que entra acá es lo que **casi nunca se toca** (el link de la cabecera,
 * el "de borde a borde" de una imagen), nunca lo que define cómo se ve el
 * bloque: un control escondido es un control que no existe. Ante la duda, queda
 * afuera.
 */
const MasOpciones = ({ children }: { children: ReactNode }) => (
  <Desplegable titulo="Más opciones" tono="rol">
    {children}
  </Desplegable>
);

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
      {label}
    </label>
  );
}

/**
 * Los cuatro tamaños de una imagen, en % del ancho útil.
 *
 * ⚠️ **`undefined` y no `100`**: la ausencia del campo es "como salió siempre", y
 * es lo que hace que el HTML de un mail ya guardado no se mueva ni un byte.
 */
const TAMANOS_IMAGEN = [
  { clave: "completa", label: "Completa", ancho: undefined },
  { clave: "grande", label: "Grande", ancho: 75 },
  { clave: "mediana", label: "Mediana", ancho: 50 },
  { clave: "chica", label: "Chica", ancho: 33 },
] as const;

const ALINEACIONES_IMAGEN = [
  { clave: "left", label: "Izquierda" },
  { clave: "center", label: "Centro" },
  { clave: "right", label: "Derecha" },
] as const;

function Alineacion({
  value,
  onChange,
}: {
  value: "left" | "center";
  onChange: (v: "left" | "center") => void;
}) {
  return (
    <Select label="Alineación" fullWidth value={value} onChange={(e) => onChange(e.target.value as "left" | "center")}>
      <option value="left">Izquierda</option>
      <option value="center">Centro</option>
    </Select>
  );
}

/**
 * El botón propio de una celda de `columnas`, en las dos variantes de celda.
 *
 * Los dos campos van juntos y no sueltos porque la regla es una sola y hay que
 * poder contarla una vez: **sin texto no se dibuja el botón**, así que vaciarlo
 * es cómo se lo saca. Es la misma convención de `hero`, `seccion` y `cupon`.
 *
 * ⚠️ Y con botón, la celda deja de ser un link entero —el "Link" de arriba no
 * lleva a ningún lado—, porque un `<a>` adentro de otro se rompe distinto en
 * cada cliente de mail. Lo dice el hint para que no se descubra en la casilla.
 */
function BotonDeCelda({
  c,
  onChange,
}: {
  c: Columna;
  onChange: (campos: Partial<Columna>) => void;
}) {
  return (
    <>
      <Input
        fullWidth
        value={c.botonTexto ?? ""}
        placeholder="Texto del botón (opcional)"
        onChange={(e) => onChange({ botonTexto: e.target.value })}
        hint={c.botonTexto ? "Con botón, el click de la celda va por el botón: el link de arriba no se usa." : undefined}
      />
      {!!c.botonTexto && (
        <Input
          fullWidth
          value={c.botonUrl ?? ""}
          placeholder="Link del botón"
          onChange={(e) => onChange({ botonUrl: e.target.value })}
        />
      )}
    </>
  );
}

export function FormBloque({
  bloque: b,
  onChange,
  marca,
  pal,
}: {
  bloque: Bloque;
  /** Parche sobre el bloque. Nunca reemplaza el bloque entero: perdería el `id`. */
  onChange: (patch: Partial<Bloque>) => void;
  /**
   * Solo para los placeholders del encabezado: el nombre y el logo los resuelve
   * el render, no se copian adentro del bloque.
   */
  marca: Marca;
  /**
   * La misma paleta que va a usar el mail. La necesitan los campos ricos: un
   * trozo puede guardar `$acento` y el editor tiene que pintarlo con el color de
   * ESTA marca, igual que el render.
   */
  pal: Paleta;
}) {
  const set = onChange;
  const nombreCuenta = marca.nombreCuenta ?? "";
  const logoTienda = marca.logoCuenta ?? "";

  switch (b.tipo) {
    case "encabezado":
      return (
        <div className="space-y-3">
          {/* "Automático" es la ausencia de `variante`, no un valor: así el
              bloque no decide por una marca que todavía no conoce y una
              plantilla sirve igual en una tienda con logo y en una sin. */}
          <Select
            label="Qué se muestra arriba"
            fullWidth
            value={b.variante ?? "auto"}
            onChange={(e) => {
              const v = e.target.value;
              set({ variante: v === "auto" ? undefined : (v as "texto" | "logo") });
            }}
          >
            <option value="auto">Automático{logoTienda ? " (el logo de tu tienda)" : " (el nombre de la marca)"}</option>
            <option value="texto">Nombre de la marca</option>
            <option value="logo">Otro logo</option>
          </Select>

          {b.variante === "logo" ? (
            <>
              <ImagenDrop value={b.logo ?? ""} onChange={(logo) => set({ logo })} placeholder="URL del logo (https://…)" />
              <Rango label="Ancho del logo" value={b.logoAncho ?? 140} onChange={(logoAncho) => set({ logoAncho })} min={40} max={400} step={10} />
              <p className="text-xs text-subtle">
                {logoTienda ? "Sin cargar ninguno se usa el logo de tu tienda." : "Sin logo cargado se muestra el nombre."}
              </p>
            </>
          ) : (
            <>
              {b.variante === undefined && logoTienda && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoTienda} alt="Logo de tu tienda" className="h-9 w-auto max-w-40 object-contain" />
              )}
              <Input
                label="Texto"
                fullWidth
                value={b.texto ?? ""}
                placeholder={nombreCuenta}
                onChange={(e) => set({ texto: e.target.value })}
                hint="Vacío = el nombre de la marca. Dejalo así para que la plantilla sirva en cualquier tienda."
              />
            </>
          )}

          <MasOpciones>
            <Input
              label="Link al tocarlo"
              fullWidth
              value={b.url ?? ""}
              placeholder={marca.urlCuenta || "https://… (opcional)"}
              onChange={(e) => set({ url: e.target.value })}
            />
            <Check label="Barrita de color debajo" checked={b.linea !== false} onChange={(linea) => set({ linea })} />
            {b.variante !== "logo" && (
              <Check label="En mayúsculas" checked={b.mayusculas !== false} onChange={(mayusculas) => set({ mayusculas })} />
            )}
          </MasOpciones>
        </div>
      );

    case "titulo":
    case "texto": {
      const esTitulo = b.tipo === "titulo";
      return (
        <div className="space-y-3">
          {/* 🔑 `cuerpo` es lo único que separa a los dos tipos, y no es
              cosmético: decide si un `**palabra**` ya guardado se muestra en
              negrita (el mail lo dibuja así) o literal (en un título los
              asteriscos nunca significaron nada). Lo mismo vale para el Enter:
              el cuerpo lo emite como `<br>` y el título lo tira. */}
          <CampoRico
            label={esTitulo ? "Título" : "Texto"}
            value={b.texto}
            onChange={(texto) => set({ texto })}
            pal={pal}
            cuerpo={!esTitulo}
            multilinea={!esTitulo}
            filas={esTitulo ? 2 : 6}
            hint="Podés usar ${contacto.nombre}."
          />
          <Alineacion value={b.align ?? "left"} onChange={(align) => set({ align })} />
        </div>
      );
    }

    case "boton":
      return (
        <div className="space-y-3">
          <Input label="Texto del botón" fullWidth value={b.texto} onChange={(e) => set({ texto: e.target.value })} />
          <Input label="Link" fullWidth value={b.url} placeholder="https://…" onChange={(e) => set({ url: e.target.value })} />
          <Alineacion value={b.align ?? "left"} onChange={(align) => set({ align })} />
          <Check label="Ancho completo" checked={!!b.full} onChange={(full) => set({ full })} />
        </div>
      );

    case "hero": {
      const conFondo = !!b.fondoImagen;
      return (
        <div className="space-y-3">
          <Select
            label="Cómo va la imagen"
            fullWidth
            value={conFondo ? "fondo" : "arriba"}
            onChange={(e) => {
              // 🔴 El velo arranca en 55 SOLO acá, en el momento en que alguien
              // elige poner la foto de fondo. En el documento el default es 0
              // (ver `bloques.ts`): si el default viviera allá, toda portada con
              // foto ya guardada cambiaría de aspecto sola el día del deploy.
              // La opinión va en el editor, el dato en el Json.
              if (e.target.value === "fondo") {
                set({ fondoImagen: b.fondoImagen || b.imagen || "", imagen: "", velo: b.velo ?? 55 });
              } else set({ imagen: b.imagen || b.fondoImagen || "", fondoImagen: undefined });
            }}
          >
            <option value="arriba">Arriba del texto</option>
            <option value="fondo">De fondo, con el texto encima</option>
          </Select>
          {conFondo ? (
            <>
              <ImagenDrop value={b.fondoImagen ?? ""} onChange={(fondoImagen) => set({ fondoImagen })} placeholder="URL de la imagen de fondo" />
              <Rango label="Alto aproximado" value={b.alto ?? 280} onChange={(alto) => set({ alto })} min={120} max={500} step={10} />
              <Rango label="Cuánto se tapa la foto" value={b.velo ?? 0} onChange={(velo) => set({ velo })} min={0} max={90} step={5} />
              <p className="text-xs text-subtle">
                Pinta encima el color de &ldquo;Fondo del texto&rdquo;, para que el título se lea: con un
                fondo oscuro la <b>oscurece</b>, con uno claro la <b>aclara</b>. En 0 el texto va
                directo sobre la foto.
              </p>
              <p className="text-xs text-subtle">
                Outlook no puede medir cuánto ocupa el texto: si es largo, puede quedar apretado.
                Subí el alto si hace falta.
              </p>
            </>
          ) : (
            <ImagenDrop value={b.imagen} onChange={(imagen) => set({ imagen })} placeholder="URL de la imagen (banner)" />
          )}
          <CampoRico label="Título principal" value={b.titulo} onChange={(titulo) => set({ titulo })} pal={pal} cuerpo={false} filas={2} />
          <CampoRico label="Subtítulo" value={b.subtitulo} onChange={(subtitulo) => set({ subtitulo })} pal={pal} cuerpo filas={2} />
          <Input label="Texto del botón" fullWidth value={b.botonTexto} placeholder="Opcional" onChange={(e) => set({ botonTexto: e.target.value })} />
          <Input
            label="Link del botón"
            fullWidth
            value={b.botonUrl}
            placeholder="https://…"
            onChange={(e) => set({ botonUrl: e.target.value })}
            hint={linkDeBanda(!!b.fondoImagen, b.botonTexto, b.botonUrl)}
          />
          <ColorFijo label="Fondo del texto" value={b.bg} onChange={(bg) => set({ bg })} />
        </div>
      );
    }

    case "seccion": {
      const conFoto = !!b.fondoImagen;
      return (
        <div className="space-y-3">
          <CampoRico label="Título de la sección" value={b.titulo} onChange={(titulo) => set({ titulo })} pal={pal} cuerpo={false} filas={2} />
          <CampoRico label="Texto" value={b.texto} onChange={(texto) => set({ texto })} pal={pal} cuerpo multilinea filas={4} />
          <Input label="Texto del botón" fullWidth value={b.botonTexto} placeholder="Opcional" onChange={(e) => set({ botonTexto: e.target.value })} />
          <Input
            label="Link del botón"
            fullWidth
            value={b.botonUrl}
            placeholder="https://…"
            onChange={(e) => set({ botonUrl: e.target.value })}
            hint={linkDeBanda(conFoto, b.botonTexto, b.botonUrl)}
          />
          <Select
            label="Fondo"
            fullWidth
            value={conFoto ? "foto" : "color"}
            onChange={(e) => {
              // El velo arranca en 55 acá y no en el documento, igual que en la
              // portada: la opinión vive en el momento en que alguien ELIGE la
              // foto; en el Json, ausente = como estaba.
              if (e.target.value === "foto") set({ fondoImagen: b.fondoImagen || "", velo: b.velo ?? 55 });
              else set({ fondoImagen: undefined });
            }}
          >
            <option value="color">Un color</option>
            <option value="foto">Una foto, con el texto encima</option>
          </Select>
          {conFoto && (
            <>
              <ImagenDrop value={b.fondoImagen ?? ""} onChange={(fondoImagen) => set({ fondoImagen })} placeholder="URL de la imagen de fondo" />
              <Rango label="Alto aproximado" value={b.alto ?? 220} onChange={(alto) => set({ alto })} min={120} max={500} step={10} />
              <Rango label="Cuánto se tapa la foto" value={b.velo ?? 0} onChange={(velo) => set({ velo })} min={0} max={90} step={5} />
              <p className="text-xs text-subtle">
                Pinta encima el color de abajo, para que el texto se lea: con un color oscuro la{" "}
                <b>oscurece</b>, con uno claro la <b>aclara</b>. En 0 el texto va directo sobre la
                foto. Si la foto no carga —Outlook las bloquea— queda el color solo.
              </p>
            </>
          )}
          <ColorFijo label={conFoto ? "Color de respaldo y del velo" : "Fondo de la sección"} value={b.bg} onChange={(bg) => set({ bg })} />
        </div>
      );
    }

    case "cupon": {
      const variante = b.variante ?? "caja";
      return (
        <div className="space-y-3">
          {/* La variante mueve DOS cosas a la vez, y por eso el `onChange` no es
              un `set` pelado: los tres huecos internos, que los decide el
              renderer, y el paquete de padding/borde/tamaños, que se escribe
              acá en el bloque para que el panel de estilo muestre lo que el mail
              dibuja. Es lo mismo que hace el `hero` con el `velo` un poco más
              arriba. */}
          <Select
            label="Forma"
            fullWidth
            value={variante}
            hint={{
              caja: "Un recuadro con borde cortado. El cupón es lo importante del mail.",
              compacta: "Más baja y sin tanto recuadro, para cuando el cupón acompaña.",
            }[variante]}
            onChange={(e) => {
              const v = e.target.value as "caja" | "compacta";
              set({ variante: v === "caja" ? undefined : v, estilo: estiloCupon(b.estilo, v) });
            }}
          >
            <option value="caja">Recuadro</option>
            <option value="compacta">Compacta</option>
          </Select>
          <Input label="Texto" fullWidth value={b.texto} placeholder="Usá este código en el checkout" onChange={(e) => set({ texto: e.target.value })} />
          <Input label="Código" fullWidth value={b.codigo} placeholder="DESCUENTO10" onChange={(e) => set({ codigo: e.target.value })} />
          <Input label="Texto del botón" fullWidth value={b.botonTexto} placeholder="Opcional" onChange={(e) => set({ botonTexto: e.target.value })} />
          <Input label="Link del botón" fullWidth value={b.botonUrl} placeholder="https://…" onChange={(e) => set({ botonUrl: e.target.value })} />
        </div>
      );
    }

    case "imagen": {
      // El tamaño que está puesto sale de comparar contra lo escrito. Un ancho
      // que no cae en ninguno de los cuatro (el del control fino de abajo) deja
      // los chips sin marcar, que es la verdad.
      const tamano = TAMANOS_IMAGEN.find((t) => t.ancho === b.ancho)?.clave;
      return (
        <div className="space-y-3">
          <ImagenDrop
            value={b.url}
            // 🔴 Elegir otra foto tira el formato y el original: si no, los chips
            // seguirían marcando "Cuadrada" sobre una foto que nadie recortó, y
            // "volver al original" llevaría a la foto ANTERIOR — la de otro
            // bloque, en la casilla de otra persona.
            onChange={(url) => set({ url, formato: undefined, urlOriginal: undefined })}
            formatos
            formato={b.formato}
            urlOriginal={b.urlOriginal}
            onRecorte={(v) => set(v)}
          />
          {/* 🔴 Con la foto a borde-a-borde no hay margen que repartir: el bloque
              saltea el `pad()` y un ancho ahí no significaría nada. En vez de
              dejar una perilla muerta, los controles desaparecen. */}
          {b.sangre !== true && (
            <>
              <BarraOpciones
                label="Tamaño"
                value={tamano ?? ""}
                opciones={TAMANOS_IMAGEN.map((t) => ({ clave: t.clave as string, label: t.label }))}
                // Una sola escritura: el ancho **y** el apagado de "borde a borde".
                // En dos llamadas la segunda parte del mismo bloque que la primera
                // y le pisa el cambio.
                onChange={(clave) =>
                  set({ ancho: TAMANOS_IMAGEN.find((t) => t.clave === clave)?.ancho, sangre: undefined })
                }
              />
              <BarraOpciones
                label="Alineación"
                value={b.align ?? "left"}
                opciones={ALINEACIONES_IMAGEN}
                onChange={(align) => set({ align: align === "left" ? undefined : align })}
              />
              {b.ancho === undefined && (
                <p className="text-xs leading-relaxed text-muted">
                  Con la foto completa la alineación sólo se nota si la imagen es más angosta que
                  el mail: una foto grande ocupa todo el ancho y no queda lugar que repartir.
                </p>
              )}
            </>
          )}
          <Input
            label="Texto alternativo"
            fullWidth
            value={b.alt ?? ""}
            onChange={(e) => set({ alt: e.target.value })}
            hint="Lo que se lee cuando el cliente de mail bloquea las imágenes — que es el caso por defecto en Outlook."
          />
          <MasOpciones>
            {b.sangre !== true && (
              <Rango
                label="Ancho exacto"
                value={b.ancho ?? 100}
                onChange={(ancho) => set({ ancho: ancho >= 100 ? undefined : ancho, sangre: undefined })}
                min={25}
                max={100}
                step={5}
                sufijo="%"
              />
            )}
            <Check
              label="De borde a borde"
              checked={b.sangre === true}
              onChange={(sangre) => set({ sangre: sangre || undefined, ancho: sangre ? undefined : b.ancho })}
            />
            <p className="text-xs leading-relaxed text-muted">
              Sin margen a los costados ni esquinas redondeadas. Es la portada fotográfica que usan
              casi todas las tiendas: la foto pegada a los bordes es lo que hace que el mail no se
              vea como un documento.
            </p>
          </MasOpciones>
        </div>
      );
    }

    case "productos":
      return (
        <ProductosBlock
          items={b.items}
          botonTexto={b.botonTexto}
          movil={b.movil}
          porFila={b.porFila}
          precioOculto={b.precioOculto}
          onChange={(items) => set({ items })}
          onBoton={(botonTexto) => set({ botonTexto })}
          onPrecioOculto={(precioOculto) => set({ precioOculto })}
          onGrilla={(cambio) => set(cambio)}
        />
      );

    case "productos-dinamicos":
      return (
        <ProductosDinamicosBlock
          fuente={b.fuente}
          categoriaId={b.categoriaId}
          n={b.n}
          botonTexto={b.botonTexto}
          precioOculto={b.precioOculto}
          movil={b.movil}
          porFila={b.porFila}
          // `items` no se toca nunca desde acá: el bloque guarda la consulta y
          // los productos los pone quien envía. Si el editor los escribiera, una
          // plantilla compartida saldría con los productos de otra tienda.
          onChange={(cambio) => set(cambio as Partial<Bloque>)}
        />
      );

    case "espaciador":
      return <Rango label="Alto" value={b.alto ?? 24} onChange={(alto) => set({ alto })} min={4} max={120} step={4} />;

    case "carrito":
      return (
        <p className="text-sm leading-relaxed text-muted">
          Se completa solo con lo que la persona dejó en el carrito: foto, nombre, variante,
          cantidad y precio. Movelo para elegir en qué parte del mail aparece.
          <br />
          <br />
          Solo tiene efecto en la automation de <strong>carrito abandonado</strong>. En una
          campaña común no hay carrito, así que el bloque no se dibuja.
        </p>
      );

    case "columnas": {
      const variante = b.variante ?? "imagenes";
      const celdas = b.celdas ?? [];
      // Misma regla que el renderer: con dos celdas, "imagen-texto" es
      // izquierda-derecha; con más, es la primera y la última.
      const esImagen = (i: number) =>
        variante === "imagenes" ||
        (variante === "imagen-texto" && i === 0) ||
        (variante === "texto-imagen" && i === celdas.length - 1);
      // Se reescribe la lista entera y no la celda suelta: `set` hace un merge
      // superficial, así que mutar `celdas[i]` sin devolver el array nuevo le
      // dejaría a React la misma referencia y el panel no se redibujaría.
      const setCelda = (i: number, campos: Partial<Columna>) =>
        set({ celdas: celdas.map((c, j) => (j === i ? { ...c, ...campos } : c)) } as Partial<Bloque>);
      const nombreCelda = (i: number) =>
        celdas.length === 2 ? (i === 0 ? "Izquierda" : "Derecha") : `Celda ${i + 1}`;
      // Cuánto mide cada celda en un celular de 375px si la fila NO apila: los
      // 40px son el margen lateral del mail en pantalla chica (`m-pad`) y los 8
      // el padding del `<td>` con la fila en modo angosto. Es una cuenta y no un
      // número escrito: con 2 da ~160px, con 3 ~104px y con 4 ~76px, y esa
      // diferencia es toda la decisión.
      const anchoEnMovil = Math.round((375 - 40) / Math.max(1, celdas.length)) - 8;
      return (
        <div className="space-y-4">
          <Select
            label="Formato"
            fullWidth
            value={variante}
            onChange={(e) => {
              const v = e.target.value;
              set({ variante: v === "imagenes" ? undefined : (v as "textos" | "imagen-texto" | "texto-imagen") });
            }}
          >
            <option value="imagenes">Solo imágenes</option>
            <option value="textos">Solo textos</option>
            <option value="imagen-texto">Imagen + texto</option>
            <option value="texto-imagen">Texto + imagen</option>
          </Select>
          <Select
            label="Cuántas"
            fullWidth
            value={String(celdas.length)}
            onChange={(e) => {
              const n = Number(e.target.value);
              // Agrandar agrega celdas vacías; achicar recorta del final y **no
              // borra lo que había en las que quedan**. Volver a 3 después de
              // bajar a 2 sí pierde la tercera: guardarla escondida sería un
              // dato invisible que igual viaja en cada guardado.
              const nuevas = Array.from({ length: n }, (_, i) => celdas[i] ?? { imagen: "", url: "" });
              set({ celdas: nuevas } as Partial<Bloque>);
            }}
          >
            <option value="2">2 celdas</option>
            <option value="3">3 celdas</option>
            <option value="4">4 celdas</option>
          </Select>
          {/* La forma del bloque en el celular, al lado de "cuántas" y no en el
              panel de estilo: no es una propiedad de un rol. Mismo criterio que
              `GrillaControl`. */}
          <Select
            label="En el celular"
            fullWidth
            value={b.movil ?? "apilar"}
            // Ausente = apilar, que es como se vio toda fila hasta hoy: se
            // guarda la ausencia y no el string, así el Json no engorda con el
            // valor de fábrica.
            onChange={(e) => set({ movil: e.target.value === "fila" ? "fila" : undefined } as Partial<Bloque>)}
            hint={
              b.movil === "fila"
                ? `Cada celda queda en ~${anchoEnMovil}px en un celular de 375px.${
                    celdas.length >= 4
                      ? " Con cuatro es muy angosto para un título largo."
                      : celdas.length >= 3
                        ? " El título y el texto se achican solos en el celular para que entren."
                        : ""
                  }`
                : "Apiladas, tres celdas ocupan una pantalla entera de teléfono. En fila se leen de un vistazo, pero cada una queda angosta."
            }
          >
            <option value="apilar">Una debajo de otra</option>
            <option value="fila">Todas en fila</option>
          </Select>
          {celdas.length === 2 && (
            <Select
              label="Proporción"
              fullWidth
              value={String(b.proporcion ?? 50)}
              onChange={(e) => {
                const v = e.target.value;
                set({ proporcion: v === "50" ? undefined : (Number(v) as 40 | 60) });
              }}
            >
              <option value="50">Pareja (50 / 50)</option>
              <option value="40">Angosta a la izquierda (40 / 60)</option>
              <option value="60">Angosta a la derecha (60 / 40)</option>
            </Select>
          )}
          {/* Una celda por desplegable: cuatro celdas de cuatro campos son
              dieciséis controles seguidos y encontrar "la de la derecha" era
              contar para abajo. Abierta la primera, como en el panel de estilo.
              El resumen dice qué hay adentro sin abrirla. */}
          {celdas.map((c, i) => (
            <Desplegable
              key={i}
              tono="rol"
              titulo={nombreCelda(i)}
              abiertoDeFabrica={i === 0}
              resumen={plano(c.titulo) || plano(c.texto) || c.url || (c.imagen ? "con imagen" : "vacía")}
            >
              {esImagen(i) ? (
                <>
                  <ImagenDrop
                    value={c.imagen}
                    onChange={(imagen) => setCelda(i, { imagen })}
                    placeholder="URL de la imagen"
                  />
                  <CampoRico
                    value={c.titulo}
                    onChange={(titulo) => setCelda(i, { titulo })}
                    pal={pal}
                    cuerpo={false}
                    filas={1}
                    placeholder="Texto debajo (opcional)"
                  />
                  <Input
                    fullWidth
                    value={c.url}
                    placeholder="Link"
                    onChange={(e) => setCelda(i, { url: e.target.value })}
                  />
                  <BotonDeCelda c={c} onChange={(campos) => setCelda(i, campos)} />
                </>
              ) : (
                <>
                  <CampoRico
                    value={c.titulo}
                    onChange={(titulo) => setCelda(i, { titulo })}
                    pal={pal}
                    cuerpo={false}
                    filas={1}
                    placeholder="Título"
                  />
                  <CampoRico
                    value={c.texto}
                    onChange={(texto) => setCelda(i, { texto })}
                    pal={pal}
                    cuerpo
                    multilinea
                    filas={3}
                    placeholder="Texto"
                  />
                  <Input
                    fullWidth
                    value={c.url}
                    placeholder="Link (opcional)"
                    onChange={(e) => setCelda(i, { url: e.target.value })}
                  />
                  <BotonDeCelda c={c} onChange={(campos) => setCelda(i, campos)} />
                </>
              )}
            </Desplegable>
          ))}
        </div>
      );
    }

    case "video":
      return (
        <div className="space-y-3">
          <ImagenDrop value={b.imagen} onChange={(imagen) => set({ imagen })} placeholder="URL de la miniatura (imagen)" />
          <Input
            label="URL del video"
            fullWidth
            value={b.url}
            placeholder="https://youtube.com/…"
            onChange={(e) => set({ url: e.target.value })}
            hint="Ningún cliente de mail reproduce video adentro: se dibuja la miniatura con el ▶ y el click abre el link."
          />
        </div>
      );

    case "redes":
      return (
        <div className="space-y-2">
          {b.links.map((l, k) => (
            <div key={k} className="flex items-end gap-2">
              {/* Selector y no texto libre: el icono se resuelve por el nombre,
                  así que "IG" o "insta" quedarían sin dibujar. La opción "Otra"
                  deja escribir una red sin icono — sale en texto, como antes. */}
              {redConIcono(l.red) || !l.red ? (
                <Select
                  label={k === 0 ? "Red" : undefined}
                  className="w-32"
                  value={redConIcono(l.red)?.nombre ?? ""}
                  onChange={(e) =>
                    set({ links: b.links.map((x, j) => (j === k ? { ...x, red: e.target.value } : x)) })
                  }
                >
                  <option value="">Elegí una…</option>
                  {REDES.map((r) => (
                    <option key={r.slug} value={r.nombre}>
                      {r.nombre}
                    </option>
                  ))}
                  {/* ⚠️ Sigue existiendo, pero desde que hay icono de "Sitio
                      web" (5-ago-2026) dejó de ser el camino obligado de quien
                      quería poner su propia página: eso salía como la palabra
                      «Otra» en el mail. */}
                  <option value="Otra">Otra (sin icono)</option>
                </Select>
              ) : (
                <Input
                  label={k === 0 ? "Red" : undefined}
                  className="w-32"
                  value={l.red}
                  placeholder="Nombre"
                  hint={k === b.links.length - 1 ? "Sin icono: sale el nombre en texto." : undefined}
                  onChange={(e) => set({ links: b.links.map((x, j) => (j === k ? { ...x, red: e.target.value } : x)) })}
                />
              )}
              <Input
                label={k === 0 ? "URL" : undefined}
                fullWidth
                value={l.url}
                placeholder="https://…"
                onChange={(e) => set({ links: b.links.map((x, j) => (j === k ? { ...x, url: e.target.value } : x)) })}
              />
              <button
                type="button"
                onClick={() => set({ links: b.links.filter((_, j) => j !== k) })}
                aria-label={`Quitar ${l.red || "la red"}`}
                className="mb-2.5 text-danger-foreground transition-opacity hover:opacity-70"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ links: [...b.links, { red: "", url: "" }] })}
            className="rounded-lg border border-border-strong px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-muted"
          >
            + Agregar red
          </button>

          {/* Cómo se dibujan. Ausente = `marca`, o le cambiaría el cierre a todo
              mail ya guardado. En `pleno` el blanco o el negro NO se elige: lo
              decide el renderer según el fondo, igual que los iconos de celda —
              ofrecerlo a mano es ofrecer un icono blanco sobre fondo blanco. */}
          <Select
            label="Iconos"
            className="w-56"
            value={b.iconos ?? "marca"}
            hint={
              {
                marca: "Cada red en su color, sobre un cuadrado.",
                simple: "El símbolo solo, en su color, sin cuadrado.",
                pleno: "En un color solo, elegido según el fondo del mail.",
              }[b.iconos ?? "marca"]
            }
            onChange={(e) => set({ iconos: e.target.value as EstiloIconos })}
          >
            <option value="marca">Con fondo de color</option>
            <option value="simple">Sólo el símbolo</option>
            <option value="pleno">De un solo color</option>
          </Select>
        </div>
      );

    case "menu":
      return (
        <div className="space-y-2">
          {b.links.map((l, k) => (
            <div key={k} className="flex items-end gap-2">
              <Input
                label={k === 0 ? "Texto" : undefined}
                className="w-28"
                value={l.texto}
                placeholder="Inicio"
                onChange={(e) => set({ links: b.links.map((x, j) => (j === k ? { ...x, texto: e.target.value } : x)) })}
              />
              <Input
                label={k === 0 ? "URL" : undefined}
                fullWidth
                value={l.url}
                placeholder="https://…"
                onChange={(e) => set({ links: b.links.map((x, j) => (j === k ? { ...x, url: e.target.value } : x)) })}
              />
              <button
                type="button"
                onClick={() => set({ links: b.links.filter((_, j) => j !== k) })}
                aria-label={`Quitar ${l.texto || "el link"}`}
                className="mb-2.5 text-danger-foreground transition-opacity hover:opacity-70"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ links: [...b.links, { texto: "", url: "" }] })}
            className="rounded-lg border border-border-strong px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-muted"
          >
            + Agregar link
          </button>
        </div>
      );

    case "divisor":
      return <p className="text-sm text-muted">Una línea horizontal para separar secciones. El color y el grosor van acá abajo, en «Caja del bloque».</p>;

    case "html":
      return (
        <div className="space-y-2">
          <Textarea
            label="HTML"
            fullWidth
            rows={10}
            className="font-mono text-xs"
            value={b.contenido}
            onChange={(e) => set({ contenido: e.target.value })}
            hint="Se pega tal cual, sin ningún chequeo. Es una escotilla de administrador: rompe fácil y sale desde tu dominio."
          />
          <p className="text-xs text-subtle">
            Si la cuenta no tiene este bloque habilitado (Remitentes → Bloque HTML avanzado), no
            se dibuja en el envío aunque quede guardado acá.
          </p>
        </div>
      );
  }
}

/**
 * Color propio del bloque, de los que NO pasan por la cascada.
 *
 * Son los dos `bg` que existen desde antes del motor de estilos (`hero` y
 * `seccion`) y que el renderer usa para calcular la legibilidad del texto de
 * adentro. Quedan como color libre a propósito: moverlos a la cascada es cambiar
 * la forma del Json de todo mail guardado, y eso tiene su propia migración.
 */
function ColorFijo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded border border-border-strong bg-background"
        />
        <span className="w-16 text-xs tabular-nums text-muted">{value}</span>
      </span>
    </label>
  );
}
