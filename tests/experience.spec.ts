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
