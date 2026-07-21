import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { shared, COLORS } from "./materials.js";
import { OBJECT_DNA } from "../object-dna/catalog.js";
import { ROOMS, useExperience } from "../state/experience.js";
import { placementProfile, surfaceBelow, surfaceFromIntersections } from "./placement.js";
import { AnimatedLampLight } from "./AnimatedLight.jsx";
import { renderFidelityProfile } from "./renderFidelity.js";

// Every persistent room supplies a scope so two identical objects in different
// rooms can never share an edit/selection identity.
export const ObjectScopeContext = createContext(null);
export const ObjectScope = ({ id, children }) => <ObjectScopeContext.Provider value={id}>{children}</ObjectScopeContext.Provider>;

export const Rounded = ({ size, radius = 0.08, material = shared.timber, ...props }) => (
  <RoundedBox args={size} radius={radius} smoothness={3} castShadow receiveShadow material={material} {...props} />
);

function Peg({ position, rotation = [Math.PI / 2, 0, 0], color = shared.navy, scale = 1 }) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh castShadow material={color}><cylinderGeometry args={[0.075, 0.075, 0.075, 16]} /></mesh>
      <mesh position={[0, 0.07, 0]} castShadow material={shared.timberLight}><cylinderGeometry args={[0.04, 0.05, 0.12, 16]} /></mesh>
    </group>
  );
}

