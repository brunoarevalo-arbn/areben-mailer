# Genera la secuencia de BIENVENIDA de BDI (5 mails, D0→D6), 11-oct-2026.
# Datos: medidos ese día. Cupón y vence = el triggerData del brief. Escalera = /api/widgets de Resorty
# (store 1096065, producto 366779486): 2 → −20% en la 2ª, 3 → −30% en la 3ª, acumula, hasta 2026-10-31.
# Escribe propuesta-<n>.html (tags resueltos) y propuesta-<n>.tags.html (con los ${…} tal cual).
import os, sys, re

OUT = os.path.dirname(os.path.abspath(__file__))

SITE = "https://bdiaccesorios.com.ar"
UTM = "utm_source=mailer&utm_medium=email&utm_campaign=bienvenida-bdi"
def u(path="", content=""):
    return f"{SITE}/{path}?{UTM}" + (f"&utm_content={content}" if content else "")

BAJA = "https://links.bdiaccesorios.com.ar/baja?c=ENSAYO"
ASSETS = "https://links.bdiaccesorios.com.ar"
BLOB = "https://80wkelaj24ephh6z.public.blob.vercel-storage.com/mail/cmrw7cxd70000fowas0vhhssy/"
LOGO = BLOB + "LOGO-NEGRO-MAS-GRANDE-PJFaJD7EM92wbRbySW98fRC0jLAQp3-3kks2AL6c4P4PRUjnXY6VZE8J5n4kL.png"
HERO_D0 = BLOB + "VARIAS-ybjWzJcSHdGxo2DJPkmdP6wFpoaMaU-gmSe0IMwrjGRC2oySzsRVVpmOs9czN.jpg"
HERO_D2 = BLOB + "VARIAS-MEZCLADAS-UWbA8ENjrH630kIBRAqQWIK8xq3Mat-wTCbVrYD4y0hGnqGsx7oqpHG3ifbOW.jpg"
LOCAL = BLOB + "Captura-de-pantalla-2026-08-24-a-la-s-3-16-55-p-m--jP6R36RH4-2B2FrTD5y8b8dxunkc0G1V8HcQb8HK.png"
CHELSEA = BLOB + "CHELSEA-GEM-d39wg6wLUd8zyUzfqTvlKvrMRwefXP-aRHTywIzNNwqlMaDoYLTPU5ESfzE3J.jpg"
P = "https://acdn-us.mitiendanube.com/stores/001/096/065/products/"
def tn(slug, ext="jpg"):
    return f"{P}{slug}-480-0.{ext}"

# El run del ensayo (triggerData del brief).
CODIGO, PREMIO, VENCE_CORTO, VENCE_LARGO = "BDI-2C8XZG", "10% OFF", "18/10", "el domingo 18/10"

TIENDA = {
    "envioGratis": "$44.000",
    "cuotas": "3 cuotas sin interés",
    "plazoCambio": "30 días desde que lo recibís",
    "plazoDespacho": "24 h hábiles",
    "local": "Santa Fe 1671",
}

INK, MAG, MUTE, LINE, SOFT, CREAM = "#1B1717", "#E40044", "#6E6767", "#E6E2E2", "#F5F3F3", "#F4F1EE"
F = "Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif"

HEAD = """<!doctype html>
<html lang="es" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>__TITLE__</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<style>table,td,a,span,div,p{font-family:Arial,Helvetica,sans-serif!important}</style>
<![endif]-->
<!--[if !mso]><!-->
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,700;1,700;1,800&display=swap" rel="stylesheet">
<!--<![endif]-->
<style>
  body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table{border-collapse:collapse}
  img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
  a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important}
  @media only screen and (max-width:600px){
    .m-full{width:100%!important}
    .m-pad{padding-left:20px!important;padding-right:20px!important}
    .m-h1{font-size:32px!important;line-height:34px!important}
    .m-h2{font-size:22px!important;line-height:26px!important}
    .m-lead{font-size:15px!important;line-height:23px!important}
    .m-btn{display:block!important;padding-left:12px!important;padding-right:12px!important}
    .m-code{font-size:17px!important;letter-spacing:3px!important}
    .m-codebig{font-size:30px!important;letter-spacing:4px!important}
    .m-num{font-size:64px!important;line-height:60px!important;width:52px!important}
    .m-quote{font-size:18px!important;line-height:25px!important}
    .m-stack{display:block!important;width:100%!important;padding-left:0!important;padding-right:0!important}
    .m-stackgap{padding-top:16px!important}
    .m-cat{font-size:11px!important;letter-spacing:.5px!important}
    .m-catsub{display:none!important}
    .m-thumb{width:48px!important;height:60px!important}
    .m-tile{padding-left:4px!important;padding-right:4px!important}
    .m-links{font-size:10px!important;letter-spacing:1px!important;line-height:22px!important}
    .m-strip{font-size:9px!important;letter-spacing:1px!important}
  }
</style>
</head>
"""


