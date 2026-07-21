import { Euler, Vector3 } from "three";

const SCHEMA = "hm.object-dna/v1";
const GENERATOR = "held-geometry/1.0";

export const HELD_GEOMETRY_PRIMITIVES = new Set([
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

const MATERIAL_CLASSES = new Set(["painted", "wood", "fabric", "metal", "glass", "paper"]);
const ANCHOR_TOKENS = new Set(["top", "bottom", "left", "right", "front", "back", "center"]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(value * 1000) / 1000;
const matches = (text, pattern) => pattern.test(text);

export const hashEvidence = (value = "") => Array.from(value).reduce(
  (seed, character) => ((seed * 33) ^ character.charCodeAt(0)) >>> 0,
  2166136261,
);

const noise = (seed, salt, min, max) => {
  let value = (seed ^ Math.imul(salt + 1, 2654435761)) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return min + ((value >>> 0) / 4294967295) * (max - min);
};

const part = (id, primitive, dimensions, options = {}) => ({
  id,
  primitive,
  profile: options.profile || "PR01",
  dimensions: dimensions.map(round),
  modifiers: options.modifiers || {},
  edgeFamily: options.edgeFamily || "E01",
  paintRole: options.paintRole || "primary.body",
  materialClass: options.materialClass || "painted",
  rotation: options.rotation || [0, 0, 0],
  root: Boolean(options.root),
});

const join = (parent, child, joinType = "J01", offset = [0, 0, 0]) => ({
  parent,
  child,
  join: joinType,
  offset: offset.map(round),
});

function semanticProfile(description, evidence, seed) {
  const text = description.toLowerCase();
  const wide = matches(text, /\b(wide|broad|long|large|oversized|sectional)\b/);
  const narrow = matches(text, /\b(narrow|slim|skinny|compact|small)\b/);
  const tall = matches(text, /\b(tall|high|upright|towering)\b/);
  const low = matches(text, /\b(low|short|squat|floor)\b/);
  const deep = matches(text, /\b(deep|plush|thick|overstuffed)\b/);
  const rounded = matches(text, /\b(round|rounded|curved|oval|soft|pillowy)\b/);
  const angular = matches(text, /\b(square|angular|rectangular|sharp|geometric)\b/);
  const asymmetric = matches(text, /\b(asymmetric|offset|leaning|cantilever|uneven)\b/);
  const materialClass = matches(text, /\b(velvet|linen|fabric|upholstered|cushion)\b/) ? "fabric"
    : matches(text, /\b(metal|steel|iron|brass|chrome|aluminum)\b/) ? "metal"
      : matches(text, /\b(glass|transparent|smoked)\b/) ? "glass"
        : matches(text, /\b(wood|wooden|oak|walnut|timber|bamboo)\b/) ? "wood"
          : "painted";
  const color = matches(text, /\b(green|sage|olive|emerald)\b/) ? "green"
    : matches(text, /\b(red|rust|terracotta|burgundy|pink)\b/) ? "red"
      : matches(text, /\b(cream|ivory|beige|white)\b/) ? "ivory"
        : matches(text, /\b(blue|navy|teal)\b/) ? "blue"
          : evidence?.dominantColor || "room.secondary";
  return {
    width: clamp((wide ? 1.28 : narrow ? .78 : 1) * noise(seed, 1, .92, 1.08), .62, 1.42),
    height: clamp((tall ? 1.3 : low ? .76 : 1) * noise(seed, 2, .92, 1.08), .58, 1.45),
    depth: clamp((deep ? 1.2 : narrow ? .86 : 1) * noise(seed, 3, .93, 1.07), .68, 1.3),
    radius: rounded ? .16 : angular ? .045 : noise(seed, 4, .075, .13),
    roundSurface: matches(text, /\b(round|circular|drum|cylindrical)\b/),
    posture: asymmetric ? "reaching" : low ? "receptive" : tall ? "attentive" : "steady",
    materialClass,
    color,
    hasArms: matches(text, /\b(arm|arms|armrest|wingback|recliner)\b/),
    hasHandle: matches(text, /\b(handle|loop|pull|ring|knob)\b/),
    hasDrawer: matches(text, /\b(drawer|drawers|storage|cabinet)\b/),
    hasShelf: matches(text, /\b(shelf|shelves|bookcase|book shelf)\b/),
    pedestal: matches(text, /\b(pedestal|single leg|one leg|tulip)\b/),
    open: matches(text, /\b(open|airy|slatted|spindle)\b/),
  };
}

function inferTaxonomy(description, evidence, seed) {
  const text = description.toLowerCase();
  const rules = [
    ["seating", "sofa", /\b(sofa|couch|settee|loveseat|sectional)\b/],
    ["seating", "armchair", /\b(armchair|recliner|lounge chair|wingback)\b/],
    ["seating", "stool", /\b(stool|barstool|ottoman|footstool)\b/],
    ["seating", "bench", /\b(bench)\b/],
    ["seating", "chair", /\b(chair|seat)\b/],
    ["sleeping", "bed", /\b(bed|mattress|headboard)\b/],
    ["storage", "bookshelf", /\b(bookcase|bookshelf|shelving|shelf)\b/],
    ["storage", "cabinet", /\b(cabinet|dresser|wardrobe|cupboard|credenza|sideboard|drawers)\b/],
    ["lighting", "lamp", /\b(lamp|light|lantern|sconce)\b/],
    ["botanical", "plant", /\b(plant|tree|flower|fern|palm)\b/],
    ["surface", "side-table", /\b(side table|end table|nightstand|bedside table)\b/],
    ["surface", "desk", /\b(desk|writing table|workstation)\b/],
    ["vessel", "vase", /\b(vase|urn|pottery|bowl|vessel|keepsake)\b/],
    ["display", "mirror", /\b(mirror|looking glass)\b/],
    ["display", "television", /\b(television|tv|monitor|screen)\b/],
    ["lighting", "candle", /\b(candle|candlestick)\b/],
    ["surface", "table", /\b(table|console|island)\b/],
  ];
  const match = rules.find(([, , pattern]) => pattern.test(text));
  if (match) return { domain: "household", category: match[0], type: match[1], confidence: .92 };

  const aspect = Number(evidence?.aspect) || 1;
  if (evidence?.source === "photo") {
    if (aspect > 1.45) return { domain: "household", category: "surface", type: "unclassified-surface", confidence: .46 };
    if (aspect < .72) return { domain: "household", category: "storage", type: "unclassified-upright", confidence: .43 };
  }
  const fallbacks = [
    { category: "vessel", type: "kept-object" },
    { category: "storage", type: "captured-object" },
    { category: "surface", type: "offering-object" },
    { category: "display", type: "framed-object" },
  ];
  return { domain: "household", ...fallbacks[seed % fallbacks.length], confidence: .36 };
}

function buildSeating(type, s, seed) {
  const sofa = type === "sofa";
  const bench = type === "bench";
  const stool = type === "stool";
  const width = (sofa ? 2.25 : bench ? 1.65 : stool ? .72 : .94) * s.width;
  const depth = (sofa ? .92 : bench ? .7 : stool ? .66 : .82) * s.depth;
  const supportHeight = (stool ? .62 : .5) * s.height;
  const parts = [
    part("support", s.pedestal ? "turned-vessel" : "open-frame", [width * .82, supportHeight, depth * .76], { root: true, materialClass: s.materialClass === "metal" ? "metal" : "wood", paintRole: "secondary.body", modifiers: { radius: s.radius, pedestal: s.pedestal } }),
    part("seat", "crowned-slab", [width, stool ? .18 : .22, depth], { materialClass: s.materialClass === "wood" ? "wood" : "fabric", modifiers: { radius: s.radius, crown: round(noise(seed, 11, .03, .1)) } }),
  ];
  const construction = [join("support.top.center", "seat.bottom.center", "J04")];
  if (!stool && !bench) {
    const backHeight = (sofa ? .72 : .88) * s.height;
    parts.push(part("back", s.open ? "rail" : "captured-panel", [width * .93, backHeight, .16], { materialClass: s.materialClass === "wood" ? "wood" : "fabric", paintRole: "primary.body", modifiers: { radius: s.radius, lean: s.posture === "attentive" ? -.04 : 0 } }));
    construction.push(join("seat.top.back", "back.bottom.center", "J02", [0, 0, .02]));
  }
  if (s.hasArms || type === "armchair" || sofa) {
    ["left", "right"].forEach((side) => {
      parts.push(part(`arm-${side}`, "rail", [.14, .52 * s.height, depth * .9], { materialClass: "wood", paintRole: "secondary.body", modifiers: { radius: s.radius * .7 } }));
      construction.push(join(`seat.top.${side}`, `arm-${side}.bottom.center`, "J04", [side === "left" ? .03 : -.03, 0, 0]));
    });
  }
  if (sofa && width > 2) {
    const cushions = clamp(Math.round(width / .78), 2, 4);
    for (let index = 0; index < cushions; index += 1) {
      const x = (index - (cushions - 1) / 2) * (width * .76 / cushions);
      parts.push(part(`cushion-${index + 1}`, "soft-wedge", [width * .72 / cushions, .13, depth * .72], { materialClass: "fabric", paintRole: index % 2 ? "secondary.body" : "primary.body", modifiers: { radius: s.radius } }));
      construction.push(join("seat.top.center", `cushion-${index + 1}.bottom.center`, "J01", [x, .01, .04]));
    }
  }
  return { pattern: "RP01", silhouetteFamily: "resting-frame", parts, construction, signature: stool ? "seat" : "back", touchpoint: "seat" };
}

function buildSurface(type, s, seed) {
  const side = type === "side-table";
  const desk = type === "desk";
  const width = (side ? .82 : desk ? 1.75 : 1.42) * s.width;
  const height = (side ? .62 : desk ? .73 : .68) * s.height;
  const depth = (side ? .7 : desk ? .76 : .88) * s.depth;
  const roundTable = s.roundSurface && !desk;
  const roundDiameter = Math.max(width, depth);
  const parts = [
    part("support", roundTable || s.pedestal ? "turned-vessel" : "open-frame", [roundTable ? roundDiameter * .72 : width * .78, height, roundTable ? roundDiameter * .72 : depth * .7], { root: true, materialClass: s.materialClass === "metal" ? "metal" : "wood", paintRole: "secondary.body", modifiers: { radius: s.radius, pedestal: s.pedestal } }),
    part("top", roundTable ? "round-slab" : "crowned-slab", [roundTable ? roundDiameter : width, .16, roundTable ? roundDiameter : depth], { materialClass: s.materialClass, modifiers: { radius: s.radius, crown: round(noise(seed, 21, .01, .06)) } }),
  ];
  const construction = [join("support.top.center", "top.bottom.center", "J04")];
  if (desk || s.hasDrawer) {
    parts.push(part("drawer", "inset-shell", [width * .42, .3, depth * .55], { materialClass: "painted", paintRole: "secondary.body", modifiers: { radius: s.radius * .7 } }));
    construction.push(join("top.bottom.right", "drawer.top.center", "J05", [-width * .08, 0, 0]));
  }
  if (s.hasShelf) {
    parts.push(part("lower-shelf", "crowned-slab", [width * .74, .1, depth * .58], { materialClass: "wood", paintRole: "secondary.body" }));
    construction.push(join("support.bottom.center", "lower-shelf.bottom.center", "J04", [0, height * .28, 0]));
  }
  return { pattern: "LS01", silhouetteFamily: "lifted-slab", parts, construction, signature: "top", touchpoint: "top" };
}

function buildStorage(type, s, seed) {
  const shelf = type === "bookshelf" || s.hasShelf;
  const width = (shelf ? 1.25 : 1.35) * s.width;
  const height = (shelf ? 1.65 : 1.08) * s.height;
  const depth = (shelf ? .42 : .62) * s.depth;
  const parts = [
    part("base", "footed-plinth", [width, .14, depth], { root: true, materialClass: "wood", paintRole: "secondary.body", modifiers: { radius: s.radius } }),
    part("body", shelf ? "open-frame" : "inset-shell", [width * .94, height, depth], { materialClass: s.materialClass, modifiers: { radius: s.radius, open: shelf } }),
  ];
  const construction = [join("base.top.center", "body.bottom.center", "J04")];
  const shelfCount = shelf ? clamp(3 + (seed % 3), 3, 5) : 0;
  for (let index = 1; index < shelfCount; index += 1) {
    parts.push(part(`shelf-${index}`, "crowned-slab", [width * .82, .09, depth * .88], { materialClass: "wood", paintRole: index % 2 ? "secondary.body" : "accent" }));
    construction.push(join("body.bottom.center", `shelf-${index}.bottom.center`, "J04", [0, height * index / shelfCount, 0]));
  }
  if (!shelf) {
    ["left", "right"].forEach((sideName) => {
      parts.push(part(`door-${sideName}`, "captured-panel", [width * .4, height * .7, .06], { materialClass: "painted", paintRole: sideName === "left" ? "primary.body" : "secondary.body", modifiers: { radius: s.radius * .7 } }));
      construction.push(join("body.front.center", `door-${sideName}.back.center`, "J02", [sideName === "left" ? -width * .22 : width * .22, 0, .02]));
    });
  }
  return { pattern: shelf ? "CS01" : "CP02", silhouetteFamily: shelf ? "captured-stack" : "captured-box", parts, construction, signature: shelf ? "shelf-2" : "door-right", touchpoint: shelf ? "body" : "door-right" };
}

function buildLight(type, s, seed) {
  const candle = type === "candle";
  const height = (candle ? .48 : 1.15) * s.height;
  const parts = [
    part("base", candle ? "turned-vessel" : "footed-plinth", [candle ? .34 : .52, candle ? .34 : .12, candle ? .34 : .52], { root: true, materialClass: candle ? "painted" : "metal", paintRole: "secondary.body", modifiers: { radius: s.radius } }),
    part("stem", "stem", [candle ? .045 : .07, height, candle ? .045 : .07], { materialClass: "metal", paintRole: "accent" }),
    part("light", candle ? "turned-vessel" : "shade", [candle ? .14 : .58 * s.width, candle ? .18 : .42, candle ? .14 : .58 * s.depth], { materialClass: candle ? "painted" : "fabric", modifiers: { radius: s.radius, taper: round(noise(seed, 31, .12, .35)) } }),
  ];
  return { pattern: "HV01", silhouetteFamily: "held-vessel", parts, construction: [join("base.top.center", "stem.bottom.center", "J04"), join("stem.top.center", "light.bottom.center", "J06")], signature: "light", touchpoint: "stem" };
}

function buildPlant(s, seed) {
  const parts = [
    part("planter", "turned-vessel", [.62 * s.width, .52 * s.height, .62 * s.depth], { root: true, materialClass: s.materialClass === "metal" ? "metal" : "painted", modifiers: { radius: s.radius, taper: .14 } }),
    part("stem", "stem", [.08, .62 * s.height, .08], { materialClass: "wood", paintRole: "secondary.body" }),
    part("leaves", "branch-fan", [.9 * s.width, .72 * s.height, .9 * s.depth], { materialClass: "painted", paintRole: "primary.body", modifiers: { count: 5 + (seed % 4), radius: s.radius } }),
  ];
  return { pattern: "BF01", silhouetteFamily: "clustered-stem", parts, construction: [join("planter.top.center", "stem.bottom.center", "J04"), join("stem.top.center", "leaves.bottom.center", "J06")], signature: "leaves", touchpoint: "planter" };
}

function buildVessel(s, seed) {
  const parts = [
    part("body", "turned-vessel", [.68 * s.width, .78 * s.height, .68 * s.depth], { root: true, materialClass: s.materialClass, modifiers: { radius: s.radius, taper: round(noise(seed, 41, .08, .28)) } }),
    part("collar", "ring-handle", [.32 * s.width, .08, .32 * s.depth], { materialClass: "metal", paintRole: "accent" }),
  ];
  const construction = [join("body.top.center", "collar.bottom.center", "J06")];
  if (s.hasHandle) {
    parts.push(part("handle", "ring-handle", [.44, .44, .09], { materialClass: "wood", paintRole: "secondary.body", rotation: [0, Math.PI / 2, 0] }));
    construction.push(join("body.right.center", "handle.left.center", "J04", [.08, 0, 0]));
  }
  return { pattern: "HV02", silhouetteFamily: "held-vessel", parts, construction, signature: "body", touchpoint: s.hasHandle ? "handle" : "collar" };
}

function buildDisplay(type, s) {
  const screen = type === "television";
  const width = (screen ? 1.5 : 1.05) * s.width;
  const height = (screen ? .9 : 1.35) * s.height;
  const parts = [
    part("base", "footed-plinth", [width * .62, .12, .42], { root: true, materialClass: "wood", paintRole: "secondary.body" }),
    part("frame", "captured-panel", [width, height, .14], { materialClass: screen ? "painted" : "wood", modifiers: { radius: s.radius } }),
    part("surface", "screen", [width * .82, height * .82, .035], { materialClass: "glass", paintRole: "primary.body", modifiers: { radius: s.radius * .7 } }),
  ];
  return { pattern: "CP03", silhouetteFamily: "captured-box", parts, construction: [join("base.top.center", "frame.bottom.center", "J04"), join("frame.front.center", "surface.back.center", "J02", [0, 0, .02])], signature: "surface", touchpoint: "frame" };
}

function buildBed(s) {
  const width = 2.15 * s.width;
  const depth = 1.65 * s.depth;
  const parts = [
    part("base", "footed-plinth", [width, .3, depth], { root: true, materialClass: "wood", paintRole: "secondary.body", modifiers: { radius: s.radius } }),
    part("mattress", "soft-wedge", [width * .94, .3, depth * .9], { materialClass: "fabric", modifiers: { radius: s.radius, crown: .05 } }),
    part("headboard", "captured-panel", [width, .92 * s.height, .18], { materialClass: s.materialClass, paintRole: "accent", modifiers: { radius: s.radius } }),
    part("cover", "soft-wedge", [width * .78, .1, depth * .48], { materialClass: "fabric", paintRole: "secondary.body", modifiers: { radius: s.radius * .6 } }),
  ];
  return { pattern: "RP02", silhouetteFamily: "resting-frame", parts, construction: [join("base.top.center", "mattress.bottom.center", "J01"), join("base.top.back", "headboard.bottom.center", "J02"), join("mattress.top.front", "cover.bottom.front", "J01", [0, 0, -.08])], signature: "headboard", touchpoint: "cover" };
}

function buildFallback(taxonomy, s, seed) {
  if (taxonomy.category === "surface") return buildSurface("table", s, seed);
  if (taxonomy.category === "storage") return buildStorage("cabinet", s, seed);
  if (taxonomy.category === "display") return buildDisplay("mirror", s, seed);
  return buildVessel(s, seed);
}

function buildGraph(taxonomy, semantic, seed) {
  if (taxonomy.category === "seating") return buildSeating(taxonomy.type, semantic, seed);
  if (taxonomy.category === "surface") return buildSurface(taxonomy.type, semantic, seed);
  if (taxonomy.category === "storage") return buildStorage(taxonomy.type, semantic, seed);
  if (taxonomy.category === "lighting") return buildLight(taxonomy.type, semantic, seed);
  if (taxonomy.category === "botanical") return buildPlant(semantic, seed);
  if (taxonomy.category === "vessel") return buildVessel(semantic, seed);
  if (taxonomy.category === "display") return buildDisplay(taxonomy.type, semantic);
  if (taxonomy.category === "sleeping") return buildBed(semantic);
  return buildFallback(taxonomy, semantic, seed);
}

export function proposeObjectDNA({ description = "", source = "describe", evidence = {} }) {
  const evidenceKey = JSON.stringify({ description, source, width: evidence.width, height: evidence.height, dominantColor: evidence.dominantColor, size: evidence.size });
  const seed = hashEvidence(evidenceKey);
  const taxonomy = inferTaxonomy(description, { ...evidence, source }, seed);
  const semantic = semanticProfile(description, evidence, seed);
  const graph = buildGraph(taxonomy, semantic, seed);
  const idSlug = `${taxonomy.category}.${taxonomy.type}.${seed.toString(36)}`.replace(/[^a-z0-9.-]/g, "-");
  return {
    schema: SCHEMA,
    id: `generated.${idSlug}`,
    version: "1.0.0",
    generator: GENERATOR,
    vocabulary: "held-geometry/v1",
    seed,
    taxonomy: { ...taxonomy, variantGroup: `${graph.pattern}-${semantic.posture}` },
    scale: { class: ["vessel", "lighting"].includes(taxonomy.category) ? "object" : "furniture", canonicalBounds: [semantic.width, semantic.height, semantic.depth], physicalProxyCm: 10 },
    orientation: { forward: "+Z", posture: semantic.posture, handedness: seed % 2 ? "right" : "left" },
    family: { pattern: graph.pattern, silhouetteFamily: graph.silhouetteFamily },
    parts: graph.parts,
    construction: graph.construction,
    signature: { part: graph.signature, prominence: .3, requiredViews: ["front3q", "side3q"] },
    touchpoints: [{ part: graph.touchpoint, handle: semantic.hasHandle ? "H03" : "H01", action: semantic.hasHandle ? "pull" : "inspect", prominence: .06 }],
    paintFamily: { primary: semantic.color, secondary: "room.secondary", accent: "semantic.touch", reflectionSource: "floor" },
    memoryTrace: { type: "none", target: null, intensity: 0, maximumArea: 0 },
    behavior: { idle: taxonomy.category === "botanical" ? "I03" : "I00", interaction: { type: "B08", joint: graph.touchpoint, range: [0, 0], response: "settle" } },
    budgets: { maxTriangles: 4500, maxDrawCalls: 4, maxVisibleParts: 12 },
    validationProfile: `${taxonomy.category}-generated`,
    provenance: { source, evidence: { ...evidence, description }, confidence: taxonomy.confidence, generatedBy: "ai-dna-proposer/local-1.0" },
  };
}

function splitAnchor(reference) {
  const [partId, ...tokens] = typeof reference === "string" ? reference.split(".") : [];
  return { partId, tokens };
}

function normalizeEuler(rotation = [0, 0, 0]) {
  const values = Array.isArray(rotation) ? rotation.slice(0, 3) : [0, 0, 0];
  while (values.length < 3) values.push(0);
  return values.map((value) => {
    if (!Number.isFinite(value)) return 0;
    return Math.abs(value) > Math.PI * 2 + .001 ? value * Math.PI / 180 : value;
  });
}

function anchorVector(dimensions, tokens = [], rotation = [0, 0, 0]) {
  const [width, height, depth] = dimensions;
  const point = new Vector3();
  tokens.forEach((token) => {
    if (token === "left") point.x = -width / 2;
    if (token === "right") point.x = width / 2;
    if (token === "top") point.y = height / 2;
    if (token === "bottom") point.y = -height / 2;
    if (token === "front") point.z = depth / 2;
    if (token === "back") point.z = -depth / 2;
  });
  return point.applyEuler(new Euler(...normalizeEuler(rotation), "XYZ")).toArray();
}

export function compileObjectDNA(dna) {
  const normalizedParts = dna.parts.map((entry) => ({ ...entry, rotation: normalizeEuler(entry.rotation) }));
  const parts = new Map(normalizedParts.map((entry) => [entry.id, entry]));
  const resolved = new Map();
  const root = normalizedParts.find((entry) => entry.root) || normalizedParts[0];
  resolved.set(root.id, [0, root.dimensions[1] / 2, 0]);
  const pending = [...dna.construction];
  let progressed = true;
  while (pending.length && progressed) {
    progressed = false;
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const edge = pending[index];
      const parentRef = splitAnchor(edge.parent);
      const childRef = splitAnchor(edge.child);
      const parent = parts.get(parentRef.partId);
      const child = parts.get(childRef.partId);
      const parentPosition = resolved.get(parentRef.partId);
      if (!parent || !child || !parentPosition) continue;
      const parentAnchor = anchorVector(parent.dimensions, parentRef.tokens, parent.rotation);
      const childAnchor = anchorVector(child.dimensions, childRef.tokens, child.rotation);
      const offset = edge.offset || [0, 0, 0];
      resolved.set(child.id, [0, 1, 2].map((axis) => round(parentPosition[axis] + parentAnchor[axis] - childAnchor[axis] + offset[axis])));
      pending.splice(index, 1);
      progressed = true;
    }
  }
  return {
    ...dna,
    compiledParts: normalizedParts.map((entry) => ({ ...entry, position: resolved.get(entry.id) || [0, entry.dimensions[1] / 2, 0] })),
    unresolvedJoins: pending,
  };
}

export function validateObjectDNA(dna) {
  const errors = [];
  const warnings = [];
  if (dna?.schema !== SCHEMA) errors.push("Unsupported ObjectDNA schema");
  if (dna?.generator !== GENERATOR) errors.push("Unsupported geometry compiler");
  if (!Array.isArray(dna?.parts) || dna.parts.length < 1 || dna.parts.length > 12) errors.push("Visible part budget exceeded");
  const ids = new Set();
  const parts = dna?.parts || [];
  parts.forEach((entry) => {
    if (ids.has(entry.id)) errors.push(`Duplicate part id: ${entry.id}`);
    ids.add(entry.id);
    if (!HELD_GEOMETRY_PRIMITIVES.has(entry.primitive)) errors.push(`Unregistered primitive: ${entry.primitive}`);
    if (!MATERIAL_CLASSES.has(entry.materialClass)) errors.push(`Unsupported material class: ${entry.materialClass}`);
    if (!Array.isArray(entry.dimensions) || entry.dimensions.some((value) => !Number.isFinite(value) || value <= 0 || value > 4)) errors.push(`Invalid dimensions: ${entry.id}`);
  });
  const taxonomyType = String(dna?.taxonomy?.type || "").toLowerCase();
  const semanticDescription = String(dna?.provenance?.evidence?.description || "").toLowerCase();
  const expectsRoundSurface = dna?.taxonomy?.category === "surface" && /\b(round|circular|drum)\b/.test(`${taxonomyType} ${semanticDescription}`);
  if (expectsRoundSurface) {
    const roundParts = parts.filter((entry) => ["round-slab", "turned-vessel"].includes(entry.primitive));
    if (!roundParts.length) errors.push("Round surface objects require round geometry");
    if (!parts.some((entry) => entry.primitive === "round-slab")) errors.push("Round surface objects require a round tabletop");
    roundParts.forEach((entry) => {
      if (!Array.isArray(entry.dimensions) || entry.dimensions.length < 3) return;
      const diameter = Math.max(entry.dimensions[0], entry.dimensions[2]);
      if (Math.abs(entry.dimensions[0] - entry.dimensions[2]) > diameter * .12) errors.push(`Circular part must have matching width and depth: ${entry.id}`);
    });
  }
  const roots = parts.filter((entry) => entry.root);
  if (roots.length !== 1) errors.push("ObjectDNA must contain exactly one root part");
  const incoming = new Map(parts.map((entry) => [entry.id, 0]));
  const construction = Array.isArray(dna?.construction) ? dna.construction : [];
  if (!Array.isArray(dna?.construction)) errors.push("Construction must be an array");
  if (parts.length && construction.length !== parts.length - 1) errors.push("Construction must contain exactly one join per non-root part");
  construction.forEach((edge, index) => {
    const parentRef = splitAnchor(edge?.parent);
    const childRef = splitAnchor(edge?.child);
    const label = `Join ${index + 1}`;
    if (!ids.has(parentRef.partId)) errors.push(`${label} references a missing parent part`);
    if (!ids.has(childRef.partId)) errors.push(`${label} references a missing child part`);
    if (parentRef.partId && parentRef.partId === childRef.partId) errors.push(`${label} cannot connect a part to itself`);
    if (!parentRef.tokens.length || parentRef.tokens.some((token) => !ANCHOR_TOKENS.has(token))) errors.push(`${label} has an invalid parent anchor`);
    if (!childRef.tokens.length || childRef.tokens.some((token) => !ANCHOR_TOKENS.has(token))) errors.push(`${label} has an invalid child anchor`);
    if (incoming.has(childRef.partId)) incoming.set(childRef.partId, incoming.get(childRef.partId) + 1);
  });
  parts.forEach((entry) => {
    const edgeCount = incoming.get(entry.id) || 0;
    if (entry.root && edgeCount) errors.push(`Root part cannot be a construction child: ${entry.id}`);
    if (!entry.root && edgeCount !== 1) errors.push(`Part must be joined exactly once: ${entry.id}`);
  });
  const compiled = errors.length ? null : compileObjectDNA(dna);
  if (compiled?.unresolvedJoins.length) errors.push("Part graph contains unresolved joins");
  if (compiled && compiled.compiledParts.some((entry) => !entry.root && !incoming.get(entry.id))) errors.push("Part graph contains disconnected geometry");
  if (!ids.has(dna?.signature?.part)) errors.push("Signature part is missing");
  if ((dna?.taxonomy?.confidence || 0) < .5) warnings.push("Low-confidence taxonomy retained with source evidence");
  const score = clamp(100 - errors.length * 30 - warnings.length * 6, 0, 100);
  return {
    valid: errors.length === 0 && score >= 82,
    score,
    errors,
    warnings,
    metrics: { visibleParts: parts.length, joins: construction.length, unresolvedJoins: compiled?.unresolvedJoins.length || 0, roots: roots.length, connectedParts: compiled ? compiled.compiledParts.length : 0 },
    compiler: GENERATOR,
    vocabulary: "held-geometry/v1",
  };
}
