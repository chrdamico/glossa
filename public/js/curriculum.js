import { RNG } from './rng.js';
import { generateLanguage, trueSentences, sceneKey, formatMorphs, MAX_N, REL_SUFFIX } from './lang.js';
import { initialHypotheses, observe, predictCompose, checkRead, checkSpot } from './learner.js';

const anyN = (k) => (s) => s.groups.some((g) => g.n >= k);

export const CHAMBERS = [
  {
    key: 'words', name: 'First Words', layouts: ['single'], n: [1, 1], shapes: 3, colors: 3, small: 0,
    minEvidence: 2, types: ['compose', 'read', 'spot'], focus: () => true,
    blurb: 'Single objects. What is each called?',
  },
  {
    key: 'count', name: 'Counting', layouts: ['single'], n: [1, 3], shapes: 4, colors: 4, small: 0,
    minEvidence: 3, types: ['compose', 'read', 'compose'], focus: anyN(2),
    blurb: 'Several of the same thing.',
  },
  {
    key: 'and', name: 'Together', layouts: ['mixed'], n: [1, 3], shapes: 5, colors: 4, small: 0,
    minEvidence: 2, types: ['read', 'compose', 'spot'], focus: (s) => s.layout === 'mixed',
    blurb: 'Two kinds of things, mixed together.',
  },
  {
    key: 'vert', name: 'Stacked', layouts: ['vert'], n: [1, 3], shapes: 6, colors: 4, small: 0,
    minEvidence: 2, types: ['compose', 'spot', 'compose'], focus: (s) => s.layout === 'vert',
    blurb: 'One group above another.',
  },
  {
    key: 'many', name: 'Multitudes', layouts: ['single', 'mixed'], n: [1, 6], shapes: 6, colors: 4, small: 0,
    minEvidence: 2, types: ['read', 'compose', 'compose'], focus: anyN(4),
    blurb: 'Larger numbers.',
  },
  {
    key: 'horiz', name: 'Side by Side', layouts: ['horiz'], n: [1, 4], shapes: 6, colors: 4, small: 0,
    minEvidence: 2, types: ['read', 'compose', 'spot'], focus: (s) => s.layout === 'horiz',
    blurb: 'One group beside another.',
  },
  {
    key: 'small', name: 'Small Things', layouts: ['single', 'mixed', 'vert', 'horiz'], n: [1, 3], shapes: 6, colors: 4, small: 0.5,
    minEvidence: 2, types: ['compose', 'read', 'compose'], focus: (s) => s.groups.some((g) => g.small),
    blurb: 'Size matters now.',
  },
  {
    key: 'final', name: 'The Last Door', layouts: ['mixed', 'vert', 'horiz'], n: [1, 6], shapes: 6, colors: 4, small: 0.3,
    minEvidence: 0, types: ['compose', 'read', 'spot', 'compose'], focus: (s) => s.groups.length === 2,
    blurb: 'Everything you have learned.',
  },
];

const MAX_EVIDENCE = 9;
const MAX_TOTAL = 9;

function validScene(s) {
  if (s.groups.length === 2) {
    const [a, b] = s.groups;
    if (a.shape === b.shape && a.color === b.color && !!a.small === !!b.small) return false;
    if (a.n + b.n > MAX_TOTAL) return false;
  }
  return true;
}

function randomScene(rng, def, shapes, colors) {
  const layout = rng.pick(def.layouts);
  const ng = layout === 'single' ? 1 : 2;
  const groups = [];
  for (let i = 0; i < ng; i++) {
    groups.push({
      shape: rng.pick(shapes),
      color: rng.pick(colors),
      n: rng.range(def.n[0], def.n[1]),
      small: def.small ? rng.chance(def.small) : false,
    });
  }
  return { layout, groups };
}

function sampleScenes(rng, def, shapes, colors, count, used) {
  const out = [];
  const keys = new Set();
  for (let t = 0; t < count * 30 && out.length < count; t++) {
    const s = randomScene(rng, def, shapes, colors);
    if (!validScene(s) || !def.focus(s)) continue;
    const k = sceneKey(s);
    if (keys.has(k) || used.has(k)) continue;
    keys.add(k);
    out.push(s);
  }
  return out;
}

function replaceGroup(scene, i, g) {
  return { layout: scene.layout, groups: scene.groups.map((x, j) => (j === i ? g : x)) };
}

