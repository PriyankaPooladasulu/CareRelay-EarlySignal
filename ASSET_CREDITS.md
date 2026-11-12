# Asset credits

## Fonts (loaded through `next/font/google`, self-hosted at build time)

| Font | Author | License |
|---|---|---|
| Atkinson Hyperlegible Next | Braille Institute of America | SIL Open Font License 1.1 |
| Newsreader | Production Type | SIL Open Font License 1.1 |
| Noto Sans Devanagari, Noto Sans Tamil | Google / Noto project | SIL Open Font License 1.1 |

## 3D eye

The default eye is an **original procedural model** built for this project (`components/chamber/`): geometry,
materials and the fundus textures are generated in code from a seeded random generator. No photos, scans or
third-party models are used. `public/images/eye/*.png` are captures of that same model.

Backup only, behind `NEXT_PUBLIC_EYE_MODE=sketchfab`: "Cross Section of Eye – Anatomy" by Erik Ao on Sketchfab
(model `4bf3236c8fe2407ea3f494a93b8f5aa2`), embedded with visible on-screen credit.
**To do before using it on stage: confirm the model's license on its Sketchfab page and add it here.**

## Icons

lucide-react (ISC License).

## OCR

tesseract.js and tesseract.js-core (Apache 2.0). English language data from `@tesseract.js-data/eng`
(Tesseract `eng.traineddata`, Apache 2.0), bundled in `public/tesseract/` so OCR works offline.

## Content

- Educational text and voice scripts: CareRelay-B `backend/data/retina.json` and `docs/VOICE_SCRIPTS.json`
  (original paraphrase, sourced from NEI/NIH and CDC pages listed in `CareRelay-B/docs/CONTENT_SOURCES.md`).
- French, Hindi and Tamil translations in `lib/i18n.ts` are drafts made for this demo and are **not validated**.
- Resource registry: CareRelay-B `backend/data/resources.json` (UHN, Ontario Health811, College of Optometrists of Ontario).

## Sounds

None. Narration uses the browser's built-in speech synthesis.

## Removed

`public/images/stages/*.png` (fundus images of unknown origin) were removed, along with the Next.js template SVGs.
