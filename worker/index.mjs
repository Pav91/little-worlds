import OpenAI from "openai";
import { generateObject, publicError } from "../server/openaiObjectApi.mjs";

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  },
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/generate-object") return env.ASSETS.fetch(request);
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

    try {
      const contentLength = Number(request.headers.get("content-length") || 0);
      if (contentLength > 14 * 1024 * 1024) return json({ error: "The photo is too large to process." }, 413);
      const body = await request.json();
      const client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
      const result = await generateObject({
        client,
        model: env.OPENAI_OBJECT_MODEL || "gpt-5.6-sol",
        serviceTier: env.OPENAI_OBJECT_SERVICE_TIER || "auto",
        body,
      });
      return json(result);
    } catch (error) {
      console.error("[object-generation]", error);
      const normalized = publicError(error);
      return json({ error: normalized.message }, normalized.status);
    }
  },
};
