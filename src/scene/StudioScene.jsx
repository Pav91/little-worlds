import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { applyFabricWeave, shared } from "./materials.js";
import { Interactive, ObjectScope, Rounded, Sofa, CoffeeTable, Bookshelf, Plant, SideTable, Mug, FramedPicture } from "./Objects.jsx";
import { HOUSE_CAMERA, HOUSE_LOOK, useExperience } from "../state/experience.js";
import { CompiledGeneratedObject } from "../generation/CompiledGeneratedObject.jsx";
import { AnimatedLampLight, AnimatedPointLight } from "./AnimatedLight.jsx";
import { renderFidelityProfile } from "./renderFidelity.js";

const STUDIO_ID = "studio";
const glowMaterial = new THREE.MeshStandardMaterial({ color: "#E6533F", emissive: "#A72E23", emissiveIntensity: .42, roughness: .62 });
const heroFabricMaterial = applyFabricWeave(new THREE.MeshStandardMaterial({ color: "#0D4778", roughness: .9, metalness: 0, envMapIntensity: .76 }), "hero-seat", .032);
const heroFabricAccentMaterial = applyFabricWeave(new THREE.MeshStandardMaterial({ color: "#175D91", roughness: .88, metalness: 0, envMapIntensity: .82 }), "hero-back", .036);
const calmBedroomMaterial = new THREE.MeshStandardMaterial({ color: "#D97868", roughness: .9, metalness: 0 });
const generatedFinishes = {
  green: new THREE.MeshStandardMaterial({ color: "#58A94F", roughness: .82, metalness: .02 }),
  red: new THREE.MeshStandardMaterial({ color: "#E6533F", roughness: .82, metalness: .02 }),
  ivory: new THREE.MeshStandardMaterial({ color: "#F2E8D7", roughness: .84, metalness: .01 }),
  blue: new THREE.MeshStandardMaterial({ color: "#0D4778", roughness: .82, metalness: .02 }),
};
const generatedVariantProfiles = [
  { scale: [1, 1, 1], fabric: shared.fabricBlue, timber: shared.timberLight, support: shared.timberDark, accent: shared.paintedClay },
  { scale: [1.14, .92, 1.04], fabric: shared.fabricIvory, timber: shared.timberDark, support: shared.brass, accent: shared.paintedGreen },
  { scale: [.92, 1.12, .94], fabric: shared.fabricBlue, timber: shared.paintedGreen, support: shared.timberLight, accent: shared.paintedClay },
  { scale: [1.04, 1.03, .86], fabric: shared.paintedClay, timber: shared.timberLight, support: shared.darkMetal, accent: shared.navy },
];
const normalizeGeneratedVariant = (variant) => {
  const value = Number.isFinite(variant) ? Math.trunc(variant) : 0;
  return ((value % generatedVariantProfiles.length) + generatedVariantProfiles.length) % generatedVariantProfiles.length;
};
const colliderBox = new THREE.Box3();
const ENVIRONMENT_PROFILES = {
  clear: { background: "#D4E4EE", ground: "#D8DDE0", ambient: .16, hemisphere: .36, environment: .2, sun: .92, beam: .7 },
  cloudy: { background: "#C8D3D9", ground: "#CDD2D4", ambient: .15, hemisphere: .32, environment: .2, sun: .36, beam: .2 },
  rain: { background: "#9DADB7", ground: "#AEB7BC", ambient: .12, hemisphere: .27, environment: .18, sun: .13, beam: .04 },
};
const daylightFor = (time) => Math.max(.04, Math.sin(((time - 6) / 14) * Math.PI));

function RenderPulse({ fps = 18 }) {
  const { invalidate } = useThree();
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!document.hidden) invalidate();
    }, 1000 / fps);
    return () => window.clearInterval(interval);
  }, [fps, invalidate]);
  return null;
}

function ShadowRefresh() {
  const { gl, invalidate } = useThree();
  const customObjects = useExperience((s) => s.customObjects);
  const hiddenObjects = useExperience((s) => s.hiddenObjects);
  const environmentTime = useExperience((s) => s.environmentTime);
  const environmentWeather = useExperience((s) => s.environmentWeather);
  const renderFidelity = useExperience((s) => s.renderFidelity);
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [customObjects, environmentTime, environmentWeather, gl, hiddenObjects, invalidate, renderFidelity]);
  return null;
}

