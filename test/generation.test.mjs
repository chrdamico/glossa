import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRun, answerTablet } from '../public/js/curriculum.js';
import { trueSentences, formatMorphs, sceneKey } from '../public/js/lang.js';
import { initialHypotheses, observe, predictCompose, checkRead, checkSpot } from '../public/js/learner.js';

const DIFFS = ['novice', 'scholar', 'polyglot'];
const N = Number(process.env.SEEDS || 40);

function verifyRun(run) {
  const { lang } = run;
  let H = initialHypotheses();
  const seenScenes = new Set();
  for (const ch of run.chambers) {
    for (const e of ch.evidence) {
      const valid = trueSentences(lang, e.scene).map(formatMorphs);
      assert.ok(valid.includes(formatMorphs(e.morphs)), 'evidence sentence is valid');
      H = observe(H, e.scene, e.morphs);
      assert.ok(H.length > 0);
    }
    for (const c of ch.challenges) {
      if (c.type === 'compose') {
        const valid = trueSentences(lang, c.scene).map(formatMorphs);
        assert.deepEqual([...c.solutions].sort(), [...valid].sort());
        const p = predictCompose(H, c.scene);
        assert.ok(p.determined, 'compose determined');
        assert.deepEqual([...p.answers].sort(), [...valid].sort(), 'learner predicts the true answer');
      } else if (c.type === 'read') {
        const matches = c.options.filter((o) => trueSentences(lang, o).map(formatMorphs).includes(formatMorphs(c.morphs)));
        assert.equal(matches.length, 1, 'exactly one option fits in the true language');
        assert.equal(sceneKey(matches[0]), sceneKey(c.options[c.answer]));
        assert.ok(checkRead(H, c.morphs, c.options, c.answer), 'read determined');
      } else {
        const valid = trueSentences(lang, c.scene).map(formatMorphs);
        assert.ok(!valid.includes(formatMorphs(c.morphs)), 'spot sentence is wrong');
        assert.ok(valid.includes(formatMorphs(c.solution)));
        const diff = c.solution.map((m, i) => (m.s !== c.morphs[i].s ? i : -1)).filter((i) => i >= 0);
        assert.deepEqual(diff, [c.wrong]);
        assert.ok(checkSpot(H, c.scene, c.morphs, c.wrong), 'spot determined');
      }
      const a = answerTablet(c);
      H = observe(H, a.scene, a.morphs);
      assert.ok(H.length > 0);
    }
  }
}

for (const d of DIFFS) {
  test(`runs generate and verify (${d})`, () => {
    for (let i = 0; i < N; i++) {
      const run = generateRun('seed' + i, d);
      verifyRun(run);
      assert.equal(run.chambers.length, 8);
    }
  });
}

test('generation is deterministic', () => {
  const a = generateRun('same', 'scholar');
  const b = generateRun('same', 'scholar');
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
