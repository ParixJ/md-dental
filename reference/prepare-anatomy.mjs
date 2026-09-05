import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const toothIds = [55681,55680,55798,55689,55688,55698,55697,55682,55683,55799,55690,55691,55699,55700,57143,57141,55687,55693,55692,55704,55703,57142,57140,55686,55694,55695,55705,55706];
const boneIds = [52748,53649,53650,52734,52735,52736,52738,52739,52788,52789,52892,52893,53647,53648];
const manifest = []; const chunks = []; let offset = 0;
for (const id of [...boneIds, ...toothIds]) {
  const buffer = await readFile(`reference/anatomy/FMA${id}.stl`);
  const original = new STLLoader().parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  original.deleteAttribute('normal');
  const geo = mergeVertices(original, 0.11); original.dispose();
  geo.computeBoundingBox(); const bounds = geo.boundingBox; const size = bounds.getSize(new THREE.Vector3());
  const positions = geo.getAttribute('position'), quantized = new Uint16Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) for (let k = 0; k < 3; k++) quantized[i * 3 + k] = Math.round((positions.array[i * 3 + k] - bounds.min.getComponent(k)) / size.getComponent(k) * 65535);
  const indices = new Uint16Array(geo.index.array); if (positions.count > 65535) throw new Error(`Index overflow: ${id}`);
  const meta = { id, offset, vertices: positions.count, indices: indices.length, min: bounds.min.toArray(), size: size.toArray(), tooth: toothIds.includes(id) ? (Math.floor(toothIds.indexOf(id) / 7) + 1) * 10 + toothIds.indexOf(id) % 7 + 1 : null };
  manifest.push(meta); chunks.push(Buffer.from(quantized.buffer), Buffer.from(indices.buffer)); offset += quantized.byteLength + indices.byteLength;
  geo.dispose();
}
await writeFile('public/anatomy.bin', Buffer.concat(chunks));
await writeFile('src/scene/anatomy-manifest.json', JSON.stringify(manifest));
console.log(`Prepared ${manifest.length} anatomical meshes, ${(offset / 1024).toFixed(0)} KB total, ${manifest.reduce((n, m) => n + m.indices / 3, 0)} triangles.`);
