import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { dentition, type ToothInfo } from './scene/anatomy';
import type { ExperienceState } from './scene/engine';

const Scene = lazy(() => import('./Scene'));
const chapters = [
  { label: 'The introduction', name: 'Beneath\nthe smile.', eyebrow: 'A WORLD WORTH LOOKING INTO', description: 'An extraordinary work of nature.\nA whole new way to see it.', specimen: 'HUMAN DENTITION', tag: 'FORM, FUNCTION & FEELING' },
  { label: 'The architecture', name: 'Perfectly\ncomplex.', eyebrow: '01 / THE ARCHITECTURE', description: 'Thirty-two individual forms.\nOne remarkable system.', specimen: 'MANDIBLE & MAXILLA', tag: 'EVERY DETAIL HAS A PURPOSE' },
  { label: 'Beneath the surface', name: 'More than\nmeets the eye.', eyebrow: '02 / BENEATH THE SURFACE', description: 'Bone. Skin. A network of sensation.\nDiscover the layers that connect us.', specimen: 'FACIAL ANATOMY', tag: 'A STUDY IN CONNECTION' },
  { label: 'The instruments', name: 'Precision,\nby design.', eyebrow: '03 / THE INSTRUMENTS', description: 'Considered in every curve.\nCrafted for the smallest details.', specimen: 'INSTRUMENT COLLECTION', tag: 'THE ART OF ATTENTION' },
];
const instruments = [
  { name: 'Mouth mirror', index: '01', detail: 'A different point of view.', description: 'The angled, reflective surface brings hidden areas into view and directs light into the mouth.' },
  { name: 'Dental explorer', index: '02', detail: 'Sensitivity in the details.', description: 'A slender, curved tip designed for tactile examination of tooth surfaces.' },
  { name: 'College tweezers', index: '03', detail: 'A considered grasp.', description: 'Fine, angled tips allow controlled handling of small materials within the mouth.' },
];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
    diagonal: <><path d="M6 18 18 6M6 6h12v12" /></>,
    down: <><path d="M12 3v17m-6-6 6 6 6-6" /></>,
    reset: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <><path d="M5 12h14" /></>,
    close: <><path d="m6 6 12 12M6 18 18 6" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    layers: <><path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5" /></>,
    rotate: <><ellipse cx="12" cy="12" rx="9" ry="4" /><path d="m17 5 3 5-5 1M12 3v18" /></>,
    pause: <><path d="M9 5v14M15 5v14" /></>,
    play: <><path d="m8 5 11 7-11 7V5Z" /></>,
    menu: <><path d="M4 8h16M4 16h16" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.arrow}</svg>;
}

function Modal({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current!; const previous = document.activeElement as HTMLElement | null; el.showModal(); return () => { el.close(); previous?.focus(); }; }, []);
  return <dialog ref={dialog} className={`dialog ${className}`} aria-label={title} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="dialog-inner"><div className="dialog-top mono"><span>{title}</span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>{children}</div>
  </dialog>;
}

function useAmbientSound() {
  const audio = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const toggle = async () => {
    try {
      if (!audio.current) {
        const context = new AudioContext(); const gain = context.createGain(); gain.gain.value = 0; gain.connect(context.destination);
        for (const frequency of [110, 164.81, 220.3]) {
          const osc = context.createOscillator(); osc.type = 'sine'; osc.frequency.value = frequency;
          const voice = context.createGain(); voice.gain.value = 0.07; osc.connect(voice); voice.connect(gain); osc.start();
          const lfo = context.createOscillator(); lfo.frequency.value = 0.11 + frequency / 4000; const depth = context.createGain(); depth.gain.value = 0.025; lfo.connect(depth); depth.connect(voice.gain); lfo.start();
        }
        audio.current = { context, gain };
      }
      await audio.current.context.resume(); const next = !enabled;
      audio.current.gain.gain.setTargetAtTime(next ? 0.5 : 0, audio.current.context.currentTime, 0.3); setEnabled(next); setError('');
    } catch { setError('Sound is unavailable in this browser.'); }
  };
  useEffect(() => { const onVisibility = () => { if (document.hidden) void audio.current?.context.suspend(); else if (enabled) void audio.current?.context.resume(); }; document.addEventListener('visibilitychange', onVisibility); return () => document.removeEventListener('visibilitychange', onVisibility); }, [enabled]);
  useEffect(() => () => { void audio.current?.context.close(); }, []);
  return { enabled, toggle, error };
}

