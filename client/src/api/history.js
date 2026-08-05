import { apiFetch } from "./client";

const BASE = "/api/history";

export async function fetchSearchHistory() {
  const res = await apiFetch(`${BASE}/search`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchReads() {
  const res = await apiFetch(`${BASE}/reads`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchSummaries() {
  const res = await apiFetch(`${BASE}/summaries`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchActivity() {
  const res = await apiFetch(`${BASE}/activity`);
  if (!res.ok) return [];
  return res.json();
}
