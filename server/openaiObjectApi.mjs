import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { hashEvidence, validateObjectDNA } from "../src/generation/objectPipeline.js";

const MAX_REQUEST_BYTES = 14 * 1024 * 1024;
const SCHEMA_VERSION = "hm.object-dna/v1";
const COMPILER_VERSION = "held-geometry/1.0";
const VOCABULARY_VERSION = "held-geometry/v1";
const PROMPT_CACHE_KEY = "household-object-dna-v1";
const SERVICE_TIERS = new Set(["auto", "default", "flex", "priority"]);

const primitive = z.enum([
  "settled-block",
  "crowned-slab",
  "round-slab",
  "footed-plinth",
  "open-frame",
  "captured-panel",
  "inset-shell",
  "soft-wedge",
  "turned-vessel",
  "stem",
  "shade",
  "branch-fan",
  "ring-handle",
  "rail",
  "screen",
]);

const materialClass = z.enum(["painted", "wood", "fabric", "metal", "glass", "paper"]);
// Keep vectors as ordinary JSON Schema arrays. Fixed-length Zod arrays may be
// emitted as tuple schemas (`prefixItems`) by some Zod/SDK combinations, which
// the Responses API strict-schema subset does not accept. Shape is enforced
// locally after parsing instead.
const vector3 = z.array(z.number());

const objectProposal = z.object({
  name: z.string().min(1).max(56),
  taxonomy: z.object({
    category: z.enum(["seating", "sleeping", "storage", "lighting", "botanical", "surface", "vessel", "display", "decorative"]),
    type: z.string().min(1).max(40),
    confidence: z.number().min(0).max(1),
    variantGroup: z.string().min(1).max(64),
  }),
  scale: z.object({
    class: z.enum(["object", "furniture"]),
    canonicalBounds: z.array(z.number().min(0.05).max(4)),
    physicalProxyCm: z.number().min(1).max(400),
  }),
  orientation: z.object({
    forward: z.literal("+Z"),
    posture: z.enum(["steady", "receptive", "attentive", "reaching", "resting"]),
    handedness: z.enum(["left", "right", "neutral"]),
  }),
  family: z.object({
    pattern: z.string().min(1).max(16),
    silhouetteFamily: z.enum(["resting-frame", "lifted-slab", "captured-stack", "captured-box", "held-vessel", "clustered-stem", "sculptural-object"]),
  }),
  parts: z.array(z.object({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
    primitive,
    dimensions: z.array(z.number().min(0.02).max(4)),
    modifiers: z.object({
      radius: z.number().min(0).max(0.3),
      crown: z.number().min(-0.15).max(0.25),
      taper: z.number().min(-0.4).max(0.7),
      bow: z.number().min(-0.2).max(0.2),
      count: z.number().int().min(1).max(12),
    }),
    paintRole: z.enum(["primary.body", "secondary.body", "accent"]),
    materialClass,
    rotation: vector3,
    root: z.boolean(),
  })).min(1).max(12),
  construction: z.array(z.object({
    parent: z.string().min(1).max(72),
    child: z.string().min(1).max(72),
    join: z.enum(["J01", "J02", "J03", "J04", "J05", "J06"]),
    offset: vector3,
  })).max(20),
  signature: z.object({
    part: z.string().min(1).max(32),
    prominence: z.number().min(0).max(1),
    requiredViews: z.array(z.enum(["front", "front3q", "side", "side3q", "top"])).min(1).max(3),
  }),
  touchpoint: z.object({
    part: z.string().min(1).max(32),
    handle: z.enum(["H01", "H02", "H03"]),
    action: z.enum(["inspect", "pull", "lift", "open", "rest"]),
    prominence: z.number().min(0).max(1),
  }),
  paintFamily: z.object({
    primary: z.enum(["green", "red", "ivory", "blue"]),
    secondary: z.literal("room.secondary"),
    accent: z.literal("semantic.touch"),
    reflectionSource: z.literal("floor"),
  }),
});

// Build the strict JSON schema once. Recreating it for every generation adds
// avoidable local work and also makes it harder to reason about cache identity.
const OBJECT_PROPOSAL_FORMAT = zodTextFormat(objectProposal, "household_object_dna");

