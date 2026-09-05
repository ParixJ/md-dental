import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createJaw, createInstruments, createNerves, disposeObject, materials, type ToothInfo } from './anatomy';
import { loadAnatomy, transformScan, clipToHalf, makeScannedTooth } from './scans';
import { ScalarTransition, verticalChapterOffset } from './motion';

export interface ExperienceState {
  progress: number; teeth: boolean; exploded: number; jawOpen: number;
  layers: { skin: boolean; dermis: boolean; bone: boolean; nerves: boolean };
  spread: number; instrument: number | null; selectedTooth: number | null;
  paused: boolean; reducedMotion: boolean; quality: 'auto' | 'high' | 'low'; zoom: number; reset: number;
}
export interface SceneCallbacks { ready: () => void; error: (message: string) => void; selectTooth: (info: ToothInfo) => void; selectInstrument: (index: number) => void; hover: (label: string | null) => void; faceStatus: (status: 'ready' | 'error') => void; anatomyStatus: (status: 'ready' | 'error') => void }

const clamp = THREE.MathUtils.clamp;
const smooth = (a: number, b: number, value: number) => THREE.MathUtils.smoothstep(value, a, b);

function makeGround(scene: THREE.Scene) {
  const geo = new THREE.PlaneGeometry(85, 85, 130, 130); geo.rotateX(-Math.PI / 2);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), dist = Math.sqrt(x * x + z * z);
    const n = Math.sin(x * 0.28 + z * 0.12) * Math.cos(z * 0.28) * 0.75 + Math.sin(x * 0.62 - z * 0.27) * 0.2;
    p.setY(i, -2.42 + n * smooth(3, 14, dist) + Math.sin(x * 4 + z * 2) * Math.cos(z * 3) * 0.018);
  }
  geo.computeVertexNormals();
  const floor = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#cdd4ce', roughness: 0.89, metalness: 0.08 }));
  // This landscape is a backdrop; descending specimens must pass in front of it.
  floor.renderOrder = -1; floor.material.depthWrite = false;
  floor.receiveShadow = true; scene.add(floor);
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 62); gradient.addColorStop(0, 'rgba(25, 40, 31, .27)'); gradient.addColorStop(0.35, 'rgba(35, 47, 40, .17)'); gradient.addColorStop(1, 'rgba(35, 47, 40, 0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const map = new THREE.CanvasTexture(canvas);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(8, 7), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(1.65, -2.365, 0); scene.add(shadow); return { shadow, map };
}

function makeParticles(scene: THREE.Scene) {
  const count = 900, positions = new Float32Array(count * 3), forms = new Float32Array(count * 3), randoms = new Float32Array(count);
  // Seeded placement keeps the composition stable across reloads.
  let seed = 42; const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (random() - 0.5) * 27; positions[i * 3 + 1] = random() * 12 - 3; positions[i * 3 + 2] = (random() - 0.5) * 17; randoms[i] = random();
    const a = random() * Math.PI * 2, y = random() * 3.4 - 1.7, radius = y > 0 ? 0.95 * Math.sqrt(1 - (y / 1.8) ** 2) : 0.42 * (1 + y / 1.8);
    forms[i * 3] = Math.cos(a) * radius + (y < 0 ? Math.sign(Math.cos(a)) * 0.38 : 0); forms[i * 3 + 1] = y; forms[i * 3 + 2] = Math.sin(a) * radius * 0.7;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geo.setAttribute('aForm', new THREE.BufferAttribute(forms, 3)); geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uPointer: { value: new THREE.Vector2() }, uSize: { value: Math.min(window.devicePixelRatio, 1.8) }, uMorph: { value: 0 }, uOrigin: { value: new THREE.Vector3() } },
    vertexShader: `attribute float aRandom; attribute vec3 aForm; uniform float uMorph; uniform vec3 uOrigin; uniform float uTime; uniform vec2 uPointer; uniform float uSize; varying float vAlpha;
      void main(){vec3 p=position; p.x+=sin(uTime*0.13+aRandom*20.)*0.3; p.y+=cos(uTime*0.16+aRandom*15.)*0.28;
      p=mix(p,aForm*1.6+uOrigin,uMorph);
      vec2 delta=p.xy-uPointer*vec2(8.,5.); float distance=length(delta); p.xy+=normalize(delta+0.001)*exp(-distance*1.3)*0.7;
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(1.3+aRandom*2.)*uSize;vAlpha=0.2+aRandom*0.45;}`,
    fragmentShader: `varying float vAlpha;void main(){float d=length(gl_PointCoord-0.5);if(d>0.5)discard;gl_FragColor=vec4(vec3(0.98,1.,0.96),vAlpha*(1.-smoothstep(0.18,0.5,d)));}`,
  });
  const points = new THREE.Points(geo, mat); scene.add(points); return { points, mat };
}