function LateAfternoonSun() {
  const sun = useRef();
  const spot = useRef();
  const beam = useRef();
  const environmentTime = useExperience((s) => s.environmentTime);
  const environmentWeather = useExperience((s) => s.environmentWeather);
  const renderFidelity = useExperience((s) => s.renderFidelity);
  const fidelityProfile = renderFidelityProfile(renderFidelity);
  const profile = ENVIRONMENT_PROFILES[environmentWeather] || ENVIRONMENT_PROFILES.clear;
  const daylight = daylightFor(environmentTime);
  const dayProgress = THREE.MathUtils.clamp((environmentTime - 6) / 14, 0, 1);
  const azimuth = (dayProgress - .5) * 1.55;
  const sunPosition = [Math.sin(azimuth) * 12.5, 1.2 + daylight * 10.2, -Math.cos(azimuth) * 12.5];
  const warmEdge = Math.min(1, Math.abs(environmentTime - 13) / 7);
  const sunColor = useMemo(() => new THREE.Color("#FFF9F0").lerp(new THREE.Color("#FFD6A6"), warmEdge * .18), [warmEdge]);
  const baseSunIntensity = 2.35 * profile.sun * (.28 + daylight * .72);
  const baseSpotIntensity = 1.75 * profile.sun * (.22 + daylight * .78);
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const cloud = Math.sin(time * .18) * .018 + Math.sin(time * .047 + 1.4) * .012;
    if (sun.current) sun.current.intensity = baseSunIntensity * (1 + cloud);
    if (spot.current) spot.current.intensity = baseSpotIntensity * (1 + cloud * .7);
    if (beam.current) beam.current.material.opacity = .009 * profile.beam * daylight * (1 + cloud * 4);
  });
  return <group name="late-afternoon-sun">
    <directionalLight
      key={`sun-${fidelityProfile.id}`}
      ref={sun}
      position={sunPosition}
      target-position={[.12, .2, 1.35]}
      intensity={baseSunIntensity}
      color={sunColor}
      castShadow
      shadow-mapSize={[fidelityProfile.sunShadowSize, fidelityProfile.sunShadowSize]}
      shadow-camera-left={-8.5}
      shadow-camera-right={8.5}
      shadow-camera-top={7}
      shadow-camera-bottom={-6}
      shadow-bias={-.0002}
      shadow-normalBias={.02}
      shadow-radius={fidelityProfile.shadowRadius}
    />
    <spotLight
      key={`sun-spot-${fidelityProfile.id}`}
      ref={spot}
      position={[sunPosition[0] * .22, Math.max(3.1, sunPosition[1] * .72), -9.4]}
      target-position={[.15, .15, 1.25]}
      intensity={baseSpotIntensity}
      distance={19}
      angle={.3}
      penumbra={.76}
      decay={1.45}
      color={sunColor}
      castShadow
      shadow-mapSize={[fidelityProfile.sunSpotShadowSize, fidelityProfile.sunSpotShadowSize]}
      shadow-bias={-.00016}
    />
    <mesh ref={beam} position={[sunPosition[0] * .035, 2.25, -2.02]} rotation={[Math.PI / 2, -azimuth * .22, 0]} raycast={() => null}>
      <cylinderGeometry args={[2.15, 1.38, 5.45, 4, 1, true]} />
      <meshBasicMaterial color="#FFE4B5" transparent opacity={.009} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
    </mesh>
    <group position={[.08, .222, .48]} rotation={[-Math.PI / 2, 0, -.1]} raycast={() => null}>
      {[-1.02, 1.02].map((x) => <mesh key={x} position={[x, 0, 0]} raycast={() => null}>
        <planeGeometry args={[1.84, 1.96]} />
        <meshBasicMaterial color="#FFE0A7" transparent opacity={.135} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>)}
    </group>
  </group>;
}

function RainOutside({ active }) {
  const rain = useRef();
  const positions = useMemo(() => {
    const values = new Float32Array(150 * 3);
    for (let index = 0; index < 150; index += 1) {
      const seed = Math.sin(index * 91.73) * 43758.5453;
      const fraction = seed - Math.floor(seed);
      values[index * 3] = -12 + fraction * 24;
      values[index * 3 + 1] = ((index * 1.73) % 11) + .5;
      values[index * 3 + 2] = -6.2 - ((index * 2.17) % 7);
    }
    return values;
  }, []);
  useFrame((_, dt) => {
    if (!active || !rain.current) return;
    const attribute = rain.current.geometry.attributes.position;
    for (let index = 0; index < attribute.count; index += 1) {
      const nextY = attribute.getY(index) - dt * (5.8 + (index % 7) * .34);
      attribute.setY(index, nextY < .1 ? 10.5 + (index % 5) * .35 : nextY);
    }
    attribute.needsUpdate = true;
  });
  if (!active) return null;
  return <points ref={rain} name="outside-rain" raycast={() => null}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <pointsMaterial color="#dce9ee" size={.045} transparent opacity={.58} depthWrite={false} sizeAttenuation />
  </points>;
}

function SofaFocusLight() {
  const environmentTime = useExperience((s) => s.environmentTime);
  const environmentWeather = useExperience((s) => s.environmentWeather);
  const profile = ENVIRONMENT_PROFILES[environmentWeather] || ENVIRONMENT_PROFILES.clear;
  const emphasis = daylightFor(environmentTime) * (.42 + profile.sun * .58);
  return <group name="sofa-focus-light">
    <rectAreaLight position={[.2, 1.45, -2.02]} rotation={[0, Math.PI, 0]} intensity={2.35 * emphasis} width={3.6} height={1.25} color="#FFE1AF" />
    <pointLight position={[.2, 1.35, -.72]} intensity={.46 * emphasis} distance={3.2} decay={2} color="#FFE9C8" />
  </group>;
}

function Window({ x, width, height, bottom }) {
  const environmentTime = useExperience((s) => s.environmentTime);
  const environmentWeather = useExperience((s) => s.environmentWeather);
  const centerY = bottom + height / 2;
  const frame = .14;
  const outsideColor = useMemo(() => {
    const profile = ENVIRONMENT_PROFILES[environmentWeather] || ENVIRONMENT_PROFILES.clear;
    return new THREE.Color(profile.background).multiplyScalar(.72 + daylightFor(environmentTime) * .28);
  }, [environmentTime, environmentWeather]);
  return <group position={[x, 0, -4.84]} name="studio-window">
    <mesh position={[0, centerY, -.22]}><planeGeometry args={[width - .08, height - .08]} /><meshBasicMaterial color={outsideColor} transparent opacity={environmentWeather === "rain" ? .72 : .88} toneMapped={false} /></mesh>
    <mesh position={[0, centerY, -.11]} material={shared.glass} receiveShadow userData={{ cameraCollider: true }}>
      <boxGeometry args={[width - .16, height - .16, .11]} />
    </mesh>
    <RoundedBox args={[width + .18, frame, .32]} position={[0, bottom - frame / 2, 0]} radius={.045} smoothness={3} material={shared.timberLight} castShadow receiveShadow userData={{ placementSurface: "sill", roomId: STUDIO_ID }} />
    <RoundedBox args={[width + .18, frame, .32]} position={[0, bottom + height + frame / 2, 0]} radius={.045} smoothness={3} material={shared.timberLight} castShadow receiveShadow />
    <RoundedBox args={[frame, height + .18, .32]} position={[-width / 2 - frame / 2, centerY, 0]} radius={.045} smoothness={3} material={shared.timberLight} castShadow receiveShadow />
    <RoundedBox args={[frame, height + .18, .32]} position={[width / 2 + frame / 2, centerY, 0]} radius={.045} smoothness={3} material={shared.timberLight} castShadow receiveShadow />
    <RoundedBox args={[frame * .72, height - .1, .18]} position={[0, centerY, .03]} radius={.035} smoothness={3} material={shared.timberLight} castShadow />
  </group>;
}

