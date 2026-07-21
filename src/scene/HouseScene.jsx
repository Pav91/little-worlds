import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls, RoundedBox, Text } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { shared } from "./materials.js";
import { PersistentRooms } from "../rooms/Rooms.jsx";
import { Interactive } from "./Objects.jsx";
import { ROOMS, transition, useExperience } from "../state/experience.js";

const smoothstep = (v) => v * v * (3 - 2 * v);
const segment = (v, start, end) => smoothstep(THREE.MathUtils.clamp((v - start) / (end - start), 0, 1));
const MINI_TARGET = new THREE.Vector3(0, 3, 0);
const DEFAULT_MINI = new THREE.Vector3(15, 11, 17);

const selectedWorldPosition = (id, registry, transforms, target) => {
  if (!id) return null;
  const entry = registry[id];
  const position = transforms[id]?.position || entry?.position;
  if (!entry || !position) return null;
  target.set(...position);
  if (entry.parentMatrix) target.applyMatrix4(new THREE.Matrix4().fromArray(entry.parentMatrix));
  return target.toArray();
};

function CameraRig({ controlsRef }) {
  const { camera, invalidate, scene } = useThree();
  const focusTarget = useExperience((s) => s.focusTarget);
  const focusLook = useExperience((s) => s.focusLook);
  const selectedRoom = useExperience((s) => s.selectedRoom);
  const selectedObjectId = useExperience((s) => s.selectedObjectId);
  const mode = useExperience((s) => s.mode);
  const clearFocus = useExperience((s) => s.clearFocus);
  const focusClock = useRef(0);
  const activeFocus = useRef(null);
  const position = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const colliderBounds = useMemo(() => new THREE.Box3(), []);
  const isCameraCollider = (object) => {
    let node = object;
    while (node) {
      if (node.userData?.interactiveObjectId === selectedObjectId) return false;
      if (node.userData?.cameraCollider) return true;
      node = node.parent;
    }
    return false;
  };
  useEffect(() => {
    if (focusTarget && focusLook) invalidate();
  }, [focusTarget, focusLook, invalidate]);
  useFrame((_, dt) => {
    const controls = controlsRef.current;
    if (focusTarget && focusLook) {
      if (activeFocus.current !== focusTarget) { activeFocus.current = focusTarget; focusClock.current = 0; }
      focusClock.current += dt;
      position.set(...focusTarget);
      target.set(...focusLook);
      camera.position.lerp(position, 1 - Math.exp(-dt * 3.2));
      if (controls) {
        controls.target.lerp(target, 1 - Math.exp(-dt * 3.2));
        const minimum = selectedRoom ? (mode === "create" ? .9 : 3.2) : 2.4;
        offset.copy(camera.position).sub(controls.target);
        if (offset.length() < minimum) camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(minimum));
        controls.update();
      }
      if (focusClock.current > 1.45) clearFocus();
      else invalidate();
    }
    if (controls) {
      if (mode === "create" && selectedRoom) {
        const padding = .16;
        scene.traverse((object) => {
          if (!object.isMesh || !object.visible || !isCameraCollider(object)) return;
          colliderBounds.setFromObject(object).expandByScalar(padding);
          if (!colliderBounds.containsPoint(camera.position)) return;
          const distances = [
            { axis: "x", value: colliderBounds.min.x, distance: camera.position.x - colliderBounds.min.x },
            { axis: "x", value: colliderBounds.max.x, distance: colliderBounds.max.x - camera.position.x },
            { axis: "y", value: colliderBounds.min.y, distance: camera.position.y - colliderBounds.min.y },
            { axis: "y", value: colliderBounds.max.y, distance: colliderBounds.max.y - camera.position.y },
            { axis: "z", value: colliderBounds.min.z, distance: camera.position.z - colliderBounds.min.z },
            { axis: "z", value: colliderBounds.max.z, distance: colliderBounds.max.z - camera.position.z },
          ];
          distances.sort((a, b) => a.distance - b.distance);
          camera.position[distances[0].axis] = distances[0].value;
        });
        camera.position.y = Math.max(.52, camera.position.y);
      }
      const distance = camera.position.distanceTo(controls.target);
      const openness = THREE.MathUtils.clamp((14.2 - distance) / 9.2, 0, 1);
      transition.value = THREE.MathUtils.damp(transition.value, openness, 3.8, dt);
      const targetFov = mode === "create" && selectedRoom ? THREE.MathUtils.lerp(42, 51, THREE.MathUtils.clamp((3.4 - distance) / 2.4, 0, 1)) : THREE.MathUtils.lerp(36, 54, openness);
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6.5, dt);
      camera.updateProjectionMatrix();
      if (Math.abs(openness - transition.value) > .001) invalidate();
    }
  });
  return null;
}

function StructuralBeam({ args, position, material = shared.timber, radius = .06 }) {
  return <RoundedBox args={args} position={position} radius={radius} smoothness={2} material={material} castShadow receiveShadow />;
}