export function createExperience(canvas: HTMLCanvasElement, state: { current: ExperienceState }, cb: SceneCallbacks) {
  let disposed = false, frame = 0, lastTime = performance.now(), time = 0, rotationX = -0.12, rotationY = -0.45;
  let dragX = 0, dragY = 0, pointerDown = false, pointerStartX = 0, pointerStartY = 0, pointerDistance = 0, reset = 0, lastHover: string | null = null;
  let appliedQuality = '', renderedOnce = false, signature = '', settleUntil = 0, lastRender = 0;
  const explosion = new ScalarTransition(state.current.exploded);
  let wasExploding = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const graphics = renderer.getContext(), debugInfo = graphics.getExtension('WEBGL_debug_renderer_info');
  const softwareRendering = /swiftshader|llvmpipe|software|basic render/i.test(debugInfo ? graphics.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string : '');
  renderer.setClearColor('#e4e8e3', 0); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.82; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2('#e1e6e0', 0.041);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100); camera.position.set(0, 1.55, 12.7); camera.lookAt(0, 0.05, 0);
  const pmrem = new THREE.PMREMGenerator(renderer); const room = new RoomEnvironment(); const env = pmrem.fromScene(room, 0.04); scene.environment = env.texture; room.dispose(); pmrem.dispose();
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight('#f9ffed', '#667985', 0.6));
  const key = new THREE.DirectionalLight('#fffef1', 2.0); key.position.set(-4, 7, 5); scene.add(key);
  const rim = new THREE.DirectionalLight('#efffff', 2.7); rim.position.set(5, 4, -4); scene.add(rim);
  const fill = new THREE.DirectionalLight('#b9cad8', 0.5); fill.position.set(-5, 0, -3); scene.add(fill);
  const { shadow, map: shadowMap } = makeGround(scene); const particles = makeParticles(scene);
  const jaw = createJaw(true), toolset = createInstruments(); scene.add(jaw.group, toolset.group);
  const face = new THREE.Group(); face.name = 'facial-anatomy'; const skull = new THREE.Group(), nerves = createNerves();
  nerves.scale.set(0.8, 0.70, 0.82); nerves.position.set(0, 0.50, 0.25);
  const skin = new THREE.Group(), dermis = new THREE.Group(); face.add(skull, nerves, skin, dermis); scene.add(face);
  let faceLoaded = false, anatomyLoaded = false;
  const abort = new AbortController();
  loadAnatomy(abort.signal).then(scans => {
    if (disposed) { scans.forEach(s => s.geometry.dispose()); return; }
    disposeObject(jaw.lower); disposeObject(jaw.upper); jaw.lower.clear(); jaw.upper.clear(); jaw.teeth.splice(0);
    scans.forEach(({ geometry, tooth }, id) => {
      const faceGeometry = transformScan(geometry.clone(), 'face'); const half = clipToHalf(faceGeometry, true); faceGeometry.dispose();
      skull.add(new THREE.Mesh(half, tooth ? materials.enamel : materials.bone));
      if (id === 52748) jaw.lower.add(new THREE.Mesh(transformScan(geometry.clone(), 'jaw'), materials.bone));
      if (id === 53649 || id === 53650) {
        const upperBone = transformScan(geometry.clone(), 'jaw');
        const alveolar = clipToHalf(upperBone, false, 1, (1496 - 1470) * 0.035); upperBone.dispose();
        alveolar.translate(0, -0.85, 0); jaw.upper.add(new THREE.Mesh(alveolar, materials.bone));
      }
      if (tooth) {
        const t = makeScannedTooth(transformScan(geometry.clone(), 'jaw'), tooth); jaw.teeth.push(t); (tooth < 30 ? jaw.upper : jaw.lower).add(t);
        // The source dentition contains 28 teeth. Four illustrated third molars extend the adult study to 32.
        if (tooth % 10 === 7) {
          const third = transformScan(geometry.clone(), 'jaw'); third.computeBoundingBox(); const center = third.boundingBox!.getCenter(new THREE.Vector3());
          third.translate(-center.x, -center.y, -center.z); third.scale(0.9, 0.93, 0.9); third.translate(center.x + Math.sign(center.x) * 0.07, center.y, center.z - 0.34);
          const t3 = makeScannedTooth(third, tooth + 1); jaw.teeth.push(t3); (tooth < 30 ? jaw.upper : jaw.lower).add(t3);
        }
      }
      geometry.dispose();
    });
    anatomyLoaded = true; settleUntil = performance.now() + 900; cb.anatomyStatus('ready');
  }).catch(error => { if (!disposed && error.name !== 'AbortError') cb.anatomyStatus('error'); });
  const loadedTextures: THREE.Texture[] = [];
  const loading = new THREE.LoadingManager();
  const loader = new GLTFLoader(loading);
  loader.load('/face.glb', gltf => {
    if (disposed) { disposeObject(gltf.scene); return; }
    const original = gltf.scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh;
    if (!original) { cb.faceStatus('error'); return; }
    const geometry = original.geometry.clone(); geometry.computeBoundingBox();
    const box = geometry.boundingBox!, center = box.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z); geometry.scale(0.49, 0.55, 0.48); geometry.translate(0, 0.06, 0.02);
    const textures = new THREE.TextureLoader();
    let texturesReady = 0, textureFailed = false;
    const textureReady = () => {
      texturesReady++;
      if (texturesReady === 2 && !textureFailed && !disposed) {
        faceLoaded = true; settleUntil = performance.now() + 900; cb.faceStatus('ready');
      }
    };
    const textureError = () => { textureFailed = true; if (!disposed) { faceLoaded = false; cb.faceStatus('error'); } };
    const normal = textures.load('/face-normal.jpg', textureReady, undefined, textureError); normal.flipY = false; loadedTextures.push(normal);
    const color = textures.load('/face-color.jpg', textureReady, undefined, textureError); color.flipY = false; color.colorSpace = THREE.SRGBColorSpace; loadedTextures.push(color);
    const skinMat = new THREE.MeshPhysicalMaterial({ color: '#d6c9b6', map: color, normalMap: normal, normalScale: new THREE.Vector2(0.38, 0.38), roughness: 0.59, clearcoat: 0.1, side: THREE.DoubleSide });
    const skinMesh = new THREE.Mesh(clipToHalf(geometry, false), skinMat); skinMesh.name = 'normal-half-face'; skin.add(skinMesh);
    const dermisMat = materials.dermis.clone(); dermisMat.normalMap = normal; dermisMat.normalScale = new THREE.Vector2(0.75, 0.75);
    const rightHalf = clipToHalf(geometry, true);
    const scalp = clipToHalf(rightHalf, true, 1, 1.68), neck = clipToHalf(rightHalf, false, 1, -0.57);
    const aboveNeck = clipToHalf(rightHalf, true, 1, -0.57), middle = clipToHalf(aboveNeck, false, 1, 1.68);
    const temporal = clipToHalf(middle, true, 0, 0.86), medial = clipToHalf(middle, false, 0, 0.86), back = clipToHalf(medial, false, 2, 0);
    for (const part of [scalp, neck, temporal, back]) { const mesh = new THREE.Mesh(part, dermisMat); mesh.scale.setScalar(0.985); dermis.add(mesh); }
    for (const intermediate of [rightHalf, aboveNeck, middle, medial]) intermediate.dispose();
    geometry.dispose(); disposeObject(gltf.scene);
  }, undefined, () => { if (!disposed) cb.faceStatus('error'); });

  const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(10, 10);
  const positionPointer = (event: PointerEvent) => { const bounds = canvas.getBoundingClientRect(); pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1); };
  const intersect = () => {
    raycaster.setFromCamera(pointer, camera);
    const s = state.current;
    if (jaw.group.visible && s.teeth) { const hit = raycaster.intersectObject(jaw.group, true)[0]; return hit?.object.userData.tooth ? hit : undefined; }
    if (toolset.group.visible) return raycaster.intersectObjects(toolset.instruments, true)[0];
  };
  const findInstrument = (object: THREE.Object3D) => { let o: THREE.Object3D | null = object; while (o && o.userData.instrument === undefined) o = o.parent; return o?.userData.instrument as number | undefined; };
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return; positionPointer(event); pointerDown = true; pointerStartX = event.clientX; pointerStartY = event.clientY; pointerDistance = 0; canvas.setPointerCapture(event.pointerId); canvas.classList.add('is-dragging');
  };
  const onPointerMove = (event: PointerEvent) => {
    settleUntil = performance.now() + 500;
    positionPointer(event);
    if (pointerDown) { const dx = event.clientX - pointerStartX, dy = event.clientY - pointerStartY; pointerDistance += Math.abs(dx) + Math.abs(dy); dragY += dx * 0.006; if (event.pointerType !== 'touch') dragX += dy * 0.004; pointerStartX = event.clientX; pointerStartY = event.clientY; return; }
    const hit = intersect(); let text: string | null = null;
    if (hit) { const tooth = hit.object.userData.tooth as ToothInfo | undefined; text = tooth ? `${tooth.id} / ${tooth.name}` : toolset.instruments[findInstrument(hit.object) ?? 0].name; }
    if (text !== lastHover) { lastHover = text; cb.hover(text); canvas.classList.toggle('is-hovering', !!text); }
  };
  const onPointerUp = (event: PointerEvent) => {
    if (pointerDown && pointerDistance < 7) { positionPointer(event); const hit = intersect(); if (hit) { if (hit.object.userData.tooth) cb.selectTooth(hit.object.userData.tooth); else { const index = findInstrument(hit.object); if (index !== undefined) cb.selectInstrument(index); } } }
    pointerDown = false; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); canvas.classList.remove('is-dragging');
  };
  const cancel = () => { pointerDown = false; canvas.classList.remove('is-dragging'); };
  const leave = () => { if (!pointerDown) { pointer.set(10, 10); lastHover = null; cb.hover(null); } };
  const onKey = (event: KeyboardEvent) => {
    settleUntil = performance.now() + 800;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'r', 'R'].includes(event.key)) {
      event.preventDefault(); if (event.key === 'ArrowLeft') dragY -= 0.18; if (event.key === 'ArrowRight') dragY += 0.18;
      if (event.key === 'ArrowUp') dragX -= 0.14; if (event.key === 'ArrowDown') dragX += 0.14;
      if (event.key.toLowerCase() === 'r') { dragX = 0; dragY = 0; }
    }
  };
  const onContextLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); cb.error('The 3D view was interrupted. Reload the experience to reconnect.'); };
  canvas.addEventListener('pointerdown', onPointerDown); canvas.addEventListener('pointermove', onPointerMove); canvas.addEventListener('pointerup', onPointerUp); canvas.addEventListener('pointercancel', cancel); canvas.addEventListener('pointerleave', leave); canvas.addEventListener('keydown', onKey); canvas.addEventListener('webglcontextlost', onContextLost);
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); appliedQuality = ''; settleUntil = performance.now() + 900; };
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();

  function tick(now: number) {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    if (document.hidden) { lastTime = now; return; }
    const nextSignature = JSON.stringify(state.current);
    if (signature !== nextSignature) { signature = nextSignature; settleUntil = now + 900; }
    explosion.setTarget(state.current.exploded, now, state.current.reducedMotion);
    const exploding = explosion.active(now);
    if (exploding || wasExploding) settleUntil = Math.max(settleUntil, now + 200);
    wasExploding = exploding;
    if (renderedOnce && (state.current.paused || state.current.reducedMotion) && !pointerDown && !exploding && now > settleUntil) { lastTime = now; return; }
    const interacting = pointerDown || exploding || now < settleUntil;
    const frameBudget = softwareRendering ? (interacting ? 33 : 125) : state.current.quality === 'high' || interacting ? 16 : 32;
    if (now - lastRender < frameBudget) return;
    lastRender = now;
    const dt = state.current.reducedMotion ? 1 : Math.min((now - lastTime) / 1000, 0.1); lastTime = now;
    const s = state.current, mobile = camera.aspect < 0.85, motion = !s.paused && !s.reducedMotion;
    if (motion) time += dt;
    const qualityKey = `${s.quality}-${mobile}`;
    if (appliedQuality !== qualityKey) { renderer.setPixelRatio(s.quality === 'low' || (s.quality === 'auto' && softwareRendering) ? 0.85 : Math.min(window.devicePixelRatio, s.quality === 'high' ? 2 : mobile ? 1.3 : 1.7)); appliedQuality = qualityKey; }
    if (s.reset !== reset) { reset = s.reset; dragX = 0; dragY = 0; }
    dragX = clamp(dragX, -0.9, 0.9);
    rotationX = THREE.MathUtils.damp(rotationX, -0.12 + dragX, 7, dt);
    rotationY = THREE.MathUtils.damp(rotationY, -0.45 + dragY, 7, dt);
    const progress = clamp(s.progress, 0, 3), toFace = smooth(1.05, 1.95, progress);
    const x = mobile ? 0 : camera.aspect > 1.8 ? 2.1 : 1.8, bob = motion ? Math.sin(time * 0.7) * 0.065 : 0;
    const baseScale = mobile ? 0.83 : 1.16;
    jaw.group.visible = progress < 1.5 && anatomyLoaded; face.visible = progress >= 1.5 && progress < 2.5 && faceLoaded && anatomyLoaded; toolset.group.visible = progress >= 2.5;
    jaw.group.position.set(x, (mobile ? -1.0 : 0.05) + bob + verticalChapterOffset(progress, 1), 0);
    jaw.group.scale.setScalar(baseScale); jaw.group.rotation.set(rotationX, rotationY + Math.min(progress, 1) * 0.11, -0.09 + (motion ? Math.sin(time * 0.3) * 0.026 : 0));
    const exploded = explosion.sample(now);
    jaw.hinge.rotation.x = THREE.MathUtils.damp(jaw.hinge.rotation.x, s.jawOpen * 0.48, 7, dt);
    jaw.hinge.rotation.x = Math.max(jaw.hinge.rotation.x, exploded * 0.65 * 0.48);
    jaw.upper.position.y = 1.03 + exploded * 1.05;
    jaw.teeth.forEach(t => {
      const info = t.userData.tooth as ToothInfo, home = t.userData.home as THREE.Vector3;
      t.visible = s.teeth; const selected = s.selectedTooth === info.id;
      t.children.forEach(part => { if (part.name === 'root') part.visible = exploded > 0.05; });
      const offset = exploded * 0.5;
      const target = home.clone(); target.x *= 1 + exploded * 0.18; target.z += (home.z + 0.7) * exploded * 0.14;
      target.y += (info.arch === 'Upper' ? -1 : 1) * offset;
      t.userData.selectionOffset = THREE.MathUtils.damp(t.userData.selectionOffset ?? 0, selected ? 0.25 : 0, 7, dt);
      target.z += t.userData.selectionOffset;
      t.position.copy(target);
      const crown = t.getObjectByName('crown') as THREE.Mesh; const mat = crown.material as THREE.MeshPhysicalMaterial;
      mat.emissive.set(selected ? '#83a888' : '#000000'); mat.emissiveIntensity = selected ? 0.22 : 0;
    });
    face.position.set(x, (mobile ? -0.85 : 0.18) + bob + verticalChapterOffset(progress, 2), 0);
    face.scale.setScalar(mobile ? 0.95 : 1.22); face.rotation.set(rotationX * 0.6, rotationY * 0.55, -0.03);
    console.log(s.layers);
    skin.visible = s.layers.skin; dermis.visible = s.layers.dermis; skull.visible = s.layers.bone; nerves.visible = s.layers.nerves;
    skin.position.x = THREE.MathUtils.damp(skin.position.x, -s.spread * 0.5, 7, dt);
    dermis.position.x = THREE.MathUtils.damp(dermis.position.x, s.spread * 0.8, 7, dt);
    nerves.position.x = THREE.MathUtils.damp(nerves.position.x, s.spread * 0.4, 7, dt);
    toolset.group.position.set(x, (mobile ? -1.05 : -0.03) + bob + verticalChapterOffset(progress, 3), 0);
    toolset.group.scale.setScalar(mobile ? 0.87 : 1.33); toolset.group.rotation.set(rotationX * 0.4, rotationY * 0.7, -0.02);
    toolset.instruments.forEach((tool, i) => { const home = tool.userData.home as THREE.Vector3; const selected = s.instrument === i;
      tool.position.x = THREE.MathUtils.damp(tool.position.x, home.x + (s.instrument !== null && !selected ? Math.sign(i - s.instrument) * 0.3 : 0), 6, dt);
      tool.position.z = THREE.MathUtils.damp(tool.position.z, home.z + (selected ? 1.15 : 0), 6, dt);
      tool.rotation.y = THREE.MathUtils.damp(tool.rotation.y, selected && motion ? Math.sin(time * 0.65) * 0.3 : 0, 6, dt);
    });
    camera.position.z = THREE.MathUtils.damp(camera.position.z, (mobile ? 14.8 : 12.7) / s.zoom, 5, dt); camera.updateMatrixWorld();
    particles.mat.uniforms.uTime.value = time; particles.mat.uniforms.uPointer.value.lerp(pointer, 0.025);
    particles.mat.uniforms.uMorph.value = motion && progress > 1 ? Math.pow(Math.sin((progress % 1) * Math.PI), 4) * 0.94 : 0;
    particles.mat.uniforms.uOrigin.value.set(x, mobile ? -0.7 : 0, -0.5);
    shadow.position.x = x; shadow.material.opacity = 0.9 - toFace * 0.25;
    // Static and reduced-motion views render only until direct interactions settle.
    renderer.render(scene, camera);
    if (!renderedOnce) { renderedOnce = true; cb.ready(); }
  }
  frame = requestAnimationFrame(tick);
  return () => {
    disposed = true; abort.abort(); cancelAnimationFrame(frame); observer.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('keydown', onKey); canvas.removeEventListener('webglcontextlost', onContextLost);
    disposeObject(scene); loadedTextures.forEach(t => t.dispose()); shadowMap.dispose(); env.dispose(); renderer.dispose();
  };
}
