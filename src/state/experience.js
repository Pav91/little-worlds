import { create } from "zustand";
import * as THREE from "three";
import { FLOOR_BOUNDS } from "../scene/placement.js";

export const transition = { value: 0 };
export const HOUSE_CAMERA = [13.7, 8.7, 15.2];
export const HOUSE_LOOK = [0, 1.02, -0.35];

export const ROOMS = [
  { id: "studio", name: "Studio", floor: "01", level: 0, position: [0, 0, 0], camera: HOUSE_CAMERA, target: HOUSE_LOOK, side: "open-front-right" },
];

const DEFAULT_CREATE_CAMERA_ZOOM = 20;
const GENERATED_KIND_ALIASES = {
  "coffee-table": "table",
  "floor-lamp": "lamp",
  "bedside-lamp": "lamp",
  "framed-picture": "mirror",
  mug: "vase",
};
const GENERATED_VARIANT_COUNT = 4;

const normalizeObjectVariant = (variant) => {
  const value = Number.isFinite(variant) ? Math.trunc(variant) : 0;
  return ((value % GENERATED_VARIANT_COUNT) + GENERATED_VARIANT_COUNT) % GENERATED_VARIANT_COUNT;
};

const nextObjectVariant = (state, kind, sourceVariant = null) => {
  const existingCount = state.customObjects.filter((item) => item.kind === kind).length;
  let variant = existingCount % GENERATED_VARIANT_COUNT;
  if (sourceVariant !== null && variant === normalizeObjectVariant(sourceVariant)) {
    variant = (variant + 1) % GENERATED_VARIANT_COUNT;
  }
  return variant;
};

const normalizeCreateAngle = (angle) => ((angle % 4) + 4) % 4;

const createRoomCamera = (room, angle = 0, zoom = DEFAULT_CREATE_CAMERA_ZOOM) => {
  const look = new THREE.Vector3(...room.target);
  const direction = new THREE.Vector3(...room.camera).sub(look).setY(0);
  if (direction.lengthSq() < .001) direction.set(0, 0, 1);
  direction
    .normalize()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), normalizeCreateAngle(angle) * Math.PI * .5)
    .multiplyScalar(zoom);
  // Create Mode deliberately keeps a Sims-like three-quarter elevation.
  // Camera buttons may turn or zoom this pose, but object movement never does.
  direction.y = Math.max(2.35, zoom * .5);
  return look.add(direction).toArray();
};

const carrySupportedObjects = (transforms, registry, supportId, from, to) => {
  if (!from?.position || !to?.position) return transforms;
  const support = registry[supportId];
  const turn = (to.rotation?.[1] || 0) - (from.rotation?.[1] || 0);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const carried = { ...transforms };
  Object.entries(transforms).forEach(([childId, child]) => {
    if (childId === supportId || child.supportId !== supportId || !child.position) return;
    const childEntry = registry[childId];
    if (support && childEntry && (support.roomId !== childEntry.roomId || support.coordinateSpace !== childEntry.coordinateSpace)) return;
    const rx = child.position[0] - from.position[0];
    const rz = child.position[2] - from.position[2];
    const rotation = [...(child.rotation || [0, 0, 0])];
    rotation[1] += turn;
    carried[childId] = {
      ...child,
      position: [to.position[0] + rx * cos - rz * sin, child.position[1] + to.position[1] - from.position[1], to.position[2] + rx * sin + rz * cos],
      rotation,
    };
  });
  return carried;
};