function EditableFloor() {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pointerY = useRef(0);
  const mode = useExperience((s) => s.mode);
  const selectedStructureId = useExperience((s) => s.selectedStructureId);
  const structureEdits = useExperience((s) => s.structureEdits);
  const selectStructure = useExperience((s) => s.selectStructure);
  const beginStructureDrag = useExperience((s) => s.beginStructureDrag);
  const commitStructureDrag = useExperience((s) => s.commitStructureDrag);
  const nudgeStructure = useExperience((s) => s.nudgeStructure);
  const edit = structureEdits.floor || { x: 0, y: 0, z: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };
  const active = selectedStructureId === "floor";
  const startFloorDrag = (event) => {
    if (mode !== "create" || event.button !== 0) return;
    event.stopPropagation();
    event.target.setPointerCapture?.(event.pointerId);
    pointerY.current = event.clientY ?? event.nativeEvent?.clientY ?? 0;
    selectStructure("floor");
    beginStructureDrag("floor");
    setDragging(true);
    document.body.style.cursor = "grabbing";
  };
  const moveFloor = (event) => {
    if (!dragging) return;
    event.stopPropagation();
    const nextY = event.clientY ?? event.nativeEvent?.clientY ?? pointerY.current;
    const dy = nextY - pointerY.current;
    pointerY.current = nextY;
    nudgeStructure("floor", "y", -dy * .009, true);
  };
  const endFloorDrag = (event) => {
    if (!dragging) return;
    event.stopPropagation();
    event.target.releasePointerCapture?.(event.pointerId);
    commitStructureDrag("floor");
    setDragging(false);
    document.body.style.cursor = "grab";
  };
  return <group
    position={[edit.x, edit.y, edit.z]} scale={[edit.scaleX, edit.scaleY, edit.scaleZ]} userData={{ structureHandle: "floor" }}
    onClick={(event) => { if (mode === "create") { event.stopPropagation(); selectStructure("floor"); } }}
    onPointerOver={(event) => { if (mode === "create") { event.stopPropagation(); setHovered(true); document.body.style.cursor = "grab"; } }}
    onPointerOut={() => { if (!dragging) { setHovered(false); document.body.style.cursor = "default"; } }}
  >
    <StructuralBeam args={[10.55,.3,8.05]} position={[0,.08,0]} material={shared.timberDark} radius={.1} />
    <StructuralBeam args={[10.2,.18,7.7]} position={[0,.27,0]} material={shared.timberLight} radius={.04} />
    {(hovered || active) && <RoundedBox
      args={[.54,.18,.22]} position={[0,.39,3.74]} radius={.07} smoothness={3} material={shared.brass}
      userData={{ structureHandle: "floor", directManipulationHandle: true }} onPointerDown={startFloorDrag} onPointerMove={moveFloor} onPointerUp={endFloorDrag} onPointerCancel={endFloorDrag}
    />}
  </group>;
}

function InteriorDivider({ dividerOffset }) {
  const { camera, invalidate } = useThree();
  const activeFloor = useExperience((s) => s.activeFloor);
  const mode = useExperience((s) => s.mode);
  const selectedRoom = useExperience((s) => s.selectedRoom);
  const focusLook = useExperience((s) => s.focusLook);
  const dragFocus = useExperience((s) => s.dragFocus);
  const material = useMemo(() => {
    const next = shared.cream.clone();
    next.transparent = true;
    return next;
  }, []);
  useFrame((_, dt) => {
    const room = ROOMS.find((item) => item.id === selectedRoom);
    const look = dragFocus || focusLook || room?.target;
    const blocks = look && ((camera.position.x < dividerOffset && look[0] > dividerOffset) || (camera.position.x > dividerOffset && look[0] < dividerOffset));
    const target = mode === "create" && blocks ? .06 : activeFloor === null ? 1 : .16;
    const previous = material.opacity;
    material.opacity = THREE.MathUtils.damp(material.opacity, target, 7, dt);
    material.depthWrite = material.opacity > .5;
    if (Math.abs(previous - material.opacity) > .002) invalidate();
  });
  return <RoundedBox args={[.16,2.55,7.1]} position={[dividerOffset,1.48,-.08]} radius={.025} smoothness={2} material={material} castShadow receiveShadow />;
}

