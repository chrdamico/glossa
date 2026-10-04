export const SHAPES = ['circle', 'crescent', 'ring', 'flower', 'triangle', 'square', 'star', 'cross'];
export const SHAPE_CLASS = {
  circle: 'r', crescent: 'r', ring: 'r', flower: 'r',
  triangle: 'a', square: 'a', star: 'a', cross: 'a',
};
export const COLORS = ['red', 'blue', 'yellow', 'green', 'white'];
export const MAX_N = 6;

export const PARAM_SPACE = {
  na: ['NA', 'AN'],
  qpos: [0, 1, 2],
  one: [false, true],
  plural: ['none', 'suffix', 'dual', 'redup', 'adj', 'both'],
  nums: ['simple', 'base3', 'base4'],
  agr: ['none', 'suffix', 'classifier'],
  harm: [false, true],
  dim: ['suffix', 'before', 'after'],
  conj: ['medial', 'both', 'clitic'],
  rel: ['FRG', 'GRF', 'FGR', 'GsF', 'FGs', 'FsG'],
  grue: [false, true],
};

export const REL_SUFFIX = new Set(['GsF', 'FGs', 'FsG']);

export class Need {
  constructor(p) { this.p = p; }
}

export function vclass(s) {
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s[i];
    if (c === 'e' || c === 'i') return 'f';
    if (c === 'a' || c === 'o' || c === 'u') return 'b';
  }
  return 'b';
}

function numeral(n, get) {
  if (n <= 3) return ['N:' + n];
  const sys = get('nums');
  if (sys === 'simple') return ['N:' + n];
  const k = sys === 'base3' ? 3 : 4;
  if (n <= k) return ['N:' + n];
  return ['N:' + k, ...numeral(n - k, get)];
}

function np(g, get) {
  const cls = SHAPE_CLASS[g.shape];
  const n = g.n;
  let Q = [];
  let pl = null;
  if (n >= 2) pl = get('plural');
  if (n === 1) {
    if (get('one')) Q = [{ k: 'N:1' }];
  } else if (!(n === 2 && pl === 'dual')) {
    Q = numeral(n, get).map((k) => ({ k }));
  }
  const stem = { k: 'S:' + g.shape };
  let N = pl === 'redup' ? [stem, stem] : [stem];
  if (g.small) {
    const d = get('dim');
    if (d === 'suffix') N = [...N, { k: 'DIM', suf: true }];
    else if (d === 'before') N = [{ k: 'SMALL' }, ...N];
    else N = [...N, { k: 'SMALL' }];
  }
  if (pl === 'suffix' || pl === 'both') N = [...N, { k: 'PL', suf: true }];
  else if (pl === 'dual') N = [...N, { k: n === 2 ? 'DU' : 'PL', suf: true }];
  const grue = (g.color === 'blue' || g.color === 'green') && get('grue');
  let A = [{ k: grue ? 'C:grue' : 'C:' + g.color }];
  if (pl === 'adj' || pl === 'both') A = [...A, { k: 'PL', suf: true }];
  const agr = get('agr');
  if (agr === 'suffix') A = [...A, { k: 'AGR.' + cls, suf: true }];
  else if (agr === 'classifier' && Q.length) Q = [...Q, { k: 'CLS.' + cls }];
  const core = get('na') === 'NA' ? [N, A] : [A, N];
  if (!Q.length) return [...core[0], ...core[1]];
  const q = get('qpos');
  if (q === 0) return [...Q, ...core[0], ...core[1]];
  if (q === 1) return [...core[0], ...Q, ...core[1]];
  return [...core[0], ...core[1], ...Q];
}

function tokSig(toks) {
  return toks.map((t) => (t.suf ? '-' : '') + t.k).join(' ');
}

export function realize(scene, get) {
  const gs = scene.groups;
  let alts;
  if (scene.layout === 'single') {
    alts = [np(gs[0], get)];
  } else if (scene.layout === 'mixed') {
    const c = get('conj');
    alts = [[0, 1], [1, 0]].map(([i, j]) => {
      const A = np(gs[i], get);
      const B = np(gs[j], get);
      if (c === 'medial') return [...A, { k: 'CONJ' }, ...B];
      if (c === 'both') return [{ k: 'CONJ' }, ...A, { k: 'CONJ' }, ...B];
      return [...A, ...B, { k: 'CONJ', suf: true }];
    });
    if (tokSig(alts[0]) === tokSig(alts[1])) alts = [alts[0]];
  } else {
    const R = scene.layout === 'vert' ? 'REL.V' : 'REL.H';
    const F = np(gs[0], get);
    const G = np(gs[1], get);
    switch (get('rel')) {
      case 'FRG': alts = [[...F, { k: R }, ...G]]; break;
      case 'GRF': alts = [[...G, { k: R }, ...F]]; break;
      case 'FGR': alts = [[...F, ...G, { k: R }]]; break;
      case 'GsF': alts = [[...G, { k: R, suf: true }, ...F]]; break;
      case 'FsG': alts = [[...F, { k: R, suf: true }, ...G]]; break;
      default: alts = [[...F, ...G, { k: R, suf: true }]];
    }
  }
  if (alts[0].some((t) => t.suf)) get('harm');
  return alts;
}

