import { generateRun, answerTablet } from '../public/js/curriculum.js';
const N = +process.argv[2] || 200;
const abs = (ms) => ms.map((m) => (m.suf ? '-' : '') + m.k.split(/[:.|]/)[0]).join(' ');
for (const d of ['novice', 'scholar', 'polyglot']) {
  let compose = 0, novel = 0, freshWords = 0, reads = 0, readsUnknown = 0, total = 0, len = 0;
  for (let i = 0; i < N; i++) {
    const run = generateRun('nv' + i, d);
    const seen = new Set();
    const words = new Set();
    for (const ch of run.chambers) {
      for (const e of ch.evidence) { seen.add(abs(e.morphs)); e.morphs.forEach((m) => words.add(m.s)); }
      for (const c of ch.challenges) {
        total++;
        if (c.type === 'compose') {
          compose++;
          len += c.solution.length;
          if (!seen.has(abs(c.solution))) novel++;
        }
        if (c.type === 'read') { reads++; if (c.morphs.some((m) => !words.has(m.s))) readsUnknown++; }
        const a = answerTablet(c);
        seen.add(abs(a.morphs));
        a.morphs.forEach((m) => words.add(m.s));
      }
    }
  }
  console.log(`${d}: challenges/run ${(total / N).toFixed(1)}; compose with a sentence shape never seen before: ${(100 * novel / compose).toFixed(0)}%; avg compose length ${(len / compose).toFixed(1)}; reads with an unseen word: ${(100 * readsUnknown / reads).toFixed(0)}%`);
}