function AdaptiveWall({ args, position, side, level = 0, id }) {
  const { camera, invalidate } = useThree();
  const [hovered, setHovered] = useState(false);
  const [dragMode, setDragMode] = useState(null);
  const selectedRoom = useExperience((s) => s.selectedRoom);
  const activeFloor = useExperience((s) => s.activeFloor);
  const mode = useExperience((s) => s.mode);
  const structureEdits = useExperience((s) => s.structureEdits);
  const selectedObjectId = useExperience((s) => s.selectedObjectId);
  const objectRegistry = useExperience((s) => s.objectRegistry);
  const editTransforms = useExperience((s) => s.editTransforms);
  const selectedStructureId = useExperience((s) => s.selectedStructureId);
  const structureTool = useExperience((s) => s.structureTool);
  const hiddenStructures = useExperience((s) => s.hiddenStructures);
  const selectStructure = useExperience((s) => s.selectStructure);
  const setStructureTool = useExperience((s) => s.setStructureTool);
  const beginStructureDrag = useExperience((s) => s.beginStructureDrag);
  const commitStructureDrag = useExperience((s) => s.commitStructureDrag);
  const nudgeStructure = useExperience((s) => s.nudgeStructure);
  const material = useMemo(() => { const next = shared.cream.clone(); next.transparent = true; return next; }, []);
  const reveal = useRef(1);
  const pointerStart = useRef([0, 0]);
  const objectLook = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const p = camera.position;
    const active = Boolean(selectedRoom || activeFloor !== null);
    const room = ROOMS.find((item) => item.id === selectedRoom);
    const roomSide = room?.side;
    const relevant = !room || (side === "front" && roomSide?.startsWith("front")) || (side === "back" && roomSide === "right-rear") || (side === "left" && roomSide === "front-left") || (side === "right" && ["front-right", "right-rear"].includes(roomSide));
    const toward = side === "front" ? p.z > 1.5 : side === "back" ? p.z < -1.5 : side === "left" ? p.x < -1.5 : p.x > 1.5;
    const lookingLow = level === 1 && room?.level === 0 && p.y < 3.7;
    const obstructing = side === "front" ? p.z > 1.5 : side === "back" ? p.z < -1.5 : side === "left" ? p.x < -1.5 : p.x > 1.5;
    const inactiveFloorShell = activeFloor === 0 && level === 1;
    const lowerEnclosure = activeFloor === 1 && level === 0;
    const selectedPosition = selectedWorldPosition(selectedObjectId, objectRegistry, editTransforms, objectLook);
    const look = mode === "create" ? selectedPosition || room?.target : room?.target;
    const blocksView = look && (side === "front"
      ? p.z > position[2] && look[2] < position[2]
      : side === "back"
        ? p.z < position[2] && look[2] > position[2]
        : side === "left"
          ? p.x < position[0] && look[0] > position[0]
          : p.x > position[0] && look[0] < position[0]);
    const createOpacity = blocksView && (!room || room.level === level) ? .12 : 1;
    const targetOpacity = mode === "create" ? createOpacity : inactiveFloorShell ? 0 : lowerEnclosure ? 1 : activeFloor !== null && obstructing ? 0 : active && relevant && (toward || lookingLow) ? 0 : 1;
    const previous = reveal.current;
    reveal.current = THREE.MathUtils.damp(reveal.current, targetOpacity, mode === "create" ? 12 : 4.8, dt);
    material.visible = true;
    material.opacity = mode === "create" ? reveal.current : Math.max(.16, reveal.current);
    material.depthWrite = material.opacity > .5;
    if (Math.abs(previous - reveal.current) > .002) invalidate();
  });
  if (hiddenStructures[id]) return null;
  const edit = structureEdits[id] || { x: 0, y: 0, z: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };
  const scale = side === "left" || side === "right" ? [edit.scaleZ, edit.scaleY, edit.scaleX] : [edit.scaleX, edit.scaleY, edit.scaleZ];
  const selected = selectedStructureId === id;
  const showMoveHandle = mode === "create" && (hovered || selected) && structureTool !== "resize";
  const showResizeHandles = mode === "create" && selected && structureTool === "resize";
  const startHandleDrag = (kind) => (event) => {
    if (mode !== "create" || event.button !== 0) return;
    event.stopPropagation();
    event.target.setPointerCapture?.(event.pointerId);
    selectStructure(id);
    setStructureTool(kind === "move" ? "move" : "resize");
    beginStructureDrag(id);
    pointerStart.current = [event.clientX ?? event.nativeEvent?.clientX ?? 0, event.clientY ?? event.nativeEvent?.clientY ?? 0];
    setDragMode(kind);
    document.body.style.cursor = "grabbing";
  };
  const moveHandle = (event) => {
    if (!dragMode) return;
    event.stopPropagation();
    const x = event.clientX ?? event.nativeEvent?.clientX ?? pointerStart.current[0];
    const y = event.clientY ?? event.nativeEvent?.clientY ?? pointerStart.current[1];
    const dx = x - pointerStart.current[0];
    const dy = y - pointerStart.current[1];
    pointerStart.current = [x, y];
    if (dragMode === "move") nudgeStructure(id, side === "left" || side === "right" ? "x" : "z", dx * .008, true);
    if (dragMode === "width") nudgeStructure(id, side === "left" || side === "right" ? "scaleZ" : "scaleX", dx * .004, true);
    if (dragMode === "height") nudgeStructure(id, "scaleY", -dy * .004, true);
    invalidate();
  };
  const endHandleDrag = (event) => {
    if (!dragMode) return;
    event.stopPropagation();
    event.target.releasePointerCapture?.(event.pointerId);
    commitStructureDrag(id);
    setDragMode(null);
    document.body.style.cursor = "grab";
  };
  const widthHandlePosition = side === "left" || side === "right" ? [0, 0, args[2] * .5 + .06] : [args[0] * .5 + .06, 0, 0];
  return <group
    position={[position[0] + edit.x, position[1] + edit.y, position[2] + edit.z]}
    scale={scale}
    userData={{ structureHandle: id }}
    onClick={(event) => { if (mode === "create") { event.stopPropagation(); selectStructure(id); } }}
    onPointerOver={(event) => { if (mode === "create") { event.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; } }}
    onPointerOut={() => { if (!dragMode) { setHovered(false); document.body.style.cursor = "default"; } }}
  >
    <RoundedBox args={args} radius={.04} smoothness={2} material={material} castShadow receiveShadow />
    {showMoveHandle && <RoundedBox
      args={[.22,.42,.13]} position={[0,0,.16]} radius={.07} smoothness={3} material={shared.brass}
      userData={{ structureHandle: id, directManipulationHandle: true }} onPointerDown={startHandleDrag("move")} onPointerMove={moveHandle} onPointerUp={endHandleDrag} onPointerCancel={endHandleDrag}
    />}
    {showResizeHandles && <>
      <RoundedBox args={[.26,.26,.16]} position={widthHandlePosition} radius={.07} smoothness={3} material={shared.brass} userData={{ structureHandle: id, directManipulationHandle: true }} onPointerDown={startHandleDrag("width")} onPointerMove={moveHandle} onPointerUp={endHandleDrag} onPointerCancel={endHandleDrag} />
      <RoundedBox args={[.26,.26,.16]} position={[0,args[1] * .5 + .08,.02]} radius={.07} smoothness={3} material={shared.brass} userData={{ structureHandle: id, directManipulationHandle: true }} onPointerDown={startHandleDrag("height")} onPointerMove={moveHandle} onPointerUp={endHandleDrag} onPointerCancel={endHandleDrag} />
    </>}
  </group>;
}

