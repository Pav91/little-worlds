export const RENDER_FIDELITY_PROFILES = [
  {
    id: "performance",
    label: "Performance",
    dpr: .75,
    ambientFps: 12,
    sunShadowSize: 512,
    sunSpotShadowSize: 256,
    lampShadowSize: 256,
    shadowRadius: 1.4,
  },
  {
    id: "balanced",
    label: "Balanced",
    dpr: 1,
    ambientFps: 18,
    sunShadowSize: 1024,
    sunSpotShadowSize: 512,
    lampShadowSize: 512,
    shadowRadius: 2.15,
  },
  {
    id: "fidelity",
    label: "Fidelity",
    dpr: 1.35,
    ambientFps: 30,
    sunShadowSize: 2048,
    sunSpotShadowSize: 1024,
    lampShadowSize: 1024,
    shadowRadius: 3,
  },
];

export function renderFidelityProfile(value) {
  const index = Math.max(0, Math.min(RENDER_FIDELITY_PROFILES.length - 1, Math.round(Number(value) || 0)));
  return RENDER_FIDELITY_PROFILES[index];
}