export function expand(params, fn) {
  const out = [];
  const stack = [params];
  while (stack.length) {
    const p = stack.pop();
    const get = (name) => {
      if (name in p) return p[name];
      throw new Need(name);
    };
    try {
      out.push({ params: p, result: fn(get) });
    } catch (e) {
      if (!(e instanceof Need)) throw e;
      const vals = PARAM_SPACE[e.p];
      for (let i = vals.length - 1; i >= 0; i--) stack.push({ ...p, [e.p]: vals[i] });
    }
  }
  return out;
}

export function morphKey(toks, i, strs, harm) {
  const t = toks[i];
  return t.suf && harm ? t.k + '|' + vclass(strs[i - 1]) : t.k;
}

export function formatMorphs(morphs) {
  let out = '';
  morphs.forEach((m, i) => {
    if (m.suf) out += '·' + m.s;
    else out += (i ? ' ' : '') + m.s;
  });
  return out;
}

export function trueSentences(lang, scene) {
  const get = (n) => lang.params[n];
  const alts = realize(scene, get);
  const seen = new Set();
  const out = [];
  for (const toks of alts) {
    const strs = [];
    const morphs = toks.map((t, i) => {
      const k = morphKey(toks, i, strs, lang.params.harm);
      const s = lang.lex[k];
      if (s === undefined) throw new Error('missing lex ' + k);
      strs.push(s);
      return { s, suf: !!t.suf, k };
    });
    const f = formatMorphs(morphs);
    if (!seen.has(f)) {
      seen.add(f);
      out.push(morphs);
    }
  }
  return out;
}

export function sceneKey(scene) {
  const g = scene.groups.map((x) => `${x.n}${x.color}${x.shape}${x.small ? 's' : ''}`);
  if (scene.layout === 'mixed') g.sort();
  return scene.layout + ':' + g.join('|');
}

const VOWELS = ['a', 'e', 'i', 'o', 'u'];
const CONS_POOL = ['p', 't', 'k', 'b', 'd', 'g', 'm', 'n', 's', 'z', 'l', 'r', 'v', 'f', 'h', 'y'];
const HARM_PAIRS = [['i', 'u'], ['e', 'o'], ['e', 'a'], ['i', 'a']];

