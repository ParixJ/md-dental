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

/** Incoming specimens descend from above; outgoing specimens continue below. */
export function verticalChapterOffset(progress: number, chapter: 1 | 2 | 3, travel = 12) {
  const incoming = chapter === 1 ? 0 : 1 - ease((progress - (chapter - 0.5)) / 0.45);
  const outgoing = chapter === 3 ? 0 : ease((progress - (chapter + 0.05)) / 0.45);
  return (incoming - outgoing) * travel;
}
