// Simple painted silhouettes for dialogue portraits. Inline SVG, tinted per kind.
import type { DialogueView } from './types';

export type PortraitKind = NonNullable<DialogueView['portrait']>;

interface Look {
  bg: [string, string];
  body: string;
  rim: string;
  head: string; // extra head markup, drawn over the head
  shape?: string; // head outline path, replaces the oval
}

const LOOKS: Record<PortraitKind, Look> = {
  apprentice: {
    bg: ['#2d4a48', '#12201f'],
    body: '#6d7c78',
    rim: '#7fe0d2',
    head: '<path d="M47 41 L50 37.5 L53 41 L50 44.5 Z" fill="#7fe0d2"/>',
    shape: 'M35 50 L39 35 L50 30 L61 35 L65 50 L59 67 L41 67 Z',
  },
  iskari: {
    bg: ['#2a4240', '#111b1a'],
    body: '#78807a',
    rim: '#6fd6c8',
    head: '<path d="M42 44 H47 M53 44 H58" stroke="#6fd6c8" stroke-width="1.2" opacity=".8"/>',
    shape: 'M34 50 L38 34 L50 29 L62 34 L66 50 L60 68 L40 68 Z',
  },
  minaa: {
    bg: ['#5a3d22', '#1c130c'],
    body: '#8a6a48',
    rim: '#e8a43c',
    head: '<rect x="35" y="40" width="30" height="6" rx="3" fill="#e8a43c" opacity=".85"/>',
  },
  scavenger: {
    bg: ['#5a2a1e', '#1a0f0b'],
    body: '#5b3a2e',
    rim: '#d0694a',
    head: '<path d="M28 58 C26 30 40 20 50 20 C60 20 74 30 72 58 Z" fill="#4a2f25"/>',
  },
  sehari: {
    bg: ['#5a4a2a', '#1b160c'],
    body: '#9a8058',
    rim: '#e8c97a',
    head: '<path d="M34 40 L24 28 L38 36 Z M66 40 L76 28 L62 36 Z" fill="#9a8058"/>',
  },
  player: {
    bg: ['#4a3a2a', '#17110c'],
    body: '#a08c70',
    rim: '#e6d9bf',
    head: '',
  },
  narrator: {
    bg: ['#2a211a', '#0e0a08'],
    body: '#3a2e24',
    rim: '#b8a88a',
    head: '',
  },
  foreman: {
    bg: ['#5e4520', '#1c140a'],
    body: '#7a6040',
    rim: '#f0b24a',
    head: '<rect x="33" y="24" width="34" height="8" rx="2" fill="#5a4630"/>',
  },
  record: {
    bg: ['#1a3550', '#07101a'],
    body: '#5aa8e8',
    rim: '#bfe6ff',
    head: '',
  },
};

let uid = 0;

export function portraitSvg(kind: PortraitKind): string {
  const L = LOOKS[kind];
  const id = `pt${++uid}`;
  const ghost = kind === 'record';
  const figure =
    kind === 'narrator'
      ? `<g stroke="${L.rim}" stroke-width="1.5" fill="none" opacity=".75">
           <path d="M22 60 C34 44 66 44 78 60 C66 76 34 76 22 60 Z"/><circle cx="50" cy="60" r="8"/>
           <circle cx="50" cy="60" r="2.5" fill="${L.rim}"/></g>`
      : `<g ${ghost ? `opacity=".72" filter="url(#${id}g)"` : ''}>
           <path d="M14 124 C16 96 30 82 50 82 C70 82 84 96 86 124 Z" fill="${L.body}"/>
           <rect x="43" y="66" width="14" height="20" fill="${L.body}"/>
           ${L.shape ? `<path d="${L.shape}" fill="${L.body}"/>` : `<ellipse cx="50" cy="50" rx="15" ry="19" fill="${L.body}"/>`}
           ${L.head}
           <path d="M14 124 C16 96 30 82 50 82" stroke="${L.rim}" stroke-width="1.6" fill="none" opacity=".7"/>
           <path d="${L.shape ? 'M35 50 L39 35 L50 30' : 'M35 50 C35 38 42 31 50 31'}" stroke="${L.rim}" stroke-width="1.4" fill="none" opacity=".75"/>
           ${ghost ? `<g stroke="${L.rim}" opacity=".35">${[20, 34, 48, 62, 76, 90, 104].map((y) => `<path d="M0 ${y} H100"/>`).join('')}</g>` : ''}
         </g>`;
  return `<svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <radialGradient id="${id}b" cx="50%" cy="38%" r="75%">
        <stop offset="0" stop-color="${L.bg[0]}"/><stop offset="1" stop-color="${L.bg[1]}"/>
      </radialGradient>
      <filter id="${id}g"><feGaussianBlur stdDeviation="0.8"/></filter>
    </defs>
    <rect width="100" height="120" fill="url(#${id}b)"/>
    <circle cx="70" cy="28" r="26" fill="${L.rim}" opacity=".10"/>
    ${figure}
    <rect width="100" height="120" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="6"/>
  </svg>`;
}
