export const OBJECT_DNA = {
  sofa: {
    id: "sofa",
    family: "resting-frame",
    signature: "captured blue cushions in a pale timber cradle",
    mass: [3.2, 1.15, 1.25],
    touchpoint: "front cushion seam",
    construction: "rail + pocket + collar",
    edgeFamily: "soft-12",
    paintFamily: "room-blue",
    memory: { title: "Living room sofa", text: "This couch was purchased in 2024.", meta: "West Elm · 3-seat · Warranty saved" },
  },
  coffeeTable: {
    id: "coffee-table",
    family: "lifted-slab",
    signature: "inlaid pocket and four collared legs",
    mass: [2.4, 0.62, 1.25],
    touchpoint: "blue memory pocket",
    construction: "laminated slab + pegged legs",
    edgeFamily: "soft-16",
    paintFamily: "timber-blue",
    memory: { title: "Coffee table", text: "Refinished with hardwax oil last spring.", meta: "Care guide · Finish recipe saved" },
  },
  bookshelf: {
    id: "bookshelf",
    family: "captured-stack",
    signature: "three colored backs held by horizontal rails",
    mass: [1.75, 2.8, 0.5],
    touchpoint: "right-side shelf pegs",
    construction: "rounded frame + captured panels",
    edgeFamily: "soft-12",
    paintFamily: "primary-stack",
    memory: { title: "Bookshelf", text: "Assembled in the living room in September 2023.", meta: "Assembly guide · 14 books indexed" },
  },
  lamp: {
    id: "lamp",
    family: "held-vessel",
    signature: "red tapered shade captured by timber caps",
    mass: [0.65, 1.4, 0.65],
    touchpoint: "navy base collar",
    construction: "stem + collar + captured shade",
    edgeFamily: "rolled-8",
    paintFamily: "signal-red",
    memory: { title: "Reading lamp", text: "Uses an E14 warm-white bulb.", meta: "Bulb: 2700K · Last changed 8 months ago" },
  },
  plant: {
    id: "plant",
    family: "clustered-stem",
    signature: "broad leaves pinned to a collared planter",
    mass: [0.9, 1.45, 0.9],
    touchpoint: "navy planter collar",
    construction: "turned pot + pinned leaves",
    edgeFamily: "leaf-6",
    paintFamily: "garden-green",
    memory: { title: "Rubber plant", text: "Water every 10–14 days when the top soil is dry.", meta: "Last watered 4 days ago · East window" },
  },
  cabinet: {
    id: "cabinet",
    family: "captured-box",
    signature: "mustard doors seated inside a timber frame",
    mass: [1.65, 1.15, 0.55],
    touchpoint: "paired timber pegs",
    construction: "frame + twin hinged panels",
    edgeFamily: "soft-10",
    paintFamily: "room-mustard",
    memory: { title: "Media cabinet", text: "The router and household manuals live here.", meta: "6 documents · 3 devices connected" },
  },
  sideTable: {
    id: "side-table", family: "lifted-slab", signature: "small collared perch", mass: [.86,.8,.74],
    touchpoint: "side peg", construction: "slab + twin legs", edgeFamily: "soft-10", paintFamily: "timber",
    memory: { title: "Side table", text: "A compact table with its original assembly record." },
  },
  mug: {
    id: "mug", family: "held-vessel", signature: "red vessel with captured timber loop", mass: [.42,.34,.35],
    touchpoint: "timber handle", construction: "vessel + captured ring", edgeFamily: "rolled-8", paintFamily: "signal-red",
    memory: { title: "Ceramic mug", text: "Part of the everyday kitchen set." },
  },
  framedPicture: {
    id: "framed-picture", family: "captured-sheet", signature: "paper held by a timber frame", mass: [1.25,.86,.09],
    touchpoint: "frame edge", construction: "frame + captured paper", edgeFamily: "soft-7", paintFamily: "paper-blue",
    memory: { title: "Living room print", text: "A signed print from the spring collection." },
  },
};

const RECORD_DEFAULTS = {
  photo: "/peg-pocket-lineup.png",
  purchaseYear: "2024",
  warranty: "Active until May 2027",
  receipt: "Receipt saved · PDF",
  manual: "Owner manual · PDF",
  maintenance: ["12 Jun 2026 · Condition checked", "04 Feb 2026 · Cleaned and documented"],
  notes: "Keep the original finish and use gentle household cleaner only.",
};

Object.values(OBJECT_DNA).forEach((object) => {
  object.memory = { ...RECORD_DEFAULTS, ...object.memory };
});

export const ROOM_DNA = {
  id: "living-room",
  name: "Living room",
  floor: 1,
  objectIds: Object.keys(OBJECT_DNA),
  accent: "room-blue",
};
