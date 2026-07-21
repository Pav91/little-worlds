export async function generateObjectWithOpenAI({ description, source, evidence, imageDataUrl, signal }) {
  const response = await fetch("/api/generate-object", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal,
    body: JSON.stringify({ description, source, evidence, imageDataUrl }),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The object-generation service returned an unreadable response.");
  }
  if (!response.ok) throw new Error(payload?.error || "Object generation failed.");
  if (!payload?.objectDNA) throw new Error("OpenAI returned no ObjectDNA asset.");
  return payload;
}
