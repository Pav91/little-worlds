import { useMemo } from "react";
import * as THREE from "three";
import { Rounded } from "../scene/Objects.jsx";
import { shared } from "../scene/materials.js";
import { compileObjectDNA } from "./objectPipeline.js";
import { AnimatedLampLight, AnimatedPointLight } from "../scene/AnimatedLight.jsx";

const generatedColorMaterials = {
  green: new THREE.MeshStandardMaterial({ color: "#58A94F", roughness: .84, metalness: .01 }),
  red: new THREE.MeshStandardMaterial({ color: "#E6533F", roughness: .82, metalness: .01 }),
  ivory: new THREE.MeshStandardMaterial({ color: "#F2E8D7", roughness: .86, metalness: .01 }),
  blue: new THREE.MeshStandardMaterial({ color: "#0D4778", roughness: .84, metalness: .01 }),
};

const variantScales = [
  [1, 1, 1],
  [1.06, .96, 1.03],
  [.96, 1.07, .95],
  [1.03, 1.02, .92],
];

function materialFor(part, dna, variant) {
  const primary = generatedColorMaterials[dna.paintFamily?.primary];
  if (part.materialClass === "glass") return shared.glass;
  if (part.materialClass === "metal") return variant % 2 ? shared.darkMetal : shared.brass;
  if (part.materialClass === "wood") return variant % 3 === 1 ? shared.timberDark : shared.timberLight;
  if (part.materialClass === "fabric") {
    if (primary) return primary;
    return variant % 2 ? shared.fabricIvory : shared.fabricBlue;
  }
  if (part.materialClass === "paper") return shared.paper;
  if (part.paintRole === "accent") return variant % 2 ? shared.paintedGreen : shared.paintedClay;
  if (part.paintRole === "secondary.body") return variant % 3 === 2 ? shared.paintedClay : shared.paintedIvory;
  return primary || shared.paintedGreen;
}

function OpenFrame({ size, material, radius }) {
  const [width, height, depth] = size;
  const thickness = Math.max(.055, Math.min(width, depth) * .085);
  return <group>
    {[-1, 1].flatMap((xSign) => [-1, 1].map((zSign) => <Rounded
      key={`${xSign}-${zSign}`}
      size={[thickness, height, thickness]}
      position={[xSign * (width - thickness) / 2, 0, zSign * (depth - thickness) / 2]}
      radius={Math.min(radius, thickness * .45)}
      material={material}
    />))}
    <Rounded size={[width, thickness, thickness]} position={[0, height / 2 - thickness / 2, -(depth - thickness) / 2]} radius={Math.min(radius, thickness * .45)} material={material} />
    <Rounded size={[width, thickness, thickness]} position={[0, height / 2 - thickness / 2, (depth - thickness) / 2]} radius={Math.min(radius, thickness * .45)} material={material} />
  </group>;
}

function TurnedVessel({ size, material, taper = .14 }) {
  const [width, height, depth] = size;
  const radius = Math.min(width, depth) / 2;
  const top = Math.max(radius * (1 - taper), radius * .52);
  return <group>
    <mesh material={material} castShadow receiveShadow>
      <cylinderGeometry args={[top, radius, height, 28]} />
    </mesh>
    <mesh position={[0, height / 2 - .025, 0]} rotation={[Math.PI / 2, 0, 0]} material={material} castShadow><torusGeometry args={[top * .86, Math.max(.018, radius * .06), 10, 24]} /></mesh>
  </group>;
}

function BranchFan({ size, material, count = 7 }) {
  const [width, height, depth] = size;
  return <group>
    {Array.from({ length: count }, (_, index) => {
      const angle = index * Math.PI * 2 / count + .28;
      const lift = index % 2 ? .16 : -.04;
      return <mesh
        key={index}
        position={[Math.cos(angle) * width * .16, lift, Math.sin(angle) * depth * .16]}
        rotation={[Math.cos(angle) * .42, -angle, Math.sin(angle) * .34]}
        scale={[width * .46, height * .2, depth * .18]}
        material={material}
        castShadow
      ><sphereGeometry args={[.5, 16, 10]} /></mesh>;
    })}
  </group>;
}