function variants(scene, shapes, colors, allowSmall) {
  const out = [];
  scene.groups.forEach((g, i) => {
    for (const sh of shapes) if (sh !== g.shape) out.push({ type: 'shape', s: replaceGroup(scene, i, { ...g, shape: sh }) });
    for (const c of colors) if (c !== g.color) out.push({ type: 'color', s: replaceGroup(scene, i, { ...g, color: c }) });
    for (const n of [g.n - 1, g.n + 1, g.n + 2]) if (n >= 1 && n <= MAX_N) out.push({ type: 'count', s: replaceGroup(scene, i, { ...g, n }) });
    if (allowSmall) out.push({ type: 'size', s: replaceGroup(scene, i, { ...g, small: !g.small }) });
  });
  const [a, b] = scene.groups;
  if (scene.layout === 'vert' || scene.layout === 'horiz') {
    out.push({ type: 'swap', s: { layout: scene.layout, groups: [b, a] } });
    out.push({ type: 'layout', s: { layout: scene.layout === 'vert' ? 'horiz' : 'vert', groups: [a, b] } });
    out.push({ type: 'layout', s: { layout: 'mixed', groups: [a, b] } });
  }
  if (scene.layout === 'mixed') {
    out.push({ type: 'layout', s: { layout: 'vert', groups: [a, b] } });
    out.push({ type: 'layout', s: { layout: 'horiz', groups: [b, a] } });
  }
  const tk = sceneKey(scene);
  return out.filter((v) => validScene(v.s) && sceneKey(v.s) !== tk);
}

function pickDistractors(rng, scene, shapes, colors, allowSmall) {
  const vs = rng.shuffle(variants(scene, shapes, colors, allowSmall));
  const chosen = [];
  const keys = new Set([sceneKey(scene)]);
  const types = new Set();
  for (const pass of [0, 1]) {
    for (const v of vs) {
      if (chosen.length >= 3) break;
      const k = sceneKey(v.s);
      if (keys.has(k)) continue;
      if (pass === 0 && types.has(v.type)) continue;
      keys.add(k);
      types.add(v.type);
      chosen.push(v.s);
    }
  }
  return chosen.length === 3 ? chosen : null;
}

function category(k) {
  return k.split(/[:.|]/)[0];
}

export const GEN_VERSION = 4;

export function generateRun(seed, difficulty = 'scholar') {
  const rng = new RNG(`${seed}:${difficulty}:v${GEN_VERSION}`);
  const lang = generateLanguage(rng.fork('lang'), difficulty);
  const ctx = {
    lang,
    H: initialHypotheses(),
    used: new Set(),
    texts: new Set(),
    known: new Map(),
    tablets: [],
    shapes: new Set(),
    chamberStart: new Set(),
    difficulty,
  };
  const chambers = [];
  for (let ci = 0; ci < CHAMBERS.length; ci++) {
    chambers.push(buildChamber(rng.fork('ch' + ci), ctx, CHAMBERS[ci], ci));
  }
  return { seed, difficulty, lang, chambers };
}

function sceneTags(s) {
  const t = ['L:' + s.layout];
  for (const g of s.groups) {
    t.push('n:' + g.n, 'S:' + g.shape, 'C:' + g.color);
    if (g.small) t.push('small');
  }
  if (s.groups.length === 2 && !!s.groups[0].small !== !!s.groups[1].small) t.push('sizecontrast');
  return t;
}

function tagWeight(tag) {
  if (tag.startsWith('n:')) return 3;
  if (tag.startsWith('L:')) return 2;
  if (tag === 'small' || tag === 'sizecontrast') return 2;
  return 0.5;
}

function planEvidence(ctx, pool, c, budget, challengeKeys) {
  const usable = pool.filter((p) => !challengeKeys.has(sceneKey(p.scene)) && sceneKey(p.scene) !== sceneKey(c.scene));
  const scored = [];
  for (const p of usable) {
    const H2 = observe(ctx.H, p.scene, p.morphs);
    if (isDetermined(H2, c)) return [p];
    scored.push({ p, H2 });
  }
  if (budget < 2) return null;
  scored.sort((a, b) => a.H2.length - b.H2.length);
  for (const { p, H2 } of scored.slice(0, 8)) {
    for (const q of usable) {
      if (q === p) continue;
      if (isDetermined(observe(H2, q.scene, q.morphs), c)) return [p, q];
    }
  }
  return null;
}

function shapeSig(morphs) {
  return morphs.map((m) => (m.suf ? '-' : '') + m.k.split(/[:.|]/)[0]).join(' ');
}

