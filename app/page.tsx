async function brief(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  let json: any = undefined; try { json = JSON.parse(text); } catch {}

  // redact any tokens
  if (json?.access_token) json.access_token = '***';
  if (json?.data?.access_token) json.data.access_token = '***';

  // collapse big arrays so we never spam the page
  const summary = (() => {
    if (!json) return text.slice(0, 300) + (text.length > 300 ? '…' : '');
    const copy = JSON.parse(JSON.stringify(json));
    if (Array.isArray(copy?.avatars)) copy.avatars = `[${copy.avatars.length} items]`;
    if (Array.isArray(copy?.data)) copy.data = `[${copy.data.length} items]`;
    if (Array.isArray(copy?.avatars?.avatars)) copy.avatars = `[${copy.avatars.avatars.length} items]`;
    return copy;
  })();

  return { ok: res.ok, status: res.status, endpoint: url, contentType: ct, json: summary };
}