def preheader(t):
    return ('<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">'
            + t + "&#847;&zwnj;&nbsp;" * 60 + "</div>\n")


def open_body(pre, bg="#ffffff"):
    return (f'<body style="margin:0;padding:0;background:{bg}">\n' + preheader(pre) +
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{bg};width:100%">\n'
            '<tr><td align="center" style="padding:0">\n'
            '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="m-full" style="width:600px;max-width:600px;background:#ffffff">\n')


CLOSE = "</table>\n</td></tr>\n</table>\n</body>\n</html>\n"


def row(inner, pad="0 32px", extra=""):
    return f'<tr><td class="m-pad" style="padding:{pad};{extra}">{inner}</td></tr>\n'


def logo():
    return (f'<tr><td align="center" style="padding:22px 32px 16px">'
            f'<a href="{u()}" style="text-decoration:none"><img src="{LOGO}" width="92" height="36" alt="BDI Accesorios" '
            f'style="display:block;width:92px;height:36px;border:0;font-family:{F};font-size:18px;font-weight:700;color:{INK}"></a></td></tr>\n')


def barra_codigo():
    # 🔑 ES el bloque `cupon` (variante «barra»): si el run no trae código, se borra entera,
    # y por eso es el ÚNICO lugar del mail que nombra el premio.
    return (f'<!-- bloque cupon · variante barra -->\n<tr><td align="center" style="background:{INK};padding:12px 16px;font-family:{F}">'
            f'<span style="font-size:10px;line-height:14px;letter-spacing:2px;text-transform:uppercase;color:#BDB6B6">Tu código de bienvenida &nbsp;·&nbsp; {PREMIO}</span><br>'
            f'<span class="m-code" style="font-size:19px;line-height:28px;font-weight:700;letter-spacing:4px;color:#ffffff">{CODIGO}</span>'
            f'<span style="font-size:10px;line-height:14px;letter-spacing:1px;color:#BDB6B6">&nbsp;&nbsp;hasta el {VENCE_CORTO}</span>'
            '</td></tr>\n<!-- /bloque cupon -->\n')


def kicker(t, color=MUTE):
    return f'<div style="font-family:{F};font-size:11px;line-height:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:{color}">{t}</div>'


def titulo(recto, italica, color=INK, size=40):
    # Dos tipografías en el mismo renglón (Burga): mayúscula recta espaciada + bold italic apretado.
    r = (f'<span style="font-style:normal;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:{int(size*.62)}px">{recto}</span> ' if recto else "")
    return (f'<h1 class="m-h1" style="margin:10px 0 0;font-family:{F};font-size:{size}px;line-height:{size+2}px;font-weight:800;font-style:italic;letter-spacing:-1px;color:{color}">'
            f'{r}{italica}</h1>')


def lead(t, color=INK, mt=14):
    return f'<p class="m-lead" style="margin:{mt}px 0 0;font-family:{F};font-size:16px;line-height:25px;color:{color}">{t}</p>'


def h2(t, color=INK):
    return f'<h2 class="m-h2" style="margin:0;font-family:{F};font-size:24px;line-height:28px;font-weight:800;font-style:italic;letter-spacing:-.5px;color:{color}">{t}</h2>'


