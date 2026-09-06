/** Small incompressible flow field shared by refraction and particles. */
export class FluidField {
  readonly size: number;
  readonly pixels: Uint8Array;
  readonly velocityX: Float32Array;
  readonly velocityY: Float32Array;
  readonly density: Float32Array;
  private oldX: Float32Array;
  private oldY: Float32Array;
  private oldDensity: Float32Array;
  private pressure: Float32Array;
  private divergence: Float32Array;

  constructor(size = 40) {
    this.size = size;
    const count = size * size;
    this.velocityX = new Float32Array(count); this.velocityY = new Float32Array(count);
    this.oldX = new Float32Array(count); this.oldY = new Float32Array(count);
    this.density = new Float32Array(count); this.oldDensity = new Float32Array(count);
    this.pressure = new Float32Array(count); this.divergence = new Float32Array(count);
    this.pixels = new Uint8Array(count * 4); this.encode();
  }

  splat(u: number, v: number, dx: number, dy: number, strength = 0.5) {
    const n = this.size, cx = u * (n - 1), cy = v * (n - 1);
    for (let y = Math.max(1, Math.floor(cy - 5)); y <= Math.min(n - 2, cy + 5); y++) {
      for (let x = Math.max(1, Math.floor(cx - 5)); x <= Math.min(n - 2, cx + 5); x++) {
        const weight = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / 7), i = x + y * n;
        this.velocityX[i] = Math.max(-50, Math.min(50, this.velocityX[i] + dx * weight));
        this.velocityY[i] = Math.max(-50, Math.min(50, this.velocityY[i] + dy * weight));
        this.density[i] = Math.min(1, this.density[i] + strength * weight);
      }
    }
  }

  private sample(field: Float32Array, x: number, y: number) {
    const n = this.size;
    x = Math.max(0.5, Math.min(n - 1.5, x)); y = Math.max(0.5, Math.min(n - 1.5, y));
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, i = ix + iy * n;
    return (field[i] * (1 - fx) + field[i + 1] * fx) * (1 - fy) + (field[i + n] * (1 - fx) + field[i + n + 1] * fx) * fy;
  }

  step(seconds: number) {
    const dt = Math.min(Math.max(seconds, 0), 0.05), n = this.size;
    this.oldX.set(this.velocityX); this.oldY.set(this.velocityY); this.oldDensity.set(this.density);
    const decay = Math.exp(-dt * 1.3);
    // Semi-Lagrangian advection remains stable under irregular rendering cadence.
    for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
      const i = x + y * n, px = x - this.oldX[i] * dt, py = y - this.oldY[i] * dt;
      this.velocityX[i] = this.sample(this.oldX, px, py) * decay;
      this.velocityY[i] = this.sample(this.oldY, px, py) * decay;
      this.density[i] = this.sample(this.oldDensity, px, py) * Math.exp(-dt * 0.8);
    }
    this.pressure.fill(0);
    for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
      const i = x + y * n;
      this.divergence[i] = -0.5 * (this.velocityX[i + 1] - this.velocityX[i - 1] + this.velocityY[i + n] - this.velocityY[i - n]);
    }
    for (let iteration = 0; iteration < 12; iteration++) {
      for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
        const i = x + y * n;
        this.pressure[i] = (this.divergence[i] + this.pressure[i - 1] + this.pressure[i + 1] + this.pressure[i - n] + this.pressure[i + n]) / 4;
      }
    }
    for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
      const i = x + y * n;
      this.velocityX[i] -= 0.5 * (this.pressure[i + 1] - this.pressure[i - 1]);
      this.velocityY[i] -= 0.5 * (this.pressure[i + n] - this.pressure[i - n]);
    }
    this.encode();
  }

  private encode() {
    for (let i = 0; i < this.density.length; i++) {
      this.pixels[i * 4] = Math.round(128 + Math.max(-1, Math.min(1, this.velocityX[i] / 35)) * 127);
      this.pixels[i * 4 + 1] = Math.round(128 + Math.max(-1, Math.min(1, this.velocityY[i] / 35)) * 127);
      this.pixels[i * 4 + 2] = Math.round(this.density[i] * 255); this.pixels[i * 4 + 3] = 255;
    }
  }
}
