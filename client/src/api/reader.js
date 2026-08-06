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