function learn(ctx, scene, morphs) {
  ctx.tablets.push({ scene, morphs });
  ctx.shapes.add(shapeSig(morphs));
  ctx.H = observe(ctx.H, scene, morphs);
  if (!ctx.H.length) throw new Error('true language eliminated: ' + formatMorphs(morphs));
  ctx.used.add(sceneKey(scene));
  ctx.texts.add(formatMorphs(morphs));
  for (const m of morphs) if (!ctx.known.has(m.s)) ctx.known.set(m.s, m);
}

function freshCount(ctx, morphs) {
  return new Set(morphs.filter((m) => !ctx.chamberStart.has(m.s)).map((m) => m.s)).size;
}

function newMorphCount(ctx, morphs) {
  return new Set(morphs.filter((m) => !ctx.known.has(m.s)).map((m) => m.s)).size;
}

function buildChamber(rng, ctx, def, ci) {
  const { lang } = ctx;
  const shapes = lang.shapes.slice(0, def.shapes);
  const colors = lang.colors.slice(0, def.colors);
  const shapesNext = lang.shapes.slice(0, Math.min(def.shapes + 1, lang.shapes.length));
  const colorsNext = lang.colors.slice(0, Math.min(def.colors + 1, lang.colors.length));
  const allowSmall = def.small > 0;

  let pool = sampleScenes(rng, def, shapes, colors, 60, ctx.used).map((scene) => ({
    scene,
    morphs: rng.pick(trueSentences(lang, scene)),
  }));
  const evidence = [];
  const addEvidence = (t) => {
    evidence.push(t);
    learn(ctx, t.scene, t.morphs);
    pool = pool.filter((p) => sceneKey(p.scene) !== sceneKey(t.scene));
  };

  const seenTags = new Set();
  for (const t of ctx.tablets) for (const tag of sceneTags(t.scene)) seenTags.add(tag);
  for (let i = 0; i < def.minEvidence && pool.length; i++) {
    let best = [], bestScore = -Infinity;
    for (const p of pool) {
      const nm = newMorphCount(ctx, p.morphs);
      if (nm > 3) continue;
      let sc = -Math.max(0, nm - 1) * 1.5 + rng.next() * 0.3;
      for (const tag of sceneTags(p.scene)) if (!seenTags.has(tag)) sc += tagWeight(tag);
      if (sc > bestScore + 1e-9) { best = [p]; bestScore = sc; }
    }
    if (!best.length) break;
    const pick = best[0];
    for (const tag of sceneTags(pick.scene)) seenTags.add(tag);
    addEvidence(pick);
  }
  if (ctx.difficulty === 'novice' && pool.length) addEvidence(rng.pick(pool));
  ctx.chamberStart = new Set(ctx.known.keys());
  for (const e of evidence) for (const m of e.morphs) ctx.chamberStart.delete(m.s);

  const challenges = [];
  const challengeKeys = new Set();
  const types = typesFor(def, lang);
  for (let slot = 0; slot < types.length; slot++) {
    let type = types[slot];
    let chosen = null;
    for (let guard = 0; guard < 14 && !chosen; guard++) {
      const cands = makeCandidates(rng, ctx, def, type, shapes, colors, shapesNext, colorsNext, allowSmall, challengeKeys);
      cands.sort((a, b) => b.interest - a.interest);
      const room = MAX_EVIDENCE - evidence.length;
      for (const c of cands.slice(0, 6)) {
        if (isDetermined(ctx.H, c)) { chosen = c; break; }
        if (room <= 0) continue;
        const plan = planEvidence(ctx, pool, c, Math.min(2, room), challengeKeys);
        if (plan) {
          for (const p of plan) addEvidence(p);
          chosen = c;
          break;
        }
      }
      if (chosen) break;
      const det = cands.filter((c) => isDetermined(ctx.H, c));
      if (det.length) {
        chosen = bestCandidate(rng, det);
        break;
      }
      if (evidence.length >= MAX_EVIDENCE || !pool.length) {
        if (type !== 'compose') { type = 'compose'; continue; }
        break;
      }
      let best = null, bestScore = -1, bestH = Infinity;
      for (const p of pool) {
        if (challengeKeys.has(sceneKey(p.scene))) continue;
        const H2 = observe(ctx.H, p.scene, p.morphs);
        const score = cands.reduce((a, c) => a + (isDetermined(H2, c) ? 1 : 0), 0);
        if (score > bestScore || (score === bestScore && H2.length < bestH)) {
          best = p; bestScore = score; bestH = H2.length;
        }
      }
      if (!best) break;
      addEvidence(best);
    }
    if (!chosen) throw new Error(`chamber ${def.key} slot ${slot}: no determinable challenge`);
    challengeKeys.add(sceneKey(chosen.scene));
    pool = pool.filter((p) => !challengeKeys.has(sceneKey(p.scene)));
    const ans = answerTablet(chosen);
    learn(ctx, ans.scene, ans.morphs);
    challenges.push(chosen);
  }

  const reserve = pool.slice(0, 14);
  for (const r of reserve) ctx.used.add(sceneKey(r.scene));
  return { def: { key: def.key, name: def.name, blurb: def.blurb }, index: ci, evidence, challenges, reserve };
}