def button(text, href, bg=INK, fg="#ffffff", width=300):
    return (f'<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" class="m-full" style="width:auto;margin:0 auto"><tr><td align="center">'
            f'<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{href}" style="height:52px;v-text-anchor:middle;width:{width}px" arcsize="50%" strokecolor="{bg}" fillcolor="{bg}"><w:anchorlock/>'
            f'<center style="color:{fg};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:1px">{text}</center></v:roundrect><![endif]-->'
            f'<!--[if !mso]><!--><a href="{href}" class="m-btn" style="display:inline-block;min-width:220px;padding:17px 44px;border:1px solid {bg};border-radius:999px;background:{bg};color:{fg};font-family:{F};font-size:14px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-align:center;text-decoration:none">{text}</a><!--<![endif]-->'
            '</td></tr></table>')


def g(slug):
    return f"{P}{slug}-640-0.jpg"


# Fotos de ambiente de la Moods Collection (las mismas de las fichas de TN). Bruno (11-oct): usar las
# de IA y mezclarlas: ninguna se repite entre mails.
PERIWINKLE = (g("periwinkle-gem-087d0f45f04c4bda8517895835134723"), "Selfie en el espejo con la Periwinkle Case, cuadrillé celeste")
ROSIE = (g("rosie-matcha-aa034d40673b585f7417895827133620"), "Rosie Case rosa en la mano, con sweater rosa y un matcha")
STRIPE3 = (g("stripe-case-2-42397b9d7c442491a617893963446537"), "Tres Stripe Case paradas en fila, rayas rosa y verde")
DUSK3 = (g("3-cases-ffff134e2ca25b69a717895830679521"), "Bambi, Night y Dusk Case paradas en fila")
STARDUST = (g("stardust-gem-ef1b30e6697c0a197a17895835890117"), "Stardust Case con cartera fucsia y auriculares, outfit desde arriba")
AQUA = (g("aqua-gem-d7b139db888b12329e17895837341091"), "Aqua Case celeste en la mano, con jean y mocasines")
NIGHT = (g("gemini_generated_image_rc5bo2rc5bo2rc5b-592a4145ce2db0a49f17895828328401"), "Night y Mocca Heart Case servidas bajo una campana de plata")
STRIPECUP = (g("stripe-gem-3018b5123ec1f2255817895842372115"), "Stripe Case apoyada en una taza naranja sobre fondo azul")


def foto2(a, b, href, pad="0"):
    # Dos fotos verticales (4:5) lado a lado, a sangre. En el celular quedan de a dos igual: 187 px cada una.
    cel = lambda x, pr: (f'<td width="50%" valign="top" style="width:50%;padding:0 {pr} 0 0"><a href="{href}" style="text-decoration:none">'
                         f'<img src="{x[0]}" width="299" height="374" alt="{x[1]}" style="display:block;width:100%;max-width:299px;height:auto;border:0;background:{SOFT};'
                         f'font-family:{F};font-size:12px;line-height:16px;color:{INK}"></a></td>')
    return (f'<tr><td style="padding:{pad}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
            + cel(a, "2px") + cel(b, "0") + '</tr></table></td></tr>\n')


def foto(src, alt, href, w=600, h=338, pad="0"):
    return (f'<tr><td style="padding:{pad}"><a href="{href}" style="text-decoration:none">'
            f'<img src="{src}" width="{w}" height="{h}" alt="{alt}" style="display:block;width:100%;max-width:{w}px;height:auto;border:0;background:{SOFT};'
            f'font-family:{F};font-size:13px;line-height:18px;color:{INK}"></a></td></tr>\n')


CATS = [
    ("NEW IN", "Lo último que entró", "new-in/", tn("chelsea-case-a7d0f5c64bb50dfd7117857959569971"), "Chelsea Case, funda escocesa azul"),
    ("MOODS COLLECTION", "La colección nueva", "fundas/moods-collection/", tn("bambi-case-9e71c12528e030641117891343561760"), "Bambi Case, funda marrón con manchas"),
    ("FUNDAS", "Para cada iPhone", "fundas/", tn("mocca-heart-case-205331bcee388f589917891337418334"), "Mocca Heart Case, funda marrón con corazones"),
    ("CARGADORES", "Carga rápida", "cargadores/", tn("enchufe-bdi-6b7b20395f2716d9f617695271831599"), "Cargador BDI USB-C blanco"),
    ("SMARTWATCH", "Relojes y mallas", "smartwatch/", tn("active-gris-253beb480c65f57c8417696074226101"), "Smartwatch Active gris"),
    ("OFERTAS", "Precios bajados", "ofertas/", tn("blur-570705150f9101e6e317435323376266", "png"), "Blur Case, funda con corazón"),
]