function ContinuousShell() {
  const dividerOffset = useExperience((s) => s.dividerOffset);
  const activeFloor = useExperience((s) => s.activeFloor);
  return <group name="continuous-architectural-shell">
    <EditableFloor />
    {[0].map((y) => <group key={y}>
      <AdaptiveWall id={`wall-back-${y}`} args={[10.5,2.78,.2]} position={[0,y+1.48,-3.72]} side="back" level={y ? 1 : 0} />
      <AdaptiveWall id={`wall-left-${y}`} args={[.2,2.78,7.25]} position={[-5.15,y+1.48,-.08]} side="left" level={y ? 1 : 0} />
      <AdaptiveWall id={`wall-right-${y}`} args={[.2,2.78,7.25]} position={[5.15,y+1.48,-.08]} side="right" level={y ? 1 : 0} />
      <AdaptiveWall id={`wall-front-lower-${y}`} args={[10.5,.2,.22]} position={[0,y+.16,3.72]} side="front" level={y ? 1 : 0} />
      <AdaptiveWall id={`wall-front-upper-${y}`} args={[10.5,.2,.22]} position={[0,y+2.82,3.72]} side="front" level={y ? 1 : 0} />
      {[-5.15,5.15].map((x) => [-3.72,3.72].map((z) => <group key={`${y}-${x}-${z}`}>
        <AdaptiveWall id={`post-${y}-${x}-${z}`} args={[.3,2.95,.3]} position={[x,y+1.48,z]} side={z === 3.72 ? "front" : z === -3.72 ? "back" : x < 0 ? "left" : "right"} level={y ? 1 : 0} />
        <mesh visible={activeFloor === null} position={[x,y+.28,z]} material={shared.brass}><cylinderGeometry args={[.11,.11,.08,16]} /></mesh>
      </group>))}
    </group>)}
    <StructuralBeam args={[10.1,.16,.14]} position={[0,3.34,-.08]} material={shared.timber} radius={.025} />
  </group>;
}