function BackWall() {
  const full = (x, width) => <RoundedBox key={`full-${x}`} args={[width, 4.5, .3]} position={[x, 2.25, -5]} radius={.055} smoothness={3} material={shared.plaster} castShadow receiveShadow />;
  const opening = (x, width, bottom, height) => <group key={`open-${x}`}>
    <RoundedBox args={[width, bottom, .3]} position={[x, bottom / 2, -5]} radius={.04} smoothness={3} material={shared.plaster} castShadow receiveShadow />
    <RoundedBox args={[width, 4.5 - bottom - height, .3]} position={[x, bottom + height + (4.5 - bottom - height) / 2, -5]} radius={.04} smoothness={3} material={shared.plaster} castShadow receiveShadow />
  </group>;
  return <group name="single-back-wall" userData={{ cameraCollider: true }}>
    {full(-7.45, 1.1)}
    {opening(-5.55, 2.7, 1.35, 1.42)}
    {full(-3, 2.4)}
    {opening(0, 3.6, .88, 2.52)}
    {full(3.25, 2.9)}
    {opening(5.6, 1.8, 1.05, 2.28)}
    {full(7.25, 1.5)}
    <Window x={-5.55} width={2.7} height={1.42} bottom={1.35} />
    <Window x={0} width={3.6} height={2.52} bottom={.88} />
    <Window x={5.6} width={1.8} height={2.28} bottom={1.05} />
  </group>;
}

function StudioShell() {
  return <group name="open-plan-studio-shell">
    <RoundedBox args={[16.9, .5, 10.9]} position={[0, -.27, 0]} radius={.18} smoothness={3} material={shared.platform} castShadow receiveShadow userData={{ cameraCollider: true }} />
    <RoundedBox args={[16.35, .17, 10.35]} position={[0, -.57, 0]} radius={.14} smoothness={3} material={shared.platformEdge} castShadow receiveShadow />
    <RoundedBox args={[16.34, .09, 10.34]} position={[0, -.005, 0]} radius={.3} smoothness={7} material={shared.timberLight} castShadow receiveShadow />
    <RoundedBox args={[16, .14, 10]} position={[0, .08, 0]} radius={.26} smoothness={7} material={shared.floor} castShadow receiveShadow userData={{ placementSurface: "floor", roomId: STUDIO_ID, cameraCollider: true }} />
    <BackWall />
    <RoundedBox args={[.3, 4.5, 10]} position={[-8, 2.25, 0]} radius={.06} smoothness={3} material={shared.plaster} castShadow receiveShadow userData={{ cameraCollider: true }} />
    <group position={[-7.79, 2.45, -1.55]} rotation={[0, Math.PI / 2, 0]} scale={[1.18, 1.18, 1.18]}><FramedPicture position={[0, 0, 0]} /></group>
  </group>;
}

function Stool({ position }) {
  return <Interactive position={position} dna={{ id: "stool", family: "resting-frame" }}>
    <Rounded size={[.72, .16, .62]} position={[0, .76, 0]} radius={.1} material={shared.paintedClay} />
    {[-.23, .23].map((x) => <mesh key={x} position={[x, .38, 0]} material={shared.darkMetal} castShadow><cylinderGeometry args={[.055, .075, .76, 16]} /></mesh>)}
  </Interactive>;
}

function KitchenIsland() {
  return <Interactive position={[-5.05, .1, -1.25]} dna={{ id: "table", family: "lifted-slab", supportCapable: true }}>
    <Rounded size={[3.15, .2, .88]} position={[0, .92, 0]} radius={.12} material={shared.timberLight} userData={{ placementSurface: "island", roomId: STUDIO_ID }} />
    <Rounded size={[2.75, .72, .64]} position={[0, .5, -.02]} radius={.11} material={shared.paintedGreen} />
    <Rounded size={[1.18, .08, .5]} position={[.66, 1.04, 0]} radius={.04} material={shared.ceramic} />
  </Interactive>;
}

function KitchenCabinetRun() {
  const cabinetXs = [-6.15, -4.85, -3.55];
  return <Interactive position={[0, 0, 0]} dna={{ id: "cabinet", family: "captured-stack", supportCapable: true }}>
    <RoundedBox args={[4.4, .2, .82]} position={[-5.15, 1.04, -4.42]} radius={.1} smoothness={4} material={shared.timberLight} castShadow receiveShadow userData={{ placementSurface: "counter", roomId: STUDIO_ID }} />
    {cabinetXs.map((x, index) => <group key={x}>
      <RoundedBox args={[1.18, .85, .72]} position={[x, .54, -4.44]} radius={.08} smoothness={3} material={index === 1 ? shared.paintedIvory : shared.paintedGreen} castShadow receiveShadow />
      <mesh position={[x + .34, .57, -4.05]} material={shared.brass} castShadow><sphereGeometry args={[.045, 14, 10]} /></mesh>
    </group>)}
    <RoundedBox args={[.92, 2.05, .82]} position={[-7.25, 1.03, -4.39]} radius={.12} smoothness={4} material={shared.paintedIvory} castShadow receiveShadow />
    <RoundedBox args={[.62, .035, .42]} position={[-5.72, 1.16, -4.35]} radius={.05} smoothness={3} material={shared.ceramic} />
    <mesh position={[-5.72, 1.18, -4.33]} material={shared.darkMetal}><torusGeometry args={[.12, .022, 10, 22, Math.PI]} /></mesh>
    <RoundedBox args={[.7, .035, .46]} position={[-4.2, 1.16, -4.35]} radius={.035} smoothness={3} material={shared.darkMetal} />
    {[-4.43, -3.98].map((x) => <mesh key={x} position={[x, 1.19, -4.34]} rotation={[-Math.PI / 2, 0, 0]} material={shared.charcoal}><torusGeometry args={[.13, .016, 8, 18]} /></mesh>)}
    <RoundedBox args={[1.02, .72, .42]} position={[-7.05, 2.83, -4.68]} radius={.09} smoothness={3} material={shared.paintedGreen} castShadow receiveShadow />
    <RoundedBox args={[.88, .12, .5]} position={[-3.65, 2.92, -4.58]} radius={.07} smoothness={3} material={shared.timberLight} castShadow receiveShadow userData={{ placementSurface: "shelf", roomId: STUDIO_ID }} />
    <RoundedBox args={[1.05, .12, .5]} position={[-3.65, 2.38, -4.58]} radius={.07} smoothness={3} material={shared.timberLight} castShadow receiveShadow userData={{ placementSurface: "shelf", roomId: STUDIO_ID }} />
  </Interactive>;
}

