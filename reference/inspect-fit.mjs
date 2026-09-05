import fs from 'node:fs';

const glb = fs.readFileSync('public/face.glb');
const jsonLength = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength));
const accessor = gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
const view = gltf.bufferViews[accessor.bufferView];
const start = 28 + jsonLength + (view.byteOffset || 0) + (accessor.byteOffset || 0);
const face = Array.from({ length: accessor.count }, (_, i) => Array.from({ length: 3 }, (_, k) => (glb.readFloatLE(start + i * (view.byteStride || 12) + k * 4) - (accessor.min[k] + accessor.max[k]) / 2) * [0.49, 0.55, 0.48][k] + [0, 0.06, 0.02][k]));
const manifest = JSON.parse(fs.readFileSync('src/scene/anatomy-manifest.json', 'utf8'));
const binary = fs.readFileSync('public/anatomy.bin');
const skull = manifest.flatMap(meta => Array.from({ length: meta.vertices }, (_, i) => {
  const [x, y, z] = [0, 1, 2].map(k => meta.min[k] + binary.readUInt16LE(meta.offset + (i * 3 + k) * 2) / 65535 * meta.size[k]);
  return [x * 0.016, (z - 1480) * 0.013, (-y - 147) * 0.0155 + 0.33];
}));
const fittedSkull = skull.map(([x, y, z]) => [x * 0.69, y * 0.93 + 0.28, z * 0.62 + 0.32]);
for (let y = -0.6; y < 2.4; y += 0.3) {
  const bounds = points => {
    const slice = points.filter(p => p[1] >= y && p[1] < y + 0.3);
    if (!slice.length) return null;
    return [Math.max(...slice.map(p => Math.abs(p[0]))), Math.min(...slice.map(p => p[2])), Math.max(...slice.map(p => p[2]))].map(n => +n.toFixed(3));
  };
  console.log(y.toFixed(1), { face: bounds(face), originalSkull: bounds(skull), fittedSkull: bounds(fittedSkull) });
}
