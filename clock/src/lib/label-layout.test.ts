import assert from 'node:assert/strict';
import { test } from 'node:test';
import { labelBox, labelFits } from './label-layout.ts';

test('labels reject collisions and clipping, including rotated circular labels', () => {
  const first = labelBox(100, 100, 80, 12, 0);
  assert.equal(labelFits(first, [], 400, 400), true);
  assert.equal(labelFits(labelBox(130, 100, 80, 12, 0), [first], 400, 400), false);
  assert.equal(labelFits(labelBox(200, 100, 80, 12, 0), [first], 400, 400), true);
  assert.equal(labelFits(labelBox(5, 100, 80, 12, 0), [], 400, 400), false);
  const rotated = labelBox(100, 100, 80, 12, Math.PI / 2);
  assert.ok(Math.abs(rotated.right - rotated.left - 16) < 0.000001);
  assert.ok(Math.abs(rotated.bottom - rotated.top - 84) < 0.000001);
  assert.equal(labelFits(rotated, [first], 400, 400), false);
});
