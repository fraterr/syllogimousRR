# Syllogimous RR

A relational reasoning trainer: read the premises, decide whether the conclusion follows.
Static web app (HTML, CSS, JavaScript modules), no build step, no tracking, all data stays in the browser.

Based on [Syllogimous v3](https://github.com/4skinskywalker/Syllogimous-v3) by 4skinskywalker (CC BY-NC 3.0).
This version is a rewrite and is not endorsed by the original author. Non-commercial use only.

## Question types

Distinction (same / opposite), Comparison (more / less), Time (before / after), Syllogisms,
Space 2D, Space 3D, Space-time, Analogy, Binary logic (with nesting) and Sorting (discover a hidden rule).
Optional challenges: negation, meta-relations, Stroop interference, premises shown one at a time,
shuffled answer buttons, nonsense syllables or real nouns, premise order (in order, 50% or 80%
scrambled, scrambled) and hiding the premises once the conclusion is shown (no rereading).

## Languages

English by default. German, French, Italian, Spanish and Russian can be chosen in
Settings → Display & language. Questions are generated as language-independent structures and
rendered in the chosen language, so the history is shown in the current language too.

## What changed compared with Syllogimous v3

Bugs fixed:

- Premises were never shuffled: `wcst.js` redefined `shuffle` with a non-mutating version, so the
  questions always listed premises in chain order. There is now one Fisher–Yates `shuffle` that returns a new array.
- An answer could be counted several times by clicking during the feedback, and the timer could
  expire during the feedback and record the same question twice.
- Decimal or very large premise counts crashed or froze the app (`Invalid array length`, infinite loop).
  All numeric settings are now clamped integers.
- A full `localStorage` stopped the game. History now lives in IndexedDB, is compacted, and the app
  keeps working in memory if storage is refused.
- Sub-questions of Binary questions could share words, producing contradictory premises.
- Paradox easter eggs had no correct answer but were scored as if TRUE were correct (removed).
- Space-time sentences with negation had an extra "of" ("is of above…").
- In carousel mode the hidden answer buttons stayed clickable.
- The sorting test could never use 4 properties, could loop forever with identical cards, was mouse-only and unscored.
- Configuration problems produced `alert()` pop-ups after every question; they are now inline warnings.
- Google Analytics was loaded without consent; there is no tracking at all now.

Shortcuts removed: the conclusion is about a random pair of items that are not adjacent in the chain
(not always first vs last), TRUE/FALSE is a fair coin decided before phrasing, and false spatial
conclusions use any wrong direction instead of always the exact opposite.

New:

- Accessibility: zoom allowed, every control reachable by keyboard (← / → = the answer button on
  that side, Enter = next, ↑ ↓ = premises when shown one at a time), real switches, negation marked by colour **and** a wavy underline
  (optional “¬” symbol), screen-reader announcements, accessible timer, light/dark/system theme,
  four text sizes, reduced motion. Dark mode can also be switched from the header. Checked with axe-core (WCAG 2.1 AA): no violations.
- Adaptive difficulty: a 3-down/1-up staircase per category (about 80% correct); weaker categories
  appear more often; adaptive time limits based on recent response times.
- Explanations after mistakes: the ordered line, the two groups, the grid/coordinates, the syllogism
  form (with its traditional name when valid), the parts of a Binary question.
- Sessions (default 30 minutes) with a summary, and a weekly goal (default 3 sessions).
- Progress: accuracy by category with current level, accuracy per session, all charts with table views.
- Check-up: 20 fixed-difficulty questions, including types you do not usually train, without feedback,
  to measure progress beyond the trained levels.
- History with filters; CSV export; JSON backup and restore; presets (Beginner, Intermediate, Expert).
- Guide: how to build the mental map for each kind of question, with worked examples (checked by the
  tests) and two unscored practice questions per kind; a first-run hint points newcomers to it.
- Installable app (manifest + service worker): works offline, asks the browser to keep the data
  permanently, and suggests adding it to the Home Screen on iPhone/iPad, where Safari may otherwise
  erase site data after 7 days without use. A banner offers a reload when a new version is ready.
- Progress also shows training minutes per week, seconds per premise per session, and an external
  test log (scores on a test you do not train on, with the change since the first result, the
  training done in between, and a warning when retakes are less than 3 months apart).
- Phones: answer buttons pinned at the bottom during a question, the screen stays on during a
  session (optional), optional vibration on answers.
- Recommended programme (guided): starts with the relations used in relational-training studies
  (same/opposite, more/less) without a clock and with premises in order, then adds a 30-second
  limit and hidden premises, half-scrambled premises with negation and new types, premises one at a
  time, fully scrambled premises and the remaining types, in 8 stages. A stage advances after enough
  completed 30-minute sessions (3, 6, 12, 18, 21, 24, 27) and only while recent accuracy is at
  least 70%. The programme never changes the language (English by default).

## Research basis

The design follows what the literature supports, without promising IQ gains:
training improves trained and closely related skills, while far transfer to general intelligence is
not reliably shown (e.g. Melby-Lervåg et al. 2016; Sala & Gobet 2019; Simons et al. 2016).
Feedback with information (Wisniewski et al. 2020), interleaving (Brunmair & Richter 2019),
varied/adaptive difficulty (von Bastian & Eschen 2016) and short regular sessions (Lampit et al. 2014)
shaped the training features. Relational training studies (SMART) report promising but small and
methodologically weak results.

## Design

Swiss-style layout (strong rules, a large premise count, a dark conclusion block) with a calm sage/teal
palette, in light and dark themes. Fonts are self-hosted: Inter and Space Grotesk, both under the
SIL Open Font License (see `fonts/`).

## Run and test

```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # generator correctness (independent solvers), translations, programme, service worker
npm run sw                    # after changing any file: refresh the offline cache list and version
```

`tests/generators.test.mjs` re-derives every answer from the premises alone (relation propagation,
coordinates, brute-force Venn models for syllogisms) and checks it against the generator, plus
balance of TRUE/FALSE and premise shuffling. `tests/i18n.test.mjs` checks that all six languages
have the same keys and placeholders and that every kind of statement renders in every language.

## Publish on GitHub Pages

Settings → Pages → Build and deployment → Source: “Deploy from a branch”, branch `main`, folder `/ (root)`.
