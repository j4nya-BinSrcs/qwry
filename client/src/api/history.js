import { apiFetch } from "./client";

const BASE = "/api/history";

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