function KitchenZone() {
  return <group name="kitchen-zone" position={[-.34, 0, -.2]} scale={[.93, .96, .93]} userData={{ cameraCollider: true }}>
    <KitchenCabinetRun />
    <KitchenIsland />
    <Stool position={[-5.75, .1, -.33]} />
    <Stool position={[-4.35, .1, -.33]} />
  </group>;
}

function Armchair({ position, rotation = [0, 0, 0] }) {
  return <Interactive position={position} rotation={rotation} dna={{ id: "armchair", family: "resting-frame" }}>
    <Rounded size={[1.35, .25, 1.15]} position={[0, .38, 0]} radius={.13} material={shared.timberLight} />
    <Rounded size={[1.18, .32, .95]} position={[0, .6, .02]} radius={.15} material={shared.fabricIvory} />
    <Rounded size={[1.26, .92, .2]} position={[0, 1.06, -.47]} radius={.12} material={shared.fabricIvory} />
    {[-.62, .62].map((x) => <Rounded key={x} size={[.16, .78, 1.02]} position={[x, .78, 0]} radius={.08} material={shared.timberLight} />)}
  </Interactive>;
}

function FloorLamp() {
  return <Interactive position={[2.55, .1, -1.78]} dna={{ id: "floor-lamp", family: "held-vessel" }}>
    <mesh position={[0, .08, 0]} material={shared.darkMetal} castShadow><cylinderGeometry args={[.32, .4, .16, 24]} /></mesh>
    <mesh position={[0, 1.05, 0]} material={shared.brass} castShadow><cylinderGeometry args={[.055, .075, 2, 18]} /></mesh>
    <mesh position={[0, 2.02, 0]} material={glowMaterial} castShadow><cylinderGeometry args={[.34, .56, .55, 28]} /></mesh>
    <AnimatedLampLight position={[0, 1.86, .12]} intensity={3.8} distance={8.2} color="#ffd19a" phase={.35} />
  </Interactive>;
}

function LivingZone() {
  return <group name="living-zone">
    <group scale={[1.12, 1.08, 1.08]}><Sofa position={[.2, .1, -1.03]} fabricMaterial={heroFabricMaterial} accentFabricMaterial={heroFabricAccentMaterial} /></group>
    <CoffeeTable position={[.2, .1, .14]} />
    <Armchair position={[-2.45, .1, .48]} rotation={[0, -.5, 0]} />
    <SideTable position={[2.55, .1, .18]} />
    <FloorLamp />
    <group scale={[1.02, .74, .92]}><Bookshelf position={[2.72, .1, -4.18]} /></group>
    <group scale={[.88, .88, .88]}><Plant position={[-2.65, .1, -3.55]} /></group>
    <group scale={[.82, .82, .82]}><Plant position={[3.05, .1, 1.65]} /></group>
    <Mug position={[.6, .94, .12]} />
    <SofaFocusLight />
  </group>;
}

function StudioBed() {
  return <Interactive position={[5.35, .1, -2.38]} dna={{ id: "bed", family: "resting-frame" }}>
    <Rounded size={[3.15, .32, 2.18]} position={[0, .36, 0]} radius={.15} material={shared.timberLight} />
    <Rounded size={[2.92, .28, 1.92]} position={[0, .64, .08]} radius={.16} material={shared.fabricIvory} />
    <Rounded size={[3.14, 1.18, .2]} position={[0, 1.04, -1.01]} radius={.12} material={calmBedroomMaterial} />
    {[-.76, .76].map((x) => <Rounded key={x} size={[1.18, .18, .6]} position={[x, .9, -.48]} radius={.11} material={shared.fabricBlue} />)}
    <Rounded size={[2.75, .08, .82]} position={[0, .84, .56]} radius={.06} material={shared.fabricBlue} />
  </Interactive>;
}

function Dresser() {
  return <Interactive position={[3.68, .1, -4.15]} dna={{ id: "cabinet", family: "captured-box" }}>
    <Rounded size={[1.65, 1.05, .66]} position={[0, .55, 0]} radius={.11} material={shared.paintedGreen} />
    {[-.42, .42].map((x) => <Rounded key={x} size={[.7, .72, .06]} position={[x, .57, .36]} radius={.045} material={shared.paintedIvory} />)}
    {[-.15, .15].map((x) => <mesh key={x} position={[x, .58, .41]} material={shared.brass} castShadow><sphereGeometry args={[.055, 14, 10]} /></mesh>)}
  </Interactive>;
}

