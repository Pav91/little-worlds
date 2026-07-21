import * as THREE from "three";

const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const raycaster = new THREE.Raycaster();
const normalMatrix = new THREE.Matrix3();
const worldNormal = new THREE.Vector3();
const rayOrigin = new THREE.Vector3();

export const FLOOR_BOUNDS = Object.freeze({ x: 7.78, z: 4.78 });

export function interactiveAncestor(object) {
  let node = object;
  while (node) {
    if (node.userData?.interactiveObjectId) return node;
    node = node.parent;
  }
  return null;
}

function surfaceAncestor(object) {
  let node = object;
  while (node) {
    if (node.userData?.placementSurface) return node;
    node = node.parent;
  }
  return null;
}

function isInside(object, ancestor) {
  let node = object;
  while (node) {
    if (node === ancestor) return true;
    node = node.parent;
  }
  return false;
}

function upwardFacing(hit) {
  if (!hit.face || !hit.object) return false;
  normalMatrix.getNormalMatrix(hit.object.matrixWorld);
  worldNormal.copy(hit.face.normal).applyMatrix3(normalMatrix).normalize();
  return worldNormal.dot(UP) > .62;
}

function acceptedSurface(hit, { self, roomId, allowElevated }) {
  if (!hit?.object || isInside(hit.object, self) || !upwardFacing(hit)) return null;
  const floor = surfaceAncestor(hit.object);
  if (floor?.userData?.placementSurface === "floor") {
    if (roomId && floor.userData.roomId && floor.userData.roomId !== roomId) return null;
    return { point: hit.point.clone(), supportId: null, kind: "floor" };
  }
  if (floor?.userData?.placementSurface) {
    if (roomId && floor.userData.roomId && floor.userData.roomId !== roomId) return null;
    return { point: hit.point.clone(), supportId: floor.userData.supportId || null, kind: floor.userData.placementSurface };
  }
  const owner = interactiveAncestor(hit.object);
  if (!allowElevated || !owner || owner === self || !owner.userData.supportCapable) return null;
  if (roomId && owner.userData.roomId && owner.userData.roomId !== roomId) return null;
  return { point: hit.point.clone(), supportId: owner.userData.interactiveObjectId, kind: "furniture" };
}

export function surfaceFromIntersections(intersections, options) {
  for (const hit of intersections || []) {
    const accepted = acceptedSurface(hit, options);
    if (accepted) return accepted;
  }
  return null;
}

export function surfaceBelow(scene, worldPoint, options) {
  rayOrigin.set(worldPoint.x, Math.max(18, worldPoint.y + 10), worldPoint.z);
  raycaster.set(rayOrigin, DOWN);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const hit of hits) {
    const accepted = acceptedSurface(hit, options);
    if (accepted) return accepted;
  }
  return null;
}

export function placementProfile(dna = {}) {
  const id = dna.id || "";
  const family = dna.family || "";
  const supportCapable = ["coffee-table", "side-table", "cabinet", "bookshelf", "desk", "workbench", "table"].some((key) => id.includes(key))
    || ["lifted-slab", "captured-box", "captured-stack"].includes(family);
  const floorOnly = ["sofa", "coffee-table", "bookshelf", "cabinet", "bed", "bath", "desk", "workbench", "side-table", "table"].some((key) => id.includes(key))
    || ["resting-frame", "captured-stack", "captured-box", "lifted-slab"].includes(family);
  return { allowElevated: !floorOnly, supportCapable };
}
