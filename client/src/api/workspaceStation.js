const BASE = "/api";

function headers(sessionId) {
  return {
    "Content-Type": "application/json",
    "X-Session-Id": sessionId,
  };
}

function stationPath(wsId, ...segments) {
  return `${BASE}/workspaces/${wsId}/station/${segments.join("/")}`;
}

export async function loadAll(sessionId, wsId) {
  const res = await fetch(stationPath(wsId, "load-all"), { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`loadAll failed: ${res.status}`);
  return res.json();
}

// ── Reads ──────────────────────────────────────────────────────────────

export async function listReads(sessionId, wsId) {
  const res = await fetch(stationPath(wsId, "reads"), { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`list reads failed: ${res.status}`);
  return res.json();
}

export async function createRead(sessionId, wsId, itemId, status) {
  const res = await fetch(stationPath(wsId, "reads"), {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify({ item_id: itemId, status }),
  });
  if (!res.ok) throw new Error(`create read failed: ${res.status}`);
  return res.json();
}

export async function updateReadStatus(sessionId, wsId, entryId, status) {
  const res = await fetch(stationPath(wsId, "reads", entryId), {
    method: "PATCH",
    headers: headers(sessionId),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`update read failed: ${res.status}`);
  return res.json();
}

export async function deleteRead(sessionId, wsId, entryId) {
  const res = await fetch(stationPath(wsId, "reads", entryId), {
    method: "DELETE",
    headers: headers(sessionId),
  });
  if (!res.ok) throw new Error(`delete read failed: ${res.status}`);
  return res.json();
}

// ── Highlights ─────────────────────────────────────────────────────────

export async function listHighlights(sessionId, wsId) {
  const res = await fetch(stationPath(wsId, "highlights"), { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`list highlights failed: ${res.status}`);
  return res.json();
}

export async function createHighlight(sessionId, wsId, data) {
  const res = await fetch(stationPath(wsId, "highlights"), {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`create highlight failed: ${res.status}`);
  return res.json();
}

export async function deleteHighlight(sessionId, wsId, entryId) {
  const res = await fetch(stationPath(wsId, "highlights", entryId), {
    method: "DELETE",
    headers: headers(sessionId),
  });
  if (!res.ok) throw new Error(`delete highlight failed: ${res.status}`);
  return res.json();
}

// ── Notes ──────────────────────────────────────────────────────────────

export async function listNotes(sessionId, wsId) {
  const res = await fetch(stationPath(wsId, "notes"), { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`list notes failed: ${res.status}`);
  return res.json();
}

export async function createNote(sessionId, wsId, title, content) {
  const res = await fetch(stationPath(wsId, "notes"), {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) throw new Error(`create note failed: ${res.status}`);
  return res.json();
}

export async function updateNote(sessionId, wsId, entryId, data) {
  const res = await fetch(stationPath(wsId, "notes", entryId), {
    method: "PATCH",
    headers: headers(sessionId),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`update note failed: ${res.status}`);
  return res.json();
}

export async function deleteNote(sessionId, wsId, entryId) {
  const res = await fetch(stationPath(wsId, "notes", entryId), {
    method: "DELETE",
    headers: headers(sessionId),
  });
  if (!res.ok) throw new Error(`delete note failed: ${res.status}`);
  return res.json();
}

// ── Pins ───────────────────────────────────────────────────────────────

export async function listPins(sessionId, wsId) {
  const res = await fetch(stationPath(wsId, "pins"), { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`list pins failed: ${res.status}`);
  return res.json();
}

export async function createPin(sessionId, wsId, pinnableType, pinnableId) {
  const res = await fetch(stationPath(wsId, "pins"), {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify({ pinnable_type: pinnableType, pinnable_id: pinnableId }),
  });
  if (!res.ok) throw new Error(`create pin failed: ${res.status}`);
  return res.json();
}

export async function reorderPins(sessionId, wsId, pinIds) {
  const res = await fetch(stationPath(wsId, "pins/reorder"), {
    method: "PUT",
    headers: headers(sessionId),
    body: JSON.stringify({ pin_ids: pinIds }),
  });
  if (!res.ok) throw new Error(`reorder pins failed: ${res.status}`);
  return res.json();
}

export async function deletePin(sessionId, wsId, entryId) {
  const res = await fetch(stationPath(wsId, "pins", entryId), {
    method: "DELETE",
    headers: headers(sessionId),
  });
  if (!res.ok) throw new Error(`delete pin failed: ${res.status}`);
  return res.json();
}

// ── Images ─────────────────────────────────────────────────────────────

export async function listImages(sessionId, wsId) {
  const res = await fetch(stationPath(wsId, "images"), { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`list images failed: ${res.status}`);
  return res.json();
}

export async function createImage(sessionId, wsId, data) {
  const res = await fetch(stationPath(wsId, "images"), {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`create image failed: ${res.status}`);
  return res.json();
}

export async function deleteImage(sessionId, wsId, entryId) {
  const res = await fetch(stationPath(wsId, "images", entryId), {
    method: "DELETE",
    headers: headers(sessionId),
  });
  if (!res.ok) throw new Error(`delete image failed: ${res.status}`);
  return res.json();
}

// ── Videos ─────────────────────────────────────────────────────────────

export async function listVideos(sessionId, wsId) {
  const res = await fetch(stationPath(wsId, "videos"), { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`list videos failed: ${res.status}`);
  return res.json();
}

export async function createVideo(sessionId, wsId, data) {
  const res = await fetch(stationPath(wsId, "videos"), {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`create video failed: ${res.status}`);
  return res.json();
}

export async function updateVideo(sessionId, wsId, entryId, data) {
  const res = await fetch(stationPath(wsId, "videos", entryId), {
    method: "PATCH",
    headers: headers(sessionId),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`update video failed: ${res.status}`);
  return res.json();
}

export async function deleteVideo(sessionId, wsId, entryId) {
  const res = await fetch(stationPath(wsId, "videos", entryId), {
    method: "DELETE",
    headers: headers(sessionId),
  });
  if (!res.ok) throw new Error(`delete video failed: ${res.status}`);
  return res.json();
}

// ── Comparisons ────────────────────────────────────────────────────────

export async function listComparisons(sessionId, wsId) {
  const res = await fetch(stationPath(wsId, "comparisons"), { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`list comparisons failed: ${res.status}`);
  return res.json();
}

export async function createComparison(sessionId, wsId, title, data) {
  const res = await fetch(stationPath(wsId, "comparisons"), {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify({ title, data }),
  });
  if (!res.ok) throw new Error(`create comparison failed: ${res.status}`);
  return res.json();
}

export async function updateComparison(sessionId, wsId, entryId, data) {
  const res = await fetch(stationPath(wsId, "comparisons", entryId), {
    method: "PATCH",
    headers: headers(sessionId),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`update comparison failed: ${res.status}`);
  return res.json();
}

export async function deleteComparison(sessionId, wsId, entryId) {
  const res = await fetch(stationPath(wsId, "comparisons", entryId), {
    method: "DELETE",
    headers: headers(sessionId),
  });
  if (!res.ok) throw new Error(`delete comparison failed: ${res.status}`);
  return res.json();
}

// ── Timeline ───────────────────────────────────────────────────────────

export async function listTimeline(sessionId, wsId, limit) {
  const params = limit ? `?limit=${limit}` : "";
  const res = await fetch(stationPath(wsId, "timeline") + params, { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`list timeline failed: ${res.status}`);
  return res.json();
}

// ── Tags ───────────────────────────────────────────────────────────────

export async function listTags(sessionId, wsId) {
  const res = await fetch(stationPath(wsId, "tags"), { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`list tags failed: ${res.status}`);
  return res.json();
}

export async function createTag(sessionId, wsId, name, color) {
  const res = await fetch(stationPath(wsId, "tags"), {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify({ name, color }),
  });
  if (!res.ok) throw new Error(`create tag failed: ${res.status}`);
  return res.json();
}

export async function deleteTag(sessionId, wsId, entryId) {
  const res = await fetch(stationPath(wsId, "tags", entryId), {
    method: "DELETE",
    headers: headers(sessionId),
  });
  if (!res.ok) throw new Error(`delete tag failed: ${res.status}`);
  return res.json();
}

export async function assignTag(sessionId, wsId, tagId, objectType, objectId) {
  const res = await fetch(stationPath(wsId, `tags/${tagId}/assign`), {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify({ object_type: objectType, object_id: objectId }),
  });
  if (!res.ok) throw new Error(`assign tag failed: ${res.status}`);
  return res.json();
}

export async function unassignTag(sessionId, wsId, tagId, objectType, objectId) {
  const res = await fetch(stationPath(wsId, `tags/${tagId}/unassign`), {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify({ object_type: objectType, object_id: objectId }),
  });
  if (!res.ok) throw new Error(`unassign tag failed: ${res.status}`);
  return res.json();
}

export async function listTaggedObjects(sessionId, wsId, tagId) {
  const res = await fetch(stationPath(wsId, `tags/${tagId}/objects`), { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`list tagged objects failed: ${res.status}`);
  return res.json();
}

// ── Stats / Search ─────────────────────────────────────────────────────

export async function getStats(sessionId, wsId) {
  const res = await fetch(stationPath(wsId, "stats"), { headers: headers(sessionId) });
  if (!res.ok) throw new Error(`get stats failed: ${res.status}`);
  return res.json();
}

export async function searchWorkspace(sessionId, wsId, q) {
  const res = await fetch(`${stationPath(wsId, "search")}?q=${encodeURIComponent(q)}`, {
    headers: headers(sessionId),
  });
  if (!res.ok) throw new Error(`search workspace failed: ${res.status}`);
  return res.json();
}
