import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { atmos, makeSkyDome } from './atmos';

export type Mood = 'normal' | 'tense' | 'memory' | 'dim';

interface MoodSettings {
  sun: THREE.Color; sunI: number;
  sky: THREE.Color; ground: THREE.Color; hemiI: number;
  horizon: THREE.Color; hazeCool: THREE.Color; zenith: THREE.Color; sunGlow: THREE.Color;
  fogDensity: number; heightFog: number; rim: THREE.Color; rimK: number;
  tint: THREE.Color; sat: number; contrast: number; vignette: number; bloom: number;
}

const C = (h: number) => new THREE.Color(h);
// Red dwarf light, keyed from the concept paintings: a warm peach sun, lavender sky light, so every
// shadow goes cool. A peach horizon on the sun side, dusty lavender away from it. No white anywhere.
const MOODS: Record<Mood, MoodSettings> = {
  normal: {
    sun: C(0xffd29c), sunI: 3.9,
    sky: C(0x9c94b4), ground: C(0xc89c6a), hemiI: 1.4,
    horizon: C(0xeeb888), hazeCool: C(0xc4a8ae), zenith: C(0x9c8cb0), sunGlow: C(0xffc890),
    fogDensity: 0.011, heightFog: 0.5, rim: C(0xffc49a), rimK: 0.55,
    tint: new THREE.Color(1.0, 1.0, 1.0), sat: 1.0, contrast: 1.05, vignette: 0.32, bloom: 0.45,
  },
  tense: {
    sun: C(0xffb282), sunI: 3.3,
    sky: C(0x8a6e94), ground: C(0xa06a4a), hemiI: 1.15,
    horizon: C(0xe89a70), hazeCool: C(0xa87c90), zenith: C(0x7a6490), sunGlow: C(0xffa870),
    fogDensity: 0.013, heightFog: 0.6, rim: C(0xffa878), rimK: 0.65,
    tint: new THREE.Color(1.03, 0.98, 0.95), sat: 0.95, contrast: 1.12, vignette: 0.55, bloom: 0.55,
  },
  memory: {
    sun: C(0x9ab8ff), sunI: 1.8,
    sky: C(0x6f8fc0), ground: C(0x2a3a5a), hemiI: 1.2,
    horizon: C(0x6a88c0), hazeCool: C(0x4a5a90), zenith: C(0x2a3060), sunGlow: C(0x9ac0ff),
    fogDensity: 0.02, heightFog: 0.8, rim: C(0x9ad0ff), rimK: 0.8,
    tint: new THREE.Color(0.9, 0.97, 1.1), sat: 0.6, contrast: 1.04, vignette: 0.7, bloom: 1.0,
  },
  dim: {
    sun: C(0xffb07a), sunI: 2.4,
    sky: C(0x8a82a4), ground: C(0x7a5a44), hemiI: 1.1,
    horizon: C(0xd8a080), hazeCool: C(0xa08aa0), zenith: C(0x7c7096), sunGlow: C(0xffb080),
    fogDensity: 0.014, heightFog: 0.6, rim: C(0xffb890), rimK: 0.45,
    tint: new THREE.Color(0.98, 1.0, 1.0), sat: 0.95, contrast: 1.08, vignette: 0.5, bloom: 0.6,
  },
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uSat: { value: 1 },
    uContrast: { value: 1 },
    uVignette: { value: 0.4 },
    uTime: { value: 0 },
    uGrain: { value: 0.035 },
    uPaint: { value: 0.75 },   // Kuwahara brush-patch blend, 0 = off
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec3 uTint; uniform float uSat, uContrast, uVignette, uTime, uGrain, uPaint;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (uPaint > 0.0) {
        // Kuwahara, four 3x3 quadrants: take the mean of the calmest one. Flat areas turn into soft
        // brush patches and edges stay sharp, which reads as paint rather than polygons.
        vec2 px = 1.0 / uRes;
        vec3 m[4]; vec3 s2[4];
        for (int q = 0; q < 4; q++) { m[q] = vec3(0.0); s2[q] = vec3(0.0); }
        for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
          vec3 t = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * px).rgb;
          vec3 tt = t * t;
          if (i <= 0 && j <= 0) { m[0] += t; s2[0] += tt; }
          if (i >= 0 && j <= 0) { m[1] += t; s2[1] += tt; }
          if (i <= 0 && j >= 0) { m[2] += t; s2[2] += tt; }
          if (i >= 0 && j >= 0) { m[3] += t; s2[3] += tt; }
        }
        float best = 1e9; vec3 k = c.rgb;
        for (int q = 0; q < 4; q++) {
          vec3 mu = m[q] / 9.0; vec3 v = abs(s2[q] / 9.0 - mu * mu);
          float sv = v.r + v.g + v.b;
          if (sv < best) { best = sv; k = mu; }
        }
        c.rgb = mix(c.rgb, k, uPaint);
      }
      vec3 col = c.rgb * uTint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.18) * uContrast + 0.18;
      vec2 d = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float v = smoothstep(0.95, 0.25, length(d) * (0.8 + uVignette));
      col *= mix(1.0 - uVignette * 0.8, 1.0, v);
      col += (hash(vUv * uRes + fract(uTime) * 91.0) - 0.5) * uGrain * (0.4 + l);
      gl_FragColor = vec4(max(col, 0.0), c.a);
    }
  `,
};

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private grade: ShaderPass;
  private renderPass: RenderPass;
  private moodFrom: MoodSettings = cloneMood(MOODS.normal);
  private moodTo: MoodSettings = MOODS.normal;
  private moodT = 1;
  private moodDur = 1;
  private cur: MoodSettings = cloneMood(MOODS.normal);
  readonly sunDir = new THREE.Vector3();

  constructor(readonly host: HTMLElement, camera: THREE.Camera, sunAzimuth: number, sunElevation: number) {
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    r.setSize(host.clientWidth, host.clientHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.15;
    host.appendChild(r.domElement);
    this.renderer = r;

    this.scene.add(makeSkyDome());

    // Sun: azimuth in degrees clockwise from north, elevation above horizon.
    const az = THREE.MathUtils.degToRad(sunAzimuth), el = THREE.MathUtils.degToRad(sunElevation);
    this.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    atmos.uSunDir.value.copy(this.sunDir);
    this.sun = new THREE.DirectionalLight(this.cur.sun, this.cur.sunI);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera as THREE.OrthographicCamera;
    s.left = -34; s.right = 34; s.top = 34; s.bottom = -34; s.near = 1; s.far = 180;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(this.cur.sky, this.cur.ground, this.cur.hemiI);
    this.scene.add(this.hemi);

    const size = new THREE.Vector2(host.clientWidth, host.clientHeight);
    this.composer = new EffectComposer(r);
    this.renderPass = new RenderPass(this.scene, camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(size.clone().multiplyScalar(0.5), this.cur.bloom, 0.55, 0.92);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.applyMood();
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w / 2, h / 2);
    this.grade.uniforms.uRes.value.set(w, h);
  }

  /** Keep the shadow box centred on what the camera looks at. */
  followShadow(target: THREE.Vector3, ahead?: THREE.Vector3) {
    // centre the box a little beyond the target, where a low camera sees most ground;
    // snap to shadow texels to stop shimmering while the camera moves
    const texel = 68 / this.sun.shadow.mapSize.x;
    const snapped = target.clone();
    if (ahead) snapped.add(ahead);
    snapped.x = Math.round(snapped.x / texel) * texel;
    snapped.z = Math.round(snapped.z / texel) * texel;
    this.sun.target.position.copy(snapped);
    this.sun.position.copy(snapped).addScaledVector(this.sunDir, 70);
  }

  setShadowSize(n: number) {
    if (this.sun.shadow.mapSize.x === n) return;
    this.sun.shadow.mapSize.set(n, n);
    this.sun.shadow.map?.dispose();
    (this.sun.shadow as any).map = null;
  }
  setBloom(on: boolean) { this.bloom.enabled = on; }
  setPaint(k: number) { this.grade.uniforms.uPaint.value = k; }

  setMood(m: Mood, duration = 1.2) {
    this.moodFrom = cloneMood(this.cur);
    this.moodTo = MOODS[m];
    this.moodT = 0;
    this.moodDur = Math.max(0.01, duration);
  }

  update(dt: number, t: number, camera?: THREE.Camera) {
    if (camera) atmos.uSunView.value.copy(this.sunDir).transformDirection(camera.matrixWorldInverse);
    const dome = this.scene.getObjectByName('sky') as THREE.Mesh | undefined;
    if (dome) { if (camera) dome.position.copy(camera.position); ((dome.material as THREE.ShaderMaterial).uniforms.uTime.value = t); }
    if (this.moodT < 1) {
      this.moodT = Math.min(1, this.moodT + dt / this.moodDur);
      const k = this.moodT * this.moodT * (3 - 2 * this.moodT);
      lerpMood(this.cur, this.moodFrom, this.moodTo, k);
      this.applyMood();
    }
    this.grade.uniforms.uTime.value = t;
  }

  private applyMood() {
    const c = this.cur;
    this.sun.color.copy(c.sun); this.sun.intensity = c.sunI;
    this.hemi.color.copy(c.sky); this.hemi.groundColor.copy(c.ground); this.hemi.intensity = c.hemiI;
    atmos.uHorizon.value.copy(c.horizon); atmos.uHazeCool.value.copy(c.hazeCool);
    atmos.uZenith.value.copy(c.zenith); atmos.uSunGlow.value.copy(c.sunGlow);
    atmos.uFogDensity.value = c.fogDensity; atmos.uHeightFog.value = c.heightFog;
    atmos.uRimCol.value.copy(c.rim); atmos.uRimK.value = c.rimK;
    this.grade.uniforms.uTint.value.copy(c.tint);
    this.grade.uniforms.uSat.value = c.sat;
    this.grade.uniforms.uContrast.value = c.contrast;
    this.grade.uniforms.uVignette.value = c.vignette;
    this.bloom.strength = c.bloom;
  }

  render() { this.composer.render(); }
}

function cloneMood(m: MoodSettings): MoodSettings {
  return {
    ...m,
    sun: m.sun.clone(), sky: m.sky.clone(), ground: m.ground.clone(), tint: m.tint.clone(),
    horizon: m.horizon.clone(), hazeCool: m.hazeCool.clone(), zenith: m.zenith.clone(), sunGlow: m.sunGlow.clone(), rim: m.rim.clone(),
  };
}
function lerpMood(out: MoodSettings, a: MoodSettings, b: MoodSettings, k: number) {
  out.sun.copy(a.sun).lerp(b.sun, k); out.sunI = a.sunI + (b.sunI - a.sunI) * k;
  out.sky.copy(a.sky).lerp(b.sky, k); out.ground.copy(a.ground).lerp(b.ground, k); out.hemiI = a.hemiI + (b.hemiI - a.hemiI) * k;
  out.horizon.copy(a.horizon).lerp(b.horizon, k); out.hazeCool.copy(a.hazeCool).lerp(b.hazeCool, k);
  out.zenith.copy(a.zenith).lerp(b.zenith, k); out.sunGlow.copy(a.sunGlow).lerp(b.sunGlow, k);
  out.rim.copy(a.rim).lerp(b.rim, k); out.rimK = a.rimK + (b.rimK - a.rimK) * k;
  out.fogDensity = a.fogDensity + (b.fogDensity - a.fogDensity) * k; out.heightFog = a.heightFog + (b.heightFog - a.heightFog) * k;
  out.tint.copy(a.tint).lerp(b.tint, k);
  out.sat = a.sat + (b.sat - a.sat) * k;
  out.contrast = a.contrast + (b.contrast - a.contrast) * k;
  out.vignette = a.vignette + (b.vignette - a.vignette) * k;
  out.bloom = a.bloom + (b.bloom - a.bloom) * k;
}