function typesFor(def, lang) {
  const p = lang.params;
  if (def.key === 'many' && p.nums === 'simple') return ['read', 'compose'];
  if (def.key === 'horiz') return REL_SUFFIX.has(p.rel) ? ['read', 'compose', 'spot'] : ['compose', 'spot'];
  if (def.key === 'small' && p.dim !== 'suffix') return ['compose', 'read'];
  return def.types;
}

export function answerTablet(c) {
  if (c.type === 'read') return { scene: c.options[c.answer], morphs: c.morphs };
  return { scene: c.scene, morphs: c.solution };
}

function isDetermined(H, c) {
  if (c.type === 'compose') {
    const r = predictCompose(H, c.scene);
    return r.determined;
  }
  if (c.type === 'read') return checkRead(H, c.morphs, c.options, c.answer);
  return checkSpot(H, c.scene, c.morphs, c.wrong);
}

function bestCandidate(rng, det) {
  const max = Math.max(...det.map((c) => c.interest));
  const top = det.filter((c) => c.interest >= max - 1);
  return rng.pick(top);
}

function makeCandidates(rng, ctx, def, type, shapes, colors, shapesNext, colorsNext, allowSmall, challengeKeys) {
  const { lang } = ctx;
  const out = [];
  const exclude = new Set([...ctx.used, ...challengeKeys]);
  if (type === 'compose') {
    for (const scene of sampleScenes(rng, def, shapes, colors, 24, exclude)) {
      const sols = trueSentences(lang, scene);
      if (sols.some((m) => ctx.texts.has(formatMorphs(m)))) continue;
      const interest = Math.min(sols[0].length, 8) + 2 * Math.min(3, freshCount(ctx, sols[0])) + (ctx.shapes.has(shapeSig(sols[0])) ? 0 : 4);
      out.push({ type, scene, solution: sols[0], solutions: sols.map(formatMorphs), interest });
    }
  } else if (type === 'read') {
    for (const scene of sampleScenes(rng, def, shapesNext, colorsNext, 24, exclude)) {
      const morphs = rng.pick(trueSentences(lang, scene));
      if (ctx.texts.has(formatMorphs(morphs))) continue;
      const dis = pickDistractors(rng, scene, shapesNext, colorsNext, allowSmall);
      if (!dis) continue;
      const options = rng.shuffle([scene, ...dis]);
      const answer = options.indexOf(scene);
      const fresh = newMorphCount(ctx, morphs);
      if (fresh > 2) continue;
      const interest = (fresh >= 1 ? 6 : 0) + Math.min(morphs.length, 6) + Math.min(2, freshCount(ctx, morphs));
      out.push({ type, scene, morphs, options, answer, interest });
    }
  } else {
    const knownList = [...ctx.known.values()];
    for (const scene of sampleScenes(rng, def, shapes, colors, 24, exclude)) {
      const sols = trueSentences(lang, scene);
      const solution = rng.pick(sols);
      if (solution.some((m) => !ctx.known.has(m.s))) continue;
      const valid = new Set(sols.map(formatMorphs));
      const positions = rng.shuffle(solution.map((_, i) => i));
      for (const i of positions) {
        const m = solution[i];
        const same = knownList.filter((x) => !!x.suf === !!m.suf && x.s !== m.s && category(x.k) === category(m.k));
        const pool = same.length ? same : knownList.filter((x) => !!x.suf === !!m.suf && x.s !== m.s);
        if (!pool.length) continue;
        const r = rng.pick(pool);
        const morphs = solution.map((x, j) => (j === i ? { s: r.s, suf: r.suf } : { s: x.s, suf: x.suf }));
        if (valid.has(formatMorphs(morphs))) continue;
        const interest = (same.length ? 3 : 0) + (category(m.k) === 'S' || category(m.k) === 'C' ? 0 : 3) + Math.min(solution.length, 5) + (ctx.chamberStart.has(m.s) ? 0 : 3);
        out.push({ type: 'spot', scene, morphs, wrong: i, solution, interest });
        break;
      }
    }
  }
  return out;
}
