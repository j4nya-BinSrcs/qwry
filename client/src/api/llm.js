const BASE = "/api";

export async function llmGenerate(query, results) {
  const res = await fetch(`${BASE}/llm/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, results }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `LLM generate failed: ${res.status}`);
  }
  return res.json();
}
