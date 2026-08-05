export async function chatWithWorkspace(sessionId, wsId, question) {
  const res = await fetch(`/api/workspaces/${wsId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-Id": sessionId,
    },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `chat failed: ${res.status}`);
  }
  return res.json();
}
