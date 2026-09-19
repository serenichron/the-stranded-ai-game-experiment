import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Static scenery arrives as hundreds of small meshes. Bake them into a few big ones:
// one per material, per 16x16 cell (so frustum culling still helps), per shadow flag.
export function mergeStatic(root: THREE.Object3D, cell = 16): THREE.Group {
  root.updateMatrixWorld(true);
  const out = new THREE.Group();
  out.name = root.name + '-merged';
  const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean; recv: boolean }>();
  const keep: THREE.Object3D[] = [];
  const v = new THREE.Vector3();

  root.traverse((o) => {
    if ((o as THREE.Light).isLight) { keep.push(o); return; }
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as any).isInstancedMesh || (m as any).isSkinnedMesh || Array.isArray(m.material) || o.userData.noMerge) return;
    const g = m.geometry;
    const attrs = Object.keys(g.attributes).sort().join(',');
    m.getWorldPosition(v);
    const key = [m.material.uuid, attrs, g.index ? 'i' : 'n', m.castShadow ? 'c' : '', m.receiveShadow ? 'r' : '', Math.floor(v.x / cell), Math.floor(v.z / cell)].join('|');
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { mat: m.material, geos: [], cast: m.castShadow, recv: m.receiveShadow }));
    const gg = g.clone();
    gg.applyMatrix4(m.matrixWorld);
    // morph targets and groups get in the way of merging
    gg.morphAttributes = {};
    gg.clearGroups();
    b.geos.push(gg);
  });

  for (const b of buckets.values()) {
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    if (!merged) { console.warn('[merge] failed bucket'); continue; }
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast; mesh.receiveShadow = b.recv;
    mesh.matrixAutoUpdate = false;
    out.add(mesh);
    if (b.geos.length > 1) b.geos.forEach((g) => g.dispose());
  }
  for (const l of keep) {
    l.getWorldPosition(v);
    l.removeFromParent();
    l.position.copy(v);
    out.add(l);
  }
  return out;
}
