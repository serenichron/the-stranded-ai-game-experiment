import * as THREE from 'three';
import type { CrystalColour, FxKind, HighlightStyle } from '../core/contracts';
import { CRYSTAL_HEX } from '../world/models/types';

export type FxColour = CrystalColour | 'teal';
export const FX_HEX: Record<FxColour, number> = { ...CRYSTAL_HEX, teal: 0x46e0cc };

// ------------------------------------------------------------------ particles

const MAX_P = 3000;

interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; r: number; g: number; b: number; drag: number; grav: number; additive: boolean }

const P_VERT = /* glsl */`
  attribute float aSize; attribute vec4 aColour;
  varying vec4 vColour;
  uniform float uScale;
  void main() {
    vColour = aColour;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale;
  }
`;
const P_FRAG = /* glsl */`
  varying vec4 vColour;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.0, length(d));
    gl_FragColor = vec4(vColour.rgb, vColour.a * a);
  }
`;

class ParticlePool {
  readonly points: THREE.Points;
  private list: P[] = [];
  private pos = new Float32Array(MAX_P * 3);
  private size = new Float32Array(MAX_P);
  private col = new Float32Array(MAX_P * 4);
  private geo = new THREE.BufferGeometry();
  readonly mat: THREE.ShaderMaterial;

  constructor(additive: boolean) {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColour', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: P_VERT, fragmentShader: P_FRAG,
      uniforms: { uScale: { value: 1 } },
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  add(p: P) { if (this.list.length < MAX_P) this.list.push(p); }

  update(dt: number) {
    const L = this.list;
    let n = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.life += dt;
      if (p.life >= p.max) continue;
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vy = p.vy * dr - p.grav * dt; p.vz *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const k = p.life / p.max;
      const fade = Math.min(1, k * 8) * (1 - k);
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.size[n] = p.size * (1 - k * 0.4);
      this.col[n * 4] = p.r; this.col[n * 4 + 1] = p.g; this.col[n * 4 + 2] = p.b; this.col[n * 4 + 3] = fade;
      L[n++] = p;
    }
    L.length = n;
    this.geo.setDrawRange(0, n);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aColour as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ------------------------------------------------------------------ the effects layer

interface FloatingText { el: HTMLDivElement; pos: THREE.Vector3; t: number; max: number }
interface Bolt { mesh: THREE.Object3D; light: THREE.PointLight; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; colour: THREE.Color; resolve: () => void; kind: string }
interface Flash { light: THREE.PointLight; t: number; max: number; peak: number }

const HL_COLOURS: Record<HighlightStyle, number> = {
  move: 0x6fd3c4, target: 0xff6a3a, danger: 0xd8413a, interact: 0xffd27a, path: 0xf0d9a8, selected: 0xffe6a8,
};

export class Effects {
  readonly group = new THREE.Group();
  private add = new ParticlePool(true);
  private norm = new ParticlePool(false);
  private motes: THREE.Points;
  private moteData: Float32Array;
  private texts: FloatingText[] = [];
  private bolts: Bolt[] = [];
  private flashes: Flash[] = [];
  private hlGroups = new Map<number, THREE.Group>();
  private hlNext = 1;
  private cones = new Map<string, THREE.Mesh>();
  readonly hover: THREE.Mesh;
  readonly entityRing: THREE.Mesh;
  private textLayer: HTMLDivElement;
  // Fixed pool: adding or removing lights at runtime recompiles every lit shader.
  private lightPool: THREE.PointLight[] = [];
  private lightNext = 0;

  constructor(host: HTMLElement, private heightAt: (x: number, z: number) => number, private project: (p: THREE.Vector3) => { x: number; y: number } | null) {
    this.group.add(this.add.points, this.norm.points);
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffffff, 0, 7, 1.6); this.lightPool.push(l); this.group.add(l); }

    // Drifting dust in the low light. Lives in a box around the camera target.
    const N = 700;
    this.moteData = new Float32Array(N * 3);
    const g = new THREE.BufferGeometry();
    const size = new Float32Array(N), col = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      this.moteData[i * 3] = (Math.random() - 0.5) * 50;
      this.moteData[i * 3 + 1] = Math.random() * 7;
      this.moteData[i * 3 + 2] = (Math.random() - 0.5) * 50;
      size[i] = 1.2 + Math.random() * 2.2;
      col[i * 4] = 1; col[i * 4 + 1] = 0.78 + Math.random() * 0.15; col[i * 4 + 2] = 0.5; col[i * 4 + 3] = 0.12 + Math.random() * 0.25;
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.moteData, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aColour', new THREE.BufferAttribute(col, 4));
    const mm = new THREE.ShaderMaterial({ vertexShader: P_VERT, fragmentShader: P_FRAG, uniforms: { uScale: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.motes = new THREE.Points(g, mm);
    this.motes.frustumCulled = false;
    this.group.add(this.motes);

    // hover cursor: a soft ring on the tile under the pointer
    this.hover = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.46, 32), new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.55, depthWrite: false }));
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.renderOrder = 3;
    this.hover.visible = false;
    this.group.add(this.hover);