function Roof() {
  const ref = useRef();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pointerY = useRef(0);
  const { camera, invalidate } = useThree();
  const selectedRoom = useExperience((s) => s.selectedRoom);
  const focusLook = useExperience((s) => s.focusLook);
  const activeFloor = useExperience((s) => s.activeFloor);
  const mode = useExperience((s) => s.mode);
  const roofFinish = useExperience((s) => s.roofFinish);
  const structureEdits = useExperience((s) => s.structureEdits);
  const selectedStructureId = useExperience((s) => s.selectedStructureId);
  const selectStructure = useExperience((s) => s.selectStructure);
  const beginStructureDrag = useExperience((s) => s.beginStructureDrag);
  const commitStructureDrag = useExperience((s) => s.commitStructureDrag);
  const nudgeStructure = useExperience((s) => s.nudgeStructure);
  const roofMaterial = useMemo(() => { const next = shared.timberDark.clone(); next.transparent = true; return next; }, []);
  const roofTimber = useMemo(() => { const next = shared.timber.clone(); next.transparent = true; return next; }, []);
  const roofRed = useMemo(() => { const next = shared.red.clone(); next.transparent = true; return next; }, []);
  const roofNavy = useMemo(() => { const next = shared.navy.clone(); next.transparent = true; return next; }, []);
  const roofEdit = structureEdits.roof || { x: 0, y: 0, z: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };
  useFrame((_, dt) => {
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, 3.42 + roofEdit.y, 9, dt);
    ref.current.rotation.z = 0;
    const focusedRoom = ROOMS.find((item) => item.id === selectedRoom) || (focusLook && ROOMS.reduce((nearest, item) => {
      const d = Math.hypot(item.position[0] - focusLook[0], item.position[2] - focusLook[2]);
      return d < nearest.distance ? { item, distance: d } : nearest;
    }, { item: null, distance: Infinity }).item);
    const target = mode === "create" && selectedRoom ? .045 : activeFloor !== null ? 0 : focusedRoom?.level === 1 && camera.position.y > 7.2 && transition.value < .45 ? .3 : 1;
    [roofMaterial, roofTimber, roofRed, roofNavy].forEach((m) => { const previous = m.opacity; m.visible = true; m.opacity = THREE.MathUtils.damp(m.opacity, Math.max(.045, target), 7, dt); m.depthWrite = m.opacity > .5; if (Math.abs(previous - m.opacity) > .002) invalidate(); });
    roofRed.color.set(roofFinish === "sage" ? "#7f9079" : roofFinish === "navy" ? "#45677b" : "#b96858");
    roofRed.emissive?.set(hovered || selectedStructureId === "roof" ? "#5a372b" : "#000000");
    roofRed.emissiveIntensity = hovered || selectedStructureId === "roof" ? .12 : 0;
  });
  const startRoofDrag = (event) => {
    if (mode !== "create" || event.button !== 0) return;
    event.stopPropagation();
    event.target.setPointerCapture?.(event.pointerId);
    pointerY.current = event.clientY ?? event.nativeEvent?.clientY ?? 0;
    selectStructure("roof");
    beginStructureDrag("roof");
    setDragging(true);
    document.body.style.cursor = "grabbing";
  };
  const moveRoof = (event) => {
    if (!dragging) return;
    event.stopPropagation();
    const nextY = event.clientY ?? event.nativeEvent?.clientY ?? pointerY.current;
    const dy = nextY - pointerY.current;
    pointerY.current = nextY;
    nudgeStructure("roof", "y", -dy * .012, true);
    invalidate();
  };
  const endRoofDrag = (event) => {
    if (!dragging) return;
    event.stopPropagation();
    event.target.releasePointerCapture?.(event.pointerId);
    commitStructureDrag("roof");
    setDragging(false);
    document.body.style.cursor = "grab";
  };
  return <group
    ref={ref} position={[roofEdit.x,3.42 + roofEdit.y,roofEdit.z]} scale={[roofEdit.scaleX, roofEdit.scaleY, roofEdit.scaleZ]} name="articulated-roof" userData={{ structureHandle: "roof" }}
    onPointerOver={(event) => { if (mode === "create") { event.stopPropagation(); setHovered(true); document.body.style.cursor = "grab"; } }}
    onPointerOut={() => { if (!dragging) { setHovered(false); document.body.style.cursor = "default"; } }}
    onPointerDown={startRoofDrag} onPointerMove={moveRoof} onPointerUp={endRoofDrag} onPointerCancel={endRoofDrag}
    onClick={(event) => { if (mode === "create") { event.stopPropagation(); selectStructure("roof"); } }}
  >
    <RoundedBox args={[11.25,.32,8.55]} position={[0,0,0]} radius={.16} smoothness={3} material={roofRed} castShadow receiveShadow />
  </group>;
}

function UpperStorey() {
  const ref = useRef();
  const { camera } = useThree();
  const selectedRoom = useExperience((s) => s.selectedRoom);
  const focusLook = useExperience((s) => s.focusLook);
  const activeFloor = useExperience((s) => s.activeFloor);
  const mode = useExperience((s) => s.mode);
  const floorMaterial = useMemo(() => { const next = shared.timber.clone(); next.transparent = true; return next; }, []);
  useFrame(() => {
    const t = segment(transition.value, .14, .72);
    ref.current.position.y = t * 3.15;
    ref.current.position.x = t * .34;
    const focusedRoom = ROOMS.find((item) => item.id === selectedRoom) || (focusLook && ROOMS.reduce((nearest, item) => {
      const d = Math.hypot(item.position[0] - focusLook[0], item.position[2] - focusLook[2]);
      return d < nearest.distance ? { item, distance: d } : nearest;
    }, { item: null, distance: Infinity }).item);
    const target = activeFloor === 0 ? 0 : focusedRoom?.level === 0 && camera.position.y < 3.7 ? .32 : 1;
    floorMaterial.visible = true;
    floorMaterial.opacity = Math.max(.14, target);
    floorMaterial.depthWrite = floorMaterial.opacity > .5;
    ref.current.visible = activeFloor !== 0 && !(mode === "create" && focusedRoom?.level === 0);
  });
  return null;
}