export default function App() {
  const [chapter, setChapter] = useState(0), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [teeth, setTeeth] = useState(true), [exploded, setExploded] = useState(false), [jawOpen, setJawOpen] = useState(0.23);
  const [selectedTooth, setSelectedTooth] = useState<ToothInfo | null>(null), [instrument, setInstrument] = useState<number | null>(null);
  const [layers, setLayers] = useState({ skin: true, dermis: true, bone: true, nerves: true }), [spread, setSpread] = useState(0);
  const [paused, setPaused] = useState(false), [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [quality, setQuality] = useState<'auto' | 'high' | 'low'>('auto'), [zoom, setZoom] = useState(1), [reset, setReset] = useState(0);
  const [dialog, setDialog] = useState<'index' | 'about' | 'settings' | null>(null), [hover, setHover] = useState<string | null>(null), [faceStatus, setFaceStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [anatomyStatus, setAnatomyStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const sound = useAmbientSound();
  const sceneState = useRef<ExperienceState>({ progress: 0, teeth: true, exploded: 0, jawOpen: 0.23, layers, spread: 0, instrument: null, selectedTooth: null, paused: false, reducedMotion, quality, zoom: 1, reset: 0 });
  Object.assign(sceneState.current, { teeth, exploded: exploded ? 1 : 0, jawOpen, layers, spread, instrument, selectedTooth: selectedTooth?.id ?? null, paused, reducedMotion, quality, zoom, reset });
  const progressBar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => { const progress = Math.min(3, Math.max(0, window.scrollY / window.innerHeight)); sceneState.current.progress = progress; setChapter(Math.min(3, Math.round(progress))); if (progressBar.current) progressBar.current.style.transform = `scaleX(${progress / 3})`; frame = 0; };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', scroll); update();
    const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const change = () => setReducedMotion(media.matches); media.addEventListener('change', change);
    return () => { window.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll); cancelAnimationFrame(frame); media.removeEventListener('change', change); };
  }, []);
  useEffect(() => { if (!teeth) setSelectedTooth(null); }, [teeth]);
  const go = (index: number) => { setDialog(null); setSelectedTooth(null); setZoom(1); setReset(v => v + 1); window.scrollTo({ top: index * window.innerHeight, behavior: reducedMotion ? 'instant' : 'smooth' }); };
  const resetView = () => { setReset(v => v + 1); setZoom(1); setJawOpen(0.23); setSelectedTooth(null); setInstrument(null); setSpread(0); };
  const view = !teeth ? 'bone' : exploded ? 'exploded' : 'dentition';
  const setView = (value: string) => { setTeeth(value !== 'bone'); setExploded(value === 'exploded'); setSelectedTooth(null); };
  const active = chapters[chapter];

  return <>
    <a className="skip-link" href="#experience-controls">Skip to exploration controls</a>
    <div className={`experience ${ready ? 'is-ready' : ''} chapter-${chapter} ${reducedMotion ? 'reduced-motion' : ''}`}>
      <div className="atmosphere" aria-hidden="true" />
      <Suspense fallback={null}><Scene state={sceneState} callbacks={{ ready: () => setReady(true), error: setError, selectTooth: setSelectedTooth, selectInstrument: setInstrument, hover: setHover, faceStatus: setFaceStatus, anatomyStatus: setAnatomyStatus }} /></Suspense>
      <div className="scene-vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <header className="header">
        <button className="brand" onClick={() => go(0)} aria-label="Dental, return to introduction"><span className="brand-word">dental<span className="brand-mark">✳</span></span><span className="brand-caption mono">ANATOMY IN MOTION</span></button>
        <nav className="header-nav" aria-label="Main navigation"><button className="nav-link" onClick={() => setDialog('index')}><span className="status-dot" />Explore the anatomy</button><button className="nav-link" onClick={() => setDialog('about')}>About the experience<Icon name="diagonal" size={14} /></button></nav>
        <button className="menu-button" onClick={() => setDialog('index')} aria-label="Open chapter index"><span className="mono">INDEX</span><Icon name="menu" size={21} /></button>
      </header>
      <main className="overlay-main">
        <div className="editorial" key={chapter}>
          <p className="eyebrow mono"><span className="tiny-cross">+</span>{active.eyebrow}</p>
          <h1>{active.name.split('\n').map((line, i) => <span key={line}>{line}{i === 0 && <br />}</span>)}</h1>
          <p className="intro-description">{active.description.split('\n').map(line => <span key={line}>{line}<br /></span>)}</p>
          {chapter === 0 && <button className="explore-cta" onClick={() => go(1)}><span>Begin exploration</span><span className="cta-circle"><Icon name="arrow" size={19} /></span></button>}
          {chapter === 1 && <div className="detail-controls" id="jaw-controls">
            <label className="range-label mono" htmlFor="jaw-opening"><span>JAW OPENING</span><span>{Math.round(jawOpen * 100)}%</span></label>
            <input id="jaw-opening" type="range" min="0" max="1" step="0.01" value={jawOpen} onChange={e => setJawOpen(Number(e.target.value))} aria-label="Jaw opening" />
            <label className="select-label mono" htmlFor="tooth-select">LOOK A LITTLE CLOSER <Icon name="plus" size={12} /></label>
            <select id="tooth-select" value={selectedTooth?.id ?? ''} disabled={!teeth} onChange={e => setSelectedTooth(dentition.find(t => t.id === Number(e.target.value)) ?? null)}><option value="">Select a tooth to inspect</option>{dentition.map(t => <option key={t.id} value={t.id}>{t.id} · {t.arch} {t.side.toLowerCase()} {t.name.toLowerCase()}</option>)}</select>
          </div>}
          {chapter === 2 && <div className="layer-controls" role="group" aria-label="Facial layers">{(Object.keys(layers) as (keyof typeof layers)[]).map((layer, i) => <button className={`layer-toggle ${layers[layer] ? 'active' : ''}`} key={layer} onClick={() => setLayers(v => ({ ...v, [layer]: !v[layer] }))} aria-pressed={layers[layer]}><span className={`layer-dot layer-${layer}`} /><span>{layer === 'skin' ? 'Surface' : layer === 'bone' ? 'Bone' : layer === 'dermis' ? 'Dermis' : 'Nerves'}</span><span className="mono">0{i + 1}</span><span className="layer-check">{layers[layer] && <Icon name="check" size={12} />}</span></button>)}</div>}
          {chapter === 3 && <div className="instrument-list" aria-label="Choose an instrument">{instruments.map((item, i) => <button key={item.name} className={instrument === i ? 'active' : ''} onClick={() => setInstrument(instrument === i ? null : i)} aria-pressed={instrument === i}><span className="mono">{item.index}</span><span>{item.name}</span><Icon name={instrument === i ? 'minus' : 'diagonal'} size={16} /></button>)}</div>}
        </div>

        <div className="specimen-caption mono" aria-hidden="true"><span className="caption-line" /><span>SPECIMEN / 0{chapter === 0 ? 1 : chapter}</span><strong>{active.specimen}</strong></div>
        <div className="annotation annotation-top mono" aria-hidden="true"><span className="annotation-plus">+</span><span>{chapter < 2 ? 'ENAMEL' : chapter === 2 ? 'SURFACE' : 'STAINLESS STEEL'}<small>{chapter < 2 ? 'NATURALLY EXTRAORDINARY' : chapter === 2 ? 'THE VISIBLE & THE INVISIBLE' : 'FORM FOLLOWS FUNCTION'}</small></span><i /></div>
        <div className="annotation annotation-side mono" aria-hidden="true"><i /><span className="annotation-plus">+</span><span>{chapter < 2 ? (teeth ? '32' : '02') : chapter === 2 ? '04' : '03'}<small>{chapter < 2 ? (teeth ? 'INDIVIDUAL TEETH' : 'BONY ARCHES') : chapter === 2 ? 'CONNECTED LAYERS' : 'PURPOSEFUL FORMS'}</small></span></div>
        <div className="vertical-coordinate mono" aria-hidden="true">{active.tag}<span>—</span>360°</div>

        {(!ready || (chapter < 3 && anatomyStatus === 'loading')) && !error && <div className="loading-state" role="status"><span className="loading-orbit" /><span className="mono">PREPARING YOUR PERSPECTIVE</span></div>}
        {error && <div className="scene-message" role="alert"><p>{error}</p><button className="text-button" onClick={() => window.location.reload()}>Reload experience <Icon name="reset" size={15} /></button></div>}
        {anatomyStatus === 'error' && chapter < 3 && !error && <div className="scene-message" role="alert"><p>The anatomy model could not load. Reload the experience to try again.</p><button className="text-button" onClick={() => window.location.reload()}>Reload experience <Icon name="reset" size={15} /></button></div>}
        {chapter === 2 && faceStatus !== 'ready' && anatomyStatus === 'ready' && !error && <div className="scene-message" role="status"><p>{faceStatus === 'loading' ? 'Loading the facial study…' : 'The face model could not load. Reload to try again.'}</p>{faceStatus === 'error' && <button onClick={() => window.location.reload()} className="text-button">Reload model <Icon name="reset" size={15} /></button>}</div>}

        <div className="object-controls" id="experience-controls" tabIndex={-1}>
          <div className="drag-hint mono"><Icon name="rotate" size={16} /><span>{hover || 'DRAG TO ROTATE · SCROLL TO EXPLORE'}</span></div>
          {chapter < 2 ? <div className="view-switch" role="group" aria-label="Anatomy view"><button className={view === 'dentition' ? 'active' : ''} onClick={() => setView('dentition')} aria-pressed={view === 'dentition'}><span className="view-dot" />Dentition</button><button className={view === 'bone' ? 'active' : ''} onClick={() => setView('bone')} aria-pressed={view === 'bone'}><Icon name="layers" size={14} />Bone</button><button className={view === 'exploded' ? 'active' : ''} onClick={() => setView('exploded')} aria-pressed={view === 'exploded'}><Icon name="plus" size={14} />Exploded</button></div> : chapter === 2 ? <div className="spread-control"><label className="mono" htmlFor="layer-spread">SEPARATE LAYERS</label><input id="layer-spread" type="range" min="0" max="1" step="0.01" value={spread} onChange={e => setSpread(Number(e.target.value))} /></div> : <button className="collection-button" onClick={() => setInstrument(null)}><Icon name="layers" size={15} />View the collection<Icon name="arrow" size={16} /></button>}
        </div>
        <div className="view-tools"><button className="icon-button" aria-label="Zoom in" disabled={zoom >= 1.4} onClick={() => setZoom(v => Math.min(1.4, v + 0.1))}><Icon name="plus" size={16} /></button><button className="icon-button" aria-label="Zoom out" disabled={zoom <= 0.8} onClick={() => setZoom(v => Math.max(0.8, v - 0.1))}><Icon name="minus" size={16} /></button><span /><button className="icon-button" aria-label="Reset model view" onClick={resetView}><Icon name="reset" size={16} /></button></div>

        {selectedTooth && chapter < 2 && <aside className="inspection-card" aria-live="polite"><div className="inspection-top mono"><span>TOOTH / {selectedTooth.id}</span><button className="icon-button" aria-label="Close tooth details" onClick={() => setSelectedTooth(null)}><Icon name="close" size={15} /></button></div><h2>{selectedTooth.name}</h2><span className="mono subline">{selectedTooth.arch} {selectedTooth.side.toLowerCase()} · FDI notation</span><p>{selectedTooth.description}</p></aside>}
        {instrument !== null && chapter === 3 && <aside className="inspection-card" aria-live="polite"><div className="inspection-top mono"><span>INSTRUMENT / {instruments[instrument].index}</span><button className="icon-button" aria-label="Close instrument details" onClick={() => setInstrument(null)}><Icon name="close" size={15} /></button></div><h2>{instruments[instrument].detail}</h2><p>{instruments[instrument].description}</p></aside>}
        <div className="chapter-indicator mono"><span className="status-dot" />A CLOSER LOOK<span className="chapter-number">0{chapter + 1}<span>/ 04</span></span></div>
      </main>
      <footer className="footer">
        <div className="footer-progress"><div ref={progressBar} /></div>
        <button className={`sound-button mono ${sound.enabled ? 'enabled' : ''}`} onClick={() => void sound.toggle()} aria-pressed={sound.enabled} aria-label={sound.enabled ? 'Turn sound off' : 'Turn sound on'}><span className="equalizer" aria-hidden="true"><i /><i /><i /><i /><i /></span>SOUND {sound.enabled ? 'ON' : 'OFF'}</button>
        <nav className="chapter-nav" aria-label="Experience chapters">{chapters.map((item, i) => <button className={chapter === i ? 'active' : ''} onClick={() => go(i)} aria-label={`Chapter ${i + 1}: ${item.label}`} aria-current={chapter === i ? 'step' : undefined} key={item.label}><span className="mono">0{i + 1}</span><i /></button>)}</nav>
        <button className="scroll-prompt mono" onClick={() => go(chapter === 3 ? 0 : chapter + 1)}>{chapter === 3 ? 'BACK TO THE BEGINNING' : 'SCROLL TO DISCOVER'}<Icon name={chapter === 3 ? 'reset' : 'down'} size={14} /></button>
        <div className="footer-right"><button className="motion-button mono" onClick={() => { if (reducedMotion) { setReducedMotion(false); setPaused(false); } else setPaused(v => !v); }} aria-pressed={!paused && !reducedMotion}><Icon name={paused || reducedMotion ? 'play' : 'pause'} size={13} /><span>MOTION {paused || reducedMotion ? 'OFF' : 'ON'}</span></button><button className="settings-button" onClick={() => setDialog('settings')} aria-label="Experience settings"><span /><span /><span /></button></div>
      </footer>
      <div className="sr-only" role="status">{sound.error}</div>
    </div>
    <div className="scroll-track" aria-hidden="true">{chapters.map((item, i) => <section id={`chapter-${i}`} key={item.label} />)}</div>
    {dialog === 'index' && <Modal title="THE EXPLORATION / INDEX" className="index-dialog" onClose={() => setDialog(null)}><h2>A new<br />perspective.</h2><nav aria-label="Chapter index">{chapters.map((item, i) => <button onClick={() => go(i)} key={item.label}><span className="mono">0{i + 1}</span><span>{item.label}</span><Icon name="diagonal" size={24} /></button>)}</nav><p className="mono dialog-footnote">FOUR CHAPTERS. ONE EXTRAORDINARY WORLD.</p></Modal>}
    {dialog === 'about' && <Modal title="ABOUT THE EXPERIENCE" onClose={() => setDialog(null)}><h2>There’s wonder<br />in the details.</h2><p>This is an invitation to look a little closer. An interactive journey through the forms, layers, and finely considered instruments of dentistry.</p><p>Rotate the models. Separate their layers. Explore the architecture behind a smile, at your own pace.</p><div className="about-note"><span className="mono">THE STUDY</span><p>Anatomical meshes paired with illustrative layers, created for visual exploration. Four illustrated third molars extend the source dentition to 32 teeth. The composite models are not intended for diagnosis or clinical training.</p></div><div className="credits"><span className="mono">CREATIVE REFERENCES & CREDITS</span><p>Experience inspired by <a href="https://www.igloo.inc/" target="_blank" rel="noreferrer">Igloo Inc.</a> by Bureaux & Abeto. Face scan by <a href="https://casual-effects.com/data/" target="_blank" rel="noreferrer">Lee Perry-Smith / Infinite-Realities</a>, <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>. Adapted with split geometry and illustrative anatomical layers.</p><p>BodyParts3D, © The Database Center for Life Science, licensed under <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/" target="_blank" rel="noreferrer">CC Attribution-Share Alike 2.1 Japan</a>. Meshes adapted from <a href="https://github.com/Kevin-Mattheus-Moerman/BodyParts3D" target="_blank" rel="noreferrer">Kevin Moerman’s STL conversion</a>. <a href="/ASSET-CREDITS.txt" target="_blank">Full asset credits</a>.</p></div></Modal>}
    {dialog === 'settings' && <Modal title="YOUR EXPERIENCE" onClose={() => setDialog(null)}><h2>Make yourself<br />comfortable.</h2><label className="settings-row"><span>Rendering quality<small>Use Low for a lighter experience.</small></span><select value={quality} onChange={e => setQuality(e.target.value as typeof quality)}><option value="auto">Auto</option><option value="high">High</option><option value="low">Low</option></select></label><label className="settings-row"><span>Reduce motion<small>Keep direct controls, quieten ambient movement.</small></span><input type="checkbox" checked={reducedMotion} onChange={e => setReducedMotion(e.target.checked)} /></label><div className="about-note"><span className="mono">A FEW WAYS TO EXPLORE</span><p>Drag a model to rotate. On a touch screen, drag horizontally to rotate and swipe vertically to scroll. Focus the 3D view and use arrow keys to rotate; press R to reset. Each chapter and model control is accessible with the keyboard.</p></div></Modal>}
  </>;
}
