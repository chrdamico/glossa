import test from 'node:test';
import assert from 'node:assert/strict';
import { PARAM_SPACE, lexKeys, trueSentences, formatMorphs, SHAPES, COLORS } from '../public/js/lang.js';
import { initialHypotheses, observe, predictCompose, checkRead } from '../public/js/learner.js';
import { RNG } from '../public/js/rng.js';

function makeLang(params) {
  const shapes = ['circle', 'crescent', 'ring', 'triangle', 'square', 'star'];
  const colors = ['red', 'blue', 'yellow', 'green'];
  const { free, suf } = lexKeys(params, shapes, colors);
  const lex = {};
  let i = 0;
  const word = () => 'w' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i++ / 26)) + 'a';
  for (const { k } of free) lex[k] = word();
  for (const k of suf) {
    if (params.harm) {
      lex[k + '|f'] = 's' + i + 'i';
      lex[k + '|b'] = 's' + i++ + 'u';
    } else lex[k] = 's' + i++ + 'o';
  }
  return { params, shapes, colors, lex };
}

function randomParams(rng) {
  const p = {};
  for (const [k, vals] of Object.entries(PARAM_SPACE)) p[k] = rng.pick(vals);
  return p;
}

function randomScene(rng, lang) {
  const layout = rng.pick(['single', 'mixed', 'vert', 'horiz']);
  const g = () => ({ shape: rng.pick(lang.shapes), color: rng.pick(lang.colors), n: rng.range(1, 6), small: rng.chance(0.3) });
  const groups = layout === 'single' ? [g()] : [g(), g()];
  if (groups.length === 2 && groups[0].shape === groups[1].shape && groups[0].color === groups[1].color) groups[1].shape = lang.shapes.find((s) => s !== groups[0].shape);
  return { layout, groups };
}

test('every parameter combination can be rendered and the learner keeps the truth', () => {
  const rng = new RNG('combos');
  for (let t = 0; t < 250; t++) {
    const lang = makeLang(randomParams(rng));
    let H = initialHypotheses();
    for (let j = 0; j < 12; j++) {
      const scene = randomScene(rng, lang);
      const sents = trueSentences(lang, scene);
      assert.ok(sents.length >= 1);
      H = observe(H, scene, rng.pick(sents));
      assert.ok(H.length > 0, 'true grammar survives');
      assert.ok(H.some((h) => Object.entries(h.params).every(([k, v]) => lang.params[k] === v)), 'a surviving hypothesis agrees with the truth');
    }
  }
});

test('word order is undetermined until a minimal pair appears', () => {
  const lang = makeLang({ na: 'NA', qpos: 0, one: false, plural: 'suffix', nums: 'simple', agr: 'none', harm: false, dim: 'after', conj: 'medial', rel: 'FRG' });
  const s = (shape, color) => ({ layout: 'single', groups: [{ shape, color, n: 1 }] });
  let H = initialHypotheses();
  H = observe(H, s('circle', 'red'), trueSentences(lang, s('circle', 'red'))[0]);
  H = observe(H, s('square', 'blue'), trueSentences(lang, s('square', 'blue'))[0]);
  assert.equal(predictCompose(H, s('circle', 'blue')).determined, false);
  H = observe(H, s('circle', 'yellow'), trueSentences(lang, s('circle', 'yellow'))[0]);
  const p = predictCompose(H, s('circle', 'blue'));
  assert.equal(p.determined, true);
  assert.deepEqual(p.answers, trueSentences(lang, s('circle', 'blue')).map(formatMorphs));
});

test('an unseen word can be read by elimination', () => {
  const lang = makeLang({ na: 'AN', qpos: 0, one: false, plural: 'suffix', nums: 'simple', agr: 'none', harm: false, dim: 'after', conj: 'medial', rel: 'FRG' });
  const s = (shape, color) => ({ layout: 'single', groups: [{ shape, color, n: 1 }] });
  let H = initialHypotheses();
  for (const [sh, c] of [['circle', 'red'], ['circle', 'blue'], ['square', 'red']]) H = observe(H, s(sh, c), trueSentences(lang, s(sh, c))[0]);
  const target = s('square', 'yellow');
  const options = [s('square', 'red'), target, s('circle', 'yellow'), s('square', 'blue')];
  assert.equal(checkRead(H, trueSentences(lang, target)[0], options, 1), true);
});

test('shape and colour lists are consistent', () => {
  assert.equal(SHAPES.length, 8);
  assert.equal(COLORS.length, 5);
});