function BedsideLamp() {
  return <Interactive position={[7.18, .9, -3.18]} dna={{ id: "bedside-lamp", family: "held-vessel" }}>
    <mesh position={[0, .12, 0]} material={shared.ceramic} castShadow><cylinderGeometry args={[.2, .25, .24, 20]} /></mesh>
    <mesh position={[0, .45, 0]} material={shared.brass} castShadow><cylinderGeometry args={[.035, .045, .55, 14]} /></mesh>
    <mesh position={[0, .76, 0]} material={glowMaterial} castShadow><cylinderGeometry args={[.2, .34, .36, 24]} /></mesh>
    <AnimatedLampLight position={[0, .72, .12]} intensity={2.4} distance={5.8} color="#ffc985" phase={1.8} />
  </Interactive>;
}

function BedroomZone() {
  return <group name="bedroom-zone" position={[.48, 0, 0]}>
    <StudioBed />
    <SideTable position={[7.18, .1, -3.18]} />
    <BedsideLamp />
    <Dresser />
    <group scale={[.82, .82, .82]}><Plant position={[6.65, .1, -.46]} /></group>
  </group>;
}

function GeneratedObjectBody({ kind, finish, variant = 0, generationSeed = 0 }) {
  const profile = generatedVariantProfiles[normalizeGeneratedVariant(variant)];
  const generatedFabric = generatedFinishes[finish] || profile.fabric;
  const generatedTimber = profile.timber;
  const generatedSupport = profile.support;
  const generatedAccent = generatedFinishes[finish] || profile.accent;
  if (kind === "lamp") return <>
    <mesh position={[0, .42, 0]} material={shared.brass} castShadow><cylinderGeometry args={[.06, .09, .75, 16]} /></mesh>
    <mesh position={[0, .87, 0]} material={generatedAccent} castShadow><cylinderGeometry args={[.2, .34, .35, 22]} /></mesh>
    <AnimatedLampLight position={[0, .84, .1]} intensity={2.8} distance={6.5} color="#ffd29a" phase={generationSeed % 7} />
  </>;
  if (kind === "plant") return <>
    <mesh position={[0, .25, 0]} material={generatedAccent} castShadow><cylinderGeometry args={[.25, .31, .48, 20]} /></mesh>
    <mesh position={[0, .68, 0]} material={shared.leaf} castShadow><sphereGeometry args={[.4, 16, 12]} /></mesh>
  </>;
  if (kind === "chair") return <>
    <Rounded size={[.9, .18, .82]} position={[0, .62, 0]} radius={.1} material={generatedFabric} />
    <Rounded size={[.9, .82, .16]} position={[0, 1.08, -.34]} radius={.09} material={generatedFabric} />
    {[-.33, .33].flatMap((x) => [-.28, .28].map((z) => <mesh key={`${x}-${z}`} position={[x, .3, z]} material={generatedSupport} castShadow><cylinderGeometry args={[.045, .06, .58, 12]} /></mesh>))}
  </>;
  if (kind === "stool") return <>
    <mesh position={[0, .68, 0]} material={generatedFabric} castShadow><cylinderGeometry args={[.43, .46, .18, 24]} /></mesh>
    {[0, 1, 2].map((index) => {
      const angle = index * Math.PI * 2 / 3;
      return <mesh key={index} position={[Math.cos(angle) * .28, .33, Math.sin(angle) * .28]} material={generatedSupport} castShadow><cylinderGeometry args={[.045, .065, .65, 12]} /></mesh>;
    })}
  </>;
  if (kind === "bench") return <>
    <Rounded size={[1.85, .24, .7]} position={[0, .55, 0]} radius={.12} material={generatedFabric} />
    {[-.62, .62].map((x) => <Rounded key={x} size={[.18, .52, .48]} position={[x, .26, 0]} radius={.07} material={generatedSupport} />)}
  </>;
  if (kind === "armchair") return <>
    <Rounded size={[1.15, .3, .98]} position={[0, .5, 0]} radius={.14} material={generatedFabric} />
    <Rounded size={[1.12, .9, .2]} position={[0, 1.03, -.4]} radius={.13} material={generatedFabric} />
    {[-.58, .58].map((x) => <Rounded key={x} size={[.18, .68, .92]} position={[x, .69, 0]} radius={.1} material={generatedTimber} />)}
    {[-.38, .38].flatMap((x) => [-.31, .31].map((z) => <mesh key={`${x}-${z}`} position={[x, .2, z]} material={generatedSupport} castShadow><cylinderGeometry args={[.055, .075, .38, 12]} /></mesh>))}
  </>;
  if (kind === "sofa") return <>
    <Rounded size={[2.35, .3, .92]} position={[0, .48, 0]} radius={.14} material={generatedFabric} />
    <Rounded size={[2.2, .78, .18]} position={[0, .92, -.39]} radius={.11} material={generatedFabric} />
    {[-1.08, 1.08].map((x) => <Rounded key={x} size={[.18, .7, .9]} position={[x, .66, 0]} radius={.09} material={generatedTimber} />)}
  </>;
  if (kind === "bed") return <>
    <Rounded size={[2.35, .28, 1.72]} position={[0, .35, 0]} radius={.13} material={generatedTimber} />
    <Rounded size={[2.18, .24, 1.55]} position={[0, .58, .04]} radius={.14} material={shared.fabricIvory} />
    <Rounded size={[2.34, .92, .18]} position={[0, .82, -.77]} radius={.1} material={generatedAccent} />
    <Rounded size={[1.7, .08, .65]} position={[0, .76, .43]} radius={.05} material={generatedFabric} />
  </>;
  if (kind === "cabinet") return <>
    <Rounded size={[1.35, 1.05, .62]} position={[0, .55, 0]} radius={.1} material={generatedAccent} />
    {[-.27, .27].map((x) => <Rounded key={x} size={[.54, .72, .055]} position={[x, .56, .34]} radius={.04} material={shared.paintedIvory} />)}
    {[-.11, .11].map((x) => <mesh key={x} position={[x, .58, .39]} material={shared.brass} castShadow><sphereGeometry args={[.045, 12, 9]} /></mesh>)}
  </>;
  if (kind === "bookshelf") return <>
    {[-.65, .65].map((x) => <Rounded key={x} size={[.13, 1.75, .46]} position={[x, .88, 0]} radius={.055} material={generatedSupport} />)}
    {[.08, .62, 1.16, 1.7].map((y) => <Rounded key={y} size={[1.42, .12, .46]} position={[0, y, 0]} radius={.05} material={generatedTimber} />)}
  </>;
  if (kind === "side-table") return <>
    <mesh position={[0, .67, 0]} material={generatedTimber} castShadow receiveShadow><cylinderGeometry args={[.56, .56, .15, 28]} /></mesh>
    <mesh position={[0, .34, 0]} material={shared.brass} castShadow><cylinderGeometry args={[.09, .13, .62, 18]} /></mesh>
    <mesh position={[0, .08, 0]} material={generatedSupport} castShadow><cylinderGeometry args={[.34, .4, .12, 24]} /></mesh>
  </>;
  if (kind === "desk") return <>
    <Rounded size={[1.95, .16, .82]} position={[0, .75, 0]} radius={.09} material={generatedTimber} userData={{ placementSurface: "generated-desk", roomId: STUDIO_ID }} />
    <Rounded size={[.58, .58, .68]} position={[.62, .39, 0]} radius={.08} material={generatedAccent} />
    {[-.72, -.5].map((x) => <mesh key={x} position={[x, .37, 0]} material={generatedSupport} castShadow><cylinderGeometry args={[.055, .075, .72, 14]} /></mesh>)}
  </>;
  if (kind === "vase") return <>
    <mesh position={[0, .38, 0]} material={generatedAccent} castShadow><sphereGeometry args={[.38, 24, 18]} /></mesh>
    <mesh position={[0, .72, 0]} material={generatedAccent} castShadow><cylinderGeometry args={[.16, .24, .44, 22]} /></mesh>
    <mesh position={[0, .95, 0]} material={shared.brass} castShadow><torusGeometry args={[.16, .025, 10, 24]} /></mesh>
  </>;
  if (kind === "mirror") return <>
    <Rounded size={[1.08, 1.5, .12]} position={[0, .82, 0]} radius={.18} material={generatedTimber} />
    <Rounded size={[.82, 1.23, .035]} position={[0, .82, .075]} radius={.14} material={shared.glass} />
    <Rounded size={[.72, .12, .46]} position={[0, .08, 0]} radius={.06} material={generatedSupport} />
  </>;
  if (kind === "television") return <>
    <Rounded size={[1.72, 1.02, .14]} position={[0, .88, 0]} radius={.09} material={shared.charcoal} />
    <Rounded size={[1.46, .78, .025]} position={[0, .88, .085]} radius={.06} material={shared.navy} />
    <mesh position={[0, .28, 0]} material={shared.brass} castShadow><cylinderGeometry args={[.06, .08, .38, 14]} /></mesh>
    <Rounded size={[.78, .1, .42]} position={[0, .08, 0]} radius={.05} material={generatedSupport} />
  </>;
  if (kind === "candle") return <>
    <mesh position={[0, .24, 0]} material={generatedAccent} castShadow><cylinderGeometry args={[.18, .2, .46, 20]} /></mesh>
    <mesh position={[0, .5, 0]} material={glowMaterial} castShadow><sphereGeometry args={[.07, 14, 10]} /></mesh>
    <AnimatedPointLight position={[0, .52, .02]} intensity={.65} distance={2.8} decay={1.7} color="#ffc579" phase={generationSeed % 5} />
  </>;
  if (kind === "table") return <>
    <Rounded size={[1.35, .16, .82]} position={[0, .64, 0]} radius={.1} material={generatedTimber} userData={{ placementSurface: "generated-table", roomId: STUDIO_ID }} />
    {[-.45, .45].flatMap((x) => [-.26, .26].map((z) => <mesh key={`${x}-${z}`} position={[x, .31, z]} material={generatedSupport} castShadow><cylinderGeometry args={[.055, .075, .62, 14]} /></mesh>))}
  </>;
  return null;
}