def categorias():
    # Tabla 2×3 de Burga: miniatura al costado de la etiqueta, filetes finos. La miniatura va en una
    # «baldosa» blanca con borde y radio: si Gmail oscuro invierte el fondo, el recorte blanco se lee
    # como tarjeta y no como un agujero.
    rows = ""
    for i in range(0, 6, 2):
        cells = ""
        for j, (name, sub, path, img, alt) in enumerate(CATS[i:i+2]):
            bl = f"border-left:1px solid {LINE};" if j == 1 else ""
            cells += (f'<td width="50%" valign="middle" style="width:50%;{bl}border-top:1px solid {LINE};padding:12px 12px">'
                      f'<a href="{u(path, "categorias")}" style="text-decoration:none;color:{INK}">'
                      f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
                      f'<td width="56" valign="middle" style="width:56px"><img src="{img}" width="56" height="70" alt="{alt}" class="m-thumb" '
                      f'style="display:block;width:56px;height:70px;border:1px solid {LINE};border-radius:8px;background:#ffffff;font-family:{F};font-size:9px;color:{MUTE}"></td>'
                      f'<td valign="middle" style="padding:0 0 0 12px;font-family:{F}">'
                      f'<div class="m-cat" style="font-size:12px;line-height:16px;font-weight:700;letter-spacing:1px;color:{INK}">{name}</div>'
                      f'<div class="m-catsub" style="margin-top:2px;font-size:12px;line-height:16px;color:{MUTE}">{sub}</div></td>'
                      '</tr></table></a></td>')
        rows += f"<tr>{cells}</tr>"
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid {LINE}">{rows}</table>'


def tres_datos(data):
    cells = ""
    for i, (t, v) in enumerate(data):
        pr = "14px" if i < len(data) - 1 else "0"
        cells += (f'<td width="33%" valign="top" style="width:33.33%;padding:16px {pr} 0 0;font-family:{F}">'
                  f'<div style="font-size:11px;line-height:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:{INK}">{t}</div>'
                  f'<div style="margin-top:3px;font-size:12px;line-height:17px;color:{MUTE}">{v}</div></td>')
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid {INK}"><tr>{cells}</tr></table>'


def pie():
    # 🔑 El PIE FIJO de la serie (Burga): igual en los cinco. Franja con los datos de la tienda,
    # las categorías en texto, Instagram y el pie legal del motor.
    links = " &nbsp;·&nbsp; ".join(
        f'<a href="{u(p, "pie")}" style="color:{INK};text-decoration:none">{t}</a>'
        for t, p in [("NEW IN", "new-in/"), ("FUNDAS", "fundas/"), ("CARGADORES", "cargadores/"), ("SMARTWATCH", "smartwatch/"), ("OFERTAS", "ofertas/")])
    return (
        f'<tr><td style="padding:40px 0 0"></td></tr>\n'
        f'<tr><td align="center" class="m-strip" style="background:{INK};padding:11px 12px;font-family:{F};font-size:10px;line-height:15px;letter-spacing:2px;color:#ffffff;text-transform:uppercase">'
        'Envío gratis desde ${tienda.envioGratis} &nbsp;·&nbsp; ${tienda.cuotas}</td></tr>\n'
        f'<tr><td align="center" class="m-pad m-links" style="padding:20px 32px 6px;font-family:{F};font-size:11px;line-height:20px;font-weight:700;letter-spacing:1.5px">{links}</td></tr>\n'
        f'<tr><td align="center" style="padding:14px 32px 0">'
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>'
        f'<td style="padding:0 6px"><a href="https://www.instagram.com/bdi_accesorios/"><img src="{ASSETS}/redes/instagram-simple.png" width="24" height="24" alt="Instagram" style="display:block;width:24px;height:24px;border:0"></a></td>'
        f'<td style="padding:0 6px"><a href="https://www.tiktok.com/@bdiaccesorios"><img src="{ASSETS}/redes/tiktok-simple.png" width="24" height="24" alt="TikTok" style="display:block;width:24px;height:24px;border:0"></a></td>'
        f'<td style="padding:0 0 0 6px;font-family:{F};font-size:12px;line-height:24px;color:{INK}"><a href="https://www.instagram.com/bdi_accesorios/" style="color:{INK};text-decoration:none">@bdi_accesorios</a></td>'
        '</tr></table></td></tr>\n'
        f'<tr><td align="center" class="m-pad" style="padding:22px 32px 36px;font-family:{F};font-size:11px;line-height:17px;color:{MUTE}">'
        'BDI Accesorios · Areben Comercial - Santa Fe 1671 - Rosario<br>'
        f'<a href="{BAJA}" style="color:{MUTE};text-decoration:underline">Desuscribirme</a></td></tr>\n')


