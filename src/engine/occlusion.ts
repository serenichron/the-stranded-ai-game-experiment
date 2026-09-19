import * as THREE from 'three';
import { atmos, SKY_GLSL } from './atmos';

// One patch on every lit material in the game, scenery and characters alike, so one hand lights them all.
//
// 1. Occlusion. Walls between the camera and the player hide the player. Every material gets a dithered
//    see-through circle around the player, only for fragments nearer the camera and above the player's feet.
// 2. The world layer (phase 2):
//    - mottling: slow world-space colour variation, so no surface is one flat colour;
//    - brush: the direct light is broken up by stretched noise, like strokes of paint;
//    - rim: a warm edge light on the sun side, which lifts figures and towers off the sand;
//    - haze: distance fog and low-lying height haze, coloured by the same sky function as the dome.
//    Materials tagged `userData.glow = true` skip mottling and brush, so glows stay clean.

export const occUniforms = {
  uOccOn: { value: 0 },
  uOccCentre: { value: new THREE.Vector2() }, // device pixels, bottom-left origin
  uOccRadius: { value: 120 },                  // device pixels
  uOccDepth: { value: 0 },                     // view-space z of the player
  uOccMinY: { value: 0 },                      // world y below which nothing is cut
  uCloudT: { value: 0 },                       // seconds, drives the drifting dust-cloud shadows
  uCloudK: { value: 0.1 },                     // how dark the shadows get, 0 = off
};

const NOISE_GLSL = /* glsl */`
  float wHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float wNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(wHash(i), wHash(i + vec3(1,0,0)), f.x), mix(wHash(i + vec3(0,1,0)), wHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(wHash(i + vec3(0,0,1)), wHash(i + vec3(1,0,1)), f.x), mix(wHash(i + vec3(0,1,1)), wHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
`;