function RevealPanel({ roomId, position, size, axis = "x", direction = 1, label, window = false }) {
  const ref = useRef();
  const { camera, invalidate } = useThree();
  const selectedRoom = useExperience((s) => s.selectedRoom);
  const focusLook = useExperience((s) => s.focusLook);
  const activeFloor = useExperience((s) => s.activeFloor);
  const mode = useExperience((s) => s.mode);
  const structureEdits = useExperience((s) => s.structureEdits);
  const selectedObjectId = useExperience((s) => s.selectedObjectId);
  const objectRegistry = useExperience((s) => s.objectRegistry);
  const editTransforms = useExperience((s) => s.editTransforms);
  const panelMaterial = useMemo(() => { const next = shared.cream.clone(); next.transparent = true; return next; }, []);
  const objectLook = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const panelRoom = ROOMS.find((item) => item.id === roomId);
    const lift = panelRoom.level === 1 ? segment(transition.value, .14, .72) : 0;
    const t = segment(transition.value, .24, .8);
    const edit = structureEdits[`window-${roomId}`] || { x: 0, y: 0, z: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };
    ref.current.position.set(position[0] + edit.x, position[1] + edit.y, position[2] + edit.z);
    ref.current.position.y += lift * 3.15;
    ref.current.position.x += lift * .34;
    ref.current.position[axis] += direction * t * 7;
    ref.current.rotation.y = axis === "x" ? -direction * t * .055 : 0;
    ref.current.scale.set(axis === "x" ? edit.scaleX : 1, edit.scaleY, axis === "z" ? edit.scaleZ : 1);
    const focusedRoom = ROOMS.find((item) => item.id === selectedRoom) || (focusLook && ROOMS.reduce((nearest, item) => {
      const d = Math.hypot(item.position[0] - focusLook[0], item.position[2] - focusLook[2]);
      return d < nearest.distance ? { item, distance: d } : nearest;
    }, { item: null, distance: Infinity }).item);
    const active = focusedRoom?.id === roomId;
    const selectedPosition = selectedWorldPosition(selectedObjectId, objectRegistry, editTransforms, objectLook);
    const look = mode === "create" ? selectedPosition || panelRoom.target : focusLook || panelRoom.target;
    const frontBlocked = axis === "x" && camera.position.z > position[2] && look[2] < position[2];
    const sideBlocked = axis === "z" && ((camera.position.x > position[0] && look[0] < position[0]) || (camera.position.x < position[0] && look[0] > position[0]));
    const floorRelevant = activeFloor === null || panelRoom.level === activeFloor;
    const targetOpacity = mode === "create" ? 0 : activeFloor !== null && !floorRelevant ? 0 : activeFloor !== null && floorRelevant && (frontBlocked || sideBlocked) ? 0 : active && (frontBlocked || sideBlocked) && t < .25 ? 0 : 1;
    // Hide the complete inactive-floor panel, including its window, label, and
    // hardware children. This prevents detached objects in floor-cutaway mode.
    // Keep an invisible hit target in Create mode so windows remain directly
    // editable without visually blocking the room or behaving like glass.
    ref.current.visible = floorRelevant;
    panelMaterial.visible = true;
    const desiredOpacity = mode === "create" ? (frontBlocked || sideBlocked ? .12 : 1) : Math.max(.14, targetOpacity);
    const previous = panelMaterial.opacity;
    panelMaterial.opacity = THREE.MathUtils.damp(panelMaterial.opacity, desiredOpacity, mode === "create" ? 12 : 7.2, dt);
    panelMaterial.depthWrite = panelMaterial.opacity > .5;
    if (Math.abs(previous - panelMaterial.opacity) > .002) invalidate();
  });
  return <group ref={ref} name={`reveal-panel:${roomId}`}>
    <RoundedBox args={size} radius={.055} smoothness={2} material={panelMaterial} castShadow receiveShadow />
    {window && <group visible={mode !== "create"} position={[0,.15,size[2] / 2 + .06]}>
      <RoundedBox args={[1.75,1.18,.08]} radius={.05} smoothness={2} material={shared.timber} />
      <RoundedBox args={[1.42,.86,.025]} position={[0,0,.055]} radius={.025} smoothness={2} material={shared.blue} />
      <mesh position={[0,0,.08]} material={shared.timber}><boxGeometry args={[.055,.9,.035]} /></mesh>
    </group>}
    <mesh visible={mode !== "create"} position={[0,0,size[2] / 2 + .03]} material={shared.navy}><cylinderGeometry args={[.085,.085,.08,16]} /></mesh>
    {label && <Text visible={mode !== "create"} position={[0,-1.05,size[2] / 2 + .08]} fontSize={.12} color="#5e5145" anchorX="center" anchorY="middle">{label.toUpperCase()}</Text>}
  </group>;
}

