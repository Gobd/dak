import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVoiceGate } from './voice.ts';

test('ambient speech is ignored, wake text is stripped, and thanks closes only its call', () => {
  const gate = createVoiceGate();
  assert.equal(gate.consume('a', 'What time is lunch?').message, undefined);
  assert.equal(gate.consume('a', 'She said hey Rex yesterday').active, false);
  assert.equal(gate.consume('a', 'HEY, REX! Check the tests.').message, 'Check the tests.');
  assert.equal(gate.consume('a', 'The second one').message, 'The second one');
  assert.equal(gate.consume('b', 'The second one').active, false);
  assert.equal(gate.consume('a', 'Thanks, Rex.').active, false);
  assert.equal(gate.consume('a', 'Another conversation').message, undefined);
  assert.equal(gate.consume('a', 'Hey Rex').active, true);
  assert.equal(gate.consume('a', 'Thank you Rex').active, false);
});

test('idle deadline refreshes on accepted speech; expired speech needs a new wake phrase', () => {
  let time = 100;
  const gate = createVoiceGate(10, () => time);
  assert.equal(gate.consume('a', 'Hey Rex').expiresAt, 10100);
  time = 10099;
  assert.equal(gate.consume('a', 'yes').expiresAt, 20099);
  time = 20099;
  assert.equal(gate.consume('a', 'no').active, false);
  assert.equal(gate.consume('a', 'Hey Rex, start again').message, 'start again');
});

test('manager and playback time do not consume the idle window or resurrect a closed call', () => {
  let time = 0;
  const gate = createVoiceGate(10, () => time);
  gate.consume('a', 'Hey Rex, check tests');
  const release = gate.hold('a')!;
  time = 60000;
  assert.equal(gate.state('a').active, true);
  assert.equal(gate.state('a').expiresAt, null);
  release();
  assert.equal(gate.state('a').expiresAt, 70000);
  gate.playback('a', true);
  time = 90000;
  assert.equal(gate.state('a').active, true);
  gate.playback('a', false);
  assert.equal(gate.state('a').expiresAt, 100000);
  const lateRelease = gate.hold('a')!;
  gate.consume('a', 'Thanks Rex');
  gate.consume('a', 'Hey Rex');
  time = 95000;
  lateRelease();
  assert.equal(gate.state('a').expiresAt, 100000);
  gate.end('a');
  gate.playback('a', false);
  assert.equal(gate.state('a').active, false);
  assert.equal(gate.hold('a'), undefined);
});

test('abandoned playback expires and invalid timeout configuration fails', () => {
  let time = 0;
  const gate = createVoiceGate(5, () => time);
  gate.consume('a', 'Hey Rex');
  gate.playback('a', true);
  time = 180000;
  assert.equal(gate.state('a').active, false);
  for (const value of [0, -1, NaN, Infinity, 3601]) assert.throws(() => createVoiceGate(value));
});