def resolver(s):
    return re.sub(r"\$\{tienda\.(\w+)\}", lambda m: TIENDA[m.group(1)], s)


def write(n, title, html):
    html = HEAD.replace("__TITLE__", title) + html
    open(os.path.join(OUT, f"propuesta-{n}.tags.html"), "w").write(html)
    res = resolver(html)
    open(os.path.join(OUT, f"propuesta-{n}.html"), "w").write(res)
    print(n, len(res.encode()), "bytes")


# ── 1 · D0 · Bienvenida ─────────────────────────────────────────────────────────
m1 = open_body("Tu código ya está adentro: usalo en tu primera compra. Vale 7 días.")
m1 += logo() + barra_codigo()
m1 += row(kicker("BDI Member") + titulo("Ya sos", "parte del club.") +
          lead("Fundas, cargadores y accesorios que no vas a ver en otro lado. Tu código está arriba de todo: "
               "usalo en tu primera compra, en lo que quieras de la tienda."), "30px 32px 26px")
m1 += foto2(PERIWINKLE, ROSIE, u("fundas/moods-collection/", "foto"))
m1 += row(button("VER TODA LA TIENDA", u("", "boton")), "26px 32px 0", "text-align:center")
m1 += row(h2("Elegí por dónde empezar"), "44px 32px 16px")
m1 += row(categorias(), "0 32px")
m1 += row(tres_datos([("Despacho", "en ${tienda.plazoDespacho}"), ("Cambios", "${tienda.plazoCambio}"), ("Local", "${tienda.local}, Rosario")]), "34px 32px 0")
m1 += pie() + CLOSE
write(1, "Ya sos parte del club", m1)

