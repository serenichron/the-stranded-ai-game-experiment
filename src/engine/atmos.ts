import * as THREE from 'three';

// The air. One sky function drives the sky dome, the distance fog and the height haze,
// so the horizon and the haze on far things are always the same colour.
// Colours are linear and go through the ACES tone map in the output pass, like everything else.

export const atmos = {
  uSunDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() },  // world space, towards the sun
  uSunView: { value: new THREE.Vector3(0, 0, 1) },                  // view space, updated every frame
  uHorizon: { value: new THREE.Color() },   // sky at the horizon, sun side
  uHazeCool: { value: new THREE.Color() },  // sky at the horizon, away from the sun (lavender)
  uZenith: { value: new THREE.Color() },
  uSunGlow: { value: new THREE.Color() },
  uFogStart: { value: 30 },                 // metres from the camera before haze starts
  uFogDensity: { value: 0.011 },
  uHeightFog: { value: 0.55 },              // haze that pools low (the Scar, hollows)
  uFogTop: { value: 0.6 },                  // world y the height haze fades out above
  uRimCol: { value: new THREE.Color() },
  uRimK: { value: 0.5 },
  uMottle: { value: 1 },                    // world-space colour variation, 0 = off
  uBrush: { value: 1 },                     // brush strokes and warm-top bias in the albedo (diagnostic switch)
  uSurface: { value: 1 },                   // cracks on ground, stone and rock, 0 = off (Low quality)
};

/** GLSL: the sky colour for a direction, shared by the dome and the fog. */
export const SKY_GLSL = /* glsl */`
  uniform vec3 uSunDir; uniform vec3 uHorizon; uniform vec3 uHazeCool; uniform vec3 uZenith; uniform vec3 uSunGlow;
  vec3 skyCol(vec3 d) {
    float h = clamp(d.y, 0.0, 1.0);
    vec3 flat2 = normalize(vec3(d.x, 0.0, d.z) + 1e-5);
    vec3 sflat = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-5);
    float side = dot(flat2, sflat) * 0.5 + 0.5;          // 1 facing the sun, 0 facing away
    vec3 horizon = mix(uHazeCool, uHorizon, smoothstep(0.0, 1.0, side));
    vec3 c = mix(horizon, uZenith, pow(h, 0.5));
    float s = max(dot(d, uSunDir), 0.0);
    c += uSunGlow * (pow(s, 5.0) * 0.45 + pow(s, 48.0) * 0.8);
    return c;
  }
`;

const DOME_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // on the far plane
  }
`;
const DOME_FRAG = /* glsl */`
  ${SKY_GLSL}
  uniform float uTime;
  varying vec3 vDir;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec3 d = normalize(vDir);
    vec3 c = skyCol(d);
    // the red dwarf: a large pale disc, soft edged, never white-hot
    float s = dot(d, uSunDir);
    float disc = smoothstep(0.99935, 0.99965, s);
    c = mix(c, uSunGlow * 1.9 + vec3(0.25, 0.18, 0.1), disc);
    // thin streaks of cloud low in the sky, lit from the sun side
    if (d.y > 0.0) {
      vec2 q = d.xz / (d.y + 0.12) * 1.3 + vec2(uTime * 0.004, 0.0);
      float w = n2(q * vec2(0.6, 3.2)) * 0.65 + n2(q * vec2(1.3, 6.0) + 3.1) * 0.35;
      float band = smoothstep(0.55, 0.8, w) * smoothstep(0.02, 0.1, d.y) * (1.0 - smoothstep(0.25, 0.5, d.y));
      vec3 lit = mix(uHazeCool * 1.05, uSunGlow * 1.2 + uHorizon * 0.4, pow(max(s, 0.0), 2.0));
      c = mix(c, lit, band * 0.55);
    }
    // below the horizon the dome shows only haze (the far ground covers most of it)
    if (d.y < 0.0) c = mix(c, uHazeCool * 0.9 + uHorizon * 0.1, smoothstep(0.0, -0.2, d.y));
    gl_FragColor = vec4(c, 1.0);
  }
`;

export function makeSkyDome(): THREE.Mesh {
  const m = new THREE.ShaderMaterial({
    vertexShader: DOME_VERT, fragmentShader: DOME_FRAG,
    uniforms: { ...atmos, uTime: { value: 0 } },
    side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), m);
  dome.name = 'sky';
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  dome.userData.noMerge = true;
  return dome;
}