export function patchOcclusion(mat: THREE.Material) {
  if ((mat as any).userData?.occPatched) return;
  mat.userData.occPatched = true;
  const glow = !!mat.userData.glow;
  // surface: 'ground' (cracks where the vertex colour alpha says so), 'stone' (Aza'los), 'rock' (sandstone)
  const surface = (mat.userData.surface as string | undefined) ?? '';
  // characters (and anything else tagged noOcc) are never cut by the see-through circle
  const noOcc = !!mat.userData.noOcc;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, occUniforms, atmos);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vOccViewZ;\nvarying vec3 vWorldPos;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vOccViewZ = mvPosition.z;
        #ifdef USE_INSTANCING
          vWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        ${glow ? '#define WORLD_GLOW' : ''}
        ${noOcc ? '#define NO_OCC' : ''}
        ${surface ? '#define WORLD_SURFACE_' + surface.toUpperCase() : ''}
        varying float vOccViewZ; varying vec3 vWorldPos;
        uniform float uCloudT; uniform float uCloudK;
        uniform vec3 uSunView; uniform vec3 uRimCol; uniform float uRimK; uniform float uMottle;
        uniform float uSurface; uniform float uBrush; uniform float uFogStart; uniform float uFogDensity; uniform float uHeightFog; uniform float uFogTop;
        ${SKY_GLSL}
        ${NOISE_GLSL}
        vec2 vRand2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
        // cell-noise edges: 1 on the cracks between cells, 0 inside them
        float crack2(vec2 p, float w) {
          vec2 n = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
          for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j)); vec2 r = g + vRand2(n + g) - f; float d = dot(r, r);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
          }
          return 1.0 - smoothstep(0.0, w, sqrt(d2) - sqrt(d1));
        }
        float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float cNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(cHash(i), cHash(i + vec2(1, 0)), f.x), mix(cHash(i + vec2(0, 1)), cHash(i + vec2(1, 1)), f.x), f.y); }
        uniform float uOccOn; uniform vec2 uOccCentre; uniform float uOccRadius; uniform float uOccDepth; uniform float uOccMinY;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        #ifndef WORLD_GLOW
        {
          // big soft patches of warmer and cooler, lighter and darker
          float m1 = wNoise(vWorldPos * 0.13 + vec3(3.1, 7.7, 1.3));
          float m2 = wNoise(vWorldPos * 0.7);
          float m3 = wNoise(vWorldPos * 3.1 + 11.0);
          vec3 warm = vec3(1.05, 0.99, 0.92), cool = vec3(0.93, 0.96, 1.05);
          vec3 tint = mix(cool, warm, smoothstep(0.25, 0.75, m1));
          float val = 1.0 + (m1 - 0.5) * 0.2 + (m2 - 0.5) * 0.14 + (m3 - 0.5) * 0.06;
          diffuseColor.rgb *= mix(vec3(1.0), tint * val, uMottle);
          // brush strokes in the albedo: short stretched dabs, laid along whichever plane the face
          // mostly faces (a cheap triplanar), so large surfaces stop reading as one flat fill
          vec3 fn = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
          vec3 aw = abs(fn);
          vec2 bq = aw.y > max(aw.x, aw.z) ? vWorldPos.xz : (aw.x > aw.z ? vWorldPos.zy : vWorldPos.xy);
          float st = wNoise(vec3(bq * vec2(5.0, 1.3), 3.0)) * 0.6 + wNoise(vec3(bq * vec2(1.4, 9.0), 7.0)) * 0.4;
          diffuseColor.rgb *= mix(1.0, 0.9 + 0.2 * st, uMottle * uBrush);
          // warm on the tops, cool underneath: the painters' trick for form in golden light
          float up = fn.y * 0.5 + 0.5;
          diffuseColor.rgb *= mix(vec3(1.0), mix(vec3(0.93, 0.95, 1.03), vec3(1.04, 1.0, 0.95), up), uMottle * uBrush);
        }
        #endif
        #if defined(WORLD_SURFACE_GROUND) && defined(USE_COLOR_ALPHA)
        if (uSurface > 0.5 && vColor.a > 0.02) {
          // cracked earth, only where the terrain says the ground is packed, rocky or dead
          float m = vColor.a;
          vec2 q = vWorldPos.xz;
          // the 00:19 crust the user liked (restored 09:50): full strength, two scales, everywhere the mask allows
          float c = crack2(q * 0.8 + wNoise(vec3(q * 0.5, 1.0)) * 0.6, 0.05) * 0.7 + crack2(q * 2.3, 0.08) * 0.3;
          diffuseColor.rgb *= 1.0 - 0.32 * c * m;
        }
        #endif
        #if defined(WORLD_SURFACE_STONE) || defined(WORLD_SURFACE_ROCK)
        if (uSurface > 0.5) {
          // cracks in patches: the top face and the dominant side face, blended by the normal
          // (the lit normal is not declared yet at this point, so take the face normal from derivatives)
          vec3 wn = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
          vec3 p = vWorldPos;
          // the 00:19 settings the user liked (restored 09:50)
          float side = abs(wn.x) > abs(wn.z) ? crack2(p.zy * vec2(1.3, 1.0), 0.06) : crack2(p.xy * vec2(1.3, 1.0), 0.06);
          float top = crack2(p.xz * 1.1, 0.06);
          float c = mix(side, top, smoothstep(0.55, 0.85, abs(wn.y)));
          #ifdef WORLD_SURFACE_ROCK
            // phase 3 (C-009): layered sandstone instead of an even honeycomb (the critic's "turtle shell").
            // Sides: warped strata bands about 50 cm deep, split by tall vertical joints, each band a
            // slightly different tone. Tops: a few big broken planes. Line strength stays at the 00:19 0.38.
            float topK = smoothstep(0.55, 0.85, abs(wn.y));
            float mask = smoothstep(0.35, 0.6, wNoise(p * 0.45 + 4.0));
            float yy = p.y * 1.9 + wNoise(p * 0.5) * 1.3 + wNoise(p * 1.9) * 0.2;
            float band = fract(yy);
            float seamL = 1.0 - smoothstep(0.0, 0.06, min(band, 1.0 - band));
            vec2 sp = abs(wn.x) > abs(wn.z) ? p.zy : p.xy;
            float joint = crack2(sp * vec2(0.8, 0.28) + 3.0, 0.05);
            float sideC = max(seamL, joint * 0.8);
            // tops: two or three long fractures across a boulder, and a few short ones in patches
            vec2 tq = p.xz + vec2(wNoise(vec3(p.xz * 0.7, 3.0)), wNoise(vec3(p.xz * 0.7, 6.0))) * 0.9;
            float topC = max(crack2(tq * 0.32, 0.035), crack2(tq * 1.2 + 5.0, 0.05) * 0.8 * smoothstep(0.55, 0.75, wNoise(p * 0.8 + 2.0)));
            float cc = mix(sideC, topC, topK);
            diffuseColor.rgb *= 1.0 - 0.38 * cc * max(mask, 0.6);
            float bt = fract(sin(floor(yy) * 12.9898) * 43758.5453);
            diffuseColor.rgb *= mix(vec3(1.0), mix(vec3(0.9, 0.9, 0.94), vec3(1.07, 1.02, 0.95), bt), 1.0 - topK);
            // grit and lichen speckle, the art's rocks all carry it
            diffuseColor.rgb *= 1.0 - 0.12 * smoothstep(0.72, 0.8, wNoise(p * 7.0));
          #else
            float mask = smoothstep(0.5, 0.72, wNoise(p * 0.3 + 9.0));
            diffuseColor.rgb *= 1.0 - 0.28 * c * mask;
          #endif
        }
        #endif`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        #ifndef WORLD_GLOW
        {
          // brush: the lit side is laid down in strokes, not a perfect gradient
          vec3 bp = vWorldPos * vec3(1.6, 3.2, 1.6);
          float b = wNoise(bp + vec3(bp.y * 0.6, 0.0, bp.x * 0.3)) * 0.6 + wNoise(bp * 2.3) * 0.4;
          reflectedLight.directDiffuse *= mix(1.0, 0.82 + 0.36 * b, uMottle);
        }
        #endif
        {
          // warm rim on the sun side, strongest at grazing angles
          float fres = pow(1.0 - saturate(dot(normal, geometryViewDir)), 3.0);
          float sunSide = saturate(dot(normal, uSunView) * 0.7 + 0.3);
          reflectedLight.indirectDiffuse += uRimCol * (fres * sunSide * uRimK) * (0.35 + 0.65 * diffuseColor.rgb);
        }`)
      .replace('#include <fog_fragment>', `
        {
          vec3 toFrag = vWorldPos - cameraPosition;
          float dist = length(toFrag);
          vec3 dir = toFrag / max(dist, 1e-4);
          float fd = 1.0 - exp(-max(0.0, dist - uFogStart) * uFogDensity);
          float fh = uHeightFog * (1.0 - smoothstep(-6.0, uFogTop, vWorldPos.y)) * (1.0 - exp(-dist * 0.04));
          float fogK = clamp(max(fd, fh), 0.0, 1.0);
          vec3 fc = skyCol(normalize(vec3(dir.x, max(dir.y, 0.0) * 0.5, dir.z)));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fc, fogK);
        }`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        {
          vec2 q = vWorldPos.xz * 0.035 + vec2(uCloudT * 0.018, uCloudT * 0.006);
          float n = cNoise(q) * 0.65 + cNoise(q * 2.3 + 7.0) * 0.35;
          gl_FragColor.rgb *= 1.0 - uCloudK * smoothstep(0.45, 0.8, n);
        }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        #ifndef NO_OCC
        if (uOccOn > 0.5 && vOccViewZ > uOccDepth + 0.9 && vWorldPos.y > uOccMinY) {
          vec2 dd = gl_FragCoord.xy - uOccCentre;
          dd.y *= 0.8;
          float r = length(dd) / uOccRadius;
          if (r < 1.0) {
            vec2 cell = mod(floor(gl_FragCoord.xy), 4.0);
            float bayer = mod(cell.x * 2.0 + cell.y * 3.0 + cell.x * cell.y, 4.0) / 4.0 + mod(cell.x + cell.y * 2.0, 4.0) / 16.0;
            if (bayer > smoothstep(0.55, 1.0, r)) discard;
          }
        }
        #endif`);
  };
  const prevKey = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + (glow ? '|occ2g' : '|occ2') + surface + (noOcc ? '|nocc' : '');
  mat.needsUpdate = true;
}

export function patchTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    if (Array.isArray(m)) m.forEach((x) => isLit(x) && patchOcclusion(x));
    else if (isLit(m)) patchOcclusion(m);
  });
}

function isLit(m: THREE.Material) {
  return m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshLambertMaterial || m instanceof THREE.MeshPhongMaterial;
}
