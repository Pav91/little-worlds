import * as THREE from "three";

export const COLORS = {
  timber: "#D6A568",
  timberLight: "#E4BE83",
  timberDark: "#8A5A38",
  cream: "#E8DFCF",
  paper: "#F4EFE6",
  navy: "#0D4778",
  blue: "#0D4778",
  red: "#E6533F",
  mustard: "#D99B18",
  green: "#58A94F",
  greenLight: "#82C16D",
  brass: "#8A5A38",
  glass: "#D7E8EC",
  charcoal: "#263746",
  plaster: "#E8DFCF",
  cabinet: "#B9C8C2",
  clay: "#E6533F",
  ceramic: "#EFE7D8",
  soil: "#493a30",
};

export function materialProps(kind, color) {
  const base = { color: color || COLORS[kind] || kind, roughness: 0.8, metalness: 0 };
  if (kind.startsWith("timber")) return { ...base, roughness: .72, envMapIntensity: .68 };
  if (kind === "brass") return { ...base, color: COLORS.brass, roughness: 0.66, metalness: 0.06, envMapIntensity: 0.48 };
  if (kind === "glass") return { color: COLORS.glass, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.52 };
  if (kind === "fabric") return { ...base, roughness: 0.92 };
  // MeshStandardMaterial does not support clearcoat; keep enamel matte and
  // let the shared environment lighting provide the restrained highlight.
  if (kind === "enamel") return { ...base, roughness: 0.56 };
  return base;
}

export const shared = {
  timber: new THREE.MeshStandardMaterial(materialProps("timber")),
  timberLight: new THREE.MeshStandardMaterial(materialProps("timberLight")),
  timberDark: new THREE.MeshStandardMaterial(materialProps("timberDark")),
  floor: new THREE.MeshStandardMaterial({ color: "#F0E3C7", roughness: .86, metalness: 0 }),
  platform: new THREE.MeshStandardMaterial({ color: "#F0E3C7", roughness: .88, metalness: 0 }),
  platformEdge: new THREE.MeshStandardMaterial({ color: "#D6A568", roughness: .78, metalness: 0 }),
  cream: new THREE.MeshStandardMaterial(materialProps("cream")),
  paper: new THREE.MeshStandardMaterial(materialProps("paper")),
  navy: new THREE.MeshStandardMaterial(materialProps("navy")),
  blue: new THREE.MeshStandardMaterial(materialProps("fabric", COLORS.blue)),
  red: new THREE.MeshStandardMaterial(materialProps("enamel", COLORS.red)),
  mustard: new THREE.MeshStandardMaterial(materialProps("enamel", COLORS.mustard)),
  green: new THREE.MeshStandardMaterial({ color: COLORS.green, roughness: .86, metalness: 0 }),
  brass: new THREE.MeshStandardMaterial(materialProps("brass")),
  charcoal: new THREE.MeshStandardMaterial(materialProps("charcoal")),
  plaster: new THREE.MeshStandardMaterial({ color: COLORS.plaster, roughness: .94, metalness: 0 }),
  paintedIvory: new THREE.MeshStandardMaterial({ color: "#E8DFCF", roughness: .84, metalness: 0 }),
  paintedGreen: new THREE.MeshStandardMaterial({ color: COLORS.cabinet, roughness: .8, metalness: 0 }),
  paintedClay: new THREE.MeshStandardMaterial({ color: COLORS.clay, roughness: .78, metalness: 0 }),
  fabricBlue: new THREE.MeshStandardMaterial({ color: COLORS.blue, roughness: .98, metalness: 0 }),
  fabricIvory: new THREE.MeshStandardMaterial({ color: "#EEE7DA", roughness: .98, metalness: 0 }),
  ceramic: new THREE.MeshStandardMaterial({ color: COLORS.ceramic, roughness: .58, metalness: 0 }),
  leaf: new THREE.MeshStandardMaterial({ color: COLORS.green, roughness: .86, metalness: 0 }),
  soil: new THREE.MeshStandardMaterial({ color: COLORS.soil, roughness: 1, metalness: 0 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: COLORS.charcoal, roughness: .52, metalness: .64 }),
  glass: new THREE.MeshPhysicalMaterial({ color: COLORS.glass, roughness: .16, metalness: 0, transparent: true, opacity: .66, transmission: .32, thickness: .28, ior: 1.46, envMapIntensity: 1.18, clearcoat: .2, clearcoatRoughness: .28 }),
};

