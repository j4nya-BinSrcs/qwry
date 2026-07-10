export async function readUrl(url) {
  const res = await fetch(`/api/read?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `read failed: ${res.status}`);
  }
  return res.json();
}
