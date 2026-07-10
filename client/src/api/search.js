const BASE = "/api";

export async function searchQuery(q, page = 1, pageSize = 20, provider = null, categories = null) {
  const params = new URLSearchParams({ q, page, page_size: pageSize });
  if (provider) params.set("provider", provider);
  if (categories) params.set("categories", categories);
  const res = await fetch(`${BASE}/search?${params}`);
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  return res.json();
}

export async function fetchSuggestions(q) {
  const res = await fetch(`${BASE}/suggest?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.suggestions || [];
}