function GeneratedVariantDetail({ kind, variant = 0 }) {
  const index = normalizeGeneratedVariant(variant);
  if (index === 0) return null;
  const { accent, support } = generatedVariantProfiles[index];

  if (kind === "chair") return <>
    <Rounded size={[.66, .12 + index * .035, .05]} position={[0, 1.08, -.245]} radius={.025} material={accent} />
    {index >= 2 && [-.48, .48].map((x) => <Rounded key={x} size={[.09, .48, .68]} position={[x, .7, 0]} radius={.04} material={support} />)}
  </>;
  if (kind === "armchair") return <Rounded size={[.72 + index * .08, .13, .07]} position={[0, 1.05, -.285]} radius={.035} material={accent} />;
  if (kind === "sofa") return <>
    <Rounded size={[1.5 + index * .12, .13, .07]} position={[0, .91, -.285]} radius={.035} material={accent} />
    {index >= 2 && [-.62, .62].map((x) => <mesh key={x} position={[x, .72, -.18]} rotation={[Math.PI / 2, 0, 0]} material={support} castShadow><cylinderGeometry args={[.1, .1, .5, 16]} /></mesh>)}
  </>;
  if (kind === "bench") return <Rounded size={[1.15 + index * .14, .1, .08]} position={[0, .58, .37]} radius={.035} material={accent} />;
  if (kind === "stool") return <mesh position={[0, .58, 0]} rotation={[Math.PI / 2, 0, 0]} material={accent} castShadow><torusGeometry args={[.34, .035 + index * .008, 10, 24]} /></mesh>;
  if (kind === "bed") return <Rounded size={[1.25 + index * .2, .055, .5]} position={[0, .805, .5]} radius={.035} material={accent} />;

  if (["table", "side-table", "desk"].includes(kind)) {
    const details = {
      table: { size: [1.02, .035, .54], position: [0, .73, 0] },
      "side-table": { size: [.72, .035, .34], position: [0, .75, 0] },
      desk: { size: [1.38, .035, .5], position: [-.12, .84, 0] },
    };
    const detail = details[kind];
    return <Rounded size={detail.size} position={detail.position} radius={.025} material={accent} />;
  }

  if (kind === "cabinet") return <Rounded size={[.72 + index * .08, .08, .05]} position={[0, .82, .39]} radius={.025} material={support} />;
  if (kind === "bookshelf") return <Rounded size={[1.02, .08 + index * .015, .05]} position={[0, 1.42, .26]} radius={.025} material={accent} />;
  if (kind === "mirror") return <Rounded size={[.7 + index * .06, .09, .17]} position={[0, 1.58, .015]} radius={.035} material={accent} />;
  if (kind === "television") return <Rounded size={[1.05 + index * .08, .055, .08]} position={[0, .42, .08]} radius={.02} material={accent} />;
  if (["lamp", "plant", "vase", "candle"].includes(kind)) {
    const heights = { lamp: .42, plant: .38, vase: .66, candle: .34 };
    const radii = { lamp: .1, plant: .28, vase: .25, candle: .19 };
    return <mesh position={[0, heights[kind], 0]} rotation={[Math.PI / 2, 0, 0]} material={support} castShadow>
      <torusGeometry args={[radii[kind], .025 + index * .008, 10, 24]} />
    </mesh>;
  }
  return null;
}

