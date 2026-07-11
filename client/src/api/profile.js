import { apiFetch } from "./client";

const BASE = "/api/profile";

export async function getProfile() {
  const res = await apiFetch(BASE);
  if (!res.ok) return null;
  return res.json();
}

export async function updateProfile(data) {
  const res = await apiFetch(BASE, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  return res.json();
}