# ── 2 · D1 · Bruno, texto plano ────────────────────────────────────────────────
TXT2 = f"""Hola,

Soy Bruno. Arrancamos BDI Accesorios en 2016, y hoy la llevamos adelante con mi hermano mellizo.

Al principio queríamos algo simple: proteger el celular. Pero con el tiempo nos dimos cuenta de que la funda es lo que más tenemos en la mano durante el día, y que podíamos ser mucho más que solo eso.

Desde entonces hacemos moda en fundas. Cada colección la pensamos y la diseñamos mirando las tendencias de cada temporada, para que tu funda sea una parte más del outfit. La funda dejó de ser algo que comprás una vez: ahora la cambiás como cambiás de look.

Más de 100.000 personas ya nos eligieron, y hoy somos más que una marca: somos una comunidad.

Gracias por sumarte. Tu código de bienvenida sigue vigente hasta el {VENCE_CORTO}:

{CODIGO}

Las colecciones están acá: bdiaccesorios.com.ar

Bruno
Cofundador de BDI

P.D.: si no sabés cuál elegir para tu modelo de celular, respondeme este mail y te ayudo.

—
BDI Accesorios · Areben Comercial - Santa Fe 1671 - Rosario
Desuscribirme: {BAJA}
"""
open(os.path.join(OUT, "propuesta-2.txt"), "w").write(TXT2)
P2 = lambda t: f'<p style="margin:0 0 16px">{t}</p>\n'
m2 = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>cómo empezó BDI</title>\n</head>\n'
      '<body style="margin:0;padding:16px;background:#ffffff">\n'
      '  <div style="max-width:560px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#222222">\n'
      + P2("Hola,")
      + P2("Soy Bruno. Arrancamos BDI Accesorios en 2016, y hoy la llevamos adelante con mi hermano mellizo.")
      + P2("Al principio queríamos algo simple: proteger el celular. Pero con el tiempo nos dimos cuenta de que la funda es lo que más tenemos en la mano durante el día, y que podíamos ser mucho más que solo eso.")
      + P2("Desde entonces hacemos <strong>moda en fundas</strong>. Cada colección la pensamos y la diseñamos mirando las tendencias de cada temporada, para que tu funda sea una parte más del outfit. La funda dejó de ser algo que comprás una vez: ahora la cambiás como cambiás de look.")
      + P2("Más de 100.000 personas ya nos eligieron, y hoy somos más que una marca: somos una comunidad.")
      + f'<!-- bloque cupon · fuente recordar (se cae entero sin código) -->\n'
      + P2(f"Gracias por sumarte. Tu código de bienvenida sigue vigente hasta el {VENCE_CORTO}:")
      + P2(f'<strong style="font-size:16px;letter-spacing:1px">{CODIGO}</strong>')
      + P2(f'Las colecciones están acá: <a href="{u("", "bruno")}" style="color:#1155cc;text-decoration:underline">bdiaccesorios.com.ar</a>')
      + P2("Bruno<br>Cofundador de BDI")
      + P2("P.D.: si no sabés cuál elegir para tu modelo de celular, respondeme este mail y te ayudo.")
      + '  </div>\n  <div style="max-width:560px;margin-top:32px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#777777">\n'
      f'    BDI Accesorios · Areben Comercial - Santa Fe 1671 - Rosario · <a href="{BAJA}" style="color:#777777">Desuscribirme</a>\n  </div>\n</body>\n</html>\n')
open(os.path.join(OUT, "propuesta-2.html"), "w").write(m2)
open(os.path.join(OUT, "propuesta-2.tags.html"), "w").write(m2)
print(2, len(m2.encode()), "bytes")


# ── 3 · D2 · Cuantas más llevás ────────────────────────────────────────────────
def escalon(num, rot, detalle, tag=None, top=True):
    t = (f'<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:{INK};color:#ffffff;font-size:9px;line-height:13px;letter-spacing:1px;font-style:normal;vertical-align:2px">{tag}</span>' if tag else "")
    bt = f"border-top:1px solid {LINE};" if top else ""
    return (f'<tr><td class="m-num" width="76" valign="middle" style="width:76px;{bt}padding:14px 0;font-family:{F};font-size:78px;line-height:72px;font-weight:800;font-style:italic;letter-spacing:-3px;color:{INK}"><div style="font-size:9px;line-height:12px;font-weight:700;font-style:normal;letter-spacing:1.5px;color:{MUTE};margin:0 0 2px">LLEVANDO</div>{num}</td>'
            f'<td valign="middle" style="{bt}padding:14px 0 14px 14px;font-family:{F}">'
            f'<div style="font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:{INK}">{rot}{t}</div>'
            f'<div style="margin-top:4px;font-size:20px;line-height:26px;font-weight:800;font-style:italic;letter-spacing:-.5px;color:{MAG}">{detalle}</div></td></tr>')


esc = (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{SOFT}"><tr><td class="m-pad" style="padding:10px 32px 22px">'
       '<!-- escalera: sale de Resorty en vivo; se borra si venció -->'
       f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
       + escalon("2", "fundas", "la segunda, −20%", top=False)
       + escalon("3", "fundas", "la segunda −20% y la tercera −30%", "MÁS ELEGIDO")
       + '</table>'
       f'<p style="margin:10px 0 0;font-family:{F};font-size:13px;line-height:19px;color:{INK}">Combinás <b>diseños y modelos de iPhone distintos</b>. Se aplica solo en el carrito, y se suma a tu código.</p>'
       '</td></tr></table>')

