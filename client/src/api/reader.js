export async function readUrl(url, mediaUrl) {
  const params = new URLSearchParams({ url });
  if (mediaUrl) params.set("media_url", mediaUrl);
  const res = await fetch(`/api/read?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `read failed: ${res.status}`);
  }
  return res.json();
}