function ExteriorPanels() {
  return <group name="room-specific-reveal-panels">
    <RevealPanel roomId="living-room" position={[-2.55,1.65,3.62]} size={[4.95,3,.18]} direction={-1} label="Living room" window />
    <RevealPanel roomId="kitchen" position={[2.55,1.65,3.62]} size={[4.95,3,.18]} direction={1} label="Kitchen" window />
    <RevealPanel roomId="bedroom" position={[-2.55,1.65,-3.62]} size={[4.95,3,.18]} direction={-1} label="Bedroom" window />
    <RevealPanel roomId="garage" position={[5.28,1.65,-2.15]} size={[.18,3,3.75]} axis="z" direction={1} />
  </group>;
}

function FixedHouseStructure() {
  return <group name="complete-persistent-house" userData={{ cameraCollider: true }}>
    <ContinuousShell />
    <PersistentRooms level={0} />
    <ExteriorPanels />
    <Roof />
  </group>;
}

function CreativeCopies() {
  const copies = useExperience((s) => s.customObjects);
  const activeFloor = useExperience((s) => s.activeFloor);
  const selectedRoom = useExperience((s) => s.selectedRoom);
  const editTransforms = useExperience((s) => s.editTransforms);
  return <group name="creative-object-copies" visible={activeFloor === null}>{copies.filter((copy) => !selectedRoom || !copy.roomId || copy.roomId === selectedRoom).map((copy) => {
    const transform = editTransforms[copy.id] || copy;
    const position = transform.position || [0, .3, 0];
    return <Interactive key={copy.id} id={copy.id} roomId={copy.roomId} position={position} rotation={transform.rotation} dna={{ id: copy.kind || copy.id, memory: { title: copy.name, text: "A placed household object.", purchaseYear: "—", warranty: "—", receipt: "—", manual: "—", maintenance: [], notes: "" } }}>
      {copy.kind === "lamp" ? <><mesh position={[0,.45,0]} material={shared.timber} castShadow><cylinderGeometry args={[.07,.1,.8,16]} /></mesh><mesh position={[0,.88,0]} material={shared.red} castShadow><cylinderGeometry args={[.18,.32,.32,20]} /></mesh></> : copy.kind === "plant" ? <><mesh position={[0,.2,0]} material={shared.timber} castShadow><cylinderGeometry args={[.25,.3,.4,20]} /></mesh><mesh position={[0,.72,0]} material={shared.green}><sphereGeometry args={[.38,12,8]} /></mesh></> : <><RoundedBox args={[.72,.5,.72]} radius={.12} smoothness={3} material={shared.timber} castShadow receiveShadow /><RoundedBox args={[.5,.08,.5]} position={[0,.29,0]} radius={.03} smoothness={2} material={shared.blue} /></>}
    </Interactive>;
  })}</group>;
}

function Pedestal() {
  return <group position={[0,-.78,0]}>
    <RoundedBox args={[13.2,.72,10.7]} radius={.25} smoothness={4} receiveShadow castShadow material={shared.paper} />
    <RoundedBox args={[12.5,.22,10]} position={[0,.45,0]} radius={.17} smoothness={3} receiveShadow material={shared.timber} />
  </group>;
}