    this.entityRing = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.62, 40), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.7, depthWrite: false }));
    this.entityRing.rotation.x = -Math.PI / 2;
    this.entityRing.renderOrder = 3;
    this.entityRing.visible = false;
    this.group.add(this.entityRing);

    this.textLayer = document.createElement('div');
    Object.assign(this.textLayer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' });
    host.appendChild(this.textLayer);
    if (!document.getElementById('fx-style')) {
      const st = document.createElement('style');
      st.id = 'fx-style';
      st.textContent = `
        .fx-float { position: absolute; transform: translate(-50%, -100%); font: 600 15px/1 Georgia, 'Times New Roman', serif;
          letter-spacing: .04em; white-space: nowrap; text-shadow: 0 1px 2px #000, 0 0 8px rgba(0,0,0,.6); will-change: transform, opacity; }
        .fx-float.good { color: #cfe9b0 } .fx-float.bad { color: #ff9a7a } .fx-float.neutral { color: #f1dfbd } .fx-float.crystal { color: #9fe8ff }
      `;
      document.head.appendChild(st);
    }
  }

  /** Ambient particle layers on or off (quality setting). */
  setAmbient(motes: boolean, haze: boolean) {
    this.motes.visible = motes;
    if (this.haze) this.haze.pts.visible = haze;
  }

  setPointScale(s: number) {
    this.add.mat.uniforms.uScale.value = s;
    this.norm.mat.uniforms.uScale.value = s;
    (this.motes.material as THREE.ShaderMaterial).uniforms.uScale.value = s;
    if (this.haze) (this.haze.pts.material as THREE.ShaderMaterial).uniforms.uScale.value = s;
  }

  // -------------------------------------------------------------- haze over the Scar

  private haze: { pts: THREE.Points; data: Float32Array; x0: number; x1: number } | null = null;
  /** Slow dust drifting in a long band (the Scar). z0..z1 across, y0..y1 in height. */
  addHaze(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, n = 140) {
    const data = new Float32Array(n * 3), size = new Float32Array(n), col = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      data[i * 3] = x0 + Math.random() * (x1 - x0);
      data[i * 3 + 1] = y0 + Math.random() * (y1 - y0);
      data[i * 3 + 2] = z0 + Math.random() * (z1 - z0);
      size[i] = 70 + Math.random() * 90;
      col[i * 4] = 0.55; col[i * 4 + 1] = 0.28; col[i * 4 + 2] = 0.16; col[i * 4 + 3] = 0.025 + Math.random() * 0.035;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(data, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aColour", new THREE.BufferAttribute(col, 4));
    const m = new THREE.ShaderMaterial({ vertexShader: P_VERT, fragmentShader: P_FRAG, uniforms: { uScale: { value: 1 } }, transparent: true, depthWrite: false });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    this.group.add(pts);
    this.haze = { pts, data, x0, x1 };
  }

  // -------------------------------------------------------------- bursts

  burst(kind: FxKind, at: THREE.Vector3, colour?: FxColour, intensity = 1, height = 1) {
    const c = new THREE.Color(FX_HEX[colour ?? 'amber']);
    const R = Math.random;
    const emit = (n: number, f: (i: number) => Partial<P>, additive = true) => {
      for (let i = 0; i < Math.round(n * intensity); i++) {
        const base: P = { x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 6, r: c.r, g: c.g, b: c.b, drag: 1.5, grav: 0, additive };
        (additive ? this.add : this.norm).add(Object.assign(base, f(i)));
      }
    };
    switch (kind) {
      case 'hit': {
        emit(26, () => { const a = R() * Math.PI * 2, s = 2 + R() * 4; return { y: at.y + height * 0.6, vx: Math.cos(a) * s, vy: 1 + R() * 3, vz: Math.sin(a) * s, max: 0.35 + R() * 0.3, size: 5 + R() * 5, r: 1, g: 0.75, b: 0.4, grav: 9, drag: 3 }; });
        this.flash(at.clone().setY(at.y + height * 0.6), 0xffb070, 6, 0.18);
        break;
      }
      case 'wound': {
        emit(18, () => { const a = R() * Math.PI * 2, s = 1 + R() * 2; return { y: at.y + height * 0.6, vx: Math.cos(a) * s, vy: R() * 2, vz: Math.sin(a) * s, max: 0.6, size: 7 + R() * 5, r: 0.85, g: 0.18, b: 0.12, grav: 5 }; }, false);
        this.flash(at.clone().setY(at.y + height * 0.6), 0xff3a2a, 4, 0.25);
        break;
      }
      case 'miss': {
        emit(14, (i) => { const a = (i / 14) * Math.PI * 2; return { y: at.y + height * 0.5, vx: Math.cos(a) * 3, vy: 0.2, vz: Math.sin(a) * 3, max: 0.4, size: 5, r: 0.9, g: 0.85, b: 0.75, drag: 5 }; }, false);
        break;
      }
      case 'dust': {
        emit(16, () => { const a = R() * Math.PI * 2, s = 0.5 + R() * 1.5; return { x: at.x + (R() - 0.5) * 0.5, y: at.y + 0.1, z: at.z + (R() - 0.5) * 0.5, vx: Math.cos(a) * s, vy: 0.4 + R() * 0.8, vz: Math.sin(a) * s, max: 0.9 + R() * 0.8, size: 14 + R() * 14, r: 0.72, g: 0.58, b: 0.42, drag: 2.2, grav: -0.1 }; }, false);
        break;
      }
      case 'channel': {
        emit(60, () => { const a = R() * Math.PI * 2, rad = 0.9 + R() * 0.6; return { x: at.x + Math.cos(a) * rad, y: at.y + R() * height * 1.2, z: at.z + Math.sin(a) * rad, vx: -Math.cos(a) * rad * 1.6, vy: 0.6 + R(), vz: -Math.sin(a) * rad * 1.6, max: 0.6 + R() * 0.5, size: 5 + R() * 6, drag: 0.5 }; });
        this.flash(at.clone().setY(at.y + height * 0.8), c.getHex(), 5, 0.9);
        break;
      }
      case 'shatter': {
        emit(50, () => { const a = R() * Math.PI * 2, s = 2 + R() * 5; return { y: at.y + 0.5, vx: Math.cos(a) * s, vy: 2 + R() * 4, vz: Math.sin(a) * s, max: 0.7 + R() * 0.6, size: 4 + R() * 6, grav: 12, drag: 1 }; });
        this.flash(at.clone().setY(at.y + 0.6), c.getHex(), 9, 0.35);
        break;
      }
      case 'crystal-glow': {
        emit(24, () => { const a = R() * Math.PI * 2, s = 0.4 + R() * 0.6; return { y: at.y + 0.4 + R() * 0.6, vx: Math.cos(a) * s, vy: 0.6 + R() * 0.8, vz: Math.sin(a) * s, max: 1.2 + R(), size: 5 + R() * 7, drag: 0.4 }; });
        this.flash(at.clone().setY(at.y + 0.7), c.getHex(), 5, 1.2);
        break;
      }
      case 'memory-echo': {
        const az = new THREE.Color(FX_HEX.azure);
        emit(140, () => { const a = R() * Math.PI * 2, rad = R() * 2.5; return { x: at.x + Math.cos(a) * rad, y: at.y + R() * 0.3, z: at.z + Math.sin(a) * rad, vx: 0, vy: 0.5 + R() * 1.4, vz: 0, max: 2 + R() * 2, size: 5 + R() * 9, r: az.r, g: az.g, b: az.b, drag: 0.2 }; });
        this.flash(at.clone().setY(at.y + 1), FX_HEX.azure, 8, 3);
        break;
      }
      case 'sleep': {
        const am = new THREE.Color(FX_HEX.amber);
        emit(30, () => ({ x: at.x + (R() - 0.5) * 1.2, y: at.y + height * (0.3 + R() * 0.7), z: at.z + (R() - 0.5) * 1.2, vx: 0, vy: -0.3 - R() * 0.3, vz: 0, max: 1.5 + R(), size: 5 + R() * 4, r: am.r, g: am.g, b: am.b, drag: 0.3 }));
        break;
      }
    }
  }

  private takeLight(): THREE.PointLight {
    const l = this.lightPool[this.lightNext++ % this.lightPool.length];
    // steal it from whoever had it
    this.flashes = this.flashes.filter((f) => f.light !== l);
    return l;
  }

  flash(p: THREE.Vector3, hex: number, peak: number, dur: number) {
    const light = this.takeLight();
    light.color.set(hex); light.intensity = 0; light.distance = 7;
    light.position.copy(p);
    this.flashes.push({ light, t: 0, max: dur, peak });
  }

  // -------------------------------------------------------------- bolts

  bolt(from: THREE.Vector3, to: THREE.Vector3, colour: FxColour, kind: 'beam' | 'shard' | 'slug'): Promise<void> {
    return new Promise((resolve) => {
      const c = new THREE.Color(FX_HEX[colour]);
      let mesh: THREE.Object3D;
      const dist = from.distanceTo(to);
      if (kind === 'beam') {
        const geo = new THREE.CylinderGeometry(0.06, 0.06, 1, 8, 1, true);
        geo.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(4), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
        mesh = m;
      } else {
        const geo = kind === 'shard' ? new THREE.OctahedronGeometry(0.12) : new THREE.SphereGeometry(0.09, 8, 6);
        mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(kind === 'shard' ? 4 : 2) }));
      }
      const light = this.takeLight();
      light.color.copy(c); light.intensity = 4; light.distance = 5;
      this.group.add(mesh);
      const dur = kind === 'beam' ? 0.35 : Math.max(0.15, dist / (kind === 'shard' ? 16 : 22));
      this.bolts.push({ mesh, light, from: from.clone(), to: to.clone(), t: 0, dur, colour: c, resolve, kind });
    });
  }

  // -------------------------------------------------------------- seam pulse (the activation code)

  private pulses: { mesh: THREE.Mesh; pts: THREE.Vector3[]; cum: number[]; len: number; t: number; dur: number; fade: number; spark: number; colour: THREE.Color; resolve: (() => void) | null }[] = [];

  /**
   * A bright head runs along a polyline laid on the floor, leaving a trail that fades.
   * Resolves when the head arrives; the trail fades out on its own afterwards.
   */
  pulseLine(points: THREE.Vector3[], dur: number, colour: FxColour): Promise<void> {
    return new Promise((resolve) => {
      // resample so the strip is smooth and the distance attribute is even
      const pts: THREE.Vector3[] = [points[0].clone()];
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i], n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.25));
        for (let k = 1; k <= n; k++) pts.push(a.clone().lerp(b, k / n));
      }
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
      const pos: number[] = [], dist: number[] = [], side: number[] = [];
      const w = 0.12;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
        const nx = -dz / l, nz = dx / l;
        pos.push(pts[i].x + nx * w, pts[i].y, pts[i].z + nz * w, pts[i].x - nx * w, pts[i].y, pts[i].z - nz * w);
        dist.push(cum[i], cum[i]); side.push(1, -1);
      }
      const idx: number[] = [];
      for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1));
      g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
      g.setIndex(idx);
      const c = new THREE.Color(FX_HEX[colour]);
      const m = new THREE.ShaderMaterial({
        uniforms: { uHead: { value: 0 }, uFade: { value: 1 }, uCol: { value: c.clone().multiplyScalar(3.2) } },
        vertexShader: `attribute float aDist; attribute float aSide; varying float vD; varying float vS;
          void main() { vD = aDist; vS = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uHead; uniform float uFade; uniform vec3 uCol; varying float vD; varying float vS;
          void main() {
            float ahead = step(vD, uHead);
            float head = exp(-abs(uHead - vD) * 2.2);
            float trail = ahead * exp(-(uHead - vD) * 0.12) * 0.55;
            float edge = 1.0 - abs(vS);
            float a = (head * 1.6 + trail) * (0.35 + 0.65 * edge) * uFade;
            gl_FragColor = vec4(uCol * a, 1.0); // additive: src * alpha + dst, so alpha stays 1
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(g, m);
      mesh.renderOrder = 4;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.pulses.push({ mesh, pts, cum, len: cum[cum.length - 1], t: 0, dur: Math.max(0.3, dur), fade: -1, spark: 0, colour: c, resolve });
    });
  }

  private updatePulses(dt: number) {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      const u = (p.mesh.material as THREE.ShaderMaterial).uniforms;
      if (p.fade < 0) {
        p.t = Math.min(1, p.t + dt / p.dur);
        const k = p.t * p.t * (3 - 2 * p.t) * 0.6 + p.t * 0.4; // a little eager at the start, steady at the end
        const head = k * p.len;
        u.uHead.value = head;
        let j = 1; while (j < p.cum.length - 1 && p.cum[j] < head) j++;
        const at = p.pts[j - 1].clone().lerp(p.pts[j], Math.min(1, Math.max(0, (head - p.cum[j - 1]) / Math.max(1e-4, p.cum[j] - p.cum[j - 1]))));
        if ((p.spark -= dt) <= 0) {
          p.spark = 0.12;
          this.flash(at.clone().setY(at.y + 0.4), p.colour.getHex(), 2.2, 0.35);
          for (let s = 0; s < 3; s++) this.add.add({ x: at.x, y: at.y + 0.05, z: at.z, vx: (Math.random() - 0.5) * 0.6, vy: 0.4 + Math.random() * 0.6, vz: (Math.random() - 0.5) * 0.6, life: 0, max: 0.5, size: 5, r: p.colour.r, g: p.colour.g, b: p.colour.b, drag: 2, grav: 0, additive: true });
        }
        if (p.t >= 1) { p.fade = 1; p.resolve?.(); p.resolve = null; }
      } else {
        p.fade = Math.max(0, p.fade - dt / 1.6);
        u.uFade.value = p.fade;
        if (p.fade <= 0) { this.group.remove(p.mesh); p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); this.pulses.splice(i, 1); }
      }
    }
  }

  // -------------------------------------------------------------- highlights and cones

  highlight(tiles: THREE.Vector3[], style: HighlightStyle): number {
    // One mesh per highlight: each tile is a 3x3 grid draped over the terrain, so slopes never swallow it.
    const grp = new THREE.Group();
    const col = new THREE.Color(HL_COLOURS[style]);
    const isPath = style === "path";
    const inset = isPath ? 0.34 : 0.05, lift = 0.05;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (const p of tiles) {
      const x0 = Math.floor(p.x) + inset, z0 = Math.floor(p.z) + inset, span = 1 - inset * 2;
      const base = pos.length / 3;
      for (let j = 0; j <= 2; j++) for (let i = 0; i <= 2; i++) {
        const x = x0 + (span * i) / 2, z = z0 + (span * j) / 2;
        pos.push(x, this.heightAt(x, z) + lift, z);
        uv.push(i / 2, j / 2);
      }
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const a = base + j * 3 + i, b2 = a + 1, c = a + 3, d = c + 1;
        idx.push(a, c, b2, b2, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: { uColour: { value: col }, uFill: { value: isPath ? 0.55 : 0.1 }, uEdge: { value: isPath ? 0.0 : 0.6 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `uniform vec3 uColour; uniform float uFill; uniform float uEdge; varying vec2 vUv;
        void main(){
          vec2 d = abs(vUv - 0.5) * 2.0;
          float edge = smoothstep(0.78, 0.92, max(d.x, d.y)) * (1.0 - smoothstep(0.96, 1.0, max(d.x, d.y)));
          float a = uFill + edge * uEdge;
          if (uEdge == 0.0) a *= 1.0 - smoothstep(0.6, 1.0, length(vUv - 0.5) * 2.0);
          gl_FragColor = vec4(uColour, a);
        }`,
    });
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 2;
    grp.add(m);
    this.group.add(grp);
    const h = this.hlNext++;
    this.hlGroups.set(h, grp);
    return h;
  }

  clearHighlight(h?: number) {
    const drop = (k: number, g: THREE.Group) => {
      this.group.remove(g);
      g.traverse((o) => { if (o instanceof THREE.Mesh) { (o.material as THREE.Material).dispose(); o.geometry.dispose(); } });
      this.hlGroups.delete(k);
    };
    if (h === undefined) [...this.hlGroups].forEach(([k, g]) => drop(k, g));
    else { const g = this.hlGroups.get(h); if (g) drop(h, g); }
  }

  showCone(id: string, origin: THREE.Vector3, yaw: number, range: number, angleDeg: number, alert: boolean) {
    let m = this.cones.get(id);
    if (!m) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uColour: { value: new THREE.Color() }, uTime: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uColour; uniform float uTime; varying vec2 vUv;
          void main(){ float r = vUv.x; float a = (1.0 - r) * 0.34 + smoothstep(0.93, 1.0, r) * 0.4;
            a *= 0.8 + 0.2 * sin(r * 30.0 - uTime * 3.0); gl_FragColor = vec4(uColour, a); }`,
      });
      m = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      m.renderOrder = 2;
      this.cones.set(id, m);
      this.group.add(m);
    }
    // fan on the ground, following the terrain
    const seg = 24, rings = 8;
    const half = THREE.MathUtils.degToRad(angleDeg / 2);
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let r = 0; r <= rings; r++) for (let s = 0; s <= seg; s++) {
      const rr = (r / rings) * range, a = yaw - half + (s / seg) * half * 2;
      const x = origin.x + Math.sin(a) * rr, z = origin.z - Math.cos(a) * rr;
      pos.push(x, this.heightAt(x, z) + 0.06, z);
      uv.push(r / rings, s / seg);
    }
    for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) {
      const a = r * (seg + 1) + s, b = a + 1, c = a + seg + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    m.geometry.dispose();
    m.geometry = g;
    (m.material as THREE.ShaderMaterial).uniforms.uColour.value.set(alert ? 0xff4a2a : 0xffc860);
  }

  hideCone(id: string) {
    const m = this.cones.get(id);
    if (!m) return;
    this.group.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose();
    this.cones.delete(id);
  }

  // -------------------------------------------------------------- float text

  floatText(pos: THREE.Vector3, text: string, tone: 'good' | 'bad' | 'neutral' | 'crystal') {
    const el = document.createElement('div');
    el.className = `fx-float ${tone}`;
    el.textContent = text;
    this.textLayer.appendChild(el);
    // stack above any text already rising from the same spot
    const stacked = this.texts.filter((t) => t.pos.distanceTo(pos) < 0.5 && t.t < 0.6).length;
    this.texts.push({ el, pos: pos.clone().setY(pos.y + stacked * 0.45), t: 0, max: 1.8 });
  }

  // -------------------------------------------------------------- frame

  update(dt: number, t: number, focus: THREE.Vector3) {
    this.add.update(dt); this.norm.update(dt);

    // motes wrap around the focus point
    const md = this.moteData;
    for (let i = 0; i < md.length; i += 3) {
      md[i] += (0.35 + Math.sin(t * 0.3 + i) * 0.2) * dt;
      md[i + 1] += Math.sin(t * 0.7 + i * 0.37) * 0.08 * dt;
      md[i + 2] += Math.cos(t * 0.23 + i) * 0.12 * dt;
      const rx = md[i] - focus.x, rz = md[i + 2] - focus.z;
      if (rx > 25) md[i] -= 50; else if (rx < -25) md[i] += 50;
      if (rz > 25) md[i + 2] -= 50; else if (rz < -25) md[i + 2] += 50;
      if (md[i + 1] < 0.2) md[i + 1] = 6.5; else if (md[i + 1] > 7) md[i + 1] = 0.3;
    }
    (this.motes.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    if (this.haze) {
      const h = this.haze, d = h.data;
      for (let i = 0; i < d.length; i += 3) {
        d[i] += (0.5 + Math.sin(i * 1.7) * 0.3) * dt;
        d[i + 1] += Math.sin(t * 0.2 + i) * 0.05 * dt;
        if (d[i] > h.x1) d[i] = h.x0;
      }
      (h.pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    this.updatePulses(dt);

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      const k = f.t / f.max;
      f.light.intensity = f.peak * Math.max(0, k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
      if (k >= 1) { f.light.intensity = 0; this.flashes.splice(i, 1); }
    }

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t += dt / b.dur;
      const k = Math.min(1, b.t);
      if (b.kind === 'beam') {
        const mid = b.from.clone().lerp(b.to, 0.5);
        b.mesh.position.copy(mid);
        b.mesh.lookAt(b.to);
        b.mesh.scale.set(1 + (1 - k) * 2, 1 + (1 - k) * 2, b.from.distanceTo(b.to));
        ((b.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - k;
        b.light.position.copy(b.to);
        b.light.intensity = 6 * (1 - k);
      } else {
        const p = b.from.clone().lerp(b.to, k);
        p.y += Math.sin(k * Math.PI) * (b.kind === 'shard' ? 0.4 : 0.15);
        b.mesh.position.copy(p);
        b.mesh.rotation.x += dt * 12; b.mesh.rotation.y += dt * 9;
        b.light.position.copy(p);
        if (Math.random() < 0.6) this.add.add({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 0.2, vz: 0, life: 0, max: 0.3, size: 5, r: b.colour.r, g: b.colour.g, b: b.colour.b, drag: 1, grav: 0, additive: true });
      }
      if (b.t >= 1) {
        this.group.remove(b.mesh);
        b.light.intensity = 0;
        this.bolts.splice(i, 1);
        b.resolve();
      }
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const f = this.texts[i];
      f.t += dt;
      const k = f.t / f.max;
      const p = f.pos.clone(); p.y += k * 1.1;
      const s = this.project(p);
      if (!s || k >= 1) {
        if (k >= 1) { f.el.remove(); this.texts.splice(i, 1); }
        else f.el.style.opacity = '0';
        continue;
      }
      f.el.style.left = `${s.x}px`; f.el.style.top = `${s.y}px`;
      f.el.style.opacity = String(k < 0.1 ? k * 10 : k > 0.7 ? (1 - k) / 0.3 : 1);
    }

    for (const m of this.cones.values()) (m.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    (this.entityRing.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 4) * 0.2;
  }
}
