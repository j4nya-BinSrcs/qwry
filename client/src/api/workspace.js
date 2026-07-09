const BASE = "/api";

function headers(sessionId) {
  return {
    "Content-Type": "application/json",
    "X-Session-Id": sessionId,
  };
}

export async function listWorkspaces(sessionId) {
  const res = await fetch(`${BASE}/workspaces`, { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`list workspaces failed: ${res.status}`);
  return res.json();
}

export async function createWorkspace(sessionId, name, description) {
  const res = await fetch(`${BASE}/workspaces`, {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error(`create workspace failed: ${res.status}`);
  return res.json();
}

export async function deleteWorkspace(sessionId, wsId) {
  const res = await fetch(`${BASE}/workspaces/${wsId}`, {
    method: "DELETE",
    headers: headers(sessionId),
  });
  if (!res.ok) throw new Error(`delete workspace failed: ${res.status}`);
  return res.json();
}

export async function listItems(sessionId, wsId) {
  const res = await fetch(`${BASE}/workspaces/${wsId}/items`, {
    headers: headers(sessionId),
  });
  if (!res.ok) throw new Error(`list items failed: ${res.status}`);
  return res.json();
}

export async function addItem(sessionId, wsId, url, title, snippet, source) {
  const res = await fetch(`${BASE}/workspaces/${wsId}/items`, {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify({ url, title, snippet, source }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `add item failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteItem(sessionId, itemId) {
  const res = await fetch(`${BASE}/workspaces/items/${itemId}`, {
    method: "DELETE",
    headers: headers(sessionId),
  });
  if (!res.ok) throw new Error(`delete item failed: ${res.status}`);
  return res.json();
}