MOODS = [("BAMBI CASE", "bambi-case/", tn("bambi-case-9e71c12528e030641117891343561760")),
         ("HALFTONE CASE", "halfstone-case/", tn("halfstone-case-62b0b3c35208e349be17891342739132")),
         ("NIGHT CASE", "night-case/", tn("night-case-b0afdc68fd9ccb5fd217891340648961"))]


def tira_productos(items):
    cells = ""
    for n, path, img in items:
        cells += (f'<td width="33%" valign="top" class="m-tile" style="width:33.33%;padding:0 6px">'
                  f'<a href="{u("productos/" + path, "moods")}" style="text-decoration:none;color:{INK}">'
                  f'<img src="{img}" width="166" height="208" alt="{n.title()}, funda de la Moods Collection" style="display:block;width:100%;max-width:166px;height:auto;border:1px solid {LINE};border-radius:10px;background:#ffffff;font-family:{F};font-size:11px;color:{INK}">'
                  f'<div style="margin:10px 0 0;font-family:{F};font-size:11px;line-height:15px;letter-spacing:.5px;color:{INK};text-transform:uppercase">{n}</div></a></td>')
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>{cells}</tr></table>'


m3 = open_body("Combinás diseños y modelos. Se aplica solo en el carrito, hasta el 31/10.")
m3 += logo() + barra_codigo()
m3 += row(kicker("Cuantas más llevás") + titulo("", "Una funda para cada outfit.") +
          lead("Hasta el 31/10 las fundas tienen descuento por cantidad: la segunda y la tercera salen más baratas. "
               "Para cambiarla como cambiás de look, o para regalarle una a una amiga."), "30px 32px 26px")
m3 += foto2(STRIPE3, DUSK3, u("fundas/moods-collection/", "foto"))
m3 += row(esc, "0")
m3 += row(button("ARMAR MI COMBO", u("fundas/", "boton")), "26px 32px 0", "text-align:center")
m3 += row(h2("Lo nuevo: Moods Collection"), "44px 32px 16px")
m3 += row(tira_productos(MOODS), "0 26px")
m3 += pie() + CLOSE
write(3, "Cuantas más llevás", m3)


# ── 4 · D4 · Por qué BDI ──────────────────────────────────────────────────────
def cita(texto, quien, top=True):
    bt = f"border-top:1px solid #3A3333;" if top else ""
    return (f'<tr><td style="{bt}padding:22px 0">'
            f'<div style="font-family:{F};font-size:44px;line-height:30px;font-weight:800;color:{MAG}">“</div>'
            f'<p class="m-quote" style="margin:4px 0 0;font-family:{F};font-size:20px;line-height:28px;font-weight:700;font-style:italic;letter-spacing:-.3px;color:#ffffff">{texto}</p>'
            f'<div style="margin-top:10px;font-family:{F};font-size:10px;line-height:14px;letter-spacing:2px;text-transform:uppercase;color:#BDB6B6">{quien} · opinión en Google</div></td></tr>')


banda4 = (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{INK}"><tr><td class="m-pad" style="padding:8px 32px 10px">'
          f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
          + cita("Me pedí una funda por la página, yo soy de Capital. Excelente cómo llegó y lo más importante: la funda hermosa, el color lo que es.", "Tiara B.", top=False)
          + cita("Envíos súper rápidos, buena comunicación y hermosa experiencia comprando en BDI.", "Thiago A.")
          + '</table></td></tr></table>')


def paso(n, t, v, top=True):
    bt = f"border-top:1px solid {LINE};" if top else ""
    return (f'<tr><td width="44" valign="top" style="width:44px;{bt}padding:16px 0;font-family:{F};font-size:22px;line-height:24px;font-weight:800;font-style:italic;color:{MAG}">{n}</td>'
            f'<td valign="top" style="{bt}padding:16px 0;font-family:{F}">'
            f'<div style="font-size:15px;line-height:21px;font-weight:700;color:{INK}">{t}</div>'
            f'<div style="margin-top:3px;font-size:13px;line-height:19px;color:{MUTE}">{v}</div></td></tr>')


