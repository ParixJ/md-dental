import * as THREE from 'three';
import manifest from './anatomy-manifest.json';
import { dentition, materials } from './anatomy';

export async function loadAnatomy(signal: AbortSignal) {
  const response = await fetch('/anatomy.bin', { signal });
  if (!response.ok) throw new Error(`Anatomy asset returned ${response.status}`);
  const data = await response.arrayBuffer();
  const expected = manifest.reduce((end, m) => Math.max(end, m.offset + m.vertices * 6 + m.indices * 2), 0);
  if (data.byteLength !== expected) throw new Error('Anatomy asset is incomplete');
  return new Map(manifest.map(meta => {
    const quantized = new Uint16Array(data, meta.offset, meta.vertices * 3), positions = new Float32Array(meta.vertices * 3);
    for (let i = 0; i < positions.length; i++) positions[i] = meta.min[i % 3] + quantized[i] / 65535 * meta.size[i % 3];
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array(data, meta.offset + meta.vertices * 6, meta.indices), 1));
    return [meta.id, { geometry: geo, tooth: meta.tooth }];
  }));
}

// BodyParts3D uses Z-up and an anterior direction along negative Y.
export function transformScan(geo: THREE.BufferGeometry, target: 'jaw' | 'face') {
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (target === 'jaw') p.setXYZ(i, x * 0.034, (z - 1470) * 0.035, (-y - 150) * 0.038);
    // Register the separate skull dataset to the face scan. The previous depth
    // extended almost twice as far behind the head; retain the anterior alignment
    // while bringing the occiput and temples inside the facial envelope.
    else p.setXYZ(i, x * 0.016 * 0.69, (z - 1480) * 0.013 * 0.93 + 0.28, ((-y - 147) * 0.0155 + 0.33) * 0.62 + 0.32);
  }
  geo.computeVertexNormals(); return geo;
}

export function clipToHalf(geometry: THREE.BufferGeometry, positive: boolean, axis = 0, boundary = 0) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const attrs = Object.entries(source.attributes); const result: Record<string, number[]> = Object.fromEntries(attrs.map(([name]) => [name, []]));
  type Vertex = Record<string, number[]>;
  const vertex = (index: number): Vertex => Object.fromEntries(attrs.map(([name, attribute]) => [name, Array.from({ length: attribute.itemSize }, (_, k) => attribute.array[index * attribute.itemSize + k])]));
  const inside = (v: Vertex) => positive ? v.position[axis] >= boundary : v.position[axis] <= boundary;
  const intersection = (a: Vertex, b: Vertex): Vertex => { const t = (a.position[axis] - boundary) / (a.position[axis] - b.position[axis]); return Object.fromEntries(attrs.map(([name]) => [name, a[name].map((value, k) => value + (b[name][k] - value) * t)])); };
  for (let i = 0; i < source.getAttribute('position').count; i += 3) {
    const triangle = [vertex(i), vertex(i + 1), vertex(i + 2)]; const polygon: Vertex[] = [];
    triangle.forEach((a, j) => { const b = triangle[(j + 1) % 3]; if (inside(a)) polygon.push(a); if (inside(a) !== inside(b)) polygon.push(intersection(a, b)); });
    for (let j = 1; j < polygon.length - 1; j++) for (const v of [polygon[0], polygon[j], polygon[j + 1]]) attrs.forEach(([name]) => result[name].push(...v[name]));
  }
  const output = new THREE.BufferGeometry(); attrs.forEach(([name, attr]) => output.setAttribute(name, new THREE.Float32BufferAttribute(result[name], attr.itemSize))); source.dispose(); return output;
}

export function makeScannedTooth(geometry: THREE.BufferGeometry, id: number) {
  const info = dentition.find(t => t.id === id)!;
  geometry.computeBoundingBox(); const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  const group = new THREE.Group(); group.name = `tooth-${id}`; group.position.copy(center);
  if (info.arch === 'Upper') group.position.y -= 0.85;
  group.userData.tooth = info; group.userData.home = group.position.clone();
  const crown = new THREE.Mesh(geometry, materials.enamel.clone()); crown.name = 'crown'; crown.userData.tooth = info; group.add(crown); return group;
}
