import { test, expect } from '@playwright/test';

test('desktop journey renders and all model controls work', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error' && /THREE|WebGL|shader/i.test(msg.text())) errors.push(msg.text()); });
  await page.goto('/');
  await expect(page.locator('.experience')).toHaveClass(/is-ready/, { timeout: 60000 });
  await expect(page.locator('.loading-state')).toHaveCount(0, { timeout: 60000 });
  const renderer = await page.locator('canvas').evaluate(canvas => { const gl = canvas.getContext('webgl2')!; const debug = gl.getExtension('WEBGL_debug_renderer_info'); return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
  console.log(`WebGL renderer: ${renderer}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Beneaththe smile.');
  await page.screenshot({ path: testInfo.outputPath('01-desktop-introduction.png') });
  await page.mouse.click(936, 423);
  await expect(page.locator('.inspection-card')).toBeVisible();
  await page.getByRole('button', { name: 'Close tooth details' }).click();
  await page.getByRole('button', { name: 'Bone', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bone', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: testInfo.outputPath('02-desktop-bone.png') });
  await page.getByRole('button', { name: 'Exploded', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exploded', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Begin exploration' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Perfectlycomplex.');
  await page.locator('#tooth-select').selectOption('11');
  await expect(page.getByRole('heading', { level: 2, name: 'Central incisor' })).toBeVisible();
  await page.getByRole('slider', { name: 'Jaw opening' }).fill('0.7');
  await expect(page.getByRole('slider', { name: 'Jaw opening' })).toHaveValue('0.7');
  await page.screenshot({ path: testInfo.outputPath('03-desktop-exploded.png') });
  await page.getByRole('button', { name: 'Chapter 3: Beneath the surface' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('More thanmeets the eye.');
  await expect(page.getByText('Loading the facial study…')).not.toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: testInfo.outputPath('04-desktop-face.png') });
  await page.getByRole('button', { name: 'Nerves' }).click();
  await expect(page.getByRole('button', { name: 'Nerves' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('slider', { name: 'SEPARATE LAYERS' }).fill('0.8');
  await page.getByRole('button', { name: 'Chapter 4: The instruments' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Precision,by design.');
  await page.getByRole('button', { name: '01 Mouth mirror' }).click();
  await expect(page.getByRole('heading', { name: 'A different point of view.' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('05-desktop-instruments.png') });
  await page.getByRole('button', { name: 'About the experience' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Turn sound on' }).click();
  await expect(page.getByRole('button', { name: 'Turn sound off' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Turn sound off' }).click();
  expect(errors).toEqual([]);
});

test('mobile layout remains within the viewport and supports every chapter', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(page.locator('.experience')).toHaveClass(/is-ready/, { timeout: 60000 });
  await expect(page.locator('.loading-state')).toHaveCount(0, { timeout: 60000 });
  for (let i = 0; i < 4; i++) {
    if (i) await page.getByRole('button', { name: `Chapter ${i + 1}: ${['', 'The architecture', 'Beneath the surface', 'The instruments'][i]}` }).click();
    await expect(page.locator('.experience')).toHaveClass(new RegExp(`chapter-${i}`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const controls = await page.locator('.object-controls').boundingBox(); expect(controls!.x).toBeGreaterThanOrEqual(0); expect(controls!.x + controls!.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: testInfo.outputPath(`mobile-chapter-${i + 1}.png`) });
  }
  await page.getByRole('button', { name: 'Open chapter index' }).click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '01 The introduction' }).click(); await expect(page.locator('.experience')).toHaveClass(/chapter-0/);
});

test('keyboard controls, reduced motion, and rendering settings are accessible', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('.experience')).toHaveClass(/is-ready/, { timeout: 60000 });
  await expect(page.locator('.experience')).toHaveClass(/reduced-motion/);
  await page.locator('canvas').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('r');
  await page.getByRole('button', { name: 'Experience settings' }).click();
  await page.getByLabel('Rendering quality').selectOption('low'); await expect(page.getByLabel('Rendering quality')).toHaveValue('low');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('button', { name: 'Experience settings' })).toBeFocused();
  await page.getByRole('button', { name: 'Zoom in' }).click(); await page.getByRole('button', { name: 'Reset model view' }).click();
});

test('a missing face asset produces a visible retry state', async ({ page }) => {
  await page.route('**/face.glb', route => route.abort()); await page.goto('/');
  await page.getByRole('button', { name: 'Chapter 3: Beneath the surface' }).click();
  await expect(page.getByText('The face model could not load. Reload to try again.')).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Reload model' })).toBeVisible();
});

test('a missing anatomical mesh bundle is reported without substituting a model', async ({ page }) => {
  await page.route('**/anatomy.bin', route => route.abort()); await page.goto('/');
  await expect(page.getByText('The anatomy model could not load. Reload the experience to try again.')).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Reload experience' })).toBeVisible();
  await page.getByRole('button', { name: 'Chapter 4: The instruments' }).click();
  await page.getByRole('button', { name: '01 Mouth mirror' }).click();
  await expect(page.getByRole('heading', { name: 'A different point of view.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload experience' })).not.toBeVisible();
});

test('the facial study waits for its textures before reporting ready', async ({ page }) => {
  let releaseTexture!: () => void;
  const textureGate = new Promise<void>(resolve => { releaseTexture = resolve; });
  await page.route('**/face-color.jpg', async route => { await textureGate; await route.continue(); });
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Chapter 3: Beneath the surface' }).click();
    await expect(page.getByText('Loading the facial study…')).toBeVisible({ timeout: 60000 });
    releaseTexture();
    await expect(page.getByText('Loading the facial study…')).not.toBeVisible({ timeout: 60000 });
    await expect(page.getByRole('button', { name: 'Reload model' })).not.toBeVisible();
  } finally { releaseTexture(); }
});

test('a missing facial texture produces a visible retry state', async ({ page }) => {
  await page.route('**/face-color.jpg', route => route.abort()); await page.goto('/');
  await page.getByRole('button', { name: 'Chapter 3: Beneath the surface' }).click();
  await expect(page.getByText('The face model could not load. Reload to try again.')).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Reload model' })).toBeVisible();
});

test('dragging and live animation change the rendered scene', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text()); });
  await page.goto('/'); await expect(page.locator('.experience')).toHaveClass(/is-ready/, { timeout: 60000 }); await expect(page.locator('.loading-state')).toHaveCount(0, { timeout: 60000 });
  const canvas = page.locator('canvas');
  const before = await canvas.screenshot();
  await page.mouse.move(980, 470); await page.mouse.down(); await page.mouse.move(1100, 495, { steps: 8 }); await page.mouse.up();
  const rotated = await canvas.screenshot(); expect(rotated.equals(before)).toBe(false);
  await page.getByRole('button', { name: 'Reset model view' }).click();
  await page.getByRole('button', { name: 'MOTION OFF' }).click();
  await expect(page.getByRole('button', { name: 'MOTION ON' })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.5, behavior: 'instant' }));
  await expect(page.locator('.experience')).toHaveClass(/chapter-2/);
  const moving = await canvas.screenshot();
  await page.screenshot({ path: testInfo.outputPath('live-particle-transition.png') });
  const nextFrame = await canvas.screenshot(); expect(nextFrame.equals(moving)).toBe(false);
  await page.getByRole('button', { name: 'Chapter 4: The instruments' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Precision,by design.');
  await page.getByRole('button', { name: 'MOTION ON' }).click();
  await expect(page.getByRole('button', { name: 'MOTION OFF' })).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('explosion renders intermediate frames and reverses while ambient motion is paused', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') });
  await page.goto('/');
  await expect(page.locator('.loading-state')).toHaveCount(0, { timeout: 60000 });
  await expect(page.locator('.experience')).toHaveClass(/is-ready/, { timeout: 60000 });
  await page.getByRole('button', { name: 'MOTION OFF' }).click();
  await page.getByRole('button', { name: 'MOTION ON' }).click();
  await page.clock.pauseAt(new Date('2030-01-01T01:00:00Z'));
  const canvas = page.locator('canvas');
  await page.getByRole('button', { name: 'Exploded', exact: true }).dispatchEvent('click');
  await expect(page.getByRole('button', { name: 'Exploded', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.clock.fastForward(40);
  const start = await canvas.screenshot({ path: testInfo.outputPath('explosion-start.png') });
  await page.clock.fastForward(750);
  const midway = await canvas.screenshot({ path: testInfo.outputPath('explosion-midway.png') });
  await page.clock.fastForward(850);
  const end = await canvas.screenshot({ path: testInfo.outputPath('explosion-end.png') });
  expect(midway.equals(start)).toBe(false); expect(midway.equals(end)).toBe(false);
  await page.getByRole('button', { name: 'Dentition', exact: true }).dispatchEvent('click');
  await page.clock.fastForward(40); await page.clock.fastForward(750);
  const returning = await canvas.screenshot({ path: testInfo.outputPath('explosion-return.png') });
  expect(returning.equals(end)).toBe(false);
  await page.clock.fastForward(850);
  await expect(page.getByRole('button', { name: 'MOTION OFF' })).toHaveAttribute('aria-pressed', 'false');
});

test('fitted cutaway and vertical chapter movement render from multiple angles', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('.loading-state')).toHaveCount(0, { timeout: 60000 });
  await page.getByRole('button', { name: 'Chapter 3: Beneath the surface' }).click();
  await expect(page.getByText('Loading the facial study…')).not.toBeVisible({ timeout: 60000 });
  await page.locator('canvas').focus();
  for (let i = 0; i < 13; i++) await page.keyboard.press('ArrowLeft');
  await page.screenshot({ path: testInfo.outputPath('face-right-profile.png') });
  await page.getByRole('group', { name: 'Facial layers' }).getByRole('button', { name: /Bone/ }).click();
  await page.screenshot({ path: testInfo.outputPath('face-profile-without-bone.png') });
  await page.getByRole('group', { name: 'Facial layers' }).getByRole('button', { name: /Bone/ }).click();
  await page.getByRole('button', { name: 'Reset model view' }).click();
  // Holding a pointer keeps automatic settling suspended for these in-between views.
  await page.mouse.move(20, 200); await page.mouse.down();
  for (const [name, progress] of [['jaw-exiting-above', 1.2], ['face-entering-below', 1.8], ['face-exiting-above', 2.2], ['instruments-entering-below', 2.8]] as const) {
    await page.evaluate(p => window.scrollTo({ top: window.innerHeight * p, behavior: 'instant' }), progress);
    await expect(page.locator('.experience')).toHaveClass(new RegExp(`chapter-${Math.round(progress)}`));
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  }
  await page.mouse.up();
});

test('partial scrolling settles smoothly in either direction and accepts interruption', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('.loading-state')).toHaveCount(0, { timeout: 60000 });
  await page.getByRole('button', { name: 'MOTION ON' }).click();
  for (const [position, destination] of [[1.27, 1], [1.78, 2], [2.26, 2], [2.74, 3]]) {
    await page.mouse.wheel(0, -1); // A new gesture interrupts an existing snap.
    await page.evaluate(p => window.scrollTo({ top: window.innerHeight * p, behavior: 'instant' }), position);
    await expect.poll(() => page.evaluate(() => window.scrollY / window.innerHeight), { timeout: 12000 }).toBeCloseTo(destination, 2);
    await expect(page.locator('.experience')).toHaveClass(new RegExp(`chapter-${destination}`));
  }
  await page.getByRole('button', { name: 'Chapter 1: The introduction' }).click();
  await page.mouse.wheel(0, 600);
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2.8, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => window.scrollY / window.innerHeight), { timeout: 12000 }).toBeCloseTo(3, 2);
});

test('compact controls and inspection reserve model space on phones and tablets', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('.loading-state')).toHaveCount(0, { timeout: 60000 });
  const separateFromCanvas = async (selector: string) => {
    const model = (await page.locator('canvas').boundingBox())!;
    const panel = (await page.locator(selector).boundingBox())!;
    const overlapX = Math.min(model.x + model.width, panel.x + panel.width) - Math.max(model.x, panel.x);
    const overlapY = Math.min(model.y + model.height, panel.y + panel.height) - Math.max(model.y, panel.y);
    expect(overlapX <= 1 || overlapY <= 1).toBe(true);
    expect(model.width).toBeGreaterThan(250); expect(model.height).toBeGreaterThan(150);
  };
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 360, height: 640 }, { width: 844, height: 390 }]) {
    await page.getByRole('button', { name: 'Chapter 3: Beneath the surface' }).click();
    await expect(page.locator('.experience')).toHaveClass(/chapter-2/);
    await page.setViewportSize(viewport);
    await expect(page.locator('.experience')).toHaveClass(/chapter-2/);
    await expect.poll(() => page.evaluate(() => window.scrollY / window.innerHeight)).toBeCloseTo(2, 2);
    await page.getByRole('button', { name: 'Chapter 2: The architecture' }).click();
    await expect(page.locator('.experience')).toHaveClass(/chapter-1/);
    await page.getByRole('button', { name: 'Adjust model', exact: true }).click();
    await expect(page.locator('.chapter-adjustments')).toBeVisible();
    await separateFromCanvas('.chapter-adjustments');
    await page.locator('#tooth-select').selectOption(viewport.width === 768 ? '36' : '16');
    await expect(page.getByRole('heading', { level: 2, name: 'First molar' })).toBeVisible();
    await expect(page.locator('.chapter-adjustments')).not.toBeVisible();
    await separateFromCanvas('.inspection-card');
    await page.screenshot({ path: testInfo.outputPath(`rear-tooth-${viewport.width}x${viewport.height}.png`) });
    await page.getByRole('button', { name: 'Close tooth details' }).click();
    await page.getByRole('button', { name: 'Chapter 3: Beneath the surface' }).click();
    await expect(page.getByText('Loading the facial study…')).not.toBeVisible({ timeout: 60000 });
    await page.getByRole('button', { name: 'Adjust model', exact: true }).click();
    await separateFromCanvas('.chapter-adjustments');
    await page.getByRole('button', { name: 'Nerves' }).click();
    await page.getByRole('button', { name: 'Close model controls' }).click();
    await page.screenshot({ path: testInfo.outputPath(`face-${viewport.width}x${viewport.height}.png`) });
    await page.getByRole('button', { name: 'Chapter 4: The instruments' }).click();
    await page.getByRole('button', { name: 'Adjust model', exact: true }).click();
    await page.getByRole('button', { name: '01 Mouth mirror' }).click();
    await expect(page.getByRole('heading', { name: 'A different point of view.' })).toBeVisible();
    await separateFromCanvas('.inspection-card');
    await page.getByRole('button', { name: 'Close instrument details' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('controls use solid surfaces without the glass UI overlay', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.loading-state')).toHaveCount(0, { timeout: 60000 });
  await expect(page.locator('.frost-transition')).toHaveCount(0);
  expect(await page.locator('.view-switch').evaluate(element => getComputedStyle(element).backdropFilter)).toBe('none');
  await page.getByRole('button', { name: 'Chapter 2: The architecture' }).click();
  await page.locator('#tooth-select').selectOption('26');
  await expect(page.locator('.inspection-card')).toBeVisible();
  expect(await page.locator('.inspection-card').evaluate(element => getComputedStyle(element).backdropFilter)).toBe('none');
  await page.setViewportSize({ width: 390, height: 844 });
  const adjust = page.getByRole('button', { name: 'Adjust model', exact: true });
  await adjust.click();
  await expect(adjust).toHaveCSS('color', 'rgb(239, 244, 233)');
  await page.getByRole('button', { name: 'Close model controls' }).click();
  await expect(adjust).toHaveCSS('color', 'rgb(53, 75, 60)');
});

test('compact chapter handoffs render specimens at both sides of the boundary', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.loading-state')).toHaveCount(0, { timeout: 60000 });
  await page.getByRole('button', { name: 'Chapter 3: Beneath the surface' }).click();
  await expect(page.getByText('Loading the facial study…')).not.toBeVisible({ timeout: 60000 });
  await page.mouse.move(10, 76); await page.mouse.down();
  for (const progress of [1.48, 1.52, 2.48, 2.52]) {
    await page.evaluate(p => window.scrollTo({ top: window.innerHeight * p, behavior: 'instant' }), progress);
    await expect(page.locator('.experience')).toHaveClass(new RegExp(`chapter-${Math.round(progress)}`));
    await expect.poll(() => page.evaluate(() => window.scrollY / window.innerHeight)).toBeCloseTo(progress, 2);
    await page.screenshot({ path: testInfo.outputPath(`mobile-handoff-${progress}.png`) });
  }
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.scrollY / window.innerHeight)).toBeCloseTo(3, 2);
});
