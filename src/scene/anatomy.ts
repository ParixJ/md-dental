import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type ToothKind = 'Central incisor' | 'Lateral incisor' | 'Canine' | 'First premolar' | 'Second premolar' | 'First molar' | 'Second molar' | 'Third molar';
export interface ToothInfo { id: number; name: ToothKind; arch: 'Upper' | 'Lower'; side: 'Left' | 'Right'; description: string }
const kinds: ToothKind[] = ['Central incisor', 'Lateral incisor', 'Canine', 'First premolar', 'Second premolar', 'First molar', 'Second molar', 'Third molar'];
const descriptions = ['A fine cutting edge, shaped for the first bite.', 'A smaller cutting surface beside the central incisor.', 'A pointed crown that helps grip and tear food.', 'Two principal cusps bridge the transition from tearing to grinding.', 'A broad surface that helps crush and grind food.', 'A multi-cusped chewing surface toward the back of the arch.', 'A broad chewing surface that works alongside the first molar.', 'The final tooth in the adult arch, also known as a wisdom tooth.'];

export const dentition: ToothInfo[] = [1, 2, 3, 4].flatMap(q => kinds.map((name, i) => ({
  id: q * 10 + i + 1, name, arch: q < 3 ? 'Upper' as const : 'Lower' as const,
  side: q === 1 || q === 4 ? 'Right' as const : 'Left' as const, description: descriptions[i],
})));

