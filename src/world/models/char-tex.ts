// Procedural surface textures for characters, painted once into small canvases and shared.
// Most are near-white detail maps that the material colour tints. A few carry their own colour
// (Sehari root markings, Iskari rust bloom, border motifs) and are used with a white material.
//
// UVs: every body part is a lathe, so u runs round the part and v runs along it (0 at the far end).
import * as THREE from 'three';
import { rng } from './char-kit';

const SIZE = 256;
const cache = new Map<string, THREE.CanvasTexture>();

type Paint = (g: CanvasRenderingContext2D, r: () => number, n: Noise) => void;

export function tex(key: string): THREE.CanvasTexture {
  let t = cache.get(key);
  if (t) return t;
  const paint = PAINTERS[key];
  if (!paint) throw new Error(`[char-tex] no texture '${key}'`);
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  let seed = 7;
  for (let i = 0; i < key.length; i++) seed = Math.imul(seed ^ key.charCodeAt(i), 16777619);
  const r = rng(seed >>> 0);
  paint(g, r, noise(r));
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.name = key;
  cache.set(key, t);
  return t;
}

// ---------------------------------------------------------------- noise

interface Noise { (x: number, y: number): number; fbm(x: number, y: number, oct?: number): number }

/** Tileable value noise on a 256 lattice period. Coordinates in cells; period = cells across. */
function noise(r: () => number): Noise {
  const P = 64;
  const grid = new Float32Array(P * P);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const at = (x: number, y: number) => grid[(((y % P) + P) % P) * P + (((x % P) + P) % P)];
  const n = ((x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }) as Noise;
  n.fbm = (x, y, oct = 4) => {
    let s = 0, amp = 0.5, f = 1, tot = 0;
    for (let i = 0; i < oct; i++) { s += amp * n(x * f, y * f); tot += amp; amp *= 0.5; f *= 2; }
    return s / tot;
  };
  return n;
}

/** Fill with a luminance field. fn returns 0..1 grey per pixel, mapped into [lo, hi]. */
function field(g: CanvasRenderingContext2D, fn: (u: number, v: number) => number, tint: [number, number, number] = [1, 1, 1]): void {
  const img = g.createImageData(SIZE, SIZE);
  const d = img.data;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const k = fn(x / SIZE, y / SIZE);
      const i = (y * SIZE + x) * 4;
      d[i] = Math.max(0, Math.min(255, 255 * k * tint[0]));
      d[i + 1] = Math.max(0, Math.min(255, 255 * k * tint[1]));
      d[i + 2] = Math.max(0, Math.min(255, 255 * k * tint[2]));
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

/** Draw a path three times, offset by the canvas size, so it tiles across the u seam. */
function wrapped(g: CanvasRenderingContext2D, draw: (dx: number) => void): void {
  for (const dx of [-SIZE, 0, SIZE]) draw(dx);
}

/** A branching line that forks as it goes. Used for roots and cracks. */
function branch(g: CanvasRenderingContext2D, r: () => number, x: number, y: number, ang: number, len: number, w: number, depth: number): void {
  if (depth <= 0 || len < 4 || w < 0.35) return;
  let px = x, py = y;
  const steps = Math.max(3, Math.floor(len / 6));
  let a = ang;
  for (let i = 0; i < steps; i++) {
    a += (r() - 0.5) * 0.55;
    const nx = px + Math.cos(a) * (len / steps), ny = py + Math.sin(a) * (len / steps);
    const lw = w * (1 - (i / steps) * 0.5);
    g.lineWidth = lw;
    wrapped(g, (dx) => { g.beginPath(); g.moveTo(px + dx, py); g.lineTo(nx + dx, ny); g.stroke(); });
    px = nx; py = ny;
    if (r() < 0.22 && depth > 1) branch(g, r, px, py, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), len * 0.55, lw * 0.7, depth - 1);
  }
  branch(g, r, px, py, a + (r() - 0.5) * 0.8, len * 0.6, w * 0.7, depth - 1);
}

/** Irregular polygon cells (jittered grid Voronoi), returning edge distance per pixel. */
function cells(r: () => number, n: number): (u: number, v: number) => { edge: number; id: number } {
  const pts: Array<[number, number]> = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) pts.push([(i + 0.15 + r() * 0.7) / n, (j + 0.15 + r() * 0.7) / n]);
  return (u, v) => {
    let d1 = 9, d2 = 9, id = 0;
    const ci = Math.floor(u * n), cj = Math.floor(v * n);
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const ii = ((ci + di) % n + n) % n, jj = ((cj + dj) % n + n) % n;
      const p = pts[jj * n + ii];
      // shift the point to the neighbour copy
      const px = p[0] + Math.floor((ci + di) / n) / 1, py = p[1] + Math.floor((cj + dj) / n) / 1;
      const dx = u - px, dy = v - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; id = jj * n + ii; } else if (d < d2) d2 = d;
    }
    return { edge: (d2 - d1) * n, id };
  };
}

