import { useEffect, useRef, type MutableRefObject } from 'react';
import { createExperience, type ExperienceState, type SceneCallbacks } from './scene/engine';

export default function Scene({ state, callbacks }: { state: MutableRefObject<ExperienceState>; callbacks: SceneCallbacks }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const callbacksRef = useRef(callbacks); callbacksRef.current = callbacks;
  useEffect(() => {
    try {
      return createExperience(canvas.current!, state, {
        ready: () => callbacksRef.current.ready(), error: message => callbacksRef.current.error(message),
        selectTooth: tooth => callbacksRef.current.selectTooth(tooth), selectInstrument: index => callbacksRef.current.selectInstrument(index),
        hover: label => callbacksRef.current.hover(label), faceStatus: status => callbacksRef.current.faceStatus(status),
        anatomyStatus: status => callbacksRef.current.anatomyStatus(status),
      });
    } catch (error) { console.error('Unable to initialize the 3D scene', error); callbacksRef.current.error('Your browser could not start the 3D view. Enable hardware acceleration or try another browser.'); }
  }, [state]);
  return <canvas ref={canvas} className="world-canvas" tabIndex={0} aria-label="Interactive 3D anatomy. Drag to rotate. Use arrow keys to rotate, or R to reset. Scroll to explore chapters." />;
}
