# CareRelay EarlySignal: frontend

From missed signals to completed care. A synthetic demonstration for the Women in AI Canada 2026 Hackathon
(Theme 4, Challenge 1: equitable healthcare). Amina and all her records and device readings are fictional.

CareRelay is not an AI doctor. It reads fragmented records, asks "was something recommended, and can we confirm
it happened?", raises an EarlySignal when it can't, helps navigate the next step under the patient's
constraints, acts only with patient approval, and records completion only when the patient confirms it.

See `DESIGN.md` for the design system and `ASSET_CREDITS.md` for third-party assets.

## Run the demo

Backend (Member B, FastAPI) in one terminal, from `CareRelay-B/`:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

(or double-click `CareRelay-B/START.cmd`). Frontend in another terminal, from the repo root:

```bash
npm install
npm run build
npm run start
```

Open http://localhost:3000. Use port 3000: the backend's CORS only allows `localhost:3000`.
`NEXT_PUBLIC_API_BASE_URL` overrides the backend address (default `http://127.0.0.1:8000`).

If the backend isn't reachable, the app switches automatically to `data/snapshot.json` (a saved deterministic
backend run) and shows an "Offline demo data" pill. The whole journey still works.

Presenter keys: `J` / `K` next or previous section, `R` reset demo, `?` shortcut list.

## Options

- `NEXT_PUBLIC_EYE_MODE=sketchfab` swaps the original 3D eye for the third-party Sketchfab backup (credited on screen).
- `OPENAI_API_KEY` on the server enables the optional `/api/tts` route. It isn't used by default; browser speech is.

## Scripts

- `node scripts/generate-vitals.ts`: regenerate the seeded synthetic device readings (`data/vitals-amina.json`).
- `node scripts/screenshots.mjs [--flow] [--offline]`: capture every scene at 1440×900 and 390×844 into `screenshots/`.
- `node scripts/capture-eye.mjs`: recapture the no-WebGL fallback images in `public/images/eye/`.

Screenshot scripts need `npx playwright install chromium` once.