// ---------------------------------------------------------------- painters

const PAINTERS: Record<string, Paint> = {
  /** Human skin: soft warm mottling, a hint of pores. Tinted by the material. */
  skin(g, r, n) {
    field(g, (u, v) => 0.8 + 0.2 * n.fbm(u * 10, v * 10, 4) + 0.05 * (n(u * 90, v * 90) - 0.5));
  },

  /** Sehari skin: fine dried-clay cracks, cool mottling. No markings. */
  sehari(g, r, n) {
    const c = cells(r, 11);
    field(g, (u, v) => {
      const e = c(u, v).edge;
      const crack = e < 0.05 ? 0.72 + e * 4 : 1;
      return (0.9 + 0.1 * n.fbm(u * 12, v * 12)) * crack;
    });
  },

  /** Sehari skin with dark branching root markings grown along the limb. Coloured, use a white-ish tint. */
  sehariRoots(g, r, n) {
    PAINTERS.sehari(g, r, n);
    g.strokeStyle = 'rgba(52,40,58,0.92)';
    g.lineCap = 'round';
    // roots run along v (down the limb), forking outwards
    for (let i = 0; i < 3; i++) branch(g, r, (0.15 + i * 0.3 + r() * 0.1) * SIZE, -4, Math.PI / 2 + (r() - 0.5) * 0.3, SIZE * 0.9, 4.5, 4);
  },

  /** Iskari stone: irregular plates, dark seams, speckle, rust bloom. Coloured. */
  iskari(g, r, n) {
    const c = cells(r, 4); // big uneven plates (round 1 critic: the small grid read as quilting)
    field(g, (u, v) => {
      const { edge, id } = c(u, v);
      const plate = 0.84 + ((id * 7919) % 13) / 13 * 0.16;
      const speck = n(u * 120, v * 120) > 0.82 ? 0.85 : 1;
      const seam = edge < 0.03 ? 0.45 : edge < 0.055 ? 0.78 : 1; // the plate seams must read from the game camera
      return plate * speck * seam * (0.94 + 0.06 * n.fbm(u * 8, v * 8));
    });
    // rust bloom: soft orange-brown stains running downwards
    g.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 7; i++) {
      const x = r() * SIZE, y = r() * SIZE, rad = 18 + r() * 40;
      wrapped(g, (dx) => {
        const grd = g.createRadialGradient(x + dx, y, 0, x + dx, y + rad * 0.5, rad);
        grd.addColorStop(0, 'rgba(196,120,80,0.55)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(x + dx - rad, y - rad, rad * 2, rad * 2.5);
      });
    }
    g.globalCompositeOperation = 'source-over';
  },

  /** Defensive-line stone: bigger plates, seams that carry a teal line. Pair with 'iskariSeamGlow'. */
  defender(g, r, n) {
    const c = cells(r, 5);
    field(g, (u, v) => {
      const { edge, id } = c(u, v);
      const plate = 0.9 + ((id * 104729) % 11) / 11 * 0.1;
      const seam = edge < 0.02 ? 0.72 : edge < 0.04 ? 0.9 : 1;
      return plate * seam * (0.92 + 0.08 * n.fbm(u * 10, v * 10)) * (n(u * 140, v * 140) > 0.85 ? 0.9 : 1);
    });
    g.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 9; i++) {
      const x = r() * SIZE, y = r() * SIZE, rad = 14 + r() * 36;
      wrapped(g, (dx) => {
        const grd = g.createRadialGradient(x + dx, y, 0, x + dx, y + rad * 0.6, rad);
        grd.addColorStop(0, 'rgba(180,96,58,0.6)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(x + dx - rad, y - rad, rad * 2, rad * 2.6);
      });
    }
    g.globalCompositeOperation = 'source-over';
  },

  /** Emissive map for the defender: teal only where the seams are. Same cell layout as 'defender'. */
  defenderGlow(g, r, n) {
    // re-run the same random sequence as 'defender' so the seams line up
    const r2 = rng(seedFor('defender'));
    const c = cells(r2, 5);
    field(g, (u, v) => {
      const e = c(u, v).edge;
      return e < 0.014 ? 1 : e < 0.026 ? 0.3 : 0;
    });
  },

  /** Plain woven cloth: fine weave, soft folds down v, worn darker edges. */
  cloth(g, r, n) {
    field(g, (u, v) => {
      const weave = 0.96 + 0.04 * Math.sin(u * SIZE * 1.6) * Math.sin(v * SIZE * 1.6);
      // soft folds from noise, not a regular stripe (a stripe shows as bars on sculpted bodies)
      const fold = 0.84 + 0.16 * n.fbm(u * 5, v * 2, 3);
      const grime = 0.88 + 0.12 * n.fbm(u * 6, v * 6);
      return weave * fold * grime;
    });
  },

  /** Sehari fibre cloth: undyed bone weave with a rust motif band at the lower border (v near 1). Coloured. */
  sehariCloth(g, r, n) {
    field(g, (u, v) => {
      const weave = 0.95 + 0.05 * Math.sin(u * SIZE * 1.3) * Math.sin(v * SIZE * 1.3);
      const fold = 0.9 + 0.1 * Math.sin(u * Math.PI * 10 + 2 * n(u * 6, v * 2));
      return weave * fold * (0.9 + 0.1 * n.fbm(u * 7, v * 7));
    }, [0.93, 0.88, 0.78]);
    // motif band: concentric rings and branching roots, in rust. Meaning lost, pattern kept.
    const y0 = SIZE * 0.8;
    g.strokeStyle = 'rgba(150,64,40,0.85)';
    g.fillStyle = 'rgba(150,64,40,0.85)';
    g.lineWidth = 2;
    g.fillRect(0, y0 - 3, SIZE, 3);
    g.fillRect(0, SIZE - 6, SIZE, 3);
    for (let i = 0; i < 4; i++) {
      const cx = (i + 0.5) * SIZE / 4, cy = y0 + 22;
      if (i % 2 === 0) {
        for (const rad of [4, 8, 12]) { g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.stroke(); }
      } else {
        g.lineCap = 'round';
        branch(g, r, cx, cy + 14, -Math.PI / 2, 30, 2.2, 3);
      }
    }
  },

  /** Sehari hip panel: undyed cloth with one big rust root motif spreading from the hem (sehari-upright-and-quadrupedal-pair.png). Coloured. */
  sehariMotif(g, r, n) {
    field(g, (u, v) => {
      const weave = 0.95 + 0.05 * Math.sin(u * SIZE * 1.3) * Math.sin(v * SIZE * 1.3);
      return weave * (0.9 + 0.1 * n.fbm(u * 7, v * 7));
    }, [0.93, 0.88, 0.78]);
    g.strokeStyle = 'rgba(168,70,44,0.9)';
    g.lineCap = 'round';
    // roots grow up from the hem (v = 1 is the hem on a panel)
    for (let i = 0; i < 3; i++) branch(g, r, SIZE * (0.35 + i * 0.15), SIZE * 1.02, -Math.PI / 2 + (i - 1) * 0.35, SIZE * 0.55, 7 - i, 5);
    // frayed hem
    g.fillStyle = 'rgba(80,60,40,0.4)';
    for (let x = 0; x < SIZE; x += 3) g.fillRect(x, SIZE - 3 - r() * 7, 2, 10);
  },

  /** Mi'naa patchwork: cloth with sewn patches of other tones, stitches and stains. Coloured, tinted lightly. */
  patched(g, r, n) {
    PAINTERS.cloth(g, r, n);
    const tones = ['rgba(120,70,40,0.35)', 'rgba(60,90,90,0.3)', 'rgba(200,160,100,0.35)', 'rgba(90,50,30,0.3)', 'rgba(255,240,210,0.25)'];
    for (let i = 0; i < 7; i++) {
      const w = 26 + r() * 50, h = 22 + r() * 44, x = r() * SIZE, y = r() * SIZE * 0.9;
      g.fillStyle = tones[i % tones.length];
      wrapped(g, (dx) => g.fillRect(x + dx, y, w, h));
      g.strokeStyle = 'rgba(40,25,15,0.6)';
      g.setLineDash([3, 3]);
      g.lineWidth = 1;
      wrapped(g, (dx) => g.strokeRect(x + dx + 1.5, y + 1.5, w - 3, h - 3));
      g.setLineDash([]);
    }
    // stains
    g.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 5; i++) {
      const x = r() * SIZE, y = r() * SIZE, rad = 10 + r() * 25;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(150,110,80,0.5)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.globalCompositeOperation = 'source-over';
  },

  leather(g, r, n) {
    field(g, (u, v) => 0.8 + 0.2 * n.fbm(u * 20, v * 20, 5) - (n(u * 60, v * 60) > 0.8 ? 0.1 : 0));
  },

  /** Worn metal: scratches and rust spots. Coloured spots, tint the base. */
  metal(g, r, n) {
    field(g, (u, v) => 0.85 + 0.15 * n.fbm(u * 10, v * 10));
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 0.7;
    for (let i = 0; i < 60; i++) {
      const x = r() * SIZE, y = r() * SIZE, a = r() * Math.PI, l = 5 + r() * 20;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 12; i++) {
      const x = r() * SIZE, y = r() * SIZE, rad = 4 + r() * 16;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(170,90,50,0.8)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.globalCompositeOperation = 'source-over';
  },

  /** Maker metal: oxidised grey-green with verdigris blooms. Tint lightly. */
  maker(g, r, n) {
    field(g, (u, v) => {
      const k = n.fbm(u * 9, v * 9, 5);
      return 0.75 + 0.3 * k;
    }, [0.95, 1.0, 0.95]);
    g.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 14; i++) {
      const x = r() * SIZE, y = r() * SIZE, rad = 8 + r() * 22;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, i % 3 ? 'rgba(120,160,130,0.7)' : 'rgba(90,70,50,0.7)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.globalCompositeOperation = 'source-over';
  },

  /**
   * Tel'sharin armour (telsharin-warden-pair-variant-c-weathered.png): oxidised grey-green with
   * rust blooms, dark shot pits with a bright rim, and pale scratches. Near-white: tint the base.
   */
  warden(g, r, n) {
    field(g, (u, v) => 0.7 + 0.36 * n.fbm(u * 6, v * 6, 5), [0.98, 1.0, 1.0]);
    g.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 16; i++) {
      const x = r() * SIZE, y = r() * SIZE, rad = 10 + r() * 26;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, i % 3 ? 'rgba(160,86,48,0.85)' : 'rgba(110,150,130,0.6)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      wrapped(g, (dx) => { for (const dy of [-SIZE, 0, SIZE]) g.fillRect(x - rad + dx, y - rad + dy, rad * 2, rad * 2); });
    }
    g.globalCompositeOperation = 'source-over';
    // shot pits: a dark hole with a rusty ring and a pale lip
    for (let i = 0; i < 5; i++) {
      const x = r() * SIZE, y = r() * SIZE, rad = 1.8 + r() * 2.5;
      g.fillStyle = 'rgba(150,80,45,0.55)';
      g.beginPath(); g.arc(x, y, rad * 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(230,225,210,0.6)';
      g.beginPath(); g.arc(x - 0.8, y - 0.8, rad * 1.25, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(20,16,14,0.95)';
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
    // scratches and edge wear
    g.strokeStyle = 'rgba(235,235,220,0.4)';
    for (let i = 0; i < 50; i++) {
      const x = r() * SIZE, y = r() * SIZE, a = r() * Math.PI, l = 6 + r() * 24;
      g.lineWidth = 0.6 + r() * 0.8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  },

  /** Bone and coral: pitted, porous, with growth lines. */
  bone(g, r, n) {
    field(g, (u, v) => {
      const pore = n(u * 70, v * 70) > 0.78 ? 0.7 : 1;
      const growth = 0.94 + 0.06 * Math.sin(v * 80 + 6 * n(u * 4, v * 4));
      return (0.85 + 0.15 * n.fbm(u * 8, v * 8)) * pore * growth;
    });
  },

  /** Hair: long strands along v. */
  hair(g, r, n) {
    field(g, (u, v) => 0.7 + 0.3 * n.fbm(u * 60, v * 3, 3));
  },

  /** Dog coat: short fur along v with a darker saddle near u = 0.5 (the back). */
  fur(g, r, n) {
    field(g, (u, v) => {
      const strand = 0.85 + 0.15 * n(u * 90, v * 12);
      const saddle = 1 - 0.3 * Math.exp(-Math.pow((u - 0.5) * 5, 2));
      return strand * saddle * (0.9 + 0.1 * n.fbm(u * 6, v * 6));
    });
  },
};

function seedFor(key: string): number {
  let seed = 7;
  for (let i = 0; i < key.length; i++) seed = Math.imul(seed ^ key.charCodeAt(i), 16777619);
  return seed >>> 0;
}
