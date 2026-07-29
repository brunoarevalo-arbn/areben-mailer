// Inyecta tracking de aperturas (pixel) y clicks (redirect) en el HTML de un envío.

export function inyectarTracking(html: string, envioId: string, appUrl: string): string {
  // 1) Reescribir links <a href="http..."> para pasar por el redirect de clicks.
  //    Se saltean mailto:, anclas y el link de baja (/baja).
  //
  //    ⚠️ `<v:roundrect>` también cuenta. Es el botón que ve Outlook de
  //    escritorio: con solo `<a>` en la regex, TODO click desde Outlook quedaba
  //    sin medir y la métrica bajaba sin explicación — se lee como "el mail
  //    anduvo peor", no como "falta un caso en un regex".
  const conClicks = html.replace(
    /(<(?:a|v:roundrect)\b[^>]*\bhref=")([^"]+)(")/gi,
    (m, pre, url, post) => {
      if (/^(mailto:|#|tel:)/i.test(url) || url.includes("/baja")) return m;
      const tracked = `${appUrl}/api/track/click/${envioId}?u=${encodeURIComponent(url)}`;
      return `${pre}${tracked}${post}`;
    },
  );

  // 2) Pixel de apertura antes de </body>.
  const pixel = `<img src="${appUrl}/api/track/open/${envioId}" width="1" height="1" alt="" style="display:none" />`;
  return conClicks.includes("</body>")
    ? conClicks.replace("</body>", `${pixel}</body>`)
    : conClicks + pixel;
}
