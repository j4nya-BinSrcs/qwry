import { apiFetch } from "./client";

export async function readUrl(url, mediaUrl, workspaceId) {
  const params = new URLSearchParams({ url });
  if (mediaUrl) params.set("media_url", mediaUrl);
  if (workspaceId) params.set("workspace_id", workspaceId);
  const res = await apiFetch(`/api/read?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `read failed: ${res.status}`);
  }
  return res.json();
}

export async function readHistory() {
  const res = await apiFetch("/api/history/reads");
  if (!res.ok) return [];
  const list = await res.json();
  return (list || []).map((e) => ({
    id: e.id,
    url: e.url,
    title: e.title,
    mediaUrl: e.media_url || null,
    workspaceId: e.workspace_id || null,
    loading: false,
    error: null,
    data: {
      success: true,
      url: e.url,
      title: e.title,
      content_type: e.content_type,
      content: e.content,
      media_url: e.media_url || null,
    },
  }));
}