export function Interactive({ dna, children, position, rotation = [0, 0, 0], id, roomId = null }) {
  const group = useRef();
  const body = useRef();
  const dragOffset = useRef([0, 0]);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [placementValid, setPlacementValid] = useState(true);
  const [surfaceActive, setSurfaceActive] = useState(false);
  const [settling, setSettling] = useState(false);
  const scope = useContext(ObjectScopeContext);
  const { gl, invalidate, scene } = useThree();
  const dragPlane = useRef(new THREE.Plane());
  const dragHit = useRef(new THREE.Vector3());
  const dragLocalHit = useRef(new THREE.Vector3());
  const rotationOrigin = useRef(0);
  const rotationStart = useRef(0);
  const pointerX = useRef(0);
  const dragStartedAt = useRef(0);
  const heightAdjusting = useRef(false);
  const heightStartY = useRef(0);
  const heightOrigin = useRef(0);
  const draft = useRef([...position]);
  const draftRotation = useRef([...rotation]);
  const moved = useRef(false);
  const initialized = useRef(false);
  const velocity = useRef(new THREE.Vector3());
  const angularVelocity = useRef(0);
  const settleAge = useRef(1);
  const shadowMotionActive = useRef(false);
  const lastShadowRefresh = useRef(Number.NEGATIVE_INFINITY);
  const settleTimer = useRef();
  const baseLift = useRef(0);
  const worldBaseLift = useRef(0);
  const allowElevated = useRef(false);
  const extent = useRef(1);
  const footprintShape = useRef([1, 1]);
  const focusObject = useExperience((s) => s.focusObject);
  const mode = useExperience((s) => s.mode);
  const editTransforms = useExperience((s) => s.editTransforms);
  const applyEdit = useExperience((s) => s.applyEdit);
  const selectObject = useExperience((s) => s.selectObject);
  const registerObject = useExperience((s) => s.registerObject);
  const unregisterObject = useExperience((s) => s.unregisterObject);
  const beginObjectDrag = useExperience((s) => s.beginObjectDrag);
  const commitObjectDrag = useExperience((s) => s.commitObjectDrag);
  const setDragFocus = useExperience((s) => s.setDragFocus);
  const selectedObjectId = useExperience((s) => s.selectedObjectId);
  const hiddenObjects = useExperience((s) => s.hiddenObjects);
  const stage = useExperience((s) => s.stage);
  const renderFidelity = useExperience((s) => s.renderFidelity);
  const effectiveRoomId = scope || roomId || null;
  const objectId = id || `${scope || "object"}:${dna.id || "piece"}:${position.join(",")}`;
  const selectionActive = mode === "create" && selectedObjectId === objectId;
  const profile = useMemo(() => placementProfile(dna), [dna]);
  const edit = editTransforms[objectId];
  const resolvedPosition = edit?.position || position;
  const resolvedRotation = edit?.rotation || rotation;

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  // A generated object is introduced while selected. When Done is clicked the
  // pointer moves onto an HTML overlay, so R3F may not receive a pointer-out for
  // the mesh underneath it. Clear the latched hover light with the selection.
  useEffect(() => {
    if (!selectionActive) setHovered(false);
  }, [selectionActive]);

  useEffect(() => {
    if (!dragging) return undefined;
    const onKeyDown = (event) => {
      if (event.key.toLowerCase() !== "r" || event.repeat) return;
      event.preventDefault();
      rotationOrigin.current = draftRotation.current[1] || 0;
      rotationStart.current = pointerX.current;
      setRotating(true);
    };
    const onKeyUp = (event) => {
      if (event.key.toLowerCase() !== "r") return;
      event.preventDefault();
      setRotating(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [dragging]);

  useLayoutEffect(() => {
    if (!group.current || !body.current) return;
    group.current.position.set(...resolvedPosition);
    group.current.rotation.set(...resolvedRotation);
    group.current.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(body.current);
    const sizeWorld = bounds.getSize(new THREE.Vector3());
    const originWorld = group.current.getWorldPosition(new THREE.Vector3());
    const parentScale = group.current.parent?.getWorldScale(new THREE.Vector3()) || new THREE.Vector3(1, 1, 1);
    const localFootprint = [sizeWorld.x / Math.max(parentScale.x, .001), sizeWorld.z / Math.max(parentScale.z, .001)];
    const localHeight = sizeWorld.y / Math.max(parentScale.y, .001);
    baseLift.current = (originWorld.y - bounds.min.y) / Math.max(parentScale.y, .001);
    worldBaseLift.current = originWorld.y - bounds.min.y;
    allowElevated.current = profile.allowElevated && Math.max(...localFootprint) < 1.5;
    extent.current = Math.max(sizeWorld.x, sizeWorld.y, sizeWorld.z);
    footprintShape.current = localFootprint;
    const payload = {
      kind: dna.id,
      position: [...resolvedPosition],
      rotation: [...resolvedRotation],
      roomId: effectiveRoomId,
      coordinateSpace: scope ? "roomLocal" : "world",
      footprint: localFootprint,
      worldFootprint: [sizeWorld.x, sizeWorld.z],
      height: localHeight,
      worldHeight: sizeWorld.y,
      baseLift: baseLift.current,
      worldBaseLift: worldBaseLift.current,
      parentMatrix: group.current.parent?.matrixWorld.toArray() || new THREE.Matrix4().toArray(),
    };
    registerObject(objectId, payload);
    const surface = surfaceBelow(scene, originWorld, { self: group.current, roomId: effectiveRoomId, allowElevated: allowElevated.current });
    if (surface && group.current.parent) {
      const localSurface = group.current.parent.worldToLocal(surface.point.clone());
      const nextY = localSurface.y + baseLift.current;
      if (Math.abs(nextY - resolvedPosition[1]) > .01) {
        applyEdit({ id: objectId, roomId: effectiveRoomId, position: [resolvedPosition[0], nextY, resolvedPosition[2]], rotation: resolvedRotation, supportId: surface.supportId, transient: true });
      }
    }
    initialized.current = true;
    invalidate();
    return () => unregisterObject(objectId);
  }, [objectId]);

  useEffect(() => {
    const host = body.current;
    if (!host) return undefined;

    // Defensive cleanup for halos created before a generated body remounted.
    // Capturing `host` also guarantees the cleanup removes from the exact group
    // that received the halo rather than whichever group the ref points to later.
    host.children.filter((child) => child.userData?.selectionHalo).forEach((staleHalo) => {
      host.remove(staleHalo);
      staleHalo.traverse((object) => {
        if (object.material?.userData?.selectionHaloMaterial) object.material.dispose();
      });
    });
    if (!selectionActive) {
      invalidate();
      return undefined;
    }

    host.updateWorldMatrix(true, true);
    const inverse = host.matrixWorld.clone().invert();
    const halo = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: dragging && !placementValid ? "#a96f61" : "#f5d8a8", side: THREE.BackSide, transparent: true, opacity: .46, depthWrite: false, toneMapped: false });
    material.userData.selectionHaloMaterial = true;
    host.traverse((object) => {
      if (!object.isMesh || object.userData?.selectionHalo) return;
      const shell = new THREE.Mesh(object.geometry, material);
      shell.userData.selectionHalo = true;
      shell.matrixAutoUpdate = false;
      shell.matrix.copy(inverse).multiply(object.matrixWorld);
      shell.raycast = () => {};
      halo.add(shell);
    });
    halo.userData.selectionHalo = true;
    halo.scale.setScalar(1.018);
    host.add(halo);
    invalidate();
    return () => {
      host.remove(halo);
      material.dispose();
      invalidate();
    };
  }, [selectionActive, dragging, placementValid]);

  useFrame((_, dt) => {
    if (!group.current || !body.current || !initialized.current) return;
    const step = Math.min(dt, .033);
    const target = new THREE.Vector3(...resolvedPosition);
    const delta = target.sub(group.current.position);
    const spring = dragging ? 88 : 118;
    const damping = dragging ? 13.2 : 16.5;
    velocity.current.addScaledVector(delta, spring * step);
    velocity.current.multiplyScalar(Math.exp(-damping * step));
    group.current.position.addScaledVector(velocity.current, step);
    const desiredY = resolvedRotation[1] || 0;
    const angleDelta = Math.atan2(Math.sin(desiredY - group.current.rotation.y), Math.cos(desiredY - group.current.rotation.y));
    angularVelocity.current += angleDelta * 92 * step;
    angularVelocity.current *= Math.exp(-14 * step);
    group.current.rotation.y += angularVelocity.current * step;
    const selected = mode === "create" && selectedObjectId === objectId;
    settleAge.current = Math.min(1, settleAge.current + step * 2.4);
    const settleBounce = settleAge.current < 1
      ? Math.sin(settleAge.current * Math.PI * 4) * Math.exp(-settleAge.current * 5.2) * .022
      : 0;
    const lift = dragging ? .038 : selected ? .008 : 0;
    body.current.position.y = THREE.MathUtils.damp(body.current.position.y, lift + settleBounce, dragging ? 18 : 12, step);
    body.current.rotation.x = THREE.MathUtils.damp(body.current.rotation.x, dragging ? THREE.MathUtils.clamp(-velocity.current.z * .032, -.075, .075) : 0, 13, step);
    body.current.rotation.z = THREE.MathUtils.damp(body.current.rotation.z, dragging ? THREE.MathUtils.clamp(velocity.current.x * .032, -.075, .075) : 0, 13, step);
    const scale = dragging ? 1.028 : selected ? 1.02 : hovered && stage === "world" ? 1.015 : 1;
    body.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 1 - Math.exp(-step * 12));
    const active = delta.lengthSq() > .000005 || velocity.current.lengthSq() > .00001 || Math.abs(angleDelta) > .001 || Math.abs(angularVelocity.current) > .001 || dragging;
    const visualActive = active
      || settleAge.current < 1
      || Math.abs(body.current.position.y - (lift + settleBounce)) > .0005
      || Math.abs(body.current.rotation.x) > .0005
      || Math.abs(body.current.rotation.z) > .0005
      || Math.abs(body.current.scale.x - scale) > .0005;
    if (visualActive) {
      shadowMotionActive.current = true;
      // Keep the shadow attached to the moving object, but cap expensive
      // shadow-map renders according to the user's fidelity setting.
      const now = performance.now();
      const shadowInterval = 1000 / renderFidelityProfile(renderFidelity).ambientFps;
      if (now - lastShadowRefresh.current >= shadowInterval) {
        lastShadowRefresh.current = now;
        gl.shadowMap.needsUpdate = true;
      }
      invalidate();
    } else if (shadowMotionActive.current) {
      // Always finish with an exact shadow at the final settled transform.
      shadowMotionActive.current = false;
      lastShadowRefresh.current = performance.now();
      gl.shadowMap.needsUpdate = true;
      invalidate();
    }
  });
  if (hiddenObjects[objectId]) return null;
  const placementOptions = () => ({ self: group.current, roomId: effectiveRoomId, allowElevated: allowElevated.current });
  const beginMove = (e) => {
    if (mode !== "create" || e.button !== 0 || e.shiftKey) return;
    e.stopPropagation();
    e.target.setPointerCapture?.(e.pointerId);
    dragStartedAt.current = performance.now();
    pointerX.current = e.clientX ?? e.nativeEvent?.clientX ?? 0;
    heightAdjusting.current = false;
    setPlacementValid(true);
    setSurfaceActive(false);
    setSettling(false);
    window.clearTimeout(settleTimer.current);
    moved.current = false;
    draft.current = [...resolvedPosition];
    draftRotation.current = [...resolvedRotation];
    selectObject(objectId, { position: resolvedPosition, rotation: resolvedRotation });
    beginObjectDrag(objectId);
    const worldOrigin = group.current.getWorldPosition(new THREE.Vector3());
    setDragging(true);
    document.body.style.cursor = "grabbing";
    dragPlane.current.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, worldOrigin.y - worldBaseLift.current, 0));
    if (e.ray?.intersectPlane(dragPlane.current, dragHit.current)) {
      dragLocalHit.current.copy(dragHit.current);
      group.current.parent?.worldToLocal(dragLocalHit.current);
      dragOffset.current = [resolvedPosition[0] - dragLocalHit.current.x, resolvedPosition[2] - dragLocalHit.current.z];
    } else dragOffset.current = [0, 0];
  };
  const moveObject = (e) => {
    if (mode !== "create" || !dragging) return;
    e.stopPropagation();
    pointerX.current = e.clientX ?? e.nativeEvent?.clientX ?? pointerX.current;
    if (performance.now() - dragStartedAt.current < 55) return;
    if (rotating) {
      const raw = rotationOrigin.current + (pointerX.current - rotationStart.current) * .012;
      const step = Math.PI / 12;
      draftRotation.current = [...draftRotation.current];
      draftRotation.current[1] = e.shiftKey ? raw : Math.round(raw / step) * step;
      moved.current = true;
      applyEdit({ id: objectId, roomId: effectiveRoomId, position: draft.current, rotation: draftRotation.current, supportId: edit?.supportId, transient: true });
      invalidate();
      return;
    }
    const hit = e.ray?.intersectPlane(dragPlane.current, dragHit.current);
    if (!hit) return;
    dragLocalHit.current.copy(hit);
    group.current.parent?.worldToLocal(dragLocalHit.current);
    const next = [dragLocalHit.current.x + dragOffset.current[0], resolvedPosition[1], dragLocalHit.current.z + dragOffset.current[1]];
    const candidateWorld = new THREE.Vector3(...next).applyMatrix4(group.current.parent?.matrixWorld || new THREE.Matrix4());
    let surface = null;
    if (e.altKey) {
      const clientY = e.clientY ?? e.nativeEvent?.clientY ?? 0;
      if (!heightAdjusting.current) {
        heightAdjusting.current = true;
        heightStartY.current = clientY;
        heightOrigin.current = draft.current[1];
      }
      next[1] = Math.max(baseLift.current, heightOrigin.current - (clientY - heightStartY.current) * .01);
      setSurfaceActive(false);
      setPlacementValid(true);
    } else {
      heightAdjusting.current = false;
      const directSurface = surfaceFromIntersections(e.intersections, placementOptions());
      surface = directSurface || surfaceBelow(scene, candidateWorld, placementOptions());
      setSurfaceActive(Boolean(surface));
      setPlacementValid(Boolean(surface));
      if (!surface) return;
      if (group.current.parent) {
        const localSurface = group.current.parent.worldToLocal(surface.point.clone());
        next[1] = localSurface.y + baseLift.current;
      }
    }
    moved.current = true;
    draft.current = next;
    applyEdit({ id: objectId, roomId: effectiveRoomId, position: next, rotation: draftRotation.current, supportId: surface?.supportId || null, transient: true });
    setDragFocus(candidateWorld.toArray());
    invalidate();
  };
  const finishMove = (e) => {
    if (!dragging && !rotating) return;
    e.stopPropagation();
    e.target.releasePointerCapture?.(e.pointerId);
    setDragging(false);
    setRotating(false);
    setSurfaceActive(false);
    setPlacementValid(true);
    document.body.style.cursor = hovered ? "grab" : "default";
    commitObjectDrag(objectId, draft.current, draftRotation.current);
    if (moved.current) {
      settleAge.current = 0;
      setSettling(true);
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => setSettling(false), 620);
    }
    invalidate();
  };
  return (
    <group
      ref={group}
      userData={{ interactiveObjectId: objectId, roomId: effectiveRoomId, supportCapable: profile.supportCapable, cameraCollider: true }}
      onPointerOver={(e) => { e.stopPropagation(); if (stage === "world") { setHovered(true); document.body.style.cursor = mode === "create" ? "grab" : "pointer"; } }}
      onPointerOut={() => { setHovered(false); if (!dragging) document.body.style.cursor = "default"; }}
      onPointerDown={beginMove}
      onPointerUp={finishMove}
      onPointerCancel={finishMove}
      onPointerMove={moveObject}
      onClick={(e) => { e.stopPropagation(); if (stage === "world" && mode === "create") { selectObject(objectId, { position: resolvedPosition, rotation: resolvedRotation }); moved.current = false; } else if (stage === "world") { const world = new THREE.Vector3(); group.current.getWorldPosition(world); focusObject({ memory: dna.memory, position: world.toArray() }); } }}
    >
      <group ref={body}>
      {children}
      {hovered && stage === "world" && <>
        <pointLight position={[0, 1.25, .25]} color="#ffd991" intensity={.11} distance={2.6} />
      </>}
      {selectionActive && <>
        <pointLight position={[0, 1.35, .35]} color="#ffe1a8" intensity={dragging ? .34 : settling ? .25 : .16} distance={dragging ? 3.8 : 2.7} decay={2} />
      </>}
      </group>
      {selectionActive && <mesh position={[0, -baseLift.current + .008, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[Math.max(.45, footprintShape.current[0] * (dragging ? .68 : surfaceActive ? .58 : .47)), Math.max(.45, footprintShape.current[1] * (dragging ? .68 : surfaceActive ? .58 : .47)), 1]} raycast={() => null}>
        <circleGeometry args={[1, 48]} /><meshBasicMaterial color={dragging && !placementValid ? "#a96f61" : surfaceActive ? "#e5bd79" : "#57483e"} transparent opacity={dragging ? .075 : surfaceActive ? .16 : .13} depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
      </mesh>}
      {(dragging || settling) && <mesh position={[0, -baseLift.current + .012, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[Math.max(.5, footprintShape.current[0] * .62), Math.max(.5, footprintShape.current[1] * .62), 1]} raycast={() => null}>
        <circleGeometry args={[1, 48]} /><meshBasicMaterial color="#ffd79b" transparent opacity={dragging ? .15 : .075} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>}
    </group>
  );
}

export function Sofa({ fabricMaterial = shared.blue, accentFabricMaterial = fabricMaterial, ...props }) {
  return <Interactive dna={OBJECT_DNA.sofa} {...props}>
    <Rounded size={[3.25, 0.28, 1.18]} position={[0, 0.32, 0]} radius={0.12} />
    <Rounded size={[3.08, 0.28, 0.92]} position={[0, 0.56, -0.02]} radius={0.12} material={fabricMaterial} />
    <Rounded size={[3.15, 1.05, 0.22]} position={[0, 1.08, -0.49]} radius={0.11} />
    <Rounded size={[2.76, 0.72, 0.22]} position={[0, 1.08, -0.34]} radius={0.1} material={accentFabricMaterial} />
    {[-1.48, 1.48].map((x) => <Rounded key={x} size={[0.2, 0.88, 1.08]} position={[x, 0.83, 0]} radius={0.09} />)}
    {[-1.24, 1.24].map((x) => <group key={x}><mesh position={[x, 0.1, 0.37]} material={shared.timberDark} castShadow><cylinderGeometry args={[0.095, 0.12, 0.2, 16]} /></mesh><Peg position={[x, 0.42, 0.59]} scale={0.75} /></group>)}
  </Interactive>;
}

export function CoffeeTable(props) {
  return <Interactive dna={OBJECT_DNA.coffeeTable} {...props}>
    <Rounded size={[2.45, 0.24, 1.24]} position={[0, 0.65, 0]} radius={0.13} />
    <Rounded size={[0.72, 0.035, 0.48]} position={[-0.45, 0.785, 0]} radius={0.055} material={shared.navy} />
    {[-0.88, 0.88].flatMap((x) => [-0.38, 0.38].map((z) => <group key={`${x}${z}`} position={[x, 0.31, z]} rotation={[0, 0, x * 0.05]}><mesh castShadow material={shared.timber}><cylinderGeometry args={[0.11, 0.16, 0.62, 16]} /></mesh><mesh position={[0, -0.3, 0]} material={shared.red}><cylinderGeometry args={[0.12, 0.12, 0.06, 16]} /></mesh></group>))}
    {[[-1.02, -.48], [1.02, -.48], [-1.02, .48], [1.02, .48]].map(([x,z], i) => <mesh key={i} position={[x, .785, z]} rotation={[Math.PI/2,0,0]} material={shared.timberDark}><cylinderGeometry args={[.028,.028,.012,12]} /></mesh>)}
  </Interactive>;
}

export function Bookshelf(props) {
  return <Interactive dna={OBJECT_DNA.bookshelf} {...props}>
    {[-0.8, 0.8].map((x) => <Rounded key={x} size={[0.22, 2.76, 0.52]} position={[x, 1.42, 0]} radius={0.1} />)}
    {[0.14, 1.03, 1.92, 2.78].map((y) => <Rounded key={y} size={[1.82, 0.18, 0.57]} position={[0, y, 0]} radius={0.08} />)}
    {[0.57, 1.46, 2.35].map((y, i) => <Rounded key={y} size={[1.52, 0.68, 0.08]} position={[0, y, -0.25]} radius={0.035} material={[shared.red, shared.mustard, shared.blue][i]} />)}
    {[0.57, 1.46, 2.35].map((y) => <Peg key={y} position={[0.82, y, 0.31]} rotation={[0,0,Math.PI/2]} scale={0.8} />)}
    {[-0.62, -0.2, 0.2, 0.62].map((x) => <mesh key={x} position={[x, 0.02, 0]} material={shared.timber} castShadow><sphereGeometry args={[0.11, 14, 10]} /></mesh>)}
  </Interactive>;
}

export function Lamp(props) {
  return <Interactive dna={OBJECT_DNA.lamp} {...props}>
    <Rounded size={[0.62, 0.14, 0.62]} position={[0, 0.08, 0]} radius={0.07} />
    <mesh position={[0, 0.2, 0]} material={shared.navy} castShadow><cylinderGeometry args={[0.25, 0.27, 0.14, 24]} /></mesh>
    <mesh position={[0, 0.72, 0]} material={shared.timber} castShadow><cylinderGeometry args={[0.11, 0.14, 0.94, 20]} /></mesh>
    <mesh position={[0, 1.25, 0]} material={shared.red} castShadow><cylinderGeometry args={[0.28, 0.52, 0.62, 32, 1, true]} /></mesh>
    <mesh position={[0, 1.57, 0]} material={shared.timberLight} castShadow><cylinderGeometry args={[0.13, 0.13, 0.14, 20]} /></mesh>
    <mesh position={[0, 0.94, 0]} material={shared.timberLight}><cylinderGeometry args={[0.51, 0.51, 0.055, 32]} /></mesh>
    <AnimatedLampLight position={[0, 1.12, .08]} intensity={3.2} distance={7} color="#ffd59e" phase={.6} />
  </Interactive>;
}

function Leaf({ position, rotation, scale = 1 }) {
  return <mesh position={position} rotation={rotation} scale={scale} castShadow material={shared.green}>
    <sphereGeometry args={[0.22, 12, 10]} />
  </mesh>;
}

export function Plant(props) {
  const foliage = useRef();
  const windPhase = useRef((props.position?.[0] || 0) * .73 + (props.position?.[2] || 0) * .41);
  useFrame(({ clock }) => {
    if (!foliage.current) return;
    const time = clock.getElapsedTime();
    foliage.current.rotation.z = Math.sin(time * .38 + windPhase.current) * .022;
    foliage.current.rotation.x = Math.cos(time * .31 + windPhase.current * 1.4) * .014;
  });
  return <Interactive dna={OBJECT_DNA.plant} {...props}>
    <group ref={foliage} position={[0, .78, 0]}>
      {[-0.17, 0, 0.17].map((x) => <mesh key={x} position={[x, .06, 0]} rotation={[0,0,x*1.8]} material={shared.green}><cylinderGeometry args={[0.025,0.035,1.15,10]} /></mesh>)}
      {[[-.32,.42,-.4], [.32,.52,.4], [0,.72,0], [-.38,.17,.8], [.38,.22,-.8]].map(([x,y,r],i) => <Leaf key={i} position={[x,y,0]} rotation={[0,0,r]} scale={[1.65, .55, .3]} />)}
    </group>
    <mesh position={[0, 0.42, 0]} material={shared.timber} castShadow><cylinderGeometry args={[0.35, 0.42, 0.76, 24]} /></mesh>
    <mesh position={[0, .79, 0]} material={shared.soil} receiveShadow><cylinderGeometry args={[.31, .31, .035, 24]} /></mesh>
    <mesh position={[0, 0.24, 0]} material={shared.navy}><torusGeometry args={[0.385, 0.045, 10, 28]} /></mesh>
    {[-.22, 0, .22].map((x) => <mesh key={x} position={[x, 0.03, 0]} material={shared.timber} castShadow><sphereGeometry args={[0.12,14,10]} /></mesh>)}
  </Interactive>;
}

export function Cabinet(props) {
  return <Interactive dna={OBJECT_DNA.cabinet} {...props}>
    <Rounded size={[1.7, 1.18, 0.58]} position={[0, .62, 0]} radius={.11} />
    {[-.41,.41].map((x) => <Rounded key={x} size={[.73,.84,.08]} position={[x,.65,.315]} radius={.045} material={shared.mustard} />)}
    {[-.12,.12].map((x) => <Peg key={x} position={[x,.65,.38]} scale={.7} />)}
    {[-.55,.55].map((x) => <mesh key={x} position={[x,.04,0]} material={shared.timberDark}><sphereGeometry args={[.1,12,10]} /></mesh>)}
  </Interactive>;
}

export function SideTable(props) {
  return <Interactive dna={OBJECT_DNA.sideTable} {...props}>
    <Rounded size={[.86,.12,.74]} position={[0,.72,0]} radius={.08} />
    {[-.3,.3].map((x) => <mesh key={x} position={[x,.36,0]} material={shared.timber}><cylinderGeometry args={[.08,.11,.72,14]} /></mesh>)}
    <Peg position={[.42,.74,0]} rotation={[0,0,Math.PI/2]} scale={.65} />
  </Interactive>;
}

export function Mug(props) {
  return <Interactive dna={OBJECT_DNA.mug} {...props}>
    <mesh material={shared.red} castShadow><cylinderGeometry args={[.16,.18,.34,24]} /></mesh>
    <mesh position={[.2,.03,0]} rotation={[Math.PI/2,0,0]} material={shared.timber}><torusGeometry args={[.13,.045,10,22]} /></mesh>
    <mesh position={[0,-.18,0]} material={shared.navy}><cylinderGeometry args={[.18,.18,.045,24]} /></mesh>
  </Interactive>;
}

export function FramedPicture(props) {
  return <Interactive dna={OBJECT_DNA.framedPicture} {...props}>
    <Rounded size={[1.25,.86,.09]} radius={.07} material={shared.timber} />
    <Rounded size={[1.02,.64,.025]} position={[0,0,.06]} radius={.03} material={shared.paper} />
    <mesh position={[0,.02,.08]} material={shared.blue}><circleGeometry args={[.23,24]} /></mesh>
    <mesh position={[-.25,-.16,.085]} material={shared.mustard}><circleGeometry args={[.1,20]} /></mesh>
  </Interactive>;
}
