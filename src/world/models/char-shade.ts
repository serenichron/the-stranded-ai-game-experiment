// Materials for sculpted characters. A sculpted skin has no UV layout, so detail textures are
// projected from three sides in the mesh's own (bind pose) space: the pattern stays glued to the
// body while it animates, and there are no seams. Emissive maps (the defender's teal seams) too.
import * as THREE from 'three';
import { tex } from './char-tex';

export interface SOpts {
  rough?: number; metal?: number; flat?: boolean; double?: boolean;
  /** Texture repeats per metre. */
  scale?: number;
  emissive?: number; ei?: number; emissiveMap?: string;
  /** A second map key mixed in by height, e.g. roots only on one limb. */
  noOcc?: boolean;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** Shared sculpt material. Never mutate the result: every character that uses it shares it. */
export function smat(key: string, hex: number, o: SOpts = {}): THREE.MeshStandardMaterial {
  const id = `${key}|${hex}|${o.rough ?? 0.9}|${o.metal ?? 0}|${o.flat ? 1 : 0}|${o.double ? 1 : 0}|${o.scale ?? 4}|${o.emissive ?? 0}|${o.ei ?? 0}|${o.emissiveMap ?? ''}`;
  let m = cache.get(id);
  if (m) return m;
  m = makeSmat(key, hex, o);
  cache.set(id, m);
  return m;
}

/** A per-instance sculpt material (for glows the model drives, or crusts that fade). */
export function makeSmat(key: string, hex: number, o: SOpts = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: hex, roughness: o.rough ?? 0.9, metalness: o.metal ?? 0,
    flatShading: !!o.flat, side: o.double ? THREE.DoubleSide : THREE.FrontSide,
    map: key ? tex(key) : null,
    emissive: o.emissive ?? 0, emissiveIntensity: o.ei ?? 0,
    emissiveMap: o.emissiveMap ? tex(o.emissiveMap) : null,
  });
  m.name = `sculpt:${key || 'plain'}`;
  m.userData.noOcc = true;
  const scale = o.scale ?? 4;
  if (m.map || m.emissiveMap) {
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      prev?.call(m, sh, r);
      sh.uniforms.uTriScale = { value: scale };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos; varying vec3 vTriN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriPos = position; vTriN = normal;');
      const tri = (sampler: string) => /* glsl */`
        (texture2D(${sampler}, vTriPos.zy * uTriScale) * tw.x + texture2D(${sampler}, vTriPos.xz * uTriScale) * tw.y + texture2D(${sampler}, vTriPos.xy * uTriScale) * tw.z)`;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos; varying vec3 vTriN; uniform float uTriScale;')
        .replace('#include <map_fragment>', /* glsl */`
          vec3 tw = pow(abs(normalize(vTriN)), vec3(4.0)); tw /= (tw.x + tw.y + tw.z);
          #ifdef USE_MAP
            diffuseColor *= ${tri('map')};
          #endif`)
        .replace('#include <emissivemap_fragment>', /* glsl */`
          #ifdef USE_EMISSIVEMAP
            totalEmissiveRadiance *= ${tri('emissiveMap')}.rgb;
          #endif`);
    };
    const prevKey = m.customProgramCacheKey?.bind(m);
    m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|tri';
  }
  return m;
}