export const useExperience = create((set) => ({
  stage: "world",
  mode: "create",
  cameraMode: "studio",
  createCameraAngle: 0,
  createCameraZoom: DEFAULT_CREATE_CAMERA_ZOOM,
  environmentTime: 16.5,
  environmentWeather: "clear",
  renderFidelity: 1,
  activeFloor: null,
  editTransforms: {},
  history: [],
  future: [],
  selectedObjectId: null,
  draggingObjectId: null,
  cameraMotion: null,
  pendingPlacementId: null,
  dragFocus: null,
  dragOrigin: null,
  selectedStructureId: null,
  structureTool: null,
  hiddenStructures: {},
  structureDragOrigin: null,
  roomResizeOrigin: null,
  structureEdits: {},
  hiddenObjects: {},
  objectMeta: {},
  roomMeta: {},
  roomScale: {},
  roomShape: {},
  hiddenRooms: {},
  roofFinish: "terracotta",
  dividerOffset: 0,
  splitRooms: {},
  customRooms: [],
  customObjects: [],
  generatedAssets: [],
  objectRegistry: {},
  selectedRoom: "studio",
  selectedMemory: null,
  hasInteracted: false,
  focusTarget: null,
  focusLook: null,
  focusRoom: (roomId) => {
    const state = useExperience.getState();
    const room = ROOMS.find((item) => item.id === roomId) || state.customRooms.find((item) => item.id === roomId) || ROOMS[0];
    const camera = state.mode === "create" ? createRoomCamera(room, state.createCameraAngle, state.createCameraZoom) : room.camera;
    set({ stage: "world", cameraMode: "room", activeFloor: null, selectedRoom: roomId, focusTarget: camera, focusLook: room.target, hasInteracted: true, selectedMemory: null, selectedObjectId: null, selectedStructureId: null, draggingObjectId: null, dragFocus: null });
  },
  enterRoom: (roomId = "living-room") => {
    const room = ROOMS.find((item) => item.id === roomId) || useExperience.getState().customRooms.find((item) => item.id === roomId) || ROOMS[0];
    set({ stage: "world", cameraMode: "room", activeFloor: null, selectedRoom: roomId, focusTarget: room.camera, focusLook: room.target, hasInteracted: true, selectedMemory: null, selectedObjectId: null, selectedStructureId: null, draggingObjectId: null });
  },
  focusObject: ({ memory, position }) => set({ stage: "world", selectedMemory: memory, focusTarget: [position[0], position[1] + 1.25, position[2] + 2.8], focusLook: position, hasInteracted: true }),
  clearFocus: () => set({ focusTarget: null, focusLook: null }),
  setEnvironmentTime: (environmentTime) => set({ environmentTime: THREE.MathUtils.clamp(Number(environmentTime) || 12, 6, 20), hasInteracted: true }),
  setEnvironmentWeather: (environmentWeather) => set({ environmentWeather: ["clear", "cloudy", "rain"].includes(environmentWeather) ? environmentWeather : "clear", hasInteracted: true }),
  setRenderFidelity: (renderFidelity) => set({ renderFidelity: THREE.MathUtils.clamp(Math.round(Number(renderFidelity) || 0), 0, 2), hasInteracted: true }),
  setCameraMotion: (cameraMotion) => set({ cameraMotion }),
  turnCreateCamera: (direction) => set((state) => {
    const room = ROOMS.find((item) => item.id === state.selectedRoom) || state.customRooms.find((item) => item.id === state.selectedRoom) || ROOMS[0];
    const createCameraAngle = normalizeCreateAngle(state.createCameraAngle + direction);
    return {
      createCameraAngle,
      focusTarget: createRoomCamera(room, createCameraAngle, state.createCameraZoom),
      focusLook: room.target,
      hasInteracted: true,
    };
  }),
  zoomCreateCamera: (direction) => set((state) => {
    const room = ROOMS.find((item) => item.id === state.selectedRoom) || state.customRooms.find((item) => item.id === state.selectedRoom) || ROOMS[0];
    const createCameraZoom = THREE.MathUtils.clamp(state.createCameraZoom + direction * .7, 3.8, 7.4);
    return {
      createCameraZoom,
      focusTarget: createRoomCamera(room, state.createCameraAngle, createCameraZoom),
      focusLook: room.target,
      hasInteracted: true,
    };
  }),
  resetCreateCamera: () => set({
    createCameraAngle: 0,
    createCameraZoom: DEFAULT_CREATE_CAMERA_ZOOM,
    focusTarget: [...HOUSE_CAMERA],
    focusLook: [...HOUSE_LOOK],
    hasInteracted: true,
  }),
  setCameraMode: (cameraMode) => {
    const state = useExperience.getState();
    const poses = {
      house: { position: HOUSE_CAMERA, look: HOUSE_LOOK, selectedRoom: null, activeFloor: null },
      multi: { position: [11.5, 8.5, 14], look: [0, 3, 0], selectedRoom: null, activeFloor: null },
      floor0: { position: [13.5, 13.2, 15.5], look: [0, 0.65, 0], selectedRoom: null, activeFloor: 0 },
      floor1: { position: [13.5, 15.4, 15.5], look: [0, 3.85, 0], selectedRoom: null, activeFloor: 1 },
    };
    const pose = poses[cameraMode] || poses.house;
    set({ stage: "world", cameraMode, selectedRoom: pose.selectedRoom, activeFloor: pose.activeFloor, selectedMemory: null, focusTarget: pose.position, focusLook: pose.look, hasInteracted: true });
  },
  setFloor: (level) => useExperience.getState().setCameraMode(level === 1 ? "floor1" : "floor0"),
  returnHome: () => useExperience.getState().setCameraMode("house"),
  finishEntering: () => set({ stage: "world" }),
  finishReturning: () => set({ stage: "world", selectedRoom: null }),
  selectMemory: (memory) => set({ selectedMemory: memory }),
  closeMemory: () => set({ selectedMemory: null }),
  setMode: (mode) => {
    const state = useExperience.getState();
    const room = ROOMS.find((item) => item.id === state.selectedRoom) || ROOMS[0];
    set({
      mode,
      selectedMemory: null,
      selectedObjectId: null,
      selectedStructureId: null,
      draggingObjectId: null,
      dragFocus: null,
      dragOrigin: null,
      structureDragOrigin: null,
      roomResizeOrigin: null,
      ...(mode === "create" ? {
        cameraMode: "room",
        selectedRoom: room.id,
        activeFloor: null,
        focusTarget: createRoomCamera(room, state.createCameraAngle, state.createCameraZoom),
        focusLook: room.target,
        hasInteracted: true,
      } : {}),
    });
  },
  selectObject: (id, transform) => set((state) => ({
    selectedObjectId: id,
    cameraMotion: null,
    ...(id ? { focusTarget: null, focusLook: null } : {}),
    selectedStructureId: id ? null : state.selectedStructureId,
    // Seed the edit record from the actual instance. This makes the first
    // keyboard nudge operate on the clicked object rather than [0, 0, 0].
    editTransforms: id && transform && !state.editTransforms[id]
      ? { ...state.editTransforms, [id]: { position: transform.position, rotation: transform.rotation || [0, 0, 0] } }
      : state.editTransforms,
  })),
  selectStructure: (id) => set((state) => ({ selectedStructureId: id, selectedObjectId: null, structureTool: id ? state.structureTool : null, selectedRoom: id?.startsWith("room:") ? id.slice(5) : state.selectedRoom })),
  setStructureTool: (structureTool) => set({ structureTool }),
  deleteSelectedStructure: () => set((state) => {
    const id = state.selectedStructureId;
    if (!id || id === "roof" || id === "floor") return state;
    return {
      hiddenStructures: { ...state.hiddenStructures, [id]: true },
      selectedStructureId: null,
      structureTool: null,
      history: [...state.history, { type: "structure-visibility", id, previous: false, next: true }].slice(-50),
      future: [],
    };
  }),
  beginStructureDrag: (id) => set((state) => ({ structureDragOrigin: { id, edit: state.structureEdits[id] || { x: 0, y: 0, z: 0, scaleX: 1, scaleY: 1, scaleZ: 1 }, dividerOffset: state.dividerOffset } })),
  commitStructureDrag: (id) => set((state) => {
    const origin = state.structureDragOrigin;
    if (!origin || origin.id !== id) return { structureDragOrigin: null };
    const current = state.structureEdits[id] || { x: 0, y: 0, z: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };
    const changed = JSON.stringify(origin.edit) !== JSON.stringify(current) || (id === "divider" && origin.dividerOffset !== state.dividerOffset);
    return { structureDragOrigin: null, history: changed ? [...state.history, id === "divider" ? { type: "divider", previous: origin.dividerOffset, next: state.dividerOffset } : { type: "structure", id, previous: origin.edit, next: current }].slice(-50) : state.history, future: changed ? [] : state.future };
  }),
  nudgeStructure: (id, axis, amount, transient = false) => set((state) => {
    if (id === "divider" && axis === "x") {
      const previous = state.dividerOffset;
      const next = Math.max(-1.1, Math.min(1.1, Math.round((previous + amount) * 4) / 4));
      return transient ? { dividerOffset: next } : { dividerOffset: next, history: [...state.history, { type: "divider", previous, next }].slice(-50), future: [] };
    }
    const previous = state.structureEdits[id] || { x: 0, y: 0, z: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };
    const base = Number.isFinite(previous[axis]) ? previous[axis] : (axis.startsWith("scale") ? 1 : 0);
    const next = { ...previous, [axis]: axis.startsWith("scale") ? Math.max(.35, Math.min(2.5, base + amount)) : base + amount };
    return transient ? { structureEdits: { ...state.structureEdits, [id]: next } } : { structureEdits: { ...state.structureEdits, [id]: next }, history: [...state.history, { type: "structure", id, previous, next }].slice(-50), future: [] };
  }),
  setDraggingObject: (id) => set({ draggingObjectId: id, dragFocus: id ? useExperience.getState().dragFocus : null }),
  setDragFocus: (position) => set({ dragFocus: position }),
  registerObject: (id, payload) => set((state) => ({ objectRegistry: { ...state.objectRegistry, [id]: payload } })),
  unregisterObject: (id) => set((state) => { const { [id]: _removed, ...objectRegistry } = state.objectRegistry; return { objectRegistry }; }),
  beginObjectDrag: (id) => set((state) => ({
    draggingObjectId: id,
    dragFocus: null,
    dragOrigin: { id, transform: state.editTransforms[id] || { position: null, rotation: [0, 0, 0] } },
  })),
  focusSelection: ({ position, cameraPosition, extent = 1 }) => set(() => {
    const state = useExperience.getState();
    const look = new THREE.Vector3(...position);
    const current = new THREE.Vector3(...(cameraPosition || state.focusTarget || HOUSE_CAMERA));
    const direction = current.sub(look).setY(Math.max(.24, current.y - look.y)).normalize();
    const distance = Math.max(2.15, Math.min(4.6, extent * 2.65));
    const target = look.clone().add(direction.multiplyScalar(distance));
    target.y = Math.max(1.25, target.y + .45);
    return { focusTarget: target.toArray(), focusLook: [look.x, look.y + Math.min(.45, extent * .25), look.z] };
  }),
  applyEdit: ({ id, roomId, position, rotation, supportId = null, transient = false }) => set((state) => {
    const previous = state.editTransforms[id] || { position: null, rotation: [0, 0, 0] };
    const entry = state.objectRegistry[id];
    let snapped = position ? [...position] : previous.position;
    if (snapped) {
      const angle = (rotation || previous.rotation || [0, 0, 0])[1] || 0;
      const footprint = entry?.footprint || [.8, .8];
      const halfX = (Math.abs(Math.cos(angle)) * footprint[0] + Math.abs(Math.sin(angle)) * footprint[1]) * .5;
      const halfZ = (Math.abs(Math.sin(angle)) * footprint[0] + Math.abs(Math.cos(angle)) * footprint[1]) * .5;
      const room = ROOMS.find((item) => item.id === roomId) || ROOMS[0];
      const centerX = entry?.coordinateSpace === "world" ? room.position[0] : 0;
      const centerZ = entry?.coordinateSpace === "world" ? room.position[2] : 0;
      snapped[0] = Math.max(centerX - FLOOR_BOUNDS.x + halfX, Math.min(centerX + FLOOR_BOUNDS.x - halfX, snapped[0]));
      snapped[2] = Math.max(centerZ - FLOOR_BOUNDS.z + halfZ, Math.min(centerZ + FLOOR_BOUNDS.z - halfZ, snapped[2]));

      if (entry?.parentMatrix) {
        const matrix = new THREE.Matrix4().fromArray(entry.parentMatrix);
        const inverse = matrix.clone().invert();
        const candidateWorld = new THREE.Vector3(...snapped).applyMatrix4(matrix);
        const candidateMinY = candidateWorld.y - (entry.worldBaseLift || 0);
        const candidateMaxY = candidateMinY + (entry.worldHeight || 1);
        const worldAngle = angle;
        const worldSize = entry.worldFootprint || footprint;
        const candidateHalfX = (Math.abs(Math.cos(worldAngle)) * worldSize[0] + Math.abs(Math.sin(worldAngle)) * worldSize[1]) * .5;
        const candidateHalfZ = (Math.abs(Math.sin(worldAngle)) * worldSize[0] + Math.abs(Math.cos(worldAngle)) * worldSize[1]) * .5;
        Object.entries(state.objectRegistry).forEach(([otherId, other]) => {
          if (otherId === id || otherId === supportId || state.hiddenObjects[otherId] || (roomId && other.roomId !== roomId) || !other.parentMatrix) return;
          const otherLocal = state.editTransforms[otherId]?.position || other.position;
          if (!otherLocal) return;
          const otherWorld = new THREE.Vector3(...otherLocal).applyMatrix4(new THREE.Matrix4().fromArray(other.parentMatrix));
          const otherMinY = otherWorld.y - (other.worldBaseLift || 0);
          const otherMaxY = otherMinY + (other.worldHeight || 1);
          if (candidateMaxY <= otherMinY + .035 || candidateMinY >= otherMaxY - .035) return;
          const otherRotation = state.editTransforms[otherId]?.rotation || other.rotation || [0, 0, 0];
          const otherAngle = otherRotation[1] || 0;
          const otherSize = other.worldFootprint || [.8, .8];
          const otherHalfX = (Math.abs(Math.cos(otherAngle)) * otherSize[0] + Math.abs(Math.sin(otherAngle)) * otherSize[1]) * .5;
          const otherHalfZ = (Math.abs(Math.sin(otherAngle)) * otherSize[0] + Math.abs(Math.cos(otherAngle)) * otherSize[1]) * .5;
          const dx = candidateWorld.x - otherWorld.x;
          const dz = candidateWorld.z - otherWorld.z;
          const overlapX = candidateHalfX + otherHalfX + .045 - Math.abs(dx);
          const overlapZ = candidateHalfZ + otherHalfZ + .045 - Math.abs(dz);
          if (overlapX <= 0 || overlapZ <= 0) return;
          if (overlapX < overlapZ) candidateWorld.x += (dx >= 0 ? 1 : -1) * overlapX;
          else candidateWorld.z += (dz >= 0 ? 1 : -1) * overlapZ;
        });
        snapped = candidateWorld.applyMatrix4(inverse).toArray();
      }
      snapped[0] = Math.round(snapped[0] * 20) / 20;
      snapped[1] = Math.round(snapped[1] * 100) / 100;
      snapped[2] = Math.round(snapped[2] * 20) / 20;
    }
    const nextValue = { position: snapped, rotation: rotation || previous.rotation, supportId };
    const previousResolved = { ...previous, position: previous.position || entry?.position, rotation: previous.rotation || entry?.rotation || [0, 0, 0] };
    let next = { ...state.editTransforms, [id]: nextValue };
    next = carrySupportedObjects(next, state.objectRegistry, id, previousResolved, nextValue);
    if (transient) return { editTransforms: next };
    return { editTransforms: next, history: [...state.history, { type: "transform", id, previous: previousResolved, next: nextValue }].slice(-50), future: [] };
  }),
  commitObjectDrag: (id, position, rotation) => set((state) => {
    const origin = state.dragOrigin?.id === id ? state.dragOrigin.transform : state.editTransforms[id] || { position: null, rotation: [0, 0, 0] };
    const next = state.editTransforms[id] || origin;
    const changed = JSON.stringify(origin) !== JSON.stringify(next);
    return {
      draggingObjectId: null,
      dragFocus: null,
      dragOrigin: null,
      pendingPlacementId: state.pendingPlacementId === id ? null : state.pendingPlacementId,
      history: changed ? [...state.history, { type: "transform", id, previous: origin, next }].slice(-50) : state.history,
      future: changed ? [] : state.future,
    };
  }),
  undo: () => set((state) => {
    const action = state.history.at(-1); if (!action) return state;
    if (action.type === "room-add") return { customRooms: state.customRooms.filter((room) => room.id !== action.room.id), selectedRoom: null, history: state.history.slice(0, -1), future: [action, ...state.future] };
    if (action.type === "room-split") return { splitRooms: action.previous.splitRooms, dividerOffset: action.previous.dividerOffset, roomMeta: action.previous.roomMeta, history: state.history.slice(0, -1), future: [action, ...state.future] };
    if (action.type === "room-merge") return { hiddenRooms: action.previous.hiddenRooms, roomMeta: action.previous.roomMeta, history: state.history.slice(0, -1), future: [action, ...state.future] };
    if (action.type === "divider") return { dividerOffset: action.previous, history: state.history.slice(0, -1), future: [action, ...state.future] };
    if (action.type === "room-visibility") return { hiddenRooms: { ...state.hiddenRooms, [action.roomId]: action.previous }, history: state.history.slice(0, -1), future: [action, ...state.future] };
    if (action.type === "structure-visibility") return { hiddenStructures: { ...state.hiddenStructures, [action.id]: action.previous }, history: state.history.slice(0, -1), future: [action, ...state.future] };
    if (action.type === "object-meta") return { objectMeta: { ...state.objectMeta, [action.id]: action.previous }, history: state.history.slice(0, -1), future: [action, ...state.future] };
    if (action.type === "replace") return { customObjects: state.customObjects.map((item) => item.id === action.id ? action.previous : item), objectMeta: { ...state.objectMeta, [action.id]: { name: action.previous.name } }, history: state.history.slice(0, -1), future: [action, ...state.future] };
    if (action.type === "roof-finish") return { roofFinish: action.previous, history: state.history.slice(0, -1), future: [action, ...state.future] };
    if (action.type === "room-scale") return { roomScale: { ...state.roomScale, [action.roomId]: action.previous }, history: state.history.slice(0, -1), future: [action, ...state.future] };
    if (action.type === "room-shape") return { roomShape: { ...state.roomShape, [action.roomId]: action.previous }, history: state.history.slice(0, -1), future: [action, ...state.future] };
    if (action.type === "room-meta") return { roomMeta: { ...state.roomMeta, [action.roomId]: action.previous }, history: state.history.slice(0, -1), future: [action, ...state.future] };
    if (action.type === "duplicate") { const { [action.copy.id]: _transform, ...editTransforms } = state.editTransforms; const { [action.copy.id]: _meta, ...objectMeta } = state.objectMeta; const { [action.copy.id]: _hidden, ...hiddenObjects } = state.hiddenObjects; return { customObjects: state.customObjects.filter((item) => item.id !== action.copy.id), editTransforms, objectMeta, hiddenObjects, selectedObjectId: null, history: state.history.slice(0, -1), future: [action, ...state.future] }; }
    if (action.type === "visibility") return { hiddenObjects: { ...state.hiddenObjects, [action.id]: action.previous }, history: state.history.slice(0, -1), future: [action, ...state.future] };
    let editTransforms = { ...state.editTransforms, [action.id]: action.previous };
    if (action.type === "transform") editTransforms = carrySupportedObjects(editTransforms, state.objectRegistry, action.id, action.next, action.previous);
    return { editTransforms, history: state.history.slice(0, -1), future: [action, ...state.future] };
  }),
  redo: () => set((state) => {
    const action = state.future[0]; if (!action) return state;
    if (action.type === "room-add") return { customRooms: [...state.customRooms, action.room], selectedRoom: action.room.id, history: [...state.history, action], future: state.future.slice(1) };
    if (action.type === "room-split") return { splitRooms: action.next.splitRooms, dividerOffset: action.next.dividerOffset, roomMeta: action.next.roomMeta, history: [...state.history, action], future: state.future.slice(1) };
    if (action.type === "room-merge") return { hiddenRooms: action.next.hiddenRooms, roomMeta: action.next.roomMeta, history: [...state.history, action], future: state.future.slice(1) };
    if (action.type === "divider") return { dividerOffset: action.next, history: [...state.history, action], future: state.future.slice(1) };
    if (action.type === "room-visibility") return { hiddenRooms: { ...state.hiddenRooms, [action.roomId]: action.next }, history: [...state.history, action], future: state.future.slice(1) };
    if (action.type === "structure-visibility") return { hiddenStructures: { ...state.hiddenStructures, [action.id]: action.next }, selectedStructureId: action.next ? null : state.selectedStructureId, history: [...state.history, action], future: state.future.slice(1) };
    if (action.type === "object-meta") return { objectMeta: { ...state.objectMeta, [action.id]: action.next }, history: [...state.history, action], future: state.future.slice(1) };
    if (action.type === "replace") return { customObjects: state.customObjects.map((item) => item.id === action.id ? action.next : item), objectMeta: { ...state.objectMeta, [action.id]: { name: action.next.name } }, history: [...state.history, action], future: state.future.slice(1) };
    if (action.type === "roof-finish") return { roofFinish: action.next, history: [...state.history, action], future: state.future.slice(1) };
    if (action.type === "room-scale") return { roomScale: { ...state.roomScale, [action.roomId]: action.next }, history: [...state.history, action], future: state.future.slice(1) };
    if (action.type === "room-shape") return { roomShape: { ...state.roomShape, [action.roomId]: action.next }, history: [...state.history, action], future: state.future.slice(1) };
    if (action.type === "room-meta") return { roomMeta: { ...state.roomMeta, [action.roomId]: action.next }, history: [...state.history, action], future: state.future.slice(1) };
    if (action.type === "duplicate") return { customObjects: [...state.customObjects, action.copy], editTransforms: { ...state.editTransforms, [action.copy.id]: { position: action.copy.position, rotation: action.copy.rotation } }, objectMeta: { ...state.objectMeta, [action.copy.id]: action.copy.meta || { name: action.copy.name } }, selectedObjectId: action.copy.id, history: [...state.history, action], future: state.future.slice(1) };
    if (action.type === "visibility") return { hiddenObjects: { ...state.hiddenObjects, [action.id]: action.next }, selectedObjectId: action.next ? null : state.selectedObjectId, history: [...state.history, action], future: state.future.slice(1) };
    let editTransforms = { ...state.editTransforms, [action.id]: action.next };
    if (action.type === "transform") editTransforms = carrySupportedObjects(editTransforms, state.objectRegistry, action.id, action.previous, action.next);
    return { editTransforms, history: [...state.history, action], future: state.future.slice(1) };
  }),
  rotateSelected: () => set((state) => {
    const id = state.selectedObjectId; if (!id) return state;
    const current = state.editTransforms[id] || { position: null, rotation: [0, 0, 0] };
    const rotation = [...current.rotation]; rotation[1] += Math.PI / 2;
    const previous = current; const nextValue = { ...current, rotation };
    return { editTransforms: { ...state.editTransforms, [id]: nextValue }, history: [...state.history, { id, previous, next: nextValue }].slice(-50), future: [] };
  }),
  nudgeSelected: (dx, dz) => {
    const state = useExperience.getState();
    const id = state.selectedObjectId; if (!id) return;
    const current = state.editTransforms[id] || { position: null, rotation: [0, 0, 0] };
    const base = current.position || state.objectRegistry[id]?.position || [0, .25, 0];
    const roomId = ROOMS.some((room) => room.id === id.split(":")[0]) ? id.split(":")[0] : state.objectRegistry[id]?.roomId || null;
    state.applyEdit({ id, roomId, position: [base[0] + dx, base[1], base[2] + dz], rotation: current.rotation, transient: false });
  },
  deleteSelected: () => set((state) => {
    const id = state.selectedObjectId; if (!id) return state;
    return { hiddenObjects: { ...state.hiddenObjects, [id]: true }, selectedObjectId: null, pendingPlacementId: state.pendingPlacementId === id ? null : state.pendingPlacementId, history: [...state.history, { type: "visibility", id, previous: false, next: true }].slice(-50), future: [] };
  }),
  cancelCurrentAction: () => set((state) => {
    if (state.pendingPlacementId) {
      const id = state.pendingPlacementId;
      const { [id]: _transform, ...editTransforms } = state.editTransforms;
      const { [id]: _meta, ...objectMeta } = state.objectMeta;
      const { [id]: _hidden, ...hiddenObjects } = state.hiddenObjects;
      return {
        customObjects: state.customObjects.filter((item) => item.id !== id),
        editTransforms,
        objectMeta,
        hiddenObjects,
        pendingPlacementId: null,
        selectedObjectId: null,
        draggingObjectId: null,
        dragFocus: null,
        dragOrigin: null,
      };
    }
    if (state.dragOrigin?.id) {
      return {
        editTransforms: { ...state.editTransforms, [state.dragOrigin.id]: state.dragOrigin.transform },
        draggingObjectId: null,
        dragFocus: null,
        dragOrigin: null,
      };
    }
    return { selectedObjectId: null, selectedStructureId: null, structureTool: null };
  }),
  confirmPlacement: () => set((state) => ({ pendingPlacementId: null, selectedObjectId: state.pendingPlacementId || state.selectedObjectId })),
  renameSelected: (name) => set((state) => {
    const id = state.selectedObjectId; if (!id || !name.trim()) return state;
    const previous = state.objectMeta[id] || {};
    const next = { ...previous, name: name.trim() };
    return { objectMeta: { ...state.objectMeta, [id]: next }, history: [...state.history, { type: "object-meta", id, previous, next }].slice(-50), future: [] };
  }),
  setObjectCategory: (category) => set((state) => {
    const id = state.selectedObjectId; if (!id) return state;
    const previous = state.objectMeta[id] || {};
    const next = { ...previous, category };
    return { objectMeta: { ...state.objectMeta, [id]: next }, history: [...state.history, { type: "object-meta", id, previous, next }].slice(-50), future: [] };
  }),
  renameRoom: (roomId, name) => set((state) => {
    if (!roomId || !name.trim()) return state;
    const previous = state.roomMeta[roomId] || {};
    const next = { ...previous, name: name.trim() };
    if (next.name === previous.name) return state;
    return { roomMeta: { ...state.roomMeta, [roomId]: next }, history: [...state.history, { type: "room-meta", roomId, previous, next }].slice(-50), future: [] };
  }),
  setRoomAccent: (roomId, accent) => set((state) => {
    const previous = state.roomMeta[roomId] || {};
    const next = { ...previous, accent };
    if (next.accent === previous.accent) return state;
    return { roomMeta: { ...state.roomMeta, [roomId]: next }, history: [...state.history, { type: "room-meta", roomId, previous, next }].slice(-50), future: [] };
  }),
  resizeRoom: (roomId, delta, transient = false) => set((state) => {
    if (!roomId) return state;
    const previous = state.roomScale[roomId] || 1;
    const next = Math.min(1.18, Math.max(.86, Math.round((previous + delta) * 100) / 100));
    if (next === previous) return state;
    return transient ? { roomScale: { ...state.roomScale, [roomId]: next } } : { roomScale: { ...state.roomScale, [roomId]: next }, history: [...state.history, { type: "room-scale", roomId, previous, next }].slice(-50), future: [] };
  }),
  resizeRoomAxis: (roomId, axis, delta, transient = false) => set((state) => {
    if (!roomId || !["x", "z"].includes(axis)) return state;
    const previous = state.roomShape[roomId] || { x: 1, z: 1 };
    const next = { ...previous, [axis]: Math.min(1.3, Math.max(.72, Math.round((previous[axis] + delta) * 100) / 100)) };
    if (next[axis] === previous[axis]) return state;
    return transient ? { roomShape: { ...state.roomShape, [roomId]: next } } : { roomShape: { ...state.roomShape, [roomId]: next }, history: [...state.history, { type: "room-shape", roomId, previous, next }].slice(-50), future: [] };
  }),
  beginRoomResize: (roomId) => set((state) => ({ roomResizeOrigin: { roomId, scale: state.roomScale[roomId] || 1, shape: state.roomShape[roomId] || { x: 1, z: 1 } } })),
  commitRoomResize: (roomId) => set((state) => {
    const origin = state.roomResizeOrigin;
    if (!origin || origin.roomId !== roomId) return { roomResizeOrigin: null };
    const next = state.roomScale[roomId] || 1;
    const nextShape = state.roomShape[roomId] || { x: 1, z: 1 };
    if (next === origin.scale && JSON.stringify(nextShape) === JSON.stringify(origin.shape)) return { roomResizeOrigin: null };
    const history = [...state.history];
    if (next !== origin.scale) history.push({ type: "room-scale", roomId, previous: origin.scale, next });
    if (JSON.stringify(nextShape) !== JSON.stringify(origin.shape)) history.push({ type: "room-shape", roomId, previous: origin.shape, next: nextShape });
    return { roomResizeOrigin: null, history: history.slice(-50), future: [] };
  }),
  setRoofFinish: (finish) => set((state) => {
    const previous = state.roofFinish;
    if (previous === finish) return state;
    return { roofFinish: finish, history: [...state.history, { type: "roof-finish", previous, next: finish }].slice(-50), future: [] };
  }),
  toggleRoom: (roomId) => set((state) => {
    if (!roomId) return state;
    const previous = Boolean(state.hiddenRooms[roomId]); const next = !previous;
    return { hiddenRooms: { ...state.hiddenRooms, [roomId]: next }, history: [...state.history, { type: "room-visibility", roomId, previous, next }].slice(-50), future: [] };
  }),
  mergeSelectedRoom: () => set((state) => {
    const index = ROOMS.findIndex((room) => room.id === state.selectedRoom); if (index < 0 || index === ROOMS.length - 1) return state;
    const first = ROOMS[index]; const second = ROOMS[index + 1];
    const previous = { hiddenRooms: state.hiddenRooms, roomMeta: state.roomMeta };
    const hiddenRooms = { ...state.hiddenRooms, [second.id]: true };
    const roomMeta = { ...state.roomMeta, [first.id]: { ...(state.roomMeta[first.id] || {}), name: `${state.roomMeta[first.id]?.name || first.name} + ${state.roomMeta[second.id]?.name || second.name}` } };
    return { hiddenRooms, roomMeta, history: [...state.history, { type: "room-merge", first: first.id, second: second.id, previous, next: { hiddenRooms, roomMeta } }].slice(-50), future: [] };
  }),
  splitSelectedRoom: () => set((state) => {
    const roomId = state.selectedRoom; if (!roomId) return state;
    const previous = { splitRooms: state.splitRooms, dividerOffset: state.dividerOffset, roomMeta: state.roomMeta };
    const splitRooms = { ...state.splitRooms, [roomId]: true };
    const roomMeta = { ...state.roomMeta, [roomId]: { ...(state.roomMeta[roomId] || {}), name: `${state.roomMeta[roomId]?.name || ROOMS.find((r) => r.id === roomId)?.name || roomId} / New room` } };
    const next = { splitRooms, dividerOffset: state.dividerOffset || .5, roomMeta };
    return { ...next, history: [...state.history, { type: "room-split", previous, next }].slice(-50), future: [] };
  }),
  addRoom: () => set((state) => {
    const anchor = ROOMS.find((room) => room.id === state.selectedRoom) || ROOMS[0];
    const id = `room-${Date.now().toString(36)}`;
    const room = { id, name: "New room", floor: anchor.floor, level: anchor.level, position: [anchor.position[0] + 2.55, anchor.position[1], anchor.position[2]], camera: [anchor.camera[0] + 2.55, anchor.camera[1], anchor.camera[2]], target: [anchor.target[0] + 2.55, anchor.target[1], anchor.target[2]], side: anchor.side, custom: true };
    return { customRooms: [...state.customRooms, room], selectedRoom: id, hasInteracted: true, history: [...state.history, { type: "room-add", room }].slice(-50), future: [] };
  }),
  moveDivider: (delta) => set((state) => {
    const previous = state.dividerOffset; const next = Math.max(-1.1, Math.min(1.1, Math.round((previous + delta) * 4) / 4));
    if (next === previous) return state;
    return { dividerOffset: next, history: [...state.history, { type: "divider", previous, next }].slice(-50), future: [] };
  }),
  saveLayout: () => set((state) => {
    const payload = { version: 2, editTransforms: state.editTransforms, structureEdits: state.structureEdits, customObjects: state.customObjects, generatedAssets: state.generatedAssets, objectMeta: state.objectMeta, hiddenObjects: state.hiddenObjects, hiddenStructures: state.hiddenStructures, roomMeta: state.roomMeta, roomScale: state.roomScale, roomShape: state.roomShape, hiddenRooms: state.hiddenRooms, roofFinish: state.roofFinish, dividerOffset: state.dividerOffset, splitRooms: state.splitRooms, customRooms: state.customRooms, mode: state.mode, selectedRoom: state.selectedRoom, cameraMode: state.cameraMode, activeFloor: state.activeFloor, environmentTime: state.environmentTime, environmentWeather: state.environmentWeather, renderFidelity: state.renderFidelity };
    localStorage.setItem("household-memory-layout", JSON.stringify(payload));
    return { hasInteracted: true };
  }),
  loadLayout: () => set((state) => {
    try {
      const parsed = JSON.parse(localStorage.getItem("household-memory-layout") || "null");
      const payload = parsed?.version === 1 ? { ...parsed, version: 2, structureEdits: parsed.structureEdits || {} } : parsed;
      const isRecord = (value) => value && typeof value === "object" && !Array.isArray(value);
      const valid = isRecord(payload) && payload.version === 2 && isRecord(payload.editTransforms) && isRecord(payload.structureEdits) && Array.isArray(payload.customObjects) && (!payload.generatedAssets || Array.isArray(payload.generatedAssets)) && isRecord(payload.objectMeta) && isRecord(payload.hiddenObjects) && (!payload.hiddenStructures || isRecord(payload.hiddenStructures)) && isRecord(payload.roomMeta) && isRecord(payload.roomScale) && (!payload.roomShape || isRecord(payload.roomShape)) && isRecord(payload.hiddenRooms) && ["terracotta", "sage", "navy"].includes(payload.roofFinish) && Number.isFinite(payload.dividerOffset) && isRecord(payload.splitRooms) && Array.isArray(payload.customRooms) && ["explore", "create"].includes(payload.mode);
      if (!valid) { localStorage.removeItem("household-memory-layout"); return state; }
      return { ...state, ...payload, generatedAssets: payload.generatedAssets || [], roomShape: payload.roomShape || {}, hiddenStructures: payload.hiddenStructures || {}, environmentTime: Number.isFinite(payload.environmentTime) ? THREE.MathUtils.clamp(payload.environmentTime, 6, 20) : state.environmentTime, environmentWeather: ["clear", "cloudy", "rain"].includes(payload.environmentWeather) ? payload.environmentWeather : state.environmentWeather, renderFidelity: Number.isFinite(payload.renderFidelity) ? THREE.MathUtils.clamp(Math.round(payload.renderFidelity), 0, 2) : state.renderFidelity, dividerOffset: Math.max(-1.1, Math.min(1.1, payload.dividerOffset)), history: [], future: [], selectedObjectId: null, selectedStructureId: null, selectedMemory: null, draggingObjectId: null, pendingPlacementId: null, dragOrigin: null };
    } catch { return state; }
  }),
  duplicateSelected: () => set((state) => {
    const source = state.selectedObjectId; if (!source) return state;
    const sourceTransform = state.editTransforms[source] || { position: null, rotation: [0, 0, 0] };
    const sourceMeta = state.objectMeta[source] || {};
    const sourceCopy = state.customObjects.find((item) => item.id === source);
    const rawKind = sourceCopy?.kind || state.objectRegistry[source]?.kind;
    const kind = GENERATED_KIND_ALIASES[rawKind] || rawKind;
    if (!kind) return state;
    const variant = nextObjectVariant(state, kind, sourceCopy?.variant ?? 0);
    const id = `${source}-copy-${Date.now().toString(36)}`;
    const position = sourceTransform.position ? [sourceTransform.position[0] + .5, sourceTransform.position[1], sourceTransform.position[2] + .5] : null;
    const baseName = sourceMeta.name || sourceCopy?.name || source;
    const name = `${baseName} · variation ${variant + 1}`;
    const copy = { ...(sourceCopy || {}), id, sourceId: source, roomId: sourceCopy?.roomId || state.selectedRoom || null, kind, variant, position, rotation: sourceTransform.rotation, name, meta: { ...sourceMeta, name } };
    return { customObjects: [...state.customObjects, copy], editTransforms: { ...state.editTransforms, [id]: { position, rotation: copy.rotation } }, objectMeta: { ...state.objectMeta, [id]: copy.meta }, selectedObjectId: id, history: [...state.history, { type: "duplicate", copy }].slice(-50), future: [] };
  }),
  addLibraryObject: (item) => set((state) => {
    const kind = typeof item === "string" ? item : item?.kind;
    if (!kind) return state;
    const displayName = typeof item === "string" ? `${item[0].toUpperCase()}${item.slice(1)} piece` : item.name || `${kind[0].toUpperCase()}${kind.slice(1)} piece`;
    const room = ROOMS.find((item) => item.id === state.selectedRoom) || ROOMS[0];
    const id = `library-piece-${Date.now().toString(36)}`;
    const position = [room.position[0], room.position[1] + .25, room.position[2] + 1.65];
    const requestedVariant = typeof item === "object" ? item.variant : null;
    const variant = Number.isFinite(requestedVariant) ? normalizeObjectVariant(requestedVariant) : nextObjectVariant(state, kind);
    const copy = {
      id,
      sourceId: typeof item === "object" && item.assetId ? item.assetId : `library-${kind}`,
      roomId: room.id,
      kind,
      variant,
      position,
      rotation: [0, 0, 0],
      name: displayName,
      ...(typeof item === "object" ? {
        description: item.description,
        source: item.source,
        finish: item.finish,
        collection: item.collection,
        assetId: item.assetId,
        generationSeed: item.generationSeed,
        category: item.category,
        evidence: item.evidence,
        objectDNA: item.objectDNA,
        validationReport: item.validationReport,
        pipeline: item.pipeline,
      } : {}),
    };
    return { customObjects: [...state.customObjects, copy], editTransforms: { ...state.editTransforms, [id]: { position, rotation: copy.rotation } }, objectMeta: { ...state.objectMeta, [id]: { name: copy.name } }, selectedObjectId: id, pendingPlacementId: id, hasInteracted: true, history: [...state.history, { type: "duplicate", copy }].slice(-50), future: [] };
  }),
  addGeneratedObject: (item) => {
    const assetId = item.assetId || `generated-asset-${Date.now().toString(36)}`;
    const asset = { ...item, id: assetId, assetId, collection: "generated" };
    set((state) => ({
      generatedAssets: [asset, ...state.generatedAssets.filter((entry) => entry.id !== assetId)],
    }));
    useExperience.getState().addLibraryObject(asset);
  },
  replaceSelected: (kind) => set((state) => {
    const id = state.selectedObjectId; const copy = state.customObjects.find((item) => item.id === id);
    if (!copy || !kind || copy.kind === kind) return state;
    const previous = { ...copy }; const next = { ...copy, kind, variant: nextObjectVariant(state, kind), sourceId: `library-${kind}`, name: `${kind[0].toUpperCase()}${kind.slice(1)} piece` };
    return { customObjects: state.customObjects.map((item) => item.id === id ? next : item), objectMeta: { ...state.objectMeta, [id]: { ...(state.objectMeta[id] || {}), name: next.name } }, history: [...state.history, { type: "replace", id, previous, next }].slice(-50), future: [] };
  }),
}));