function CreatedObjects() {
  const copies = useExperience((s) => s.customObjects);
  const edits = useExperience((s) => s.editTransforms);
  return <group name="created-objects">{copies.map((copy) => {
    const transform = edits[copy.id] || copy;
    const isCompiled = Boolean(copy.objectDNA);
    const resting = ["chair", "armchair", "sofa", "bed", "stool", "bench"].includes(copy.kind);
    const captured = ["cabinet", "bookshelf", "mirror", "television"].includes(copy.kind);
    const family = isCompiled
      ? copy.objectDNA.family.silhouetteFamily
      : copy.kind === "plant" ? "clustered-stem" : copy.kind === "lamp" ? "held-vessel" : resting ? "resting-frame" : captured ? "captured-box" : "lifted-slab";
    const supportsObjects = isCompiled
      ? ["lifted-slab", "captured-box", "captured-stack"].includes(family)
      : ["table", "side-table", "desk"].includes(copy.kind);
    const variant = normalizeGeneratedVariant(copy.variant);
    const variantScale = generatedVariantProfiles[variant].scale;
    return <Interactive key={copy.id} id={copy.id} roomId={STUDIO_ID} position={transform.position || [0, .42, 1.65]} rotation={transform.rotation || [0, 0, 0]} dna={{ id: copy.kind, family, supportCapable: supportsObjects }}>
      {isCompiled
        ? <CompiledGeneratedObject dna={copy.objectDNA} variant={variant} />
        : <group scale={variantScale}>
          <GeneratedObjectBody kind={copy.kind} finish={copy.finish} variant={variant} generationSeed={copy.generationSeed} />
          <GeneratedVariantDetail kind={copy.kind} variant={variant} />
        </group>}
    </Interactive>;
  })}</group>;
}

function CameraRig({ controlsRef }) {
  const { camera, scene, invalidate } = useThree();
  const selectedObjectId = useExperience((s) => s.selectedObjectId);
  const focusTarget = useExperience((s) => s.focusTarget);
  const focusLook = useExperience((s) => s.focusLook);
  const clearFocus = useExperience((s) => s.clearFocus);
  const elapsed = useRef(0);
  const activeFocus = useRef(null);
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);
  const desiredLook = useMemo(() => new THREE.Vector3(), []);
  const lastCollisionPosition = useRef(new THREE.Vector3(Number.POSITIVE_INFINITY, 0, 0));
  useFrame((_, dt) => {
    const controls = controlsRef.current;
    if (!controls || selectedObjectId) return;
    if (focusTarget && focusLook) {
      if (activeFocus.current !== focusTarget) { activeFocus.current = focusTarget; elapsed.current = 0; }
      elapsed.current += dt;
      desiredPosition.set(...focusTarget);
      desiredLook.set(...focusLook);
      const t = 1 - Math.exp(-dt * 7.2);
      camera.position.lerp(desiredPosition, t);
      controls.target.lerp(desiredLook, t);
      controls.update();
      if (elapsed.current >= .68) clearFocus();
      invalidate();
    }

    if (lastCollisionPosition.current.distanceToSquared(camera.position) < .000001) return;
    lastCollisionPosition.current.copy(camera.position);
    scene.traverse((object) => {
      if (!object.visible || (!object.userData?.cameraCollider && !object.userData?.interactiveObjectId)) return;
      colliderBox.setFromObject(object).expandByScalar(.18);
      if (!colliderBox.containsPoint(camera.position)) return;
      const exits = [
        ["x", colliderBox.min.x, camera.position.x - colliderBox.min.x], ["x", colliderBox.max.x, colliderBox.max.x - camera.position.x],
        ["y", colliderBox.min.y, camera.position.y - colliderBox.min.y], ["y", colliderBox.max.y, colliderBox.max.y - camera.position.y],
        ["z", colliderBox.min.z, camera.position.z - colliderBox.min.z], ["z", colliderBox.max.z, colliderBox.max.z - camera.position.z],
      ].sort((a, b) => a[2] - b[2]);
      camera.position[exits[0][0]] = exits[0][1];
    });
    camera.position.y = Math.max(.72, camera.position.y);
  });
  return null;
}

