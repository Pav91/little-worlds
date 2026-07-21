import { Canvas } from "@react-three/fiber";
import { Loader } from "@react-three/drei";
import * as THREE from "three";
import { StudioScene } from "./scene/StudioScene.jsx";
import { Interface } from "./ui/Interface.jsx";
import { HOUSE_CAMERA, useExperience } from "./state/experience.js";
import { renderFidelityProfile } from "./scene/renderFidelity.js";

export function App() {
  const renderFidelity = useExperience((state) => state.renderFidelity);
  const fidelityProfile = renderFidelityProfile(renderFidelity);
  const clearSceneSelection = () => {
    useExperience.getState().selectObject(null);
  };
  return (
    <main className="experience-shell">
      <Canvas
        frameloop="demand"
        shadows
        dpr={fidelityProfile.dpr}
        camera={{ position: HOUSE_CAMERA, fov: 31.5, near: 0.08, far: 90 }}
        gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
        onPointerMissed={clearSceneSelection}
        onCreated={({ gl, scene }) => {
          scene.background = new THREE.Color("#D4E4EE");
          gl.setClearColor("#D4E4EE", 1);
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.14;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.shadowMap.autoUpdate = false;
          gl.shadowMap.needsUpdate = true;
        }}
      >
        <StudioScene />
      </Canvas>
      <Interface />
      <Loader data-testid="loader" />
    </main>
  );
}
