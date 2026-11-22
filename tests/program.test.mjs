// Guided programme: stage settings and advancement rules.
import assert from 'node:assert/strict';
import { stageSettings, nextStage, STAGES, MIN_SESSION_MS } from '../js/program.js';
import { sanitizeSettings } from '../js/storage.js';

const display = { lang: 'ru', theme: 'dark', textSize: 'l', reduceMotion: true, negSymbol: true };

// Stage 1: the core relations only, no clock, no extra load
const s1 = stageSettings(1, display);
assert.deepEqual(s1.enabled, ['distinction', 'comparison']);
assert.equal(s1.timerMode, 'off'); assert.equal(s1.negation, false); assert.equal(s1.oneAtATime, false);
assert.equal(s1.words, 'nonsense'); assert.equal(s1.adaptive, true); assert.equal(s1.explainAlways, true);
assert.equal(s1.sessionMinutes, 30); assert.equal(s1.weeklyGoal, 3); assert.equal(s1.program, true);
// display choices are kept, and the result survives sanitising
for (const k of Object.keys(display)) assert.equal(s1[k], display[k]);
assert.deepEqual(sanitizeSettings(s1), s1);

// Each stage only adds; the last one has everything except sorting
let prev = s1.enabled;
for (let n = 2; n <= STAGES.length; n++) {
    const s = stageSettings(n, display);
    assert.ok(prev.every(t => s.enabled.includes(t)), `stage ${n} removed a type`);
    prev = s.enabled;
}
const last = stageSettings(STAGES.length, display);
assert.deepEqual([...last.enabled].sort(), ['analogy', 'binary', 'comparison', 'direction', 'direction3D', 'direction4D', 'distinction', 'syllogism', 'temporal']);
assert.equal(last.meta, true); assert.equal(last.timerMode, 'adaptive'); assert.equal(last.stroop, false);
assert.equal(stageSettings(2, display).timers.temporal, 30);

// Advancement: needs completed sessions AND accuracy >= 70% on recent answers
const since = 1000;
const sessions = (n, active = MIN_SESSION_MS) => Array.from({ length: n }, (_, i) => ({ start: since + i, active }));
const answers = (n, acc) => Array.from({ length: n }, (_, i) => ({ t: since + i, correct: i < Math.round(n * acc), bench: false }));
assert.equal(nextStage(1, sessions(2), answers(40, 0.9), since), 1, 'too few sessions');
assert.equal(nextStage(1, sessions(3), answers(40, 0.9), since), 2, 'should advance');
assert.equal(nextStage(1, sessions(3), answers(40, 0.6), since), 1, 'accuracy gate');
assert.equal(nextStage(1, sessions(3), answers(10, 1), since), 1, 'too few answers');
assert.equal(nextStage(1, sessions(3, MIN_SESSION_MS - 1), answers(40, 0.9), since), 1, 'short sessions do not count');
assert.equal(nextStage(1, sessions(30), answers(40, 0.9), since), 2, 'one stage at a time');
assert.equal(nextStage(STAGES.length, sessions(99), answers(40, 1), since), STAGES.length);
assert.equal(nextStage(1, sessions(3).map(s => ({ ...s, start: 0 })), answers(40, 0.9), since), 1, 'sessions before the start do not count');
console.log('program: stages and advancement rules OK');
