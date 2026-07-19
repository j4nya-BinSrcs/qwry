const BASE = "/api";

function headers(sessionId) {
  return {
    "Content-Type": "application/json",
    "X-Session-Id": sessionId,
  };
}

function canvasPath(wsId, ...segments) {
  return `${BASE}/workspaces/${wsId}/canvas/${segments.join("/")}`;
}

// ── Nodes ──────────────────────────────────────────────────────────────

export async function listNodes(sessionId, wsId) {
  const res = await fetch(canvasPath(wsId, "nodes"), { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`list nodes failed: ${res.status}`);
  return res.json();
}

export async function getNode(sessionId, wsId, nodeId) {
  const res = await fetch(canvasPath(wsId, "nodes", nodeId), { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`get node failed: ${res.status}`);
  return res.json();
}

export async function createNode(sessionId, wsId, data) {
  const res = await fetch(canvasPath(wsId, "nodes"), {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`create node failed: ${res.status}`);
  return res.json();
}

export async function updateNode(sessionId, wsId, nodeId, data) {
  const res = await fetch(canvasPath(wsId, "nodes", nodeId), {
    method: "PATCH",
    headers: headers(sessionId),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`update node failed: ${res.status}`);
  return res.json();
}

export async function deleteNode(sessionId, wsId, nodeId) {
  const res = await fetch(canvasPath(wsId, "nodes", nodeId), {
    method: "DELETE",
    headers: headers(sessionId),
  });
  if (!res.ok) throw new Error(`delete node failed: ${res.status}`);
  return res.json();
}

// ── Connections ────────────────────────────────────────────────────────

export async function listConnections(sessionId, wsId) {
  const res = await fetch(canvasPath(wsId, "connections"), { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`list connections failed: ${res.status}`);
  return res.json();
}

export async function createConnection(sessionId, wsId, data) {
  const res = await fetch(canvasPath(wsId, "connections"), {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`create connection failed: ${res.status}`);
  return res.json();
}

export async function deleteConnection(sessionId, wsId, connId) {
  const res = await fetch(canvasPath(wsId, "connections", connId), {
    method: "DELETE",
    headers: headers(sessionId),
  });
  if (!res.ok) throw new Error(`delete connection failed: ${res.status}`);
  return res.json();
}
