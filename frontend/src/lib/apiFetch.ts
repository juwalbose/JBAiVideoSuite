/**
 * Thin fetch wrapper that throws on non-2xx responses.
 * Use for any API call where a silent failure would be misleading.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.detail || body.details || body.message || JSON.stringify(body);
    } catch {
      // response body is not JSON — use status text
      detail = res.statusText;
    }
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
  return res;
}