function CompiledPart({ part, dna, variant }) {
  const material = materialFor(part, dna, variant);
  const radius = part.modifiers?.radius || .08;
  const [width, height, depth] = part.dimensions;
  const rotation = part.rotation || [0, 0, 0];
  const common = { position: part.position, rotation };

  if (part.primitive === "open-frame") return <group {...common}><OpenFrame size={part.dimensions} material={material} radius={radius} /></group>;
  if (part.primitive === "turned-vessel") return <group {...common}><TurnedVessel size={part.dimensions} material={material} taper={part.modifiers?.taper} /></group>;
  if (part.primitive === "stem") return <mesh {...common} material={material} castShadow><cylinderGeometry args={[width / 2, width * .7, height, 16]} /></mesh>;
  if (part.primitive === "round-slab") return <mesh {...common} material={material} castShadow receiveShadow scale={[width, height, depth]}><cylinderGeometry args={[.5, .5, 1, 48]} /></mesh>;
  if (part.primitive === "shade") return <mesh {...common} material={material} castShadow receiveShadow><cylinderGeometry args={[width * .34, width / 2, height, 28]} /></mesh>;
  if (part.primitive === "ring-handle") return <mesh {...common} material={material} castShadow><torusGeometry args={[Math.max(width, height) * .42, Math.max(.018, Math.min(width, height, depth) * .22), 12, 28]} /></mesh>;
  if (part.primitive === "branch-fan") return <group {...common}><BranchFan size={part.dimensions} material={material} count={part.modifiers?.count} /></group>;
  if (part.primitive === "screen") return <group {...common}>
    <Rounded size={[width, height, depth]} radius={radius} material={material} />
    <Rounded size={[width * .84, height * .84, depth * .45]} position={[0, 0, depth * .65]} radius={radius * .7} material={shared.navy} />
  </group>;
  if (part.primitive === "footed-plinth") return <group {...common}>
    <Rounded size={part.dimensions} radius={radius} material={material} />
    {[-.36, .36].map((x) => <mesh key={x} position={[x * width, -height * .42, 0]} material={shared.brass} castShadow><cylinderGeometry args={[.035, .05, height * .34, 12]} /></mesh>)}
  </group>;
  if (part.primitive === "inset-shell") return <group {...common}>
    <Rounded size={part.dimensions} radius={radius} material={material} />
    <Rounded size={[width * .72, height * .7, Math.max(.025, depth * .06)]} position={[0, 0, depth / 2 + .018]} radius={radius * .68} material={shared.paintedIvory} />
  </group>;
  if (part.primitive === "soft-wedge") return <group {...common} rotation={[rotation[0] + (part.modifiers?.bow || 0), rotation[1], rotation[2]]}>
    <Rounded size={part.dimensions} radius={radius} material={material} />
  </group>;
  if (part.primitive === "captured-panel") return <group {...common}>
    <Rounded size={part.dimensions} radius={radius} material={material} />
    <Rounded size={[width * .72, height * .68, Math.max(.025, depth * .24)]} position={[0, 0, depth * .54]} radius={radius * .65} material={part.paintRole === "primary.body" ? shared.paintedIvory : shared.paintedGreen} />
  </group>;
  if (part.primitive === "rail") return <Rounded {...common} size={part.dimensions} radius={radius} material={material} />;
  if (part.primitive === "crowned-slab") return <group {...common} scale={[1, 1 + (part.modifiers?.crown || 0), 1]}>
    <Rounded size={part.dimensions} radius={radius} material={material} />
  </group>;
  return <Rounded {...common} size={part.dimensions} radius={radius} material={material} />;
}

export function CompiledGeneratedObject({ dna, variant = 0 }) {
  const compiled = useMemo(() => compileObjectDNA(dna), [dna]);
  const index = ((variant % variantScales.length) + variantScales.length) % variantScales.length;
  const lightHeight = useMemo(() => Math.max(...compiled.compiledParts.map((part) => part.position[1] + part.dimensions[1] / 2), .5), [compiled]);
  const emitsLight = dna.taxonomy?.category === "lighting";
  return <group scale={variantScales[index]} name={`compiled-${dna.id}`}>
    {compiled.compiledParts.map((part) => <CompiledPart key={part.id} part={part} dna={dna} variant={index} />)}
    {emitsLight && (dna.taxonomy?.type === "candle" ? <AnimatedPointLight
      position={[0, lightHeight * .84, .08]}
      intensity={.65}
      distance={2.8}
      decay={1.7}
      color="#ffd29a"
      phase={dna.seed % 11}
    /> : <AnimatedLampLight
      position={[0, lightHeight * .84, .08]}
      intensity={2.8}
      distance={6.5}
      color="#ffd29a"
      phase={dna.seed % 11}
    />)}
  </group>;
}