const SYSTEM_PROMPT = `Role: You are the ObjectDNA author for Little Worlds, a handcrafted architectural-miniature editor.

Goal: Convert one described or photographed household object into a unique, recognizable ObjectDNA part graph. The result must visibly represent the requested object, not merely its broad category.

Success criteria:
- Preserve distinctive silhouette, proportions, material, color, supports, openings, handles, cushions, shelves, and asymmetry visible in the evidence.
- Use 3-12 meaningful visible parts. Prefer a few specific large parts over generic four-leg furniture.
- Exactly one part has root=true. Every other part is connected from an already reachable parent.
- construction is a strict tree with exactly parts.length - 1 joins. The root is never a child, every non-root part is a child exactly once, and no part may have two parents.
- Every visible support, leg, handle, rail, cushion, shade, branch, and decorative part must physically touch its parent at the declared anchors. Never leave a plausible part floating near the object.
- signature.part and touchpoint.part exactly match part ids.
- Keep the whole object within a four-meter room-scale envelope and resting naturally on its root.

Geometry vocabulary:
- settled-block: solid softened volume
- crowned-slab: tabletop, seat, shelf, or other softened slab
- round-slab: circular or oval tabletop, tier, rim, or disk; dimensions remain [width, height, depth]
- footed-plinth: grounded base with small feet
- open-frame: four-post open support frame
- captured-panel: framed back, door, or headboard panel
- inset-shell: cabinet, drawer, or enclosed body
- soft-wedge: cushion, mattress, or upholstery
- turned-vessel: rotational pot, bowl, vase, or rounded base
- stem: narrow vertical support
- shade: tapered lampshade
- branch-fan: clustered leaves or branching canopy
- ring-handle: loop, collar, or ring pull
- rail: arm, bar, narrow support, or frame member
- screen: glass or display surface

Coordinate contract:
- +X is right, +Y is up, and +Z is forward.
- dimensions are [width on X, height on Y, depth on Z]. Cylinders and elongated parts also use their height along local +Y before rotation.
- rotations are absolute object-local Euler [x,y,z] angles in radians, applied in XYZ order. Use 0, +/-1.5708, or 3.1416 for quarter/half turns; never output degrees.
- A part's top/bottom/front/back/left/right anchors rotate with that part. Use top/bottom for upright legs and necks unless a deliberate rotation changes their direction.

Construction references use "part-id.anchor.tokens". Valid anchor tokens are top, bottom, left, right, front, back, and center. Example: parent="seat.top.back", child="back.bottom.center". Offsets are small object-local [x,y,z] adjustments in meters. Every dimensions, canonicalBounds, rotation, and offset array must contain exactly three numbers.

Before returning, mentally compile the construction from the root outward. Confirm that every non-root part is reachable exactly once and that each parent anchor coincides with its child anchor after rotation and offset. For photographed objects, use the image to infer the structure, but express placement only through this connected construction tree rather than independent image-space positions.

Photo targeting:
- Reconstruct the dominant complete object nearest the camera and closest to the image center. Ignore surrounding sofas, chairs, lamps, wall art, price labels, paper cards, rugs, and showroom furniture behind it.
- Treat stickers, price cards, reflections, printed graphics, and loose papers as surface evidence, never as structural parts.
- Match the target's primary silhouette before adding secondary detail. A round object must use round-slab or turned-vessel parts rather than rectangular slabs or improvised handles.
- ring-handle is only for a literal loop, collar, or pull. Never use it to represent a circular tabletop, tabletop rim, round inlay, or drum-table edge.
- For a round drum coffee table, use a wide turned-vessel root for the cylindrical base, a centered round-slab for the tabletop, and optionally a thinner centered round-slab for the inset surface. Join base.top.center to top.bottom.center with zero or very small offsets. A circular part has equal width and depth; use unequal width and depth only when the evidence is visibly oval.

Constraints:
- Do not output stock catalog names or a generic chair/table unless the evidence actually requests that form.
- Rugs, carpets, and floor mats are not supported and must never be proposed.
- Do not invent unsupported primitives or materials.
- If evidence is ambiguous, create a distinctive grammar-constrained proxy and lower taxonomy.confidence; never collapse it to a four-leg chair.
- Modifier fields are radius, crown, taper, bow, and count. Use zero values when a modifier does not apply, and count=1 unless the primitive is a repeated cluster.

Output only the schema-defined proposal.`;