export function makeSurface(uSteps: number, vSteps: number, fn: (u: number, v: number) => THREE.Vector3) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let i = 0; i <= uSteps; i++) for (let j = 0; j <= vSteps; j++) {
    const p = fn(i / uSteps, j / vSteps); positions.push(p.x, p.y, p.z); uvs.push(i / uSteps, j / vSteps);
    if (i < uSteps && j < vSteps) { const a = i * (vSteps + 1) + j, b = a + vSteps + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

function boneMaterial(color = '#a2b0aa') {
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.46, metalness: 0.09, clearcoat: 0.3, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
  mat.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBonePosition;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBonePosition = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBonePosition;').replace('#include <color_fragment>', `#include <color_fragment>
      float grain = sin(vBonePosition.x*143.0+sin(vBonePosition.z*71.0))*sin(vBonePosition.y*127.0+sin(vBonePosition.x*63.0));
      diffuseColor.rgb *= 0.97 + grain * 0.045;`);
  };
  return mat;
}

export const materials = {
  bone: boneMaterial(),
  enamel: new THREE.MeshPhysicalMaterial({ color: '#f1eee0', roughness: 0.24, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.19, side: THREE.DoubleSide }),
  root: new THREE.MeshStandardMaterial({ color: '#c8c9b5', roughness: 0.54 }),
  socket: new THREE.MeshStandardMaterial({ color: '#6d7c73', roughness: 0.92 }),
  chrome: new THREE.MeshPhysicalMaterial({ color: '#d4dedb', roughness: 0.18, metalness: 1, clearcoat: 0.8 }),
  grip: new THREE.MeshStandardMaterial({ color: '#acbbb5', roughness: 0.44, metalness: 0.85 }),
  nerve: new THREE.MeshStandardMaterial({ color: '#d0a662', emissive: '#8b5415', emissiveIntensity: 0.28, roughness: 0.5 }),
  dermis: new THREE.MeshStandardMaterial({ color: '#ad7770', roughness: 0.65, side: THREE.DoubleSide }),
};

function ellipsoid(scale: [number, number, number], position: [number, number, number], material: THREE.Material, parent: THREE.Object3D) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), material); m.scale.set(...scale); m.position.set(...position); parent.add(m); return m;
}

export function tube(points: number[][], radius: number, material: THREE.Material, segments = 36) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number])));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), material);
}

export function crownGeometry(index: number) {
  const molar = index >= 5, premolar = index >= 3 && index < 5, canine = index === 2;
  const width = [0.235, 0.19, 0.215, 0.225, 0.245, 0.29, 0.275, 0.255][index];
  const depth = molar ? 0.29 : premolar ? 0.255 : canine ? 0.21 : 0.16;
  const height = molar ? 0.44 : premolar ? 0.5 : canine ? 0.67 : 0.59;
  return makeSurface(32, 28, (u, v) => {
    const a = -u * Math.PI * 2;
    const roundedSquare = (n: number) => Math.sign(n) * Math.pow(Math.abs(n), molar || premolar ? 0.63 : 0.7);
    const bulge = v < 0.2 ? 0.64 + v * 1.8 : v > 0.72 ? Math.cos((v - 0.72) / 0.28 * Math.PI / 2) : 1;
    const cusp = molar ? Math.cos(a * 4) * 0.052 : premolar ? Math.cos(a * 2) * 0.042 : 0;
    const y = (canine ? v : Math.min(v / 0.8, 1)) * height + Math.pow(v, 4) * cusp * bulge - (molar || premolar ? Math.max(0, v - 0.8) * 0.2 : 0);
    return new THREE.Vector3(roundedSquare(Math.cos(a)) * width * bulge, y, roundedSquare(Math.sin(a)) * depth * bulge);
  });
}

function makeTooth(index: number, info: ToothInfo) {
  const group = new THREE.Group(); group.name = `tooth-${info.id}`; group.userData.tooth = info;
  const crown = new THREE.Mesh(crownGeometry(index), materials.enamel.clone()); crown.name = 'crown'; crown.userData.tooth = info; group.add(crown);
  const rootCount = index >= 5 ? (info.arch === 'Upper' ? 3 : 2) : 1;
  for (let r = 0; r < rootCount; r++) {
    const a = r / rootCount * Math.PI * 2;
    const x = rootCount > 1 ? Math.cos(a) * 0.12 : 0, z = rootCount > 1 ? Math.sin(a) * 0.12 : 0;
    const geo = makeSurface(14, 12, (u, v) => {
      const ang = u * Math.PI * 2, rad = (index >= 5 ? 0.095 : 0.115) * (1 - v) + 0.004;
      return new THREE.Vector3(x + Math.cos(ang) * rad + x * v * 0.6, -v * (index === 2 ? 0.87 : 0.65), z + Math.sin(ang) * rad + 0.08 * v * v);
    }); const root = new THREE.Mesh(geo, materials.root); root.name = 'root'; group.add(root);
  }
  return group;
}

function archBone(upper = false) {
  return makeSurface(100, 28, (u, v) => {
    const a = (u - 0.5) * Math.PI * 1.03, p = v * Math.PI * 2;
    const front = Math.cos(a), centerY = upper ? 0.15 : -0.45 + 0.19 * (1 - front);
    const height = upper ? 0.26 : 0.44 - 0.08 * (1 - front);
    const radius = 0.205 + (upper ? 0.01 : 0.065) * front;
    return new THREE.Vector3(Math.sin(a) * (1.45 + Math.cos(p) * radius), centerY + Math.sin(p) * height, front * (2.1 + Math.cos(p) * radius) - 0.74);
  });
}

function ramus(side: number) {
  const s = new THREE.Shape();
  s.moveTo(-0.92, -0.44); s.bezierCurveTo(-1.38, -0.45, -1.53, -0.18, -1.51, 0.2);
  s.lineTo(-1.43, 1.33); s.bezierCurveTo(-1.54, 1.76, -1.28, 1.89, -1.15, 1.58);
  s.bezierCurveTo(-1.08, 1.24, -0.92, 1.15, -0.75, 1.47);
  s.bezierCurveTo(-0.58, 1.82, -0.47, 1.67, -0.57, 1.31);
  s.lineTo(-0.52, 0.58); s.bezierCurveTo(-0.46, 0.1, -0.15, -0.23, 0.16, -0.35); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.21, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.13, bevelSegments: 5, steps: 1, curveSegments: 22 });
  g.rotateY(-Math.PI / 2); g.translate(side * 1.44 + 0.1, 0, -0.5);
  const m = new THREE.Mesh(g, materials.bone); m.name = 'ascending-ramus'; return m;
}

export function createJaw(empty = false) {
  const group = new THREE.Group(), lower = new THREE.Group(), upper = new THREE.Group(), teeth: THREE.Group[] = [];
  group.name = 'dentition'; lower.name = 'mandible'; upper.name = 'maxilla';
  const hinge = new THREE.Group(); hinge.position.set(0, 1.25, -1.98); lower.position.copy(hinge.position).multiplyScalar(-1); hinge.add(lower); group.add(hinge, upper);
  upper.position.y = 1.03;
  if (empty) return { group, lower, upper, hinge, teeth };
  lower.add(new THREE.Mesh(archBone(), materials.bone), ramus(-1), ramus(1));
  upper.add(new THREE.Mesh(archBone(true), materials.bone));
  for (const upperArch of [false, true]) {
    const parent = upperArch ? upper : lower;
    for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
      const a = side * (0.091 + i * 0.198), q = upperArch ? (side === -1 ? 1 : 2) : (side === -1 ? 4 : 3);
      const info = dentition.find(t => t.id === q * 10 + i + 1)!;
      const t = makeTooth(i, info); t.position.set(Math.sin(a) * 1.46, upperArch ? -0.04 : -0.015, Math.cos(a) * 2.1 - 0.74);
      t.rotation.y = a; if (upperArch) t.rotation.z = Math.PI;
      t.userData.home = t.position.clone(); teeth.push(t); parent.add(t);
      const socket = new THREE.Mesh(new THREE.TorusGeometry(i >= 5 ? 0.19 : 0.135, 0.045, 8, 22), materials.bone);
      socket.rotation.x = Math.PI / 2; socket.position.copy(t.position); socket.position.y = upperArch ? -0.09 : -0.065; parent.add(socket);
      const socketInner = new THREE.Mesh(new THREE.CircleGeometry(i >= 5 ? 0.15 : 0.1, 18), materials.socket);
      socketInner.rotation.x = upperArch ? Math.PI / 2 : -Math.PI / 2; socketInner.position.copy(socket.position); socketInner.position.y += upperArch ? -0.002 : 0.002; parent.add(socketInner);
    }
  }
  return { group, lower, upper, hinge, teeth };
}

export function createInstruments() {
  const group = new THREE.Group(); group.name = 'instruments';
  const instruments: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group(); g.name = ['Mouth mirror', 'Dental explorer', 'College tweezers'][i]; g.userData.instrument = i;
    if (i < 2) {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 2.65, 24), materials.chrome); g.add(handle);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.091, 0.091, 0.95, 24), materials.grip); grip.position.y = 0.15; g.add(grip);
      for (let j = 0; j < 24; j++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.091, 0.006, 4, 18), materials.chrome); ring.rotation.x = Math.PI / 2; ring.position.y = -0.32 + j * 0.04; g.add(ring);
      }
      const end = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.082, 0.28, 18), materials.chrome); end.position.y = 1.45; g.add(end);
    }
    if (i === 0) {
      g.add(tube([[0, 1.58, 0], [0, 1.83, 0], [0, 2.07, 0.19]], 0.038, materials.chrome));
      const mirror = new THREE.Group(); mirror.position.set(0, 2.22, 0.25); mirror.rotation.x = -0.42;
      const backing = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.045, 56), materials.chrome); backing.rotation.x = Math.PI / 2; mirror.add(backing);
      const surface = new THREE.Mesh(new THREE.CircleGeometry(0.305, 56), new THREE.MeshPhysicalMaterial({ color: '#d8e4df', metalness: 1, roughness: 0.035 })); surface.position.z = 0.026; mirror.add(surface);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.325, 0.022, 10, 56), materials.chrome); mirror.add(rim); g.add(mirror);
    } else if (i === 1) {
      g.add(tube([[0, 1.58, 0], [0.08, 1.81, 0], [0.32, 1.91, 0], [0.4, 1.7, 0], [0.25, 1.55, 0]], 0.025, materials.chrome));
      g.add(tube([[0, -1.32, 0], [-0.06, -1.54, 0], [-0.26, -1.72, 0], [-0.3, -1.89, 0]], 0.027, materials.chrome));
    } else {
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new RoundedBoxGeometry(0.11, 3.0, 0.07, 3, 0.035), materials.chrome); arm.rotation.z = side * 0.075; arm.position.x = side * 0.12; g.add(arm);
        g.add(tube([[side * 0.24, -1.48, 0], [side * 0.24, -1.75, 0], [side * 0.04, -1.94, 0.06]], 0.039, materials.chrome));
        for (let j = 0; j < 15; j++) {
          const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.117, 0.012, 0.084), materials.grip); ridge.position.set(side * (0.12 + j * 0.003), 0.1 - j * 0.055, 0); ridge.rotation.z = side * 0.075; g.add(ridge);
        }
      }
      ellipsoid([0.12, 0.1, 0.05], [0, 1.48, 0], materials.chrome, g);
    }
    g.position.set((i - 1) * 1.2, i === 0 ? 0 : i === 1 ? 0.15 : 0.3, (i - 1) * 0.18); g.rotation.z = [-0.38, -0.1, 0.2][i];
    g.userData.home = g.position.clone(); instruments.push(g); group.add(g);
  }
  return { group, instruments };
}

export function createSkull() {
  const group = new THREE.Group();
  const skull = makeSurface(100, 90, (u, v) => {
    const a = u * Math.PI * 2, p = v * Math.PI;
    let x = Math.sin(p) * Math.cos(a) * 1.12, y = Math.cos(p) * 1.52 + 0.48, z = Math.sin(p) * Math.sin(a) * 0.98 - 0.17;
    if (z > 0 && y < 1 && y > -0.75) {
      const eye = Math.exp(-((Math.abs(x) - 0.49) ** 2 / 0.067 + (y - 0.5) ** 2 / 0.064));
      const nose = Math.exp(-(x * x / 0.024 + (y + 0.04) ** 2 / 0.11));
      z -= eye * 0.66 + nose * 0.45;
      z += Math.exp(-((Math.abs(x) - 0.8) ** 2 / 0.08 + (y + 0.05) ** 2 / 0.025)) * 0.17;
    }
    if (y < -0.6) { x *= 0.8; z *= 0.8; }
    return new THREE.Vector3(x, y, z);
  });
  group.add(new THREE.Mesh(skull, boneMaterial('#d9d2b8')));
  // Dark recessed orbital and nasal cavities remain behind the bone surface.
  const cavityMat = new THREE.MeshStandardMaterial({ color: '#3d4237', roughness: 1 });
  for (const side of [-1, 1]) {
    ellipsoid([0.33, 0.28, 0.15], [side * 0.47, 0.48, 0.43], cavityMat, group);
    const orbital = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.063, 12, 40), materials.bone); orbital.scale.set(1.15, 0.87, 0.75); orbital.position.set(side * 0.49, 0.52, 0.76); group.add(orbital);
  }
  ellipsoid([0.115, 0.23, 0.09], [0, -0.04, 0.61], cavityMat, group);
  const jaw = createJaw(); jaw.group.scale.setScalar(0.56); jaw.group.position.set(0, -0.81, 0.03); jaw.hinge.rotation.x = 0; group.add(jaw.group);
  return group;
}

export function createNerves() {
  const group = new THREE.Group(); group.name = 'nerves';
  const paths = [
    [[1.01, 0.05, 0.13], [0.85, 0.3, 0.73], [0.77, 0.85, 0.76], [0.58, 1.3, 0.71], [0.37, 1.65, 0.49]],
    [[1.01, 0.05, 0.13], [0.85, 0.3, 0.73], [0.38, 0.91, 0.81], [0.23, 1.36, 0.75]],
    [[1.01, 0.05, 0.13], [0.84, 0.07, 0.78], [0.49, 0.03, 0.91], [0.2, -0.14, 1.01]],
    [[1.01, 0.05, 0.13], [0.85, -0.19, 0.68], [0.48, -0.38, 0.85], [0.14, -0.42, 0.94]],
    [[1.01, 0.05, 0.13], [0.83, -0.34, 0.52], [0.6, -0.72, 0.69], [0.25, -0.96, 0.71]],
    [[1.01, 0.05, 0.13], [1.03, -0.6, 0.1], [0.9, -1.0, 0.28], [0.43, -1.17, 0.59]],
  ];
  paths.forEach((path, i) => {
    group.add(tube(path, 0.018, materials.nerve, 40));
    for (let j = 1; j < path.length - 1; j++) {
      const p = path[j], next = path[j + 1];
      group.add(tube([p, [(p[0] + next[0]) / 2 + 0.12, (p[1] + next[1]) / 2 + 0.09, p[2] + 0.035], [next[0] + 0.13, next[1] + (i < 2 ? 0.16 : -0.12), next[2] - 0.025]], 0.008, materials.nerve, 18));
    }
  });
  return group;
}

export function disposeObject(group: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>();
  group.traverse(obj => { if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
    geometries.add(obj.geometry); (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => mats.add(m));
  } });
  geometries.forEach(g => g.dispose()); mats.forEach(m => m.dispose());
}