function StudioCameraControls() {
  const { gl, camera, invalidate } = useThree();
  const [shiftPanning, setShiftPanning] = useState(false);
  const selectedObjectId = useExperience((s) => s.selectedObjectId);
  const cameraMotion = useExperience((s) => s.cameraMotion);
  const clearFocus = useExperience((s) => s.clearFocus);
  const controlsRef = useRef();
  const motionOffset = useMemo(() => new THREE.Vector3(), []);
  const motionSpherical = useMemo(() => new THREE.Spherical(), []);
  useEffect(() => {
    const down = (event) => { if (event.key === "Shift") setShiftPanning(true); };
    const up = (event) => { if (event.key === "Shift") setShiftPanning(false); };
    const blur = () => setShiftPanning(false);
    const context = (event) => event.preventDefault();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    gl.domElement.addEventListener("contextmenu", context);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      gl.domElement.removeEventListener("contextmenu", context);
    };
  }, [gl]);
  useEffect(() => {
    if (!selectedObjectId) return;
    setShiftPanning(false);
    clearFocus();
  }, [selectedObjectId, clearFocus]);
  const clampCamera = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -2.8, 2.8);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, .65, 1.8);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -1.8, 1.8);
    camera.position.y = Math.max(.72, camera.position.y);
  };
  useFrame((_, dt) => {
    const controls = controlsRef.current;
    if (!controls || !cameraMotion || selectedObjectId) return;
    motionOffset.copy(camera.position).sub(controls.target);
    motionSpherical.setFromVector3(motionOffset);
    const step = Math.min(dt, .05);
    if (cameraMotion === "left") motionSpherical.theta -= step * .72;
    if (cameraMotion === "right") motionSpherical.theta += step * .72;
    if (cameraMotion === "up") motionSpherical.phi -= step * .54;
    if (cameraMotion === "down") motionSpherical.phi += step * .54;
    motionSpherical.theta = THREE.MathUtils.clamp(motionSpherical.theta, controls.minAzimuthAngle, controls.maxAzimuthAngle);
    motionSpherical.phi = THREE.MathUtils.clamp(motionSpherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
    motionSpherical.makeSafe();
    camera.position.copy(controls.target).add(motionOffset.setFromSpherical(motionSpherical));
    camera.updateMatrixWorld();
    controls.update();
    clampCamera();
    invalidate();
  });
  return <>
    <CameraRig controlsRef={controlsRef} />
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={!selectedObjectId}
      target={HOUSE_LOOK}
      minDistance={10.5}
      maxDistance={24}
      minPolarAngle={.58}
      maxPolarAngle={1.3}
      minAzimuthAngle={.06}
      maxAzimuthAngle={1.48}
      enableRotate
      enableZoom
      enablePan={shiftPanning}
      enableDamping
      dampingFactor={.075}
      mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
      rotateSpeed={.72}
      zoomSpeed={.82}
      panSpeed={.62}
      onChange={clampCamera}
    />
  </>;
}

export function StudioScene() {
  const { invalidate } = useThree();
  const pendingPlacementId = useExperience((s) => s.pendingPlacementId);
  const objectRegistry = useExperience((s) => s.objectRegistry);
  const environmentTime = useExperience((s) => s.environmentTime);
  const environmentWeather = useExperience((s) => s.environmentWeather);
  const renderFidelity = useExperience((s) => s.renderFidelity);
  const applyEdit = useExperience((s) => s.applyEdit);
  const confirmPlacement = useExperience((s) => s.confirmPlacement);
  const environmentProfile = ENVIRONMENT_PROFILES[environmentWeather] || ENVIRONMENT_PROFILES.clear;
  const fidelityProfile = renderFidelityProfile(renderFidelity);
  const daylight = daylightFor(environmentTime);
  const backgroundColor = useMemo(() => new THREE.Color(environmentProfile.background).multiplyScalar(.74 + daylight * .26), [environmentProfile, daylight]);
  const groundColor = useMemo(() => new THREE.Color(environmentProfile.ground).multiplyScalar(.78 + daylight * .22), [environmentProfile, daylight]);
  const movePendingPlacement = (event) => {
    if (!pendingPlacementId) return;
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
        if (node.userData?.placementSurface) { supportId = node.userData.supportId || null; valid = true; break; }
        node = node.parent;
      }
      if (valid) { surface = { point: intersection.point, supportId }; break; }
    }
    if (!surface) return;
    applyEdit({
      id: pendingPlacementId,
      roomId: STUDIO_ID,
      position: [surface.point.x, surface.point.y + (entry.worldBaseLift || entry.baseLift || 0), surface.point.z],
      rotation: useExperience.getState().editTransforms[pendingPlacementId]?.rotation || [0, 0, 0],
      supportId: surface.supportId,
      transient: true,
    });
    invalidate();
  };
  const placePending = (event) => {
    if (!pendingPlacementId || event.button !== 0) return;
    event.stopPropagation();
    confirmPlacement();
  };
  return <group onPointerMoveCapture={movePendingPlacement} onPointerDownCapture={placePending}>
    <RenderPulse fps={fidelityProfile.ambientFps} />
    <ShadowRefresh />
    <color attach="background" args={[backgroundColor]} />
    <ambientLight intensity={environmentProfile.ambient * (.62 + daylight * .38)} color={environmentWeather === "clear" ? "#DCEAF3" : "#DCE4E6"} />
    <hemisphereLight intensity={environmentProfile.hemisphere * (.66 + daylight * .34)} color={environmentWeather === "rain" ? "#B6C8D1" : "#D7E6EF"} groundColor={groundColor} />
    <LateAfternoonSun />
    <Environment preset="apartment" environmentIntensity={environmentProfile.environment * (.62 + daylight * .38)} />
    <RainOutside active={environmentWeather === "rain"} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.7, 0]} receiveShadow>
      <planeGeometry args={[70, 70]} />
      <meshStandardMaterial color={groundColor} roughness={1} />
    </mesh>
    <ObjectScope id={STUDIO_ID}>
      <StudioShell />
      <KitchenZone />
      <LivingZone />
      <BedroomZone />
    </ObjectScope>
    <CreatedObjects />
    <StudioCameraControls />
  </group>;
}
