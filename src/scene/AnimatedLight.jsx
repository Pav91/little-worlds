import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useExperience } from "../state/experience.js";
import { renderFidelityProfile } from "./renderFidelity.js";

export function AnimatedPointLight({
  position = [0, 0, 0],
  intensity = 1,
  distance = 4,
  color = "#ffd39a",
  phase = 0,
  castShadow = false,
  decay = 1.65,
}) {
  const light = useRef();
  useFrame(({ clock }) => {
    if (!light.current) return;
    const time = clock.getElapsedTime();
    const slowCloud = Math.sin(time * .31 + phase) * .012;
    const filament = Math.sin(time * 2.7 + phase * 1.7) * .006;
    light.current.intensity = intensity * (1 + slowCloud + filament);
  });
  return <pointLight
    ref={light}
    position={position}
    intensity={intensity}
    distance={distance}
    decay={decay}
    color={color}
    castShadow={castShadow}
    shadow-mapSize={[512, 512]}
    shadow-bias={-.00015}
    shadow-normalBias={.025}
  />;
}

export function AnimatedLampLight({
  position = [0, 0, 0],
  intensity = 3,
  distance = 7,
  color = "#ffd39a",
  phase = 0,
  castShadow = true,
}) {
  const renderFidelity = useExperience((state) => state.renderFidelity);
  const fidelityProfile = renderFidelityProfile(renderFidelity);
  const downLight = useRef();
  const upLight = useRef();
  const fillLight = useRef();
  const downTarget = useRef();
  const upTarget = useRef();

  useEffect(() => {
    if (downLight.current && downTarget.current) downLight.current.target = downTarget.current;
    if (upLight.current && upTarget.current) upLight.current.target = upTarget.current;
    downTarget.current?.updateMatrixWorld();
    upTarget.current?.updateMatrixWorld();
  }, [fidelityProfile.id]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const shimmer = 1 + Math.sin(time * .31 + phase) * .012 + Math.sin(time * 2.7 + phase * 1.7) * .006;
    if (downLight.current) downLight.current.intensity = intensity * 1.08 * shimmer;
    if (upLight.current) upLight.current.intensity = intensity * .42 * shimmer;
    if (fillLight.current) fillLight.current.intensity = intensity * .18 * shimmer;
  });

  return <group position={position} name="shaded-lamp-light">
    <object3D ref={downTarget} position={[0, -3.2, .18]} />
    <object3D ref={upTarget} position={[0, 3, -.12]} />
    <spotLight
      key={`lamp-shadow-${fidelityProfile.id}`}
      ref={downLight}
      intensity={intensity * 1.08}
      distance={distance}
      angle={.88}
      penumbra={.9}
      decay={2}
      color={color}
      castShadow={castShadow}
      shadow-mapSize={[fidelityProfile.lampShadowSize, fidelityProfile.lampShadowSize]}
      shadow-camera-near={.08}
      shadow-camera-far={distance}
      shadow-bias={-.00012}
      shadow-normalBias={.018}
    />
    <spotLight
      ref={upLight}
      intensity={intensity * .42}
      distance={distance * .72}
      angle={1.02}
      penumbra={1}
      decay={2}
      color={color}
    />
    <pointLight ref={fillLight} intensity={intensity * .18} distance={distance * .62} decay={2} color={color} />
  </group>;
}
