import { mkdir, writeFile, readFile } from 'node:fs/promises';

const toothIds = [55681,55680,55798,55689,55688,55698,55697,55682,55683,55799,55690,55691,55699,55700,57143,57141,55687,55693,55692,55704,55703,57142,57140,55686,55694,55695,55705,55706];
const boneIds = [52748,53649,53650,52734,52735,52736,52738,52739,52788,52789,52892,52893,53647,53648];
await mkdir('reference/anatomy', { recursive: true });
const queue = [...boneIds, ...toothIds];
async function worker() {
  while (queue.length) {
    const id = queue.shift(); const path = `reference/anatomy/FMA${id}.stl`;
    try { await readFile(path); continue; } catch {}
    const response = await fetch(`https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/stl/FMA${id}.stl`, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`${id}: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer()); await writeFile(path, buffer);
    console.log(`FMA${id}: ${(buffer.length / 1024).toFixed(0)} KB`);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
