import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScalarTransition, verticalChapterOffset, dampProgress, toothSelectionOffset } from '../src/scene/motion.ts';
import { FluidField } from '../src/scene/fluid.ts';

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

test('chapter specimens enter below and continue above without a large empty handoff', () => {
  for (const chapter of [1, 2, 3] as const) {
    assert.equal(verticalChapterOffset(chapter, chapter), 0);
    if (chapter > 1) assert.equal(verticalChapterOffset(chapter - 0.5, chapter), -4.2);
    if (chapter < 3) assert.equal(verticalChapterOffset(chapter + 0.5, chapter), 4.2);
    let previous = -Infinity;
    for (let progress = chapter - 0.5; progress <= chapter + 0.5; progress += 0.01) {
      const offset = verticalChapterOffset(progress, chapter);
      assert.ok(offset >= previous - 1e-9); assert.ok(Math.abs(offset) <= 4.2); previous = offset;
    }
  }
});

test('scroll damping is frame-rate independent, monotonic, and approaches the target quickly', () => {
  const whole = dampProgress(0, 1, 0.2);
  let divided = 0;
  for (let i = 0; i < 20; i++) divided = dampProgress(divided, 1, 0.01);
  assert.ok(Math.abs(whole - divided) < 1e-10);
  assert.ok(whole > 0.97 && whole < 1);
  assert.ok(dampProgress(2.6, 2, 0.05) < 2.6);
  assert.equal(dampProgress(2.00001, 2, 0.1), 2);
});

test('premolars and molars move laterally while anterior teeth move forward', () => {
  for (const quadrant of [1, 2, 3, 4]) for (let position = 1; position <= 8; position++) {
    const side = quadrant === 1 || quadrant === 4 ? -1 : 1;
    const offset = toothSelectionOffset(quadrant * 10 + position, side * 1.2, 0.25);
    if (position > 3) { assert.equal(offset.z, 0); assert.equal(Math.sign(offset.x), side); assert.ok(Math.abs(offset.x) > 0.5); }
    else { assert.equal(offset.x, 0); assert.equal(offset.z, 0.25); }
  }
});

test('fluid impulses advect and dissipate without non-finite values or edge leakage', () => {
  const field = new FluidField(24);
  field.splat(0.5, 0.5, 25, -10, 1);
  const initial = field.density.reduce((sum, value) => sum + value, 0);
  field.step(1 / 30);
  assert.ok(field.velocityX.some(value => Math.abs(value) > 0.1));
  for (let i = 0; i < 300; i++) field.step(i % 2 ? 1 / 60 : 0.2);
  assert.ok(field.density.reduce((sum, value) => sum + value, 0) < initial * 0.02);
  assert.ok(field.velocityX.every(Number.isFinite)); assert.ok(field.velocityY.every(Number.isFinite));
  assert.ok(field.density.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  for (let i = 0; i < field.size; i++) assert.equal(field.density[i], 0);
});
