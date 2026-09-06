import { useEffect, useRef, type RefObject } from 'react';
import type { ExperienceState } from './scene/engine';
import { dampProgress } from './scene/motion';

export function useChapterScroll(state: RefObject<ExperienceState>, onChapter: (chapter: number) => void, progressBar: RefObject<HTMLDivElement | null>, disabled: boolean) {
  const navigate = useRef<(index: number) => void>(() => {});
  const disabledRef = useRef(disabled); disabledRef.current = disabled;
  useEffect(() => {
    let frame = 0, lastTime = performance.now(), lastScroll = lastTime;
    let snapping: number | null = null, touching = false, previousChapter = -1;
    let viewportHeight = window.innerHeight;
    let raw = Math.max(0, Math.min(3, window.scrollY / viewportHeight));
    let rendered = raw;
    const resize = () => {
      viewportHeight = window.innerHeight;
      window.scrollTo({ top: raw * viewportHeight, behavior: 'instant' });
      lastScroll = performance.now();
    };
    const read = () => {
      if (viewportHeight !== window.innerHeight) { resize(); return; }
      raw = Math.max(0, Math.min(3, window.scrollY / viewportHeight));
      if (snapping === null) lastScroll = performance.now();
    };
    const cancelSnap = () => { snapping = null; lastScroll = performance.now(); };
    const touchStart = () => { touching = true; cancelSnap(); };
    const touchEnd = () => { touching = false; lastScroll = performance.now(); };
    const key = (event: KeyboardEvent) => {
      if (['PageDown', 'PageUp', 'Home', 'End', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) cancelSnap();
    };
    navigate.current = index => {
      snapping = Math.max(0, Math.min(3, index));
      if (state.current.reducedMotion) { window.scrollTo({ top: snapping * window.innerHeight, behavior: 'instant' }); raw = snapping; }
    };
    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.064); lastTime = now;
      if (!touching && !disabledRef.current && snapping === null && now - lastScroll > 180 && Math.abs(raw - Math.round(raw)) > 0.001) snapping = Math.round(raw);
      if (snapping !== null && !disabledRef.current) {
        raw = state.current.reducedMotion ? snapping : dampProgress(raw, snapping, dt, 12); 
        if (Math.abs(raw - snapping) * window.innerHeight < 0.6) raw = snapping;
        window.scrollTo({ top: raw * window.innerHeight, behavior: 'smooth' });
        if (raw === snapping) { snapping = null; lastScroll = now; }
      }
      rendered = state.current.reducedMotion ? raw : dampProgress(rendered, raw, dt);
      state.current.progress = rendered;
      const chapter = Math.max(0, Math.min(3, Math.round(rendered)));
      if (chapter !== previousChapter) { previousChapter = chapter; onChapter(chapter); }
      if (progressBar.current) progressBar.current.style.transform = `scaleX(${rendered / 3})`;
      frame = requestAnimationFrame(tick);
    };
    window.addEventListener('scroll', read, { passive: true }); window.addEventListener('resize', resize);
    window.addEventListener('wheel', cancelSnap, { passive: true }); window.addEventListener('pointerdown', touchStart, { passive: true });
    window.addEventListener('pointerup', touchEnd, { passive: true }); window.addEventListener('pointercancel', touchEnd, { passive: true }); window.addEventListener('keydown', key);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame); window.removeEventListener('scroll', read); window.removeEventListener('resize', resize);
      window.removeEventListener('wheel', cancelSnap); window.removeEventListener('pointerdown', touchStart);
      window.removeEventListener('pointerup', touchEnd); window.removeEventListener('pointercancel', touchEnd); window.removeEventListener('keydown', key);
    };
  }, [state, onChapter, progressBar]);
  return navigate;
}
