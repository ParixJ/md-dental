# Dental — Anatomy in motion

A React + TypeScript + Three.js dental exploration inspired by the continuous 3D world, restrained annotations, icy materials, and scroll choreography of igloo.inc. There are no clinic identities, booking forms, contact details, or appointment integrations.

## Run

Requires Node.js 22.12+ (developed with Node 24).

```sh
npm install
npm run dev
```

Open the URL printed by Vite. The development server binds to localhost. On Windows with restricted PowerShell scripts, use `npm.cmd` instead of `npm`.

```sh
npm run build
npm run preview
```

`dist/` is the deployable static site. Serve it over HTTP(S); opening `index.html` as a local file does not load the 3D assets. The build assumes deployment at the domain root. Models, textures, fonts, and audio are local/generated, with no runtime third-party API requirement.

## Experience

- Four chapters with native scrolling, a persistent chapter index, camera/model transitions, and a particle field that gathers into an abstract tooth during chapter changes.
- An anatomical mandible and maxilla, with 32 individually selectable teeth using FDI identifiers. Dentition, bone, and exploded modes; articulated jaw opening.
- A split face study with a textured surface on one side and independently toggleable bone, dermis, and nerves on the other. Layers can be separated.
- Three original 3D instruments: mouth mirror, dental explorer, and college tweezers. Each can be selected and brought forward for inspection.
- Drag rotation, keyboard rotation/reset, zoom, contextual descriptions, opt-in procedural ambient sound, motion controls, and rendering quality selection.
- Responsive composition, keyboard-accessible dialogs and controls, system reduced-motion support, visibility-aware rendering, and explicit asset failure/retry states. Instrument exploration remains available if an anatomical asset fails.

## Anatomy and fidelity

The jaw and skull use 42 meshes adapted from the BodyParts3D dataset, locally encoded in `public/anatomy.bin`. The dataset provides 28 teeth; four illustrated third molars extend this study to 32. The maxilla is cropped for the dental view. The face uses the Lee Perry-Smith scan, fitted to the anatomical bones, with original illustrative dermis and nerve layers.

This is a creative dental adaptation of the reference. It does not reproduce Igloo's proprietary assets, custom crystal-growth pipeline, fluid simulation, sound design, or every animation frame. The composite anatomy is illustrative and has not been clinically validated. It must not be used for diagnosis or clinical training. These are material limits on exact-reference and anatomical fidelity.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

Browser tests exercise the built site, including desktop/mobile navigation, rendered screenshots, model controls, sound, keyboard/settings, and unavailable-asset handling. Install the test browser **inside this project** on Windows:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PWD '.test-browsers'
npx.cmd playwright install chromium
npm.cmd run build
npx.cmd playwright test
```

Screenshots and failures are written to `test-results/`. Tests use headless Chromium and log its WebGL renderer. Set `ANATOMY_SOFTWARE_GL=1` to explicitly use SwiftShader for a software-rendering run. Browser checks validate behavior and rendering, but do not establish frame-rate targets on physical phones or across Safari/Firefox.

## Asset sources and reproduction

See [public/ASSET-CREDITS.txt](public/ASSET-CREDITS.txt) and the in-app About dialog. The BodyParts3D mesh adaptations remain under CC BY-SA 2.1 Japan; the face scan is CC BY 3.0; fonts are SIL OFL 1.1. Keep these asset notices when distributing the site.

The included geometry can be regenerated without Blender:

```sh
node reference/download-anatomy.mjs
node reference/prepare-anatomy.mjs
```

The first command downloads only the explicit asset list from the public BodyParts3D repository. The second welds vertices, quantizes coordinates, and creates the local binary bundle and its manifest. Source assets and study references live under `reference/`; they are excluded from the production build. No database, external service, paid dependency, or clinic-specific information is required for the implemented scope.