function safeEvidence(evidence = {}) {
  return {
    filename: typeof evidence.filename === "string" ? evidence.filename.slice(0, 180) : undefined,
    mimeType: typeof evidence.mimeType === "string" ? evidence.mimeType.slice(0, 80) : undefined,
    size: Number.isFinite(evidence.size) ? evidence.size : undefined,
    width: Number.isFinite(evidence.width) ? evidence.width : undefined,
    height: Number.isFinite(evidence.height) ? evidence.height : undefined,
    aspect: Number.isFinite(evidence.aspect) ? evidence.aspect : undefined,
    dominantColor: typeof evidence.dominantColor === "string" ? evidence.dominantColor.slice(0, 32) : undefined,
  };
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "object";
}

function assertVector3(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((entry) => !Number.isFinite(entry))) {
    throw new Error(`OpenAI returned an invalid ${label}; expected exactly three numbers.`);
  }
}

function buildObjectDNA({ proposal, description, source, evidence, model, responseId }) {
  assertVector3(proposal.scale.canonicalBounds, "canonicalBounds vector");
  proposal.parts.forEach((entry) => {
    assertVector3(entry.dimensions, `${entry.id} dimensions vector`);
    assertVector3(entry.rotation, `${entry.id} rotation vector`);
  });
  proposal.construction.forEach((entry, index) => assertVector3(entry.offset, `construction ${index + 1} offset vector`));

  const sanitizedEvidence = safeEvidence(evidence);
  const seed = hashEvidence(JSON.stringify({ description, source, evidence: sanitizedEvidence, responseId }));
  const normalizedParts = proposal.parts.map((entry) => ({
    ...entry,
    // These fields are part of the durable ObjectDNA contract but do not alter
    // the current renderer. Restoring them locally saves repeated output tokens
    // without changing the generated silhouette, materials, or construction.
    profile: "PR01",
    modifiers: {
      ...entry.modifiers,
      lean: 0,
      pedestal: false,
      open: false,
    },
    edgeFamily: "E01",
  }));
  const objectDNA = {
    schema: SCHEMA_VERSION,
    id: `generated.${slug(proposal.taxonomy.type)}.${seed.toString(36)}`,
    version: "1.0.0",
    generator: COMPILER_VERSION,
    vocabulary: VOCABULARY_VERSION,
    seed,
    taxonomy: proposal.taxonomy,
    scale: proposal.scale,
    orientation: proposal.orientation,
    family: proposal.family,
    parts: normalizedParts,
    construction: proposal.construction,
    signature: proposal.signature,
    touchpoints: [proposal.touchpoint],
    paintFamily: proposal.paintFamily,
    memoryTrace: { type: "none", target: null, intensity: 0, maximumArea: 0 },
    behavior: {
      idle: proposal.taxonomy.category === "botanical" ? "I03" : "I00",
      interaction: { type: "B08", joint: proposal.touchpoint.part, range: [0, 0], response: "settle" },
    },
    budgets: { maxTriangles: 4500, maxDrawCalls: 4, maxVisibleParts: 12 },
    validationProfile: `${proposal.taxonomy.category}-generated`,
    provenance: {
      source,
      evidence: { ...sanitizedEvidence, description },
      confidence: proposal.taxonomy.confidence,
      generatedBy: `openai-responses/${model}`,
      responseId,
    },
  };
  const validationReport = validateObjectDNA(objectDNA);
  if (!validationReport.valid) {
    const reason = [...validationReport.errors, ...validationReport.warnings].join(" · ");
    throw new Error(`Generated ObjectDNA did not pass the compiler: ${reason}`);
  }
  return { objectDNA, validationReport };
}

async function parseJsonRequest(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw Object.assign(new Error("The photo is too large to process."), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("The generation request was not valid JSON."), { statusCode: 400 });
  }
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