pasos = (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
         + paso("01", "Despachamos en ${tienda.plazoDespacho}", "A todo el país. Envío gratis desde ${tienda.envioGratis}.", top=False)
         + paso("02", "Pagás como te quede cómodo", "${tienda.cuotas} en toda la tienda.")
         + paso("03", "¿Y si no te gusta? La cambiás", "Tenés ${tienda.plazoCambio}. Escribinos y lo resolvemos.")
         + '</table>')

local = (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
         f'<td width="230" valign="middle" class="m-stack" style="width:230px">'
         f'<img src="{LOCAL}" width="230" height="288" alt="El local de BDI en Rosario: una pared entera de fundas" style="display:block;width:100%;max-width:230px;height:auto;border:0;background:{SOFT};font-family:{F};font-size:12px;color:{INK}"></td>'
         f'<td valign="middle" class="m-stack m-stackgap" style="padding:0 0 0 24px;font-family:{F}">'
         + f'<div style="margin-top:0;font-size:22px;line-height:26px;font-weight:800;font-style:italic;letter-spacing:-.5px;color:{INK}">Venite al local.</div>'
         + f'<p style="margin:8px 0 0;font-size:14px;line-height:21px;color:{INK}"><b>${{tienda.local}}</b>, Rosario.<br>Lunes a viernes de 10 a 19 h, sábados de 10 a 13 h. Ves todas las fundas en la mano antes de elegir.</p>'
         '</td></tr></table>')

m4 = open_body("Lo que cuentan quienes ya compraron, y cómo es comprar en BDI.")
m4 += logo() + barra_codigo()
m4 += row(kicker("Por qué BDI") + titulo("", "Lo cuentan quienes ya compraron."), "30px 32px 24px")
m4 += foto2(STARDUST, AQUA, u("fundas/moods-collection/", "foto"))
m4 += f'<tr><td style="padding:0">{banda4}</td></tr>\n'
m4 += row(h2("Cómo es comprar en BDI"), "40px 32px 6px")
m4 += row(pasos, "0 32px")
m4 += row(button("VER LOS MÁS VENDIDOS", u("best-sellers/", "boton")), "26px 32px 0", "text-align:center")
m4 += row(local, "44px 32px 0")
m4 += pie() + CLOSE
write(4, "Por qué BDI", m4)

# ── 5 · D6 · Tu código vence mañana ──────────────────────────────────────────
cupon_grande = (
    '<!-- bloque cupon · variante grande, sobre negro -->'
    f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #ffffff"><tr><td align="center" style="padding:22px 16px;font-family:{F}">'
    f'<div style="font-size:11px;line-height:15px;letter-spacing:2px;text-transform:uppercase;color:#BDB6B6">Tu código · {PREMIO}</div>'
    f'<div class="m-codebig" style="margin-top:8px;font-size:40px;line-height:46px;font-weight:700;letter-spacing:6px;color:#ffffff">{CODIGO}</div>'
    f'<div style="margin-top:8px;font-size:12px;line-height:17px;color:#BDB6B6">Válido hasta {VENCE_LARGO} · un solo uso</div>'
    '</td></tr></table><!-- /bloque cupon -->')
m5 = open_body("Es el mismo código de la bienvenida. Después del domingo deja de andar.")
m5 += logo()
m5 += (f'<tr><td class="m-pad" style="background:{INK};padding:38px 32px 40px">'
       + kicker("Último día", "#BDB6B6")
       + titulo("", "Tu código vence mañana.", "#ffffff", 44)
       + lead("Es el mismo que te dimos el primer día. Se carga en el checkout, en cualquier producto de la tienda.", "#E9E4E4", 14)
       + '<div style="height:26px;line-height:26px">&nbsp;</div>' + cupon_grande
       + '<div style="height:26px;line-height:26px">&nbsp;</div>'
       + f'<div style="text-align:center">{button("USAR MI CÓDIGO", u("", "boton"), "#ffffff", INK)}</div>'
       + '</td></tr>\n')
m5 += foto2(NIGHT, STRIPECUP, u("fundas/moods-collection/", "foto"), "26px 0 0")
m5 += row(lead("¿Te falta decidir el modelo? Respondé este mail y te ayudamos a elegir.", MUTE, 0), "26px 32px 0", "text-align:center")
m5 += pie() + CLOSE
write(5, "Tu código vence mañana", m5)
