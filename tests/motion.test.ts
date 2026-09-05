import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScalarTransition, verticalChapterOffset } from '../src/scene/motion.ts';

test('explosion eases through intermediate positions and reaches its endpoint at any frame rate', () => {
  for (const step of [16, 33, 125, 400]) {
    const transition = new ScalarTransition(0);
    transition.setTarget(1, 1000);
    assert.equal(transition.sample(1000), 0);
    assert.equal(transition.sample(1750), 0.5);
    let previous = 0;
    for (let now = 1000; now < 2500; now += step) {
      const value = transition.sample(now);
      assert.ok(value >= previous && value < 1); previous = value;
    }
    assert.equal(transition.sample(2500), 1);
    assert.equal(transition.active(2500), false);
    assert.ok(transition.sample(1016) < 0.001);
    assert.ok(transition.sample(2484) > 0.999);
  }
});

test('reversing an explosion preserves its current position and reduced motion settles immediately', () => {
  const transition = new ScalarTransition(0);
  transition.setTarget(1, 0);
  const midway = transition.sample(650);
  transition.setTarget(0, 650);
  assert.equal(transition.sample(650), midway);
  assert.ok(transition.sample(1000) < midway);
  assert.equal(transition.sample(2150), 0);
  transition.setTarget(1, 2200, true);
  assert.equal(transition.sample(2200), 1);
  assert.equal(transition.active(2200), false);
});

test('chapter specimens enter above and continue below without reversing vertical direction', () => {
  for (const chapter of [1, 2, 3] as const) {
    assert.equal(verticalChapterOffset(chapter, chapter), 0);
    if (chapter > 1) assert.equal(verticalChapterOffset(chapter - 0.5, chapter), 12);
    if (chapter < 3) assert.equal(verticalChapterOffset(chapter + 0.5, chapter), -12);
    let previous = Infinity;
    for (let progress = chapter - 0.5; progress <= chapter + 0.5; progress += 0.01) {
      const offset = verticalChapterOffset(progress, chapter);
      assert.ok(offset <= previous + 1e-9); previous = offset;
    }
  }
});
