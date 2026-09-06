# Dental — Anatomy in motion

A React + TypeScript + Three.js dental exploration inspired by the continuous 3D world, restrained annotations, icy materials, and scroll choreography of igloo.inc. There are no clinic identities, booking forms, contact details, or appointment integrations.

## Run

Requires Node.js 22.12+ (developed with Node 24).

```sh
npm install
npm run dev
```

Open the URL printed by Vite. On Windows with restricted PowerShell scripts, use `npm.cmd` instead of `npm`.

```sh
npm run build
npm run preview
```

`dist/` is the deployable static site. Serve it over HTTP(S); opening `index.html` as a local file does not load the 3D assets. The build assumes deployment at the domain root. Models, textures, fonts, and audio are local/generated, with no runtime third-party API requirement.

## Experience

- Four chapters with native scrolling, exponential damping, and automatic settling to the nearest chapter after scrolling stops. Incoming models rise from below and outgoing models leave above, with shortened handoffs. Resizing preserves the current chapter.
- A flow-driven particle field responds to pointer movement and chapter transitions. The interface uses solid surfaces; the glass overlay, frost veil, refraction, and floating crystal fragments have been removed.
- An anatomical mandible and maxilla, with 32 individually selectable teeth using FDI identifiers. Selected premolars and molars move outward to the side; incisors and canines move forward. Dentition, bone, and exploded modes; articulated jaw opening. Explode and reassemble use a reversible 1.5-second easing curve, including when ambient motion is paused. Reduced motion keeps immediate changes.
- A split face study with a textured surface on one side and independently toggleable bone, dermis, and nerves on the other. Layers can be separated.
- Three original 3D instruments: mouth mirror, dental explorer, and college tweezers. Each can be selected and brought forward for inspection.
- Drag rotation, keyboard rotation/reset, zoom, contextual descriptions, opt-in procedural ambient sound, motion controls, and rendering quality selection.
- Phones and tablets reserve a central canvas for the model, with compact controls and an expandable adjustment panel. Opening details reduces the canvas area and refits the model so controls do not obscure it. Landscape layouts place details alongside the model.
- Keyboard-accessible dialogs and controls, system reduced-motion support, visibility-aware rendering, and explicit asset failure/retry states. Instrument exploration remains available if an anatomical asset fails. Auto quality detects software renderers and lowers resolution/frame cadence to preserve interaction responsiveness; High retains full resolution.

## Anatomy and fidelity

The jaw and skull use 42 meshes adapted from the BodyParts3D dataset, locally encoded in `public/anatomy.bin`. The dataset provides 28 teeth; four illustrated third molars extend this study to 32. The maxilla is cropped for the dental view. The face uses the Lee Perry-Smith scan, with the skull's width, rear depth, height, and alignment adjusted to fit its proportions, plus original illustrative dermis and nerve layers. These face-specific adjustments do not change the standalone jaw study.

This is a creative dental adaptation of the reference. Its small 2D velocity and density simulation drives the particle field; it does not reproduce Igloo's proprietary assets, volumetric fluid simulation, sound design, or every animation frame. Glass and crystal effects are intentionally absent from the current design. The composite anatomy is illustrative and has not been clinically validated. It must not be used for diagnosis or clinical training.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

Browser tests exercise the built site, including desktop/mobile navigation, rendered screenshots, model controls, sound, keyboard/settings, drag rotation, live animation, and unavailable-asset handling. Delayed and failed facial textures are covered separately. Install the test browser **inside this project** on Windows:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PWD '.test-browsers'
npx.cmd playwright install chromium
npm.cmd run build
npx.cmd playwright test
```

Screenshots and failures are written to `test-results/`. Tests use headless Chromium and log its WebGL renderer. Set `ANATOMY_SOFTWARE_GL=1` to explicitly use SwiftShader for a software-rendering run. Browser checks validate behavior and rendering, but do not establish frame-rate targets on physical phones or across Safari/Firefox.

Local validation on 2026-09-07:

- PASS: TypeScript check and production build.
- PASS: all 11 geometry/data/motion/fluid tests.
- PASS: all 14 Chromium browser scenarios across the full run and focused reruns after correcting a test locator. Coverage includes timed explosion/reassembly, scroll settling and interruption, multi-angle cutaways, solid UI surfaces, and compact icon contrast.
- PASS: compact controls, details, and chapter preservation at 390 × 844, 768 × 1024, 360 × 640, and 844 × 390 viewport sizes. Phone, tablet, and landscape compositions were also visually inspected.
- PASS: screenshots immediately before and after both mobile chapter handoffs retain visible specimens; releasing the scroll settles on the nearest chapter.
- PASS (2026-09-05): production dependency audit, with no reported vulnerabilities. Dependencies are unchanged in this visual revision.
- NOT RUN: physical-device frame-rate profiling and Safari/Firefox validation.

Vite reports a bundle-size warning for the Three.js chunk (approximately 639 kB minified, 163 kB gzip). The build succeeds. The local anatomical binary is approximately 3.8 MB before HTTP compression; the site should be served with compression and static-asset caching in a deployment.

## Asset sources and reproduction

See [public/ASSET-CREDITS.txt](public/ASSET-CREDITS.txt) and the in-app About dialog. The BodyParts3D mesh adaptations remain under CC BY-SA 2.1 Japan; the face scan is CC BY 3.0; fonts are SIL OFL 1.1. Keep these asset notices when distributing the site.

The included geometry can be regenerated without Blender:

```sh
node reference/download-anatomy.mjs
node reference/prepare-anatomy.mjs
```

The first command downloads only the explicit asset list from the public BodyParts3D repository. The second welds vertices, quantizes coordinates, and creates the local binary bundle and its manifest. Source assets and study references live under `reference/`; they are excluded from the production build. No database, external service, paid dependency, or clinic-specific information is required for the implemented scope.
