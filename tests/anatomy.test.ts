import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createJaw, crownGeometry, dentition, createInstruments, disposeObject } from '../src/scene/anatomy.ts';

test('adult dentition has 32 distinct FDI identifiers and 16 teeth in each arch', () => {
  assert.equal(dentition.length, 32);
  assert.equal(new Set(dentition.map(t => t.id)).size, 32);
  for (const arch of ['Upper', 'Lower']) assert.equal(dentition.filter(t => t.arch === arch).length, 16);
  for (const quadrant of [1, 2, 3, 4]) assert.deepEqual(dentition.filter(t => Math.floor(t.id / 10) === quadrant).map(t => t.id % 10), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('the jaw has independently addressable teeth, an upper arch, and a hinged mandible', () => {
  const jaw = createJaw(); assert.equal(jaw.teeth.length, 32);
  assert.equal(jaw.lower.parent, jaw.hinge); assert.equal(jaw.upper.parent, jaw.group);
  assert.equal(jaw.teeth.filter(t => t.parent === jaw.upper).length, 16);
  assert.equal(jaw.teeth.filter(t => t.parent === jaw.lower).length, 16);
  for (const tooth of jaw.teeth) { assert.ok(tooth.getObjectByName('crown')); assert.ok(tooth.userData.home); }
  disposeObject(jaw.group);
});

test('all tooth types produce finite geometry and non-degenerate bounds', () => {
  for (let i = 0; i < 8; i++) {
    const geo = crownGeometry(i); const p = geo.getAttribute('position');
    assert.ok(p.count > 500); assert.ok(Array.from(p.array).every(Number.isFinite));
    geo.computeBoundingBox(); const bounds = geo.boundingBox!;
    assert.ok(bounds.max.x - bounds.min.x > 0.2); assert.ok(bounds.max.y - bounds.min.y > 0.35); geo.dispose();
  }
});

test('each instrument can be independently selected', () => {
  const { group, instruments } = createInstruments();
  assert.deepEqual(instruments.map(t => t.name), ['Mouth mirror', 'Dental explorer', 'College tweezers']);
  assert.deepEqual(instruments.map(t => t.userData.instrument), [0, 1, 2]); disposeObject(group);
});

test('production scan bundle contains complete, correctly indexed anatomy data', () => {
  const manifest = JSON.parse(readFileSync(new URL('../src/scene/anatomy-manifest.json', import.meta.url), 'utf8'));
  const asset = readFileSync(new URL('../public/anatomy.bin', import.meta.url));
  assert.equal(manifest.filter((m: { tooth: number | null }) => m.tooth !== null).length, 28);
  assert.equal(manifest.filter((m: { tooth: number | null }) => m.tooth === null).length, 14);
  let end = 0;
  for (const item of manifest) {
    assert.equal(item.offset, end);
    assert.ok(item.vertices > 0 && item.indices > 0);
    const start = item.offset + item.vertices * 6;
    for (let i = 0; i < item.indices; i++) assert.ok(asset.readUInt16LE(start + i * 2) < item.vertices);
    end = start + item.indices * 2;
  }
  assert.equal(asset.byteLength, end);
});
