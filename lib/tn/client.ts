// Cliente de la API de Tiendanube.
// Docs: https://tiendanube.github.io/api-documentation/
const TOKEN_URL = 'https://www.tiendanube.com/apps/authorize/token';
const API_BASE = 'https://api.tiendanube.com/v1';
const USER_AGENT = 'Areben Mailer (brunoarevalo@arebensrl.com)';

export interface TnToken {
  access_token: string;
  token_type: string;
  scope: string;
  user_id: number; // = store_id
}

/** Canjea el `code` del OAuth por un access token (los tokens de TN no expiran). */
export async function exchangeCode(code: string): Promise<TnToken> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.TN_CLIENT_ID,
      client_secret: process.env.TN_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`TN token exchange falló: ${res.status} ${JSON.stringify(json)}`);
  return json as TnToken;
}

/** GET a la API de una tienda. */
export async function tnGet<T = unknown>(
  storeId: string,
  token: string,
  path: string,
  params: Record<string, string | number> = {},
): Promise<{ data: T; res: Response }> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const url = `${API_BASE}/${storeId}/${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Authentication: `bearer ${token}`,
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TN GET ${path} → ${res.status}: ${text}`);
  }
  return { data: (await res.json()) as T, res };
}

/** Itera todas las páginas de un recurso (customers, orders, products…). */
export async function* tnPaginate<T = unknown>(
  storeId: string,
  token: string,
  path: string,
  params: Record<string, string | number> = {},
  perPage = 200,
): AsyncGenerator<T[]> {
  let page = 1;
  while (true) {
    const { data } = await tnGet<T[]>(storeId, token, path, {
      ...params,
      page,
      per_page: perPage,
    });
    if (!Array.isArray(data) || data.length === 0) break;
    yield data;
    if (data.length < perPage) break;
    page += 1;
  }
}

/** URL de instalación/autorización para que el dueño de la tienda conecte la app. */
export function authorizeUrl(): string {
  return `https://www.tiendanube.com/apps/${process.env.TN_CLIENT_ID}/authorize`;
}