export function HouseScene() {
  const { gl, invalidate } = useThree();
  const [shiftPanning, setShiftPanning] = useState(false);
  const selectedRoom = useExperience((s) => s.selectedRoom);
  const draggingObjectId = useExperience((s) => s.draggingObjectId);
  const pendingPlacementId = useExperience((s) => s.pendingPlacementId);
  const objectRegistry = useExperience((s) => s.objectRegistry);
  const customRooms = useExperience((s) => s.customRooms);
  const room = [...ROOMS, ...customRooms].find((item) => item.id === selectedRoom) || ROOMS[0];
  const mode = useExperience((s) => s.mode);
  const selectObject = useExperience((s) => s.selectObject);
  const applyEdit = useExperience((s) => s.applyEdit);
  const confirmPlacement = useExperience((s) => s.confirmPlacement);
  const controlsRef = useRef();
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Shift") setShiftPanning(true); };
    const onKeyUp = (event) => { if (event.key === "Shift") setShiftPanning(false); };
    const onBlur = () => setShiftPanning(false);
    const preventContextMenu = (event) => { if (mode === "create") event.preventDefault(); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    gl.domElement.addEventListener("contextmenu", preventContextMenu);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      gl.domElement.removeEventListener("contextmenu", preventContextMenu);
      document.body.style.cursor = "default";
    };
  }, [gl, mode]);
  const movePendingPlacement = (event) => {
    if (mode !== "create" || !pendingPlacementId) return;
    const entry = objectRegistry[pendingPlacementId];
    if (!entry) return;
    let surface = null;
    for (const intersection of event.intersections || []) {
      let node = intersection.object;
      let supportId = null;
      let valid = false;
      while (node) {
        if (node.userData?.interactiveObjectId === pendingPlacementId) break;
        if (node.userData?.supportCapable) { supportId = node.userData.interactiveObjectId || null; valid = true; break; }
        if (node.userData?.placementSurface) { valid = true; break; }
        node = node.parent;
      }
      if (valid) { surface = { point: intersection.point, supportId }; break; }
    }
    if (!surface) return;
    applyEdit({
      id: pendingPlacementId,
      roomId: selectedRoom,
      position: [surface.point.x, surface.point.y + (entry.worldBaseLift || entry.baseLift || 0), surface.point.z],
      rotation: useExperience.getState().editTransforms[pendingPlacementId]?.rotation || [0, 0, 0],
      supportId: surface.supportId,
      transient: true,
    });
    invalidate();
  };
  const prioritizeObjectHit = (event) => {
    if (event.shiftKey) return;
    if (pendingPlacementId && event.button === 0) {
      event.stopPropagation();
      confirmPlacement();
      return;
    }
    if (mode !== "create" || !event.intersections?.length) return;
    let directHandle = event.intersections[0]?.object;
    while (directHandle && !directHandle.userData?.directManipulationHandle) directHandle = directHandle.parent;
    if (directHandle?.userData?.directManipulationHandle) return;
    let target = event.object;
    while (target && !target.userData?.interactiveObjectId) target = target.parent;
    if (target?.userData?.interactiveObjectId) return;
    const hit = event.intersections.find((intersection) => {
      let node = intersection.object;
      while (node) { if (node.userData?.interactiveObjectId) return node; node = node.parent; }
      return false;
    });
    if (!hit) return;
    const hitIndex = event.intersections.indexOf(hit);
    const blockedByOpaqueSurface = event.intersections.slice(0, hitIndex).some((intersection) => {
      const material = intersection.object?.material;
      const materials = Array.isArray(material) ? material : [material];
      return materials.some((item) => item && (!item.transparent || item.opacity >= .35));
    });
    if (blockedByOpaqueSurface) return;
    let node = hit.object;
    while (node && !node.userData?.interactiveObjectId) node = node.parent;
    if (node?.userData?.interactiveObjectId) {
      // Let the real object continue through the event pipeline so its own
      // pointer-down handler can establish the drag plane. Structural hit
      // targets check this marker and opt out instead of stealing the drag.
      event.__householdObjectPriority = node.userData.interactiveObjectId;
      // R3F dispatches one pointer event for every intersection. When a
      // transparent wall/window is in front of an object, merely selecting the
      // object is not enough: the structural target would still receive the
      // same pointer-down and begin its own drag. Restrict this dispatch to
      // the winning object intersection so the click has exactly one owner.
      event.intersections = [hit];
      event.object = hit.object;
      selectObject(node.userData.interactiveObjectId);
    }
  };
  return <group onPointerMoveCapture={movePendingPlacement} onPointerDownCapture={prioritizeObjectHit}>
    <color attach="background" args={["#d9d1c5"]} />
    <fog attach="fog" args={["#d9d1c5",34,62]} />
    <ambientLight intensity={.18} color="#fff8ed" />
    <hemisphereLight intensity={.58} color="#f8f2e8" groundColor="#756658" />
    <directionalLight position={[7,15,11]} intensity={1.35} color="#ffe9cf" castShadow shadow-mapSize={[768,768]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} shadow-bias={-.0003} shadow-radius={3} />
    <directionalLight position={[-8,8,-7]} intensity={.38} color="#b8c8c4" />
    <pointLight position={[-5,8,4]} intensity={.32} distance={18} decay={2} color="#fff0d8" />
    <Environment preset="apartment" environmentIntensity={.28} />
    <Pedestal />
    <FixedHouseStructure />
    <CreativeCopies />
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.15,0]} receiveShadow><planeGeometry args={[90,90]} /><meshStandardMaterial color="#cfc8be" roughness={.98} /></mesh>
    <ContactShadows position={[0,-1.14,0]} opacity={.26} scale={27} blur={4.2} far={20} resolution={192} frames={1} color="#514943" />
    <CameraRig controlsRef={controlsRef} />
    <OrbitControls
      ref={controlsRef} makeDefault enabled={!draggingObjectId}
      target={selectedRoom ? room.target : [0,3,0]}
      // Keep Create-mode room views outside the shell so orbiting cannot put
      // the near plane through walls and make objects appear clipped/stuck.
      minDistance={selectedRoom ? (mode === "create" ? 1.25 : 3.8) : 2.4} maxDistance={selectedRoom && mode === "create" ? 12 : 30}
      minPolarAngle={.38} maxPolarAngle={1.72}
      enableRotate enablePan={mode !== "create" || shiftPanning} enableZoom enableDamping dampingFactor={.055}
      mouseButtons={mode === "create" ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE } : undefined}
      rotateSpeed={.8} zoomSpeed={.9} panSpeed={.75}
    />
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom intensity={.04} luminanceThreshold={1.2} luminanceSmoothing={.6} mipmapBlur />
      <Vignette eskil={false} offset={.28} darkness={.07} />
    </EffectComposer>
  </group>;
}
