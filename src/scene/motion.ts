const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const t = clamp01(value); return clamp01(t * t * t * (t * (t * 6 - 15) + 10)); };

/** A wall-clock transition: low frame rates cannot shorten or strand it mid-way. */
export class ScalarTransition {
  private from: number;
  private target: number;
  private started = 0;
  private duration: number;

  constructor(value: number, duration = 1500) {
    this.from = value; this.target = value; this.duration = duration;
  }

  sample(now: number) { return this.from + (this.target - this.from) * ease((now - this.started) / this.duration); }

  setTarget(value: number, now: number, immediate = false) {
    if (immediate) { this.from = value; this.target = value; this.started = now - this.duration; }
    else if (value !== this.target) { this.from = this.sample(now); this.target = value; this.started = now; }
  }

  active(now: number) { return this.from !== this.target && now < this.started + this.duration; }
}

/** Specimens rise from below and remain partly visible throughout the handoff. */
export function verticalChapterOffset(progress: number, chapter: 1 | 2 | 3, travel = 4.2) {
  const arrival = clamp01((progress - (chapter - 0.5)) / 0.45);
  const incoming = chapter === 1 ? 0 : Math.pow(1 - arrival, 3);
  const outgoing = chapter === 3 ? 0 : ease((progress - (chapter + 0.05)) / 0.45);
  return (outgoing - incoming) * travel;
}

export function dampProgress(current: number, target: number, seconds: number, rate = 18) {
  const value = current + (target - current) * (1 - Math.exp(-rate * Math.max(0, seconds)));
  return Math.abs(value - target) < 0.0001 ? target : value;
}

export function toothSelectionOffset(id: number, homeX: number, amount: number) {
  return id % 10 > 3 ? { x: Math.sign(homeX) * amount * 2.6, z: 0 } : { x: 0, z: amount };
}
