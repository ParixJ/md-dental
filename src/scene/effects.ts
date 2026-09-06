import * as THREE from 'three';
import { FluidField } from './fluid';

/** Flow-driven particles without a glass overlay or screen refraction. */
export function createFlowEffects(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const fluid = new FluidField();
  const flow = new THREE.DataTexture(fluid.pixels, fluid.size, fluid.size, THREE.RGBAFormat);
  flow.minFilter = THREE.LinearFilter; flow.magFilter = THREE.LinearFilter; flow.needsUpdate = true;
  const projected = new THREE.Vector3();
  let lastPointer: THREE.Vector2 | null = null, started: number | null = null;
  return {
    flow,
    pointer(pointer: THREE.Vector2) {
      if (Math.abs(pointer.x) > 1 || Math.abs(pointer.y) > 1) { lastPointer = null; return; }
      const uv = new THREE.Vector2(pointer.x * 0.5 + 0.5, pointer.y * 0.5 + 0.5);
      if (lastPointer) fluid.splat(uv.x, uv.y, (uv.x - lastPointer.x) * 550, (uv.y - lastPointer.y) * 550, 0.35);
      lastPointer = uv;
    },
    update(dt: number, time: number, transition: number, origin: THREE.Vector3, camera: THREE.Camera, motion: boolean, ready: boolean) {
      if (ready && started === null) started = time;
      if (!motion) return;
      const intro = started !== null ? Math.max(0, 1 - (time - started) / 2.1) : 0;
      const amount = Math.min(1, transition * 0.85 + intro * 0.8);
      if (amount > 0.015) {
        projected.copy(origin).project(camera); const a = time * 2.7;
        fluid.splat(projected.x * 0.5 + 0.5 + Math.cos(a) * 0.14, projected.y * 0.5 + 0.5 + Math.sin(a) * 0.19, -Math.sin(a) * amount * 13, Math.cos(a) * amount * 13, amount * 0.14);
      }
      fluid.step(dt); flow.needsUpdate = true;
    },
    render(camera: THREE.Camera) { renderer.render(scene, camera); },
    dispose() { flow.dispose(); },
  };
}
