// Character bench: a line-up of bodies under golden-hour light, for model work and screenshots.
// URL params: set=players|npcs|crowd|creatures|all, anim=idle|walk|run|attack|hit|die|channel|crouch|sleep|talk,
// view=game|close|face, t=seconds to advance, rot=degrees to turn the line-up, still=no animation loop.
import * as THREE from 'three';
import type { AnimName, EntityKind } from '../../../core/contracts';
import { buildCharacter } from '../characters';
import type { Model } from '../types';

const q = new URLSearchParams(location.search);
const set = q.get('set') ?? 'players';
const anim = (q.get('anim') ?? 'idle') as AnimName;
const view = q.get('view') ?? 'close';
const rot = Number(q.get('rot') ?? 180) * Math.PI / 180;

type Row = { kind: EntityKind; body?: 'male' | 'female'; look?: string; state?: string; label: string };
const SETS: Record<string, Row[]> = {
  players: [
    { kind: 'player-minaa', body: 'male', look: 'tech', label: 'Minaa man' },
    { kind: 'player-minaa', body: 'female', look: 'healer', label: 'Minaa woman' },
    { kind: 'player-sehari', body: 'male', look: 'channeller', label: 'Sehari man' },
    { kind: 'player-sehari', body: 'female', look: 'ranged', label: 'Sehari woman' },
    { kind: 'player-iskari', body: 'male', look: 'frontline', label: 'Iskari male-shaped' },
    { kind: 'player-iskari', body: 'female', look: 'scout', label: 'Iskari female-shaped' },
  ],
  npcs: [
    { kind: 'npc-minaa', body: 'female', look: 'hadda', label: 'Hadda' },
    { kind: 'npc-minaa', body: 'female', look: 'tarn', label: 'Mother Tarn' },
    { kind: 'npc-scavenger', body: 'male', look: 'pell', label: 'Pell' },
    { kind: 'npc-minaa', body: 'male', look: 'digger', label: 'Digger' },
    { kind: 'npc-sehari', body: 'female', look: 'hunter', label: 'Hunter' },
    { kind: 'npc-apprentice', body: 'male', look: 'apprentice', label: 'Apprentice' },
  ],
  seat: [
    { kind: 'npc-apprentice', body: 'male', look: 'apprentice', state: 'seated', label: 'Apprentice seated' },
    { kind: 'npc-apprentice', body: 'male', look: 'apprentice', label: 'Apprentice' },
    { kind: 'npc-minaa', body: 'female', look: 'tarn', label: 'Tarn' },
    { kind: 'npc-minaa', body: 'female', look: 'hadda', label: 'Hadda' },
  ],
  crowd: [0, 1, 2, 3, 4, 5].map((i) => ({ kind: 'npc-minaa' as EntityKind, label: `crowd ${i}` })),
  tel: [
    { kind: 'telsharin', label: 'Telsharin' },
    { kind: 'telsharin', state: 'starving', label: 'Telsharin starving' },
  ],
  creatures: [
    { kind: 'telsharin', label: 'Telsharin' },
    { kind: 'dog', label: 'Dog' },
    { kind: 'drone', label: 'Drone' },
    { kind: 'defender', state: 'awake', label: 'Defender awake' },
    { kind: 'defender', state: 'waking', label: 'Defender waking' },
    { kind: 'defender', state: 'dormant', label: 'Defender dormant' },
  ],
};
const rows = set === 'all' ? [...SETS.players, ...SETS.npcs] : SETS[set] ?? SETS.players;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd8b6a0);
scene.fog = new THREE.Fog(0xd8b6a0, 40, 80);
// the agreed golden hour: peach sun low from the south-west, lavender sky fill, cool shadows
scene.add(new THREE.HemisphereLight(0x9088b4, 0xc09470, 1.35));
const sun = new THREE.DirectionalLight(0xffcc98, 3.4);
sun.position.set(-8, 4, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 6, bottom: -4 });
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0xd8c2a0, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const gap = set === 'creatures' ? 2.6 : 1.1;
const models: Model[] = [];
const line = new THREE.Group();
line.rotation.y = rot;
scene.add(line);
rows.forEach((row, i) => {
  const m = buildCharacter(row.kind, { body: row.body, look: row.look, seed: 11 + i });
  m.root.position.x = (i - (rows.length - 1) / 2) * gap;
  if (row.state) m.setState?.(row.state);
  m.play(anim);
  line.add(m.root);
  models.push(m);
});

const w = (rows.length - 1) * gap + 2;
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 200);
if (view === 'game') {
  // roughly the game's default: 33 degrees down, about 100 px per 1.8 m person
  const dist = 24;
  cam.position.set(0, Math.sin(0.58) * dist, Math.cos(0.58) * dist);
  cam.lookAt(0, 0.9, 0);
} else if (view === 'head') {
  // one head, very close: ?view=head&i=2&y=1.62
  const i = Number(q.get('i') ?? 0), y = Number(q.get('y') ?? 1.62);
  const x = (i - (rows.length - 1) / 2) * gap * Math.cos(rot);
  cam.fov = 3.2;
  cam.position.set(x, y + 0.15, 14);
  cam.lookAt(x, y, 0);
} else if (view === 'face') {
  cam.fov = 10;
  cam.position.set(0, 1.9, 12);
  cam.lookAt(0, 1.7, 0);
} else {
  const dist = w * 1.25;
  cam.position.set(0, 1.4 + dist * 0.16, dist);
  cam.lookAt(0, 1.0, 0);
}
cam.updateProjectionMatrix();

let t = 0;
const adv = Number(q.get('t') ?? 1.2);
// advance the clock in fixed steps so screenshots repeat
for (let k = 0; k < adv * 60; k++) { t += 1 / 60; for (const m of models) m.update(1 / 60, t); }
renderer.render(scene, cam);
(window as unknown as { __ready: boolean }).__ready = true;
let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!q.has('still')) { t += dt; for (const m of models) m.update(dt, t); }
  renderer.render(scene, cam);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
