import { apiFetch } from "./client";

const BASE = "/api";

export async function getProfile() {
  const res = await apiFetch(`${BASE}/profile`);
  if (!res.ok) return null;
  return res.json();
}

export async function updateProfile(data) {
  const res = await apiFetch(`${BASE}/profile`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function listProfiles() {
  const res = await apiFetch(`${BASE}/profiles`);
  if (!res.ok) return [];
  return res.json();
}

export async function createProfile(username) {
  const res = await apiFetch(`${BASE}/profiles`, {
    method: "POST",
    body: JSON.stringify({ username }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteProfile(targetSessionId) {
  const res = await apiFetch(`${BASE}/profiles/delete`, {
    method: "POST",
    body: JSON.stringify({ session_id: targetSessionId }),
  });
  if (!res.ok) return false;
  return true;
}
