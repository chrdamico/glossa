import { RNG, hashString } from './rng.js';
import { sceneKey } from './lang.js';

export const PIGMENT = {
  red: '#e2553f',
  blue: '#4d86ec',
  yellow: '#f2c94c',
  green: '#3fae6a',
  white: '#efe9dc',
};

const OUTLINE = 'rgba(10,8,14,.45)';
let patterns = false;

export function setPatterns(on) {
  patterns = !!on;
}

export const PATTERN_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <pattern id="gp-red" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="5" fill="rgba(20,10,10,.55)"/></pattern>
  <pattern id="gp-blue" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.1" fill="rgba(255,255,255,.75)"/></pattern>
  <pattern id="gp-green" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 3H6M3 0V6" stroke="rgba(10,30,15,.55)" stroke-width="1.1"/></pattern>
  <pattern id="gp-yellow" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="1.6" fill="rgba(60,40,0,.45)"/></pattern>
</defs></svg>`;

function f(n) {
  return Math.round(n * 100) / 100;
}

function poly(pts) {
  return pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
}

export function shapeMarkup(shape, r, color) {
  const st = `stroke="${OUTLINE}" stroke-width="${f(Math.max(0.8, r * 0.09))}" stroke-linejoin="round"`;
  switch (shape) {
    case 'circle':
      return `<circle r="${f(r)}" fill="${color}" ${st}/>`;
    case 'ring':
      return `<circle r="${f(r * 0.74)}" fill="none" stroke="${color}" stroke-width="${f(r * 0.48)}"/>` +
        `<circle r="${f(r * 0.98)}" fill="none" stroke="${OUTLINE}" stroke-width="${f(r * 0.06)}"/>` +
        `<circle r="${f(r * 0.5)}" fill="none" stroke="${OUTLINE}" stroke-width="${f(r * 0.06)}"/>`;
    case 'crescent': {
      const R = r * 1.05, R2 = R * 0.84, d = R * 0.56;
      const x = (R * R - R2 * R2 + d * d) / (2 * d);
      const y = Math.sqrt(R * R - x * x);
      return `<path transform="rotate(-25)" d="M${f(x)},${f(-y)} A${f(R)},${f(R)} 0 1 0 ${f(x)},${f(y)} A${f(R2)},${f(R2)} 0 0 1 ${f(x)},${f(-y)} Z" fill="${color}" ${st}/>`;
    }
    case 'flower': {
      let s = '';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        s += `<circle cx="${f(Math.cos(a) * r * 0.55)}" cy="${f(Math.sin(a) * r * 0.55)}" r="${f(r * 0.47)}" fill="${color}" ${st}/>`;
      }
      return s + `<circle r="${f(r * 0.4)}" fill="${color}"/><circle r="${f(r * 0.2)}" fill="${OUTLINE}"/>`;
    }
    case 'triangle':
      return `<polygon points="${poly([[0, -r * 1.15], [r * 1.05, r * 0.72], [-r * 1.05, r * 0.72]])}" fill="${color}" ${st}/>`;
    case 'square':
      return `<rect x="${f(-r * 0.86)}" y="${f(-r * 0.86)}" width="${f(r * 1.72)}" height="${f(r * 1.72)}" rx="${f(r * 0.1)}" fill="${color}" ${st}/>`;
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 ? r * 0.5 : r * 1.22;
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr + r * 0.08]);
      }
      return `<polygon points="${poly(pts)}" fill="${color}" ${st}/>`;
    }
    case 'cross': {
      const a = r * 0.36, b = r * 1.08;
      return `<polygon points="${poly([[-a, -b], [a, -b], [a, -a], [b, -a], [b, a], [a, a], [a, b], [-a, b], [-a, a], [-b, a], [-b, -a], [-a, -a]])}" fill="${color}" ${st}/>`;
    }
  }
  return '';
}

const PATTERNS = {
  1: [[0, 0]],
  2: [[-0.5, 0], [0.5, 0]],
  3: [[-0.5, 0.43], [0.5, 0.43], [0, -0.43]],
  4: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]],
  5: [[-1, -0.5], [0, -0.5], [1, -0.5], [-0.5, 0.5], [0.5, 0.5]],
  6: [[-1, -0.5], [0, -0.5], [1, -0.5], [-1, 0.5], [0, 0.5], [1, 0.5]],
  7: [[-1, -0.5], [0, -0.5], [1, -0.5], [-1.5, 0.5], [-0.5, 0.5], [0.5, 0.5], [1.5, 0.5]],
  8: [[-1.5, -0.5], [-0.5, -0.5], [0.5, -0.5], [1.5, -0.5], [-1.5, 0.5], [-0.5, 0.5], [0.5, 0.5], [1.5, 0.5]],
  9: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
};

const R_NORMAL = 13.5;
const R_SMALL = 7.5;

function placeItems(items, cx, cy, rng, spacing) {
  const pat = PATTERNS[items.length];
  return items.map((it, i) => ({
    ...it,
    x: cx + pat[i][0] * spacing + (rng.next() - 0.5) * 3,
    y: cy + pat[i][1] * spacing + (rng.next() - 0.5) * 3,
    rot: (rng.next() - 0.5) * 16,
  }));
}

function expandGroup(g) {
  return Array.from({ length: g.n }, () => ({ shape: g.shape, color: g.color, small: !!g.small }));
}

export function layoutScene(scene) {
  const rng = new RNG(hashString(sceneKey(scene) + scene.layout));
  const gs = scene.groups;
  const spacingFor = (items) => (items.every((i) => i.small) ? 23 : 33);
  let placed = [];
  if (scene.layout === 'single') {
    const items = expandGroup(gs[0]);
    placed = placeItems(items, 100, 65, rng, spacingFor(items));
  } else if (scene.layout === 'mixed') {
    const items = rng.shuffle([...expandGroup(gs[0]), ...expandGroup(gs[1])]);
    placed = placeItems(items, 100, 65, rng, spacingFor(items));
  } else if (scene.layout === 'vert') {
    const a = expandGroup(gs[0]), b = expandGroup(gs[1]);
    placed = [...placeItems(a, 100, 33, rng, spacingFor(a) * 0.9), ...placeItems(b, 100, 97, rng, spacingFor(b) * 0.9)];
  } else {
    const a = expandGroup(gs[0]), b = expandGroup(gs[1]);
    placed = [...placeItems(a, 50, 65, rng, spacingFor(a)), ...placeItems(b, 150, 65, rng, spacingFor(b))];
  }
  return placed;
}

export function sceneSVG(scene, cls = 'pic') {
  const items = layoutScene(scene);
  let body = '';
  if (scene.layout === 'vert') body += `<line class="divider" x1="22" y1="65" x2="178" y2="65"/>`;
  if (scene.layout === 'horiz') body += `<line class="divider" x1="100" y1="12" x2="100" y2="118"/>`;
  for (const it of items) {
    const r = it.small ? R_SMALL : R_NORMAL;
    const rot = it.shape === 'circle' || it.shape === 'ring' ? 0 : it.rot;
    const over = patterns && it.color !== 'white' ? shapeMarkup(it.shape, r, `url(#gp-${it.color})`) : '';
    body += `<g transform="translate(${f(it.x)},${f(it.y)}) rotate(${f(rot)})">${shapeMarkup(it.shape, r, PIGMENT[it.color])}${over}</g>`;
  }
  return `<svg class="${cls}" viewBox="0 0 200 130" role="img" aria-label="${describeScene(scene)}">${body}</svg>`;
}

export function shapeIcon(shape, color = 'currentColor', size = 14) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="-14 -14 28 28">${shapeMarkup(shape, 10, color)}</svg>`;
}

export function describeScene(scene) {
  const g = (x) => `${x.n} ${x.small ? 'small ' : ''}${x.color} ${x.shape}${x.n > 1 ? (x.shape === 'cross' ? 'es' : 's') : ''}`;
  const [a, b] = scene.groups;
  if (scene.layout === 'single') return g(a);
  if (scene.layout === 'mixed') return `${g(a)} mixed with ${g(b)}`;
  if (scene.layout === 'vert') return `${g(a)} above ${g(b)}`;
  return `${g(a)} left of ${g(b)}`;
}