export function applyFabricWeave(material, key, strength = .025) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHMFabricPosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHMFabricPosition = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHMFabricPosition;")
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
         float hmWeave = (sin(vHMFabricPosition.x * 92.0) * sin(vHMFabricPosition.y * 86.0 + vHMFabricPosition.z * 24.0)) * 0.5 + 0.5;
         roughnessFactor *= 0.97 + hmWeave * ${strength.toFixed(3)};`,
      )
      .replace(
        "#include <dithering_fragment>",
        `float hmFabricTone = sin(vHMFabricPosition.x * 4.1 + vHMFabricPosition.z * 3.7) * 0.5 + 0.5;
         gl_FragColor.rgb *= 0.985 + hmFabricTone * 0.026;
         #include <dithering_fragment>`,
      );
  };
  material.customProgramCacheKey = () => `hm-fabric-${key}`;
  return material;
}

[shared.blue, shared.fabricBlue, shared.fabricIvory].forEach((material, index) => applyFabricWeave(material, index));

shared.floor.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vHMFloorPosition;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHMFloorPosition = position;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vHMFloorPosition;")
    .replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
       float hmFloorGrain = sin(vHMFloorPosition.x * 13.0 + sin(vHMFloorPosition.z * 4.2) * 1.7) * 0.5 + 0.5;
       roughnessFactor *= 0.97 + hmFloorGrain * 0.045;`,
    )
    .replace(
      "#include <dithering_fragment>",
      `float hmBoardRow = floor((vHMFloorPosition.z + 5.0) / 0.62);
       float hmSeamZ = smoothstep(0.475, 0.5, abs(fract((vHMFloorPosition.z + 5.0) / 0.62) - 0.5));
       float hmSeamX = smoothstep(0.485, 0.5, abs(fract((vHMFloorPosition.x + mod(hmBoardRow, 2.0) * 1.2) / 2.4) - 0.5));
       float hmSeam = max(hmSeamZ, hmSeamX * 0.7);
       gl_FragColor.rgb *= 0.985 + hmFloorGrain * 0.025;
       gl_FragColor.rgb *= 1.0 - hmSeam * 0.035;
       #include <dithering_fragment>`,
    );
};
shared.floor.customProgramCacheKey = () => "hm-floor-planks-v1";

shared.plaster.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vHMPlasterPosition;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHMPlasterPosition = position;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vHMPlasterPosition;")
    .replace(
      "#include <dithering_fragment>",
      `float hmPlaster = sin(vHMPlasterPosition.x * 5.3 + sin(vHMPlasterPosition.y * 7.1) + vHMPlasterPosition.z * 3.7) * 0.5 + 0.5;
       gl_FragColor.rgb *= 0.985 + hmPlaster * 0.025;
       #include <dithering_fragment>`,
    );
};
shared.plaster.customProgramCacheKey = () => "hm-plaster-v1";

// One lightweight procedural grain program serves every timber mesh. It keeps
// the material authored in flat ambient light without texture downloads or
// per-object materials, and preserves batching as the library grows.
[shared.timber, shared.timberLight, shared.timberDark].forEach((material, index) => {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHMPosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHMPosition = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHMPosition;")
      .replace(
        "#include <dithering_fragment>",
        `float hmGrain = sin(vHMPosition.y * ${18 + index * 3}.0 + sin(vHMPosition.x * 3.7) * 1.8) * 0.5 + 0.5;
         float hmTone = sin(vHMPosition.x * 2.3 + vHMPosition.z * 1.7 + ${index}.0) * 0.5 + 0.5;
         gl_FragColor.rgb *= 0.968 + hmGrain * 0.036 + hmTone * 0.014;
         #include <dithering_fragment>`,
      );
  };
  material.customProgramCacheKey = () => `hm-timber-${index}`;
});