function lev(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

export const EXOTICS = ['dual', 'redup', 'pluralAdj', 'base', 'agrSuffix', 'classifier', 'harm', 'conj', 'relSuffix', 'one', 'grue'];

const PLURAL_EXOTICS = ['dual', 'redup', 'pluralAdj'];

export function chooseParams(rng, difficulty, colors = COLORS) {
  const p = {
    na: rng.pick(PARAM_SPACE.na),
    qpos: rng.pick(PARAM_SPACE.qpos),
    one: false,
    plural: rng.chance(0.75) ? 'suffix' : 'none',
    nums: 'simple',
    agr: 'none',
    harm: false,
    dim: rng.pick(PARAM_SPACE.dim),
    conj: 'medial',
    rel: rng.pick(['FRG', 'GRF', 'FGR']),
    grue: false,
  };
  const count = { novice: 1, scholar: 3, polyglot: 5 }[difficulty] ?? 3;
  const applied = [];
  const pool = rng.shuffle(EXOTICS);
  for (const e of pool) {
    if (applied.length >= count) break;
    if (PLURAL_EXOTICS.includes(e) && applied.some((a) => PLURAL_EXOTICS.includes(a))) continue;
    if (e === 'grue' && !(colors.includes('blue') && colors.includes('green'))) continue;
    if ((e === 'agrSuffix' || e === 'classifier') && (applied.includes('agrSuffix') || applied.includes('classifier'))) continue;
    if (e === 'harm') continue;
    if (difficulty === 'novice' && (e === 'classifier' || e === 'relSuffix' || e === 'redup' || e === 'grue' || e === 'pluralAdj')) continue;
    applied.push(e);
  }
  for (const e of applied) {
    if (e === 'dual') p.plural = 'dual';
    if (e === 'redup') p.plural = 'redup';
    if (e === 'pluralAdj') p.plural = rng.pick(['adj', 'both']);
    if (e === 'grue') p.grue = true;
    if (e === 'base') p.nums = rng.pick(['base3', 'base4']);
    if (e === 'agrSuffix') p.agr = 'suffix';
    if (e === 'classifier') p.agr = 'classifier';
    if (e === 'conj') p.conj = rng.pick(['both', 'clitic']);
    if (e === 'relSuffix') p.rel = rng.pick(['GsF', 'FGs', 'FsG']);
    if (e === 'one') p.one = true;
  }
  const hasSuffix = p.plural !== 'none' && p.plural !== 'redup' || p.agr === 'suffix' || p.dim === 'suffix' || p.conj === 'clitic' || REL_SUFFIX.has(p.rel);
  const wantHarm = difficulty === 'polyglot' ? 0.85 : difficulty === 'scholar' ? 0.3 : 0;
  if (hasSuffix && applied.length < count + 1 && rng.chance(wantHarm)) {
    p.harm = true;
    applied.push('harm');
  }
  return p;
}

export function lexKeys(p, shapes, colors) {
  const free = [];
  const suf = [];
  for (const s of shapes) free.push({ k: 'S:' + s, syl: 2 });
  for (const c of colors) {
    if (p.grue && (c === 'blue' || c === 'green')) {
      if (!free.some((f) => f.k === 'C:grue')) free.push({ k: 'C:grue', syl: 2 });
    } else free.push({ k: 'C:' + c, syl: 2 });
  }
  for (let n = 1; n <= MAX_N; n++) free.push({ k: 'N:' + n, syl: 2 });
  if (p.plural !== 'none' && p.plural !== 'redup') suf.push('PL');
  if (p.plural === 'dual') suf.push('DU');
  if (p.dim === 'suffix') suf.push('DIM');
  else free.push({ k: 'SMALL', syl: 2 });
  if (p.agr === 'suffix') suf.push('AGR.r', 'AGR.a');
  if (p.agr === 'classifier') free.push({ k: 'CLS.r', syl: 2 }, { k: 'CLS.a', syl: 2 });
  if (p.conj === 'clitic') suf.push('CONJ');
  else free.push({ k: 'CONJ', syl: 1 });
  if (REL_SUFFIX.has(p.rel)) suf.push('REL.V', 'REL.H');
  else free.push({ k: 'REL.V', syl: 2 }, { k: 'REL.H', syl: 2 });
  return { free, suf };
}

export function generateLanguage(rng, difficulty = 'scholar') {
  const round = rng.shuffle(SHAPES.filter((s) => SHAPE_CLASS[s] === 'r')).slice(0, 3);
  const angular = rng.shuffle(SHAPES.filter((s) => SHAPE_CLASS[s] === 'a')).slice(0, 3);
  const shapes = rng.chance(0.5) ? [...round, ...angular] : [...angular, ...round];
  const colors = rng.shuffle(COLORS).slice(0, 4);
  const params = chooseParams(rng, difficulty, colors);
  for (let attempt = 0; attempt < 200; attempt++) {
    const lex = makeLexicon(rng, params, shapes, colors);
    if (lex) {
      return { params, shapes, colors, lex, difficulty, name: makeName(rng, lex) };
    }
  }
  throw new Error('lexicon generation failed');
}

function makeName(rng, lex) {
  const used = new Set(Object.values(lex));
  const cons = [...new Set(Object.values(lex).join('').split('').filter((c) => !VOWELS.includes(c)))];
  for (;;) {
    let w = '';
    for (let i = 0; i < 3; i++) w += rng.pick(cons) + rng.pick(VOWELS);
    if (!used.has(w)) return w[0].toUpperCase() + w.slice(1);
  }
}

function makeLexicon(rng, p, shapes, colors) {
  const cons = rng.shuffle(CONS_POOL).slice(0, 9);
  const { free, suf } = lexKeys(p, shapes, colors);
  const lex = {};
  const used = new Set();
  const freeWords = [];
  const syl = () => rng.pick(cons) + rng.pick(VOWELS);
  for (const { k, syl: n } of free) {
    let ok = false;
    for (let t = 0; t < 400 && !ok; t++) {
      let w = '';
      for (let i = 0; i < n; i++) w += syl();
      if (n >= 2 && w.slice(0, 2) === w.slice(2, 4)) continue;
      if (used.has(w)) continue;
      if (n >= 2 && freeWords.some((o) => o.length >= 4 && lev(o, w) < 2)) continue;
      lex[k] = w;
      used.add(w);
      freeWords.push(w);
      ok = true;
    }
    if (!ok) return null;
  }
  const sufCons = rng.shuffle(cons);
  let ci = 0;
  for (const k of suf) {
    let ok = false;
    for (let t = 0; t < 60 && !ok; t++) {
      const c = sufCons[ci % sufCons.length];
      ci++;
      if (p.harm) {
        const [f, b] = rng.pick(HARM_PAIRS);
        const wf = c + f, wb = c + b;
        if (used.has(wf) || used.has(wb)) continue;
        lex[k + '|f'] = wf;
        lex[k + '|b'] = wb;
        used.add(wf);
        used.add(wb);
      } else {
        const w = c + rng.pick(VOWELS);
        if (used.has(w)) continue;
        lex[k] = w;
        used.add(w);
      }
      ok = true;
    }
    if (!ok) return null;
  }
  if (p.harm) {
    const nounCls = shapes.map((s) => vclass(lex['S:' + s]));
    const colCls = colors.map((c) => vclass(lex['C:' + c] || lex['C:grue']));
    const both = (a) => a.filter((x) => x === 'f').length >= 2 && a.filter((x) => x === 'b').length >= 2;
    if (!both(nounCls)) return null;
    const colourSuffix = p.agr === 'suffix' || p.plural === 'adj' || p.plural === 'both';
    if (colourSuffix && !(colCls.includes('f') && colCls.includes('b'))) return null;
  }
  return lex;
}
