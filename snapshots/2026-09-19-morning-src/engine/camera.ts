import * as THREE from 'three';

// Isometric-style framing through a narrow perspective lens (phase 2; phase 1 was orthographic).
// Q/E rotate by 90 degrees, the wheel zooms, middle-drag pans away from the followed target.
// Zooming in also lowers the camera: wide views stay readable from above, close views
// drop towards eye level until the horizon, the sky and the far hoodoos show, like the paintings.

const FOV = 30;                       // vertical, degrees
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const HALF0 = 6.4;                    // half the view height at the target, in metres, at zoom 1
const deg = THREE.MathUtils.degToRad;

/** Camera pitch for a zoom level: 50 degrees far out, 38 at zoom 1, 9 fully in. */
function pitchFor(z: number, min: number, max: number) {
  if (z <= 1) return deg(THREE.MathUtils.lerp(50, 38, THREE.MathUtils.clamp((z - min) / (1 - min), 0, 1)));
  const t = THREE.MathUtils.clamp((z - 1) / (max - 1), 0, 1);
  return deg(THREE.MathUtils.lerp(38, 9, Math.pow(t, 0.8)));
}

export class IsoCamera {
  readonly camera: THREE.PerspectiveCamera;
  readonly target = new THREE.Vector3();
  private goal = new THREE.Vector3();
  private pan = new THREE.Vector3();
  yawStep = 0; // multiples of 90 degrees; 0 = viewing from the south-west
  private yaw = THREE.MathUtils.degToRad(-45);
  private zoom = 1;
  private zoomGoal = 1;
  private shakeT = 0;
  private shakeI = 0;
  private focusAnim: { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; zoomFrom: number; zoomTo: number; resolve: () => void } | null = null;
  followFn: (() => THREE.Vector3 | null) | null = null;
  minZoom = 0.65; maxZoom = 2.4;
  bounds = { minX: 0, minZ: 0, maxX: 64, maxZ: 56 };

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(FOV, aspect, 0.3, 2500);
  }

  setAspect(a: number) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }

  /** Half the visible height at the target, in metres. */
  halfHeight() { return HALF0 / this.zoom; }
  /** Screen pixels per metre at the target, for a viewport this many pixels tall. */
  pxPerMetre(viewportH: number) { return viewportH / (2 * this.halfHeight()); }
  pitch() { return pitchFor(this.zoom, this.minZoom, this.maxZoom); }

  rotate(dir: 1 | -1) { this.yawStep = (this.yawStep + dir + 4) % 4; }
  zoomBy(f: number) { this.zoomGoal = THREE.MathUtils.clamp(this.zoomGoal * f, this.minZoom, this.maxZoom); }
  setZoom(z: number) { this.zoomGoal = THREE.MathUtils.clamp(z, this.minZoom, this.maxZoom); }

  /** Screen-space drag in pixels -> pan in world units along the ground. */
  dragPan(dx: number, dy: number, viewportH: number) {
    const unitsPerPx = (2 * this.halfHeight()) / viewportH;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.pan.addScaledVector(right, -dx * unitsPerPx);
    this.pan.addScaledVector(fwd, dy * unitsPerPx / Math.max(0.35, Math.sin(this.pitch())));
    this.pan.clampLength(0, 18);
  }
  resetPan() { this.pan.set(0, 0, 0); }

  shake(i = 0.3, d = 0.35) { this.shakeI = Math.max(this.shakeI, i); this.shakeT = Math.max(this.shakeT, d); }

  focus(p: THREE.Vector3, zoom: number | undefined, dur: number): Promise<void> {
    this.focusAnim?.resolve();
    return new Promise((resolve) => {
      this.focusAnim = { from: this.goal.clone(), to: p.clone(), t: 0, dur: Math.max(0.01, dur), zoomFrom: this.zoomGoal, zoomTo: zoom ?? this.zoomGoal, resolve };
    });
  }

  snapTo(p: THREE.Vector3) { this.goal.copy(p); this.target.copy(p); this.zoom = this.zoomGoal; }

  /** Ground direction the camera looks along, flattened. */
  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  update(dt: number) {
    // yaw eases toward its step
    const yawGoal = THREE.MathUtils.degToRad(-45 + this.yawStep * 90);
    let dy = yawGoal - this.yaw;
    while (dy > Math.PI) dy -= 2 * Math.PI;
    while (dy < -Math.PI) dy += 2 * Math.PI;
    this.yaw += dy * Math.min(1, dt * 8);

    if (this.focusAnim) {
      const f = this.focusAnim;
      f.t = Math.min(1, f.t + dt / f.dur);
      const k = f.t * f.t * (3 - 2 * f.t);
      this.goal.lerpVectors(f.from, f.to, k);
      this.zoomGoal = f.zoomFrom + (f.zoomTo - f.zoomFrom) * k;
      if (f.t >= 1) { this.focusAnim = null; f.resolve(); }
    } else if (this.followFn) {
      const p = this.followFn();
      if (p) this.goal.copy(p);
    }

    const want = this.goal.clone().add(this.pan);
    want.x = THREE.MathUtils.clamp(want.x, this.bounds.minX, this.bounds.maxX);
    want.z = THREE.MathUtils.clamp(want.z, this.bounds.minZ, this.bounds.maxZ);
    this.target.lerp(want, Math.min(1, dt * 6));

    this.zoom += (this.zoomGoal - this.zoom) * Math.min(1, dt * 8);

    const pitch = this.pitch();
    const dist = this.halfHeight() / TAN;
    // close in, aim at the chest rather than the feet, so people fill the frame and the horizon shows
    const lift = THREE.MathUtils.clamp((this.zoom - 1) / (this.maxZoom - 1), 0, 1) * 0.9;
    const aim = this.target.clone(); aim.y += lift;
    const off = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(this.yaw) * Math.cos(pitch),
    ).multiplyScalar(dist);
    const pos = aim.clone().add(off);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const s = this.shakeI * Math.max(0, this.shakeT) * 3;
      pos.x += (Math.random() - 0.5) * s; pos.y += (Math.random() - 0.5) * s; pos.z += (Math.random() - 0.5) * s;
      if (this.shakeT <= 0) this.shakeI = 0;
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(aim);
  }
}