export function publicError(error) {
  if (error?.status === 401) return { status: 502, message: "The OpenAI API key was rejected. Check the configured OPENAI_API_KEY." };
  if (error?.status === 429 && error?.code === "insufficient_quota") {
    return { status: 429, message: "The OpenAI API key is connected, but this project has no available API quota. Add billing or credits in the OpenAI project, then try again." };
  }
  if (error?.status === 429) return { status: 429, message: "OpenAI is rate-limiting object generation. Please try again shortly." };
  if (error?.status === 400) return { status: 400, message: error.message || "OpenAI could not process this object request." };
  if (error?.statusCode) return { status: error.statusCode, message: error.message };
  return { status: 502, message: error?.message || "OpenAI object generation failed." };
}

export async function generateObject({ client, model, serviceTier, body }) {
  if (!client) {
    throw Object.assign(new Error("OpenAI is not configured yet. Add OPENAI_API_KEY to .env.local and restart the server."), { statusCode: 503 });
  }
  const source = body?.source === "photo" ? "photo" : "describe";
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 1800) : "";
  const evidence = safeEvidence(body?.evidence);
  const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";
  if (source === "describe" && !description) throw Object.assign(new Error("Describe the object before generating it."), { statusCode: 400 });
  if (/\b(rug|carpet|floor[ -]?mat|area[ -]?mat)\b/i.test(description)) throw Object.assign(new Error("Rugs and carpets are not supported in this project."), { statusCode: 400 });
  if (source === "photo" && !imageDataUrl.startsWith("data:image/")) throw Object.assign(new Error("Choose a supported image before generating the object."), { statusCode: 400 });

  const userContent = [{
    type: "input_text",
    text: source === "photo"
      ? `Reconstruct the single household object in this photo. Filename: ${evidence.filename || "photo"}. Use the image itself as the primary evidence.`
      : `Create this household object: ${description}`,
  }];
  if (source === "photo") userContent.push({ type: "input_image", image_url: imageDataUrl, detail: "high" });

  const startedAt = performance.now();
  const response = await client.responses.parse({
    model,
    reasoning: { effort: "medium" },
    service_tier: serviceTier,
    store: false,
    max_output_tokens: 10000,
    prompt_cache_key: PROMPT_CACHE_KEY,
    prompt_cache_options: { mode: "explicit", ttl: "30m" },
    input: [
      { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT, prompt_cache_breakpoint: { mode: "explicit" } }] },
      { role: "user", content: userContent },
    ],
    text: { format: OBJECT_PROPOSAL_FORMAT },
  });
  const responseReceivedAt = performance.now();
  if (!response.output_parsed) throw new Error("OpenAI returned no usable ObjectDNA proposal.");
  const compiled = buildObjectDNA({ proposal: response.output_parsed, description, source, evidence, model, responseId: response.id });
  const completedAt = performance.now();
  console.info("[object-generation:timing]", JSON.stringify({
    model,
    serviceTier: response.service_tier || serviceTier,
    source,
    totalMs: Math.round(completedAt - startedAt),
    openaiMs: Math.round(responseReceivedAt - startedAt),
    compileAndValidateMs: Math.round(completedAt - responseReceivedAt),
    inputTokens: response.usage?.input_tokens || 0,
    cachedTokens: response.usage?.input_tokens_details?.cached_tokens || 0,
    cacheWriteTokens: response.usage?.input_tokens_details?.cache_write_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    reasoningTokens: response.usage?.output_tokens_details?.reasoning_tokens || 0,
    visibleParts: compiled.validationReport.metrics.visibleParts,
    validationScore: compiled.validationReport.score,
  }));
  return {
    name: response.output_parsed.name,
    model,
    responseId: response.id,
    ...compiled,
  };
}

export function createOpenAIObjectApiPlugin({ apiKey, model, serviceTier = "auto" }) {
  const client = apiKey ? new OpenAI({ apiKey }) : null;
  const normalizedServiceTier = SERVICE_TIERS.has(serviceTier) ? serviceTier : "auto";
  const middleware = () => async (request, response, next) => {
    if (request.method !== "POST") return next();
    try {
      const body = await parseJsonRequest(request);
      sendJson(response, 200, await generateObject({ client, model, serviceTier: normalizedServiceTier, body }));
    } catch (error) {
      console.error("[object-generation]", error);
      const normalized = publicError(error);
      sendJson(response, normalized.status, { error: normalized.message });
    }
  };
  return {
    name: "openai-object-generation-api",
    configureServer(server) {
      server.middlewares.use("/api/generate-object", middleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/generate-object", middleware());
    },
  };
}
