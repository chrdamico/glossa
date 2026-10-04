# Glossa

Decipher a language that does not exist.

**Play:** https://chrdamico.github.io/glossa/

Every run generates a new language: its words, its word order and a handful of
strange rules (counter words, a dual, reduplication, vowel harmony, case
suffixes, counting in threes, ...). You only get tablets: a picture and the
sentence that describes it. From these you work out the grammar, chamber by
chamber, and prove it in three kinds of challenge:

- **Write** – build the sentence for a picture from the words you know.
- **Read** – pick the picture a sentence describes. It may contain a word you
  have never seen.
- **Mend** – one word is wrong. Find it.

Tap any word to gloss it. Your notes appear under that word everywhere, and
tablets without it fade out, so you can compare. Not sure? Dig up one more
tablet, at the cost of a point. A wrong answer is never a dead end: the correct
sentence is carved into your codex.

There is one shared language per day (Scholar), and free play at three
difficulties. Desktop (keyboard: type words, Space to place, Enter to carve,
1–4 to pick) and touch both work.

## Fair by construction

Each challenge is checked by an ideal learner before you see it. The learner
knows the space of possible grammars, keeps every grammar-and-lexicon
hypothesis that fits the tablets so far, and only accepts a challenge when all
surviving hypotheses agree on the answer. If they do not, the generator digs up
the evidence that settles it.

## Develop

```sh
npm test          # headless generation + solvability checks
npm run serve     # http://localhost:8123
node tools/gen.mjs some-seed polyglot   # print a generated run (spoilers)
node tools/stats.mjs 300                # evidence / challenge statistics
```

No build step, no dependencies. The site is `public/`.
